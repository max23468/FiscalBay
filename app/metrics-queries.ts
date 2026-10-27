/**
 * Query delle metriche tecniche per la SQL API di Workers Analytics Engine, comuni alla console
 * e a `scripts/metrics-query.mjs`. Analytics Engine campiona in scrittura e in lettura: ogni
 * conteggio, somma, media e quantile è pesato con `_sample_interval`, e il risultato è una stima
 * con finestra dichiarata, mai una base per quote, billing o controlli di accesso. La disposizione
 * dei campi è descritta in `metrics.server.ts`.
 */

export const metricQueries = ["invocations", "phases", "pages"] as const;
export type MetricQuery = (typeof metricQueries)[number];

/** Finestra massima: la retention di Analytics Engine è di tre mesi. */
export const maxWindowHours = 90 * 24;

/** Nome del dataset: identificativo SQL semplice, come quelli di `cloudflare.config.ts`. */
const datasetPattern = /^[a-z][a-z0-9_]{0,62}$/u;

/** Quantili con il peso del campionamento; con peso nullo una riga resta fuori dal calcolo. */
const quantiles = (value: string) =>
  [0.5, 0.95, 0.99]
    .map(
      (level) =>
        `quantileExactWeighted(${level})(${value}, _sample_interval) AS p${Math.round(level * 100)}_ms`,
    )
    .join(",\n  ");

/**
 * Misura facoltativa di un report del browser: -1 quando assente, con peso nullo nei quantili e
 * nel numero stimato di report che la portano.
 */
const present = (column: string) => `if(${column} >= 0, _sample_interval, 0)`;

const pageMeasures = [
  ["ttfb", "double1"],
  ["fcp", "double2"],
  ["lcp", "double3"],
  ["ready", "double4"],
  ["server_auth", "double5"],
  ["server_d1", "double6"],
  ["server_ebay", "double7"],
] as const;

/**
 * Testo SQL di una query sulla finestra delle ultime `hours` ore.
 * - `invocations`: richieste HTTP per classe di route, metodo ed esito, invocazioni della coda per
 *   tipo di messaggio e del cron, con numero stimato, durata media e quantili;
 * - `phases`: per invocazione, fase, operazione ed esito il numero stimato di misure, di
 *   invocazioni che le contengono e il tempo per invocazione speso nella fase;
 * - `pages`: per pagina il numero stimato di report e, per ogni misura del browser e fase del
 *   server letta da `Server-Timing`, i report che la portano e i quantili 75 e 95.
 * Il rendering non è una fase: l'orologio del Worker resta fermo durante il calcolo, quindi la sua
 * durata si legge come tempo CPU dai Workers Logs (`pageCpuQuery`).
 */
export function metricSql(query: MetricQuery, dataset: string, hours: number): string {
  if (!datasetPattern.test(dataset)) throw new Error("INVALID_DATASET");
  if (!Number.isInteger(hours) || hours < 1 || hours > maxWindowHours)
    throw new Error("INVALID_WINDOW");
  const window = `timestamp > NOW() - INTERVAL '${hours}' HOUR`;
  switch (query) {
    case "invocations":
      return `SELECT
  blob2 AS invocation,
  blob3 AS detail,
  blob4 AS method,
  blob5 AS outcome,
  SUM(_sample_interval * double1) AS count,
  SUM(_sample_interval * double2) / SUM(_sample_interval * double1) AS mean_ms,
  ${quantiles("double2")}
FROM ${dataset}
WHERE blob1 = 'invocation' AND ${window}
GROUP BY invocation, detail, method, outcome
ORDER BY invocation, detail, method, outcome
FORMAT JSON`;
    case "phases":
      return `SELECT
  blob2 AS invocation,
  blob3 AS phase,
  blob4 AS operation,
  blob5 AS outcome,
  SUM(_sample_interval * double1) AS calls,
  SUM(_sample_interval) AS invocations,
  SUM(_sample_interval * double2) / SUM(_sample_interval) AS mean_ms,
  ${quantiles("double2")}
FROM ${dataset}
WHERE blob1 = 'phase' AND ${window}
GROUP BY invocation, phase, operation, outcome
ORDER BY invocation, phase, operation, outcome
FORMAT JSON`;
    case "pages":
      return `SELECT
  blob3 AS page,
  SUM(_sample_interval) AS reports,
  ${pageMeasures
    .flatMap(([name, column]) => [
      `SUM(${present(column)}) AS ${name}_reports`,
      `quantileExactWeighted(0.75)(${column}, ${present(column)}) AS ${name}_p75_ms`,
      `quantileExactWeighted(0.95)(${column}, ${present(column)}) AS ${name}_p95_ms`,
    ])
    .join(",\n  ")}
FROM ${dataset}
WHERE blob1 = 'page' AND ${window}
GROUP BY page
ORDER BY page
FORMAT JSON`;
  }
}

/** Pagine dell'app di cui si legge il tempo CPU: le stesse dei report del browser. */
export const cpuPages = [
  { page: "orders", path: "app/ordini" },
  { page: "stores", path: "app/negozi" },
] as const;
export const cpuKinds = ["document", "data"] as const;
export type CpuPage = (typeof cpuPages)[number]["page"];
export type CpuKind = (typeof cpuKinds)[number];

/** Finestra massima: i Workers Logs conservano sette giorni. */
export const maxCpuWindowHours = 7 * 24;

/** Nome del Worker, come in `cloudflare.config.ts`. */
const servicePattern = /^[a-z][a-z0-9-]{0,62}$/u;

/**
 * Corpo della query Telemetry dei Workers Logs sul tempo CPU delle richieste GET di una pagina,
 * documento o dati (`.data`), anche in inglese e con il dettaglio nel percorso: numero di
 * invocazioni, CPU mediana e al 95° percentile, durata mediana. I log sono tutti conservati
 * (campionamento 1), quindi i valori non sono stime; l'indirizzo resta nel filtro, mai nel
 * risultato. La CPU comprende il rendering e il resto del calcolo della richiesta, senza le attese
 * di D1 ed eBay.
 */
export function pageCpuQuery(
  service: string,
  page: CpuPage,
  kind: CpuKind,
  hours: number,
  now = Date.now(),
) {
  if (!servicePattern.test(service)) throw new Error("INVALID_SERVICE");
  if (!Number.isInteger(hours) || hours < 1 || hours > maxCpuWindowHours)
    throw new Error("INVALID_WINDOW");
  const { path } = cpuPages.find((entry) => entry.page === page)!;
  const suffix = kind === "data" ? String.raw`\.data` : "";
  return {
    queryId: `page-cpu-${page}-${kind}`,
    view: "calculations",
    chartType: "aggregate",
    timeframe: { from: now - hours * 3_600_000, to: now },
    parameters: {
      datasets: ["cloudflare-workers"],
      filterCombination: "and",
      filters: [
        { key: "$metadata.service", operation: "eq", type: "string", value: service },
        { key: "$workers.event.request.method", operation: "eq", type: "string", value: "GET" },
        {
          key: "$workers.event.request.url",
          operation: "regex",
          type: "string",
          value: String.raw`^https://[^/]+(/en)?/${path}(/[^/?.]+)?${suffix}(\?.*)?$`,
        },
      ],
      calculations: [
        { operator: "count", alias: "invocations" },
        { key: "$workers.cpuTimeMs", keyType: "number", operator: "median", alias: "cpu_p50_ms" },
        { key: "$workers.cpuTimeMs", keyType: "number", operator: "p95", alias: "cpu_p95_ms" },
        { key: "$workers.wallTimeMs", keyType: "number", operator: "median", alias: "wall_p50_ms" },
      ],
    },
  };
}

/**
 * Valori di una risposta di `pageCpuQuery` (`result.calculations`), null quando la forma non è
 * quella attesa. Senza invocazioni i quantili non hanno righe: nessun valore, non zero.
 */
export function cpuValues(calculations: unknown) {
  if (!Array.isArray(calculations)) return null;
  const value = (alias: string) => {
    const calculation = calculations.find(
      (entry) => (entry as { alias?: unknown } | null)?.alias === alias,
    ) as { aggregates?: unknown } | undefined;
    const [aggregate] = Array.isArray(calculation?.aggregates) ? calculation.aggregates : [];
    const number = Number((aggregate as { value?: unknown } | undefined)?.value);
    return Number.isFinite(number) ? number : 0;
  };
  const invocations = value("invocations");
  const measured = (alias: string) => (invocations > 0 ? value(alias) : null);
  return {
    invocations,
    cpuP50Ms: measured("cpu_p50_ms"),
    cpuP95Ms: measured("cpu_p95_ms"),
    wallP50Ms: measured("wall_p50_ms"),
  };
}
