import type { createRequestHandler } from "react-router";
import {
  consumeWebhooks,
  isWebhookMessage,
  isWebhookPath,
  receiveWebhook,
} from "../app/webhooks.server";
import { indexable } from "../app/app-links";
import { correlateResponse, correlationHeader, logFailure, tracePhase } from "../app/errors";
import type { InvocationDetail, InvocationOutcome } from "../app/metrics.server";
import { withInvocationMetrics, withPhaseTimings } from "../app/observability.server";
import { withResponseCookies } from "../app/response-cookies.server";
import { consumeStoreSync, isSyncMessage } from "../app/domain/order-sync.server";
import { consumeExportJob, isExportJobMessage } from "../app/domain/export-jobs.server";
import {
  consumeTask,
  dispatchScheduledWork,
  isTaskMessage,
} from "../app/domain/scheduled-work.server";

// I webhook vengono rifiutati o presi in carico prima di caricare la build dell'app. Anche
// React Router si carica con la build: cron, coda e webhook non ne valutano i moduli all'avvio.
let requestHandler: ReturnType<typeof createRequestHandler> | undefined;

async function loadRequestHandler() {
  const [{ createRequestHandler }, build] = await Promise.all([
    import("react-router"),
    import("virtual:react-router/server-build"),
  ]);
  return createRequestHandler(build, import.meta.env.MODE);
}

/**
 * Messaggi della coda osservati: l'esito è `retry` se il consumer ne rimette in coda almeno uno.
 * Il consumer riceve gli stessi messaggi, con un `retry` che lo annota.
 */
function observedMessages<T extends Message<unknown>>(messages: T[]) {
  let retried = false;
  const observed = messages.map(
    (message) =>
      new Proxy(message, {
        get(target, property) {
          const value = Reflect.get(target, property, target) as unknown;
          if (typeof value !== "function") return value;
          if (property === "retry")
            return (...args: unknown[]) => {
              retried = true;
              return (value as (...args: unknown[]) => unknown).apply(target, args);
            };
          return (value as (...args: unknown[]) => unknown).bind(target);
        },
      }),
  );
  return { observed, outcome: (): InvocationOutcome => (retried ? "retry" : "ok") };
}

export default {
  async fetch(request, env, ctx) {
    const metrics = { dataset: env.METRICS, version: env.VERSION_METADATA?.id };
    if (isWebhookPath(new URL(request.url).pathname))
      return withPhaseTimings(
        request,
        async () => (await receiveWebhook(request, env)) ?? new Response(null, { status: 404 }),
        { ...metrics, tracing: ctx?.tracing, serverTiming: false },
      );
    requestHandler ??= await loadRequestHandler();
    const id = crypto.randomUUID();
    const headers = new Headers(request.headers);
    headers.set(correlationHeader, id);
    const correlatedRequest = new Request(request, { headers });
    try {
      tracePhase(correlatedRequest, "start");
      const handler = requestHandler;
      const response = await withPhaseTimings(
        correlatedRequest,
        () => withResponseCookies(() => handler(correlatedRequest)),
        { ...metrics, tracing: ctx?.tracing },
      );
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
  // La coda porta i riferimenti dei webhook, le letture dei negozi, i compiti periodici e le
  // esportazioni grandi: ogni tipo ha il proprio schema e nessuno raccoglie i messaggi degli altri.
  async queue(batch, env, ctx?: ExecutionContext) {
    const syncs = batch.messages.filter((message) => isSyncMessage(message.body));
    const tasks = batch.messages.filter((message) => isTaskMessage(message.body));
    const webhooks = batch.messages.filter((message) => isWebhookMessage(message.body));
    const exports = batch.messages.filter((message) => isExportJobMessage(message.body));
    // Ogni tipo di messaggio è un'invocazione misurata a sé, con le fasi che attraversa.
    const observe = <T extends Message<unknown>>(
      detail: InvocationDetail,
      messages: T[],
      consume: (messages: T[]) => Promise<unknown>,
    ) => {
      if (messages.length === 0) return Promise.resolve();
      const { observed, outcome } = observedMessages(messages);
      return withInvocationMetrics("queue", detail, () => consume(observed), {
        dataset: env.METRICS,
        version: env.VERSION_METADATA?.id,
        tracing: ctx?.tracing,
        count: messages.length,
        outcome,
      });
    };
    // Un messaggio di forma sconosciuta non ha un consumer: si riprova fino alla coda dei
    // messaggi non consegnati, dove resta da esaminare.
    const known = new Set([...syncs, ...tasks, ...webhooks, ...exports]);
    await observe(
      "unknown",
      batch.messages.filter((message) => !known.has(message)),
      async (unknown) => {
        for (const message of unknown) {
          logFailure({ code: "INVALID_REQUEST", operation: "queue" });
          message.retry();
        }
      },
    );
    // Negozi diversi non si ostacolano; lo stesso negozio è serializzato dal suo blocco.
    await Promise.all([
      observe("sync", syncs, (messages) =>
        Promise.all(messages.map((message) => consumeStoreSync(message, env))),
      ),
      observe("task", tasks, (messages) =>
        Promise.all(messages.map((message) => consumeTask(message, env))),
      ),
      observe("export", exports, (messages) =>
        Promise.all(messages.map((message) => consumeExportJob(message, env))),
      ),
    ]);
    await observe("webhook", webhooks, (messages) => consumeWebhooks({ messages }, env));
  },
  // Ogni dieci minuti accoda il lavoro dovuto, senza eseguirlo: il consumer lo svolge fuori
  // dal percorso delle pagine e dall'invocazione del cron.
  async scheduled(controller, env, ctx?: ExecutionContext) {
    await withInvocationMetrics(
      "cron",
      "dispatch",
      () => dispatchScheduledWork(env, new Date(controller.scheduledTime)),
      { dataset: env.METRICS, version: env.VERSION_METADATA?.id, tracing: ctx?.tracing },
    );
  },
} satisfies ExportedHandler<Env>;
