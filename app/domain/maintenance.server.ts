import { orderSearchText } from "../orders/order-search";
import { purgeDeletionMarkers } from "./account-deletion.server";
import { purgeEbayDeletionMarkers } from "./ebay-account-deletion.server";
import { auditRetentionDays } from "./admin-audit.server";
import { notificationWindowMilliseconds } from "./notification-reads.server";
import { syncDailyRetentionDays } from "./product-metrics.server";
import { purgeSupportRequests } from "./support-requests.server";
import { purgeTelegramLinks } from "./telegram.server";
import { purgeTelegramDeliveries } from "./telegram-deliveries.server";

/**
 * Pulizia periodica degli ordini e dei dati tecnici scaduti, eseguita dal consumer
 * del compito giornaliero. L'accesso è già negato prima della cancellazione fisica.
 */
export async function purgeExpiredRecords(db: D1Database, now = new Date()): Promise<void> {
  const at = now.toISOString();
  await db.batch([
    // Le FK eliminano anche buyer, articoli, fonti, verifiche, versioni e grant.
    // Il trigger registra prima i riferimenti necessari a impedire il reimport.
    db.prepare("DELETE FROM orders WHERE merged_into IS NULL AND purge_after <= ?").bind(at),
    db.prepare("DELETE FROM webhook_receipts WHERE expires_at <= ?").bind(at),
    db.prepare('DELETE FROM "session" WHERE "expiresAt" <= ?').bind(at),
    db.prepare('DELETE FROM "verification" WHERE "expiresAt" <= ?').bind(at),
    // Le finestre più lunghe durano un'ora.
    db.prepare('DELETE FROM "rateLimit" WHERE "lastRequest" < ?').bind(now.getTime() - 3_600_000),
    db.prepare("DELETE FROM ebay_store_link_sessions WHERE expires_at <= ?").bind(at),
    db.prepare("DELETE FROM account_email_changes WHERE expires_at <= ?").bind(at),
    purgeTelegramLinks(db, now),
    purgeTelegramDeliveries(db, now),
    purgeSupportRequests(db, now),
    // Registro della console e oggetti chiusi da oltre un anno, compresi gli incidenti
    // comunicati all'owner; preparazioni mai confermate.
    db
      .prepare("DELETE FROM admin_audit WHERE julianday(at) < julianday(?) - ?")
      .bind(at, auditRetentionDays),
    db
      .prepare("DELETE FROM service_notices WHERE julianday(ends_at) < julianday(?) - ?")
      .bind(at, auditRetentionDays),
    db
      .prepare(`DELETE FROM admin_anomalies WHERE resolved_at IS NOT NULL
        AND julianday(resolved_at) < julianday(?) - ?`)
      .bind(at, auditRetentionDays),
    db
      .prepare(`DELETE FROM owner_incidents WHERE resolved_at IS NOT NULL AND notified = 'resolved'
        AND julianday(resolved_at) < julianday(?) - ?`)
      .bind(at, auditRetentionDays),
    db
      .prepare(`DELETE FROM store_transfers WHERE (executed_at IS NULL AND expires_at <= ?1)
        OR julianday(executed_at) < julianday(?1) - ?2`)
      .bind(at, auditRetentionDays),
    // Aggregati giornalieri delle letture e ricevute dei report del browser.
    db
      .prepare("DELETE FROM sync_daily WHERE julianday(day) < julianday(?) - ?")
      .bind(at, syncDailyRetentionDays),
    db.prepare("DELETE FROM page_timing_reports WHERE expires_at <= ?").bind(at),
    // Marker delle cancellazioni dell'account e di quelle richieste da eBay oltre Time Travel,
    // segni dei negozi scaduti.
    ...purgeDeletionMarkers(db, now),
    purgeEbayDeletionMarkers(db, now),
    // Una notifica resta nella campanella al massimo 30 giorni dopo la sua lettura.
    db
      .prepare("DELETE FROM notification_reads WHERE read_at < ?")
      .bind(new Date(now.getTime() - notificationWindowMilliseconds).toISOString()),
  ]);
}

/** Ordini indicizzati per lettura; il limite complessivo resta nel budget del compito. */
const searchBatch = 200;
const searchBatches = 25;

/**
 * Calcola il testo cercabile degli ordini che ancora non l'hanno, cioè quelli presenti prima
 * dell'indicizzazione: le letture successive lo mantengono. Restituisce quanti ne ha scritti;
 * gli eventuali residui restano al turno seguente.
 */
export async function indexOrderSearch(db: D1Database): Promise<number> {
  let indexed = 0;
  for (let batch = 0; batch < searchBatches; batch++) {
    const { results } = await db
      .prepare(
        `SELECT o.id, o.ebay_order_id, json_extract(o.buyer_json, '$.name') AS buyer_name,
                json_extract(o.buyer_json, '$.username') AS buyer_username,
                (SELECT json_group_array(json_object('title', title, 'sku', sku))
                   FROM (SELECT title, sku FROM order_items WHERE order_id = o.id ORDER BY rowid))
                  AS items_json
           FROM orders o WHERE o.search_text IS NULL LIMIT ?`,
      )
      .bind(searchBatch)
      .all<{
        id: string;
        ebay_order_id: string;
        buyer_name: string | null;
        buyer_username: string | null;
        items_json: string;
      }>();
    if (results.length === 0) break;
    await db.batch(
      results.map((row) =>
        db.prepare("UPDATE orders SET search_text = ? WHERE id = ? AND search_text IS NULL").bind(
          orderSearchText({
            ebayOrderId: row.ebay_order_id,
            buyerName: row.buyer_name,
            buyerUsername: row.buyer_username,
            items: JSON.parse(row.items_json) as Array<{ title: string; sku: string | null }>,
          }),
          row.id,
        ),
      ),
    );
    indexed += results.length;
    if (results.length < searchBatch) break;
  }
  return indexed;
}
