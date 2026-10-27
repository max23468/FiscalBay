import { useCopy } from "~/components/copy-context";
import { adminCopy } from "../../copy/admin-copy";
import { displayTimeZone, formatDate } from "../../format";
import { formatAmount, locales, localizedPath, type Language } from "../../i18n";

const percentOptions = { style: "percent", maximumFractionDigits: 1 } as const;
const percents: Record<Language, Intl.NumberFormat> = {
  it: new Intl.NumberFormat(locales.it, percentOptions),
  en: new Intl.NumberFormat(locales.en, percentOptions),
};

/** Testi della console e funzioni di formato nella lingua della pagina. */
export function useAdmin() {
  const { language } = useCopy();
  return {
    t: adminCopy[language],
    language,
    date: (value: string | null, style: "date" | "dateTime" = "dateTime") =>
      value ? formatDate(value, language, style) : "",
    money: (cents: number, currency = "eur") =>
      formatAmount(cents, currency.toUpperCase(), language),
    percent: (share: number) => percents[language].format(share),
    href: (path = "") => localizedPath(language, `/admin${path ? `/${path}` : ""}`),
  };
}

const wallClock = new Intl.DateTimeFormat("en-US", {
  timeZone: displayTimeZone,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

/** Istante come valore di un campo `datetime-local`, nel fuso della console. */
export function localValue(iso: string | null) {
  if (!iso) return "";
  const parts = Object.fromEntries(
    wallClock.formatToParts(new Date(iso)).map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
