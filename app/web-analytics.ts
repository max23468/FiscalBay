/**
 * Cloudflare Web Analytics sulle sole pagine pubbliche (D241): nessun cookie né impronta del
 * browser, quindi nessun consenso da chiedere. Il beacon conta il caricamento del documento.
 */
export const webAnalyticsScript = "https://static.cloudflareinsights.com/beacon.min.js";

/** Raccolta dei dati quando il beacon non li invia all'origine, come fuori dalla rete Cloudflare. */
export const webAnalyticsCollector = "https://cloudflareinsights.com";

/**
 * Configurazione del beacon. Le pagine pubbliche si collegano con link normali, quindi ogni
 * pagina vista è un nuovo documento: senza il rilevamento delle navigazioni client il beacon non
 * segue chi passa dal sito all'area dell'account.
 */
export function webAnalyticsBeacon(token: string): string {
  return JSON.stringify({ token, spa: false });
}
