import { logFailure } from "../errors";
import { readBounded } from "../integrations/http.server";
import { metricSql, type MetricQuery } from "../metrics-queries";

// Token API facoltativo con il solo permesso Account Analytics Read: senza, la sezione resta
// non configurata. Dichiararlo con `bindings.secret()` lo renderebbe obbligatorio.
declare global {
  namespace Cloudflare {
    interface Env {
      ANALYTICS_READ_TOKEN?: string;
    }
  }
}

/**
 * Prestazioni nella console: le query di `metrics-queries.ts` sulla SQL API di Analytics Engine,
 * per le ultime 24 ore del dataset dell'ambiente. I valori sono stime pesate con il campionamento,
 * non conteggi esatti; una lettura non riuscita resta indicata come tale, mai come zero.
 */

export const metricsWindowHours = 24;

/** Attesa della lettura: la console non resta ferma su Analytics Engine. */
const timeoutMs = 8_000;

/** Le risposte delle tre query occupano pochi kilobyte. */
const maxBytes = 262_144;

export type InvocationRow = {
  invocation: string;
  detail: string;
  method: string;
  outcome: string;
  count: number;
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
    | "ttfb"
    | "fcp"
    | "lcp"
    | "ready"
    | "server_auth"
    | "server_d1"
    | "server_ebay"
    | "server_render",
    { p75: number | null; p95: number | null }
  >;
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
  "server_render",
] as const;

async function runQuery(
  env: Env,
  fetcher: typeof fetch,
  query: MetricQuery,
  token: string,
): Promise<Row[]> {
  const response = await fetcher(
    `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/analytics_engine/sql`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "text/plain" },
      body: metricSql(query, env.METRICS_DATASET, metricsWindowHours),
      signal: AbortSignal.timeout(timeoutMs),
    },
  );
  const body = await readBounded(response, maxBytes);
  if (!response.ok || !body) throw new Error("METRICS_UNAVAILABLE");
  const parsed = JSON.parse(new TextDecoder().decode(body)) as { data?: unknown };
  if (!Array.isArray(parsed.data)) throw new Error("METRICS_UNAVAILABLE");
  return parsed.data as Row[];
}

export async function readTechnicalMetrics(
  env: Env,
  fetcher: typeof fetch,
): Promise<TechnicalMetrics> {
  const token = env.ANALYTICS_READ_TOKEN;
  if (!token || !env.CLOUDFLARE_ACCOUNT_ID || !env.METRICS_DATASET) return { read: "unconfigured" };
  try {
    const [invocations, phases, pages] = await Promise.all(
      (["invocations", "phases", "pages"] as const).map((query) =>
        runQuery(env, fetcher, query, token),
      ),
    );
    return {
      read: "ok",
      windowHours: metricsWindowHours,
      invocations: invocations!.map((row) => ({
        invocation: text(row.invocation),
        detail: text(row.detail),
        method: text(row.method),
        outcome: text(row.outcome),
        count: numeric(row.count),
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
    };
  } catch {
    logFailure({ code: "UPSTREAM_UNAVAILABLE", operation: "admin" });
    return { read: "failed" };
  }
}
