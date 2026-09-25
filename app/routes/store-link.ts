import { env } from "cloudflare:workers";
import { redirect } from "react-router";

import { createAuth } from "../auth.server";
import { startStoreLink } from "../integrations/ebay/store-link.server";
import type { Route } from "./+types/store-link";

export async function action({ request }: Route.ActionArgs) {
  if (request.headers.get("origin") !== new URL(env.APP_ORIGIN).origin) {
    return new Response(null, { status: 403 });
  }
  const session = await createAuth(env).api.getSession({ headers: request.headers });
  if (!session?.user.emailVerified) return redirect("/?negozio=accesso", 303);
  return redirect(await startStoreLink(env, session.user.id), {
    status: 303,
    headers: { "cache-control": "no-store" },
  });
}
