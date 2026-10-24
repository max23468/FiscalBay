import type Stripe from "stripe";

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
   * Acquisto durante la prova: prezzo una tantum pari al primo periodo, incassato subito, e
   * abbonamento senza addebito fino al primo rinnovo, dopo la prova residua e il periodo pagato.
   */
  prepaid?: { priceId: string; trialEndsAt: string; renewsAt: string; expiresAt?: Date };
}): Stripe.Checkout.SessionCreateParams {
  const { prepaid } = input;
  const metadata = {
    workspace_id: input.workspaceId,
    offer: input.offer,
    price_generation: input.generation,
    ...(prepaid ? { trial_ends_at: prepaid.trialEndsAt } : {}),
  };
  return {
    mode: input.offer === "lifetime" ? "payment" : "subscription",
    line_items: [
      { price: input.priceId, quantity: 1 },
      ...(prepaid ? [{ price: prepaid.priceId, quantity: 1 }] : []),
    ],
    managed_payments: { enabled: true },
    integration_identifier: integrationIdentifier,
    client_reference_id: input.workspaceId,
    customer_email: input.email,
    locale: input.language,
    metadata,
    // Il riferimento allo spazio resta anche sull'oggetto che sopravvive alla sessione.
    ...(input.offer === "lifetime"
      ? { payment_intent_data: { metadata } }
      : {
          subscription_data: {
            metadata,
            ...(prepaid ? { trial_end: Date.parse(prepaid.renewsAt) / 1000 } : {}),
          },
        }),
    ...(prepaid?.expiresAt ? { expires_at: Math.floor(prepaid.expiresAt.getTime() / 1000) } : {}),
    success_url: `${input.successUrl}?checkout=processing&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${input.cancelUrl}?checkout=cancelled`,
  };
}

/** Motivo per cui un prezzo non corrisponde al listino: soltanto un'etichetta fissa. */
export type CatalogMismatch =
  | "inactive"
  | "currency"
  | "amount"
  | "tax_behavior"
  | "billing_period"
  | "tax_code";

/**
 * Il prezzo configurato su Stripe deve essere quello del listino: attivo, in euro, netto con
 * le imposte aggiunte da Stripe, con la periodicità dell'offerta e un prodotto con codice
 * fiscale, senza il quale Managed Payments non copre la vendita. Il primo periodo pagato
 * durante la prova è un prezzo una tantum con l'importo dell'offerta (`oneTime`).
 */
export function catalogMismatch(
  price: Stripe.Price,
  offer: PremiumOffer,
  netCents: number,
  oneTime = offer === "lifetime",
): CatalogMismatch | null {
  const product = typeof price.product === "string" || price.product.deleted ? null : price.product;
  if (!price.active || !product?.active) return "inactive";
  if (price.currency !== "eur") return "currency";
  if (price.unit_amount !== netCents) return "amount";
  // Senza indicazione esplicita conterebbe l'impostazione dell'account, che può includerle.
  if (price.tax_behavior !== "exclusive") return "tax_behavior";
  const interval = oneTime ? null : offer === "monthly" ? "month" : "year";
  if (
    interval
      ? price.recurring?.interval !== interval || price.recurring.interval_count !== 1
      : price.type !== "one_time"
  )
    return "billing_period";
  if (!product.tax_code) return "tax_code";
  return null;
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
