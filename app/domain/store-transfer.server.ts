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
 * ricollega con il proprio consenso eBay, poi lo storico si importa secondo il suo piano. Prova,
 * quota e vincoli del Free dei due spazi non ripartono.
 */

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
  | { result: "not_found" | "same_workspace" | "workspace_not_found" };

export async function prepareStoreTransfer(
  db: D1Database,
  input: { storeId: string; toWorkspaceId: string; actor: string; reason: string },
  now = new Date(),
): Promise<PreparedTransfer> {
  const row = await db
    .prepare(`SELECT s.id, ${storeNameSql("s")} AS name, s.workspace_id,
        (SELECT COUNT(*) FROM orders o WHERE o.store_id = s.id) AS orders,
        EXISTS (SELECT 1 FROM workspaces WHERE id = ?2) AS target
      FROM ebay_stores s WHERE s.id = ?1`)
    .bind(input.storeId, input.toWorkspaceId)
    .first<{ id: string; name: string; workspace_id: string; orders: number; target: number }>();
  if (!row) return { result: "not_found" };
  if (row.workspace_id === input.toWorkspaceId) return { result: "same_workspace" };
  if (!row.target) return { result: "workspace_not_found" };
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
  | "conflict";

/**
 * Esegue il trasferimento preparato in un solo commit. Ogni istruzione dipende dalla prima, che
 * segna la preparazione eseguita soltanto se il negozio è ancora dello spazio di partenza e
 * la destinazione esiste: due conferme concorrenti o ripetute ne eseguono una sola.
 */
export async function confirmStoreTransfer(
  db: D1Database,
  input: { id: string; actor: string },
  now = new Date(),
): Promise<{ result: TransferResult; transfer?: { storeId: string; from: string; to: string } }> {
  const at = now.toISOString();
  // Le istruzioni seguenti valgono soltanto per il trasferimento eseguito da questa conferma.
  const mine = `EXISTS (SELECT 1 FROM store_transfers t WHERE t.id = ?1 AND t.executed_at = ?2
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
  const step = (sql: string) => db.prepare(sql).bind(input.id, at, transfer.store_id);
  const [claimed] = await db.batch([
    db
      .prepare(`UPDATE store_transfers SET executed_at = ?2
        WHERE id = ?1 AND executed_at IS NULL AND julianday(expires_at) > julianday(?2)
          AND EXISTS (SELECT 1 FROM ebay_stores s WHERE s.id = store_transfers.store_id
            AND s.workspace_id = store_transfers.from_workspace_id)
          AND EXISTS (SELECT 1 FROM workspaces w WHERE w.id = store_transfers.to_workspace_id)`)
      .bind(input.id, at),
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
      .prepare("SELECT executed_at FROM store_transfers WHERE id = ?")
      .bind(input.id)
      .first<{ executed_at: string | null }>();
    return { result: after?.executed_at ? "already" : "conflict" };
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
