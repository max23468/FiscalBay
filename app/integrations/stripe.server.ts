import type Stripe from "stripe";

// Il webhook resta indisponibile senza il suo segreto; i pagamenti si attivano separatamente.
export type StripeSecrets = { STRIPE_SECRET_KEY: string; STRIPE_WEBHOOK_SECRET: string };

export type PremiumOffer = "monthly" | "annual" | "lifetime";

const integrationIdentifier = "fiscalbay_mp_qnwjrzta";

// Lo SDK è la parte più pesante del bundle: si valuta solo quando serve, non a ogni avvio
// dell'isolate per pagine, cron e webhook eBay.
const loadStripe = () => import("stripe").then((module) => module.default);

export async function createStripeClient(secretKey: string): Promise<Stripe> {
  const StripeSdk = await loadStripe();
  return new StripeSdk(secretKey, { httpClient: StripeSdk.createFetchHttpClient() });
}

export function buildManagedCheckoutParams(input: {
  offer: PremiumOffer;
  priceId: string;
  workspaceId: string;
  email: string;
  appOrigin: string;
}): Stripe.Checkout.SessionCreateParams {
  return {
    mode: input.offer === "lifetime" ? "payment" : "subscription",
    line_items: [{ price: input.priceId, quantity: 1 }],
    managed_payments: { enabled: true },
    integration_identifier: integrationIdentifier,
    client_reference_id: input.workspaceId,
    customer_email: input.email,
    metadata: {
      workspace_id: input.workspaceId,
      offer: input.offer,
    },
    success_url: `${input.appOrigin}/?checkout=processing&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${input.appOrigin}/?checkout=cancelled`,
  };
}

export async function createManagedCheckout(
  stripe: Stripe,
  input: Parameters<typeof buildManagedCheckoutParams>[0],
): Promise<Stripe.Checkout.Session> {
  return stripe.checkout.sessions.create(buildManagedCheckoutParams(input));
}

export async function verifyStripeEvent(
  body: string,
  signature: string,
  webhookSecret: string,
): Promise<Stripe.Event> {
  const StripeSdk = await loadStripe();
  return StripeSdk.webhooks.constructEventAsync(
    body,
    signature,
    webhookSecret,
    undefined,
    StripeSdk.createSubtleCryptoProvider(),
  );
}
