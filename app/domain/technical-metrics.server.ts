import { logFailure } from "../errors";
import { readBounded } from "../integrations/http.server";
import {
  cpuKinds,
  cpuPages,
  cpuValues,
  metricSql,
  pageCpuQuery,
  type CpuKind,
  type CpuPage,
  type MetricQuery,
} from "../metrics-queries";

// Token API facoltativo con i soli permessi Account Analytics Read e Workers Observability Read:
// senza, la sezione resta non configurata. Dichiararlo con `bindings.secret()` lo renderebbe
// obbligatorio.
declare global {
  namespace Cloudflare {
    interface Env {
      ANALYTICS_READ_TOKEN?: string;
    }
  }
}

/**
 * Prestazioni nella console: le query di `metrics-queries.ts` sulla SQL API di Analytics Engine
 * e sui Workers Logs, per le ultime 24 ore dell'ambiente. I valori di Analytics Engine sono stime
 * pesate con il campionamento, non conteggi esatti; una lettura non riuscita resta indicata come
 * tale, mai come zero.
 */

export const metricsWindowHours = 24;

/** Attesa della lettura: la console non resta ferma su Analytics Engine o sui log. */
const timeoutMs = 8_000;

/** Le risposte delle query occupano poche decine di kilobyte. */
const maxBytes = 262_144;

export type InvocationRow = {
  invocation: string;
  detail: string;
  method: string;
  outcome: string;
  /** Invocazioni; la media e i quantili valgono per invocazione. */
  count: number;
  /** Messaggi della coda portati dalle invocazioni; per HTTP e cron coincide con `count`. */
  messages: number;
  meanMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
};

export type PhaseRow = {
  invocation: string;
  phase: string;
  operation: string;
  outcome: string;
  calls: number;
  invocations: number;
  meanMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
};

export type PageRow = {
  page: string;
  reports: number;
  /** Quantili 75 e 95 per misura; null quando nessun report porta la misura. */
  measures: Record<
    "ttfb" | "fcp" | "lcp" | "ready" | "server_auth" | "server_d1" | "server_ebay",
    { p75: number | null; p95: number | null }
  >;
};

/** Tempo CPU di una pagina; i valori sono null quando nella finestra non ci sono invocazioni. */
export type CpuRow = {
  page: CpuPage;
  kind: CpuKind;
  invocations: number;
  cpuP50Ms: number | null;
  cpuP95Ms: number | null;
  wallP50Ms: number | null;
};

export type TechnicalMetrics =
  | { read: "unconfigured" }
  | { read: "failed" }
  | {
      read: "ok";
      windowHours: number;
      invocations: InvocationRow[];
      phases: PhaseRow[];
      pages: PageRow[];
      cpu: CpuRow[];
    };

type Row = Record<string, unknown>;

/** La SQL API restituisce gli interi grandi come testo e le medie su zero righe come `nan`. */
const numeric = (value: unknown) => {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : 0;
};
const text = (value: unknown) => (typeof value === "string" ? value : "");

const pageMeasureNames = [
  "ttfb",
  "fcp",
  "lcp",
  "ready",
  "server_auth",
  "server_d1",
  "server_ebay",
] as const;

async function readJson(
  fetcher: typeof fetch,
  url: string,
  init: RequestInit,
  token: string,
): Promise<unknown> {
  const response = await fetcher(url, {
    ...init,
    method: "POST",
    headers: { ...init.headers, authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(timeoutMs),
  });
  const body = await readBounded(response, maxBytes);
  if (!response.ok || !body) throw new Error("METRICS_UNAVAILABLE");
  return JSON.parse(new TextDecoder().decode(body));
}

async function runQuery(
  env: Env,
  fetcher: typeof fetch,
  query: MetricQuery,
  token: string,
): Promise<Row[]> {
  const parsed = (await readJson(
    fetcher,
    `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/analytics_engine/sql`,
    {
      headers: { "content-type": "text/plain" },
      body: metricSql(query, env.METRICS_DATASET, metricsWindowHours),
    },
    token,
  )) as { data?: unknown };
  if (!Array.isArray(parsed.data)) throw new Error("METRICS_UNAVAILABLE");
  return parsed.data as Row[];
}

async function runCpuQuery(
  env: Env,
  fetcher: typeof fetch,
  page: CpuPage,
  kind: CpuKind,
  token: string,
): Promise<CpuRow> {
  const parsed = (await readJson(
    fetcher,
    `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/workers/observability/telemetry/query`,
    {
      headers: { "content-type": "application/json" },
      body: JSON.stringify(pageCpuQuery(env.WORKER_NAME, page, kind, metricsWindowHours)),
    },
    token,
  )) as { result?: { calculations?: unknown } };
  const values = cpuValues(parsed.result?.calculations);
  if (!values) throw new Error("METRICS_UNAVAILABLE");
  return { page, kind, ...values };
}

export async function readTechnicalMetrics(
  env: Env,
  fetcher: typeof fetch,
): Promise<TechnicalMetrics> {
  const token = env.ANALYTICS_READ_TOKEN;
  if (!token || !env.CLOUDFLARE_ACCOUNT_ID || !env.METRICS_DATASET || !env.WORKER_NAME)
    return { read: "unconfigured" };
  try {
    const [[invocations, phases, pages], cpu] = await Promise.all([
      Promise.all(
        (["invocations", "phases", "pages"] as const).map((query) =>
          runQuery(env, fetcher, query, token),
        ),
      ),
      Promise.all(
        cpuPages.flatMap(({ page }) =>
          cpuKinds.map((kind) => runCpuQuery(env, fetcher, page, kind, token)),
        ),
      ),
    ]);
    return {
      read: "ok",
      windowHours: metricsWindowHours,
      invocations: invocations!.map((row) => ({
        invocation: text(row.invocation),
        detail: text(row.detail),
        method: text(row.method),
        outcome: text(row.outcome),
        count: numeric(row.count),
        messages: numeric(row.messages),
        meanMs: numeric(row.mean_ms),
        p50Ms: numeric(row.p50_ms),
        p95Ms: numeric(row.p95_ms),
        p99Ms: numeric(row.p99_ms),
      })),
      phases: phases!.map((row) => ({
        invocation: text(row.invocation),
        phase: text(row.phase),
        operation: text(row.operation),
        outcome: text(row.outcome),
        calls: numeric(row.calls),
        invocations: numeric(row.invocations),
        meanMs: numeric(row.mean_ms),
        p50Ms: numeric(row.p50_ms),
        p95Ms: numeric(row.p95_ms),
        p99Ms: numeric(row.p99_ms),
      })),
      pages: pages!.map((row) => ({
        page: text(row.page),
        reports: numeric(row.reports),
        measures: Object.fromEntries(
          pageMeasureNames.map((name) => {
            // Senza report con la misura il quantile non ha righe: nessun valore, non zero.
            const value = (level: 75 | 95) =>
              numeric(row[`${name}_reports`]) > 0 ? numeric(row[`${name}_p${level}_ms`]) : null;
            return [name, { p75: value(75), p95: value(95) }];
          }),
        ) as PageRow["measures"],
      })),
      cpu,
    };
  } catch {
    logFailure({ code: "UPSTREAM_UNAVAILABLE", operation: "admin" });
    return { read: "failed" };
  }
}
