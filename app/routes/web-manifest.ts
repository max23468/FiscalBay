import { languageFromPath } from "../i18n";
import { webManifest } from "../web-manifest.server";
import type { Route } from "./+types/web-manifest";

/**
 * Manifest dell'app installabile nella lingua dell'indirizzo. Il browser lo rilegge per scoprire
 * nomi e icone aggiornati: un giorno di cache basta.
 */
export function loader({ request }: Route.LoaderArgs) {
  const language = languageFromPath(new URL(request.url).pathname);
  return new Response(JSON.stringify(webManifest(language)), {
    headers: {
      "content-type": "application/manifest+json; charset=utf-8",
      "cache-control": "public, max-age=86400",
    },
  });
}
