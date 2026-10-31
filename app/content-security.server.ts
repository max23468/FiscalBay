import { webAnalyticsCollector, webAnalyticsScript } from "./web-analytics";

// Widget Turnstile dei moduli che inviano email o richieste di supporto (§29).
const turnstile = "https://challenges.cloudflare.com";

// Immagini delle inserzioni e loghi dei negozi: soli host qualificati da `qualifiedImageUrl`.
const ebayImages = ["https://i.ebayimg.com", "https://i.ebayimg.sandbox.ebay.com"];

/** Nonce casuale di una sola risposta, per gli script inline di React Router e di React. */
export function scriptNonce(): string {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
}

/**
 * CSP dei documenti HTML. Gli script sono soltanto quelli dell'origine e quelli inline con il
 * nonce della risposta; gli stili inline restano ammessi per gli attributi `style` di React e
 * delle animazioni. Gli script esterni sono il widget Turnstile e il beacon di Web Analytics,
 * che invia anche a Cloudflare, e l'unico frame esterno è il widget. `form-action` manca di proposito: i form di accesso,
 * collegamento eBay, Stripe e Telegram finiscono con redirect verso pagine dei provider che a
 * loro volta rimandano altrove, e il browser applicherebbe la direttiva a ogni passaggio.
 */
export function contentSecurityPolicy(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' ${turnstile} ${webAnalyticsScript}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: ${ebayImages.join(" ")}`,
    "font-src 'self'",
    `connect-src 'self' ${webAnalyticsCollector}`,
    `frame-src ${turnstile}`,
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
  ].join("; ");
}
