/**
 * Tempi del lavoro asincrono, letti dallo smistamento del cron, dall'ingresso dei webhook e
 * dalla console: un modulo senza dipendenze, così chi li legge non dipende da chi li usa.
 */

export const minute = 60_000;

/**
 * Durata di un blocco su un lavoro in esecuzione: un consumer della coda o un compito del cron
 * non dura di più, quindi allo scadere il blocco di un'esecuzione interrotta si libera.
 */
export const workLockMilliseconds = 15 * minute;

/**
 * Termine del blocco preso all'istante `now`. Il valore scritto è anche il segno di chi tiene
 * il blocco: rilascio e proroga lo confrontano, così chi l'ha perso allo scadere non tocca
 * quello preso dopo da un altro consumer.
 */
export const workLockUntil = (now: Date) =>
  new Date(now.getTime() + workLockMilliseconds).toISOString();

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
 * Attesa in millisecondi dopo il tentativo `attempts`, contato da 1: raddoppia da `base` a ogni
 * tentativo fino a `cap`. Un'attesa indicata dal provider, in secondi, vale al suo posto.
 */
export function backoffMs(
  attempts: number,
  base: number,
  cap: number,
  retryAfterSeconds?: number,
): number {
  return retryAfterSeconds === undefined
    ? Math.min(cap, base * 2 ** (attempts - 1))
    : retryAfterSeconds * 1000;
}

/**
 * Attesa in secondi prima di ripetere un messaggio della coda non riuscito: raddoppia da 30
 * secondi a ogni tentativo, fino a un'ora.
 */
export function queueRetryDelay(attempts: number): number {
  return backoffMs(attempts, 30_000, 60 * minute) / 1000;
}
