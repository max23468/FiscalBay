import { turnstileScript } from "./turnstile";
import { webAnalyticsScript } from "./web-analytics";

/** Origini da cui la pagina carica script, le stesse ammesse dalla CSP. */
const scriptOrigins = (origin: string) =>
  new Set([origin, new URL(turnstileScript).origin, new URL(webAnalyticsScript).origin]);

/**
 * Indirizzo di uno script creato sul client: ammesso soltanto dalle origini della CSP, altrimenti
 * `null`, che il browser tratta come violazione.
 */
export function trustedScriptUrl(value: string, origin: string): string | null {
  try {
    return scriptOrigins(origin).has(new URL(value, origin).origin) ? value : null;
  } catch {
    return null;
  }
}

/**
 * HTML o codice scritto come stringa: React lo fa soltanto per il JSON dei dati strutturati e
 * delle regole di speculazione. È ammesso soltanto testo senza `<`, che non può creare elementi
 * né chiudere lo script che lo contiene.
 */
export function trustedText(value: string): string | null {
  return value.includes("<") ? null : value;
}

type Policy = {
  createHTML: (value: string) => string | null;
  createScript: (value: string) => string | null;
  createScriptURL: (value: string) => string | null;
};

/**
 * Policy predefinita di Trusted Types: il browser la usa per ogni stringa scritta in un punto del
 * DOM che esegue codice, così la direttiva `require-trusted-types-for 'script'` della CSP non
 * segnala le scritture dell'app e si può applicare. Senza Trusted Types non fa nulla.
 */
export function installTrustedTypes(
  target: { trustedTypes?: { createPolicy?: (name: string, policy: Policy) => unknown } },
  origin: string,
) {
  target.trustedTypes?.createPolicy?.("default", {
    createHTML: trustedText,
    createScript: trustedText,
    createScriptURL: (value) => trustedScriptUrl(value, origin),
  });
}
