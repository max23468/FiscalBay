import { env } from "cloudflare:workers";
import { redirect } from "react-router";

import { assertSameOrigin, requireAccountArea } from "../account-area.server";
import { appBase, ordersPath } from "../app-links";
import { parsePreference, savePreference } from "../domain/preferences.server";
import { errorResponse, postOnly } from "../error-response";
import { canonicalPath, localizedPath } from "../i18n";
import type { Route } from "./+types/language";

export const loader = postOnly;

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
  // Un indirizzo di ritorno illeggibile porta agli Ordini, come uno fuori dall'area.
  const target = URL.parse(String(form.get("returnTo") ?? ""), env.APP_ORIGIN);
  const bare = target ? canonicalPath(target.pathname) : "";
  const inArea =
    target?.origin === new URL(env.APP_ORIGIN).origin &&
    (bare === appBase || bare.startsWith(`${appBase}/`));
  return redirect(
    target && inArea
      ? `${localizedPath(change.value, bare)}${target.search}`
      : localizedPath(change.value, ordersPath),
    303,
  );
}
