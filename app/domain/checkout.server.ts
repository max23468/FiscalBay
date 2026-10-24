import { firstChargeAt, priceGeneration, type PremiumOffer, type PurchaseState } from "../catalog";
import { ApplicationError, logFailure } from "../errors";
import { localizedPath, type Language } from "../i18n";
import {
  catalogMismatch,
  createManagedCheckout,
  createStripeClient,
  expireCheckout,
  retrieveCatalogPrice,
} from "../integrations/stripe.server";
import { openSubscriptionSql, storeReadSql } from "./grants.server";

/**
 * Offerte in vendita. Il lifetime aspetta la prenotazione atomica dei venti posti: senza,
 * due acquisti concorrenti potrebbero superare il tetto.
 */
export const checkoutOffers = ["monthly", "annual"] as const satisfies readonly PremiumOffer[];

type CheckoutOffer = (typeof checkoutOffers)[number];

const priceVariable = {
  monthly: "STRIPE_PRICE_MONTHLY",
  annual: "STRIPE_PRICE_ANNUAL",
} as const satisfies Record<CheckoutOffer, keyof Env>;

export function isCheckoutOffer(value: string): value is CheckoutOffer {
  return (checkoutOffers as readonly string[]).includes(value);
}

/** L'acquisto compare soltanto con la chiave Stripe e i prezzi di ogni offerta in vendita. */
export function checkoutConfigured(env: Env) {
  return !!env.STRIPE_SECRET_KEY && checkoutOffers.every((offer) => !!env[priceVariable[offer]]);
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
 * regolarizzare.
 */
export async function purchaseState(db: D1Database, userId: string, now = new Date()) {
  const row = await db
    .prepare(`SELECT w.id, (${activeSql("w.id", "?2", false)} OR ${openSubscriptionSql("w.id")}) AS covered,
      ${activeSql("w.id", "?2", true)} AS trial_ends_at, ${storeReadSql("w.id")} AS synced
    FROM workspaces w JOIN workspace_members wm ON wm.workspace_id = w.id
    WHERE wm.user_id = ?1`)
    .bind(userId, now.toISOString())
    .first<{ id: string; covered: number; trial_ends_at: string | null; synced: number }>();
  if (!row) return null;
  const state: PurchaseState = row.covered ? "covered" : row.synced ? "available" : "needs-sync";
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
  | { ok: false; reason: Exclude<PurchaseState, "available"> | "unavailable" };

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
  if (!env.STRIPE_SECRET_KEY || !priceId) return { ok: false, reason: "unavailable" };
  const purchase = await purchaseState(env.DB, input.userId, now);
  // Senza spazio nessun negozio è stato ancora collegato.
  if (purchase?.state !== "available")
    return { ok: false, reason: purchase?.state ?? "needs-sync" };
  const { trialEndsAt } = purchase;
  try {
    const stripe = await createStripeClient(env.STRIPE_SECRET_KEY);
    const mismatch = catalogMismatch(
      await retrieveCatalogPrice(stripe, priceId),
      input.offer,
      priceGeneration.net[input.offer],
    );
    if (mismatch) {
      logCheckoutFailure(input.request, `catalog_${mismatch}`);
      return { ok: false, reason: "unavailable" };
    }
    const plan = `${new URL(env.APP_ORIGIN).origin}${localizedPath(input.language, "/app/impostazioni/piano")}`;
    const session = await createManagedCheckout(stripe, {
      offer: input.offer,
      priceId,
      generation: priceGeneration.id,
      workspaceId: purchase.workspaceId,
      email: input.email,
      language: input.language,
      successUrl: plan,
      cancelUrl: plan,
      ...trialCheckout(trialEndsAt, now),
    });
    if (session.managed_payments?.enabled !== true) {
      await expireCheckout(stripe, session.id);
      logCheckoutFailure(input.request, "not_managed");
      return { ok: false, reason: "unavailable" };
    }
    if (!session.url) return { ok: false, reason: "unavailable" };
    return { ok: true, url: session.url };
  } catch (error) {
    logFailure({ request: input.request, error, code: "CHECKOUT_PENDING", operation: "checkout" });
    return { ok: false, reason: "unavailable" };
  }
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
