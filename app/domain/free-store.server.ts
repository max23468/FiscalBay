import { abuseSuspendedSql, activeEntitlementSql, paidCoverageSql } from "./grants.server";
import { coveredMonthsSql, freeHistoryDays, historyEndSql } from "./history-window.server";
import { storeNameSql } from "./store-state.server";
import { dayMilliseconds } from "../time";

/**
 * Negozio attivo del Free e downgrade (§6.4, §18, D155). Con una copertura in corso tutti i
 * negozi dello spazio sono ammessi; nel Free soltanto il negozio attivo, gli altri hanno la
 * pausa `plan`: nessuna lettura di eBay e ordini non consultabili. Senza una scelta il negozio
 * attivo è il primo ancora collegato quando il Free si applica, registrato subito: scollegarlo
 * e ricollegarlo non lo sposta. La sostituzione dell'utente vale ogni 90 giorni; l'assistenza
 * può fare eccezione con motivo e autore, senza toccare quota, prova o ciclo.
 *
 * Il riallineamento parte dal cron prima di smistare le letture, a ogni pagina dell'area e al
 * collegamento di un negozio: l'utente non vede mai lo stato precedente al downgrade.
 */

/** Giorni di 24 ore fra due sostituzioni del negozio attivo scelte dall'utente. */
export const freeStoreChangeDays = 90;

/** Conservazione transitoria dei dati esclusi dal Free, dall'istante dell'esclusione. */
const graceSql = (from: string) => `strftime('%Y-%m-%dT%H:%M:%fZ', ${from}, '+30 days')`;

/** Termine del Free per l'ordine: trenta giorni dalla sua data. */
const freeWindowSql = `strftime('%Y-%m-%dT%H:%M:%fZ', orders.creation_time,
  '+${freeHistoryDays} days')`;

/**
 * Negozio eBay reale con i dati ancora presenti. La Sandbox, disponibile soltanto sul test per
 * le qualifiche, resta fuori dal limite del Free.
 */
const realStore = (store: string) =>
  `${store}.data_deleted_at IS NULL AND ${store}.ebay_environment = 'production'`;

/**
 * Negozio attivo registrato per lo spazio: l'ultima riga di un negozio ancora suo. Un negozio
 * trasferito a un altro spazio non resta il negozio attivo di quello precedente. Argomento:
 * espressione dello spazio.
 */
function currentStoreSql(workspace: string) {
  return `(SELECT c.store_id FROM free_store_changes c
    JOIN ebay_stores cs ON cs.id = c.store_id AND cs.workspace_id = c.workspace_id
    WHERE c.workspace_id = ${workspace} ORDER BY c.changed_at DESC, c.rowid DESC LIMIT 1)`;
}

/** Ultima sostituzione esplicita, dell'utente o dell'assistenza. */
function lastChangeSql(workspace: string) {
  return `(SELECT MAX(c.changed_at) FROM free_store_changes c
    WHERE c.workspace_id = ${workspace} AND c.kind <> 'default')`;
}

/**
 * Spazi da riallineare: `workspaces` filtra l'alias `w` per i negozi, `orders` per i termini
 * degli ordini. ?1 è sempre l'istante, gli altri parametri seguono.
 */
type Scope = { workspaces: string; orders: string; binds: unknown[] };

const userScope = (userId: string): Scope => {
  const workspaces = "w.id IN (SELECT workspace_id FROM workspace_members WHERE user_id = ?2)";
  return { workspaces, orders: workspaces, binds: [userId] };
};

const workspaceScope = (workspaceId: string): Scope => ({
  workspaces: "w.id = ?2",
  orders: "w.id = ?2",
  binds: [workspaceId],
});

/** L'istante della colonna cade nell'ultima settimana. */
const lastWeek = (column: string) =>
  `julianday(${column}) BETWEEN julianday(?1, '-7 days') AND julianday(?1)`;

/**
 * Il cron rivede i negozi di ogni spazio, i termini degli ordini soltanto per gli spazi la cui
 * copertura è finita o la cui estensione dello storico è cambiata nell'ultima settimana, e per
 * quelli che perderebbero entro un giorno un ordine ancora dentro la loro finestra, come dopo
 * una copertura concessa senza visite: le visite dell'utente coprono il resto.
 */
const allScope: Scope = {
  workspaces: "1 = 1",
  orders: `(EXISTS (SELECT 1 FROM workspace_entitlements e WHERE e.workspace_id = w.id
      AND ${lastWeek("COALESCE(MIN(e.ends_at, e.revoked_at), e.ends_at, e.revoked_at)")})
    OR EXISTS (SELECT 1 FROM history_extensions x WHERE x.workspace_id = w.id
      AND (${lastWeek("x.granted_at")} OR ${lastWeek("x.revoked_at")}))
    OR w.id IN (SELECT s.workspace_id FROM orders o JOIN ebay_stores s ON s.id = o.store_id
      WHERE o.purge_after > ?1 AND o.purge_after <= strftime('%Y-%m-%dT%H:%M:%fZ', ?1, '+1 day')
        AND o.purge_after < ${historyEndSql("o.creation_time", "s.workspace_id", "?1")}))`,
  binds: [],
};

/**
 * Istruzioni del riallineamento, in un solo batch. Nell'ordine: in Premium il negozio
 * predefinito si dimentica, perché al prossimo downgrade vale di nuovo il primo ancora
 * collegato; nel Free si registra il predefinito se manca o se i suoi dati sono stati eliminati;
 * la pausa `plan` lascia i negozi ammessi e raggiunge gli altri; una copertura toglie la pausa
 * per inattività e il suo preavviso. Infine i termini, secondo la finestra dello spazio: gli
 * ordini che la superano, nel Free o dopo la revoca di un'estensione, tornano alla finestra e
 * restano conservati, non consultabili, per trenta giorni; i negozi esclusi dal Free conservano i
 * propri dati per trenta giorni dalla pausa. Con una copertura gli ordini ancora conservati
 * riprendono la finestra intera, anche durante quei trenta giorni; gli altri termini non si
 * allungano mai. La sospensione antiabuso del Free mette la pausa dell'assistenza su ogni
 * negozio reale dello spazio sospeso senza copertura pagata o concessa e la toglie negli altri
 * casi, senza toccare la pausa manuale della console.
 */
function planStatements(db: D1Database, scope: Scope, at: string) {
  const covered = (workspace: string) => activeEntitlementSql(workspace, "?1");
  const statement = (sql: string) => db.prepare(sql).bind(at, ...scope.binds);
  // Negozi degli spazi coperti con i mesi della loro finestra; l'alias `c` serve ai termini.
  const coveredStores = `(SELECT s.id AS store_id, ${coveredMonthsSql("w.id", "?1")} AS months
      FROM ebay_stores s JOIN workspaces w ON w.id = s.workspace_id
     WHERE ${scope.orders} AND s.data_deleted_at IS NULL AND ${covered("w.id")}) c`;
  const coveredEnd = `strftime('%Y-%m-%dT%H:%M:%fZ', orders.creation_time,
    '+' || c.months || ' months')`;
  return [
    statement(`DELETE FROM free_store_changes WHERE kind = 'default' AND workspace_id IN (
      SELECT w.id FROM workspaces w WHERE ${scope.workspaces} AND ${covered("w.id")})`),
    statement(`INSERT INTO free_store_changes (id, workspace_id, store_id, kind, changed_at)
      SELECT lower(hex(randomblob(16))), w.id, (SELECT s.id FROM ebay_stores s
          WHERE s.workspace_id = w.id AND ${realStore("s")}
          ORDER BY s.disconnected_at IS NOT NULL, s.linked_at, s.id LIMIT 1), 'default', ?1
        FROM workspaces w
       WHERE ${scope.workspaces} AND NOT ${covered("w.id")}
         AND EXISTS (SELECT 1 FROM ebay_stores s WHERE s.workspace_id = w.id AND ${realStore("s")})
         AND NOT EXISTS (SELECT 1 FROM ebay_stores s WHERE s.id = ${currentStoreSql("w.id")}
           AND ${realStore("s")})`),
    statement(`DELETE FROM ebay_store_pauses WHERE reason = 'plan' AND store_id IN (
      SELECT s.id FROM ebay_stores s JOIN workspaces w ON w.id = s.workspace_id
       WHERE ${scope.workspaces} AND (${covered("w.id")} OR s.id = ${currentStoreSql("w.id")}
         OR s.ebay_environment <> 'production'))`),
    // La sola inattività non ferma una copertura in corso, e il preavviso ricevuto prima non
    // vale per il Free che seguirà: ne servirà uno nuovo.
    statement(`DELETE FROM ebay_store_pauses WHERE reason = 'inactivity' AND store_id IN (
      SELECT s.id FROM ebay_stores s JOIN workspaces w ON w.id = s.workspace_id
       WHERE ${scope.workspaces} AND ${covered("w.id")})`),
    statement(`UPDATE workspaces SET inactivity_notice_at = NULL WHERE id IN (
      SELECT w.id FROM workspaces w WHERE ${scope.workspaces} AND w.inactivity_notice_at IS NOT NULL
         AND ${covered("w.id")})`),
    statement(`DELETE FROM ebay_store_pauses WHERE reason = 'admin' AND abuse_review = 1
      AND store_id IN (SELECT s.id FROM ebay_stores s JOIN workspaces w ON w.id = s.workspace_id
       WHERE ${scope.workspaces} AND (NOT ${abuseSuspendedSql("w.id")}
         OR ${paidCoverageSql("w.id", "?1")} OR NOT (${realStore("s")})))`),
    statement(`INSERT OR IGNORE INTO ebay_store_pauses (store_id, reason, paused_at, abuse_review)
      SELECT s.id, 'admin', ?1, 1 FROM ebay_stores s JOIN workspaces w ON w.id = s.workspace_id
       WHERE ${scope.workspaces} AND ${realStore("s")} AND ${abuseSuspendedSql("w.id")}
         AND NOT ${paidCoverageSql("w.id", "?1")}`),
    statement(`INSERT OR IGNORE INTO ebay_store_pauses (store_id, reason, paused_at)
      SELECT s.id, 'plan', ?1 FROM ebay_stores s JOIN workspaces w ON w.id = s.workspace_id
       WHERE ${scope.workspaces} AND ${realStore("s")} AND NOT ${covered("w.id")}
         AND s.id IS NOT ${currentStoreSql("w.id")}`),
    statement(`UPDATE orders SET retention_until = ${freeWindowSql},
        purge_after = MAX(${freeWindowSql}, MIN(purge_after, ${graceSql("?1")}))
      WHERE retention_until > ${freeWindowSql} AND store_id IN (
        SELECT s.id FROM ebay_stores s JOIN workspaces w ON w.id = s.workspace_id
         WHERE ${scope.orders} AND NOT ${covered("w.id")})`),
    statement(`UPDATE orders SET retention_until = ${coveredEnd},
        purge_after = MAX(${coveredEnd}, MIN(purge_after, ${graceSql("?1")}))
      FROM ${coveredStores}
      WHERE orders.store_id = c.store_id AND orders.retention_until > ${coveredEnd}`),
    statement(`UPDATE orders SET retention_until = ${coveredEnd},
        purge_after = MAX(purge_after, ${coveredEnd})
      FROM ${coveredStores}
      WHERE orders.store_id = c.store_id AND orders.retention_until < ${coveredEnd}
        AND orders.purge_after > ?1`),
    statement(`UPDATE orders SET retention_until = MIN(retention_until, ${graceSql("p.paused_at")}),
        purge_after = ${graceSql("p.paused_at")}
      FROM ebay_store_pauses p
      WHERE p.store_id = orders.store_id AND p.reason = 'plan'
        AND orders.purge_after > ${graceSql("p.paused_at")} AND orders.store_id IN (
          SELECT s.id FROM ebay_stores s JOIN workspaces w ON w.id = s.workspace_id
           WHERE ${scope.orders})`),
  ];
}

/** Riallinea lo spazio dell'utente; nessun effetto senza spazio o senza cambiamenti. */
export async function applyFreePlan(db: D1Database, userId: string, now = new Date()) {
  await db.batch(planStatements(db, userScope(userId), now.toISOString()));
}

/** Riallinea uno spazio indicato, come dopo un'operazione della console. */
export async function applyWorkspacePlan(db: D1Database, workspaceId: string, now = new Date()) {
  await db.batch(planStatements(db, workspaceScope(workspaceId), now.toISOString()));
}

/** Riallinea tutti gli spazi: lavoro del cron, senza chiamate a eBay. */
export async function applyFreePlans(db: D1Database, now = new Date()) {
  await db.batch(planStatements(db, allScope, now.toISOString()));
}

/** Negozio attivo del Free mostrato nel piano, con la prima data di una nuova sostituzione. */
export type FreeStoreState = {
  stores: { id: string; name: string }[];
  activeId: string | null;
  /** Prima sostituzione ammessa; null se è già possibile. */
  changeFrom: string | null;
};

const changeMilliseconds = freeStoreChangeDays * dayMilliseconds;

/** Negozi tra cui scegliere e negozio attivo; null in Premium, dove la scelta non compare. */
export async function freeStoreState(
  db: D1Database,
  userId: string,
  now = new Date(),
): Promise<FreeStoreState | null> {
  const { results } = await db
    .prepare(`SELECT s.id, ${storeNameSql("s")} AS name, s.id = ${currentStoreSql("w.id")} AS active,
        ${lastChangeSql("w.id")} AS last_change, ${activeEntitlementSql("w.id", "?2")} AS covered
      FROM workspace_members wm JOIN workspaces w ON w.id = wm.workspace_id
      JOIN ebay_stores s ON s.workspace_id = w.id
      WHERE wm.user_id = ?1 AND ${realStore("s")} ORDER BY s.linked_at, s.id`)
    .bind(userId, now.toISOString())
    .all<{
      id: string;
      name: string;
      active: number;
      last_change: string | null;
      covered: number;
    }>();
  if (results[0]?.covered) return null;
  const last = results[0]?.last_change;
  const from = last ? Date.parse(last) + changeMilliseconds : null;
  return {
    stores: results.map(({ id, name }) => ({ id, name })),
    activeId: results.find((store) => store.active)?.id ?? null,
    changeFrom: from !== null && from > now.getTime() ? new Date(from).toISOString() : null,
  };
}

export type FreeStoreChoice =
  | { result: "done" }
  | { result: "not_found" }
  | { result: "invalid" }
  | { result: "locked"; changeFrom: string };

/**
 * Sostituzione del negozio attivo scelta dall'utente, soltanto nel Free e non prima di 90
 * giorni dall'ultima: la prima è sempre ammessa. Scelta e pause sono un unico commit, quindi
 * due richieste concorrenti ne registrano una sola. Il negozio lasciato va subito in pausa.
 */
export async function chooseFreeStore(
  db: D1Database,
  userId: string,
  storeId: string,
  now = new Date(),
): Promise<FreeStoreChoice> {
  const at = now.toISOString();
  const [{ results }] = await db.batch<{ id: string }>([
    db
      .prepare(`INSERT INTO free_store_changes (id, workspace_id, store_id, kind, changed_at)
        SELECT ?1, s.workspace_id, s.id, 'choice', ?3 FROM ebay_stores s
          JOIN workspace_members wm ON wm.workspace_id = s.workspace_id
        WHERE wm.user_id = ?2 AND s.id = ?4 AND ${realStore("s")}
          AND NOT ${activeEntitlementSql("s.workspace_id", "?3")}
          AND s.id IS NOT ${currentStoreSql("s.workspace_id")}
          AND COALESCE(julianday(${lastChangeSql("s.workspace_id")}) + ${freeStoreChangeDays}, 0)
            <= julianday(?3)
        RETURNING id`)
      .bind(crypto.randomUUID(), userId, at, storeId),
    ...planStatements(db, userScope(userId), at),
  ]);
  if (results.length > 0) return { result: "done" };
  const state = await freeStoreState(db, userId, now);
  if (!state) return { result: "invalid" };
  if (!state.stores.some((store) => store.id === storeId)) return { result: "not_found" };
  if (state.activeId === storeId) return { result: "done" };
  return state.changeFrom
    ? { result: "locked", changeFrom: state.changeFrom }
    : { result: "invalid" };
}

export type AssistedFreeStore = "done" | "not_found" | "covered" | "unchanged";

/**
 * Eccezione dell'assistenza al vincolo dei 90 giorni (§6.4): il negozio indicato diventa il
 * negozio attivo del Free dello spazio, con motivo e autore. Come la scelta dell'utente apre una
 * nuova attesa di 90 giorni e non tocca quota, prova o ciclo. Scelta e pause sono un commit.
 */
export async function assistFreeStore(
  db: D1Database,
  input: { storeId: string; actor: string; reason: string },
  now = new Date(),
): Promise<AssistedFreeStore> {
  const at = now.toISOString();
  const store = await db
    .prepare(`SELECT s.workspace_id, ${activeEntitlementSql("s.workspace_id", "?2")} AS covered,
        s.id IS ${currentStoreSql("s.workspace_id")} AS active
      FROM ebay_stores s WHERE s.id = ?1 AND ${realStore("s")}`)
    .bind(input.storeId, at)
    .first<{ workspace_id: string; covered: number; active: number }>();
  if (!store) return "not_found";
  if (store.covered) return "covered";
  if (store.active) return "unchanged";
  const scope = workspaceScope(store.workspace_id);
  const [{ results }] = await db.batch<{ id: string }>([
    db
      .prepare(`INSERT INTO free_store_changes (id, workspace_id, store_id, kind, changed_at,
          reason, actor)
        SELECT ?1, s.workspace_id, s.id, 'assisted', ?3, ?4, ?5 FROM ebay_stores s
        WHERE s.id = ?2 AND ${realStore("s")}
          AND NOT ${activeEntitlementSql("s.workspace_id", "?3")}
          AND s.id IS NOT ${currentStoreSql("s.workspace_id")}
        RETURNING id`)
      .bind(crypto.randomUUID(), input.storeId, at, input.reason, input.actor),
    ...planStatements(db, scope, at),
  ]);
  return results.length > 0 ? "done" : "unchanged";
}
