import { deadlineCheckAt } from "./order-import.server";
import type { OrderObservation } from "./order-observation.server";
import { writableStore } from "./store-state.server";
import {
  limitKey,
  rateLimitWait,
  record,
  recordRateLimit,
  spend,
  NotWritable,
  type Context,
} from "./order-acquisition-context.server";
import { UpstreamError } from "../integrations/http.server";
import {
  fulfillmentObservation,
  fulfillmentTaxIdentifiers,
  readFulfillmentOrder,
} from "../integrations/ebay/fulfillment.server";
import { dayMilliseconds } from "../time";
import {
  readItemImage,
  readTradingTaxObservation,
  tradingReachDays,
} from "../integrations/ebay/trading.server";

/**
 * Dettaglio delle versioni Fulfillment non ancora lette: dati fiscali e immagini. Un errore
 * del singolo ordine rimanda la versione senza estenderlo all'esecuzione.
 */

// Immagini lette per versione: sempre entro la quota di un negozio, così nessun ordine resta
// in attesa per sempre. Le inserzioni oltre il limite restano senza immagine.
const maxImagesPerDetail = 8;
// Attese dopo il primo, secondo, terzo e quarto errore del dettaglio; il quinto chiude la versione.
const detailRetryMinutes = [15, 60, 240, 960];

/**
 * Immagini già salvate nel negozio per le inserzioni dell'ordine, anche da altri acquisti: la
 * chiave stabile di una riga inizia con l'ID dell'inserzione seguito da `-`.
 */
async function knownImages(
  ctx: Context,
  observation: OrderObservation,
): Promise<Map<string, string>> {
  const listings = [
    // Stryker disable next-line ArrayDeclaration: un ID in più senza righe nel negozio non trova immagini e non cambia l'esito.
    ...new Set(observation.items.flatMap((item) => (item.legacyItemId ? [item.legacyItemId] : []))),
  ];
  const { results } = await ctx.db
    .prepare(
      `SELECT l.value AS listing, (SELECT i.image_url FROM order_items i
           JOIN orders o ON o.id = i.order_id
          WHERE i.stable_key IS NOT NULL AND i.stable_key > l.value || '-'
            AND i.stable_key < l.value || '.' AND o.store_id = ?1 AND o.merged_into IS NULL
            AND i.image_url IS NOT NULL LIMIT 1) AS image_url
         FROM json_each(?2) l`,
    )
    .bind(ctx.storeId, JSON.stringify(listings))
    .all<{ listing: string; image_url: string | null }>();
  return new Map(results.flatMap((row) => (row.image_url ? [[row.listing, row.image_url]] : [])));
}

/** Credenziali rifiutate o limite di eBay: nessuna lettura successiva può riuscire. */
export function stopsReads(error: unknown): error is UpstreamError {
  return (
    error instanceof UpstreamError &&
    (error.failure === "credentials" || error.failure === "rate_limited")
  );
}

/**
 * Limite della quota di una singola chiamata Trading: sospende quella chiamata, non la lettura.
 * Solo un limite di frequenza porta il nome della chiamata.
 */
function callLimit(error: unknown): error is UpstreamError {
  return error instanceof UpstreamError && error.details.limit !== undefined;
}

/** Attesa ancora in corso per la quota di una chiamata Trading. */
async function callLimited(ctx: Context, call: string) {
  const key = limitKey(ctx.access.configuration.apiOrigin, call);
  return (await rateLimitWait(ctx.db, key, new Date(ctx.at))) > 0;
}

export type PendingDetail = {
  external_order_id: string;
  last_modified_time: string;
  detail_attempts: number;
  marketplace_id: string | null;
  creation_time: string;
};

/** Rimanda il dettaglio dopo un errore del singolo ordine o, all'ultimo tentativo, lo chiude. */
async function failDetail(ctx: Context, pending: PendingDetail, error: unknown) {
  const code = error instanceof UpstreamError ? error.failure : "invalid_response";
  // Anche eBay non disponibile riguarda l'esecuzione, non il singolo ordine.
  const runFailure = stopsReads(error) || code === "unavailable";
  const attempts = pending.detail_attempts + 1;
  const delay = detailRetryMinutes[attempts - 1];
  const scope = `WHERE store_id = ?1 AND source = 'fulfillment' AND external_order_id = ?3
                   AND last_modified_time = ?7
                   AND NOT EXISTS (SELECT 1 FROM order_tax_checks tc
                     WHERE tc.order_id = order_source_refs.order_id AND tc.observed_at > ?8)
                   AND EXISTS (SELECT 1 FROM orders o WHERE o.id = order_source_refs.order_id
                     AND o.retention_until > ?9)
                   AND ${writableStore}`;
  await ctx.db
    .prepare(
      runFailure
        ? `UPDATE order_source_refs SET detail_error = ?4 ${scope}`
        : delay === undefined
          ? `UPDATE order_source_refs SET detail_for = last_modified_time, detail_error = ?4,
                  detail_attempts = 0, detail_retry_at = NULL ${scope}`
          : `UPDATE order_source_refs SET detail_error = ?4, detail_attempts = ?5,
                  detail_retry_at = ?6 ${scope}`,
    )
    .bind(
      ctx.storeId,
      ctx.grantedAt,
      pending.external_order_id,
      code,
      attempts,
      delay === undefined ? null : new Date(Date.parse(ctx.at) + delay * 60_000).toISOString(),
      pending.last_modified_time,
      ctx.at,
      deadlineCheckAt(ctx.at),
    )
    .run();
  const writable = await ctx.db
    .prepare(`SELECT 1 WHERE ${writableStore}`)
    .bind(ctx.storeId, ctx.grantedAt)
    .first();
  if (!writable) throw new NotWritable();
  // Con la quota di una chiamata esaurita la versione resta in attesa senza consumare
  // tentativi, e la lettura prosegue con gli altri ordini.
  if (runFailure && !callLimit(error)) throw error;
}

/**
 * Dettaglio di una versione dell'ordine: rilegge l'ordine, le immagini mancanti (un errore
 * lascia la riga senza immagine) e il CF Fulfillment sul marketplace italiano Production.
 * Negli altri casi Trading resta il fallback. Un'assenza non rimuove dati già osservati.
 * false se il budget non basta: la versione resta in attesa.
 */
export async function readDetail(ctx: Context, pending: PendingDetail): Promise<boolean> {
  const retained = await ctx.db
    .prepare(`SELECT 1 FROM order_source_refs r
    JOIN orders o ON o.id = r.order_id
    WHERE r.store_id = ? AND r.source = 'fulfillment' AND r.external_order_id = ?
      AND o.retention_until > ?`)
    .bind(ctx.storeId, pending.external_order_id, deadlineCheckAt(ctx.at))
    .first();
  if (!retained) return true;
  const qualifiedMarketplace =
    ctx.access.configuration.apiOrigin === "https://api.ebay.com" &&
    pending.marketplace_id === "EBAY_IT";
  // Trading non trova gli ordini oltre i novanta giorni: per loro nessuna ricerca fiscale.
  const tradingReach =
    Date.parse(pending.creation_time) > Date.parse(ctx.at) - tradingReachDays * dayMilliseconds;
  if (!spend(ctx.budget, qualifiedMarketplace || !tradingReach ? 1 : 2)) return false;
  let observation: OrderObservation;
  try {
    const payload = await readFulfillmentOrder(
      ctx.access,
      pending.external_order_id,
      qualifiedMarketplace ? { marketplaceId: pending.marketplace_id! } : undefined,
    );
    observation = fulfillmentObservation(payload, ctx.at);
    if (
      observation.externalOrderId !== pending.external_order_id ||
      (qualifiedMarketplace && observation.marketplaceId !== pending.marketplace_id)
    )
      throw new UpstreamError("invalid_response");
    if (qualifiedMarketplace) {
      // Un campo fiscale malformato non impedisce il fallback sulla seconda fonte.
      let values: ReturnType<typeof fulfillmentTaxIdentifiers> | undefined;
      try {
        values = fulfillmentTaxIdentifiers(payload);
      } catch {}
      if (
        values?.length === 1 &&
        values[0]!.type === "CODICE_FISCALE" &&
        (values[0]!.issuingCountry === null || values[0]!.issuingCountry === "IT")
      )
        observation = {
          ...observation,
          taxIdentifiers: { source: "ebay_fulfillment", complete: false, values },
        };
    }
  } catch (error) {
    await failDetail(ctx, pending, error);
    return true;
  }
  // Un'inserzione con un'immagine già salvata non si rilegge. Con la quota `GetItem` esaurita le
  // righe restano senza immagine, come dopo un errore.
  const known = await knownImages(ctx, observation);
  const listings = (await callLimited(ctx, "GetItem"))
    ? []
    : [
        ...new Set(
          observation.items.flatMap((item) =>
            item.legacyItemId && !known.has(item.legacyItemId) ? [item.legacyItemId] : [],
          ),
        ),
      ].slice(0, maxImagesPerDetail);
  if (
    !spend(
      ctx.budget,
      listings.length +
        (qualifiedMarketplace && tradingReach && !observation.taxIdentifiers ? 1 : 0),
    )
  )
    return false;
  const images = new Map([
    ...known,
    ...(await Promise.all(
      listings.map(async (id) => {
        const image = await readItemImage(ctx.access, id).catch(async (error: unknown) => {
          // Un'immagine non disponibile non blocca l'ordine; credenziali e limite dell'origine
          // fermano le letture, la quota `GetItem` esaurita sospende soltanto le immagini.
          if (callLimit(error)) {
            await recordRateLimit(
              ctx.db,
              limitKey(ctx.access.configuration.apiOrigin, "GetItem"),
              error,
              new Date(ctx.at),
            );
            return null;
          }
          if (stopsReads(error)) throw error;
          return null;
        });
        return [id, image] as const;
      }),
    )),
  ]);
  observation = {
    ...observation,
    items: observation.items.map((item) => {
      const imageUrl = item.legacyItemId ? images.get(item.legacyItemId) : null;
      return imageUrl ? { ...item, imageUrl } : item;
    }),
  };
  const trading =
    observation.taxIdentifiers || !tradingReach
      ? null
      : (await callLimited(ctx, "GetOrders"))
        ? // Stryker disable next-line StringLiteral: il nome segnala soltanto un limite di quota; il valore non cambia l'esito.
          { error: new UpstreamError("rate_limited", { limit: "GetOrders" }) }
        : await readTradingTaxObservation(ctx.access, observation.externalOrderId).catch(
            async (error: unknown) => {
              if (callLimit(error))
                await recordRateLimit(
                  ctx.db,
                  limitKey(ctx.access.configuration.apiOrigin, "GetOrders"),
                  error,
                  new Date(ctx.at),
                );
              return { error };
            },
          );
  const result = await record(
    ctx,
    trading && "values" in trading
      ? {
          ...observation,
          buyerEiasToken: trading.buyerEiasToken,
          taxIdentifiers: {
            source: "ebay_trading_get_orders",
            complete: false,
            values: trading.values,
            availability: trading.orderFound ? "absent" : "not_included",
            lastModifiedTime: trading.lastModifiedTime,
          },
        }
      : observation,
  );
  if (trading && "error" in trading) {
    await failDetail(
      ctx,
      result.outcome === "stale"
        ? pending
        : {
            ...pending,
            last_modified_time: observation.lastModifiedTime,
            detail_attempts:
              pending.last_modified_time === observation.lastModifiedTime
                ? pending.detail_attempts
                : 0,
          },
      trading.error,
    );
  } else if (result.outcome === "stale") {
    // eBay ha restituito una versione più vecchia di quella già registrata: si riprova.
    await failDetail(ctx, pending, new UpstreamError("invalid_response"));
  } else {
    // Una versione più recente registrata nel frattempo resta da leggere.
    await ctx.db
      .prepare(
        `UPDATE order_source_refs SET detail_for = last_modified_time, detail_error = NULL,
                detail_attempts = 0, detail_retry_at = NULL
          WHERE store_id = ?1 AND source = 'fulfillment' AND external_order_id = ?3
            AND last_modified_time <= ?4 AND ${writableStore}`,
      )
      .bind(ctx.storeId, ctx.grantedAt, pending.external_order_id, observation.lastModifiedTime)
      .run();
  }
  return true;
}

/**
 * Versioni in attesa dalla più recente per data di modifica, quindi anche i cambiamenti di
 * ordini vecchi. Ogni dettaglio costa almeno una chiamata: una riga in più delle chiamate
 * rimaste basta a sapere se ne restano oltre il budget.
 */
export async function readDetails(ctx: Context): Promise<boolean> {
  const { results } = await ctx.db
    .prepare(
      `SELECT r.external_order_id, r.last_modified_time, r.detail_attempts, o.marketplace_id,
              o.creation_time
         FROM order_source_refs r JOIN orders o ON o.id = r.order_id
        WHERE r.store_id = ?1 AND r.source = 'fulfillment'
          AND r.detail_for IS NOT r.last_modified_time
          AND (r.detail_retry_at IS NULL OR r.detail_retry_at <= ?2)
          AND o.retention_until > ?2
        ORDER BY r.last_modified_time DESC LIMIT ?3`,
    )
    .bind(ctx.storeId, ctx.at, ctx.budget.calls + 1)
    .all<PendingDetail>();
  for (const pending of results) if (!(await readDetail(ctx, pending))) return false;
  return true;
}
