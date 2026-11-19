import { env } from "cloudflare:workers";

import { assertSameOrigin, requireAccountArea, unreadNotifications } from "../account-area.server";
import {
  dismissNotifications,
  markNotificationsRead,
  parseNotificationIds,
  restoreNotifications,
} from "../domain/notification-reads.server";
import { errorResponse } from "../error-response";
import type { Route } from "./+types/notifications";

/**
 * Numero delle notifiche da leggere, per il badge dell'app installata aggiornato dal service
 * worker. Senza sessione valida risponde 401 invece di portare all'accesso: il worker toglie il
 * badge.
 */
export async function loader({ request }: Route.LoaderArgs) {
  const unread = await unreadNotifications(request);
  const headers = { "cache-control": "no-store" };
  return unread === null
    ? Response.json({ unread: 0 }, { status: 401, headers })
    : Response.json({ unread }, { headers });
}

const changes = {
  read: markNotificationsRead,
  dismiss: dismissNotifications,
  restore: restoreNotifications,
};

/**
 * Notifiche della campanella lette, eliminate o ripristinate dopo un'eliminazione, per l'utente
 * della sessione; senza `intent` la richiesta è una lettura.
 */
export async function action({ request }: Route.ActionArgs) {
  assertSameOrigin(request);
  const { session } = await requireAccountArea(request);
  const form = await request.formData();
  const ids = parseNotificationIds(String(form.get("ids") ?? ""));
  const intent = String(form.get("intent") ?? "read");
  if (!ids || !Object.hasOwn(changes, intent)) return errorResponse(request, "INVALID_REQUEST");
  await changes[intent as keyof typeof changes](env.DB, session.user.id, ids);
  return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } });
}
