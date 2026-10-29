/**
 * Richieste per IP nella finestra di ciascun binding Rate Limiting (§29), uguali nei due
 * ambienti: Workers ammette soltanto finestre di 10 o 60 secondi.
 */
export const requestLimitRules = {
  // Accessi e modifiche con password o passkey.
  attempts: { limit: 3, period: 10 },
  // Richieste che inviano un'email: link di conferma, recupero, cancellazione e assistenza.
  emails: { limit: 3, period: 60 },
  // Lavori costosi chiesti dall'area: file degli ordini, archivio dell'account, letture eBay.
  work: { limit: 10, period: 60 },
} as const satisfies Record<string, { limit: number; period: 10 | 60 }>;

export type RequestLimit = keyof typeof requestLimitRules;
export type RequestLimitRule = (typeof requestLimitRules)[RequestLimit];
