import { env } from "cloudflare:workers";
import { redirect } from "react-router";

import { createAuth } from "../auth.server";
import { forwardToAuth, redirectWithCookies } from "../auth-route.server";
import {
  completeRegistration,
  parseProfile,
  registrationStatus,
} from "../domain/registration.server";
import { accessPath, ordersPath, visitCookie, securityReturnPath } from "../app-links";
import { accountLoader } from "../account-page.server";
import { errorResponse, tracePhase } from "../errors";
import { languageFromPath, localizedPath } from "../i18n";
import type { Route } from "./+types/sign-in";

// La pagina di accesso è la stessa degli Ordini, che la mostrano a chi non ha la sessione.
export { default, meta } from "./home";

export function loader({ request }: Route.LoaderArgs) {
  return accountLoader(request, "access");
}

export async function action({ request }: Route.ActionArgs) {
  const language = languageFromPath(new URL(request.url).pathname);
  // Con la sessione si torna agli Ordini, senza all'accesso: ciascuna pagina rimanda all'altra
  // se il caso non è il suo, conservando l'esito.
  const base = localizedPath(language, ordersPath);
  const access = localizedPath(language, accessPath);
  if (request.headers.get("origin") !== new URL(env.APP_ORIGIN).origin) {
    return errorResponse(request, "FORBIDDEN");
  }
  const form = await request.formData();
  tracePhase(request, "form");
  const field = (name: string) => String(form.get(name) ?? "");
  const intent = field("intent");
  const returnTo = securityReturnPath(language, field("returnTo"));
  const destination = returnTo ?? base;
  const accessReturn = returnTo ? `${access}?${new URLSearchParams({ returnTo })}` : access;
  const notice = (value: string, page = access) => {
    const query = new URLSearchParams({ accesso: value });
    if (returnTo) query.set("returnTo", returnTo);
    return redirect(`${page}?${query}`, 303);
  };
  const forward = (path: string, body?: Record<string, unknown>) =>
    forwardToAuth(env, request, path, body);

  // Dopo l'uscita la radice torna a essere il sito pubblico, senza la scelta di visita.
  if (intent === "esci") {
    const response = redirectWithCookies(localizedPath(language), await forward("/sign-out"));
    response.headers.append("set-cookie", `${visitCookie}=; Path=/; Max-Age=0`);
    return response;
  }

  if (intent === "google" || intent === "ebay") {
    const response = await forward("/sign-in/social", {
      provider: intent,
      callbackURL: destination,
      errorCallbackURL: `${localizedPath(language, "/auth/error")}?${new URLSearchParams({ provider: intent, ...(returnTo ? { returnTo } : {}) })}`,
    });
    if (!response.ok) return notice(response.status === 429 ? "troppi-tentativi" : "errore");
    const { url } = await response.clone().json<{ url: string }>();
    return redirectWithCookies(url, response);
  }

  if (intent === "recupera-password") {
    const response = await forward("/request-password-reset", {
      email: field("email"),
      redirectTo: `${new URL(env.APP_ORIGIN).origin}${accessReturn}`,
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
    // Per un indirizzo già registrato Better Auth risponde con un utente fittizio, senza
    // sessione: profilo e Termini si salvano solo per l'account appena creato. La sessione
    // nasce dal link di conferma, quindi la risposta è la stessa nei due casi.
    const { user } = await response.clone().json<{ user: { id: string } }>();
    const created = await env.DB.prepare('SELECT 1 FROM "user" WHERE "id" = ?')
      .bind(user.id)
      .first();
    if (created) {
      await completeRegistration(env.DB, {
        userId: user.id,
        language,
        now: new Date(),
        profile,
        agreement: { marketing: field("marketing") === "on" },
      });
    }
    return notice("registrato");
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
      if (response.status === 429) return notice("troppi-tentativi", base);
      return notice(response.ok ? "verifica-inviata" : "errore", base);
    }
    // Chi è entrato con Google o prima di una nuova versione dei Termini completa qui ciò che manca.
    const status = await registrationStatus(env.DB, session.user.id);
    const profile = status.profile ? undefined : parseProfile(form);
    if (profile === null) return notice("dati", base);
    if (!status.termsAccepted && field("termini") !== "on") return notice("termini", base);
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
  if (response.ok) return redirectWithCookies(destination, response);
  return notice(response.status === 429 ? "troppi-tentativi" : "errore");
}
