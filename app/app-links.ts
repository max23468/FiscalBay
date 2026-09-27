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
