import type { Language } from "./i18n";

/** Modalità commerciali dell'unico livello Premium. */
export const premiumOffers = ["monthly", "annual", "lifetime"] as const;

export type PremiumOffer = (typeof premiumOffers)[number];

/**
 * Acquisto dalla pagina del piano: possibile, in attesa della prima lettura riuscita di un
 * negozio, fermo per una copertura già in corso oppure sospeso senza capacità per nuovi
 * Premium.
 */
export type PurchaseState = "available" | "needs-sync" | "covered" | "closed";

/**
 * Offerta lifetime per la pagina del piano: in vendita, esaurita, in attesa della prima
 * lettura o sospesa come gli altri acquisti. `credit` è il periodo pagato non usato, in centesimi, che si detrae dal prezzo;
 * `replaces` indica un abbonamento che con il lifetime si chiude.
 */
export type LifetimeOffer = {
  state: "available" | "needs-sync" | "sold-out" | "closed";
  credit: number;
  replaces: boolean;
};

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
 * Primo addebito di un acquisto durante la prova: alla fine della prova, al secondo intero
 * come le date di Stripe. Null quando ne mancano meno di due giorni, perché il Checkout non
 * accetta una prova più breve: allora il primo addebito è subito e il periodo pagato parte
 * dall'acquisto, senza interrompere Premium.
 */
export function firstChargeAt(trialEndsAt: string, now: string | Date) {
  const at = Math.ceil(Date.parse(trialEndsAt) / 1000) * 1000;
  return at < new Date(now).getTime() + minimumCheckoutTrial ? null : new Date(at).toISOString();
}

/**
 * Esito del ritorno da Stripe, soltanto per il messaggio: il diritto non dipende da esso. Il
 * lifetime ha un ritorno proprio, perché si paga subito anche durante la prova.
 */
export function checkoutReturn(query: URLSearchParams) {
  const value = query.get("checkout");
  return value === "processing" || value === "lifetime" || value === "cancelled" ? value : null;
}
