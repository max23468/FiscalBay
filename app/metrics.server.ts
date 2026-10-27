import type { ErrorCode } from "./errors";
import type { Phase, PhaseOperation } from "./observability.server";
import type { TimedPage } from "./page-timing";

/**
 * Metriche tecniche su Workers Analytics Engine (§31): contatori e istogrammi per esito e
 * latenza, con le fasi Auth, D1, eBay e rendering separate, in un dataset per ambiente. Ogni
 * campo viene da un elenco chiuso: mai CF, buyer, email, ID utente, URL o query. Analytics
 * Engine non deduplica e campiona: i KPI che devono resistere a retry restano eventi in D1.
 *
 * Disposizione dei punti, letta dalle query di `metrics-queries.server.ts`:
 * - `index1` = `blob1:blob2`, chiave del campionamento equo;
 * - `blob1` famiglia (`invocation`, `phase`, `page`), `blob2` invocazione (`http`, `queue`,
 *   `cron`, `browser`), `blob3` dettaglio (classe della route, tipo di messaggio, fase o
 *   pagina), `blob4` operazione della fase o metodo HTTP, `blob5` esito, `blob6` versione del
 *   Worker;
 * - invocazioni e fasi: `double1` conteggio, `double2` durata totale e `double3` durata massima,
 *   in millisecondi; una richiesta HTTP dura fino alla risposta pronta, senza lo streaming del
 *   corpo;
 * - pagine: `double1` TTFB, `double2` FCP, `double3` LCP, `double4` pronta, `double5`..`double8`
 *   fasi del server Auth, D1, eBay e rendering, in millisecondi; -1 per una misura assente.
 */

export type Invocation = "http" | "queue" | "cron";

export type InvocationDetail =
  | "document"
  | "data"
  | "api"
  | "webhook"
  | "sync"
  | "task"
  | "export"
  | "unknown"
  | "dispatch";

export type InvocationOutcome = "2xx" | "3xx" | "4xx" | "5xx" | "ok" | "retry" | "error";

const methods = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] as const;

export type MetricPoint = { index: string; blobs: string[]; doubles: number[] };

/** Misura assente in un report del browser. */
export const absentValue = -1;

/** Un'invocazione scrive pochi punti; il limite di Analytics Engine è 250. */
const maxPointsPerWrite = 100;

/** Valori ammessi nei campi testuali: identificativi brevi, mai testo libero. */
const allowedBlob = /^[A-Za-z0-9_.:-]{0,64}$/u;

/** Versione del Worker distribuita: soltanto un UUID, altrimenti vuota. */
const versionValue = (version: string | undefined) =>
  version && /^[0-9a-f-]{36}$/u.test(version) ? version : "";

const milliseconds = (value: number) =>
  Number.isFinite(value) && value >= 0 ? Math.round(value * 10) / 10 : 0;

function point(
  family: "invocation" | "phase" | "page",
  invocation: Invocation | "browser",
  fields: { detail: string; operation: string; outcome: string; version?: string },
  doubles: number[],
): MetricPoint {
  return {
    index: `${family}:${invocation}`,
    blobs: [
      family,
      invocation,
      fields.detail,
      fields.operation,
      fields.outcome,
      versionValue(fields.version),
    ],
    doubles,
  };
}

export function invocationPoint(input: {
  invocation: Invocation;
  detail: InvocationDetail;
  method?: string;
  outcome: InvocationOutcome;
  count?: number;
  durationMs: number;
  version?: string;
}): MetricPoint {
  const method =
    input.method === undefined
      ? ""
      : (methods as readonly string[]).includes(input.method)
        ? input.method
        : "OTHER";
  const duration = milliseconds(input.durationMs);
  return point(
    "invocation",
    input.invocation,
    { detail: input.detail, operation: method, outcome: input.outcome, version: input.version },
    [Math.max(1, input.count ?? 1), duration, duration],
  );
}

export function phasePoint(input: {
  invocation: Invocation;
  phase: Phase;
  operation: PhaseOperation;
  outcome: "ok" | ErrorCode;
  count: number;
  totalMs: number;
  maxMs: number;
  version?: string;
}): MetricPoint {
  return point(
    "phase",
    input.invocation,
    {
      detail: input.phase,
      operation: input.operation,
      outcome: input.outcome,
      version: input.version,
    },
    [input.count, milliseconds(input.totalMs), milliseconds(input.maxMs)],
  );
}

/** Report del browser già validato: durate intere e limitate, fasi da elenco chiuso. */
export function pagePoint(input: {
  page: TimedPage;
  ttfb: number;
  fcp?: number;
  lcp?: number;
  ready: number;
  server: Partial<Record<Phase, number>>;
  version?: string;
}): MetricPoint {
  const value = (measure: number | undefined) => measure ?? absentValue;
  return point(
    "page",
    "browser",
    { detail: input.page, operation: "", outcome: "ok", version: input.version },
    [
      input.ttfb,
      value(input.fcp),
      value(input.lcp),
      input.ready,
      value(input.server.auth),
      value(input.server.d1),
      value(input.server.ebay),
      value(input.server.render),
    ],
  );
}

/**
 * Scrive i punti senza mai interrompere l'invocazione: senza dataset (pagina provvisoria,
 * sviluppo) o con un campo fuori elenco il punto non parte.
 */
export function writePoints(dataset: AnalyticsEngineDataset | undefined, points: MetricPoint[]) {
  if (!dataset) return;
  for (const entry of points.slice(0, maxPointsPerWrite)) {
    if (!entry.blobs.every((blob) => allowedBlob.test(blob))) continue;
    if (!entry.doubles.every((double) => Number.isFinite(double))) continue;
    try {
      dataset.writeDataPoint({
        indexes: [entry.index],
        blobs: entry.blobs,
        doubles: entry.doubles,
      });
    } catch {
      // Una scrittura rifiutata non cambia l'esito dell'invocazione misurata.
    }
  }
}
