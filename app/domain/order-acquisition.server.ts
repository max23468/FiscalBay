import { servedSql } from "./admission.server";
import { DuplicateLineIdentity } from "./order-import.server";
import { historyStartSql, storeWorkspaceSql } from "./history-window.server";
import { activeStore, dormantWorkspaceSql, writableStore } from "./store-state.server";
import {
  limitKey,
  rateLimitWait,
  record,
  recordRateLimit,
  spend,
  NotWritable,
  type AcquisitionBudget,
  type Context,
  countedAccess,
  loadCallBudget,
  workerShare,
} from "./order-acquisition-context.server";
import { readDetail, readDetails, stopsReads } from "./order-acquisition-details.server";
import { checkBuyerNames } from "./buyer-check.server";
import { serviceSetting } from "./service-settings.server";
import { refreshStoreProfile } from "./store-profile.server";
import { logFailure } from "../errors";
import { dayMilliseconds } from "../time";
import { UpstreamError } from "../integrations/http.server";
import { ebayConfiguration, type EbayAccess } from "../integrations/ebay/environment.server";
import type { EbayEnvironment } from "../view-models";
import {
  buildCreationDateFilter,
  buildLastModifiedFilter,
  fulfillmentObservation,
  readFulfillmentOrder,
  readFulfillmentOrders,
  type FulfillmentPage,
} from "../integrations/ebay/fulfillment.server";
import { openToken, rejectCredentials } from "../integrations/ebay/seller-credentials.server";
import { readTradingOrders, tradingReachDays } from "../integrations/ebay/trading.server";
import { inSequence } from "../sequence";

/**
 * Acquisizione degli ordini di un negozio, condivisa da collegamento e lavoro periodico:
 *
 * 1. recenti: ordini modificati dopo l'ultimo limite applicato, con una sovrapposizione;
 * 2. Trading: acquisti modificati, compresi quelli prima del checkout che Fulfillment non
 *    espone, con pagina e limite propri, con la cadenza del negozio salvo collegamento e richieste
 *    manuali; un suo errore, anche il limite della sua quota, non ferma i passi successivi;
 * 3. storico: ordini creati nella finestra dello spazio fissata al primo avvio, dal più recente,
 *    estesa al periodo più vecchio quando la finestra si allarga;
 * 4. dettaglio: dati fiscali e immagini di ogni versione Fulfillment non ancora letta,
 *    in `order-acquisition-details.server.ts`.
 *
 * Dopo i recenti, al massimo una volta a settimana, si rileggono nome e logo del negozio eBay.
 * Dopo il dettaglio, gli ordini senza token eIAS letti da più di una settimana rileggono lo
 * username dell'acquirente, in `buyer-check.server.ts`.
 *
 * Recenti e storico si leggono per tratti di tempo, ciascuno con una sola pagina: una pagina
 * è una fotografia coerente, quindi un ordine che cambia o compare durante la lettura non
 * sposta la paginazione e non fa saltare ordini. Un tratto con più ordini di una pagina si
 * restringe in proporzione e si rilegge. Ogni tratto si applica prima di salvarne il limite:
 * un'interruzione riprende dal primo tratto non applicato. I recenti precedono sempre lo
 * storico, che non ne ritarda l'acquisizione; il dettaglio è un passo separato che un errore
 * non estende all'ordine.
 */

/** Massimo di `getOrders` per pagina. */
const pageSize = 200;
/**
 * Tratto più stretto: oltre una pagina di ordini nello stesso secondo si seguono le pagine di
 * eBay, senza ripartire se il totale cambia.
 */
const minimumSliceMilliseconds = 1_000;
const overlapMilliseconds = 15 * 60_000;
/** Intervallo massimo di modifica di una lettura Trading `GetOrders`. */
const tradingWindowDays = 30;
/**
 * Durata massima di una lettura: le sue scritture portano l'istante d'inizio, quindi arrivano in
 * D1 fino a questo tempo dopo l'istante registrato.
 */
export const lockMilliseconds = 15 * 60_000;
/**
 * Cadenza della passata Trading periodica (D177, D322). Il solo dato visibile che Trading aggiunge
 * a Fulfillment sono le fatture combinate dal venditore senza checkout eBay: ogni due ore per un
 * negozio che ne ha avute negli ultimi trenta giorni, ogni sei ore per gli altri, ogni dodici per
 * uno spazio che nessuno segue. Collegamento e richieste manuali la eseguono subito.
 */
const tradingIntervals = {
  trading: 2 * 60 * 60_000,
  fulfillment: 6 * 60 * 60_000,
  dormant: 12 * 60 * 60_000,
};
/** Periodo in cui una fattura combinata senza checkout tiene il negozio alla cadenza più breve. */
const tradingActivityDays = 30;
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
  /** Intervallo ancora da leggere, estremi inclusi. */
  from: string;
  to: string;
  /** I recenti avanzano dal più vecchio, lo storico arretra dal più recente. */
  forward: boolean;
  filter: (from: string, to: string) => string;
  /** Data dell'ordine su cui filtra la passata. */
  key: (order: FulfillmentPage["orders"][number]) => unknown;
  /** Tratto applicato: il nuovo estremo dell'intervallo da leggere. */
  progress: (reached: string) => Promise<void>;
  finish: () => Promise<void>;
};

const instant = (milliseconds: number) => new Date(milliseconds).toISOString();

/**
 * Legge una passata per tratti di una pagina, entro il budget. L'ampiezza del tratto successivo
 * segue la densità di ordini appena vista, con un margine sotto la pagina che eBay restituisce.
 */
async function runPass(ctx: Context, pass: Pass): Promise<boolean> {
  let from = Date.parse(pass.from);
  let to = Date.parse(pass.to);
  // Il primo tratto è l'intero intervallo.
  let width = Infinity;
  let capacity = pageSize;
  const fit = (span: number, orders: number) =>
    Math.max(minimumSliceMilliseconds, Math.floor((span * capacity * 0.8) / Math.max(orders, 1)));
  while (spend(ctx.budget, 1, 1)) {
    const [start, end] = pass.forward
      ? [from, Math.min(to, from + width)]
      : [Math.max(from, to - width), to];
    const span = end - start;
    let page = await readFulfillmentOrders(ctx.access, {
      limit: pageSize,
      filter: pass.filter(instant(start), instant(end)),
    });
    if (page.next && span > minimumSliceMilliseconds) {
      // Tratto troppo denso: si rilegge più stretto, senza applicarne una parte. Gli ordini della
      // pagina sono un campione del tratto: il confine cade dove il campione ne lascia una pagina
      // abbondante, oppure, senza campione utile, in proporzione al totale. Una data illeggibile
      // resta fuori dal campione.
      capacity = Math.min(capacity, Math.max(page.orders.length, 1));
      const near = pass.forward ? start : end;
      const sample = page.orders
        .map((order) => Math.abs(Date.parse(String(pass.key(order))) - near))
        .filter((distance) => Number.isFinite(distance))
        .sort((a, b) => a - b);
      const bound = sample[Math.floor((sample.length * capacity * 0.8) / page.total)];
      width = Math.max(
        minimumSliceMilliseconds,
        Math.min(Math.floor(span / 2), bound ?? fit(span, page.total)),
      );
      if (await callsOff(ctx)) return false;
      continue;
    }
    // In sequenza: la riconciliazione delle righe presuppone scritture serializzate per negozio.
    await inSequence(page.orders, (order) => record(ctx, fulfillmentObservation(order, ctx.at)));
    const read = page.total;
    // Stryker disable next-line BlockStatement: senza il corpo il ciclo non termina e Stryker lo conta come Timeout; la prova con sessanta ordini nello stesso istante conta le pagine lette e il budget.
    while (page.next) {
      if (!spend(ctx.budget, 1, 1)) return false;
      page = await readFulfillmentOrders(ctx.access, { next: page.next });
      await inSequence(page.orders, (order) => record(ctx, fulfillmentObservation(order, ctx.at)));
    }
    if (pass.forward ? end >= to : start <= from) {
      await pass.finish();
      return true;
    }
    if (pass.forward) from = end;
    else to = start;
    await pass.progress(instant(pass.forward ? from : to));
    width = Math.min(span * 4, fit(span, read));
    if (await callsOff(ctx)) return false;
  }
  return false;
}

/**
 * Chiamate eBay spente dalla console durante l'esecuzione: la lettura si ferma prima della pagina
 * successiva, come a budget esaurito, e riprende alla riaccensione dall'ultima pagina applicata.
 */
async function callsOff(ctx: Context) {
  return !(await serviceSetting(ctx.db, "ebay_calls"));
}

type SyncRow = {
  cursor: string;
  recent_end: string | null;
  recent_next: string | null;
  history_from: string;
  history_until: string;
  history_through: string | null;
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

/** Cadenza della passata Trading periodica per il negozio, in millisecondi. */
async function tradingInterval(ctx: Context): Promise<number> {
  const row = await ctx.db
    .prepare(
      `SELECT ${dormantWorkspaceSql(storeWorkspaceSql("?1"), "?2")} AS dormant,
              EXISTS (SELECT 1 FROM orders o
                WHERE o.store_id = ?1 AND o.is_provisional = 0 AND o.merged_into IS NULL
                  AND o.creation_time > ?3 AND NOT EXISTS (SELECT 1 FROM order_source_refs r
                    WHERE r.order_id = o.id AND r.source = 'fulfillment')) AS trading`,
    )
    .bind(ctx.storeId, ctx.at, instant(Date.parse(ctx.at) - tradingActivityDays * dayMilliseconds))
    .first<{ dormant: number; trading: number }>();
  // Una SELECT senza tabella restituisce sempre la sua riga.
  if (row!.dormant) return tradingIntervals.dormant;
  return row!.trading ? tradingIntervals.trading : tradingIntervals.fulfillment;
}

/**
 * Legge gli acquisti Trading modificati dopo il limite, per finestre di trenta giorni concatenate
 * fino all'istante corrente: dopo una pausa nessun periodo resta escluso, entro i novanta giorni
 * che Trading conserva. Ogni finestra conclusa sposta il limite alla sua fine.
 */
async function runTradingPass(ctx: Context, state: SyncRow): Promise<boolean> {
  // Una passata già iniziata prosegue; altrimenti si rilegge al collegamento, su richiesta
  // manuale o quando l'ultima passata conclusa ha l'età della cadenza del negozio.
  if (!state.trading_end && state.trading_cursor && state.requested_at === null) {
    const age = Date.parse(ctx.at) - Date.parse(state.trading_cursor);
    if (age < (await tradingInterval(ctx))) return true;
  }
  if ((await rateLimitWait(ctx.db, ordersLimit(ctx), new Date(ctx.at))) > 0) return false;
  const reach = Date.parse(ctx.at) - tradingReachDays * dayMilliseconds;
  // La prima passata parte dall'inizio dello storico, le altre dal limite con la sovrapposizione.
  let cursor = state.trading_cursor
    ? Date.parse(state.trading_cursor) - overlapMilliseconds
    : Date.parse(state.history_from);
  // Una finestra iniziata riprende dalla sua pagina; una ormai oltre la portata di Trading, o
  // nessuna, ricomincia dal limite.
  const resumed = Date.parse(String(state.trading_end)) > reach;
  let until = resumed ? Date.parse(state.trading_end!) : null;
  let page = resumed ? (state.trading_page ?? 1) : 1;
  let total = resumed ? state.trading_total : null;
  while (spend(ctx.budget, 1, 1)) {
    const start = Math.max(reach, cursor);
    until ??= Math.min(Date.parse(ctx.at), start + tradingWindowDays * dayMilliseconds);
    // Trading accetta al massimo trenta giorni per intervallo di modifica.
    const from = instant(Math.max(start, until - tradingWindowDays * dayMilliseconds));
    ctx.quota.spent("GetOrders");
    const result = await readTradingOrders(ctx.access, { from, until: instant(until), page });
    let skipped = result.skipped;
    await inSequence(result.orders, (observation) =>
      record(ctx, observation).catch((error: unknown) => {
        // Righe ripetute nello stesso acquisto: si salta l'ordine, non la pagina.
        if (!(error instanceof DuplicateLineIdentity)) throw error;
        skipped += 1;
      }),
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
        instant(until),
      );
      // Una finestra troncata dai trenta giorni continua con la successiva; il resto attende il
      // turno della cadenza.
      if (until > Date.parse(ctx.at) - tradingIntervals.trading) return true;
      [cursor, until, page, total] = [until, null, 1, null];
      if (await callsOff(ctx)) break;
      continue;
    }
    total = result.total;
    await saveState(
      ctx,
      "trading_end = ?4, trading_page = ?5, trading_total = ?6",
      instant(until),
      page,
      total,
    );
    if (await callsOff(ctx)) break;
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
  // Una passata a tratti già iniziata riprende dal limite applicato; una nuova parte da lì
  // con la sovrapposizione, come una passata lasciata a metà dalla paginazione precedente.
  const resumed = state.recent_end !== null && state.recent_next === null;
  const end = resumed ? state.recent_end! : ctx.at;
  // Un orologio indietro rispetto al limite già applicato non produce un intervallo vuoto.
  const [checkpoint] = [state.cursor, end].sort();
  const from = resumed ? checkpoint! : instant(Date.parse(checkpoint!) - overlapMilliseconds);
  return {
    from,
    to: end,
    forward: true,
    filter: (start, until) => buildLastModifiedFilter(new Date(start), new Date(until), 0),
    key: (order) => order.lastModifiedDate,
    // Il limite non torna indietro se un'esecuzione più lenta conclude una passata precedente.
    progress: (reached) =>
      saveState(
        ctx,
        "cursor = MAX(cursor, ?4), recent_end = ?5, recent_next = NULL, recent_total = NULL",
        reached,
        end,
      ),
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
    from: state.history_from,
    to: state.history_through ?? state.history_until,
    forward: false,
    filter: buildCreationDateFilter,
    key: (order) => order.creationDate,
    progress: (reached) =>
      saveState(ctx, "history_through = ?4, history_next = NULL, history_total = NULL", reached),
    finish: () =>
      saveState(
        ctx,
        "history_done_at = ?3, history_through = NULL, history_next = NULL, history_total = NULL",
      ),
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
 * recenti all'istante corrente e lo storico alla finestra dello spazio: trenta giorni nel Free,
 * un anno o l'estensione concessa con una copertura. Lo storico attende i recenti; il dettaglio
 * usa anche le chiamate rimaste quando le pagine finiscono.
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
  /** Parte delle quote del keyset per questo Worker (`workerShare`); senza, l'intera quota. */
  workerShare?: number;
}): Promise<AcquisitionResult> {
  const { db, storeId, grantedAt, now } = input;
  const at = now.toISOString();
  const apiOrigin = input.access.configuration.apiOrigin;
  const wait = await rateLimitWait(db, apiOrigin, now);
  if (wait > 0) throw new UpstreamError("rate_limited", { retryAfter: wait });
  const poll = !input.confirmedOrderId;
  // Ogni chiamata del negozio si conta per giorno; il budget del giorno vale per tutta la lettura.
  const access = countedAccess(db, input.access, now);
  const quota = await loadCallBudget(db, access, now, input.workerShare);
  const lock = new Date(now.getTime() + lockMilliseconds).toISOString();
  // Con una finestra più ampia, come all'attivazione di una copertura, lo storico concluso
  // riprende dal periodo più vecchio non ancora importato; una passata ormai tutta fuori dalla
  // finestra, come dopo il ritorno al Free, si chiude dove era arrivato lo storico completo.
  const extend = `sync_state.history_done_at IS NOT NULL
    AND sync_state.history_from > excluded.history_from`;
  const stop = `sync_state.history_done_at IS NULL
    AND COALESCE(sync_state.history_through, sync_state.history_until) <= excluded.history_from`;
  const state = await db
    .prepare(
      `INSERT INTO sync_state
         (store_id, cursor, history_from, history_until, locked_until, polled_at, updated_at)
       SELECT ?1, ?3, ${historyStartSql(storeWorkspaceSql("?1"), "?3")}, ?3, ?4, ?5, ?3
        WHERE ${writableStore}
       ON CONFLICT(store_id) DO UPDATE SET
         cursor = COALESCE(sync_state.cursor, excluded.cursor),
         history_from = CASE WHEN sync_state.history_from IS NULL OR ${extend}
             THEN excluded.history_from
           WHEN ${stop} THEN COALESCE(sync_state.history_through, sync_state.history_until)
           ELSE sync_state.history_from END,
         history_until = COALESCE(sync_state.history_until, excluded.history_until),
         history_through = CASE WHEN ${extend} THEN sync_state.history_from
           WHEN ${stop} THEN NULL ELSE sync_state.history_through END,
         history_done_at = CASE WHEN ${extend} THEN NULL WHEN ${stop} THEN excluded.updated_at
           ELSE sync_state.history_done_at END,
         locked_until = excluded.locked_until,
         polled_at = COALESCE(excluded.polled_at, sync_state.polled_at),
         updated_at = excluded.updated_at
       WHERE sync_state.locked_until IS NULL OR sync_state.locked_until <= ?3
       RETURNING cursor, recent_end, recent_next, history_from, history_until,
                 history_through, history_done_at,
                 trading_cursor, trading_end, trading_page, trading_total, requested_at`,
    )
    .bind(storeId, grantedAt, at, lock, poll ? at : null)
    .first<SyncRow>();
  if (!state) {
    const writable = await db
      .prepare(`SELECT 1 AS ok WHERE ${writableStore}`)
      .bind(storeId, grantedAt)
      .first();
    return writable ? "busy" : "not_writable";
  }

  const ctx: Context = { ...input, access, at, created: 0, quota };
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
        creation_time: observation.creationTime,
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
    const details = !(await callsOff(ctx)) && (await readDetails(ctx));
    outcome = { ok: true, served: true };
    // Il budget rimasto verifica gli username degli acquirenti, con le chiamate ancora accese.
    if (!(await callsOff(ctx))) await checkBuyerNames(ctx);
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
  env: Env,
  store: ActiveStore,
  fetcher: typeof fetch,
  now: Date,
): Promise<EbayAccess> {
  const configuration = ebayConfiguration(env, store.ebay_environment);
  try {
    return {
      fetcher,
      configuration,
      accessToken: await openToken(env, store.store_id, "access", store.access_token),
    };
  } catch {
    await rejectCredentials(env.DB, store.store_id, store.granted_at, now);
    throw new UpstreamError("credentials");
  }
}

/**
 * Rilegge consenso, pausa, ammissione e token prima di eseguire un evento già accettato.
 * L'evento non dipende dal piano e non aspetta la cadenza della lettura periodica, ma uno spazio
 * in lista d'attesa non legge eBay dopo la prima lettura: l'evento si chiude senza chiamate.
 * Con le chiamate eBay spente dalla console l'evento diventa una richiesta di lettura del
 * negozio, servita alla riaccensione.
 */
export async function consumeOrderConfirmation(
  env: Env,
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
    await env.DB.prepare(`SELECT c.store_id, c.access_token, c.granted_at, c.access_expires_at, s.ebay_environment
    FROM ebay_store_credentials c JOIN ebay_stores s ON s.id = c.store_id
    WHERE s.id = ?1 AND c.granted_at = ?2 AND s.ebay_environment = ?3 AND ${activeStore("c", "s")}
      AND ${servedSql("s.workspace_id", "?6")}
      AND (s.data_deleted_at IS NULL OR s.data_deleted_at < ?4)
      AND NOT EXISTS (SELECT 1 FROM deleted_order_keys d
        WHERE d.store_id = s.id AND d.kind = 'order' AND d.external_key = ?5)
      AND NOT EXISTS (SELECT 1 FROM orders o JOIN orders current ON current.id = COALESCE(o.merged_into, o.id)
        WHERE o.store_id = s.id AND current.retention_until <= ?6
        AND (o.ebay_order_id = ?5 OR o.id IN (SELECT order_id FROM order_source_refs
          WHERE store_id = s.id AND external_order_id = ?5)))`)
      .bind(
        event.storeId,
        event.grantedAt,
        event.environment,
        event.eventAt,
        event.orderId,
        now.toISOString(),
      )
      .first<ActiveStore & { access_expires_at: string }>();
  if (!store) return;
  if (!(await serviceSetting(env.DB, "ebay_calls"))) {
    await env.DB.prepare(
      `INSERT INTO sync_state (store_id, requested_at, updated_at)
       SELECT ?1, ?3, ?3 WHERE ${writableStore}
       ON CONFLICT(store_id) DO UPDATE SET
         requested_at = COALESCE(sync_state.requested_at, excluded.requested_at)`,
    )
      .bind(store.store_id, store.granted_at, now.toISOString())
      .run();
    return;
  }
  if (store.access_expires_at <= now.toISOString()) throw new UpstreamError("credentials");
  const result = await acquireOrders({
    db: env.DB,
    storeId: store.store_id,
    grantedAt: store.granted_at,
    access: await storeAccess(env, store, fetcher, now),
    now,
    // Stryker disable next-line ObjectLiteral: questo percorso usa al massimo 11 chiamate e nessuna pagina; rimuovere il budget non cambia l'esito di un singolo ordine.
    budget: { calls: 12, pages: 0 },
    confirmedOrderId: event.orderId,
    workerShare: workerShare(env),
  });
  if (result !== "complete" && result !== "not_writable") throw new UpstreamError("unavailable");
}
