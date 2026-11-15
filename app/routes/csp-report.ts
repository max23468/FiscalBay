import { env } from "cloudflare:workers";

import { cspViolations, logCspViolations } from "../csp-report.server";
import { postOnly } from "../error-response";
import { readBounded } from "../integrations/http.server";
import { limitedHeaders, requestLimitWait } from "../request-limits.server";
import type { Route } from "./+types/csp-report";

/** Un lotto del browser con le policy complete resta entro pochi kilobyte. */
const maxBytes = 16 * 1024;

export const loader = postOnly;

/**
 * Segnalazioni delle violazioni della CSP e di Trusted Types inviate dal browser: filtro per IP,
 * corpo limitato, soli documenti dell'origine e campi ridotti nei log del Worker. Nessuna
 * scrittura su D1; un corpo non valido non lascia traccia.
 */
export async function action({ request }: Route.ActionArgs) {
  const wait = await requestLimitWait(env, request, "reports", "csp-report");
  if (wait !== null) {
    await request.body?.cancel();
    return new Response(null, { status: 429, headers: limitedHeaders(wait) });
  }
  const body = await readBounded(request, maxBytes);
  if (!body) return new Response(null, { status: 413 });
  let payload: unknown;
  try {
    payload = JSON.parse(new TextDecoder().decode(body));
  } catch {
    return new Response(null, { status: 400 });
  }
  logCspViolations(cspViolations(payload, new URL(env.APP_ORIGIN).origin));
  return new Response(null, { status: 204 });
}
