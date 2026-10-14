import { recordOrderObservation, type OrderObservation } from "./order-import.server";
import type { EbayAccess } from "../integrations/ebay/environment.server";

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
