/**
 * Query delle metriche tecniche per la SQL API di Workers Analytics Engine, comuni alla console
 * e a `scripts/metrics-query.mjs`. Analytics Engine campiona in scrittura e in lettura: ogni
 * conteggio, somma, media e quantile è pesato con `_sample_interval`, e il risultato è una stima
 * con finestra dichiarata, mai una base per quote, billing o controlli di accesso. La disposizione
 * dei campi è descritta in `metrics.server.ts`.
 */

export const metricQueries = ["invocations", "phases", "pages"] as const;

/**
 * Richiesta del campione controllato di `scripts/metrics-query.mjs`: `HEAD` sul percorso dei
 * report del browser, che risponde 405 senza effetti. Nessuna pagina la usa: il Worker la
 * registra con la classe `sample`, così il conteggio del campione non include altro traffico.
 */
export const samplePath = "/api/v1/page-timing";
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
 *   tipo di messaggio e del cron. L'unità è l'invocazione: numero stimato, durata media e quantili
 *   valgono per invocazione, anche quando un gruppo della coda porta più messaggi, contati a
 *   parte in `messages`;
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
  SUM(_sample_interval) AS count,
  SUM(_sample_interval * double1) AS messages,
  SUM(_sample_interval * double2) / SUM(_sample_interval) AS mean_ms,
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

/**
 * Pagine dell'app di cui si legge il tempo CPU: le stesse dei report del browser. `excluded`:
 * segmento del dettaglio che appartiene a un'altra route, come il collegamento di un negozio.
 */
export const cpuPages = [
  { page: "orders", path: "app/ordini", excluded: null },
  { page: "stores", path: "app/negozi", excluded: "collega" },
] as const;
export const cpuKinds = ["document", "data"] as const;
export type CpuPage = (typeof cpuPages)[number]["page"];
export type CpuKind = (typeof cpuKinds)[number];

/** Finestra massima: i Workers Logs conservano sette giorni. */
export const maxCpuWindowHours = 7 * 24;

/** Nome del Worker, come in `cloudflare.config.ts`. */
const servicePattern = /^[a-z][a-z0-9-]{0,62}$/u;

/** Carattere di un segmento del dettaglio: niente separatori, query o estensione `.data`. */
const segmentChar = "[^/?.]";

/**
 * Segmento del dettaglio diverso da `word`, senza lookahead: la regex dei Workers Logs (RE2) non
 * li ammette. Un segmento diverso è un prefisso proprio di `word`, diverge da `word` in un punto
 * oppure la prolunga.
 */
function segmentOtherThan(word: string) {
  const alternatives = [...word].flatMap((char, index) => [
    `${word.slice(0, index)}[^/?.${char}]${segmentChar}*`,
    ...(index > 0 ? [word.slice(0, index)] : []),
  ]);
  return `(?:${[...alternatives, `${word}${segmentChar}+`].join("|")})`;
}

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
  const { path, excluded } = cpuPages.find((entry) => entry.page === page)!;
  const suffix = kind === "data" ? String.raw`\.data` : "";
  const detail = excluded ? segmentOtherThan(excluded) : `${segmentChar}+`;
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
          value: String.raw`^https://[^/]+(/en)?/${path}(/${detail})?${suffix}(\?.*)?$`,
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
 * quella attesa: una lettura non riuscita, mai zero. Senza invocazioni i quantili non hanno
 * righe: nessun valore, non zero.
 */
export function cpuValues(calculations: unknown) {
  if (!Array.isArray(calculations)) return null;
  /** Valore del calcolo; null senza righe, undefined se manca o non è un numero. */
  const value = (alias: string) => {
    const calculation = calculations.find(
      (entry) => (entry as { alias?: unknown } | null)?.alias === alias,
    ) as { aggregates?: unknown } | undefined;
    if (!Array.isArray(calculation?.aggregates)) return undefined;
    if (calculation.aggregates.length === 0) return null;
    const raw = (calculation.aggregates[0] as { value?: unknown } | null)?.value;
    const number = typeof raw === "number" || typeof raw === "string" ? Number(raw) : Number.NaN;
    return Number.isFinite(number) ? number : undefined;
  };
  const invocations = value("invocations");
  if (invocations === undefined) return null;
  if (!invocations) return { invocations: 0, cpuP50Ms: null, cpuP95Ms: null, wallP50Ms: null };
  const [cpuP50Ms, cpuP95Ms, wallP50Ms] = ["cpu_p50_ms", "cpu_p95_ms", "wall_p50_ms"].map(value);
  if ([cpuP50Ms, cpuP95Ms, wallP50Ms].some((measure) => measure === undefined || measure === null))
    return null;
  return { invocations, cpuP50Ms: cpuP50Ms!, cpuP95Ms: cpuP95Ms!, wallP50Ms: wallP50Ms! };
}
