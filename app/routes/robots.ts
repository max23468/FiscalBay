import { env } from "cloudflare:workers";

import { productionOrigin } from "../app-links";

// Indicazione per i motori di ricerca, non un controllo d'accesso: l'area riservata richiede
// comunque la sessione e ogni risposta non pubblica porta `x-robots-tag: noindex`.
const privatePaths = ["/app", "/accesso", "/admin", "/api/", "/auth/", "/anteprima"];

export function loader() {
  const rules =
    new URL(env.APP_ORIGIN).origin === productionOrigin
      ? privatePaths.flatMap((path) => [`Disallow: ${path}`, `Disallow: /en${path}`])
      : ["Disallow: /"];
  return new Response(`User-agent: *\n${rules.join("\n")}\n`, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}
