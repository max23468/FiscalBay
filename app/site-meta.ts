import type { MetaDescriptor } from "react-router";

import { pageTitle } from "./app-copy";
import { languages, localizedPath, type Language } from "./i18n";

const ogLocales: Record<Language, string> = { it: "it_IT", en: "en_GB" };

/** Immagine delle condivisioni, 1200×630, una per lingua. */
const ogImage = (language: Language) => `/og/fiscalbay-${language}.png`;

/**
 * Metadati di una pagina pubblica: titolo, descrizione, canonical sulla lingua servita,
 * alternate per ogni lingua con l'italiano come `x-default`, Open Graph e scheda Twitter.
 * `path` è il percorso senza prefisso di lingua.
 */
export function siteMeta({
  language,
  origin,
  path,
  title,
  description,
}: {
  language: Language;
  origin: string;
  path: string;
  title: string;
  description: string;
}): MetaDescriptor[] {
  const url = `${origin}${localizedPath(language, path)}`;
  const fullTitle = pageTitle(title);
  return [
    { title: fullTitle },
    { name: "description", content: description },
    { tagName: "link", rel: "canonical", href: url },
    ...languages.map((code) => ({
      tagName: "link",
      rel: "alternate",
      hrefLang: code,
      href: `${origin}${localizedPath(code, path)}`,
    })),
    { tagName: "link", rel: "alternate", hrefLang: "x-default", href: `${origin}${path}` },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: "FiscalBay" },
    { property: "og:locale", content: ogLocales[language] },
    ...languages
      .filter((code) => code !== language)
      .map((code) => ({ property: "og:locale:alternate", content: ogLocales[code] })),
    { property: "og:title", content: fullTitle },
    { property: "og:description", content: description },
    { property: "og:url", content: url },
    { property: "og:image", content: `${origin}${ogImage(language)}` },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { name: "twitter:card", content: "summary_large_image" },
  ];
}
