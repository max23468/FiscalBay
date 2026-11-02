import { env } from "cloudflare:workers";

import { assertSameOrigin, requireAccountArea } from "../account-area.server";
import { markNotificationsRead, parseNotificationIds } from "../domain/notification-reads.server";
import { errorResponse, postOnly } from "../error-response";
import type { Route } from "./+types/notifications";

export const loader = postOnly;

/** Notifiche della campanella lette o segnate tutte come lette, per l'utente della sessione. */
export async function action({ request }: Route.ActionArgs) {
  assertSameOrigin(request);
  const { session } = await requireAccountArea(request);
  const ids = parseNotificationIds(String((await request.formData()).get("ids") ?? ""));
  if (!ids) return errorResponse(request, "INVALID_REQUEST");
  await markNotificationsRead(env.DB, session.user.id, ids);
  return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } });
}
