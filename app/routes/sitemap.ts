import { env } from "cloudflare:workers";

import { guidePaths, sitemapPages } from "../app-links";
import { guides } from "../copy/guides.server";
import { languages, localizedPath } from "../i18n";

/**
 * Giorno dell'ultima modifica sostanziale del contenuto di ogni pagina, per `lastmod`: si
 * aggiorna con il testo della pagina, non a ogni rilascio. Le guide portano la propria data.
 */
const pageUpdates: Record<(typeof sitemapPages)[number], string> = {
  "/": "2026-11-03",
  "/funzionalita": "2026-11-03",
  "/prezzi": "2026-11-03",
  "/sicurezza": "2026-11-03",
  "/faq": "2026-11-03",
  "/supporto": "2026-11-03",
  "/guide": "2026-11-04",
  ...Object.fromEntries(guidePaths.map((path) => [path, guides.it.articles[path].updated])),
} as Record<(typeof sitemapPages)[number], string>;

/**
 * Sitemap delle sole pagine pubbliche canoniche, in ogni lingua con le alternate: Termini e
 * Privacy restano fuori perché `noindex` (D204). Fuori dalla produzione le pagine elencate
 * rispondono comunque `noindex` e robots.txt chiude il dominio.
 */
export function sitemap(origin: string) {
  const alternates = (path: string) =>
    [...languages, "x-default" as const]
      .map((code) => {
        const href = `${origin}${code === "x-default" ? path : localizedPath(code, path)}`;
        return `<xhtml:link rel="alternate" hreflang="${code}" href="${href}"/>`;
      })
      .join("");
  const urls = sitemapPages.flatMap((path) =>
    languages.map(
      (language) =>
        `<url><loc>${origin}${localizedPath(language, path)}</loc><lastmod>${pageUpdates[path]}</lastmod>${alternates(path)}</url>`,
    ),
  );
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join("\n")}\n</urlset>\n`;
}

export function loader() {
  return new Response(sitemap(new URL(env.APP_ORIGIN).origin), {
    headers: { "content-type": "application/xml; charset=utf-8" },
  });
}
