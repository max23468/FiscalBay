/**
 * Log del Worker: un oggetto JSON per messaggio, con eventi e chiavi da elenchi chiusi e valori
 * scalari. Workers Logs e l'archivio a 90 giorni li conservano così come sono, quindi qui non
 * entrano mai errori serializzati, richieste, header, payload o dati dell'utente; la verifica
 * dell'archivio (`scripts/log-archive.mjs`) segnala ogni messaggio esportato fuori da questi elenchi.
 */
export const logEvents = [
  "application_error",
  "phase",
  "stale_order_observation",
  "csp_violation",
] as const;

export const logKeys = [
  "event",
  "code",
  "operation",
  "correlationId",
  "failure",
  "status",
  "phase",
  "count",
  // Violazioni della CSP (`csp-report.server.ts`): direttiva, modalità, risorsa e posizione,
  // ridotte a origini, percorsi brevi e parole chiave.
  "directive",
  "disposition",
  "blocked",
  "source",
  "line",
  "column",
  "page",
  "sample",
] as const;

type LogRecord = { event: (typeof logEvents)[number] } & Partial<
  Record<Exclude<(typeof logKeys)[number], "event">, string | number>
>;

export function writeLog(level: "log" | "info" | "error", record: LogRecord): void {
  console[level](JSON.stringify(record));
}
