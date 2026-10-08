import {
  recordOrderObservation,
  writableStore,
  type OrderObservation,
} from "./order-import.server";
import { logFailure } from "../errors";
import { UpstreamError } from "../integrations/http.server";
import {
  ebayConfiguration,
  type EbayAccess,
  type EbayEnvironment,
} from "../integrations/ebay/environment.server";
import {
  buildCreationDateFilter,
  buildLastModifiedFilter,
  fulfillmentObservation,
  readFulfillmentOrder,
  readFulfillmentOrders,
} from "../integrations/ebay/fulfillment.server";
import { readItemImage, readTradingTaxIdentifiers } from "../integrations/ebay/trading.server";
import { openToken } from "../integrations/ebay/seller-credentials.server";

/**
 * Acquisizione degli ordini di un negozio, condivisa da collegamento e lavoro periodico:
 *
 * 1. recenti: ordini modificati dopo l'ultimo limite applicato, con una sovrapposizione;
 * 2. storico: ordini creati nella finestra fissata al primo avvio, dal più recente;
 * 3. dettaglio: dati fiscali Trading e immagini di ogni versione Fulfillment non ancora letta.
 *
 * Ogni pagina si applica prima di salvarne il link `next`, e il limite dei recenti avanza
 * solo a passata conclusa: un'interruzione riprende dall'ultima pagina applicata e la rilegge
 * senza duplicati. Se il totale di eBay cambia durante una passata, l'insieme si è spostato
 * sotto la paginazione e la passata ricomincia, invece di saltare un ordine. I recenti
 * precedono sempre lo storico, che non ne ritarda l'acquisizione; il dettaglio è un passo
 * separato che un errore non estende all'ordine.
 */

const pageSize = 25;
const overlapMilliseconds = 15 * 60_000;
/** Finestra dello storico del piano Free. */
export const historyDays = 30;
const dayMilliseconds = 86_400_000;
const lockMilliseconds = 15 * 60_000;
// Immagini lette per versione: sempre entro la quota di un negozio, così nessun ordine resta
// in attesa per sempre. Le inserzioni oltre il limite restano senza immagine.
const maxImagesPerDetail = 8;
// Attese dopo il primo, secondo, terzo e quarto errore del dettaglio; il quinto chiude la versione.
const detailRetryMinutes = [15, 60, 240, 960];

/** Chiamate a eBay e pagine di elenco ancora consentite; scalate durante l'esecuzione. */
export type AcquisitionBudget = { calls: number; pages: number };

export type AcquisitionResult =
  /** Recenti e storico applicati, nessun dettaglio leggibile in attesa. */
  | "complete"
  /** Lavoro rimasto per la prossima esecuzione. */
  | "budget"
  /** Un'altra esecuzione sta lavorando sullo stesso negozio. */
  | "busy"
  /** Consenso cambiato, negozio in pausa o scollegato: nessuna scrittura. */
  | "not_writable";

/** Il consenso con cui è partita l'esecuzione non vale più: si ferma senza scrivere. */
class NotWritable extends Error {}

type Context = {
  db: D1Database;
  storeId: string;
  grantedAt: string;
  access: EbayAccess;
  at: string;
  budget: AcquisitionBudget;
};

function spend(budget: AcquisitionBudget, calls: number, pages = 0): boolean {
  if (budget.calls < calls || budget.pages < pages) return false;
  budget.calls -= calls;
  budget.pages -= pages;
  return true;
}

/** Scrittura dello stato del negozio, valida solo per il consenso con cui è partita. */
async function saveState(ctx: Context, assignments: string, ...values: unknown[]) {
  const result = await ctx.db
    .prepare(
      `UPDATE sync_state SET ${assignments}, updated_at = ?3
        WHERE store_id = ?1 AND ${writableStore}`,
    )
    .bind(ctx.storeId, ctx.grantedAt, ctx.at, ...values)
    .run();
  if (result.meta.changes === 0) throw new NotWritable();
}

async function record(ctx: Context, observation: OrderObservation) {
  const result = await recordOrderObservation(
    ctx.db,
    { storeId: ctx.storeId, consentGrantedAt: ctx.grantedAt, observedAt: ctx.at },
    observation,
  );
  if (result.outcome === "not_writable") throw new NotWritable();
  return result;
}

type Pass = {
  next: string | null;
  total: number | null;
  /** Filtro di una nuova passata. */
  begin: () => string;
  progress: (next: string, total: number) => Promise<void>;
  finish: () => Promise<void>;
};

/**
 * Legge le pagine di una passata. Una ripartenza non si salva: se l'esecuzione si interrompe
 * prima della pagina successiva, la ripresa dal link precedente rivede il totale cambiato e
 * ricomincia comunque.
 */
async function runPass(ctx: Context, pass: Pass): Promise<boolean> {
  let { next, total } = pass;
  while (spend(ctx.budget, 1, 1)) {
    const page = await readFulfillmentOrders(
      ctx.access,
      next ? { next } : { limit: pageSize, filter: pass.begin() },
    );
    // In sequenza: la riconciliazione delle righe presuppone scritture serializzate per negozio.
    await page.orders.reduce<Promise<unknown>>(
      (previous, order) => previous.then(() => record(ctx, fulfillmentObservation(order, ctx.at))),
      Promise.resolve(),
    );
    if (next !== null && page.total !== total) {
      next = null;
    } else if (page.next) {
      next = page.next;
      total = page.total;
      await pass.progress(next, total);
    } else {
      await pass.finish();
      return true;
    }
  }
  return false;
}

type SyncRow = {
  cursor: string;
  recent_end: string | null;
  recent_next: string | null;
  recent_total: number | null;
  history_from: string;
  history_until: string;
  history_next: string | null;
  history_total: number | null;
  history_done_at: string | null;
};

function recentPass(ctx: Context, state: SyncRow): Pass {
  let end = state.recent_end;
  return {
    next: state.recent_next,
    total: state.recent_total,
    begin: () => {
      end = ctx.at;
      // Un orologio indietro rispetto al limite già applicato non produce un intervallo vuoto.
      const [checkpoint] = [state.cursor, end].sort();
      return buildLastModifiedFilter(new Date(checkpoint!), new Date(end), overlapMilliseconds);
    },
    progress: (next, total) =>
      saveState(ctx, "recent_end = ?4, recent_next = ?5, recent_total = ?6", end, next, total),
    // Il limite non torna indietro se un'esecuzione più lenta conclude una passata precedente.
    finish: () =>
      saveState(
        ctx,
        "cursor = MAX(cursor, ?4), recent_end = NULL, recent_next = NULL, recent_total = NULL",
        end,
      ),
  };
}

function historyPass(ctx: Context, state: SyncRow): Pass {
  return {
    next: state.history_next,
    total: state.history_total,
    begin: () => buildCreationDateFilter(state.history_from, state.history_until),
    progress: (next, total) => saveState(ctx, "history_next = ?4, history_total = ?5", next, total),
    finish: () => saveState(ctx, "history_done_at = ?3, history_next = NULL, history_total = NULL"),
  };
}

/** Articoli con un ID d'inserzione che nel negozio non hanno ancora un'immagine. */
async function listingsWithoutImage(
  ctx: Context,
  observation: OrderObservation,
): Promise<Set<string>> {
  const { results: known } = await ctx.db
    .prepare(
      `SELECT i.stable_key FROM order_items i JOIN orders o ON o.id = i.order_id
        WHERE o.store_id = ?1 AND i.image_url IS NOT NULL
          AND i.stable_key IN (SELECT value FROM json_each(?2))`,
    )
    .bind(ctx.storeId, JSON.stringify(observation.items.map((item) => item.stableKey)))
    .all<{ stable_key: string }>();
  const skip = new Set(known.map((row) => row.stable_key));
  return new Set(
    observation.items.flatMap((item) =>
      item.legacyItemId && !(item.stableKey && skip.has(item.stableKey)) ? [item.legacyItemId] : [],
    ),
  );
}

/** Errori che riguardano eBay o il consenso, non il singolo ordine: fermano l'esecuzione. */
const runFailures = new Set(["credentials", "rate_limited", "unavailable"]);

type PendingDetail = { external_order_id: string; detail_attempts: number };

/** Rimanda il dettaglio dopo un errore del singolo ordine o, all'ultimo tentativo, lo chiude. */
async function failDetail(ctx: Context, pending: PendingDetail, error: unknown) {
  if (error instanceof UpstreamError && runFailures.has(error.failure)) throw error;
  const attempts = pending.detail_attempts + 1;
  const delay = detailRetryMinutes[attempts - 1];
  const code = error instanceof UpstreamError ? error.failure : "invalid_response";
  const scope = `WHERE store_id = ?1 AND source = 'fulfillment' AND external_order_id = ?3
                   AND ${writableStore}`;
  const result = await ctx.db
    .prepare(
      delay === undefined
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
      ...(delay === undefined
        ? []
        : [attempts, new Date(Date.parse(ctx.at) + delay * 60_000).toISOString()]),
    )
    .run();
  if (result.meta.changes === 0) throw new NotWritable();
}

/**
 * Dettaglio di una versione dell'ordine: rilegge l'ordine, le immagini mancanti (un errore
 * lascia la riga senza immagine) e gli identificativi fiscali Trading. Senza Trading l'ordine
 * si salva comunque, senza dati fiscali; l'assenza del campo in Trading non è ancora qualificata
 * come rimozione autorevole. false se il budget non basta: la versione resta in attesa.
 */
async function readDetail(ctx: Context, pending: PendingDetail): Promise<boolean> {
  if (!spend(ctx.budget, 2)) return false;
  let observation: OrderObservation;
  try {
    observation = fulfillmentObservation(
      await readFulfillmentOrder(ctx.access, pending.external_order_id),
      ctx.at,
    );
  } catch (error) {
    await failDetail(ctx, pending, error);
    return true;
  }
  const listings = [...(await listingsWithoutImage(ctx, observation))].slice(0, maxImagesPerDetail);
  if (!spend(ctx.budget, listings.length)) return false;
  const images = new Map(
    await Promise.all(
      listings.map(
        async (id) =>
          // Stryker disable next-line ArrowFunction: null e undefined lasciano la riga senza immagine.
          [id, await readItemImage(ctx.access, id).catch(() => null)] as const,
      ),
    ),
  );
  observation = {
    ...observation,
    items: observation.items.map((item) => {
      const imageUrl = item.legacyItemId ? images.get(item.legacyItemId) : null;
      return imageUrl ? { ...item, imageUrl } : item;
    }),
  };
  const trading = await readTradingTaxIdentifiers(ctx.access, observation.externalOrderId)
    .then((values) => ({ values }))
    .catch((error: unknown) => ({ error }));
  const result = await record(
    ctx,
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
  if ("error" in trading) {
    await failDetail(ctx, pending, trading.error);
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
 * ordini vecchi. Ogni dettaglio costa almeno due chiamate: una riga in più delle chiamate
 * rimaste basta a sapere se ne restano oltre il budget.
 */
async function readDetails(ctx: Context): Promise<boolean> {
  const { results } = await ctx.db
    .prepare(
      `SELECT external_order_id, detail_attempts FROM order_source_refs
        WHERE store_id = ?1 AND source = 'fulfillment'
          AND detail_for IS NOT last_modified_time
          AND (detail_retry_at IS NULL OR detail_retry_at <= ?2)
        ORDER BY last_modified_time DESC LIMIT ?3`,
    )
    .bind(ctx.storeId, ctx.at, ctx.budget.calls + 1)
    .all<PendingDetail>();
  for (const pending of results) if (!(await readDetail(ctx, pending))) return false;
  return true;
}

/**
 * Esegue l'acquisizione di un negozio entro il budget. Le esecuzioni dello stesso negozio non
 * si sovrappongono: chi trova il negozio occupato rinuncia. Al primo avvio fissa il limite dei
 * recenti all'istante corrente e lo storico ai `historyDays` giorni precedenti. Lo storico
 * attende i recenti; il dettaglio usa anche le chiamate rimaste quando le pagine finiscono.
 */
export async function acquireOrders(input: {
  db: D1Database;
  storeId: string;
  grantedAt: string;
  access: EbayAccess;
  now: Date;
  budget: AcquisitionBudget;
}): Promise<AcquisitionResult> {
  const { db, storeId, grantedAt, now } = input;
  const at = now.toISOString();
  const lock = new Date(now.getTime() + lockMilliseconds).toISOString();
  const state = await db
    .prepare(
      `INSERT INTO sync_state (store_id, cursor, history_from, history_until, locked_until, updated_at)
       SELECT ?1, ?3, ?4, ?3, ?5, ?3 WHERE ${writableStore}
       ON CONFLICT(store_id) DO UPDATE SET
         cursor = COALESCE(sync_state.cursor, excluded.cursor),
         history_from = COALESCE(sync_state.history_from, excluded.history_from),
         history_until = COALESCE(sync_state.history_until, excluded.history_until),
         locked_until = excluded.locked_until,
         updated_at = excluded.updated_at
       WHERE sync_state.locked_until IS NULL OR sync_state.locked_until <= ?3
       RETURNING cursor, recent_end, recent_next, recent_total, history_from, history_until,
                 history_next, history_total, history_done_at`,
    )
    .bind(
      storeId,
      grantedAt,
      at,
      new Date(now.getTime() - historyDays * dayMilliseconds).toISOString(),
      lock,
    )
    .first<SyncRow>();
  if (!state) {
    const writable = await db
      .prepare(`SELECT 1 AS ok WHERE ${writableStore}`)
      .bind(storeId, grantedAt)
      .first();
    return writable ? "busy" : "not_writable";
  }

  const ctx: Context = { ...input, at };
  try {
    const recent = await runPass(ctx, recentPass(ctx, state));
    // Lettura dei recenti conclusa: l'ultima sincronizzazione del negozio.
    if (recent) await saveState(ctx, "last_success_at = ?3");
    const history =
      recent && (!!state.history_done_at || (await runPass(ctx, historyPass(ctx, state))));
    const details = await readDetails(ctx);
    return history && details ? "complete" : "budget";
  } catch (error) {
    if (error instanceof NotWritable) return "not_writable";
    throw error;
  } finally {
    await db
      .prepare("UPDATE sync_state SET locked_until = NULL WHERE store_id = ? AND locked_until = ?")
      .bind(storeId, lock)
      .run();
  }
}

/** Negozi letti da un'esecuzione periodica e budget di ciascuno. */
const storesPerRun = 3;
const storeBudget: AcquisitionBudget = { calls: 12, pages: 3 };
const tokenMarginMilliseconds = 5 * 60_000;

type ActiveStore = {
  store_id: string;
  access_token: string;
  granted_at: string;
  ebay_environment: EbayEnvironment;
};

/**
 * Lavoro periodico: acquisisce gli ordini dei negozi attivi con un token valido, dal negozio
 * aggiornato meno di recente. Un errore di un negozio non ferma gli altri.
 */
export async function acquireStoresOrders(
  environment: Env,
  fetcher: typeof fetch,
  now = new Date(),
): Promise<void> {
  const { results } = await environment.DB.prepare(
    `SELECT c.store_id, c.access_token, c.granted_at, s.ebay_environment
       FROM ebay_store_credentials c
       JOIN ebay_stores s ON s.id = c.store_id
       LEFT JOIN sync_state ss ON ss.store_id = c.store_id
      WHERE c.rejected_at IS NULL AND c.access_expires_at > ?1 AND s.disconnected_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM ebay_store_pauses p WHERE p.store_id = c.store_id)
      ORDER BY ss.updated_at IS NOT NULL, ss.updated_at, c.store_id
      LIMIT ?2`,
  )
    .bind(new Date(now.getTime() + tokenMarginMilliseconds).toISOString(), storesPerRun)
    .all<ActiveStore>();
  for (const store of results) {
    try {
      await acquireOrders({
        db: environment.DB,
        storeId: store.store_id,
        grantedAt: store.granted_at,
        access: {
          fetcher,
          configuration: ebayConfiguration(environment, store.ebay_environment),
          accessToken: await openToken(
            environment.BETTER_AUTH_SECRET,
            store.store_id,
            "access",
            store.access_token,
          ),
        },
        now,
        budget: { ...storeBudget },
      });
    } catch (error) {
      logFailure({ error, operation: "order_acquisition" });
    }
  }
}
