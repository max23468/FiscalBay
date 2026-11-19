import { cspReportPath } from "./app-links";
import { webAnalyticsCollector } from "./web-analytics";

// Widget Turnstile dei moduli che inviano email o richieste di supporto (§29): l'unico frame.
const turnstile = "https://challenges.cloudflare.com";

// Immagini delle inserzioni e loghi dei negozi: soli host qualificati da `qualifiedImageUrl`.
const ebayImages = ["https://i.ebayimg.com", "https://i.ebayimg.sandbox.ebay.com"];

/** Nome dell'endpoint delle segnalazioni in `Reporting-Endpoints`, citato da `report-to`. */
const reportGroup = "csp";

/**
 * Nonce casuale degli script inline di React Router e di React, generato a ogni risposta preparata
 * dal Worker. La copia di Home e Prezzi servita a chi non ha cookie (`page-cache.server.ts`) lo
 * ripete, insieme alla CSP che lo dichiara, per i 60 secondi della sua durata.
 */
export function scriptNonce(): string {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
}

/**
 * Le violazioni arrivano all'endpoint dell'origine: Reporting API e, nei browser senza,
 * `report-uri`.
 */
const reporting = [`report-uri ${cspReportPath}`, `report-to ${reportGroup}`];

/**
 * CSP dei documenti HTML. Eseguono soltanto gli script con il nonce della risposta e quelli che
 * essi caricano (`'strict-dynamic'`): moduli di React Router, widget Turnstile e beacon di Web
 * Analytics, che porta il nonce. `https:` vale soltanto nei browser senza `'strict-dynamic'`, che
 * ignorano il nonce. Gli stili inline restano ammessi per gli attributi `style` di React e delle
 * animazioni; l'unico frame esterno è il widget. Service worker e manifest dell'app installabile
 * vengono soltanto dall'origine: per i worker la direttiva va scritta, perché altrimenti varrebbe
 * `script-src`, che con `'strict-dynamic'` non li ammette. `form-action` manca di proposito: i form
 * di accesso, collegamento eBay, Stripe e Telegram finiscono con redirect verso pagine dei provider
 * che a loro volta rimandano altrove, e il browser applicherebbe la direttiva a ogni passaggio.
 */
export function contentSecurityPolicy(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'nonce-${nonce}' 'strict-dynamic' 'report-sample' https:`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: ${ebayImages.join(" ")}`,
    "font-src 'self'",
    `connect-src 'self' ${webAnalyticsCollector}`,
    `frame-src ${turnstile}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    ...reporting,
  ].join("; ");
}

/**
 * Trusted Types in sola osservazione: segnala le scritture di stringhe nei punti del DOM che
 * eseguono codice, senza bloccarle, finché le segnalazioni non mostrano che nessun percorso
 * dell'app ne dipende.
 */
export function reportOnlyPolicy(): string {
  return ["require-trusted-types-for 'script'", ...reporting].join("; ");
}

/** Intestazioni di sicurezza di ogni documento HTML preparato dal Worker. */
export function documentSecurityHeaders(nonce: string): Record<string, string> {
  return {
    "Content-Security-Policy": contentSecurityPolicy(nonce),
    "Content-Security-Policy-Report-Only": reportOnlyPolicy(),
    "Reporting-Endpoints": `${reportGroup}="${cspReportPath}"`,
  };
}
