import { useEffect } from "react";
import { useRouteLoaderData } from "react-router";

import { carrySource } from "../signup-source";

/** Provenienza calcolata dal Worker (D303), applicata alla pagina dopo l'avvio. */
export function SourceLinks() {
  const arrival = useRouteLoaderData<{ arrival: string | null }>("root")?.arrival ?? null;
  useEffect(() => (arrival ? carrySource(arrival, window) : undefined), [arrival]);
  return null;
}
