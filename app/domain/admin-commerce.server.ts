import { z } from "zod";

import { lifetimeSlots, priceGeneration, priceVariable, type PremiumOffer } from "../catalog";
import { logFailure } from "../errors";
import { catalogMismatch } from "../integrations/stripe-account.server";
import {
  createBoundedStripeClient,
  retrieveCatalogPrice,
  stripeCall,
  stripeEnvironment,
  stripeSecretKey,
} from "../integrations/stripe.server";
import { freeQuotaSettings } from "./grants.server";
import { utc } from "./order-observation.server";
import { dayMilliseconds } from "../time";

/**
 * Vista commerciale della console (§6, §15): posti lifetime, incassi e loro storni, promozioni e
 * quota base del Free, listino. Gli incassi sono quelli che FiscalBay registra dalle fatture
 * verificate: fee e payout restano su Stripe. Le configurazioni valgono soltanto da adesso in
 * poi e non cambiano cicli iniziati, abbonamenti o diritti acquistati.
 */

export type LifetimeSeats = {
  total: number;
  sold: number;
  gifted: number;
  reserved: number;
  /** Posti venduti con il lifetime revocato per rimborso o disputa, ancora occupati. */
  refunded: number;
  /** Posti con il lifetime revocato e poi concesso di nuovo sullo stesso posto. */
  regranted: number;
  available: number;
};

export async function lifetimeSeats(db: D1Database): Promise<LifetimeSeats> {
  const row = await db
    .prepare(`SELECT
      SUM(a.status = 'active' AND a.kind = 'sale') AS sold,
      SUM(a.status = 'active' AND a.kind = 'gift') AS gifted,
      SUM(a.status = 'reserved') AS reserved,
      SUM(a.status = 'active' AND EXISTS (SELECT 1 FROM workspace_entitlements e
        WHERE e.workspace_id = a.workspace_id AND e.source = 'lifetime'
          AND e.revocation IS NOT NULL)) AS refunded,
      SUM(a.status = 'active' AND EXISTS (SELECT 1 FROM workspace_entitlements e
          WHERE e.workspace_id = a.workspace_id AND e.source = 'lifetime'
            AND e.revocation IS NOT NULL)
        AND EXISTS (SELECT 1 FROM workspace_entitlements e WHERE e.workspace_id = a.workspace_id
          AND e.source = 'lifetime' AND e.revoked_at IS NULL)) AS regranted,
      COUNT(*) AS taken
    FROM lifetime_allocations a`)
    .first<Record<string, number | null>>();
  return {
    total: lifetimeSlots,
    sold: row?.sold ?? 0,
    gifted: row?.gifted ?? 0,
    reserved: row?.reserved ?? 0,
    refunded: row?.refunded ?? 0,
    regranted: row?.regranted ?? 0,
    available: lifetimeSlots - (row?.taken ?? 0),
  };
}

export type Payment = {
  id: string;
  workspaceId: string;
  ownerEmail: string | null;
  source: "premium" | "lifetime";
  amountPaid: number;
  amountRefunded: number | null;
  currency: string;
  paidAt: string;
  revocation: "refund" | "dispute" | null;
};

export type Revenue = {
  /** Incassato negli ultimi 30 giorni e in totale, al netto dei rimborsi registrati. */
  last30: number;
  total: number;
  refunded: number;
  payments: Payment[];
  /** Coperture revocate, rimborsi parziali e cancellazioni finanziarie, dalle più recenti. */
  reversals: Payment[];
  erasures: { customerId: string; source: string; at: string; recordedBy: string | null }[];
};

export async function revenue(env: Env, now = new Date()): Promise<Revenue> {
  const db = env.DB;
  const since = new Date(now.getTime() - 30 * dayMilliseconds).toISOString();
  const select = `SELECT id, workspace_id AS workspaceId,
      (SELECT u.email FROM workspace_members wm JOIN "user" u ON u.id = wm.user_id
        WHERE wm.workspace_id = workspace_entitlements.workspace_id
        ORDER BY wm.role = 'owner' DESC LIMIT 1) AS ownerEmail,
      source, amount_paid AS amountPaid,
      amount_refunded AS amountRefunded, currency, paid_at AS paidAt, revocation
    FROM workspace_entitlements WHERE amount_paid IS NOT NULL`;
  const [sums, payments, reversals, erasures] = await db.batch<Record<string, unknown>>([
    db
      .prepare(`SELECT COALESCE(SUM(amount_paid - COALESCE(amount_refunded, 0)), 0) AS total,
          COALESCE(SUM(CASE WHEN paid_at >= ?1
            THEN amount_paid - COALESCE(amount_refunded, 0) END), 0) AS last30,
          COALESCE(SUM(amount_refunded), 0) AS refunded
        FROM workspace_entitlements WHERE amount_paid IS NOT NULL AND currency = 'eur'`)
      .bind(since),
    db.prepare(`${select} ORDER BY paid_at DESC LIMIT 50`),
    db.prepare(`${select} AND (revocation IS NOT NULL OR amount_refunded > 0)
      ORDER BY COALESCE(revoked_at, paid_at) DESC LIMIT 50`),
    db
      .prepare(`SELECT customer_id AS customerId, source, received_at AS at,
          recorded_by AS recordedBy FROM stripe_customer_erasures WHERE environment = ?
        ORDER BY received_at DESC LIMIT 50`)
      .bind(stripeEnvironment(env)),
  ]);
  const totals = sums!.results[0] as { total: number; last30: number; refunded: number };
  return {
    ...totals,
    payments: payments!.results as Payment[],
    reversals: reversals!.results as Payment[],
    erasures: erasures!.results as Revenue["erasures"],
  };
}

export type PriceCheck = {
  offer: PremiumOffer;
  net: number;
  state: "ok" | "mismatch" | "unconfigured" | "unavailable";
  /** Motivo della differenza dal listino. */
  mismatch?: string;
};

/**
 * Listino in vigore confrontato con i prezzi configurati su Stripe: importo, valuta, imposte,
 * periodicità e codice fiscale del prodotto. Un prezzo che non coincide non si mostra come
 * pubblicato; una lettura non riuscita resta tale.
 */
export async function checkPrices(env: Env, fetcher: typeof fetch = fetch): Promise<PriceCheck[]> {
  const key = stripeSecretKey(env);
  const offers = Object.keys(priceVariable) as PremiumOffer[];
  const stripe = key ? await createBoundedStripeClient(key, fetcher) : null;
  return Promise.all(
    offers.map(async (offer): Promise<PriceCheck> => {
      const net = priceGeneration.net[offer];
      const priceId = env[priceVariable[offer]];
      if (!stripe || !priceId) return { offer, net, state: "unconfigured" };
      try {
        const price = await stripeCall(() => retrieveCatalogPrice(stripe, priceId));
        const mismatch = catalogMismatch(price, offer, net);
        return mismatch ? { offer, net, state: "mismatch", mismatch } : { offer, net, state: "ok" };
      } catch (error) {
        logFailure({ error, operation: "admin" });
        return { offer, net, state: "unavailable" };
      }
    }),
  );
}

export type Promotion = {
  id: string;
  startsAt: string;
  endsAt: string;
  quota: number;
  updatedAt: string | null;
};

/** Promozioni non concluse da oltre 90 giorni, dalla più recente. */
export async function listPromotions(db: D1Database, now = new Date()): Promise<Promotion[]> {
  const { results } = await db
    .prepare(`SELECT id, starts_at AS startsAt, ends_at AS endsAt, quota, updated_at AS updatedAt
      FROM free_promotions WHERE julianday(ends_at) > julianday(?) - 90 ORDER BY starts_at DESC`)
    .bind(now.toISOString())
    .all<Promotion>();
  return results;
}

export const promotionSchema = z
  .object({
    startsAt: utc,
    endsAt: utc,
    quota: z.coerce.number().int().min(1).max(100),
  })
  .refine(({ startsAt, endsAt }) => Date.parse(endsAt) > Date.parse(startsAt));

export type PromotionResult = "done" | "invalid" | "overlap" | "not_found" | "started";

/**
 * Nuova promozione o modifica di una non conclusa. Non parte mai nel passato; di una promozione
 * già iniziata si cambiano soltanto quota e fine, e la fine non torna nel passato: i cicli
 * iniziati conservano la versione in vigore al loro inizio.
 */
export async function savePromotion(
  db: D1Database,
  input: { id?: string; promotion: z.infer<typeof promotionSchema> },
  now = new Date(),
): Promise<PromotionResult> {
  const at = now.toISOString();
  const { promotion } = input;
  if (Date.parse(promotion.endsAt) <= now.getTime()) return "invalid";
  try {
    if (!input.id) {
      if (Date.parse(promotion.startsAt) < now.getTime()) return "invalid";
      await db
        .prepare(`INSERT INTO free_promotions (id, starts_at, ends_at, quota, created_at)
          VALUES (?, ?, ?, ?, ?)`)
        .bind(crypto.randomUUID(), promotion.startsAt, promotion.endsAt, promotion.quota, at)
        .run();
      return "done";
    }
    const current = await db
      .prepare("SELECT starts_at, ends_at FROM free_promotions WHERE id = ?")
      .bind(input.id)
      .first<{ starts_at: string; ends_at: string }>();
    if (!current || Date.parse(current.ends_at) <= now.getTime()) return "not_found";
    const started = Date.parse(current.starts_at) <= now.getTime();
    if (started && promotion.startsAt !== current.starts_at) return "started";
    if (!started && Date.parse(promotion.startsAt) < now.getTime()) return "invalid";
    await db
      .prepare(`UPDATE free_promotions SET starts_at = ?2, ends_at = ?3, quota = ?4, updated_at = ?5
        WHERE id = ?1 AND julianday(ends_at) > julianday(?5)`)
      .bind(input.id, promotion.startsAt, promotion.endsAt, promotion.quota, at)
      .run();
    return "done";
  } catch (error) {
    if (String(error).includes("overlapping_promotion")) return "overlap";
    throw error;
  }
}

/** Fine anticipata: subito per una promozione in corso, annullata se non è ancora iniziata. */
export async function endPromotion(db: D1Database, id: string, now = new Date()) {
  const at = now.toISOString();
  const [cancelled, ended] = await db.batch([
    db
      .prepare("DELETE FROM free_promotions WHERE id = ? AND julianday(starts_at) > julianday(?)")
      .bind(id, at),
    db
      .prepare(`UPDATE free_promotions SET ends_at = ?2, updated_at = ?2
        WHERE id = ?1 AND julianday(starts_at) <= julianday(?2)
          AND julianday(ends_at) > julianday(?2)`)
      .bind(id, at),
  ]);
  return cancelled!.meta.changes || ended!.meta.changes ? "done" : "not_found";
}

export const quotaChangeSchema = z.object({
  quota: z.coerce.number().int().min(1).max(100),
  effectiveAt: z.iso.datetime(),
});

/** Nuova quota base del Free dai cicli che iniziano dall'istante indicato, mai nel passato. */
export async function scheduleFreeQuota(
  db: D1Database,
  input: z.infer<typeof quotaChangeSchema> & { actor: string; reason: string },
  now = new Date(),
): Promise<"done" | "invalid"> {
  const effective = Math.max(Date.parse(input.effectiveAt), now.getTime());
  if (Date.parse(input.effectiveAt) < now.getTime() - 60_000) return "invalid";
  await db
    .prepare(`INSERT INTO free_quota_changes (quota, effective_at, actor, reason, created_at)
      VALUES (?, ?, ?, ?, ?)`)
    .bind(
      input.quota,
      new Date(effective).toISOString(),
      input.actor,
      input.reason,
      now.toISOString(),
    )
    .run();
  return "done";
}

export async function commerceOverview(env: Env, now = new Date()) {
  const [seats, money, promotions, quota] = await Promise.all([
    lifetimeSeats(env.DB),
    revenue(env, now),
    listPromotions(env.DB, now),
    freeQuotaSettings(env.DB, now),
  ]);
  return { seats, revenue: money, promotions, quota, generation: priceGeneration.id };
}
