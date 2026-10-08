// Valutata all'avvio dell'isolate, fuori dalla CPU della richiesta; handler creato una volta.
import * as build from "virtual:react-router/server-build";
import { createRequestHandler } from "react-router";
import { indexable } from "../app/app-links";
import { correlateResponse, correlationHeader, logFailure, tracePhase } from "../app/errors";
import { purgeExpiredRecords } from "../app/domain/maintenance.server";
import { acquireStoresOrders } from "../app/domain/order-acquisition.server";
import { refreshExpiringTokens } from "../app/integrations/ebay/seller-credentials.server";

const requestHandler = createRequestHandler(build, import.meta.env.MODE);

export default {
  async fetch(request, env) {
    const id = crypto.randomUUID();
    const headers = new Headers(request.headers);
    headers.set(correlationHeader, id);
    const correlatedRequest = new Request(request, { headers });
    try {
      tracePhase(correlatedRequest, "start");
      const response = await requestHandler(correlatedRequest);
      tracePhase(correlatedRequest, "response");
      const correlated = correlateResponse(response, id);
      // Quasi ogni pagina dipende dalla sessione: nessuna cache conserva una risposta del
      // Worker, salvo una route che dichiari la propria regola. Gli asset statici non passano di qui.
      if (!correlated.headers.has("cache-control"))
        correlated.headers.set("cache-control", "no-store");
      if (!indexable(env.APP_ORIGIN, new URL(request.url).pathname))
        correlated.headers.set("x-robots-tag", "noindex, nofollow");
      if (env.VERSION_METADATA?.id)
        correlated.headers.set("x-fiscalbay-version", env.VERSION_METADATA.id);
      return correlated;
    } catch {
      logFailure({ request: correlatedRequest, code: "INTERNAL_ERROR", operation: "route" });
      return new Response(null, { status: 500, headers: { [correlationHeader]: id } });
    }
  },
  // Pulizia dei dati tecnici scaduti, rinnovo anticipato dei token di accesso dei negozi e
  // acquisizione degli ordini, fuori dal percorso delle pagine. Un passo fallito non ferma i
  // successivi; l'acquisizione usa i token appena rinnovati.
  async scheduled(controller, env) {
    const now = new Date(controller.scheduledTime);
    await purgeExpiredRecords(env.DB, now).catch((error: unknown) =>
      logFailure({ error, operation: "maintenance" }),
    );
    await refreshExpiringTokens(env, fetch, now).catch((error: unknown) =>
      logFailure({ error, operation: "token_refresh" }),
    );
    await acquireStoresOrders(env, fetch, now);
  },
} satisfies ExportedHandler<Env>;
