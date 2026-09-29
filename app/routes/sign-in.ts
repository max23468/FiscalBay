import { env } from "cloudflare:workers";
import { redirect } from "react-router";

import { createAuth } from "../auth.server";
import { forwardToAuth } from "../auth-route.server";
import {
  completeRegistration,
  parseProfile,
  registrationStatus,
} from "../domain/registration.server";
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
  const form = await request.formData();
  const field = (name: string) => String(form.get(name) ?? "");
  const notice = (value: string) => redirect(`${base}?accesso=${value}`, 303);
  const forward = (path: string, body?: Record<string, unknown>) =>
    forwardToAuth(env, request, path, body);
  const intent = field("intent");

  if (intent === "esci") return withCookies(base, await forward("/sign-out"));

  if (intent === "rimuovi-accesso-ebay") {
    const auth = createAuth(env);
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user.emailVerified) return notice("accesso-non-verificato");
    const accounts = await auth.api.listUserAccounts({ headers: request.headers });
    const account = accounts.find((item) => item.providerId === "ebay");
    if (!account) return notice("errore");
    const response = await forward("/unlink-account", { accountId: account.id });
    if (!response.ok) {
      const error = await response.json<{ code?: string }>();
      return notice(
        error.code === "FAILED_TO_UNLINK_LAST_ACCOUNT" ? "ultimo-metodo" : "nuovo-accesso",
      );
    }
    return notice("ebay-rimosso");
  }

  if (intent === "google" || intent === "ebay" || intent === "collega-accesso-ebay") {
    const linking = intent === "collega-accesso-ebay";
    if (linking) {
      const session = await createAuth(env).api.getSession({ headers: request.headers });
      if (!session?.user.emailVerified) return notice("accesso-non-verificato");
    }
    const response = await forward(linking ? "/link-social" : "/sign-in/social", {
      provider: intent === "google" ? "google" : "ebay",
      callbackURL: linking ? `${base}?accesso=ebay-collegato` : base,
      errorCallbackURL: localizedPath(language, "/auth/error"),
    });
    if (!response.ok) return notice(response.status === 429 ? "troppi-tentativi" : "errore");
    const { url } = await response.clone().json<{ url: string }>();
    return withCookies(url, response);
  }

  if (intent === "recupera-password") {
    const response = await forward("/request-password-reset", {
      email: field("email"),
      redirectTo: `${new URL(env.APP_ORIGIN).origin}${base}`,
    });
    return notice(
      response.status === 429 ? "troppi-tentativi" : response.ok ? "recupero-inviato" : "errore",
    );
  }

  if (intent === "reimposta-password") {
    const token = field("token");
    if (!token || token.length > 512) return notice("recupero-scaduto");
    const response = await forward("/reset-password", {
      token,
      newPassword: field("password"),
    });
    return notice(response.ok ? "password-reimpostata" : "recupero-scaduto");
  }

  if (intent === "passkey-remove") {
    const session = await createAuth(env).api.getSession({ headers: request.headers });
    if (!session?.user.emailVerified) return notice("errore");
    const id = field("id");
    if (!id || id.length > 128) return notice("errore");
    const removed = await env.DB.prepare(
      `DELETE FROM "passkey" WHERE "id" = ?1 AND "userId" = ?2
       AND (EXISTS (SELECT 1 FROM "account" WHERE "userId" = ?2
         AND ("providerId" IN ('google', 'ebay') OR ("providerId" = 'credential' AND LENGTH("password") > 0)))
         OR (SELECT COUNT(*) FROM "passkey" WHERE "userId" = ?2) > 1)
       RETURNING "id"`,
    )
      .bind(id, session.user.id)
      .first<{ id: string }>();
    return redirect(`${base}?accesso=${removed ? "passkey-rimossa" : "ultimo-accesso"}`, 303);
  }

  if (intent === "registrati") {
    // Profilo e Termini obbligatori, marketing facoltativo: nessuna scelta vale se non inviata.
    const profile = parseProfile(form);
    if (!profile) return notice("dati");
    if (field("termini") !== "on") return notice("termini");
    const response = await forward("/sign-up/email", {
      email: field("email"),
      password: field("password"),
      name: `${profile.firstName} ${profile.lastName}`,
      callbackURL: base,
    });
    if (!response.ok) {
      return notice(response.status === 429 ? "troppi-tentativi" : "registrazione");
    }
    const { user } = await response.clone().json<{ user: { id: string } }>();
    await completeRegistration(env.DB, {
      userId: user.id,
      language,
      now: new Date(),
      profile,
      agreement: { marketing: field("marketing") === "on" },
    });
    return withCookies(`${base}?accesso=registrato`, response);
  }

  if (intent === "verifica" || intent === "completa") {
    const session = await createAuth(env).api.getSession({ headers: request.headers });
    if (!session) return notice("errore");
    if (intent === "verifica") {
      if (session.user.emailVerified) return redirect(base, 303);
      const response = await forward("/send-verification-email", {
        email: session.user.email,
        callbackURL: base,
      });
      if (response.status === 429) return notice("troppi-tentativi");
      return notice(response.ok ? "verifica-inviata" : "errore");
    }
    // Chi è entrato con Google o prima di una nuova versione dei Termini completa qui ciò che manca.
    const status = await registrationStatus(env.DB, session.user.id);
    const profile = status.profile ? undefined : parseProfile(form);
    if (profile === null) return notice("dati");
    if (!status.termsAccepted && field("termini") !== "on") return notice("termini");
    await completeRegistration(env.DB, {
      userId: session.user.id,
      language,
      now: new Date(),
      profile,
      agreement: status.termsAccepted ? undefined : { marketing: field("marketing") === "on" },
    });
    return redirect(base, 303);
  }

  const response = await forward("/sign-in/email", {
    email: field("email"),
    password: field("password"),
  });
  if (response.ok) return withCookies(base, response);
  return notice(response.status === 429 ? "troppi-tentativi" : "errore");
}
