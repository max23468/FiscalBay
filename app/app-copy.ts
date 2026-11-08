import { languageFromPath, type Language } from "./i18n";
import { it, type AppCopy } from "./copy/copy-it";
import { en } from "./copy/copy-en";

export type { AppCopy };

/**
 * Testi dell'interfaccia per lingua. Il server ha entrambe le lingue; il browser scarica
 * soltanto quella della pagina, prima dell'idratazione e prima di una navigazione che la
 * cambia: gli import statici qui sopra restano nel solo bundle del server.
 */
const copies: Partial<Record<Language, AppCopy>> = import.meta.env.SSR ? { it, en } : {};

function loaded(language: Language): AppCopy {
  const copy = copies[language];
  if (!copy) throw new Error(`Testi non caricati: ${language}`);
  return copy;
}

export const appCopy: Record<Language, AppCopy> = {
  get it() {
    return loaded("it");
  },
  get en() {
    return loaded("en");
  },
};

/** Carica nel browser i testi della lingua di un percorso; sul server sono già presenti. */
export async function loadCopy(path: string): Promise<void> {
  const language = languageFromPath(path);
  copies[language] ??=
    language === "it" ? (await import("./copy/copy-it")).it : (await import("./copy/copy-en")).en;
}

/**
 * Moduli JavaScript dei testi di ogni lingua, che il documento precarica perché il browser li
 * attende prima di idratare la pagina. I nomi con l'hash nascono dalla build del client: il plugin
 * `preloadCopyModules` di `vite.config.ts` sostituisce questo valore nel bundle del server. In
 * sviluppo e nelle prove resta vuoto.
 */
export const copyModules: Record<Language, readonly string[]> = { it: [], en: [] };

/** Indirizzo dell'assistenza clienti, mostrato e usato come risposta delle email. */
export const supportEmail = "supporto@fiscalbay.it";

/** Indirizzo per privacy, sicurezza e ogni contatto che non è assistenza clienti. */
export const infoEmail = "info@fiscalbay.it";

/**
 * Titolo della scheda del browser: prima la pagina, poi il marchio, separati da ` | `. Nei
 * risultati di ricerca e fra molte schede aperte resta visibile la parte che distingue la pagina.
 */
export const pageTitle = (title: string) => `${title} | FiscalBay`;
