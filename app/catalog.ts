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

/** Offerte con rinnovo, le sole che si possono pagare in anticipo durante la prova. */
export type RecurringOffer = Exclude<PremiumOffer, "lifetime">;

/**
 * Fine di un periodo pagato che parte da `start`: mesi di calendario sull'istante UTC, come
 * li conta Stripe. Senza lo stesso giorno nel mese di arrivo vale l'ultimo: il 31 gennaio più
 * un mese è il 28 o il 29 febbraio, il 29 febbraio più un anno è il 28 febbraio. Il risultato
 * sale al secondo intero, la precisione delle date di Stripe.
 *
 * Durante la prova l'incasso è immediato e il periodo pagato parte dalla fine originale della
 * prova: questa ne è la fine e il primo rinnovo, senza un addebito alla fine della prova.
 */
export function paidPeriodEnd(start: string, offer: RecurringOffer) {
  const from = new Date(start);
  const month = from.getUTCMonth() + (offer === "monthly" ? 1 : 12);
  const lastDay = new Date(Date.UTC(from.getUTCFullYear(), month + 1, 0)).getUTCDate();
  const end = Date.UTC(
    from.getUTCFullYear(),
    month,
    Math.min(from.getUTCDate(), lastDay),
    from.getUTCHours(),
    from.getUTCMinutes(),
    from.getUTCSeconds(),
    from.getUTCMilliseconds(),
  );
  return new Date(Math.ceil(end / 1000) * 1000).toISOString();
}

/** Esito del ritorno da Stripe, soltanto per il messaggio: il diritto non dipende da esso. */
export function checkoutReturn(query: URLSearchParams) {
  const value = query.get("checkout");
  return value === "processing" || value === "cancelled" ? value : null;
}
