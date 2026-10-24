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

/** Indirizzo dell'assistenza clienti, mostrato e usato come risposta delle email. */
export const supportEmail = "supporto@fiscalbay.it";

/** Titolo della scheda del browser: marchio e pagina, separati da ` | `. */
export const pageTitle = (title: string) => `FiscalBay | ${title}`;
