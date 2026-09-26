import { env } from "cloudflare:workers";
import { redirect } from "react-router";

import { createAuth } from "../auth.server";
import { errorResponse } from "../errors";
import { languageFromPath, localizedPath } from "../i18n";
import type { Route } from "./+types/sign-in";

function withCookies(location: string, response: Response): Response {
  const headers = new Headers({ "cache-control": "no-store" });
  for (const cookie of response.headers.getSetCookie()) headers.append("set-cookie", cookie);
  return redirect(location, { status: 303, headers });
}

export async function action({ request }: Route.ActionArgs) {
  const base = localizedPath(languageFromPath(new URL(request.url).pathname));
  if (request.headers.get("origin") !== new URL(env.APP_ORIGIN).origin) {
    return errorResponse(request, "FORBIDDEN");
  }
  const auth = createAuth(env);
  const form = await request.formData();
  if (form.get("intent") === "esci") {
    return withCookies(
      base,
      await auth.api.signOut({ headers: request.headers, asResponse: true }),
    );
  }

  const credentials = {
    email: String(form.get("email") ?? ""),
    password: String(form.get("password") ?? ""),
  };
  if (form.get("intent") === "registrati") {
    // La registrazione non apre la sessione: l'accesso richiede l'email verificata.
    const response = await auth.api.signUpEmail({
      body: { ...credentials, name: credentials.email },
      headers: request.headers,
      asResponse: true,
    });
    return redirect(`${base}?accesso=${response.ok ? "registrato" : "errore"}`, 303);
  }

  const response = await auth.api.signInEmail({
    body: credentials,
    headers: request.headers,
    asResponse: true,
  });
  return response.ok ? withCookies(base, response) : redirect(`${base}?accesso=errore`, 303);
}
