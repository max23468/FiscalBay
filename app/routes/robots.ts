import { env } from "cloudflare:workers";

import { isProductionOrigin } from "../app-links";

// Indicazione per i motori di ricerca, non un controllo d'accesso: l'area riservata richiede
// comunque la sessione e ogni risposta non pubblica porta `x-robots-tag: noindex`. Termini e
// Privacy restano raggiungibili: il loro `noindex` arriva dall'header, non da un `Disallow`.
const privatePaths = ["/app", "/accesso", "/admin", "/api/", "/auth/", "/anteprima"];

export function robots(origin: string) {
  if (!isProductionOrigin(origin)) return "User-agent: *\nDisallow: /\n";
  const rules = privatePaths.flatMap((path) => [`Disallow: ${path}`, `Disallow: /en${path}`]);
  return `User-agent: *\n${rules.join("\n")}\n\nSitemap: ${new URL(origin).origin}/sitemap.xml\n`;
}

export function loader() {
  return new Response(robots(env.APP_ORIGIN), {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}
