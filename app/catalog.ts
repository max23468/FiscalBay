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
 * Acquisto possibile dopo la prima lettura riuscita di un negozio, se nessuna copertura lo
 * ferma e gli acquisti non sono sospesi. Regola comune all'area reale e all'anteprima.
 */
export function purchaseStateFrom({
  covered,
  open,
  synced,
}: {
  covered: boolean;
  open: boolean;
  synced: boolean;
}): PurchaseState {
  return covered ? "covered" : !open ? "closed" : synced ? "available" : "needs-sync";
}

/**
 * Offerta lifetime per la pagina del piano: in vendita, esaurita, in attesa della prima
 * lettura o sospesa come gli altri acquisti. `credit` è il periodo pagato non usato, in centesimi, che si detrae dal prezzo;
 * `replaces` indica un abbonamento che con il lifetime si chiude; `seats` i posti ancora liberi
 * sul totale, come sul sito.
 */
export type LifetimeOffer = {
  state: "available" | "needs-sync" | "sold-out" | "closed";
  credit: number;
  replaces: boolean;
  seats: { left: number; total: number };
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

/** Variabile del Worker con il prezzo Stripe di ogni offerta. */
export const priceVariable = {
  monthly: "STRIPE_PRICE_MONTHLY",
  annual: "STRIPE_PRICE_ANNUAL",
  lifetime: "STRIPE_PRICE_LIFETIME",
} as const satisfies Record<PremiumOffer, keyof Env>;

/**
 * Prezzo netto in euro, senza decimali quando è intero. Locali e raggruppamento sono quelli di
 * `locales` e `formatAmount` in `i18n.ts`, ripetuti qui: `scripts/stripe-account.mjs` carica
 * questo modulo con Node, che non risolve gli import senza estensione di `i18n.ts`.
 */
export function formatPrice(cents: number, language: Language) {
  return new Intl.NumberFormat(language === "it" ? "it-IT" : "en-GB", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    useGrouping: "always",
  }).format(cents / 100);
}

/**
 * Totale con l'IVA italiana ordinaria, mostrato accanto al netto sul sito. Stripe calcola
 * l'imposta effettiva del paese dell'acquirente; qui l'imposta della riga si arrotonda al
 * centesimo come nelle sue fatture.
 */
export function italianGross(cents: number) {
  return cents + Math.round(cents * 0.22);
}

/** Mesi di mensile che costa l'annuale: il listino ne regala due su dodici. */
export function annualPaidMonths() {
  return priceGeneration.net.annual / priceGeneration.net.monthly;
}

/**
 * Il Checkout di Stripe accetta una prova che finisce almeno due giorni dopo l'apertura. Durata
 * in linea: `scripts/stripe-account.mjs` carica questo modulo con Node, senza bundler.
 */
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
