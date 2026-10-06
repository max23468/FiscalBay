import { localizedPath, type Language } from "./i18n";

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

export const ordersPath = `${appBase}/ordini`;

/** Pagina reale di Sicurezza; le Impostazioni complete la ospiteranno fra le categorie. */
export const securityPath = `${appBase}/impostazioni/sicurezza`;

/** Collegamento di un negozio eBay, dalla schermata preparatoria. */
export const storeLinkPath = `${appBase}/negozi/collega`;

/**
 * «Visita fiscalbay.it»: il parametro sulla radice diventa un cookie di sessione del browser
 * e viene tolto dall'indirizzo; `0` lo cancella ed entra nell'app.
 */
export const visitParam = "visita";
export const visitCookie = "fiscalbay_visita";

/** Il solo dominio indicizzabile; test e anteprime restano fuori dai motori di ricerca. */
export const productionOrigin = "https://fiscalbay.it";

/** Pagine del sito pubblico, senza prefisso di lingua. */
const publicPages = new Set(["/", "/termini", "/privacy"]);

/** Indicizzabile solo una pagina pubblica servita dal dominio di produzione. */
export function indexable(origin: string, pathname: string) {
  return (
    new URL(origin).origin === productionOrigin &&
    publicPages.has(pathname.replace(/^\/en(?=\/|$)/u, "") || "/")
  );
}
