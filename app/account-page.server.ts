import { env } from "cloudflare:workers";
import { redirect } from "react-router";

import { accessNotice } from "./access-notice";
import { currentSession } from "./account-area.server";
import { accessPath, ordersPath, originUrl, securityReturnPath, visitCookie } from "./app-links";
import { readSession } from "./domain/sessions.server";
import { forwardToAuth, redirectWithCookies } from "./auth-route.server";
import {
  completeRegistration,
  parseProfile,
  registrationStatus,
} from "./domain/registration.server";
import { listSignInMethods } from "./domain/sign-in-methods.server";
import { errorResponse } from "./error-response";
import { tracePhase } from "./errors";
import { languageFromPath, localizedPath } from "./i18n";

const noStore = { "cache-control": "no-store" };

/**
 * Pagina di accesso: login, registrazione, recupero della password, passkey e completamento del
 * profilo. Con la sessione e la registrazione completa rimanda agli Ordini (o alla Sicurezza
 * da cui si è partiti), conservando l'esito nell'indirizzo; il link per la nuova password resta
 * qui anche con la sessione.
 */
export async function accessLoader(request: Request) {
  const url = new URL(request.url);
  const language = languageFromPath(url.pathname);
  const search = url.searchParams;
  const notice = accessNotice(search, language);
  const session = await currentSession(request);
  if (!session || search.has("token")) {
    return {
      authenticated: false as const,
      registrationRestricted: env.REGISTRATION_MODE !== "open",
      language,
      notice,
      resetToken: search.get("token") || null,
      // «Inizia gratis» del sito apre direttamente la registrazione.
      tab: search.has("registrati") ? "registrati" : "accedi",
    };
  }
  const status = await registrationStatus(env.DB, session.user.id);
  if (status.termsAccepted && status.profile) {
    const target = securityReturnPath(language, search.get("returnTo"));
    throw redirect(target ?? `${localizedPath(language, ordersPath)}${url.search}`, {
      headers: noStore,
    });
  }
  // eBay fornisce uno username, non il nome della persona. Vale anche per gli utenti
  // già registrati: né lo username né un indirizzo email devono precompilare il profilo.
  const ebayLinked = (await listSignInMethods(env.DB, session.user.id)).accounts.ebay;
  const providerName =
    status.profile || ebayLinked || session.user.name.includes("@") ? "" : session.user.name;
  const [firstName = "", ...lastName] = providerName.trim().split(/\s+/u).filter(Boolean);
  return {
    authenticated: true as const,
    language,
    notice,
    email: session.user.email,
    emailVerified: session.user.emailVerified,
    needsProfile: !status.profile,
    needsAgreement: !status.termsAccepted,
    suggestedName: { firstName, lastName: lastName.join(" ") },
  };
}

/**
 * Invii della pagina di accesso: uscita, accesso con email o Google/eBay, recupero della
 * password, registrazione, verifica dell'email e completamento del profilo. Ogni esito torna
 * alla pagina con un avviso nell'indirizzo, oppure entra nell'app.
 */
export async function accessAction(request: Request) {
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
      redirectTo: originUrl(env, accessReturn),
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
      if (response.status === 403) {
        const error = await response.clone().json<{ code?: string }>();
        if (error.code === "registration_approval_required") return notice("autorizzazione");
      }
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
    const session = await readSession(env, request);
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
    // Gli errori del completamento restano sull'accesso, dove il passaggio si ripete.
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
  if (response.ok) return redirectWithCookies(destination, response);
  return notice(response.status === 429 ? "troppi-tentativi" : "errore");
}
