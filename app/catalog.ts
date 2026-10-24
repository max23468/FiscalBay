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

/** Costo mensile dell'annuale, arrotondato per difetto al centesimo. */
export function annualMonthlyPrice(language: Language) {
  return formatPrice(Math.floor(priceGeneration.net.annual / 12), language);
}

/** Esito del ritorno da Stripe, soltanto per il messaggio: il diritto non dipende da esso. */
export function checkoutReturn(query: URLSearchParams) {
  const value = query.get("checkout");
  return value === "processing" || value === "cancelled" ? value : null;
}
