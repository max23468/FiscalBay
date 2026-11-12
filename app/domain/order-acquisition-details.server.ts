import { deadlineCheckAt, DuplicateLineIdentity } from "./order-import.server";
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
  urgentDays,
} from "./order-acquisition-context.server";
import { logFailure } from "../errors";
import { UpstreamError } from "../integrations/http.server";
import {
  fulfillmentObservation,
  fulfillmentTaxIdentifiers,
  readFulfillmentOrder,
} from "../integrations/ebay/fulfillment.server";
import { inSequence, untilStopped } from "../sequence";
import { dayMilliseconds } from "../time";
import {
  readItemImage,
  readTradingTaxObservations,
  tradingReachDays,
  tradingTaxBatch,
  type TradingTaxObservation,
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

/**
 * Registra gli ordini di una pagina Fulfillment, in sequenza: la riconciliazione delle righe
 * presuppone scritture serializzate per negozio. Un ordine non conforme, o con righe ripetute, si
 * salta e si segnala come in Trading: gli altri restano acquisibili e la lettura del negozio non
 * si ferma a ogni turno sullo stesso ordine.
 */
export async function recordFulfillmentOrders(ctx: Context, orders: readonly unknown[]) {
  let skipped = 0;
  await inSequence(orders, async (order) => {
    let observation: OrderObservation;
    try {
      observation = fulfillmentObservation(order, ctx.at);
    } catch {
      skipped += 1;
      return;
    }
    await record(ctx, observation).catch((error: unknown) => {
      if (!(error instanceof DuplicateLineIdentity)) throw error;
      skipped += 1;
    });
  });
  if (skipped > 0)
    logFailure({ error: new UpstreamError("invalid_response"), operation: "order_acquisition" });
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

/** Secondi di attesa ancora in corso per la quota di una chiamata Trading; 0 se nessuna. */
function callWait(ctx: Context, call: string | undefined) {
  const key = limitKey(ctx.access.configuration.apiOrigin, call);
  return rateLimitWait(ctx.db, key, new Date(ctx.at));
}

/** Attesa ancora in corso per la quota di una chiamata Trading. */
async function callLimited(ctx: Context, call: string) {
  return (await callWait(ctx, call)) > 0;
}

/** Quota `GetOrders` in attesa: per il dettaglio vale come il limite restituito da eBay. */
const ordersLimited = () =>
  new UpstreamError(
    // Stryker disable next-line StringLiteral: con il nome della chiamata il dettaglio registra soltanto l'attesa, non il codice.
    "rate_limited",
    { limit: "GetOrders" },
  );

export type PendingDetail = {
  external_order_id: string;
  last_modified_time: string;
  detail_attempts: number;
  marketplace_id: string | null;
  creation_time: string;
};

/**
 * Rimanda il dettaglio dopo un errore del singolo ordine o, all'ultimo tentativo, lo chiude. Con
 * la quota di una chiamata esaurita la versione non è in errore: resta da leggere e riparte alla
 * fine dell'attesa registrata, senza consumare tentativi né rileggere Fulfillment a ogni turno.
 */
async function failDetail(ctx: Context, pending: PendingDetail, error: unknown) {
  const code = error instanceof UpstreamError ? error.failure : "invalid_response";
  // Anche eBay non disponibile riguarda l'esecuzione, non il singolo ordine.
  const runFailure = stopsReads(error) || code === "unavailable";
  const attempts = pending.detail_attempts + 1;
  const delay = detailRetryMinutes[attempts - 1];
  const waiting = callLimit(error);
  const after = (milliseconds: number) => new Date(Date.parse(ctx.at) + milliseconds).toISOString();
  const retryAt = waiting
    ? after((await callWait(ctx, error.details.limit)) * 1000)
    : delay === undefined
      ? null
      : after(delay * 60_000);
  const scope = `WHERE store_id = ?1 AND source = 'fulfillment' AND external_order_id = ?3
                   AND last_modified_time = ?7
                   AND NOT EXISTS (SELECT 1 FROM order_tax_checks tc
                     WHERE tc.order_id = order_source_refs.order_id AND tc.observed_at > ?8)
                   AND EXISTS (SELECT 1 FROM orders o WHERE o.id = order_source_refs.order_id
                     AND o.retention_until > ?9)
                   AND ${writableStore}`;
  await ctx.db
    .prepare(
      waiting
        ? `UPDATE order_source_refs SET detail_error = NULL, detail_retry_at = ?6 ${scope}`
        : runFailure
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
      retryAt,
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
  // Con la quota di una chiamata esaurita la lettura prosegue con gli altri ordini.
  if (runFailure && !waiting) throw error;
}

/**
 * Lettura fiscale Trading già coperta per la versione: una risposta riuscita e autorevole di
 * Trading, ricevuta dopo la modifica della versione (anche dalla passata periodica, che porta gli
 * identificativi) oppure su un ordine già pagato, i cui identificativi non cambiano più senza
 * che la passata periodica lo riveda. Argomento: espressione della data di modifica della versione.
 */
const tradingCoveredSql = (modified: string) =>
  `tc.source = 'ebay_trading_get_orders' AND tc.verification = 'completed'
   AND tc.availability IN ('present', 'absent', 'removed')
   AND (tc.paid = 1 OR tc.observed_at >= ${modified})`;

async function tradingCovered(ctx: Context, pending: PendingDetail): Promise<boolean> {
  const row = await ctx.db
    .prepare(
      `SELECT 1 FROM order_source_refs r JOIN order_tax_checks tc ON tc.order_id = r.order_id
        WHERE r.store_id = ?1 AND r.source = 'fulfillment' AND r.external_order_id = ?2
          AND ${tradingCoveredSql("?3")}`,
    )
    .bind(ctx.storeId, pending.external_order_id, pending.last_modified_time)
    .first();
  return row !== null;
}

/** Versione letta da Fulfillment, in attesa della lettura fiscale Trading del lotto o della scrittura. */
type Prepared = {
  pending: PendingDetail;
  observation: OrderObservation;
  /** La lettura fiscale Trading entra nel lotto. */
  trading: boolean;
  /** Immagini o lettura fiscale non urgenti rimandate fino a questo istante. */
  deferredUntil: string | null;
};

type TradingResult = TradingTaxObservation | { error: unknown } | null;

/** Chiamata del lotto Trading già nel budget dell'esecuzione. */
type BatchState = { reserved: boolean };

const later = (first: string | null, second: string) =>
  // Stryker disable next-line EqualityOperator: a parità i due istanti coincidono.
  first === null || second > first ? second : first;

/**
 * Prima parte del dettaglio: rilegge l'ordine, le immagini mancanti (un errore lascia la riga
 * senza immagine) e il CF Fulfillment sul marketplace italiano Production, e decide se serve la
 * lettura fiscale Trading. Negli altri casi Trading resta il fallback. null se la versione è già
 * chiusa, `budget` se il budget non basta: la versione resta in attesa.
 */
async function prepareDetail(
  ctx: Context,
  pending: PendingDetail,
  batch: BatchState,
): Promise<Prepared | null | "budget"> {
  const retained = await ctx.db
    .prepare(`SELECT 1 FROM order_source_refs r
    JOIN orders o ON o.id = r.order_id
    WHERE r.store_id = ? AND r.source = 'fulfillment' AND r.external_order_id = ?
      AND o.retention_until > ?`)
    .bind(ctx.storeId, pending.external_order_id, deadlineCheckAt(ctx.at))
    .first();
  if (!retained) return null;
  const qualifiedMarketplace =
    ctx.access.configuration.apiOrigin === "https://api.ebay.com" &&
    pending.marketplace_id === "EBAY_IT";
  // Trading non trova gli ordini oltre i novanta giorni: per loro nessuna ricerca fiscale, come
  // per una versione la cui lettura Trading è già coperta.
  const fallback =
    Date.parse(pending.creation_time) > Date.parse(ctx.at) - tradingReachDays * dayMilliseconds &&
    !(await tradingCovered(ctx, pending));
  // Le letture di un ordine corrente non aspettano; le altre restano entro il budget del giorno.
  const urgent =
    Date.parse(pending.creation_time) > Date.parse(ctx.at) - urgentDays * dayMilliseconds;
  let deferredUntil: string | null = null;
  /** Lettura fiscale Trading per la versione: rimandata oltre il budget del lavoro non urgente. */
  const needsTrading = () => {
    if (urgent || ctx.quota.background("GetOrders")) return true;
    deferredUntil = later(deferredUntil, ctx.quota.reopenAt("GetOrders"));
    return false;
  };
  let trading = fallback && !qualifiedMarketplace && needsTrading();
  // La lettura fiscale Trading è già certa e la sua quota è in attesa: la versione aspetta senza
  // spendere la lettura Fulfillment e le immagini, che andrebbero ripetute.
  if (trading && (await callLimited(ctx, "GetOrders"))) {
    await failDetail(ctx, pending, ordersLimited());
    return null;
  }
  const reserve = (calls: number) => {
    const extra = trading && !batch.reserved ? 1 : 0;
    if (!spend(ctx.budget, calls + extra)) return false;
    if (extra) {
      // La chiamata del lotto conta subito nel budget del giorno: le letture che seguono la vedono.
      batch.reserved = true;
      ctx.quota.spent("GetOrders");
    }
    return true;
  };
  if (!reserve(1)) return "budget";
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
    return null;
  }
  if (qualifiedMarketplace && fallback && !observation.taxIdentifiers) trading = needsTrading();
  // Un'inserzione con un'immagine già salvata non si rilegge. Con la quota `GetItem` esaurita le
  // righe restano senza immagine, come dopo un errore.
  const known = await knownImages(ctx, observation);
  let listings = (await callLimited(ctx, "GetItem"))
    ? []
    : [
        ...new Set(
          observation.items.flatMap((item) =>
            item.legacyItemId && !known.has(item.legacyItemId) ? [item.legacyItemId] : [],
          ),
        ),
      ].slice(0, maxImagesPerDetail);
  if (listings.length && !urgent && !ctx.quota.background("GetItem", listings.length)) {
    deferredUntil = later(deferredUntil, ctx.quota.reopenAt("GetItem"));
    listings = [];
  }
  if (!reserve(listings.length)) return "budget";
  ctx.quota.spent("GetItem", listings.length);
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
  return { pending, observation, trading, deferredUntil };
}

/** Seconda parte del dettaglio: scrive la versione con l'eventuale lettura fiscale Trading. */
async function finishDetail(ctx: Context, prepared: Prepared, trading: TradingResult) {
  const { pending, observation } = prepared;
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
  } else if (prepared.deferredUntil) {
    // Lavoro non urgente oltre il budget del giorno: la versione resta da leggere e riparte
    // all'azzeramento della quota, senza consumare tentativi.
    await ctx.db
      .prepare(
        `UPDATE order_source_refs SET detail_error = NULL, detail_retry_at = ?5
          WHERE store_id = ?1 AND source = 'fulfillment' AND external_order_id = ?3
            AND last_modified_time <= ?4 AND detail_for IS NOT last_modified_time
            AND ${writableStore}`,
      )
      .bind(
        ctx.storeId,
        ctx.grantedAt,
        pending.external_order_id,
        observation.lastModifiedTime,
        prepared.deferredUntil,
      )
      .run();
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
}

/**
 * Letture fiscali Trading del lotto con una sola chiamata `GetOrders`; un errore della chiamata
 * vale per ogni ordine del lotto, quello di un ordine soltanto per lui.
 */
async function finishBatch(ctx: Context, batch: Prepared[]) {
  const ids = batch.map((prepared) => prepared.observation.externalOrderId);
  let results: Map<string, TradingTaxObservation | UpstreamError> | null = null;
  let failure: unknown = null;
  if (await callLimited(ctx, "GetOrders")) failure = ordersLimited();
  else {
    results = await readTradingTaxObservations(ctx.access, ids).catch(async (error: unknown) => {
      if (callLimit(error))
        await recordRateLimit(
          ctx.db,
          limitKey(ctx.access.configuration.apiOrigin, "GetOrders"),
          error,
          new Date(ctx.at),
        );
      failure = error;
      return null;
    });
  }
  // In sequenza: la riconciliazione delle righe presuppone scritture serializzate per negozio. Una
  // risposta riuscita ha una voce per ogni ordine richiesto.
  await inSequence(batch, (prepared) => {
    const result = results?.get(prepared.observation.externalOrderId);
    return finishDetail(
      ctx,
      prepared,
      !results ? { error: failure } : result instanceof UpstreamError ? { error: result } : result!,
    );
  });
}

/**
 * Dettaglio delle versioni indicate, nell'ordine dato. Le letture fiscali Trading si raccolgono
 * in lotti da `tradingTaxBatch` ordini con una chiamata ciascuno. false se il budget non basta:
 * le versioni non lette restano in attesa.
 */
async function processDetails(ctx: Context, pendings: PendingDetail[]): Promise<boolean> {
  const batch: Prepared[] = [];
  // Stryker disable next-line ObjectLiteral: senza la proprietà vale undefined, falso come false.
  const state: BatchState = { reserved: false };
  const stopped = await untilStopped(pendings, async (pending) => {
    const prepared = await prepareDetail(ctx, pending, state);
    if (prepared === "budget") return "budget";
    if (!prepared) return "continue";
    if (!prepared.trading) {
      await finishDetail(ctx, prepared, null);
      return "continue";
    }
    batch.push(prepared);
    if (batch.length === tradingTaxBatch) {
      await finishBatch(ctx, batch.splice(0));
      state.reserved = false;
    }
    return "continue";
  });
  // Stryker disable next-line ConditionalExpression: un lotto vuoto non chiama eBay e non scrive nulla.
  if (batch.length) await finishBatch(ctx, batch);
  return stopped !== "budget";
}

/** Dettaglio di una sola versione, come per l'evento di un ordine confermato. */
export function readDetail(ctx: Context, pending: PendingDetail): Promise<boolean> {
  return processDetails(ctx, [pending]);
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
  return processDetails(ctx, results);
}
