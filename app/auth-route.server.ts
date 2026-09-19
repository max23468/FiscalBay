import { createAuth } from "./auth.server";

const serverOnlyAuthPaths = new Set(["/api/auth/get-access-token", "/api/auth/refresh-token"]);

export function handleAuthRequest(
  request: Request,
  environment: Env,
): Promise<Response> | Response {
  const pathname = new URL(request.url).pathname.replace(/\/+$/u, "");
  if (serverOnlyAuthPaths.has(pathname)) return new Response(null, { status: 404 });
  return createAuth(environment).handler(request);
}
