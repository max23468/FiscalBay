import { waitUntil } from "cloudflare:workers";

import { createAuth } from "./auth.server";
import { registrationStatus } from "./domain/registration.server";
import { passkeyChangeBlock, recentSignIn, type AuthSession } from "./domain/sessions.server";
import {
  claimStoreLinkSession,
  completeStoreLink,
  recordStoreLinkOutcome,
  type StoreLinkOutcome,
} from "./integrations/ebay/store-link.server";
import { logFailure } from "./errors";
import { ordersPath } from "./app-links";
import { localizedPath } from "./i18n";

// I token OAuth restano al codice server; metodi e passkey si rimuovono dalle azioni dell'app,
// che conservano sempre un accesso valido. L'elenco delle sessioni restituirebbe i token delle
// altre sessioni: l'app le mostra e le chiude dal server senza esporli.
const closedAuthPaths = new Set([
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
]);
const linkSocialPath = "/api/auth/link-social";
const changeEmailPath = "/api/auth/change-email";
const ebayCallbackPath = "/api/auth/callback/ebay";

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
    paths: /^\/(send-verification-email|request-password-reset|forget-password)(\/|$)/u,
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
 * Conta il tentativo su D1 con una sola istruzione, che apre o incrementa la finestra, e
 * restituisce i secondi di attesa oltre il limite. Attivo sui domini HTTPS, dove Cloudflare
 * fornisce l'IP del client; il limite interno di Better Auth resta spento (vedi auth.server.ts).
 */
async function attemptWait(request: Request, environment: Env): Promise<number | null> {
  if (request.method !== "POST" || !environment.APP_ORIGIN.startsWith("https:")) return null;
  const path = new URL(request.url).pathname.replace(/^\/api\/auth/u, "");
  const rule = attemptLimits.find(({ paths }) => paths.test(path));
  const ip = request.headers.get("cf-connecting-ip");
  if (!rule || !ip) return null;

  const now = Date.now();
  const windowMs = rule.window * 1000;
  const row = await environment.DB.prepare(
    `INSERT INTO "rateLimit" ("id", "key", "count", "lastRequest") VALUES (?1, ?2, 1, ?3)
     ON CONFLICT ("key") DO UPDATE SET
       "count" = CASE WHEN ?3 - "lastRequest" >= ?4 THEN 1 ELSE "count" + 1 END,
       "lastRequest" = CASE WHEN ?3 - "lastRequest" >= ?4 THEN ?3 ELSE "lastRequest" END
     RETURNING "count", "lastRequest"`,
  )
    .bind(crypto.randomUUID(), `${clientKey(ip)}|${path}`, now, windowMs)
    .first<{ count: number; lastRequest: number }>();
  // Pulizia occasionale delle finestre chiuse da oltre un'ora, fuori dal percorso della risposta.
  if (Math.random() < 0.02) {
    waitUntil(
      environment.DB.prepare('DELETE FROM "rateLimit" WHERE "lastRequest" < ?')
        .bind(now - 3_600_000)
        .run(),
    );
  }
  if (!row || row.count <= rule.max) return null;
  return Math.max(1, Math.ceil((row.lastRequest + windowMs - now) / 1000));
}

async function authResponse(request: Request, environment: Env): Promise<Response> {
  const pathname = new URL(request.url).pathname;
  if (pathname === linkSocialPath) {
    // Un nuovo metodo si collega solo da una sessione verificata e sempre con il consenso del
    // provider: il ramo `idToken` di Better Auth creerebbe l'account senza validateUserInfo.
    const session = await createAuth(environment).api.getSession({ headers: request.headers });
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
    const session = await createAuth(environment).api.getSession({ headers: request.headers });
    if (session && !recentSignIn(session as AuthSession)) {
      return new Response(null, { status: 403 });
    }
  }
  if (passkeyEnrollmentPaths.has(pathname)) {
    const session = await createAuth(environment).api.getSession({ headers: request.headers });
    if (!session) return new Response(null, { status: 401 });
    const status = await registrationStatus(environment.DB, session.user.id);
    if (!session.user.emailVerified || !status.profile || !status.termsAccepted) {
      return new Response(null, { status: 403 });
    }
    // Una nuova passkey richiede un accesso recente. Per un admin, che con la passkey supera
    // il secondo fattore, serve una sessione già confermata da passkey: password o email
    // compromesse non bastano ad aggiungerne una.
    if (passkeyChangeBlock(session as AuthSession)) return new Response(null, { status: 403 });
  }
  const wait = await attemptWait(request, environment);
  if (wait !== null) {
    return Response.json(
      { code: "TOO_MANY_REQUESTS", message: "Too many requests. Try again later." },
      { status: 429, headers: { "retry-after": String(wait), "cache-control": "no-store" } },
    );
  }
  const response = await createAuth(environment).handler(request);
  if (response.status >= 500) logFailure({ request, code: "INTERNAL_ERROR", operation: "route" });
  return response;
}

async function handleEbayCallback(
  request: Request,
  environment: Env,
  fetcher: typeof fetch,
): Promise<Response> {
  if (!validEbayCallback(request)) {
    return noStore(Response.redirect(new URL("/auth/error", environment.APP_ORIGIN), 303));
  }
  // Il RuName ha un solo callback: lo state distingue il collegamento negozio dal login eBay.
  const search = new URL(request.url).searchParams;
  const state = search.get("state")!;
  const link = await claimStoreLinkSession(environment.DB, state);
  if (!link) return noStore(await authResponse(request, environment));

  const session = await createAuth(environment).api.getSession({ headers: request.headers });
  const sessionUserId = session?.user.id ?? null;
  let outcome: StoreLinkOutcome | null;
  if (link.kind === "duplicate") {
    // Stesso esito del primo callback, solo a chi ha avviato il collegamento; mentre il primo
    // è ancora in corso si torna agli ordini senza un esito anticipato.
    outcome = sessionUserId === link.userId ? link.outcome : "errore";
  } else {
    outcome = await completeStoreLink({
      environment,
      link,
      sessionUserId,
      search,
      fetcher,
      request,
    }).catch((error: unknown) => {
      logFailure({ request, error, operation: "store_link" });
      return "errore" as const;
    });
    await recordStoreLinkOutcome(environment.DB, state, outcome);
  }
  const home = state.startsWith("en_") ? localizedPath("en", ordersPath) : ordersPath;
  const query = new URLSearchParams();
  if (outcome) query.set("negozio", outcome);
  if (link.ebayEnvironment === "sandbox") query.set("environment", "sandbox");
  const destination = query.size > 0 ? `${home}?${query}` : home;
  return noStore(Response.redirect(new URL(destination, environment.APP_ORIGIN), 303));
}

export function handleAuthRequest(
  request: Request,
  environment: Env,
  fetcher: typeof fetch = fetch,
): Promise<Response> | Response {
  const pathname = new URL(request.url).pathname.replace(/\/+$/u, "");
  if (closedAuthPaths.has(pathname)) return new Response(null, { status: 404 });
  if (pathname !== ebayCallbackPath) return authResponse(request, environment);
  return handleEbayCallback(request, environment, fetcher);
}

const forwardedHeaders = ["cookie", "origin", "user-agent", "accept-language", "cf-connecting-ip"];

/**
 * Invia al router di Better Auth un'azione dei moduli dell'app, con lo stesso limite dei
 * tentativi delle chiamate dirette alle route Auth.
 */
export function forwardToAuth(
  environment: Env,
  request: Request,
  path: string,
  body: Record<string, unknown> = {},
): Promise<Response> {
  const headers = new Headers({ "content-type": "application/json" });
  for (const name of forwardedHeaders) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  return authResponse(
    new Request(new URL(`/api/auth${path}`, environment.APP_ORIGIN), {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }),
    environment,
  );
}
