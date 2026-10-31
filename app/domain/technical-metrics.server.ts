import { z } from "zod";

import { logFailure } from "../errors";
import { readUpstream, UpstreamError } from "../integrations/http.server";
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

/** La SQL API restituisce gli interi grandi come testo e le medie su zero righe come `nan`. */
const numeric = z.coerce.number().catch(0);
const text = z.string().catch("");

const invocationSchema = z
  .object({
    invocation: text,
    detail: text,
    method: text,
    outcome: text,
    count: numeric,
    messages: numeric,
    mean_ms: numeric,
    p50_ms: numeric,
    p95_ms: numeric,
    p99_ms: numeric,
  })
  .transform((row): InvocationRow => ({
    invocation: row.invocation,
    detail: row.detail,
    method: row.method,
    outcome: row.outcome,
    count: row.count,
    messages: row.messages,
    meanMs: row.mean_ms,
    p50Ms: row.p50_ms,
    p95Ms: row.p95_ms,
    p99Ms: row.p99_ms,
  }));

const phaseSchema = z
  .object({
    invocation: text,
    phase: text,
    operation: text,
    outcome: text,
    calls: numeric,
    invocations: numeric,
    mean_ms: numeric,
    p50_ms: numeric,
    p95_ms: numeric,
    p99_ms: numeric,
  })
  .transform((row): PhaseRow => ({
    invocation: row.invocation,
    phase: row.phase,
    operation: row.operation,
    outcome: row.outcome,
    calls: row.calls,
    invocations: row.invocations,
    meanMs: row.mean_ms,
    p50Ms: row.p50_ms,
    p95Ms: row.p95_ms,
    p99Ms: row.p99_ms,
  }));

const pageSchema = z.looseObject({ page: text, reports: numeric }).transform((row): PageRow => {
  // Senza report con la misura il quantile non ha righe: nessun valore, non zero.
  const measure = (name: keyof PageRow["measures"]) => {
    const value = (level: 75 | 95) =>
      numeric.parse(row[`${name}_reports`]) > 0 ? numeric.parse(row[`${name}_p${level}_ms`]) : null;
    return { p75: value(75), p95: value(95) };
  };
  return {
    page: row.page,
    reports: row.reports,
    measures: {
      ttfb: measure("ttfb"),
      fcp: measure("fcp"),
      lcp: measure("lcp"),
      ready: measure("ready"),
      server_auth: measure("server_auth"),
      server_d1: measure("server_d1"),
      server_ebay: measure("server_ebay"),
    },
  };
});

/** Righe di ogni query della SQL API. */
const querySchemas = {
  invocations: invocationSchema,
  phases: phaseSchema,
  pages: pageSchema,
} satisfies Record<MetricQuery, z.ZodType>;

const telemetrySchema = z.object({ result: z.object({ calculations: z.unknown() }) });

/** Risposta letta e validata con lo schema: un payload diverso è una risposta non valida. */
async function readJson<Schema extends z.ZodType>(
  fetcher: typeof fetch,
  url: string,
  init: RequestInit,
  token: string,
  schema: Schema,
): Promise<z.infer<Schema>> {
  const { text } = await readUpstream(
    fetcher,
    url,
    { ...init, method: "POST", headers: { ...init.headers, authorization: `Bearer ${token}` } },
    { timeoutMs, maxBytes },
  );
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new UpstreamError("invalid_response");
  }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) throw new UpstreamError("invalid_response");
  return parsed.data;
}

async function runQuery<Query extends MetricQuery>(
  env: Env,
  fetcher: typeof fetch,
  query: Query,
  token: string,
): Promise<z.infer<(typeof querySchemas)[Query]>[]> {
  const { data } = await readJson(
    fetcher,
    `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/analytics_engine/sql`,
    {
      headers: { "content-type": "text/plain" },
      body: metricSql(query, env.METRICS_DATASET, metricsWindowHours),
    },
    token,
    z.object({ data: z.array(querySchemas[query]) }),
  );
  return data;
}

async function runCpuQuery(
  env: Env,
  fetcher: typeof fetch,
  page: CpuPage,
  kind: CpuKind,
  token: string,
): Promise<CpuRow> {
  const { result } = await readJson(
    fetcher,
    `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/workers/observability/telemetry/query`,
    {
      headers: { "content-type": "application/json" },
      body: JSON.stringify(pageCpuQuery(env.WORKER_NAME, page, kind, metricsWindowHours)),
    },
    token,
    telemetrySchema,
  );
  const values = cpuValues(result.calculations);
  if (!values) throw new UpstreamError("invalid_response");
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
    const [invocations, phases, pages, cpu] = await Promise.all([
      runQuery(env, fetcher, "invocations", token),
      runQuery(env, fetcher, "phases", token),
      runQuery(env, fetcher, "pages", token),
      Promise.all(
        cpuPages.flatMap(({ page }) =>
          cpuKinds.map((kind) => runCpuQuery(env, fetcher, page, kind, token)),
        ),
      ),
    ]);
    return { read: "ok", windowHours: metricsWindowHours, invocations, phases, pages, cpu };
  } catch (error) {
    logFailure({ error, code: "UPSTREAM_UNAVAILABLE", operation: "admin" });
    return { read: "failed" };
  }
}
