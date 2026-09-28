import { env } from "cloudflare:workers";
import { redirect } from "react-router";

import { createAuth } from "../auth.server";
import { recordAgreement } from "../domain/agreements.server";
import { errorResponse } from "../errors";
import { languageFromPath, localizedPath } from "../i18n";
import type { Route } from "./+types/sign-in";

function withCookies(location: string, response: Response): Response {
  const headers = new Headers({ "cache-control": "no-store" });
  for (const cookie of response.headers.getSetCookie()) headers.append("set-cookie", cookie);
  return redirect(location, { status: 303, headers });
}

export async function action({ request }: Route.ActionArgs) {
  const language = languageFromPath(new URL(request.url).pathname);
  const base = localizedPath(language);
  if (request.headers.get("origin") !== new URL(env.APP_ORIGIN).origin) {
    return errorResponse(request, "FORBIDDEN");
  }
  const auth = createAuth(env);
  const form = await request.formData();
  const field = (name: string) => String(form.get(name) ?? "");
  const notice = (value: string) => redirect(`${base}?accesso=${value}`, 303);
  const intent = field("intent");

  if (intent === "esci") {
    return withCookies(
      base,
      await auth.api.signOut({ headers: request.headers, asResponse: true }),
    );
  }

  if (intent === "google") {
    const response = await auth.api.signInSocial({
      body: { provider: "google", callbackURL: base },
      headers: request.headers,
      asResponse: true,
    });
    if (!response.ok) return notice("errore");
    const { url } = await response.clone().json<{ url: string }>();
    return withCookies(url, response);
  }

  if (intent === "registrati") {
    // Termini obbligatori, marketing facoltativo: nessuna scelta vale se non inviata.
    if (field("termini") !== "on") return notice("termini");
    const response = await auth.api.signUpEmail({
      body: {
        email: field("email"),
        password: field("password"),
        name: field("nome").trim().slice(0, 100),
        callbackURL: base,
      },
      headers: request.headers,
      asResponse: true,
    });
    if (!response.ok) return notice("registrazione");
    const { user } = await response.clone().json<{ user: { id: string } }>();
    await recordAgreement(env.DB, {
      userId: user.id,
      language,
      marketing: field("marketing") === "on",
      now: new Date(),
    });
    return withCookies(`${base}?accesso=registrato`, response);
  }

  if (intent === "verifica" || intent === "accetta") {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return notice("errore");
    if (intent === "verifica") {
      if (session.user.emailVerified) return redirect(base, 303);
      await auth.api.sendVerificationEmail({
        body: { email: session.user.email, callbackURL: base },
        headers: request.headers,
      });
      return notice("verifica-inviata");
    }
    if (field("termini") !== "on") return notice("termini");
    await recordAgreement(env.DB, {
      userId: session.user.id,
      language,
      marketing: field("marketing") === "on",
      now: new Date(),
    });
    return redirect(base, 303);
  }

  const response = await auth.api.signInEmail({
    body: { email: field("email"), password: field("password") },
    headers: request.headers,
    asResponse: true,
  });
  return response.ok ? withCookies(base, response) : notice("errore");
}
