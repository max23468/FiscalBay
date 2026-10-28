/**
 * Limiti applicati dal server e ripetuti dai moduli del browser, da una sola fonte: il campo
 * accetta soltanto ciò che il server accetterà.
 */

/** Giorni di 24 ore fra due sostituzioni del negozio attivo del Free scelte dall'utente. */
export const freeStoreChangeDays = 90;

/** Titolo e testo di una comunicazione di servizio, in ciascuna lingua. */
export const maxNoticeTitle = 120;
export const maxNoticeBody = 1000;

/** Motivo obbligatorio delle operazioni della console. */
export const maxAuditReason = 500;

/** Password dell'account, come la verifica di Better Auth. */
export const minPasswordLength = 8;
export const maxPasswordLength = 128;
