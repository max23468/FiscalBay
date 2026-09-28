// Valutata all'avvio dell'isolate, fuori dalla CPU della richiesta; handler creato una volta.
import * as build from "virtual:react-router/server-build";
import { createRequestHandler } from "react-router";
import { correlateResponse, correlationHeader, logFailure } from "../app/errors";

const requestHandler = createRequestHandler(build, import.meta.env.MODE);

export default {
  async fetch(request) {
    const id = crypto.randomUUID();
    const headers = new Headers(request.headers);
    headers.set(correlationHeader, id);
    const correlatedRequest = new Request(request, { headers });
    try {
      const response = await requestHandler(correlatedRequest);
      return correlateResponse(response, id);
    } catch {
      logFailure({ request: correlatedRequest, code: "INTERNAL_ERROR", operation: "route" });
      return new Response(null, { status: 500, headers: { [correlationHeader]: id } });
    }
  },
} satisfies ExportedHandler<Env>;
