import { env } from "cloudflare:workers";
import { redirect } from "react-router";

import { createAuth } from "../auth.server";
import { errorResponse } from "../errors";
import { languageFromPath, localizedPath } from "../i18n";
import { startStoreLink } from "../integrations/ebay/store-link.server";
import type { Route } from "./+types/store-link";

export async function action({ request }: Route.ActionArgs) {
  const base = localizedPath(languageFromPath(new URL(request.url).pathname));
  if (request.headers.get("origin") !== new URL(env.APP_ORIGIN).origin) {
    return errorResponse(request, "FORBIDDEN");
  }
  const session = await createAuth(env).api.getSession({ headers: request.headers });
  if (!session?.user.emailVerified) return redirect(`${base}?negozio=accesso`, 303);
  return redirect(
    await startStoreLink(
      env,
      session.user.id,
      new Date(),
      languageFromPath(new URL(request.url).pathname),
    ),
    {
      status: 303,
      headers: { "cache-control": "no-store" },
    },
  );
}
