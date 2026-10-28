import { recordOrderObservation } from "./order-import.server";
import type { OrderObservation } from "./order-observation.server";
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
