import {
  limitKey,
  record,
  recordRateLimit,
  spend,
  type Context,
} from "./order-acquisition-context.server";
import { logFailure } from "../errors";
import { inSequence } from "../sequence";
import { dayMilliseconds } from "../time";
import { UpstreamError } from "../integrations/http.server";
import {
  fulfillmentObservation,
  orderIdsLimit,
  readFulfillmentOrders,
} from "../integrations/ebay/fulfillment.server";

/**
 * Rilettura dello username dell'acquirente (§30). Una cancellazione richiesta da eBay trova gli
 * ordini dell'acquirente per token eIAS, che soltanto Trading fornisce entro novanta giorni, e
 * per gli altri soltanto per username, che l'acquirente può cambiare. Gli ordini senza token
 * letti da più di una settimana si rileggono da Fulfillment fino a 50 per chiamata, dalla
 * lettura più vecchia: la rilettura passa dall'import come ogni altra e aggiorna lo username.
 */

/** Intervallo fra due letture dello username di un ordine senza token eIAS. */
export const buyerCheckMilliseconds = 7 * dayMilliseconds;

/**
 * Fulfillment restituisce ordini fino a due anni: oltre, con un giorno di margine, nessuna
 * rilettura. Gli ordini senza marketplace sono fatture combinate senza checkout eBay, che
 * Fulfillment non conosce.
 */
const fulfillmentReachMilliseconds = 729 * dayMilliseconds;

/**
 * Rilegge un gruppo di ordini del negozio con lo username da verificare, con una chiamata del
 * budget dell'esecuzione. È un controllo accessorio: una quota esaurita registra l'attesa e
 * un'indisponibilità lascia il gruppo alla prossima esecuzione, senza segnare la lettura del
 * negozio come non riuscita; un gruppo rifiutato da eBay o con una risposta illeggibile si segna
 * letto, così non si ripete a ogni esecuzione. Le credenziali rifiutate fermano l'esecuzione
 * come nelle altre letture.
 */
export async function checkBuyerNames(ctx: Context): Promise<void> {
  const at = Date.parse(ctx.at);
  const { results } = await ctx.db
    .prepare(
      `SELECT ebay_order_id FROM orders
        WHERE store_id = ? AND buyer_eias_token IS NULL AND is_provisional = 0
          AND merged_into IS NULL AND marketplace_id IS NOT NULL AND creation_time > ?
          AND (buyer_checked_at IS NULL OR buyer_checked_at <= ?)
        ORDER BY buyer_checked_at IS NOT NULL, buyer_checked_at, creation_time, ebay_order_id
        LIMIT ?`,
    )
    .bind(
      ctx.storeId,
      new Date(at - fulfillmentReachMilliseconds).toISOString(),
      new Date(at - buyerCheckMilliseconds).toISOString(),
      orderIdsLimit,
    )
    .all<{ ebay_order_id: string }>();
  const orderIds = results.map((row) => row.ebay_order_id);
  if (orderIds.length === 0 || !spend(ctx.budget, 1, 1)) return;
  try {
    const page = await readFulfillmentOrders(ctx.access, { orderIds });
    // In sequenza: la riconciliazione delle righe presuppone scritture serializzate per negozio.
    await inSequence(page.orders, (order) => record(ctx, fulfillmentObservation(order, ctx.at)));
  } catch (error) {
    if (!(error instanceof UpstreamError) || error.failure === "credentials") throw error;
    if (error.failure === "rate_limited") {
      const key = limitKey(ctx.access.configuration.apiOrigin, error.details.limit);
      await recordRateLimit(ctx.db, key, error, new Date(at));
      return;
    }
    logFailure({ operation: "order_acquisition", error });
    if (error.failure === "unavailable") return;
  }
  // Anche gli ordini che eBay non restituisce: la prossima verifica è fra una settimana.
  await ctx.db
    .prepare(
      `UPDATE orders SET buyer_checked_at = ?
        WHERE store_id = ? AND ebay_order_id IN (SELECT value FROM json_each(?))
          AND (buyer_checked_at IS NULL OR buyer_checked_at < ?)`,
    )
    .bind(ctx.at, ctx.storeId, JSON.stringify(orderIds), ctx.at)
    .run();
}
