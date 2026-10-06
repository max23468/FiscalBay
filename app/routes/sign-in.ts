import { env } from "cloudflare:workers";
import { redirect } from "react-router";

import { createAuth } from "../auth.server";
import { forwardToAuth } from "../auth-route.server";
import {
  completeRegistration,
  parseProfile,
  registrationStatus,
} from "../domain/registration.server";
import {
  accountMethods,
  removeAccountMethod,
  removePasskey,
  type AccountMethod,
} from "../domain/sign-in-methods.server";
import {
  passkeyChangeBlock,
  recentSignIn,
  revokeOtherSessions,
  revokeSession,
  type AuthSession,
} from "../domain/sessions.server";
import { accessPath, ordersPath, securityPath, visitCookie } from "../app-links";
import { accountLoader } from "../account-page.server";
import { errorResponse, tracePhase } from "../errors";
import { languageFromPath, localizedPath } from "../i18n";
import type { Route } from "./+types/sign-in";

function withCookies(location: string, response: Response): Response {
  const headers = new Headers({ "cache-control": "no-store" });
  for (const cookie of response.headers.getSetCookie()) headers.append("set-cookie", cookie);
  return redirect(location, { status: 303, headers });
}

const securityIntents = new Set([
  "esci-sessione",
  "esci-altri",
  "collega-metodo",
  "rimuovi-metodo",
  "password",
  "cambia-email",
  "passkey-remove",
]);

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
  // Le azioni di Sicurezza riportano alla sua pagina, le altre all'accesso.
  const security = localizedPath(language, securityPath);
  const back = securityIntents.has(intent) ? security : access;
  const notice = (value: string, page = back) => redirect(`${page}?accesso=${value}`, 303);
  const forward = async (path: string, body?: Record<string, unknown>) => {
    tracePhase(request, "auth-forward");
    const response = await forwardToAuth(env, request, path, body);
    tracePhase(request, "auth-response");
    return response;
  };

  // Dopo l'uscita la radice torna a essere il sito pubblico, senza la scelta di visita.
  if (intent === "esci") {
    const response = withCookies(localizedPath(language), await forward("/sign-out"));
    response.headers.append("set-cookie", `${visitCookie}=; Path=/; Max-Age=0`);
    return response;
  }

  if (intent === "esci-sessione" || intent === "esci-altri") {
    // Chiudere sessioni protegge l'account: basta la sessione corrente, anche non recente.
    const session = await createAuth(env).api.getSession({ headers: request.headers });
    if (!session) return notice("errore");
    if (intent === "esci-altri") {
      await revokeOtherSessions(env.DB, session.user.id, session.session.id);
      return notice("sessioni-chiuse");
    }
    const id = field("id");
    if (!id || id.length > 128) return notice("errore");
    if (id === session.session.id) {
      return withCookies(localizedPath(language), await forward("/sign-out"));
    }
    await revokeSession(env.DB, session.user.id, id);
    return notice("sessione-chiusa");
  }

  if (intent === "google" || intent === "ebay") {
    const response = await forward("/sign-in/social", {
      provider: intent,
      callbackURL: base,
      errorCallbackURL: `${localizedPath(language, "/auth/error")}?provider=${intent}`,
    });
    if (!response.ok) return notice(response.status === 429 ? "troppi-tentativi" : "errore");
    const { url } = await response.clone().json<{ url: string }>();
    return withCookies(url, response);
  }

  if (
    intent === "collega-metodo" ||
    intent === "rimuovi-metodo" ||
    intent === "password" ||
    intent === "cambia-email"
  ) {
    const session = await createAuth(env).api.getSession({ headers: request.headers });
    if (!session?.user.emailVerified) return notice("accesso-non-verificato", base);
    // Collegare, rimuovere e cambiare email richiedono un accesso delle ultime 24 ore; il link
    // per la password va comunque al proprio indirizzo.
    if (intent !== "password" && !recentSignIn(session as AuthSession)) {
      return notice("nuovo-accesso");
    }
    const method = field("metodo");

    if (intent === "collega-metodo") {
      if (method !== "google" && method !== "ebay") return notice("errore");
      const response = await forward("/link-social", {
        provider: method,
        callbackURL: `${security}?accesso=metodo-collegato`,
        errorCallbackURL: `${localizedPath(language, "/auth/error")}?provider=${method}`,
      });
      if (!response.ok) return notice(response.status === 429 ? "troppi-tentativi" : "errore");
      const { url } = await response.clone().json<{ url: string }>();
      return withCookies(url, response);
    }

    if (intent === "rimuovi-metodo") {
      if (!Object.hasOwn(accountMethods, method)) return notice("errore");
      const removed = await removeAccountMethod(env.DB, session.user.id, method as AccountMethod);
      if (!removed) return notice("ultimo-metodo");
      return notice(method === "ebay" ? "ebay-rimosso" : "metodo-rimosso");
    }

    if (intent === "password") {
      // Il link al proprio indirizzo imposta o cambia la password; al reset crea l'account
      // credential che manca a chi è entrato con Google, eBay o passkey.
      const response = await forward("/request-password-reset", {
        email: session.user.email,
        redirectTo: `${new URL(env.APP_ORIGIN).origin}${access}`,
      });
      if (response.status === 429) return notice("troppi-tentativi");
      return notice(response.ok ? "password-link" : "errore");
    }

    const email = field("email").trim();
    if (!email || email.length > 254) return notice("email-non-valida");
    const response = await forward("/change-email", {
      newEmail: email,
      callbackURL: `${security}?accesso=email-confermata`,
    });
    if (response.status === 429) return notice("troppi-tentativi");
    // La risposta non distingue un indirizzo già registrato: non rivela chi usa FiscalBay.
    return notice(response.ok ? "email-richiesta" : "email-non-valida");
  }

  if (intent === "recupera-password") {
    const response = await forward("/request-password-reset", {
      email: field("email"),
      redirectTo: `${new URL(env.APP_ORIGIN).origin}${access}`,
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
    const block = passkeyChangeBlock(session as AuthSession);
    if (block) return notice(block);
    const id = field("id");
    if (!id || id.length > 128) return notice("errore");
    const removed = await removePasskey(env.DB, session.user.id, id);
    return notice(removed ? "passkey-rimossa" : "ultimo-accesso");
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
  if (response.ok) return withCookies(base, response);
  return notice(response.status === 429 ? "troppi-tentativi" : "errore");
}
