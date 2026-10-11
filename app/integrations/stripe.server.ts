import Stripe from "stripe";

// Il webhook resta indisponibile senza il suo segreto; i pagamenti si attivano separatamente.
export type StripeSecrets = { STRIPE_SECRET_KEY: string; STRIPE_WEBHOOK_SECRET: string };

export type PremiumOffer = "monthly" | "annual" | "lifetime";

const integrationIdentifier = "fiscalbay_mp_qnwjrzta";

export function createStripeClient(secretKey: string): Stripe {
  return new Stripe(secretKey, { httpClient: Stripe.createFetchHttpClient() });
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
  return Stripe.webhooks.constructEventAsync(
    body,
    signature,
    webhookSecret,
    undefined,
    Stripe.createSubtleCryptoProvider(),
  );
}
