import { createContext, useContext } from "react";

import { displayTimeZone } from "../view-models";

/** Fuso delle date mostrate: quello scelto nelle Impostazioni, altrimenti il predefinito. */
export const TimeZoneContext = createContext<string>(displayTimeZone);

export function useTimeZone() {
  return useContext(TimeZoneContext);
}
