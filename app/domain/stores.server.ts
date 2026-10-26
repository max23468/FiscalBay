import { syncMinutes } from "./order-sync.server";
import { dayMilliseconds } from "../time";
import { resumeAfterInactivity } from "./admission.server";
import { activeEntitlementSql } from "./grants.server";
import { historyStartSql } from "./history-window.server";
import { storeNameSql } from "./store-state.server";
import type { EbayEnvironment } from "../integrations/ebay/environment.server";

/**
 * Collegamento dei negozi: stato derivato da scollegamento, consenso e pause, separato
 * dall'attività di sincronizzazione. Ogni operazione verifica che il negozio appartenga allo
 * spazio dell'utente.
 */

/** Username dell'account eBay del negozio. */
const usernameSql = "COALESCE(s.display_name, s.ebay_account_id, s.ebay_user_id)";

export type StoreConnection = "active" | "paused" | "reconnect_required" | "disconnected";
export type PauseReason = "manual" | "plan" | "inactivity" | "admin";

export type StoreStatus = {
  id: string;
  ebayEnvironment: EbayEnvironment;
  name: string;
  username: string;
  /** Logo e pagina del negozio eBay, se il venditore ne ha uno. */
  logoUrl: string | null;
  storeUrl: string | null;
  /** Feedback del venditore su eBay; null prima della lettura. */
  feedback: { score: number; positivePercent: number | null; topRated: boolean } | null;
  connection: StoreConnection;
  pauseReasons: PauseReason[];
  /** Inizio della pausa per inattività del Free, se c'è. */
  inactiveSince: string | null;
  /** Inizio del consenso corrente; null per un negozio scollegato. */
  consentGrantedAt: string | null;
  consentExpiresAt: string | null;
  /** Ultima lettura riuscita degli ordini su eBay. */
  lastSyncAt: string | null;
  /**
   * Un'acquisizione degli ordini tiene il negozio in questo momento. Un blocco rimasto da
   * un'esecuzione interrotta smette di contare alla sua scadenza.
   */
  syncing: boolean;
  /** Cadenza prevista della lettura periodica per il piano dello spazio. */
  targetMinutes: number;
  /** Ultime letture dei recenti, dalla più recente. */
  recent: { at: string; ok: boolean; newOrders: number }[];
  importedOrders: number;
  /** Marketplace pertinente: quello con più ordini del negozio, se gli ordini lo riportano. */
  marketplace: string | null;
  /** Finestra dello storico e completamento della sua importazione; null prima del primo avvio. */
  history: { days: number; done: boolean } | null;
  /**
   * Invito a ricollegare: prima che il consenso scada e, dopo, per al massimo trenta giorni.
   * Mai per i negozi in pausa, che non leggono eBay.
   */
  reminder: { kind: "expiring" | "expired"; at: string } | null;
  /**
   * Consenso ancora valido che scade entro trenta giorni, anche per un negozio in pausa: il
   * pannello del negozio lo segnala, così alla ripresa non serve subito un ricollegamento.
   */
  consentExpiring: boolean;
};

export type StoreActionResult = "done" | "not_found" | "invalid";

/**
 * Le letture di un negozio attivo non riescono: le ultime due sono fallite, quindi un errore
 * isolato, che la lettura successiva supera, non basta.
 */
export function readsFailing(store: StoreStatus) {
  const [last, previous] = store.recent;
  return store.connection === "active" && !!previous && !last!.ok && !previous.ok;
}

/**
 * eBay non risponde: le letture di tutti i negozi attivi non riescono. Riporta l'ultima lettura
 * riuscita fra quei negozi, null se nessuno è mai stato letto; null senza indisponibilità.
 */
export function ebayOutage(stores: StoreStatus[]): { lastSyncAt: string | null } | null {
  const active = stores.filter((store) => store.connection === "active");
  if (active.length === 0 || !active.every(readsFailing)) return null;
  const synced = active.flatMap((store) => (store.lastSyncAt ? [store.lastSyncAt] : []));
  return { lastSyncAt: synced.sort().at(-1) ?? null };
}

/** Indisponibilità di eBay per ambiente: Production e Sandbox rispondono ciascuno per sé. */
export function ebayOutages(
  stores: StoreStatus[],
): Map<StoreStatus["ebayEnvironment"], { lastSyncAt: string | null }> {
  const outages = new Map<StoreStatus["ebayEnvironment"], { lastSyncAt: string | null }>();
  for (const environment of ["production", "sandbox"] as const) {
    const outage = ebayOutage(stores.filter((store) => store.ebayEnvironment === environment));
    if (outage) outages.set(environment, outage);
  }
  return outages;
}

const expiringNoticeMilliseconds = 30 * dayMilliseconds;
const expiredReminderMilliseconds = 30 * dayMilliseconds;

type OwnedStore = { name: string; disconnected_at: string | null };

async function ownedStore(
  db: D1Database,
  userId: string,
  storeId: string,
): Promise<OwnedStore | null> {
  return db
    .prepare(
      `SELECT ${storeNameSql("s")} AS name, s.disconnected_at
         FROM ebay_stores s
         JOIN workspace_members wm ON wm.workspace_id = s.workspace_id
        WHERE wm.user_id = ? AND s.id = ?`,
    )
    .bind(userId, storeId)
    .first<OwnedStore>();
}

type StoreRow = {
  id: string;
  ebay_environment: EbayEnvironment;
  name: string;
  username: string;
  store_logo_url: string | null;
  store_url: string | null;
  feedback_score: number | null;
  feedback_positive_percent: number | null;
  top_rated_seller: number | null;
  disconnected_at: string | null;
  credentials: string | null;
  granted_at: string | null;
  refresh_expires_at: string | null;
  rejected_at: string | null;
  last_success_at: string | null;
  history_from: string | null;
  history_done_at: string | null;
  window_from: string;
  syncing: number | null;
  pauses: string | null;
  inactive_since: string | null;
  premium: number;
  orders: number;
  marketplace: string | null;
};

type RunRow = { store_id: string; started_at: string; ok: number; new_orders: number };

/**
 * Storico di un negozio avviato: i giorni consultabili sono quelli della finestra attuale dello
 * spazio, perché i recenti coprono il tempo dopo il primo avvio. Un'importazione estesa
 * all'attivazione di una copertura conta quindi un anno pieno, e dopo il ritorno al Free valgono
 * i trenta giorni del Free. L'importazione è conclusa soltanto se parte dall'inizio della
 * finestra o prima: una finestra più ampia, come prima della lettura che segue l'attivazione,
 * resta da importare.
 */
function history(row: StoreRow, at: number): NonNullable<StoreStatus["history"]> {
  const windowFrom = Date.parse(row.window_from);
  return {
    days: Math.round((at - windowFrom) / dayMilliseconds),
    done: row.history_done_at !== null && Date.parse(row.history_from!) <= windowFrom,
  };
}

export async function listStores(
  db: D1Database,
  userId: string,
  now = new Date(),
): Promise<StoreStatus[]> {
  const [{ results }, { results: runs }] = await db.batch<StoreRow | RunRow>([
    db
      .prepare(
        `SELECT s.id, s.ebay_environment, ${storeNameSql("s")} AS name, ${usernameSql} AS username,
              s.store_logo_url, s.store_url, s.feedback_score, s.feedback_positive_percent,
              s.top_rated_seller, s.disconnected_at,
              c.store_id AS credentials, c.granted_at, c.refresh_expires_at,
              c.rejected_at, ss.last_success_at, ss.history_from, ss.history_done_at,
              ${historyStartSql("s.workspace_id", "?2")} AS window_from,
              ss.locked_until > ?2 AS syncing,
              (SELECT group_concat(reason) FROM ebay_store_pauses p WHERE p.store_id = s.id)
                AS pauses,
              (SELECT paused_at FROM ebay_store_pauses p WHERE p.store_id = s.id
                AND p.reason = 'inactivity') AS inactive_since,
              ${activeEntitlementSql("s.workspace_id", "?2")} AS premium,
              (SELECT COUNT(*) FROM orders o WHERE o.store_id = s.id AND o.merged_into IS NULL
                AND o.retention_until > ?2
                AND o.is_provisional = 0) AS orders,
              (SELECT o.marketplace_id FROM orders o WHERE o.store_id = s.id
                AND o.marketplace_id IS NOT NULL AND o.merged_into IS NULL
                AND o.retention_until > ?2 AND o.is_provisional = 0
                GROUP BY o.marketplace_id ORDER BY COUNT(*) DESC, o.marketplace_id LIMIT 1)
                AS marketplace
         FROM workspace_members wm
         JOIN ebay_stores s ON s.workspace_id = wm.workspace_id
         LEFT JOIN ebay_store_credentials c ON c.store_id = s.id
         LEFT JOIN sync_state ss ON ss.store_id = s.id
        WHERE wm.user_id = ?1 AND s.data_deleted_at IS NULL
        ORDER BY s.linked_at, s.id`,
      )
      .bind(userId, now.toISOString()),
    // Ultime letture dei negozi dello spazio, dalla più recente.
    db
      .prepare(
        `SELECT r.store_id, r.started_at, r.ok, r.new_orders
           FROM workspace_members wm
           JOIN ebay_stores s ON s.workspace_id = wm.workspace_id
           JOIN sync_runs r ON r.store_id = s.id
          WHERE wm.user_id = ? AND s.data_deleted_at IS NULL
          ORDER BY r.started_at DESC, r.id DESC`,
      )
      .bind(userId),
  ]);
  const recent = new Map<string, StoreStatus["recent"]>();
  for (const run of runs as RunRow[])
    recent.set(run.store_id, [
      ...(recent.get(run.store_id) ?? []),
      { at: run.started_at, ok: run.ok === 1, newOrders: run.new_orders },
    ]);
  const at = now.getTime();
  return (results as StoreRow[]).map((row) => {
    const pauseReasons = (row.pauses?.split(",").sort() ?? []) as PauseReason[];
    const expiresAt = row.refresh_expires_at;
    const expired = !row.credentials || row.rejected_at !== null || Date.parse(expiresAt!) <= at;
    // Un negozio escluso dal piano resta in pausa anche con il consenso scaduto: ricollegarlo
    // non lo farebbe leggere finché non diventa il negozio attivo.
    const connection: StoreConnection = row.disconnected_at
      ? "disconnected"
      : pauseReasons.includes("plan")
        ? "paused"
        : expired
          ? "reconnect_required"
          : pauseReasons.length > 0
            ? "paused"
            : "active";

    let reminder: StoreStatus["reminder"] = null;
    if (pauseReasons.length === 0 && connection === "reconnect_required") {
      // Il consenso si è interrotto con il rifiuto di eBay o alla scadenza nota.
      const since = row.rejected_at ?? expiresAt;
      if (since && at < Date.parse(since) + expiredReminderMilliseconds) {
        reminder = { kind: "expired", at: since };
      }
    } else if (
      connection === "active" &&
      Date.parse(expiresAt!) - at <= expiringNoticeMilliseconds
    ) {
      reminder = { kind: "expiring", at: expiresAt! };
    }
    return {
      id: row.id,
      ebayEnvironment: row.ebay_environment,
      name: row.name,
      username: row.username,
      logoUrl: row.store_logo_url,
      storeUrl: row.store_url,
      feedback:
        row.feedback_score === null
          ? null
          : {
              score: row.feedback_score,
              positivePercent: row.feedback_positive_percent,
              topRated: row.top_rated_seller === 1,
            },
      connection,
      pauseReasons,
      inactiveSince: row.inactive_since,
      consentGrantedAt: row.disconnected_at ? null : row.granted_at,
      consentExpiresAt: row.disconnected_at ? null : expiresAt,
      lastSyncAt: row.last_success_at,
      syncing: row.syncing === 1,
      targetMinutes: syncMinutes[row.premium ? "premium" : "free"],
      recent: recent.get(row.id) ?? [],
      importedOrders: row.orders,
      marketplace: row.marketplace,
      history: row.history_from ? history(row, at) : null,
      reminder,
      // Un negozio scollegato non ha credenziali, quindi risulta già scaduto.
      consentExpiring: !expired && Date.parse(expiresAt!) - at <= expiringNoticeMilliseconds,
    };
  });
}

/** Pausa manuale: ferma le nuove letture, i dati restano consultabili. */
export async function pauseStore(
  db: D1Database,
  userId: string,
  storeId: string,
  now = new Date(),
): Promise<StoreActionResult> {
  const store = await ownedStore(db, userId, storeId);
  if (!store) return "not_found";
  if (store.disconnected_at) return "invalid";
  await db
    .prepare(
      `INSERT OR IGNORE INTO ebay_store_pauses (store_id, reason, paused_at)
       SELECT id, 'manual', ? FROM ebay_stores WHERE id = ? AND disconnected_at IS NULL`,
    )
    .bind(now.toISOString(), storeId)
    .run();
  return "done";
}

/**
 * Toglie la pausa manuale. La ripresa di un negozio in pausa per inattività è la conferma
 * dell'utente e riprende tutti i negozi dello spazio; piano e amministrazione restano.
 */
export async function resumeStore(
  db: D1Database,
  userId: string,
  storeId: string,
  now = new Date(),
): Promise<StoreActionResult> {
  if (!(await ownedStore(db, userId, storeId))) return "not_found";
  const [, { results }] = await db.batch([
    db
      .prepare("DELETE FROM ebay_store_pauses WHERE store_id = ? AND reason = 'manual'")
      .bind(storeId),
    db
      .prepare("SELECT 1 FROM ebay_store_pauses WHERE store_id = ? AND reason = 'inactivity'")
      .bind(storeId),
  ]);
  if (results.length > 0) await resumeAfterInactivity(db, userId, now);
  return "done";
}

function disconnectStatements(db: D1Database, storeId: string, at: string) {
  return [
    // Senza la riga delle credenziali, ogni rinnovo o import partito prima non trova più il
    // consenso che aveva letto e non scrive.
    db.prepare("DELETE FROM ebay_store_credentials WHERE store_id = ?").bind(storeId),
    db
      .prepare("DELETE FROM ebay_store_pauses WHERE store_id = ? AND reason = 'manual'")
      .bind(storeId),
    db
      .prepare("UPDATE ebay_stores SET disconnected_at = COALESCE(disconnected_at, ?) WHERE id = ?")
      .bind(at, storeId),
  ];
}

/**
 * Scollega: FiscalBay smette di leggere eBay e cancella i token. Ordini, diritti, quota e piano
 * restano; ricollegare lo stesso account eBay ritrova questo negozio.
 */
export async function disconnectStore(
  db: D1Database,
  userId: string,
  storeId: string,
  now = new Date(),
): Promise<StoreActionResult> {
  if (!(await ownedStore(db, userId, storeId))) return "not_found";
  await db.batch(disconnectStatements(db, storeId, now.toISOString()));
  return "done";
}

/**
 * Rimuove il negozio dall'elenco ed elimina i dati, senza ripensamento. La conferma riporta
 * il nome. Il riferimento allo spazio resta per riconoscere l'identità al nuovo collegamento
 * e preservare quota e diritti commerciali già registrati.
 */
export async function deleteStoreData(
  db: D1Database,
  userId: string,
  storeId: string,
  confirmation: string,
  now = new Date(),
): Promise<StoreActionResult> {
  const store = await ownedStore(db, userId, storeId);
  if (!store) return "not_found";
  if (confirmation.trim() !== store.name) return "invalid";
  const at = now.toISOString();
  await db.batch([
    ...disconnectStatements(db, storeId, at),
    // Articoli, identificativi fiscali e grant seguono gli ordini.
    db.prepare("DELETE FROM orders WHERE store_id = ?").bind(storeId),
    db.prepare("DELETE FROM sync_state WHERE store_id = ?").bind(storeId),
    db.prepare("DELETE FROM sync_runs WHERE store_id = ?").bind(storeId),
    db
      .prepare(
        `UPDATE ebay_stores SET data_deleted_at = ?1, store_name = NULL, store_logo_url = NULL,
          store_url = NULL, feedback_score = NULL, feedback_positive_percent = NULL,
          top_rated_seller = NULL, store_profile_read_at = NULL,
          orders_deleted_through = MAX(COALESCE(orders_deleted_through, ?1), ?1) WHERE id = ?2`,
      )
      .bind(at, storeId),
  ]);
  return "done";
}
