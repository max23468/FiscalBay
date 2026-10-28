import { AsyncLocalStorage } from "node:async_hooks";

import { classifyFailure, type ErrorCode } from "./errors";
import {
  invocationPoint,
  phasePoint,
  writePoints,
  type Invocation,
  type InvocationDetail,
  type InvocationOutcome,
  type MetricPoint,
} from "./metrics.server";

/**
 * Fasi misurate di una richiesta. I nomi, le operazioni e gli attributi sono un elenco chiuso:
 * mai valori dell'utente, dell'ordine o del provider.
 */
export type Phase = "auth" | "d1" | "ebay";

export type PhaseOperation =
  | "session"
  | "orders"
  | "exports"
  | "stores"
  | "allowance"
  | "registration"
  | "notifications"
  | "settings"
  | "request";

/** Inizio e fine di una misura, in millisecondi di `performance.now()`. */
type Interval = readonly [number, number];

/** Misure di una fase e operazione con lo stesso esito, nella stessa invocazione. */
type PhaseTotal = {
  phase: Phase;
  operation: PhaseOperation;
  outcome: "ok" | ErrorCode;
  count: number;
  intervals: Interval[];
  maxMs: number;
};

type Scope = {
  timings: Map<Phase, Interval[]>;
  totals: Map<string, PhaseTotal>;
  tracing?: Tracing;
};

/**
 * Tempo coperto da almeno una misura: le misure in parallelo, come le letture D1 di una
 * pagina, contano una volta sola, così una fase non supera mai la durata della richiesta.
 */
function coveredMs(intervals: Interval[]) {
  let total = 0;
  let end = -Infinity;
  for (const [from, to] of [...intervals].sort((a, b) => a[0] - b[0])) {
    if (to <= end) continue;
    total += to - Math.max(from, end);
    end = to;
  }
  return total;
}

/** Durate delle fasi e tracing dell'invocazione in corso. */
const invocationScope = new AsyncLocalStorage<Scope>();

/**
 * Esegue un'invocazione raccogliendo le misure delle fasi, poi scrive su Analytics Engine un
 * punto per l'invocazione e uno per ogni fase, operazione ed esito incontrati. Le chiavi sono
 * elenchi chiusi, quindi i punti restano pochi e lontani dal limite per invocazione.
 */
async function observe<T>(
  run: () => Promise<T>,
  describe: (result: { value?: T; failed: boolean }) => {
    invocation: Invocation;
    detail: InvocationDetail;
    method?: string;
    outcome: InvocationOutcome;
    count?: number;
  },
  dataset: AnalyticsEngineDataset | undefined,
  version: string | undefined,
  tracing: Tracing | undefined,
): Promise<{ value: T; scope: Scope }> {
  const scope: Scope = { timings: new Map(), totals: new Map(), tracing };
  const started = performance.now();
  let value: T | undefined;
  let failed = true;
  try {
    value = await invocationScope.run(scope, run);
    failed = false;
    return { value, scope };
  } finally {
    const durationMs = performance.now() - started;
    const description = describe({ value, failed });
    const points: MetricPoint[] = [
      invocationPoint({ ...description, durationMs, version }),
      ...[...scope.totals.values()].map(({ intervals, ...total }) =>
        phasePoint({
          ...total,
          totalMs: coveredMs(intervals),
          invocation: description.invocation,
          version,
        }),
      ),
    ];
    writePoints(dataset, points);
  }
}

/** Classe della route dal solo percorso, senza identificativi, query o valori dell'utente. */
function routeClass(pathname: string): InvocationDetail {
  if (pathname.startsWith("/webhooks/")) return "webhook";
  if (pathname.startsWith("/api/")) return "api";
  if (pathname.endsWith(".data")) return "data";
  return "document";
}

const statusClass = (status: number): InvocationOutcome =>
  status >= 500 ? "5xx" : status >= 400 ? "4xx" : status >= 300 ? "3xx" : "2xx";

/**
 * Esegue la richiesta raccogliendo la durata di ogni fase, poi la espone nell'header
 * `Server-Timing` per le misure del browser. Le durate sono in millisecondi, una per fase.
 * Con il tracing del Worker ogni fase apre anche il proprio span; esito, latenza e fasi vanno
 * su Analytics Engine.
 */
export async function withPhaseTimings(
  request: Request,
  run: () => Promise<Response>,
  options: {
    dataset?: AnalyticsEngineDataset;
    version?: string;
    tracing?: Tracing;
    /** Falso per le risposte ai provider: le durate restano a FiscalBay. */
    serverTiming?: boolean;
  } = {},
): Promise<Response> {
  const { value: response, scope } = await observe(
    run,
    ({ value, failed }) => ({
      invocation: "http",
      detail: routeClass(new URL(request.url).pathname),
      method: request.method,
      outcome: failed || !value ? "5xx" : statusClass(value.status),
    }),
    options.dataset,
    options.version,
    options.tracing,
  );
  if (scope.timings.size === 0 || options.serverTiming === false) return response;
  const headers = new Headers(response.headers);
  headers.set(
    "server-timing",
    [...scope.timings]
      .map(([phase, intervals]) => `${phase};dur=${coveredMs(intervals).toFixed(1)}`)
      .join(", "),
  );
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Misura un'invocazione della coda o del cron: esito, durata e fasi su Analytics Engine, span
 * delle fasi con il tracing del Worker. Un'eccezione resta all'invocazione e la marca non
 * riuscita; `outcome` distingue i messaggi rimessi in coda.
 */
export async function withInvocationMetrics<T>(
  invocation: "queue" | "cron",
  detail: InvocationDetail,
  run: () => Promise<T>,
  options: {
    dataset?: AnalyticsEngineDataset;
    version?: string;
    tracing?: Tracing;
    count?: number;
    outcome?: () => InvocationOutcome;
  } = {},
): Promise<T> {
  const { value } = await observe(
    run,
    ({ failed }) => ({
      invocation,
      detail,
      count: options.count,
      outcome: failed ? "error" : (options.outcome?.() ?? "ok"),
    }),
    options.dataset,
    options.version,
    options.tracing,
  );
  return value;
}

/**
 * Misura una fase: span Workers per la diagnosi, tempo coperto per `Server-Timing` e per
 * Analytics Engine. Un errore porta soltanto il suo codice stabile, mai l'eccezione grezza.
 */
export async function measure<T>(
  phase: Phase,
  operation: PhaseOperation,
  run: () => Promise<T>,
): Promise<T> {
  const scope = invocationScope.getStore();
  const span = scope?.tracing?.startSpan(`fiscalbay.${phase}`);
  span?.setAttributes({ "fiscalbay.phase": phase, "fiscalbay.operation": operation });
  const started = performance.now();
  let outcome: PhaseTotal["outcome"] = "ok";
  try {
    const result = await run();
    span?.setStatus({ code: "ok" });
    return result;
  } catch (error) {
    outcome = classifyFailure(error);
    span?.setStatus({ code: "error" });
    span?.setAttribute("fiscalbay.error", outcome);
    throw error;
  } finally {
    span?.end();
    if (scope) {
      const ended = performance.now();
      const interval = [started, ended] as const;
      scope.timings.set(phase, [...(scope.timings.get(phase) ?? []), interval]);
      const key = `${phase}:${operation}:${outcome}`;
      const total = scope.totals.get(key) ?? {
        phase,
        operation,
        outcome,
        count: 0,
        intervals: [],
        maxMs: 0,
      };
      total.count += 1;
      total.intervals.push(interval);
      total.maxMs = Math.max(total.maxMs, ended - started);
      scope.totals.set(key, total);
    }
  }
}

/** Attributi della pagina sullo span della richiesta: nome e conteggi, nessun dato. */
export function describeRequest(attributes: Record<string, string | number | boolean>) {
  invocationScope
    .getStore()
    ?.tracing?.getActiveSpan()
    ?.setAttributes(
      Object.fromEntries(
        Object.entries(attributes).map(([key, value]) => [`fiscalbay.${key}`, value]),
      ),
    );
}
