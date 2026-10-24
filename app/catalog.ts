import type { Language } from "./i18n";

/** Modalità commerciali dell'unico livello Premium. */
export const premiumOffers = ["monthly", "annual", "lifetime"] as const;

export type PremiumOffer = (typeof premiumOffers)[number];

/**
 * Acquisto dalla pagina del piano: possibile, in attesa della prima lettura riuscita di un
 * negozio, oppure fermo per una copertura già in corso.
 */
export type PurchaseState = "available" | "needs-sync" | "covered";

/**
 * Listino canonico in centesimi di euro, IVA e imposte escluse. Una nuova generazione di
 * prezzi si aggiunge accanto a questa: gli abbonamenti continuano con il listino con cui sono
 * nati, riconoscibile dalla generazione salvata nei metadati del checkout.
 */
export const priceGeneration = {
  id: "2026-09",
  net: { monthly: 490, annual: 4900, lifetime: 14900 },
} as const satisfies { id: string; net: Record<PremiumOffer, number> };

/** Prezzo netto in euro, senza decimali quando è intero. */
export function formatPrice(cents: number, language: Language) {
  return new Intl.NumberFormat(language === "it" ? "it-IT" : "en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

/** Mesi di mensile che costa l'annuale: il listino ne regala due su dodici. */
export function annualPaidMonths() {
  return priceGeneration.net.annual / priceGeneration.net.monthly;
}

/** Il Checkout di Stripe accetta una prova che finisce almeno due giorni dopo l'apertura. */
const minimumCheckoutTrial = 2 * 24 * 60 * 60 * 1000 + 10 * 60 * 1000;

/**
 * Primo addebito di un acquisto durante la prova: alla fine della prova, oppure due giorni
 * dopo l'acquisto quando ne manca meno, perché Stripe non accetta una prova più breve. Il
 * cliente non perde giorni e può riceverne al massimo un paio in più. Il risultato sale al
 * secondo intero, la precisione delle date di Stripe.
 */
export function firstChargeAt(trialEndsAt: string, now: string | Date) {
  const at = Math.max(Date.parse(trialEndsAt), new Date(now).getTime() + minimumCheckoutTrial);
  return new Date(Math.ceil(at / 1000) * 1000).toISOString();
}

/** Esito del ritorno da Stripe, soltanto per il messaggio: il diritto non dipende da esso. */
export function checkoutReturn(query: URLSearchParams) {
  const value = query.get("checkout");
  return value === "processing" || value === "cancelled" ? value : null;
}
