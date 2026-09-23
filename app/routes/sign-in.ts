import { env } from "cloudflare:workers";
import { redirect } from "react-router";

import { createAuth } from "../auth.server";
import type { Route } from "./+types/sign-in";

function withCookies(location: string, response: Response): Response {
  const headers = new Headers({ "cache-control": "no-store" });
  for (const cookie of response.headers.getSetCookie()) headers.append("set-cookie", cookie);
  return redirect(location, { status: 303, headers });
}

export async function action({ request }: Route.ActionArgs) {
  if (request.headers.get("origin") !== new URL(env.APP_ORIGIN).origin) {
    return new Response(null, { status: 403 });
  }
  const auth = createAuth(env);
  const form = await request.formData();
  if (form.get("intent") === "esci") {
    return withCookies("/", await auth.api.signOut({ headers: request.headers, asResponse: true }));
  }

  const response = await auth.api.signInEmail({
    body: { email: String(form.get("email") ?? ""), password: String(form.get("password") ?? "") },
    headers: request.headers,
    asResponse: true,
  });
  return response.ok ? withCookies("/", response) : redirect("/?accesso=errore", 303);
}
