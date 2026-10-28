import { waitUntil } from "cloudflare:workers";
import { redirect } from "react-router";

import { createAuth } from "./auth.server";
import { registrationStatus } from "./domain/registration.server";
import { recordEmailChange } from "./domain/email-change.server";
import {
  passkeyChangeBlock,
  readSession,
  recentSignIn,
  type AuthSession,
} from "./domain/sessions.server";
import { completeStoreLink } from "./domain/store-link.server";
import {
  claimStoreLinkSession,
  recordStoreLinkOutcome,
  type StoreLinkOutcome,
} from "./integrations/ebay/store-link.server";
import { linkLanguage, notifySecurityEvent } from "./account-email.server";
import { logFailure, tracePhase } from "./errors";
import { appBase, ordersPath } from "./app-links";
import { localizedPath } from "./i18n";

// I token OAuth restano al codice server; metodi e passkey si rimuovono dalle azioni dell'app,
// che conservano sempre un accesso valido. L'elenco delle sessioni restituirebbe i token delle
// altre sessioni: l'app le mostra e le chiude dal server senza esporli. La cancellazione
// dell'account parte soltanto dalle Impostazioni, che chiedono riautenticazione e conferma.
const closedAuthPaths = new Set([
  "/api/auth/delete-user",
  "/api/auth/get-access-token",
  "/api/auth/refresh-token",
  "/api/auth/passkey/delete-passkey",
  "/api/auth/unlink-account",
  "/api/auth/list-sessions",
  "/api/auth/update-session",
]);
const passkeyEnrollmentPaths = new Set([
  "/api/auth/passkey/generate-register-options",
  "/api/auth/passkey/verify-registration",
  "/api/auth/passkey/update-passkey",
]);
const passkeyRegistrationPath = "/api/auth/passkey/verify-registration";
const linkSocialPath = "/api/auth/link-social";
const changeEmailPath = "/api/auth/change-email";
const ebayCallbackPath = "/api/auth/callback/ebay";
const deletionCallbackPath = "/api/auth/delete-user/callback";

function validEbayCallback(request: Request): boolean {
  if (request.method !== "GET") return false;

  const search = new URL(request.url).searchParams;
  const states = search.getAll("state");
  const codes = search.getAll("code");
  const errors = search.getAll("error");
  if (states.length !== 1 || !states[0] || states[0].length > 4096) return false;
  if ((codes.length === 1) === (errors.length === 1)) return false;
  if (codes.length === 1) return Boolean(codes[0]) && codes[0]!.length <= 1024;
  return Boolean(errors[0]) && errors[0]!.length <= 256;
}

function noStore(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("cache-control", "no-store");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// Soglie per IP e percorso sui soli invii sensibili, come le regole predefinite di Better Auth.
const attemptLimits = [
  { paths: /^\/(sign-in|sign-up|change-password|change-email)(\/|$)/u, window: 10, max: 3 },
  { paths: /^\/passkey\/verify-(authentication|registration)(\/|$)/u, window: 10, max: 3 },
  {
    paths: /^\/(send-verification-email|request-password-reset|forget-password|delete-user)(\/|$)/u,
    window: 60,
    max: 3,
  },
];

/** Un indirizzo IPv6 conta per la sua rete /64, che un singolo client controlla per intero. */
function clientKey(ip: string): string {
  if (!ip.includes(":")) return ip;
  const [head, tail = ""] = ip.split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const groups = [...left, ...Array(8 - left.length - right.length).fill("0"), ...right];
  return `${groups.slice(0, 4).join(":")}::/64`;
}

/**
 * Soglie per indirizzo email, indipendenti dall'IP: chi cambia rete non prova più password
 * sullo stesso account né riempie di email la casella di un altro. Il limite del login vale
 * solo per l'accesso con password: Google, eBay e passkey restano disponibili al titolare.
 */
const addressLimits = [
  { paths: /^\/sign-in\/email\/?$/u, window: 900, max: 10 },
  {
    paths:
      /^\/(sign-up\/email|send-verification-email|request-password-reset|forget-password)\/?$/u,
    window: 3600,
    max: 5,
  },
];

/**
 * Conta il tentativo su D1 con una sola istruzione, che apre o incrementa la finestra, e
 * restituisce i secondi di attesa oltre il limite.
 */
async function countAttempt(
  env: Env,
  key: string,
  rule: { window: number; max: number },
  now: number,
): Promise<number | null> {
  const windowMs = rule.window * 1000;
  const row = await env.DB.prepare(
    `INSERT INTO "rateLimit" ("id", "key", "count", "lastRequest") VALUES (?1, ?2, 1, ?3)
     ON CONFLICT ("key") DO UPDATE SET
       "count" = CASE WHEN ?3 - "lastRequest" >= ?4 THEN 1 ELSE "count" + 1 END,
       "lastRequest" = CASE WHEN ?3 - "lastRequest" >= ?4 THEN ?3 ELSE "lastRequest" END
     RETURNING "count", "lastRequest"`,
  )
    .bind(crypto.randomUUID(), key, now, windowMs)
    .first<{ count: number; lastRequest: number }>();
  if (!row || row.count <= rule.max) return null;
  return Math.max(1, Math.ceil((row.lastRequest + windowMs - now) / 1000));
}

/** Indirizzo del corpo JSON come impronta: la tabella dei limiti non conserva email in chiaro. */
async function addressKey(request: Request): Promise<string | null> {
  // Stryker disable ArrowFunction: null e undefined danno entrambi «nessun indirizzo».
  const body: unknown = await request
    .clone()
    .json()
    .catch(() => null);
  // Stryker restore ArrowFunction
  const email =
    typeof body === "object" && body !== null && "email" in body ? body.email : undefined;
  if (typeof email !== "string" || email.length === 0 || email.length > 254) return null;
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(email.trim().toLowerCase()),
  );
  return `email:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Applica i limiti per IP e poi quelli per indirizzo; restituisce i secondi di attesa oltre il
 * limite. Attivo sui domini HTTPS, dove Cloudflare fornisce l'IP del client; il limite interno
 * di Better Auth resta spento (vedi auth.server.ts).
 */
async function attemptWait(request: Request, env: Env): Promise<number | null> {
  if (request.method !== "POST" || !env.APP_ORIGIN.startsWith("https:")) return null;
  const path = new URL(request.url).pathname.replace(/^\/api\/auth/u, "");
  const rule = attemptLimits.find(({ paths }) => paths.test(path));
  const ip = request.headers.get("cf-connecting-ip");
  if (!rule || !ip) return null;

  const now = Date.now();
  // Pulizia occasionale delle finestre chiuse da oltre un'ora, fuori dal percorso della risposta.
  if (Math.random() < 0.02) {
    waitUntil(
      env.DB.prepare('DELETE FROM "rateLimit" WHERE "lastRequest" < ?')
        .bind(now - 3_600_000)
        .run(),
    );
  }
  const wait = await countAttempt(env, `${clientKey(ip)}|${path}`, rule, now);
  if (wait !== null) return wait;
  const addressRule = addressLimits.find(({ paths }) => paths.test(path));
  const address = addressRule ? await addressKey(request) : null;
  return address && addressRule
    ? countAttempt(env, `${address}|${path.replace(/\/$/u, "")}`, addressRule, now)
    : null;
}

async function authResponse(request: Request, env: Env): Promise<Response> {
  const pathname = new URL(request.url).pathname;
  let emailChange: { userId: string; email: string; newEmail: string } | null = null;
  if (pathname === linkSocialPath) {
    // Un nuovo metodo si collega solo da una sessione verificata e sempre con il consenso del
    // provider: il ramo `idToken` di Better Auth creerebbe l'account senza validateUserInfo.
    const session = await readSession(env, request);
    if (!session) return new Response(null, { status: 401 });
    // Come le altre modifiche critiche, anche chiamata direttamente: serve un accesso recente.
    if (!session.user.emailVerified || !recentSignIn(session as AuthSession)) {
      return new Response(null, { status: 403 });
    }
    const body = await request
      .clone()
      .json()
      .catch(() => undefined);
    if (typeof body !== "object" || body === null || "idToken" in body) {
      return new Response(null, { status: 400 });
    }
  }
  if (pathname === changeEmailPath) {
    const session = await readSession(env, request);
    if (session && !recentSignIn(session as AuthSession)) {
      return new Response(null, { status: 403 });
    }
    // Stryker disable ArrowFunction: null e undefined indicano entrambi un corpo non valido.
    const body = await request
      .clone()
      .json()
      .catch(() => null);
    // Stryker restore ArrowFunction
    if (
      session &&
      typeof body === "object" &&
      body !== null &&
      "newEmail" in body &&
      typeof body.newEmail === "string"
    ) {
      emailChange = { userId: session.user.id, email: session.user.email, newEmail: body.newEmail };
    }
  }
  // Utente che registra una passkey, per avvisarlo quando la registrazione riesce.
  let enrollingUserId: string | null = null;
  if (passkeyEnrollmentPaths.has(pathname)) {
    const session = await readSession(env, request);
    if (!session) return new Response(null, { status: 401 });
    const status = await registrationStatus(env.DB, session.user.id);
    if (!session.user.emailVerified || !status.profile || !status.termsAccepted) {
      return new Response(null, { status: 403 });
    }
    // Una nuova passkey richiede un accesso recente. Per un admin, che con la passkey supera
    // il secondo fattore, serve una sessione già confermata da passkey: password o email
    // compromesse non bastano ad aggiungerne una.
    if (passkeyChangeBlock(session as AuthSession)) return new Response(null, { status: 403 });
    // Stryker disable ArrowFunction: null e undefined lasciano la validazione del corpo ad Auth.
    const body = await request
      .clone()
      .json()
      .catch(() => null);
    // Stryker restore ArrowFunction
    if (
      typeof body === "object" &&
      body !== null &&
      "name" in body &&
      (typeof body.name !== "string" || !body.name.trim() || body.name.length > 80)
    ) {
      return new Response(null, { status: 400 });
    }
    enrollingUserId = session.user.id;
  }
  const wait = await attemptWait(request, env);
  if (wait !== null) {
    return Response.json(
      { code: "TOO_MANY_REQUESTS", message: "Too many requests. Try again later." },
      { status: 429, headers: { "retry-after": String(wait), "cache-control": "no-store" } },
    );
  }
  const response = await createAuth(env).handler(request);
  if (response.ok && emailChange) {
    await recordEmailChange(env.DB, emailChange.userId, emailChange.email, emailChange.newEmail);
  }
  if (response.status >= 500) logFailure({ request, code: "INTERNAL_ERROR", operation: "route" });
  if (pathname === passkeyRegistrationPath && response.ok && enrollingUserId) {
    notifySecurityEvent(env, enrollingUserId, { kind: "passkey-added" });
  }
  return response;
}

async function handleEbayCallback(
  request: Request,
  env: Env,
  fetcher: typeof fetch,
): Promise<Response> {
  if (!validEbayCallback(request)) {
    return noStore(Response.redirect(new URL("/auth/error", env.APP_ORIGIN), 303));
  }
  // Il RuName ha un solo callback: lo state distingue il collegamento negozio dal login eBay.
  const search = new URL(request.url).searchParams;
  const state = search.get("state")!;
  const link = await claimStoreLinkSession(env.DB, state);
  if (!link) return noStore(await authResponse(request, env));

  const session = await readSession(env, request);
  const sessionUserId = session?.user.id ?? null;
  let outcome: StoreLinkOutcome | null;
  if (link.kind === "duplicate") {
    // Stesso esito del primo callback, solo a chi ha avviato il collegamento; mentre il primo
    // è ancora in corso si torna agli ordini senza un esito anticipato.
    outcome = sessionUserId === link.userId ? link.outcome : "errore";
  } else {
    outcome = await completeStoreLink({
      env,
      link,
      sessionUserId,
      search,
      fetcher,
      request,
    }).catch((error: unknown) => {
      logFailure({ request, error, operation: "store_link" });
      return "errore" as const;
    });
    await recordStoreLinkOutcome(env.DB, state, outcome);
  }
  // Lo state comincia con la lingua e, se il collegamento parte da Negozi, con «-negozi».
  const [language, place] = state.split("_", 1)[0]!.split("-");
  const target = place === "negozi" ? `${appBase}/negozi` : ordersPath;
  const home = language === "en" ? localizedPath("en", target) : target;
  const query = new URLSearchParams();
  if (outcome) query.set("negozio", outcome);
  // Negozi elenca tutti gli ambienti; gli Ordini mostrano quello del negozio collegato.
  if (link.ebayEnvironment === "sandbox" && place !== "negozi") query.set("environment", "sandbox");
  const destination = query.size > 0 ? `${home}?${query}` : home;
  return noStore(Response.redirect(new URL(destination, env.APP_ORIGIN), 303));
}

/**
 * Il link di cancellazione appartiene all'utente della sessione e vale ancora. Better Auth
 * consuma il token prima del confronto con l'utente: verificarlo qui evita che lo bruci una
 * sessione diversa, un accesso mancante o un metodo diverso da GET, e il titolare lo conserva.
 */
async function deletionLinkOwned(request: Request, env: Env): Promise<boolean> {
  const token = new URL(request.url).searchParams.get("token");
  if (request.method !== "GET" || !token) return false;
  const session = await readSession(env, request);
  if (!session) return false;
  const { internalAdapter } = await createAuth(env).$context;
  const verification = await internalAdapter.findVerificationValue(`delete-account-${token}`);
  return (
    verification?.value === session.user.id &&
    new Date(verification.expiresAt).getTime() > Date.now()
  );
}

/**
 * Link di conferma della cancellazione: riuscito porta all'esito senza la sessione, che il
 * lavoro ha già chiuso; scaduto, già usato o aperto senza la sessione dello stesso utente porta
 * alla pagina di errore, nella lingua della richiesta, invece della risposta JSON di Auth. Se la
 * richiesta non si registra la pagina invita a riprovare con un nuovo link.
 */
async function handleDeletionCallback(request: Request, env: Env): Promise<Response> {
  const language = linkLanguage(request.url);
  const failure = (error: "delete_link" | "delete_failed") =>
    noStore(
      Response.redirect(
        new URL(`${localizedPath(language, "/auth/error")}?error=${error}`, env.APP_ORIGIN),
        303,
      ),
    );
  if (!(await deletionLinkOwned(request, env))) return failure("delete_link");
  const response = await authResponse(request, env);
  if (response.status >= 500) return failure("delete_failed");
  if (response.status !== 302) return failure("delete_link");
  const headers = new Headers(response.headers);
  const { authCookies } = await createAuth(env).$context;
  // I cookie della sessione chiusa si eliminano con gli stessi attributi con cui sono nati.
  for (const { name, attributes } of [
    authCookies.sessionToken,
    authCookies.sessionData,
    authCookies.dontRememberToken,
  ])
    headers.append(
      "set-cookie",
      `${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${attributes.secure ? "; Secure" : ""}`,
    );
  headers.set("cache-control", "no-store");
  return new Response(null, { status: 302, headers });
}

export function handleAuthRequest(
  request: Request,
  env: Env,
  fetcher: typeof fetch = fetch,
): Promise<Response> | Response {
  // Barre ripetute o finali e maiuscole non aggirano i controlli sui percorsi.
  const pathname = new URL(request.url).pathname
    .toLowerCase()
    .replace(/\/{2,}/gu, "/")
    .replace(/\/+$/u, "");
  if (closedAuthPaths.has(pathname)) return new Response(null, { status: 404 });
  if (pathname === deletionCallbackPath) return handleDeletionCallback(request, env);
  if (pathname !== ebayCallbackPath) return authResponse(request, env);
  return handleEbayCallback(request, env, fetcher);
}

const forwardedHeaders = ["cookie", "origin", "user-agent", "accept-language", "cf-connecting-ip"];

/**
 * Invia al router di Better Auth un'azione dei moduli dell'app, con lo stesso limite dei
 * tentativi delle chiamate dirette alle route Auth.
 */
export async function forwardToAuth(
  env: Env,
  request: Request,
  path: string,
  body: Record<string, unknown> = {},
): Promise<Response> {
  const headers = new Headers({ "content-type": "application/json" });
  for (const name of forwardedHeaders) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  tracePhase(request, "auth-forward");
  const response = await authResponse(
    new Request(new URL(`/api/auth${path}`, env.APP_ORIGIN), {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }),
    env,
  );
  tracePhase(request, "auth-response");
  return response;
}

/** Redirect dopo un'azione inoltrata ad Auth, con i cookie di sessione che ha impostato. */
export function redirectWithCookies(location: string, response: Response): Response {
  const headers = new Headers({ "cache-control": "no-store" });
  for (const cookie of response.headers.getSetCookie()) headers.append("set-cookie", cookie);
  return redirect(location, { status: 303, headers });
}
