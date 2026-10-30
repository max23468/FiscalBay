import { env } from "cloudflare:workers";
import { data, redirect } from "react-router";

import { accessNotice, signInNotice, type SignInNotice } from "./access-notice";
import { currentSession } from "./account-area.server";
import { accessPath, ordersPath, originUrl, securityReturnPath, visitCookie } from "./app-links";
import { readSession } from "./domain/sessions.server";
import { authLimitWait, forwardToAuth, redirectWithCookies } from "./auth-route.server";
import { limitedHeaders } from "./request-limits.server";
import {
  completeRegistration,
  parseProfile,
  registrationStatus,
} from "./domain/registration.server";
import { deletionReauthenticated } from "./domain/account-deletion.server";
import { listSignInMethods } from "./domain/sign-in-methods.server";
import {
  requestAccountDeletion,
  securityAction,
  securityAuthPath,
} from "./security-actions.server";
import { tooManyRequests } from "./area-actions.server";
import { errorResponse, unavailableData } from "./error-response";
import { tracePhase } from "./errors";
import { languageFromPath, localizedPath } from "./i18n";
import { turnstileActions, turnstileField } from "./turnstile";
import { turnstileFailure } from "./turnstile.server";

const noStore = { "cache-control": "no-store" };

/**
 * Dati della cancellazione self-service per chi non raggiunge le Impostazioni (registrazione
 * incompleta o email non verificata): metodi per confermare l'identità sul posto, sessione in
 * uso e accesso abbastanza recente per chiedere il link.
 */
export async function deletionAccess(
  session: NonNullable<Awaited<ReturnType<typeof readSession>>>,
  now = new Date(),
) {
  return {
    methods: await listSignInMethods(env.DB, session.user.id),
    currentSession: session.session.id,
    ready: deletionReauthenticated(session.session.createdAt, now),
  };
}

/**
 * Pagina di accesso: login, registrazione, recupero della password, passkey e completamento del
 * profilo, con la cancellazione dell'account per chi non l'ha ancora completato. Con la sessione e la registrazione completa rimanda agli Ordini (o alla Sicurezza
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
  const deletion = await deletionAccess(session);
  const ebayLinked = deletion.methods.accounts.ebay;
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
    // La casella marketing compare soltanto a chi non ha mai scelto.
    needsMarketing: !status.marketingChosen,
    suggestedName: { firstName, lastName: lastName.join(" ") },
    deletion,
  };
}

/**
 * Invii della pagina di accesso: uscita, accesso con email o Google/eBay, recupero della
 * password, registrazione, verifica dell'email e completamento del profilo. Gli errori dei moduli
 * compilati rispondono sulla pagina stessa; gli altri esiti tornano con un avviso
 * nell'indirizzo, oppure entrano nell'app.
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
  const notice = (value: SignInNotice, page = access) => {
    const query = new URLSearchParams({ accesso: value });
    if (returnTo) query.set("returnTo", returnTo);
    return redirect(`${page}?${query}`, 303);
  };
  // Un errore di un modulo compilato resta sulla pagina con i valori inviati da ricompilare,
  // senza conservarli nel browser; password e token Turnstile non tornano mai indietro.
  const failed = (
    value: SignInNotice,
    tab: "accedi" | "registrati" | "completa",
    wait?: number | null,
  ) => {
    const values: Record<string, string> = {};
    for (const [name, entry] of form) {
      if (name !== "password" && name !== turnstileField && typeof entry === "string")
        values[name] = entry;
    }
    const status =
      value === "troppi-tentativi"
        ? 429
        : value === "autorizzazione"
          ? 403
          : value === "verifica-non-disponibile"
            ? 503
            : 400;
    return data(
      { notice: signInNotice(value, language), remembered: { tab, values } },
      { status, headers: wait ? limitedHeaders(wait) : noStore },
    );
  };
  // Una risposta 5xx di Auth, che l'ha già registrata, non dipende dai dati inviati: Auth o il
  // database non rispondono, e la pagina lo dice invece di chiedere di controllare email e
  // password.
  const forward = async (path: string, body?: Record<string, unknown>, admitted = false) => {
    const response = await forwardToAuth(env, request, path, body, admitted);
    if (response.status >= 500) throw unavailableData();
    return response;
  };

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
    if (await authLimitWait(env, request, "/request-password-reset"))
      return notice("troppi-tentativi");
    const check = await turnstileFailure(env, request, form, turnstileActions.passwordReset);
    if (check) return notice(check);
    const response = await forward(
      "/request-password-reset",
      { email: field("email"), redirectTo: originUrl(env, accessReturn) },
      true,
    );
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
    if (!profile) return failed("dati", "registrati");
    if (field("termini") !== "on") return failed("termini", "registrati");
    const wait = await authLimitWait(env, request, "/sign-up/email");
    if (wait) return failed("troppi-tentativi", "registrati", wait);
    const check = await turnstileFailure(env, request, form, turnstileActions.signUp);
    if (check) return failed(check, "registrati");
    const response = await forward(
      "/sign-up/email",
      {
        email: field("email"),
        password: field("password"),
        name: `${profile.firstName} ${profile.lastName}`,
        callbackURL: base,
      },
      true,
    );
    if (!response.ok) {
      if (response.status === 403) {
        const error = await response.clone().json<{ code?: string }>();
        if (error.code === "registration_approval_required")
          return failed("autorizzazione", "registrati");
      }
      return failed(response.status === 429 ? "troppi-tentativi" : "registrazione", "registrati");
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

  // Cancellazione dell'account e conferma dell'identità sul posto, o con uscita e nuovo
  // accesso, per chi non raggiunge le Impostazioni: lo stesso flusso, con la sessione in uso.
  if (intent === "account-delete" || intent === "conferma-accesso" || intent === "riautentica") {
    // Il filtro per IP precede anche la lettura della sessione.
    const authPath = securityAuthPath(intent, form);
    const wait = authPath ? await authLimitWait(env, request, authPath) : null;
    if (wait !== null) return tooManyRequests(request, wait);
    const session = await readSession(env, request);
    if (!session) return notice("errore");
    return intent === "account-delete"
      ? requestAccountDeletion(request, { language, session }, field("confirmation"), true)
      : securityAction(request, { language, session }, form, authPath !== null);
  }

  if (intent === "verifica" || intent === "completa") {
    // Il filtro per IP precede anche la lettura della sessione.
    if (intent === "verifica" && (await authLimitWait(env, request, "/send-verification-email")))
      return notice("troppi-tentativi", base);
    const session = await readSession(env, request);
    if (!session) return notice("errore");
    if (intent === "verifica") {
      if (session.user.emailVerified) return redirect(base, 303);
      const check = await turnstileFailure(env, request, form, turnstileActions.emailLink);
      if (check) return notice(check, base);
      const response = await forward(
        "/send-verification-email",
        { email: session.user.email, callbackURL: base },
        true,
      );
      if (response.status === 429) return notice("troppi-tentativi", base);
      return notice(response.ok ? "verifica-inviata" : "errore", base);
    }
    // Chi è entrato con Google senza profilo o Termini completa qui ciò che manca.
    const status = await registrationStatus(env.DB, session.user.id);
    const profile = status.profile ? undefined : parseProfile(form);
    // Gli errori del completamento restano sull'accesso, dove il passaggio si ripete.
    if (profile === null) return failed("dati", "completa");
    if (!status.termsAccepted && field("termini") !== "on") return failed("termini", "completa");
    await completeRegistration(env.DB, {
      userId: session.user.id,
      language,
      now: new Date(),
      profile,
      // Una nuova versione dei Termini non chiede di nuovo il consenso marketing: la scelta
      // esistente resta e non se ne registra una nuova.
      agreement: status.termsAccepted
        ? undefined
        : { marketing: status.marketingChosen ? undefined : field("marketing") === "on" },
    });
    return redirect(base, 303);
  }

  const response = await forward("/sign-in/email", {
    email: field("email"),
    password: field("password"),
  });
  if (response.ok) return redirectWithCookies(destination, response);
  if (response.status === 403) {
    const error = await response.clone().json<{ code?: string }>();
    if (error.code === "account_deletion_in_progress")
      return failed("cancellazione-in-corso", "accedi");
  }
  return failed(response.status === 429 ? "troppi-tentativi" : "errore", "accedi");
}
