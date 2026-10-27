import { localizedPath, type Language } from "./i18n";
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

/** Accesso, registrazione e recupero, fuori dall'area riservata. */
export const accessPath = "/accesso";

/** Pagina pubblica dell'assistenza, con domande frequenti e contatti. */
export const supportPath = "/supporto";

export const ordersPath = `${appBase}/ordini`;

/** Ricerca ordini della barra superiore: riceve la query nel corpo, mai nell'indirizzo. */
export const orderSearchPath = "/api/v1/orders/search";

/** File degli ordini: ambito nell'indirizzo, come la sezione Esportazione, e opzioni nel corpo. */
export const orderExportPath = "/api/v1/orders/export";

export const settingsPath = `${appBase}/impostazioni`;

/** Piano, fra le categorie delle Impostazioni: anche ritorno di checkout e portale Stripe. */
export const planPath = `${settingsPath}/piano`;

/** Notifiche, fra le categorie delle Impostazioni: collegamento e preferenze di Telegram. */
export const notificationSettingsPath = `${settingsPath}/notifiche`;

/** Sicurezza, fra le categorie delle Impostazioni: riceve anche le sue azioni. */
export const securityPath = `${settingsPath}/sicurezza`;

/** Supporto, fra le categorie delle Impostazioni: modulo di assistenza e Novità. */
export const supportSettingsPath = `${settingsPath}/supporto`;

/** Scelta della lingua dell'account; non ha prefisso perché la lingua arriva nel modulo. */
export const languagePath = `${appBase}/lingua`;

/** Letture della campanella. */
export const notificationsPath = "/api/v1/notifications";

/** Solo la pagina Sicurezza e i suoi gruppi, mai URL esterni o azioni da rieseguire. */
export function securityReturnPath(language: Language, value: string | null): string | null {
  const base = localizedPath(language, securityPath);
  return [
    base,
    ...["email", "methods", "sessions"].map((group) => `${base}#security-${group}`),
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

/** Pagine del sito pubblico, senza prefisso di lingua. */
const publicPages = new Set(["/", "/termini", "/privacy", "/supporto"]);

/** Indicizzabile solo una pagina pubblica servita dal dominio di produzione. */
export function indexable(origin: string, pathname: string) {
  return (
    isProductionOrigin(origin) && publicPages.has(pathname.replace(/^\/en(?=\/|$)/u, "") || "/")
  );
}
