import { env } from "cloudflare:workers";
import { redirect } from "react-router";

import { assertSameOrigin, requireAccountArea } from "../account-area.server";
import { appBase, ordersPath } from "../app-links";
import { parsePreference, savePreference } from "../domain/preferences.server";
import { errorResponse } from "../error-response";
import { localizedPath } from "../i18n";
import type { Route } from "./+types/language";

/** Il percorso riceve soltanto la scelta della lingua: una lettura non ha contenuto. */
export function loader() {
  return new Response(null, { status: 405, headers: { allow: "POST" } });
}

/**
 * Lingua dell'account: la scelta resta per le pagine successive e per i nuovi accessi, poi la
 * pagina di partenza si riapre nella nuova lingua. Si torna soltanto a una pagina dell'area.
 */
export async function action({ request }: Route.ActionArgs) {
  assertSameOrigin(request);
  const { session } = await requireAccountArea(request, { unverified: true });
  const form = await request.formData();
  const change = parsePreference("language", String(form.get("language") ?? ""));
  if (change?.name !== "language") return errorResponse(request, "INVALID_REQUEST");
  await savePreference(env.DB, session.user.id, change);
  const target = new URL(String(form.get("returnTo") ?? ""), env.APP_ORIGIN);
  const bare = target.pathname.replace(/^\/en(?=\/|$)/u, "");
  const inArea =
    target.origin === new URL(env.APP_ORIGIN).origin &&
    (bare === appBase || bare.startsWith(`${appBase}/`));
  return redirect(
    inArea
      ? `${localizedPath(change.value, bare)}${target.search}`
      : localizedPath(change.value, ordersPath),
    303,
  );
}
