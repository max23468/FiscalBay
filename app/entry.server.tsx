import type { EntryContext, RouterContextProvider } from "react-router";
import { isRouteErrorResponse, ServerRouter } from "react-router";
import { isbot } from "isbot";
import { renderToReadableStream } from "react-dom/server";
import { contentSecurityPolicy, scriptNonce } from "./content-security.server";
import { logFailure } from "./errors";

export const streamTimeout = 5_000;

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  _loadContext: RouterContextProvider,
) {
  // https://httpwg.org/specs/rfc9110.html#HEAD
  if (request.method.toUpperCase() === "HEAD") {
    return new Response(null, {
      status: responseStatusCode,
      headers: responseHeaders,
    });
  }

  let shellRendered = false;
  const nonce = scriptNonce();
  const userAgent = request.headers.get("user-agent");

  // Il rendering non si misura qui: l'orologio del Worker resta fermo durante il calcolo, quindi
  // la sua durata si legge come tempo CPU della pagina dai Workers Logs (`pageCpuQuery`).
  const body = await renderToReadableStream(
    <ServerRouter context={routerContext} url={request.url} nonce={nonce} />,
    {
      nonce,
      signal: AbortSignal.timeout(streamTimeout + 1000),
      onError(_error: unknown) {
        responseStatusCode = 500;
        if (shellRendered) logFailure({ request, code: "INTERNAL_ERROR", operation: "render" });
      },
    },
  );
  shellRendered = true;

  // Ensure requests from bots and SPA Mode renders wait for all content to load before responding
  // https://react.dev/reference/react-dom/server/renderToPipeableStream#waiting-for-all-content-to-load-for-crawlers-and-static-generation
  if ((userAgent && isbot(userAgent)) || routerContext.isSpaMode) {
    await body.allReady;
  }

  responseHeaders.set("Content-Type", "text/html");
  responseHeaders.set("Content-Security-Policy", contentSecurityPolicy(nonce));
  return new Response(body, {
    headers: responseHeaders,
    status: responseStatusCode,
  });
}

export function handleError(error: unknown, { request }: { request: Request }) {
  if (isRouteErrorResponse(error) && error.status < 500) return;
  logFailure({ request, code: "INTERNAL_ERROR", operation: "route" });
}
