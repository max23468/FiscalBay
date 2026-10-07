import {
  recordOrderObservation,
  writableStore,
  type OrderObservation,
} from "./order-import.server";
import type { EbayAccess } from "../integrations/ebay/environment.server";
import {
  fulfillmentObservation,
  readFulfillmentOrders,
} from "../integrations/ebay/fulfillment.server";
import { readItemImage, readTradingTaxIdentifiers } from "../integrations/ebay/trading.server";

/**
 * Immagini delle righe lette da `GetItem` solo per gli articoli del negozio che non ne hanno
 * ancora una. Un errore lascia la riga senza immagine: non blocca l'ordine né i dati fiscali.
 */
async function withItemImages(
  db: D1Database,
  storeId: string,
  access: EbayAccess,
  observation: OrderObservation,
): Promise<OrderObservation> {
  const { results: known } = await db
    .prepare(
      `SELECT i.stable_key FROM order_items i JOIN orders o ON o.id = i.order_id
        WHERE o.store_id = ?1 AND i.image_url IS NOT NULL
          AND i.stable_key IN (SELECT value FROM json_each(?2))`,
    )
    .bind(storeId, JSON.stringify(observation.items.map((item) => item.stableKey)))
    .all<{ stable_key: string }>();
  const skip = new Set(known.map((row) => row.stable_key));
  const images = new Map<string, Promise<string | null>>();
  const items = await Promise.all(
    observation.items.map(async (item) => {
      if (!item.legacyItemId || (item.stableKey && skip.has(item.stableKey))) return item;
      if (!images.has(item.legacyItemId)) {
        images.set(
          item.legacyItemId,
          // Stryker disable next-line ArrowFunction: null e undefined lasciano la riga senza immagine.
          readItemImage(access, item.legacyItemId).catch(() => null),
        );
      }
      const imageUrl = await images.get(item.legacyItemId)!;
      return imageUrl ? { ...item, imageUrl } : item;
    }),
  );
  return { ...observation, items };
}

/** Importa l'ordine più recente con immagini e fonte fiscale Trading. */
export async function importLatestOrder(input: {
  db: D1Database;
  storeId: string;
  grantedAt: string;
  access: EbayAccess;
  now: string;
}): Promise<void> {
  const { db, access, now } = input;
  const page = await readFulfillmentOrders(access, { limit: 1 });
  // Lettura riuscita: l'ultima sincronizzazione del negozio, senza toccare il cursore.
  const recordSync = () =>
    db
      .prepare(
        `INSERT INTO sync_state (store_id, last_success_at, updated_at)
         SELECT ?1, ?3, ?3 WHERE ${writableStore}
         ON CONFLICT(store_id) DO UPDATE SET
           last_success_at = excluded.last_success_at,
           updated_at = excluded.updated_at`,
      )
      .bind(input.storeId, input.grantedAt, now)
      .run();
  if (page.orders.length === 0) {
    await recordSync();
    return;
  }

  const observation = await withItemImages(
    db,
    input.storeId,
    access,
    fulfillmentObservation(page.orders[0], now),
  );
  const trading = await readTradingTaxIdentifiers(access, observation.externalOrderId)
    .then((values) => ({ values }))
    // La lettura Trading fallisce solo con errori già classificati dal confine HTTP.
    .catch((error: unknown) => ({ error }));
  // Senza Trading l'ordine si salva comunque, senza dati fiscali. L'assenza del campo in
  // Trading non è ancora qualificata come rimozione autorevole.
  await recordOrderObservation(
    db,
    { storeId: input.storeId, consentGrantedAt: input.grantedAt, observedAt: now },
    "values" in trading
      ? {
          ...observation,
          taxIdentifiers: {
            source: "ebay_trading_get_orders",
            complete: false,
            values: trading.values,
          },
        }
      : observation,
  );
  if ("error" in trading) throw trading.error;
  await recordSync();
}
