import { createContext, use } from "react";

import { appCopy } from "../app-copy";
import { appBase, type AppLinks } from "../app-links";

const LinksContext = createContext<AppLinks>({ language: "it", base: appBase });

/** Lingua e radice delle pagine dell'app: area reale o anteprima, secondo l'indirizzo. */
export const LinksProvider = LinksContext;

/** Testi e lingua della pagina corrente. */
export function useCopy() {
  const { language } = use(LinksContext);
  return { t: appCopy[language], language };
}

/** Collegamenti dell'app; nell'anteprima le azioni sono simulate dalle sue route. */
export function useLinks() {
  const links = use(LinksContext);
  return { links, preview: links.base !== appBase };
}
