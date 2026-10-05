// Valutata all'avvio dell'isolate, fuori dalla CPU della richiesta; handler creato una volta.
import * as build from "virtual:react-router/server-build";
import { createRequestHandler } from "react-router";
import { correlateResponse, correlationHeader, logFailure } from "../app/errors";
import { refreshExpiringTokens } from "../app/integrations/ebay/seller-credentials.server";

const requestHandler = createRequestHandler(build, import.meta.env.MODE);

export default {
  async fetch(request, env) {
    const id = crypto.randomUUID();
    const headers = new Headers(request.headers);
    headers.set(correlationHeader, id);
    const correlatedRequest = new Request(request, { headers });
    try {
      const response = await requestHandler(correlatedRequest);
      const correlated = correlateResponse(response, id);
      if (env.VERSION_METADATA?.id)
        correlated.headers.set("x-fiscalbay-version", env.VERSION_METADATA.id);
      return correlated;
    } catch {
      logFailure({ request: correlatedRequest, code: "INTERNAL_ERROR", operation: "route" });
      return new Response(null, { status: 500, headers: { [correlationHeader]: id } });
    }
  },
  // Rinnovo anticipato dei token di accesso dei negozi, fuori dal percorso delle pagine.
  async scheduled(controller, env) {
    await refreshExpiringTokens(env, fetch, new Date(controller.scheduledTime));
  },
} satisfies ExportedHandler<Env>;
