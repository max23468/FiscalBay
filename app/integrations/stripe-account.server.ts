import type Stripe from "stripe";

import type { PremiumOffer } from "../catalog";
import { planPath } from "../app-links";

/**
 * Configurazione attesa dell'account Stripe di ogni ambiente: la usano il checkout, che verifica
 * il prezzo prima della vendita, e `scripts/stripe-account.mjs`, che rilegge e allinea l'account.
 * Il modulo importa soltanto tipi, così lo script lo carica con Node senza bundler.
 */

/** Eventi dell'endpoint `/webhooks/stripe`: il consumer rilegge l'oggetto di ciascuno. */
export const stripeWebhookEvents = [
  "checkout.session.completed",
  "checkout.session.expired",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "invoice.paid",
  "invoice.payment_failed",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "charge.refunded",
  "charge.refund.updated",
  "charge.dispute.created",
  "charge.dispute.closed",
  "customer.deleted",
] as const satisfies readonly Stripe.WebhookEndpointCreateParams.EnabledEvent[];

/**
 * Profilo pubblico dell'account: nome mostrato da Checkout, ricevute e portale, sito e indirizzo
 * dell'assistenza, al quale Stripe manda le richieste dell'assistenza Link con il termine di 48
 * ore. Il nome della sandbox la dichiara di prova.
 */
export function stripeAccountProfile(live: boolean, origin: string) {
  return {
    name: live ? "FiscalBay" : "FiscalBay Sandbox",
    url: origin,
    supportEmail: "supporto@fiscalbay.it",
  };
}

/**
 * Portale clienti: disdetta a fine periodo senza conguaglio, nessun cambio di piano immediato
 * (la periodicità cambia alla scadenza dalla pagina del piano), metodo di pagamento e documenti,
 * termini, privacy e ritorno dell'ambiente.
 */
export function stripePortalConfiguration(origin: string) {
  return {
    business_profile: {
      privacy_policy_url: `${origin}/privacy`,
      terms_of_service_url: `${origin}/termini`,
    },
    default_return_url: `${origin}${planPath}`,
    features: {
      customer_update: { enabled: true, allowed_updates: ["name", "email", "address"] },
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: {
        enabled: true,
        mode: "at_period_end",
        proration_behavior: "none",
        cancellation_reason: {
          enabled: true,
          options: ["too_expensive", "switched_service", "unused", "other"],
        },
      },
      subscription_update: { enabled: false },
    },
  } satisfies Stripe.BillingPortal.ConfigurationUpdateParams;
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
 * fiscale, senza il quale Managed Payments non copre la vendita.
 */
export function catalogMismatch(
  price: Stripe.Price,
  offer: PremiumOffer,
  netCents: number,
): CatalogMismatch | null {
  // Stryker disable next-line LogicalOperator,ConditionalExpression,StringLiteral: un prodotto non espanso o eliminato non ha `active` e risulta comunque non attivo.
  const product = typeof price.product === "string" || price.product.deleted ? null : price.product;
  if (!price.active || !product?.active) return "inactive";
  if (price.currency !== "eur") return "currency";
  if (price.unit_amount !== netCents) return "amount";
  // Senza indicazione esplicita conterebbe l'impostazione dell'account, che può includerle.
  if (price.tax_behavior !== "exclusive") return "tax_behavior";
  const interval = offer === "monthly" ? "month" : offer === "annual" ? "year" : null;
  if (
    interval
      ? price.recurring?.interval !== interval || price.recurring.interval_count !== 1
      : price.type !== "one_time"
  )
    return "billing_period";
  if (!product.tax_code) return "tax_code";
  return null;
}
