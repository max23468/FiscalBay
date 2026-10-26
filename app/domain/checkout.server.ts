import type Stripe from "stripe";

import { appCopy } from "../app-copy";
import { firstChargeAt, priceGeneration, type PremiumOffer, type PurchaseState } from "../catalog";
import { ApplicationError, logFailure } from "../errors";
import type { Language } from "../i18n";
import { catalogMismatch } from "../integrations/stripe-account.server";
import {
  createLifetimeCredit,
  createManagedCheckout,
  createStripeClient,
  expireCheckout,
  retrieveCatalogPrice,
  stripeCall,
  stripeEnvironment,
  stripeId,
  stripeSecretKey,
} from "../integrations/stripe.server";
import { purchasesOpenSql } from "./admission-state.server";
import { reconcileSubscription, workspaceCustomerSql } from "./billing.server";
import { openSubscriptionSql, storeReadSql } from "./grants.server";
import {
  bindLifetimeSession,
  lifetimeContext,
  reconcileLifetime,
  releaseUnboundReservation,
  renewsDuringCheckout,
  reserveLifetime,
} from "./lifetime.server";
import { dayMilliseconds } from "../time";
import { appUrl, planPath } from "../app-links";

/** Offerte in vendita: il lifetime con la prenotazione atomica di uno dei venti posti. */
export const checkoutOffers = [
  "monthly",
  "annual",
  "lifetime",
] as const satisfies readonly PremiumOffer[];

type CheckoutOffer = (typeof checkoutOffers)[number];

const priceVariable = {
  monthly: "STRIPE_PRICE_MONTHLY",
  annual: "STRIPE_PRICE_ANNUAL",
  lifetime: "STRIPE_PRICE_LIFETIME",
} as const satisfies Record<CheckoutOffer, keyof Env>;

export function isCheckoutOffer(value: string): value is CheckoutOffer {
  return (checkoutOffers as readonly string[]).includes(value);
}

/** L'acquisto compare soltanto con la chiave Stripe e i prezzi di ogni offerta in vendita. */
export function checkoutConfigured(env: Env) {
  return !!stripeSecretKey(env) && checkoutOffers.every((offer) => !!env[priceVariable[offer]]);
}

/** Diritto in corso dello spazio, separato per la prova e per ogni altra origine. */
function activeSql(workspace: string, at: string, trial: boolean) {
  return `(SELECT ${trial ? "MAX(e.ends_at)" : "COUNT(*) > 0"} FROM workspace_entitlements e
    WHERE e.workspace_id = ${workspace} AND e.source ${trial ? "=" : "<>"} 'trial'
      AND e.revoked_at IS NULL AND julianday(e.starts_at) <= julianday(${at})
      AND (e.ends_at IS NULL OR julianday(${at}) < julianday(e.ends_at)))`;
}

/**
 * Acquisto possibile dopo il primo collegamento e la prima lettura riuscita di un negozio,
 * anche senza ordini. Un diritto in corso diverso dalla prova lo ferma; durante la prova
 * l'acquisto resta possibile e ne conserva i giorni residui (`trialEndsAt`). Lo ferma anche un
 * abbonamento che può ancora incassare, come un pagamento da confermare o un rinnovo da
 * regolarizzare, o un lifetime pagato e in attesa della conferma; un lifetime rimborsato no.
 * Senza capacità per nuovi Premium gli acquisti sono sospesi.
 */
export async function purchaseState(db: D1Database, userId: string, now = new Date()) {
  const row = await db
    .prepare(`SELECT w.id, (${activeSql("w.id", "?2", false)} OR ${openSubscriptionSql("w.id")}
        OR EXISTS (SELECT 1 FROM lifetime_allocations a WHERE a.workspace_id = w.id
          AND a.status = 'reserved' AND a.completed_at IS NOT NULL)) AS covered,
      ${activeSql("w.id", "?2", true)} AS trial_ends_at, ${storeReadSql("w.id")} AS synced,
      ${purchasesOpenSql} AS open
    FROM workspaces w JOIN workspace_members wm ON wm.workspace_id = w.id
    WHERE wm.user_id = ?1`)
    .bind(userId, now.toISOString())
    .first<{
      id: string;
      covered: number;
      trial_ends_at: string | null;
      synced: number;
      open: number;
    }>();
  if (!row) return null;
  const state: PurchaseState = row.covered
    ? "covered"
    : !row.open
      ? "closed"
      : row.synced
        ? "available"
        : "needs-sync";
  return {
    workspaceId: row.id,
    state,
    trialEndsAt: state === "available" ? row.trial_ends_at : null,
  };
}

/**
 * Durante la prova si paga quando finisce: i giorni residui restano gratuiti. Con meno di due
 * giorni residui l'abbonamento parte subito, come un acquisto ordinario.
 */
function trialCheckout(trialEndsAt: string | null, now: Date) {
  const chargeAt = trialEndsAt ? firstChargeAt(trialEndsAt, now) : null;
  return trialEndsAt && chargeAt ? { trial: { endsAt: trialEndsAt, chargeAt } } : {};
}

export type CheckoutResult =
  | { ok: true; url: string }
  | {
      ok: false;
      reason: Exclude<PurchaseState, "available"> | "sold-out" | "renewing" | "unavailable";
    };

/**
 * Hosted Checkout nel percorso Managed Payments. Prima della vendita il prezzo su Stripe
 * deve coincidere con il listino e avere la copertura fiscale; una sessione aperta fuori da
 * Managed Payments viene chiusa subito. Il pagamento non attribuisce alcun diritto: lo fa
 * soltanto la conferma verificata sul server.
 */
export async function startCheckout(
  env: Env,
  input: {
    request: Request;
    userId: string;
    email: string;
    offer: CheckoutOffer;
    language: Language;
  },
  now = new Date(),
): Promise<CheckoutResult> {
  const priceId = env[priceVariable[input.offer]];
  const secretKey = stripeSecretKey(env);
  if (!secretKey || !priceId) return { ok: false, reason: "unavailable" };
  if (input.offer === "lifetime")
    return startLifetimeCheckout(env, { ...input, priceId, secretKey }, now);
  const purchase = await purchaseState(env.DB, input.userId, now);
  // Senza spazio nessun negozio è stato ancora collegato.
  if (purchase?.state !== "available")
    return { ok: false, reason: purchase?.state ?? "needs-sync" };
  const { workspaceId } = purchase;
  let claim: string | null = null;
  try {
    const stripe = await createStripeClient(secretKey);
    const mismatch = catalogMismatch(
      await retrieveCatalogPrice(stripe, priceId),
      input.offer,
      priceGeneration.net[input.offer],
    );
    if (mismatch) {
      logCheckoutFailure(input.request, `catalog_${mismatch}`);
      return { ok: false, reason: "unavailable" };
    }
    const previous = await closeOpenCheckouts(env, stripe, workspaceId, now, true);
    if (previous === "busy") return { ok: false, reason: "unavailable" };
    // Una sessione precedente pagata nel frattempo ha appena attribuito il suo diritto.
    const current = previous.settled ? await purchaseState(env.DB, input.userId, now) : purchase;
    if (current?.state !== "available") return { ok: false, reason: current?.state ?? "covered" };
    const expiresAt = new Date(now.getTime() + subscriptionCheckoutMs).toISOString();
    claim = await claimCheckout(env.DB, workspaceId, previous.claim, expiresAt, now);
    if (!claim) return { ok: false, reason: "unavailable" };
    const customer = await env.DB.prepare(
      `SELECT ${workspaceCustomerSql("?1", "?2")} AS customer_id`,
    )
      .bind(workspaceId, stripeEnvironment(env))
      .first<{ customer_id: string | null }>();
    const plan = appUrl(env, input.language, planPath);
    const session = await createManagedCheckout(stripe, {
      offer: input.offer,
      priceId,
      generation: priceGeneration.id,
      workspaceId,
      email: input.email,
      language: input.language,
      successUrl: plan,
      cancelUrl: plan,
      ...trialCheckout(current.trialEndsAt, now),
      subscription: {
        expiresAt,
        ...(customer?.customer_id ? { customerId: customer.customer_id } : {}),
      },
    });
    if (session.managed_payments?.enabled !== true) {
      await expireCheckout(stripe, session.id);
      logCheckoutFailure(input.request, "not_managed");
      await releaseClaim(env.DB, workspaceId, claim);
      return { ok: false, reason: "unavailable" };
    }
    if (!session.url) {
      await releaseClaim(env.DB, workspaceId, claim);
      return { ok: false, reason: "unavailable" };
    }
    // Un'altra richiesta dello stesso spazio ha preso il suo turno: questa sessione si chiude.
    if (!(await bindCheckout(env.DB, workspaceId, claim, session.id))) {
      await expireCheckout(stripe, session.id);
      return { ok: false, reason: "unavailable" };
    }
    return { ok: true, url: session.url };
  } catch (error) {
    // Nessun indirizzo è arrivato al cliente: il turno senza sessione si libera.
    if (claim) await releaseClaim(env.DB, workspaceId, claim).catch(() => {});
    logFailure({ request: input.request, error, code: "CHECKOUT_PENDING", operation: "checkout" });
    return { ok: false, reason: "unavailable" };
  }
}

/**
 * Durata della sessione di mensile e annuale, come per il lifetime: una sessione abbandonata
 * non resta in grado di incassare per un giorno.
 */
const subscriptionCheckoutMs = 60 * 60 * 1000;

/** Una richiesta che non ha ancora legato la sua sessione dopo questo intervallo si è fermata. */
const staleClaimMs = 5 * 60 * 1000;

/** Sessioni più vecchie sono già state rilette dal compito `billing`. */
const recentCheckoutMs = 2 * dayMilliseconds;

/**
 * Chiude le sessioni ancora aperte dello spazio prima di aprirne una nuova, così una sola può
 * incassare: quella di mensile o annuale e, per un abbonamento, quella del lifetime, che libera
 * il posto. Una sessione già conclusa si riconcilia subito (`settled`), così il nuovo acquisto
 * si decide sullo stato aggiornato; `claim` è il turno letto. "busy" quando un'altra richiesta
 * dello stesso spazio sta creando la sua sessione.
 */
export async function closeOpenCheckouts(
  env: Env,
  stripe: Stripe,
  workspaceId: string,
  now: Date,
  lifetime: boolean,
): Promise<"busy" | { settled: boolean; claim: string | null }> {
  const row = await env.DB.prepare(
    "SELECT claim, session_id, created_at FROM subscription_checkouts WHERE workspace_id = ?",
  )
    .bind(workspaceId)
    .first<{ claim: string; session_id: string | null; created_at: string }>();
  let settled = false;
  let claim = row?.claim ?? null;
  if (row && !row.session_id && now.getTime() - Date.parse(row.created_at) < staleClaimMs)
    return "busy";
  if (row?.session_id && now.getTime() - Date.parse(row.created_at) < recentCheckoutMs) {
    const session = await closeSession(stripe, row.session_id);
    if (session.status === "complete" && session.subscription) {
      await reconcileSubscription(env, stripe, stripeId(session.subscription), now);
      // L'abbonamento ora è registrato: la sessione conclusa non si rilegge più.
      const done = await env.DB.prepare(
        "DELETE FROM subscription_checkouts WHERE workspace_id = ?1 AND claim = ?2",
      )
        .bind(workspaceId, row.claim)
        .run();
      if (done.meta.changes) claim = null;
      settled = true;
    }
  }
  if (lifetime) {
    const reservation = await env.DB.prepare(`SELECT provider_reference FROM lifetime_allocations
        WHERE workspace_id = ? AND status = 'reserved' AND completed_at IS NULL
          AND provider_reference IS NOT NULL`)
      .bind(workspaceId)
      .first<{ provider_reference: string }>();
    if (reservation) {
      await closeSession(stripe, reservation.provider_reference);
      // Scaduta libera il posto; pagata attiva il lifetime, che ferma il nuovo acquisto.
      await reconcileLifetime(env, stripe, reservation.provider_reference, now);
      settled = true;
    }
  }
  return { settled, claim };
}

/** Chiude una sessione ancora aperta e la restituisce come è ora su Stripe. */
async function closeSession(stripe: Stripe, sessionId: string) {
  const session = await stripeCall(() => stripe.checkout.sessions.retrieve(sessionId));
  if (session.status !== "open") return session;
  try {
    await expireCheckout(stripe, sessionId);
  } catch (error) {
    // Completata un istante prima della chiusura: vale il suo esito.
    const latest = await stripeCall(() => stripe.checkout.sessions.retrieve(sessionId));
    if (latest.status === "open") throw error;
    return latest;
  }
  return { ...session, status: "expired" as const };
}

/**
 * Prende il turno dello spazio per una nuova sessione al posto di quello letto (`previous`):
 * fra richieste concorrenti ne vince una. Null se un'altra lo ha già preso.
 */
async function claimCheckout(
  db: D1Database,
  workspaceId: string,
  previous: string | null,
  expiresAt: string,
  now: Date,
) {
  const claim = crypto.randomUUID();
  const row = await db
    .prepare(`INSERT INTO subscription_checkouts (workspace_id, claim, expires_at, created_at)
      VALUES (?1, ?2, ?3, ?4)
      ON CONFLICT(workspace_id) DO UPDATE SET claim = excluded.claim, session_id = NULL,
        expires_at = excluded.expires_at, created_at = excluded.created_at
      WHERE subscription_checkouts.claim IS ?5
      RETURNING claim`)
    .bind(workspaceId, claim, expiresAt, now.toISOString(), previous ?? "")
    .first<{ claim: string }>();
  return row?.claim === claim ? claim : null;
}

/** Lega la sessione al turno prima che il suo indirizzo arrivi al cliente. */
async function bindCheckout(db: D1Database, workspaceId: string, claim: string, sessionId: string) {
  const result = await db
    .prepare(`UPDATE subscription_checkouts SET session_id = ?3
      WHERE workspace_id = ?1 AND claim = ?2 AND session_id IS NULL`)
    .bind(workspaceId, claim, sessionId)
    .run();
  return result.meta.changes === 1;
}

/** Turno senza sessione legata: nessuna sessione può incassare per esso. */
async function releaseClaim(db: D1Database, workspaceId: string, claim: string) {
  await db
    .prepare(`DELETE FROM subscription_checkouts WHERE workspace_id = ?1 AND claim = ?2
      AND session_id IS NULL`)
    .bind(workspaceId, claim)
    .run();
}

/**
 * Lifetime: il posto si prenota prima della sessione, che scade con la prenotazione, e la
 * sessione si lega al posto prima che il cliente ne riceva l'indirizzo. Una sessione
 * precedente dello stesso spazio si chiude prima di aprirne un'altra, così un posto ha sempre
 * una sola sessione che può incassare; se era già stata completata, il suo esito prevale. Chi
 * passa dall'abbonamento paga il listino corrente meno il periodo pagato non usato, come
 * coupon sul solo prodotto lifetime.
 */
async function startLifetimeCheckout(
  env: Env,
  input: Parameters<typeof startCheckout>[1] & { priceId: string; secretKey: string },
  now: Date,
): Promise<CheckoutResult> {
  const context = await lifetimeContext(env.DB, env, input.userId, now);
  if (!context?.offer) return { ok: false, reason: context ? "covered" : "needs-sync" };
  if (context.offer.state !== "available") return { ok: false, reason: context.offer.state };
  if (renewsDuringCheckout(context.subscription?.renewsAt ?? null, now))
    return { ok: false, reason: "renewing" };
  let reservation: Awaited<ReturnType<typeof reserveLifetime>> = null;
  try {
    const stripe = await createStripeClient(input.secretKey);
    const price = await retrieveCatalogPrice(stripe, input.priceId);
    const mismatch = catalogMismatch(price, "lifetime", priceGeneration.net.lifetime);
    if (mismatch) {
      logCheckoutFailure(input.request, `catalog_${mismatch}`);
      return { ok: false, reason: "unavailable" };
    }
    // Una sessione di mensile o annuale ancora aperta si chiude: una sola sessione incassa.
    const subscriptionCheckout = await closeOpenCheckouts(
      env,
      stripe,
      context.workspaceId,
      now,
      false,
    );
    if (subscriptionCheckout === "busy" || subscriptionCheckout.settled)
      return { ok: false, reason: "unavailable" };
    const previous = context.reservation?.reference;
    if (previous) {
      const session = await stripeCall(() => stripe.checkout.sessions.retrieve(previous));
      if (session.status === "complete") {
        await reconcileLifetime(env, stripe, previous, now);
        return { ok: false, reason: "covered" };
      }
      if (session.status === "open") await expireCheckout(stripe, previous);
    }
    reservation = await reserveLifetime(env.DB, context.workspaceId, context.reservation, now);
    // Senza posto: una richiesta concorrente dello stesso spazio lo ha già prenotato, oppure i
    // posti sono finiti.
    if (!reservation)
      return {
        ok: false,
        reason:
          context.reservation || (await hasAllocation(env.DB, context.workspaceId))
            ? "unavailable"
            : "sold-out",
      };
    const product = stripeId(price.product);
    const coupon = context.offer.credit
      ? await createLifetimeCredit(stripe, {
          amount: context.offer.credit,
          product,
          redeemBy: reservation.expiresAt,
          workspaceId: context.workspaceId,
          name: appCopy[input.language].settings.plan.lifetimeCreditName,
        })
      : null;
    const plan = appUrl(env, input.language, planPath);
    const session = await createManagedCheckout(stripe, {
      offer: "lifetime",
      priceId: input.priceId,
      generation: priceGeneration.id,
      workspaceId: context.workspaceId,
      email: input.email,
      language: input.language,
      successUrl: plan,
      cancelUrl: plan,
      lifetime: {
        expiresAt: reservation.expiresAt,
        ...(coupon ? { coupon: coupon.id } : {}),
        ...(context.subscription?.customerId
          ? { customerId: context.subscription.customerId }
          : {}),
      },
    });
    if (session.managed_payments?.enabled !== true) {
      await expireCheckout(stripe, session.id);
      logCheckoutFailure(input.request, "not_managed");
      await releaseUnboundReservation(env.DB, context.workspaceId, reservation);
      return { ok: false, reason: "unavailable" };
    }
    if (!session.url) {
      await releaseUnboundReservation(env.DB, context.workspaceId, reservation);
      return { ok: false, reason: "unavailable" };
    }
    // Un'altra richiesta dello stesso spazio ha già ripreso il posto: questa sessione si chiude.
    if (!(await bindLifetimeSession(env.DB, context.workspaceId, reservation, session.id))) {
      await expireCheckout(stripe, session.id);
      return { ok: false, reason: "unavailable" };
    }
    return { ok: true, url: session.url };
  } catch (error) {
    // Nessun indirizzo è arrivato al cliente: la prenotazione senza sessione si libera.
    if (reservation)
      await releaseUnboundReservation(env.DB, context.workspaceId, reservation).catch(() => {});
    logFailure({ request: input.request, error, code: "CHECKOUT_PENDING", operation: "checkout" });
    return { ok: false, reason: "unavailable" };
  }
}

async function hasAllocation(db: D1Database, workspaceId: string) {
  return !!(await db
    .prepare("SELECT 1 FROM lifetime_allocations WHERE workspace_id = ?")
    .bind(workspaceId)
    .first());
}

/** Vendita rifiutata da FiscalBay prima del pagamento: nel log soltanto il motivo. */
class CheckoutRefused extends ApplicationError {
  constructor(readonly failure: string) {
    super("CHECKOUT_PENDING");
  }
}

function logCheckoutFailure(request: Request, failure: string) {
  logFailure({ request, error: new CheckoutRefused(failure), operation: "checkout" });
}
