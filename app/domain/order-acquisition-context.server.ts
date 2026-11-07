import { recordOrderObservation } from "./order-import.server";
import type { OrderObservation } from "./order-observation.server";
import { logFailure } from "../errors";
import { dayMilliseconds } from "../time";
import type { EbayAccess } from "../integrations/ebay/environment.server";
import type { UpstreamError } from "../integrations/http.server";

// Stato di un'esecuzione dell'acquisizione, condiviso da passate e dettaglio.

/** Chiamate a eBay e pagine di elenco ancora consentite; scalate durante l'esecuzione. */
export type AcquisitionBudget = { calls: number; pages: number };

/** Il consenso con cui è partita l'esecuzione non vale più: si ferma senza scrivere. */
export class NotWritable extends Error {}

export type Context = {
  db: D1Database;
  storeId: string;
  grantedAt: string;
  access: EbayAccess;
  at: string;
  budget: AcquisitionBudget;
  /** Budget giornaliero delle chiamate Trading con quota propria. */
  quota: CallBudget;
  /** Ordini comparsi per la prima volta durante l'esecuzione. */
  created: number;
};

export function spend(budget: AcquisitionBudget, calls: number, pages = 0): boolean {
  if (budget.calls < calls || budget.pages < pages) return false;
  budget.calls -= calls;
  budget.pages -= pages;
  return true;
}

// Attesa quando eBay limita senza Retry-After, e massimo rispettato: oltre un giorno il valore
// non è credibile e la quota giornaliera si è comunque rinnovata.
export const defaultRateLimitSeconds = 15 * 60;
const maxRateLimitSeconds = 86_400;

/**
 * Chiave dell'attesa chiesta da eBay. Le API REST condividono l'attesa dell'origine API; ogni
 * chiamata Trading ha una quota propria, così esaurirla non ferma Fulfillment.
 */
export function limitKey(apiOrigin: string, limit?: string): string {
  return limit ? `${apiOrigin}#${limit}` : apiOrigin;
}

/** Secondi di attesa ancora chiesti da eBay per la chiave; 0 se nessuno. */
export async function rateLimitWait(db: D1Database, key: string, now: Date): Promise<number> {
  const row = await db
    .prepare("SELECT until FROM ebay_rate_limits WHERE api_origin = ? AND until > ?")
    .bind(key, now.toISOString())
    .first<{ until: string }>();
  return row ? Math.ceil((Date.parse(row.until) - now.getTime()) / 1000) : 0;
}

/** Registra l'attesa chiesta da eBay; un'attesa già più lunga resta. */
export async function recordRateLimit(
  db: D1Database,
  key: string,
  error: UpstreamError,
  now: Date,
) {
  const seconds = Math.min(
    maxRateLimitSeconds,
    error.details.retryAfter ?? defaultRateLimitSeconds,
  );
  await db
    .prepare(
      `INSERT INTO ebay_rate_limits (api_origin, until) VALUES (?, ?)
       ON CONFLICT(api_origin) DO UPDATE SET until = MAX(until, excluded.until)`,
    )
    .bind(key, new Date(now.getTime() + seconds * 1000).toISOString())
    .run();
}

export async function record(ctx: Context, observation: OrderObservation) {
  const result = await recordOrderObservation(
    ctx.db,
    { storeId: ctx.storeId, consentGrantedAt: ctx.grantedAt, observedAt: ctx.at },
    observation,
  );
  if (result.outcome === "not_writable") throw new NotWritable();
  if (result.outcome === "created") ctx.created += 1;
  return result;
}

/**
 * Budget giornaliero delle chiamate Trading con quota propria (`GetOrders`, `GetItem`). Le quote
 * eBay sono del keyset, che test e Production condividono; l'Application Growth Check si chiede
 * solo quando il carico corrente le avvicina davvero alla soglia (D317). Per questo:
 *
 * - ogni Worker conta le proprie chiamate per giorno UTC, così la console separa il consumo
 *   dell'ambiente da quello del keyset;
 * - il lavoro non urgente, cioè storico, immagini e letture fiscali degli ordini creati da più
 *   di `urgentDays` giorni, usa una chiamata soltanto finché il consumo del keyset resta sotto
 *   `backgroundShare` della quota; il resto aspetta l'azzeramento;
 * - un Worker con `EBAY_WORKER_SHARE` sotto il 100% non supera quella parte della quota con le
 *   proprie chiamate: il test lascia la quota ai negozi Production.
 */

/** Chiamate Trading con una quota giornaliera propria, quelle che limitano FiscalBay. */
export const budgetedCalls = ["GetOrders", "GetItem"] as const;
export type BudgetedCall = (typeof budgetedCalls)[number];

/** Parte della quota del keyset oltre la quale il lavoro non urgente aspetta l'azzeramento. */
export const backgroundShare = 0.5;
/** Un ordine creato da meno giorni è corrente: le sue letture non aspettano. */
export const urgentDays = 7;

/** Nome della chiamata conteggiata, dalla richiesta; null per quelle fuori dalle quote seguite. */
export function countedCall(input: RequestInfo | URL, init?: RequestInit): string | null {
  const headers = new Headers(
    init?.headers ?? (input instanceof Request ? input.headers : undefined),
  );
  const trading = headers.get("x-ebay-api-call-name");
  if (trading) return trading;
  const url = input instanceof Request ? input.url : String(input);
  return new URL(url).pathname.startsWith("/sell/fulfillment/") ? "order" : null;
}

const dayOf = (at: Date) => at.toISOString().slice(0, 10);

/**
 * Accesso che conta ogni chiamata eBay del negozio fatta da questo Worker. Il conteggio segue la
 * risposta, anche di errore, come la quota di eBay; un errore di D1 non ferma la lettura.
 */
export function countedAccess(db: D1Database, access: EbayAccess, now: Date): EbayAccess {
  const origin = access.configuration.apiOrigin;
  const day = dayOf(now);
  const fetcher: typeof fetch = async (input, init) => {
    const call = countedCall(input, init);
    const response = await access.fetcher(input, init);
    if (call)
      await db
        .prepare(
          `INSERT INTO ebay_call_counts (day, api_origin, call, count) VALUES (?1, ?2, ?3, 1)
           ON CONFLICT (day, api_origin, call) DO UPDATE SET count = count + 1`,
        )
        .bind(day, origin, call)
        .run()
        .catch((error: unknown) => logFailure({ error, operation: "order_acquisition" }));
    return response;
  };
  return { ...access, fetcher };
}

type CallState = {
  limit: number;
  /** Consumo noto: il maggiore fra la lettura del keyset e le chiamate di questo Worker. */
  used: number;
  own: number;
  /** Azzeramento della quota: alla lettura del keyset, altrimenti la mezzanotte UTC. */
  resetAt: string;
};

export type CallBudget = {
  /** Il lavoro non urgente può usare `calls` chiamate di questo tipo. */
  background: (call: BudgetedCall, calls?: number) => boolean;
  /** Istante in cui il lavoro non urgente rimandato riparte. */
  reopenAt: (call: BudgetedCall) => string;
  /** Chiamate fatte nell'esecuzione, da sommare al consumo letto all'inizio. */
  spent: (call: BudgetedCall, calls?: number) => void;
};

/**
 * Stato del budget all'inizio di un'esecuzione. Senza una lettura delle quote il limite non è
 * noto: nessuna chiamata si rimanda. Con `workerShare` sotto 1 e le chiamate del Worker già
 * oltre quella parte, la chiamata entra in attesa fino all'azzeramento come un limite di eBay.
 */
export async function loadCallBudget(
  db: D1Database,
  access: EbayAccess,
  now: Date,
): Promise<CallBudget> {
  const origin = access.configuration.apiOrigin;
  const midnight = new Date(Date.parse(`${dayOf(now)}T00:00:00.000Z`) + dayMilliseconds);
  const { results } = await db
    .prepare(
      `SELECT q.call, q.quota_limit, q.reset_at,
              CASE WHEN q.reset_at IS NULL OR q.reset_at > ?2 THEN q.consumed ELSE 0 END AS consumed,
              COALESCE(c.count, 0) AS own
         FROM ebay_quota_usage q
         LEFT JOIN ebay_call_counts c
           ON c.api_origin = q.api_origin AND c.call = q.call AND c.day = ?3
        WHERE q.api_origin = ?1 AND q.call IN (SELECT value FROM json_each(?4))`,
    )
    .bind(origin, now.toISOString(), dayOf(now), JSON.stringify(budgetedCalls))
    .all<{
      call: BudgetedCall;
      quota_limit: number;
      reset_at: string | null;
      consumed: number;
      own: number;
    }>();
  const states = new Map<BudgetedCall, CallState>(
    results.map((row) => [
      row.call,
      {
        limit: row.quota_limit,
        used: Math.max(row.consumed, row.own),
        own: row.own,
        resetAt:
          row.reset_at && Date.parse(row.reset_at) > now.getTime()
            ? new Date(row.reset_at).toISOString()
            : midnight.toISOString(),
      },
    ]),
  );
  const share = access.configuration.workerShare;
  const capped = [...states].filter(
    ([, state]) => share < 1 && state.limit > 0 && state.own >= state.limit * share,
  );
  if (capped.length)
    await db.batch(
      capped.map(([call, state]) =>
        db
          .prepare(
            `INSERT INTO ebay_rate_limits (api_origin, until) VALUES (?, ?)
             ON CONFLICT(api_origin) DO UPDATE SET until = MAX(until, excluded.until)`,
          )
          .bind(`${origin}#${call}`, state.resetAt),
      ),
    );
  return {
    background: (call, calls = 1) => {
      const state = states.get(call);
      return !state || state.used + calls <= state.limit * backgroundShare;
    },
    reopenAt: (call) => states.get(call)?.resetAt ?? midnight.toISOString(),
    spent: (call, calls = 1) => {
      const state = states.get(call);
      if (state) {
        state.used += calls;
        state.own += calls;
      }
    },
  };
}

/** Budget senza letture delle quote: nessuna chiamata si rimanda. */
export const openBudget: CallBudget = {
  background: () => true,
  reopenAt: () => new Date(0).toISOString(),
  spent: () => {},
};

/** Conserva l'ultima lettura delle quote giornaliere del keyset per le chiamate seguite. */
export function quotaUsageStatements(
  db: D1Database,
  apiOrigin: string,
  rows: ReadonlyArray<{
    resource: string;
    daily: boolean;
    rate: { limit: number; consumed: number; resetAt?: string | null };
  }>,
  now: Date,
): D1PreparedStatement[] {
  return rows.flatMap((row) => {
    const call = row.resource.split(".").at(-1)!;
    if (!row.daily || !budgetedCalls.includes(call as BudgetedCall)) return [];
    return [
      db
        .prepare(
          `INSERT INTO ebay_quota_usage (api_origin, call, quota_limit, consumed, reset_at, read_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6)
           ON CONFLICT (api_origin, call) DO UPDATE SET quota_limit = excluded.quota_limit,
             consumed = excluded.consumed, reset_at = excluded.reset_at, read_at = excluded.read_at`,
        )
        .bind(
          apiOrigin,
          call,
          row.rate.limit,
          row.rate.consumed,
          row.rate.resetAt ?? null,
          now.toISOString(),
        ),
    ];
  });
}

/** Chiamate del Worker nel giorno UTC per origine API e chiamata, per la console. */
export async function ownCalls(db: D1Database, apiOrigin: string, now: Date) {
  const { results } = await db
    .prepare("SELECT call, count FROM ebay_call_counts WHERE day = ?1 AND api_origin = ?2")
    .bind(dayOf(now), apiOrigin)
    .all<{ call: string; count: number }>();
  return new Map(results.map((row) => [row.call, row.count]));
}
