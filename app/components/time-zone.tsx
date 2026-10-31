import { createContext, useContext } from "react";

import { useCopy } from "~/components/copy-context";
import { displayTimeZone, formatDate } from "../format";

/** Fuso delle date mostrate: quello scelto nelle Impostazioni, altrimenti il predefinito. */
export const TimeZoneContext = createContext<string>(displayTimeZone);

export function useTimeZone() {
  return useContext(TimeZoneContext);
}

/** Date nella lingua della pagina e nel fuso dell'utente. */
export function useDate() {
  const { language } = useCopy();
  const zone = useTimeZone();
  return (value: string, style: "date" | "dateTime" | "time" = "dateTime") =>
    formatDate(value, language, style, zone);
}
