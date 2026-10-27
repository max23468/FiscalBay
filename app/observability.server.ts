import { AsyncLocalStorage } from "node:async_hooks";

import { classifyFailure } from "./errors";

/**
 * Fasi misurate di una richiesta. I nomi, le operazioni e gli attributi sono un elenco chiuso:
 * mai valori dell'utente, dell'ordine o del provider.
 */
export type Phase = "auth" | "d1" | "ebay" | "render";

export type PhaseOperation =
  | "session"
  | "orders"
  | "exports"
  | "stores"
  | "allowance"
  | "registration"
  | "notifications"
  | "settings"
  | "request"
  | "document";

/** Durate delle fasi e tracing della richiesta in corso. */
const requestScope = new AsyncLocalStorage<{ timings: Map<Phase, number>; tracing?: Tracing }>();

/**
 * Esegue la richiesta raccogliendo la durata di ogni fase, poi la espone nell'header
 * `Server-Timing` per le misure del browser. Le durate sono in millisecondi, una per fase.
 * Con il tracing del Worker ogni fase apre anche il proprio span.
 */
export async function withPhaseTimings(
  run: () => Promise<Response>,
  tracing?: Tracing,
): Promise<Response> {
  const timings = new Map<Phase, number>();
  const response = await requestScope.run({ timings, tracing }, run);
  if (timings.size === 0) return response;
  const headers = new Headers(response.headers);
  headers.set(
    "server-timing",
    [...timings].map(([phase, duration]) => `${phase};dur=${duration.toFixed(1)}`).join(", "),
  );
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Misura una fase: span Workers per la diagnosi e durata per `Server-Timing`. Un errore porta
 * soltanto il suo codice stabile, mai l'eccezione grezza.
 */
export async function measure<T>(
  phase: Phase,
  operation: PhaseOperation,
  run: () => Promise<T>,
): Promise<T> {
  const scope = requestScope.getStore();
  const span = scope?.tracing?.startSpan(`fiscalbay.${phase}`);
  span?.setAttributes({ "fiscalbay.phase": phase, "fiscalbay.operation": operation });
  const started = performance.now();
  try {
    const result = await run();
    span?.setStatus({ code: "ok" });
    return result;
  } catch (error) {
    span?.setStatus({ code: "error" });
    span?.setAttribute("fiscalbay.error", classifyFailure(error));
    throw error;
  } finally {
    span?.end();
    scope?.timings.set(phase, (scope.timings.get(phase) ?? 0) + performance.now() - started);
  }
}

/** Attributi della pagina sullo span della richiesta: nome e conteggi, nessun dato. */
export function describeRequest(attributes: Record<string, string | number | boolean>) {
  requestScope
    .getStore()
    ?.tracing?.getActiveSpan()
    ?.setAttributes(
      Object.fromEntries(
        Object.entries(attributes).map(([key, value]) => [`fiscalbay.${key}`, value]),
      ),
    );
}
