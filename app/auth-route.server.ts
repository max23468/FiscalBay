import { createAuth } from "./auth.server";

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

export function handleAuthRequest(
  request: Request,
  environment: Env,
): Promise<Response> | Response {
  const pathname = new URL(request.url).pathname.replace(/\/+$/u, "");
  if (serverOnlyAuthPaths.has(pathname)) return new Response(null, { status: 404 });
  if (pathname !== ebayCallbackPath) return createAuth(environment).handler(request);
  if (!validEbayCallback(request)) {
    return noStore(Response.redirect(new URL("/auth/error", environment.APP_ORIGIN), 303));
  }
  return createAuth(environment).handler(request).then(noStore);
}
