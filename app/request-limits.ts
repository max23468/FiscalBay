import rules from "./request-limits.json";

/**
 * Richieste per IP nella finestra di ciascun binding Rate Limiting (§29), uguali nei due
 * ambienti: Workers ammette soltanto finestre di 10 o 60 secondi.
 * - `attempts`: accessi e modifiche con password o passkey.
 * - `emails`: richieste che inviano un'email (link di conferma, recupero, cancellazione e
 *   assistenza).
 * - `work`: lavori costosi chiesti dall'area (file degli ordini, archivio dell'account, letture
 *   eBay).
 * - `reports`: segnalazioni CSP inviate dal browser.
 * - `challenges`: sfide per l'accesso con passkey, chieste a ogni apertura della pagina di
 *   accesso per il suggerimento nel campo email.
 *
 * I valori stanno in `request-limits.json` perché anche `cloudflare.config.ts` li legge: il
 * plugin Cloudflare nega al dev server ogni modulo importato dalla configurazione.
 */
export const requestLimitRules = rules as Record<
  "attempts" | "emails" | "work" | "reports" | "challenges",
  { limit: number; period: 10 | 60 }
>;

export type RequestLimit = keyof typeof requestLimitRules;
