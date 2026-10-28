import { storeIdentityHash, storeMarkSql, trialMarkExpiry } from "./account-deletion.server";
import { applyWorkspacePlan } from "./free-store.server";
import { storeNameSql } from "./store-state.server";

/**
 * Trasferimento assistito di un negozio fra spazi (§8, D009). L'assistenza lo prepara dopo la
 * verifica, con lo stato riletto, e lo conferma una sola volta entro la scadenza: la conferma
 * rilegge appartenenza e spazio di destinazione e fallisce se nel frattempo sono cambiati.
 *
 * Passa soltanto l'identità del negozio. Ordini, sblocchi, credenziali, preferenze Telegram e
 * lavori pendenti restano allo spazio precedente e si eliminano: lo storico, il login e i
 * pagamenti non si trasferiscono. Il negozio arriva scollegato e il nuovo proprietario lo
 * ricollega con il proprio consenso eBay, poi lo storico si importa secondo il suo piano.
 *
 * Il negozio porta i suoi limiti: la conferma scrive lo stesso segno della cancellazione
 * dell'account, che il ricollegamento applica allo spazio di destinazione con la stessa regola.
 * Una prova già usata non si ripete e il ciclo Free in corso prosegue con i suoi sblocchi. Uno
 * dei due spazi con una cancellazione dell'account in corso non partecipa a un trasferimento.
 */

/**
 * Cancellazione dell'account in corso per uno degli spazi o dei loro membri. Argomenti:
 * espressioni SQL dei due spazi.
 */
const deletionSql = (from: string, to: string) => `EXISTS (SELECT 1 FROM account_deletions d
  WHERE d.completed_at IS NULL AND (d.workspace_id IN (${from}, ${to})
    OR d.user_id IN (SELECT user_id FROM workspace_members WHERE workspace_id IN (${from}, ${to}))))`;

/** Durata della preparazione: oltre, la conferma va ripetuta su uno stato riletto. */
const preparationMs = 30 * 60_000;

export type TransferPreview = {
  storeId: string;
  storeName: string;
  fromWorkspaceId: string;
  toWorkspaceId: string;
  orders: number;
};

export type PreparedTransfer =
  | { result: "prepared"; id: string; expiresAt: string; preview: TransferPreview }
  | { result: "not_found" | "same_workspace" | "workspace_not_found" | "account_deletion" };

export async function prepareStoreTransfer(
  db: D1Database,
  input: { storeId: string; toWorkspaceId: string; actor: string; reason: string },
  now = new Date(),
): Promise<PreparedTransfer> {
  const row = await db
    .prepare(`SELECT s.id, ${storeNameSql("s")} AS name, s.workspace_id,
        (SELECT COUNT(*) FROM orders o WHERE o.store_id = s.id) AS orders,
        EXISTS (SELECT 1 FROM workspaces WHERE id = ?2) AS target,
        ${deletionSql("s.workspace_id", "?2")} AS deleting
      FROM ebay_stores s WHERE s.id = ?1`)
    .bind(input.storeId, input.toWorkspaceId)
    .first<{
      id: string;
      name: string;
      workspace_id: string;
      orders: number;
      target: number;
      deleting: number;
    }>();
  if (!row) return { result: "not_found" };
  if (row.workspace_id === input.toWorkspaceId) return { result: "same_workspace" };
  if (!row.target) return { result: "workspace_not_found" };
  if (row.deleting) return { result: "account_deletion" };
  const id = crypto.randomUUID();
  const expiresAt = new Date(now.getTime() + preparationMs).toISOString();
  await db
    .prepare(`INSERT INTO store_transfers (id, store_id, from_workspace_id, to_workspace_id,
        actor, reason, prepared_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(
      id,
      row.id,
      row.workspace_id,
      input.toWorkspaceId,
      input.actor,
      input.reason,
      now.toISOString(),
      expiresAt,
    )
    .run();
  return {
    result: "prepared",
    id,
    expiresAt,
    preview: {
      storeId: row.id,
      storeName: row.name,
      fromWorkspaceId: row.workspace_id,
      toWorkspaceId: input.toWorkspaceId,
      orders: row.orders,
    },
  };
}

export type TransferResult =
  /** Eseguito da questa conferma. */
  | "done"
  /** Già eseguito da una conferma precedente: nulla si ripete. */
  | "already"
  /** Preparazione scaduta, inesistente o di un altro admin. */
  | "expired"
  /** Il negozio o lo spazio di destinazione non sono più quelli verificati. */
  | "conflict"
  /** Uno dei due spazi ha nel frattempo una cancellazione dell'account in corso. */
  | "account_deletion";

/**
 * Esegue il trasferimento preparato in un solo commit. Ogni istruzione dipende dalla prima, che
 * segna la preparazione eseguita soltanto se il negozio è ancora dello spazio di partenza, la
 * destinazione esiste e nessuno dei due spazi si sta cancellando, con l'identificativo casuale
 * di questa esecuzione: due conferme concorrenti o ripetute, anche nello stesso istante, ne
 * eseguono una sola e l'altra non scrive nulla.
 */
export async function confirmStoreTransfer(
  env: Pick<Env, "DB" | "BETTER_AUTH_SECRET">,
  input: { id: string; actor: string },
  now = new Date(),
): Promise<{ result: TransferResult; transfer?: { storeId: string; from: string; to: string } }> {
  const db = env.DB;
  const at = now.toISOString();
  // Esecuzione di questa conferma: due conferme nello stesso istante restano distinte.
  const execution = crypto.randomUUID();
  // Le istruzioni seguenti valgono soltanto per il trasferimento eseguito da questa conferma.
  const mine = `EXISTS (SELECT 1 FROM store_transfers t WHERE t.id = ?1 AND t.execution_id = ?4
    AND t.store_id = ?3)`;
  const transfer = await db
    .prepare(`SELECT store_id, from_workspace_id, to_workspace_id, executed_at, expires_at
      FROM store_transfers WHERE id = ?1 AND actor = ?2`)
    .bind(input.id, input.actor)
    .first<{
      store_id: string;
      from_workspace_id: string;
      to_workspace_id: string;
      executed_at: string | null;
      expires_at: string;
    }>();
  if (!transfer) return { result: "expired" };
  if (transfer.executed_at) return { result: "already" };
  if (Date.parse(transfer.expires_at) <= now.getTime()) return { result: "expired" };
  const identity = await db
    .prepare("SELECT ebay_user_id FROM ebay_stores WHERE id = ?")
    .bind(transfer.store_id)
    .first<string>("ebay_user_id");
  if (!identity) return { result: "conflict" };
  const step = (sql: string) => db.prepare(sql).bind(input.id, at, transfer.store_id, execution);
  const [claimed] = await db.batch([
    db
      .prepare(`UPDATE store_transfers SET executed_at = ?2, execution_id = ?3
        WHERE id = ?1 AND executed_at IS NULL AND julianday(expires_at) > julianday(?2)
          AND EXISTS (SELECT 1 FROM ebay_stores s WHERE s.id = store_transfers.store_id
            AND s.workspace_id = store_transfers.from_workspace_id)
          AND EXISTS (SELECT 1 FROM workspaces w WHERE w.id = store_transfers.to_workspace_id)
          AND NOT ${deletionSql("store_transfers.from_workspace_id", "store_transfers.to_workspace_id")}`)
      .bind(input.id, at, execution),
    // Il segno con i limiti del negozio nello spazio di partenza, prima che lo lasci.
    db
      .prepare(storeMarkSql({ hash: "?5", store: "?3", at: "?2", trialExpires: "?6" }, mine))
      .bind(
        input.id,
        at,
        transfer.store_id,
        execution,
        await storeIdentityHash(env.BETTER_AUTH_SECRET, identity),
        trialMarkExpiry(now),
      ),
    // Credenziali e consenso del vecchio proprietario: ogni lettura partita prima non scrive più.
    step(`DELETE FROM ebay_store_credentials WHERE store_id = ?3 AND ${mine}`),
    // Gli ordini portano con sé articoli, identificativi fiscali, fonti, notifiche e sblocchi.
    step(`DELETE FROM orders WHERE store_id = ?3 AND ${mine}`),
    // I riferimenti eliminati valevano per il vecchio spazio: il nuovo importa il proprio storico.
    step(`DELETE FROM deleted_order_keys WHERE store_id = ?3 AND ${mine}`),
    step(`DELETE FROM sync_state WHERE store_id = ?3 AND ${mine}`),
    step(`DELETE FROM sync_runs WHERE store_id = ?3 AND ${mine}`),
    step(`DELETE FROM ebay_store_pauses WHERE store_id = ?3 AND ${mine}`),
    step(`DELETE FROM telegram_store_preferences WHERE store_id = ?3 AND ${mine}`),
    step(`DELETE FROM telegram_deliveries WHERE store_id = ?3 AND ${mine}`),
    step(`DELETE FROM webhook_receipts WHERE store_id = ?3 AND ${mine}`),
    step(`DELETE FROM ebay_store_link_sessions WHERE expected_store_id = ?3 AND ${mine}`),
    step(`UPDATE ebay_stores SET workspace_id = (SELECT to_workspace_id FROM store_transfers
          WHERE id = ?1), linked_at = ?2, disconnected_at = ?2, data_deleted_at = ?2,
        orders_deleted_through = NULL, store_name = NULL, store_logo_url = NULL, store_url = NULL,
        feedback_score = NULL, feedback_positive_percent = NULL, top_rated_seller = NULL,
        store_profile_read_at = NULL
      WHERE id = ?3 AND ${mine}`),
  ]);
  if (!claimed!.meta.changes) {
    const after = await db
      .prepare(`SELECT executed_at, ${deletionSql("from_workspace_id", "to_workspace_id")} AS deleting
        FROM store_transfers WHERE id = ?`)
      .bind(input.id)
      .first<{ executed_at: string | null; deleting: number }>();
    if (after?.executed_at) return { result: "already" };
    return { result: after?.deleting ? "account_deletion" : "conflict" };
  }
  // Il vecchio spazio sceglie un nuovo negozio attivo del Free fra quelli che gli restano.
  await applyWorkspacePlan(db, transfer.from_workspace_id, now);
  return {
    result: "done",
    transfer: {
      storeId: transfer.store_id,
      from: transfer.from_workspace_id,
      to: transfer.to_workspace_id,
    },
  };
}
