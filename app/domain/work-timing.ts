/**
 * Tempi del lavoro asincrono, letti dallo smistamento del cron, dall'ingresso dei webhook e
 * dalla console: un modulo senza dipendenze, così chi li legge non dipende da chi li usa.
 */

const minute = 60_000;

/** Periodo di ogni compito periodico smistato dal cron. */
export const taskPeriods = {
  maintenance: 24 * 60 * minute,
  export_files: 60 * minute,
  token_refresh: 10 * minute,
  inactivity: 60 * minute,
  billing: 60 * minute,
  telegram: 10 * minute,
  telegram_commands: 24 * 60 * minute,
  ebay_quotas: 60 * minute,
  owner_incidents: 10 * minute,
  account_deletion: 10 * minute,
} as const;

export type ScheduledTask = keyof typeof taskPeriods;

/** Ricevute ferme da più di un'ora, considerate in ritardo dalla console. */
export const stalledReceiptMilliseconds = 60 * minute;

/**
 * Attesa in secondi prima di ripetere un messaggio della coda non riuscito: raddoppia da 30
 * secondi a ogni tentativo, fino a un'ora.
 */
export function queueRetryDelay(attempts: number): number {
  return Math.min(3600, 30 * 2 ** (attempts - 1));
}
