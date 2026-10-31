/** Cifre decimali della valuta secondo ISO 4217 (EUR 2, JPY 0). */
export function currencyExponent(currency: string): number {
  if (!/^[A-Z]{3}$/u.test(currency)) throw new RangeError("invalid_currency");
  return new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
    .maximumFractionDigits!;
}

/**
 * Converte un importo decimale della fonte in unità minori, senza arrotondare: decimali oltre
 * l'esponente della valuta sono accettati solo se zero.
 */
export function parseMinor(value: string, currency: string): number {
  const match = /^(\d+)(?:\.(\d+))?$/u.exec(value);
  if (!match) throw new RangeError("invalid_amount");
  const exponent = currencyExponent(currency);
  const decimals = (match[2] ?? "").replace(/0+$/u, "");
  if (decimals.length > exponent) throw new RangeError("inexact_amount");
  const minor = Number(match[1] + decimals.padEnd(exponent, "0"));
  if (!Number.isSafeInteger(minor)) throw new RangeError("invalid_amount");
  return minor;
}

/** Importo decimale esatto, per export e testi non localizzati. */
export function minorToDecimal(minor: number, currency: string): string {
  const exponent = currencyExponent(currency);
  if (!Number.isSafeInteger(minor) || minor < 0) throw new RangeError("invalid_amount");
  if (exponent === 0) return String(minor);
  const digits = String(minor).padStart(exponent + 1, "0");
  return `${digits.slice(0, -exponent)}.${digits.slice(-exponent)}`;
}
