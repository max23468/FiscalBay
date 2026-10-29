/**
 * Log del Worker: un oggetto JSON per messaggio, con eventi e chiavi da elenchi chiusi e valori
 * scalari. Workers Logs e l'archivio a 90 giorni li conservano così come sono, quindi qui non
 * entrano mai errori serializzati, richieste, header, payload o dati dell'utente; la verifica
 * dell'archivio (`scripts/log-archive.mjs`) segnala ogni messaggio esportato fuori da questi elenchi.
 */
export const logEvents = ["application_error", "phase", "stale_order_observation"] as const;

export const logKeys = [
  "event",
  "code",
  "operation",
  "correlationId",
  "failure",
  "status",
  "phase",
  "count",
] as const;

type LogRecord = { event: (typeof logEvents)[number] } & Partial<
  Record<Exclude<(typeof logKeys)[number], "event">, string | number>
>;

export function writeLog(level: "log" | "info" | "error", record: LogRecord): void {
  console[level](JSON.stringify(record));
}
