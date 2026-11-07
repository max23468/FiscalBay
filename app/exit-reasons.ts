/**
 * Motivi di uscita (D314), senza dipendenze: li usano il modulo della cancellazione dell'account,
 * il server e la console. I primi sei hanno lo stesso codice delle opzioni del portale Stripe;
 * `closing_business` esiste soltanto nella cancellazione dell'account.
 */
export const exitReasons = [
  "too_expensive",
  "unused",
  "switched_service",
  "missing_features",
  "low_quality",
  "closing_business",
  "other",
] as const;

export type ExitReason = (typeof exitReasons)[number];

/** Lunghezza massima del commento facoltativo. */
export const maxExitComment = 500;

export function isExitReason(value: unknown): value is ExitReason {
  return (exitReasons as readonly unknown[]).includes(value);
}
