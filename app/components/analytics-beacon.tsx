import { useRouteLoaderData } from "react-router";

import { useScriptNonce } from "~/components/script-nonce";

import { webAnalyticsBeacon, webAnalyticsScript } from "../web-analytics";

/**
 * Beacon delle statistiche del sito, nelle pagine pubbliche e nella demo, se l'ambiente ha il
 * token: conta la visita senza contendere la banda alle risorse della pagina.
 */
export function AnalyticsBeacon() {
  const token = useRouteLoaderData<{ webAnalyticsToken: string | null }>("root")?.webAnalyticsToken;
  const nonce = useScriptNonce();
  return token ? (
    <script
      defer
      src={webAnalyticsScript}
      data-cf-beacon={webAnalyticsBeacon(token)}
      fetchPriority="low"
      nonce={nonce}
      suppressHydrationWarning
    />
  ) : null;
}
