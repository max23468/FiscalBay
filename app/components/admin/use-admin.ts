import { useCopy } from "~/components/copy-context";
import { adminCopy } from "../../copy/admin-copy";
import { displayTimeZone, formatDate, formatPercent } from "../../format";
import { formatAmount, localizedPath } from "../../i18n";
import { wallClock } from "../../time";

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
    percent: (share: number) => formatPercent(share, language),
    href: (path = "") => localizedPath(language, `/admin${path ? `/${path}` : ""}`),
  };
}

/** Istante come valore di un campo `datetime-local`, nel fuso della console. */
export function localValue(iso: string | null) {
  if (!iso) return "";
  const parts = wallClock(new Date(iso), displayTimeZone);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
