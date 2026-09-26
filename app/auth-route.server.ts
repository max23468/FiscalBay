import { createAuth } from "./auth.server";
import { completeStoreLink, takeStoreLinkSession } from "./integrations/ebay/store-link.server";
import { classifyFailure, logFailure } from "./errors";
import { localizedPath } from "./i18n";

const serverOnlyAuthPaths = new Set(["/api/auth/get-access-token", "/api/auth/refresh-token"]);
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

async function authResponse(request: Request, environment: Env): Promise<Response> {
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
  const link = await takeStoreLinkSession(environment.DB, search.get("state")!);
  if (!link) return noStore(await authResponse(request, environment));

  const session = await createAuth(environment).api.getSession({ headers: request.headers });
  const outcome = await completeStoreLink({
    environment,
    link,
    sessionUserId: session?.user.id ?? null,
    search,
    fetcher,
  }).catch((error: unknown) => {
    logFailure({ request, code: classifyFailure(error), operation: "store_link" });
    return "errore" as const;
  });
  const home = localizedPath(search.get("state")!.startsWith("en_") ? "en" : "it");
  return noStore(
    Response.redirect(new URL(`${home}?negozio=${outcome}`, environment.APP_ORIGIN), 303),
  );
}

export function handleAuthRequest(
  request: Request,
  environment: Env,
  fetcher: typeof fetch = fetch,
): Promise<Response> | Response {
  const pathname = new URL(request.url).pathname.replace(/\/+$/u, "");
  if (serverOnlyAuthPaths.has(pathname)) return new Response(null, { status: 404 });
  if (pathname !== ebayCallbackPath) return authResponse(request, environment);
  return handleEbayCallback(request, environment, fetcher);
}
