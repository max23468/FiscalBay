import type Stripe from "stripe";

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

/** Sblocchi di un ciclo Free fuori dalle promozioni, finché la console non ne fissa un'altra. */
export const baseFreeQuota = 5;

/**
 * Fine registrata di una promozione del Free senza data: dura finché la console non la termina.
 * Il database vuole una fine, quindi la promozione aperta ne ha una che nessun ciclo raggiunge;
 * chi la legge la riporta come assente.
 */
export const openPromotionEnd = "9999-12-31T23:59:59.999Z";

/**
 * Venti posti lifetime fra vendite e omaggi (D031). Il numero del posto è il vincolo atomico
 * del tetto: una prenotazione occupa il posto più basso libero prima del Checkout, la conferma
 * verificata di Stripe lo rende attivo e soltanto una sessione che non può più incassare lo
 * libera. Un posto attivo, anche rimborsato o di un account cancellato, non torna disponibile.
 */
export const lifetimeSlots = 20;

/** Periodicità del prezzo di un elemento dell'abbonamento; null per un prezzo non ricorrente. */
function itemOffer(item: Stripe.SubscriptionItem): "monthly" | "annual" | null {
  const interval = item.price.recurring?.interval;
  return interval === "year" ? "annual" : interval === "month" ? "monthly" : null;
}

/**
 * Periodicità del periodo pagato e del prossimo rinnovo. Il prezzo dell'abbonamento è quello
 * del rinnovo; finché il periodo pagato non è concluso (`trialing`, per un acquisto durante la
 * prova o un cambio programmato) vale quella dei metadati, scritta all'acquisto e al cambio.
 */
export function subscriptionOffers(subscription: Stripe.Subscription, metadataOffer: string) {
  const item = subscription.items.data[0];
  const renewal = (item && itemOffer(item)) ?? (metadataOffer as "monthly" | "annual");
  return {
    offer: subscription.status === "trialing" ? (metadataOffer as "monthly" | "annual") : renewal,
    renewal,
  };
}

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
