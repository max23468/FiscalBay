import { canonicalPath, localizedPath, type Language } from "./i18n";
import { premiumOffers, type PremiumOffer } from "./catalog";
import type { EbayEnvironment } from "./view-models";

export interface AppLinks {
  language: Language;
  /** Radice dell'area autenticata, senza prefisso di lingua. */
  base: string;
}

/** Percorso localizzato di una pagina dell'app. */
export function appHref({ language, base }: AppLinks, path = "") {
  return localizedPath(language, `${base}${path ? `/${path}` : ""}`);
}

/** Radice dell'area riservata: il resto del dominio è il sito pubblico. */
export const appBase = "/app";

/** Radice dell'anteprima: le sue pagine usano gli stessi componenti dell'area reale. */
export const previewBase = "/anteprima";

export const previewOrdersPath = `${previewBase}/ordini`;

export const previewStoresPath = `${previewBase}/negozi`;

/** Impostazioni dell'anteprima, con le stesse sezioni dell'area reale. */
export const previewSettingsPath = `${previewBase}/impostazioni`;

/** Accesso, registrazione e recupero, fuori dall'area riservata. */
export const accessPath = "/accesso";

/** Pagina pubblica dell'assistenza, con domande frequenti e contatti. */
export const supportPath = "/supporto";

/** Pagine del sito pubblico nella barra superiore, senza prefisso di lingua. */
export const featuresPath = "/funzionalita";
export const pricingPath = "/prezzi";
export const siteSecurityPath = "/sicurezza";
export const faqPath = "/faq";

/** Guide del sito: l'elenco e gli articoli, ciascuno con il proprio indirizzo stabile. */
export const guidesPath = "/guide";
export const guidePaths = [
  `${guidesPath}/trovare-codice-fiscale-ordini-ebay`,
  `${guidesPath}/codice-fiscale-non-visibile-ordine-ebay`,
  `${guidesPath}/chiedere-codice-fiscale-acquirente-ebay`,
  `${guidesPath}/codice-fiscale-fattura-elettronica-ebay`,
  `${guidesPath}/esportare-ordini-ebay-excel-csv`,
  `${guidesPath}/partita-iva-acquirente-ebay`,
  `${guidesPath}/alternativa-probay-codice-fiscale-ebay`,
] as const;
export type GuidePath = (typeof guidePaths)[number];

/** Documenti legali: pubblici ma `noindex` e fuori dalla sitemap (D204). */
export const termsPath = "/termini";
export const privacyPath = "/privacy";

/** Esito della conferma della cancellazione dell'account, fuori dall'area riservata. */
export const accountDeletionPath = "/cancellazione-account";

export const ordersPath = `${appBase}/ordini`;

/** Ricerca ordini della barra superiore: riceve la query nel corpo, mai nell'indirizzo. */
export const orderSearchPath = "/api/v1/orders/search";

/** File degli ordini: ambito nell'indirizzo, come la sezione Esportazione, e opzioni nel corpo. */
export const orderExportPath = "/api/v1/orders/export";

/** Download di un file esportato: passa dal Worker, che ricontrolla sessione e validità. */
export const exportFilePath = (id: string) => `/api/v1/exports/${id}`;

export const settingsPath = `${appBase}/impostazioni`;

/** Piano, fra le categorie delle Impostazioni: anche ritorno di checkout e portale Stripe. */
export const planPath = `${settingsPath}/piano`;

/**
 * Offerta scelta in Prezzi: segue la registrazione fino alla pagina Piano, che la mette in
 * evidenza. Non acquista nulla e un valore diverso da un'offerta si ignora.
 */
export const planChoiceParam = "piano";

export function planChoice(value: string | null | undefined): PremiumOffer | null {
  return (premiumOffers as readonly string[]).includes(value ?? "")
    ? (value as PremiumOffer)
    : null;
}

/** Notifiche, fra le categorie delle Impostazioni: collegamento e preferenze di Telegram. */
export const notificationSettingsPath = `${settingsPath}/notifiche`;

/**
 * Account, fra le categorie delle Impostazioni: dati personali, email, accessi e sessioni;
 * riceve anche le azioni di sicurezza.
 */
export const securityPath = `${settingsPath}/account`;

/** Supporto, fra le categorie delle Impostazioni: modulo di assistenza e Novità. */
export const supportSettingsPath = `${settingsPath}/supporto`;

/** Scelta della lingua dell'account; non ha prefisso perché la lingua arriva nel modulo. */
export const languagePath = `${appBase}/lingua`;

/** Letture della campanella. */
export const notificationsPath = "/api/v1/notifications";

/** Controllo delle password trapelate, chiesto dal browser prima dell'invio dei moduli. */
export const passwordCheckPath = "/api/v1/password-check";

/** Conferma dell'email con il codice, raggiunta soltanto dal modulo dell'app. */
export const emailCodeConfirmPath = "/email-otp/verify-email";

/** Percorsi del plugin dei codici che l'app non usa: la route di Auth li chiude. */
export const closedEmailCodePaths = [
  "/email-otp/send-verification-otp",
  "/email-otp/check-verification-otp",
  "/email-otp/request-password-reset",
  "/email-otp/reset-password",
  "/email-otp/request-email-change",
  "/email-otp/change-email",
  "/forget-password/email-otp",
  "/sign-in/email-otp",
];

/** Campo nascosto del modulo di accesso: la password usata risulta trapelata. */
export const leakedPasswordField = "password-trapelata";

/** Dati e privacy, da cui parte la cancellazione dell'account. */
export const privacySettingsPath = `${settingsPath}/privacy`;

/**
 * Solo la categoria Account con i gruppi di sicurezza e Dati e privacy, mai URL esterni o azioni
 * da rieseguire.
 */
export function securityReturnPath(language: Language, value: string | null): string | null {
  const base = localizedPath(language, securityPath);
  return [
    base,
    ...["email", "methods", "sessions"].map((group) => `${base}#security-${group}`),
    localizedPath(language, privacySettingsPath),
  ].includes(value ?? "")
    ? value
    : null;
}

export const storesPath = `${appBase}/negozi`;

/** Collegamento di un negozio eBay, dalla schermata preparatoria. */
export const storeLinkPath = `${appBase}/negozi/collega`;

/**
 * «Visita fiscalbay.it»: il parametro sulla radice diventa un cookie di sessione del browser
 * e viene tolto dall'indirizzo; `0` lo cancella ed entra nell'app.
 */
export const visitParam = "visita";
export const visitCookie = "fiscalbay_visita";

/** Host di Production, anche nella forma con `www.`: test e anteprime hanno altri host. */
const productionHosts = new Set(["fiscalbay.it", "www.fiscalbay.it"]);

/**
 * Origine di Production, riconosciuta dall'host: schema, porta, barra o punto finale non la
 * fanno passare per un ambiente di test.
 */
export function isProductionOrigin(origin: string): boolean {
  return productionHosts.has(new URL(origin).hostname.replace(/\.$/u, ""));
}

/** L'ambiente servito è Production: l'unico indicizzabile, senza anteprima né eventi di test. */
export function isProduction(environment: { APP_ORIGIN: string }): boolean {
  return isProductionOrigin(environment.APP_ORIGIN);
}

/** Indirizzo assoluto di un percorso già completo, sull'origine dell'ambiente servito. */
export function originUrl(env: { APP_ORIGIN: string }, path: string) {
  return `${new URL(env.APP_ORIGIN).origin}${path}`;
}

/**
 * Indirizzo assoluto di una pagina dell'app nella lingua data, per email, Stripe e Telegram,
 * con l'ambiente eBay se non è Production e gli eventuali filtri.
 */
export function appUrl(
  env: { APP_ORIGIN: string },
  language: Language,
  path: string,
  // Stryker disable next-line StringLiteral: l'indirizzo distingue soltanto «sandbox»; ogni altro predefinito dà lo stesso risultato.
  environment: EbayEnvironment = "production",
  filters: Record<string, string> = {},
) {
  const query = new URLSearchParams(filters);
  if (environment === "sandbox") query.set("environment", "sandbox");
  const search = query.size ? `?${query}` : "";
  return originUrl(env, `${localizedPath(language, path)}${search}`);
}

/** Pagine canoniche del sito pubblico, senza prefisso di lingua: le sole nella sitemap. */
export const sitemapPages = [
  "/",
  featuresPath,
  pricingPath,
  siteSecurityPath,
  faqPath,
  supportPath,
  guidesPath,
  ...guidePaths,
] as const;

/** Indicizzabile solo una pagina della sitemap servita dal dominio di produzione. */
export function indexable(origin: string, pathname: string) {
  const page = canonicalPath(pathname);
  return isProductionOrigin(origin) && (sitemapPages as readonly string[]).includes(page);
}
