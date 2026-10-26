import { locales, type Language } from "./i18n";
import type { AddressView } from "./view-models";

/** Fuso di visualizzazione predefinito, finché l'utente non ne sceglie un altro. */
export const displayTimeZone = "Europe/Rome";

export function formatDate(
  value: string,
  language: Language,
  style: "date" | "dateTime" | "time" = "dateTime",
  timeZone: string = displayTimeZone,
): string {
  // Il pattern combinato varia fra versioni ICU (virgola oppure "at" in inglese).
  // Un separatore esplicito conserva lo stesso testo fra server e browser.
  if (style === "dateTime") {
    return `${formatDate(value, language, "date", timeZone)}, ${formatDate(value, language, "time", timeZone)}`;
  }
  const options: Intl.DateTimeFormatOptions =
    style === "date" ? { dateStyle: "medium" } : { timeStyle: "short" };
  // ICU recenti abbreviano settembre in «Sept», quelli precedenti in «Sep».
  return new Intl.DateTimeFormat(locales[language], { ...options, timeZone })
    .format(new Date(value))
    .replace("Sept", "Sep");
}

/** Nome del Paese nella lingua dell'interfaccia, dal codice ISO. */
export function countryName(code: string, language: Language): string {
  return /^[A-Z]{2}$/u.test(code)
    ? (new Intl.DisplayNames(locales[language], { type: "region" }).of(code) ?? code)
    : code;
}

/** Stesse righe per la lettura e la copia, senza separatori per campi assenti. */
export function addressRows(address: AddressView, language: Language): string[] {
  const province = address.province ? `(${address.province})` : "";
  return [
    address.line,
    [address.postalCode, address.city, province].filter(Boolean).join(" "),
    countryName(address.countryCode, language),
  ].filter(Boolean);
}

/** Tempo relativo rispetto a un istante fornito dal server, stabile fra server e browser. */
export function formatRelative(value: string, now: string, language: Language): string {
  const minutes = Math.round((new Date(value).getTime() - new Date(now).getTime()) / 60_000);
  const format = new Intl.RelativeTimeFormat(locales[language], { numeric: "auto" });
  if (Math.abs(minutes) < 60) return format.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return format.format(hours, "hour");
  // ICU usa U+0027 in Safari e U+2019 in Workerd per «l’altro ieri».
  return format.format(Math.round(hours / 24), "day").replaceAll("'", "’");
}
