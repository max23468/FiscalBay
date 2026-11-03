import { env } from "cloudflare:workers";

import { isSameOrigin } from "../account-area.server";
import { postOnly } from "../error-response";
import { limitedHeaders, requestLimitWait } from "../request-limits.server";
import type { Route } from "./+types/password-check";

export const loader = postOnly;

/**
 * Esito del controllo delle password trapelate di Cloudflare: con il rilevamento attivo sulla
 * zona, l'edge confronta la password del corpo JSON con le credenziali di violazioni note e
 * aggiunge `Exposed-Credential-Check` (1 coppia nota, 4 password nota). Il Worker non legge il
 * corpo e non conserva nulla; senza l'header, in locale o con il rilevamento spento, la password
 * risulta non trapelata.
 */
export async function action({ request }: Route.ActionArgs) {
  if (!isSameOrigin(request)) return new Response(null, { status: 403 });
  const wait = await requestLimitWait(env, request, "attempts", "password-check");
  if (wait !== null) return new Response(null, { status: 429, headers: limitedHeaders(wait) });
  const check = request.headers.get("exposed-credential-check");
  return Response.json(
    { leaked: check === "1" || check === "4" },
    { headers: { "cache-control": "no-store" } },
  );
}
