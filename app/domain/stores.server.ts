/**
 * Collegamento dei negozi: stato derivato da scollegamento, consenso e pause, separato
 * dall'attività di sincronizzazione. Ogni operazione verifica che il negozio appartenga allo
 * spazio dell'utente.
 */

export type StoreConnection = "active" | "paused" | "reconnect_required" | "disconnected";
export type PauseReason = "manual" | "plan" | "inactivity" | "admin";

export type StoreStatus = {
  id: string;
  ebayEnvironment: "production" | "sandbox";
  name: string;
  connection: StoreConnection;
  pauseReasons: PauseReason[];
  consentExpiresAt: string | null;
  /**
   * Invito a ricollegare: prima che il consenso scada e, dopo, per al massimo trenta giorni.
   * Mai per i negozi in pausa, che non leggono eBay.
   */
  reminder: { kind: "expiring" | "expired"; at: string } | null;
};

export type StoreActionResult = "done" | "not_found" | "invalid";

const dayMilliseconds = 24 * 60 * 60 * 1000;
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
      `SELECT COALESCE(s.display_name, s.ebay_account_id, s.ebay_user_id) AS name, s.disconnected_at
         FROM ebay_stores s
         JOIN workspace_members wm ON wm.workspace_id = s.workspace_id
        WHERE wm.user_id = ? AND s.id = ?`,
    )
    .bind(userId, storeId)
    .first<OwnedStore>();
}

export async function listStores(
  db: D1Database,
  userId: string,
  now = new Date(),
): Promise<StoreStatus[]> {
  const { results } = await db
    .prepare(
      `SELECT s.id, s.ebay_environment, COALESCE(s.display_name, s.ebay_account_id, s.ebay_user_id) AS name, s.disconnected_at,
              c.store_id AS credentials, c.refresh_expires_at, c.rejected_at,
              (SELECT group_concat(reason) FROM ebay_store_pauses p WHERE p.store_id = s.id)
                AS pauses
         FROM workspace_members wm
         JOIN ebay_stores s ON s.workspace_id = wm.workspace_id
         LEFT JOIN ebay_store_credentials c ON c.store_id = s.id
        WHERE wm.user_id = ?
        ORDER BY s.linked_at, s.id`,
    )
    .bind(userId)
    .all<{
      id: string;
      ebay_environment: "production" | "sandbox";
      name: string;
      disconnected_at: string | null;
      credentials: string | null;
      refresh_expires_at: string | null;
      rejected_at: string | null;
      pauses: string | null;
    }>();
  const at = now.getTime();
  return results.map((row) => {
    const pauseReasons = (row.pauses?.split(",").sort() ?? []) as PauseReason[];
    const expiresAt = row.refresh_expires_at;
    const expired = !row.credentials || row.rejected_at !== null || Date.parse(expiresAt!) <= at;
    const connection: StoreConnection = row.disconnected_at
      ? "disconnected"
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
      connection,
      pauseReasons,
      consentExpiresAt: row.disconnected_at ? null : expiresAt,
      reminder,
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

/** Toglie soltanto la pausa manuale: piano, inattività e amministrazione restano. */
export async function resumeStore(
  db: D1Database,
  userId: string,
  storeId: string,
): Promise<StoreActionResult> {
  if (!(await ownedStore(db, userId, storeId))) return "not_found";
  await db
    .prepare("DELETE FROM ebay_store_pauses WHERE store_id = ? AND reason = 'manual'")
    .bind(storeId)
    .run();
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
 * Scollega ed elimina i dati del negozio, senza ripensamento. La conferma deve riportare il
 * nome del negozio. La quota già consumata non torna disponibile e il negozio resta associato
 * allo spazio, così ricollegarlo non crea un duplicato né un nuovo negozio.
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
    db.prepare("UPDATE ebay_stores SET data_deleted_at = ? WHERE id = ?").bind(at, storeId),
  ]);
  return "done";
}
