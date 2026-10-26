import type Stripe from "stripe";

import { isProduction } from "../app-links";
import type { PremiumOffer } from "../catalog";
import type { Language } from "../i18n";
import { readBounded, retryAfterSeconds, UpstreamError } from "./http.server";

// Il webhook resta indisponibile senza il suo segreto; i pagamenti si attivano separatamente.
export type StripeSecrets = { STRIPE_SECRET_KEY: string; STRIPE_WEBHOOK_SECRET: string };

// Segreti facoltativi del Worker, tipizzati su `Env` come opzionali: dichiararli con
// `bindings.secret()` in `cloudflare.config.ts` li renderebbe obbligatori in ogni ambiente.
declare global {
  namespace Cloudflare {
    interface Env extends Partial<StripeSecrets> {}
  }
}

/**
 * Chiave Stripe utilizzabile nell'ambiente, standard o con limitazioni: di test fuori da
 * Production, live in Production. La chiave dell'altro ambiente vale come chiave assente:
 * acquisti, portale e letture restano fermi invece di agire sugli oggetti sbagliati.
 */
export function stripeSecretKey(env: Pick<Env, "APP_ORIGIN" | "STRIPE_SECRET_KEY">) {
  const key = env.STRIPE_SECRET_KEY;
  const accepted = isProduction(env) ? /^[rs]k_live_./u : /^[rs]k_test_./u;
  return key && accepted.test(key) ? key : undefined;
}

const integrationIdentifier = "fiscalbay_mp_qnwjrzta";

// Lo SDK è la parte più pesante del bundle: si valuta solo quando serve, non a ogni avvio
// dell'isolate per pagine, cron e webhook eBay.
const loadStripe = () => import("stripe").then((module) => module.default);

export async function createStripeClient(secretKey: string): Promise<Stripe> {
  const StripeSdk = await loadStripe();
  return new StripeSdk(secretKey, { httpClient: StripeSdk.createFetchHttpClient() });
}

const readTimeoutMs = 15_000;
const readMaxBytes = 1_048_576;

/**
 * Client delle letture da coda e cron: nessun retry dello SDK, perché riprova già la coda, e
 * gli stessi timeout e limite dei byte delle altre chiamate ai provider.
 */
export async function createStripeReader(
  secretKey: string,
  fetcher: typeof fetch = fetch,
): Promise<Stripe> {
  const StripeSdk = await loadStripe();
  const bounded: typeof fetch = async (input, init) => {
    const response = await fetcher(input, init);
    const bytes = await readBounded(response, readMaxBytes);
    if (!bytes) throw new UpstreamError("invalid_response", { status: response.status });
    return new Response(bytes.byteLength ? new TextDecoder().decode(bytes) : null, {
      status: response.status,
      headers: response.headers,
    });
  };
  return new StripeSdk(secretKey, {
    httpClient: StripeSdk.createFetchHttpClient(bounded),
    maxNetworkRetries: 0,
    timeout: readTimeoutMs,
  });
}

/**
 * Errore di Stripe nella classificazione comune dei provider. Un oggetto che Stripe non
 * restituisce più resta distinto: non prova un acquisto inesistente né un rimborso.
 */
export function stripeFailure(error: unknown): UpstreamError {
  const {
    statusCode: status,
    code,
    headers,
    detail,
  } = (error ?? {}) as {
    statusCode?: number;
    code?: string;
    headers: Record<string, string>;
    detail?: unknown;
  };
  // Lo SDK avvolge in un errore di connessione quello del trasporto, come il limite dei byte.
  if (detail instanceof UpstreamError) return detail;
  if (status === 429) {
    const retryAfter = retryAfterSeconds(headers["retry-after"] ?? null) ?? undefined;
    return new UpstreamError("rate_limited", { status, retryAfter });
  }
  if (status && status >= 400 && status < 500)
    return new UpstreamError("rejected", {
      status,
      providerCode: code && /^[a-z_]{1,64}$/u.test(code) ? code : undefined,
    });
  return new UpstreamError("unavailable", status ? { status } : {});
}

export function isMissingObject(error: UpstreamError) {
  return error.details.status === 404 && error.details.providerCode === "resource_missing";
}

/** Chiamata a Stripe con gli errori classificati come quelli degli altri provider. */
export async function stripeRead<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    throw stripeFailure(error);
  }
}

/**
 * Sessione di Hosted Checkout nel percorso Managed Payments. Imposte, conversione di valuta,
 * metodi di pagamento e dati di fatturazione li decide Stripe come merchant of record: i
 * parametri del Checkout ordinario che li controllano non compaiono.
 */
export function buildManagedCheckoutParams(input: {
  offer: PremiumOffer;
  priceId: string;
  generation: string;
  workspaceId: string;
  email: string;
  language: Language;
  successUrl: string;
  cancelUrl: string;
  /**
   * Acquisto durante la prova: l'abbonamento parte con i giorni di prova residui e il primo
   * addebito arriva alla loro fine (`chargeAt`), che Stripe mostra come prova gratuita.
   */
  trial?: { endsAt: string; chargeAt: string };
  /**
   * Lifetime: scadenza della sessione, che coincide con quella della prenotazione del posto,
   * coupon del periodo pagato non usato e cliente Stripe di un abbonamento da sostituire.
   */
  lifetime?: { expiresAt: string; coupon?: string; customerId?: string };
}): Stripe.Checkout.SessionCreateParams {
  const { trial, lifetime } = input;
  const metadata = {
    workspace_id: input.workspaceId,
    offer: input.offer,
    price_generation: input.generation,
    ...(trial ? { trial_ends_at: trial.endsAt } : {}),
  };
  return {
    mode: input.offer === "lifetime" ? "payment" : "subscription",
    line_items: [{ price: input.priceId, quantity: 1 }],
    managed_payments: { enabled: true },
    integration_identifier: integrationIdentifier,
    client_reference_id: input.workspaceId,
    // Chi passa dall'abbonamento resta lo stesso cliente; un acquisto una tantum ne crea uno,
    // così ricevute e fatture restano consultabili dal portale.
    ...(lifetime?.customerId
      ? { customer: lifetime.customerId }
      : { customer_email: input.email, ...(lifetime ? { customer_creation: "always" } : {}) }),
    locale: input.language,
    metadata,
    // Il riferimento allo spazio resta anche sull'oggetto che sopravvive alla sessione.
    ...(input.offer === "lifetime"
      ? {
          payment_intent_data: { metadata },
          ...(lifetime ? { expires_at: Math.floor(Date.parse(lifetime.expiresAt) / 1000) } : {}),
          ...(lifetime?.coupon ? { discounts: [{ coupon: lifetime.coupon }] } : {}),
        }
      : {
          subscription_data: {
            metadata,
            ...(trial ? { trial_end: Date.parse(trial.chargeAt) / 1000 } : {}),
          },
        }),
    success_url: `${input.successUrl}?checkout=${input.offer === "lifetime" ? "lifetime" : "processing"}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${input.cancelUrl}?checkout=cancelled`,
  };
}

export async function retrieveCatalogPrice(stripe: Stripe, priceId: string) {
  return stripe.prices.retrieve(priceId, { expand: ["product"] });
}

export async function createManagedCheckout(
  stripe: Stripe,
  input: Parameters<typeof buildManagedCheckoutParams>[0],
): Promise<Stripe.Checkout.Session> {
  return stripe.checkout.sessions.create(buildManagedCheckoutParams(input));
}

/**
 * Credito del periodo pagato non usato per chi passa al lifetime: un coupon da usare una sola
 * volta, soltanto sul prodotto lifetime ed entro la scadenza della sessione. Il nome compare
 * nel riepilogo di Stripe accanto allo sconto.
 */
export async function createLifetimeCredit(
  stripe: Stripe,
  input: { amount: number; product: string; redeemBy: string; workspaceId: string; name: string },
): Promise<Stripe.Coupon> {
  return stripe.coupons.create({
    amount_off: input.amount,
    currency: "eur",
    duration: "once",
    max_redemptions: 1,
    redeem_by: Math.floor(Date.parse(input.redeemBy) / 1000),
    applies_to: { products: [input.product] },
    name: input.name,
    metadata: { workspace_id: input.workspaceId, role: "lifetime_credit" },
  });
}

/** Una sessione che Stripe non ha aperto in Managed Payments non arriva mai al cliente. */
export async function expireCheckout(stripe: Stripe, sessionId: string) {
  await stripe.checkout.sessions.expire(sessionId);
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
