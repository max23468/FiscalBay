import { DuplicateLineIdentity } from "./order-import.server";
import { activeStore, writableStore } from "./store-state.server";
import {
  limitKey,
  rateLimitWait,
  record,
  recordRateLimit,
  spend,
  NotWritable,
  type AcquisitionBudget,
  type Context,
} from "./order-acquisition-context.server";
import { readDetail, readDetails, stopsReads } from "./order-acquisition-details.server";
import { refreshStoreProfile } from "./store-profile.server";
import { logFailure } from "../errors";
import { dayMilliseconds } from "../time";
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
import { openToken, rejectCredentials } from "../integrations/ebay/seller-credentials.server";
import { readTradingOrders } from "../integrations/ebay/trading.server";

/**
 * Acquisizione degli ordini di un negozio, condivisa da collegamento e lavoro periodico:
 *
 * 1. recenti: ordini modificati dopo l'ultimo limite applicato, con una sovrapposizione;
 * 2. Trading: acquisti modificati, compresi quelli prima del checkout che Fulfillment non
 *    espone, con pagina e limite propri, al massimo ogni due ore salvo collegamento e richieste
 *    manuali; un suo errore, anche il limite della sua quota, non ferma i passi successivi;
 * 3. storico: ordini creati nella finestra fissata al primo avvio, dal più recente;
 * 4. dettaglio: dati fiscali e immagini di ogni versione Fulfillment non ancora letta,
 *    in `order-acquisition-details.server.ts`.
 *
 * Dopo i recenti, al massimo una volta a settimana, si rileggono nome e logo del negozio eBay.
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

/** Inizio della finestra dello storico per un'importazione che parte all'istante indicato. */
export function historyStart(now: Date): string {
  return new Date(now.getTime() - historyDays * dayMilliseconds).toISOString();
}
/**
 * Durata massima di una lettura: le sue scritture portano l'istante d'inizio, quindi arrivano in
 * D1 fino a questo tempo dopo l'istante registrato.
 */
export const lockMilliseconds = 15 * 60_000;
// Acquisti prima del pagamento e ordini combinati cambiano di rado: la lettura Trading periodica
// ogni due ore tiene la quota `GetOrders` del keyset lontana dal limite anche con molti negozi.
const tradingIntervalMilliseconds = 2 * 60 * 60_000;
/** Letture dei recenti conservate per negozio nella schermata Negozi. */
const keptRuns = 3;

export type AcquisitionResult =
  /** Recenti e storico applicati, nessun dettaglio leggibile in attesa. */
  | "complete"
  /** Lavoro rimasto per la prossima esecuzione. */
  | "budget"
  /** Un'altra esecuzione sta lavorando sullo stesso negozio. */
  | "busy"
  /** Consenso cambiato, negozio in pausa o scollegato: nessuna scrittura. */
  | "not_writable";

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
  trading_cursor: string | null;
  trading_end: string | null;
  trading_page: number | null;
  trading_total: number | null;
  requested_at: string | null;
};

/** Chiave dell'attesa della quota `GetOrders`, distinta da quella di Fulfillment. */
function ordersLimit(ctx: Context) {
  return limitKey(ctx.access.configuration.apiOrigin, "GetOrders");
}

async function runTradingPass(ctx: Context, state: SyncRow): Promise<boolean> {
  const until = state.trading_end ?? ctx.at;
  // Una passata già iniziata prosegue; altrimenti si rilegge al collegamento, su richiesta
  // manuale o quando l'ultima passata conclusa ha due ore.
  if (
    !state.trading_end &&
    state.trading_cursor &&
    state.requested_at === null &&
    Date.parse(state.trading_cursor) > Date.parse(ctx.at) - tradingIntervalMilliseconds
  )
    return true;
  if ((await rateLimitWait(ctx.db, ordersLimit(ctx), new Date(ctx.at))) > 0) return false;
  // Trading accetta al massimo trenta giorni per intervallo di modifica.
  const from = new Date(
    Math.max(
      Date.parse(until) - historyDays * dayMilliseconds,
      Date.parse(state.trading_cursor ?? state.history_from) - overlapMilliseconds,
    ),
  ).toISOString();
  let page = state.trading_page ?? 1;
  let total = state.trading_total;
  while (spend(ctx.budget, 1, 1)) {
    const result = await readTradingOrders(ctx.access, { from, until, page });
    let skipped = result.skipped;
    await result.orders.reduce<Promise<unknown>>(
      (previous, observation) =>
        previous.then(() =>
          record(ctx, observation).catch((error: unknown) => {
            // Righe ripetute nello stesso acquisto: si salta l'ordine, non la pagina.
            if (!(error instanceof DuplicateLineIdentity)) throw error;
            skipped += 1;
          }),
        ),
      Promise.resolve(),
    );
    if (skipped > 0)
      logFailure({ error: new UpstreamError("invalid_response"), operation: "order_acquisition" });
    if (page > 1 && result.total !== total) {
      page = 1;
    } else if (result.more) {
      page += 1;
    } else {
      await saveState(
        ctx,
        "trading_cursor = ?4, trading_end = NULL, trading_page = NULL, trading_total = NULL",
        until,
      );
      return true;
    }
    total = result.total;
    await saveState(
      ctx,
      "trading_end = ?4, trading_page = ?5, trading_total = ?6",
      until,
      page,
      total,
    );
  }
  return false;
}

async function tradingFailure(ctx: Context, error: unknown): Promise<false> {
  if (!(error instanceof UpstreamError)) throw error;
  // La quota `GetOrders` esaurita sospende soltanto Trading: Fulfillment continua.
  if (error.details.limit !== undefined)
    await recordRateLimit(ctx.db, ordersLimit(ctx), error, new Date(ctx.at));
  else if (stopsReads(error)) throw error;
  logFailure({ error, operation: "order_acquisition" });
  return false;
}

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

/**
 * Chiude una lettura dei recenti: ne conserva esito e ordini nuovi fra le ultime del negozio e,
 * salvo un limite di eBay, considera servite le richieste manuali arrivate prima del suo inizio.
 */
async function recordPoll(ctx: Context, ok: boolean, served: boolean) {
  await ctx.db.batch([
    ctx.db
      .prepare(
        `INSERT INTO sync_runs (store_id, started_at, ok, new_orders)
         SELECT ?1, ?3, ?4, ?5 WHERE EXISTS (SELECT 1 FROM ebay_store_credentials
                                              WHERE store_id = ?1 AND granted_at = ?2)`,
      )
      .bind(ctx.storeId, ctx.grantedAt, ctx.at, ok ? 1 : 0, ctx.created),
    ctx.db
      .prepare(
        `DELETE FROM sync_runs WHERE store_id = ?1 AND id NOT IN (
           SELECT id FROM sync_runs WHERE store_id = ?1 ORDER BY started_at DESC, id DESC LIMIT ?2)`,
      )
      .bind(ctx.storeId, keptRuns),
    ...(served
      ? [
          ctx.db
            .prepare(
              "UPDATE sync_state SET requested_at = NULL WHERE store_id = ? AND requested_at <= ?",
            )
            .bind(ctx.storeId, ctx.at),
        ]
      : []),
  ]);
}

/**
 * Esegue l'acquisizione di un negozio entro il budget. Le esecuzioni dello stesso negozio non
 * si sovrappongono: chi trova il negozio occupato rinuncia. Al primo avvio fissa il limite dei
 * recenti all'istante corrente e lo storico ai `historyDays` giorni precedenti. Lo storico
 * attende i recenti; il dettaglio usa anche le chiamate rimaste quando le pagine finiscono.
 *
 * Mentre eBay chiede di attendere non parte nessuna chiamata, e un nuovo limite vale per tutti
 * i negozi della stessa origine API. Una lettura dei recenti (tutto tranne un evento) segna il
 * turno del negozio e resta fra le ultime letture, anche quando fallisce.
 */
export async function acquireOrders(input: {
  db: D1Database;
  storeId: string;
  grantedAt: string;
  access: EbayAccess;
  now: Date;
  budget: AcquisitionBudget;
  /** Evento verificato: rilegge soltanto l'ordine indicato, senza avanzare il polling. */
  confirmedOrderId?: string;
}): Promise<AcquisitionResult> {
  const { db, storeId, grantedAt, now } = input;
  const at = now.toISOString();
  const apiOrigin = input.access.configuration.apiOrigin;
  const wait = await rateLimitWait(db, apiOrigin, now);
  if (wait > 0) throw new UpstreamError("rate_limited", { retryAfter: wait });
  const poll = !input.confirmedOrderId;
  const lock = new Date(now.getTime() + lockMilliseconds).toISOString();
  const state = await db
    .prepare(
      `INSERT INTO sync_state
         (store_id, cursor, history_from, history_until, locked_until, polled_at, updated_at)
       SELECT ?1, ?3, ?4, ?3, ?5, ?6, ?3 WHERE ${writableStore}
       ON CONFLICT(store_id) DO UPDATE SET
         cursor = COALESCE(sync_state.cursor, excluded.cursor),
         history_from = COALESCE(sync_state.history_from, excluded.history_from),
         history_until = COALESCE(sync_state.history_until, excluded.history_until),
         locked_until = excluded.locked_until,
         polled_at = COALESCE(excluded.polled_at, sync_state.polled_at),
         updated_at = excluded.updated_at
       WHERE sync_state.locked_until IS NULL OR sync_state.locked_until <= ?3
       RETURNING cursor, recent_end, recent_next, recent_total, history_from, history_until,
                 history_next, history_total, history_done_at,
                 trading_cursor, trading_end, trading_page, trading_total, requested_at`,
    )
    .bind(storeId, grantedAt, at, historyStart(now), lock, poll ? at : null)
    .first<SyncRow>();
  if (!state) {
    const writable = await db
      .prepare(`SELECT 1 AS ok WHERE ${writableStore}`)
      .bind(storeId, grantedAt)
      .first();
    return writable ? "busy" : "not_writable";
  }

  const ctx: Context = { ...input, at, created: 0 };
  // Esito della lettura dei recenti da registrare; null per un evento o un consenso cambiato.
  let outcome: { ok: boolean; served: boolean } | null = null;
  try {
    if (input.confirmedOrderId) {
      if (!spend(ctx.budget, 1)) return "budget";
      const payload = await readFulfillmentOrder(ctx.access, input.confirmedOrderId);
      const observation = fulfillmentObservation(payload, at);
      if (observation.externalOrderId !== input.confirmedOrderId)
        throw new UpstreamError("invalid_response");
      await record(ctx, observation);
      return (await readDetail(ctx, {
        external_order_id: observation.externalOrderId,
        last_modified_time: observation.lastModifiedTime,
        detail_attempts: 0,
        marketplace_id: observation.marketplaceId ?? null,
      }))
        ? "complete"
        : "budget";
    }
    const recent = await runPass(ctx, recentPass(ctx, state));
    // Lettura dei recenti conclusa: l'ultima sincronizzazione del negozio.
    if (recent) await saveState(ctx, "last_success_at = ?3");
    if (recent) await refreshStoreProfile(ctx);
    // Trading aggiunge gli acquisti prima del checkout: un suo errore lascia la passata da
    // riprendere senza fermare storico e dettaglio. Le credenziali fermano tutto; la quota
    // Trading esaurita sospende soltanto Trading.
    const trading =
      recent &&
      (await runTradingPass(ctx, state).catch((error: unknown) => tradingFailure(ctx, error)));
    const history =
      recent && (!!state.history_done_at || (await runPass(ctx, historyPass(ctx, state))));
    const details = await readDetails(ctx);
    outcome = { ok: true, served: true };
    return trading && history && details ? "complete" : "budget";
  } catch (error) {
    if (error instanceof NotWritable) return "not_writable";
    const limited = error instanceof UpstreamError && error.failure === "rate_limited";
    if (limited) await recordRateLimit(db, limitKey(apiOrigin, error.details.limit), error, now);
    if (poll) outcome = { ok: false, served: !limited };
    throw error;
  } finally {
    await db
      .prepare("UPDATE sync_state SET locked_until = NULL WHERE store_id = ? AND locked_until = ?")
      .bind(storeId, lock)
      .run();
    if (outcome) await recordPoll(ctx, outcome.ok, outcome.served);
  }
}

export type ActiveStore = {
  store_id: string;
  access_token: string;
  granted_at: string;
  ebay_environment: EbayEnvironment;
};

/**
 * Accesso seller di un negozio attivo, con il token di accesso decifrato. Un token che non si
 * apre più chiude il consenso, come un rifiuto di eBay: il negozio va ricollegato e il lavoro
 * periodico non lo ritenta a ogni turno.
 */
export async function storeAccess(
  environment: Env,
  store: ActiveStore,
  fetcher: typeof fetch,
  now: Date,
): Promise<EbayAccess> {
  const configuration = ebayConfiguration(environment, store.ebay_environment);
  try {
    return {
      fetcher,
      configuration,
      accessToken: await openToken(
        environment.BETTER_AUTH_SECRET,
        store.store_id,
        "access",
        store.access_token,
      ),
    };
  } catch {
    await rejectCredentials(environment.DB, store.store_id, store.granted_at, now);
    throw new UpstreamError("credentials");
  }
}

/**
 * Rilegge consenso, pausa e token prima di eseguire un evento già accettato. L'evento non
 * dipende dal piano e non aspetta la cadenza della lettura periodica.
 */
export async function consumeOrderConfirmation(
  environment: Env,
  event: {
    storeId: string;
    grantedAt: string;
    environment: string;
    orderId: string;
    eventAt: string;
  },
  fetcher: typeof fetch,
  now: Date,
) {
  const store =
    await environment.DB.prepare(`SELECT c.store_id, c.access_token, c.granted_at, c.access_expires_at, s.ebay_environment
    FROM ebay_store_credentials c JOIN ebay_stores s ON s.id = c.store_id
    WHERE s.id = ? AND c.granted_at = ? AND s.ebay_environment = ? AND ${activeStore("c", "s")}
      AND (s.data_deleted_at IS NULL OR s.data_deleted_at < ?)
      AND NOT EXISTS (SELECT 1 FROM deleted_order_keys d
        WHERE d.store_id = s.id AND d.kind = 'order' AND d.external_key = ?)
      AND NOT EXISTS (SELECT 1 FROM orders o JOIN orders current ON current.id = COALESCE(o.merged_into, o.id)
        WHERE o.store_id = s.id AND current.retention_until <= ?
        AND (o.ebay_order_id = ? OR o.id IN (SELECT order_id FROM order_source_refs
          WHERE store_id = s.id AND external_order_id = ?)))`)
      .bind(
        event.storeId,
        event.grantedAt,
        event.environment,
        event.eventAt,
        event.orderId,
        now.toISOString(),
        event.orderId,
        event.orderId,
      )
      .first<ActiveStore & { access_expires_at: string }>();
  if (!store) return;
  if (store.access_expires_at <= now.toISOString()) throw new UpstreamError("credentials");
  const result = await acquireOrders({
    db: environment.DB,
    storeId: store.store_id,
    grantedAt: store.granted_at,
    access: await storeAccess(environment, store, fetcher, now),
    now,
    // Stryker disable next-line ObjectLiteral: questo percorso usa al massimo 11 chiamate e nessuna pagina; rimuovere il budget non cambia l'esito di un singolo ordine.
    budget: { calls: 12, pages: 0 },
    confirmedOrderId: event.orderId,
  });
  if (result !== "complete" && result !== "not_writable") throw new UpstreamError("unavailable");
}
