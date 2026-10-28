/**
 * Nomi dei comandi del bot Telegram, senza dipendenze: li leggono il Worker e gli script che
 * configurano o rileggono il menu.
 */

/** Comandi del menu dei venditori, con i nomi italiani e inglesi. */
export const botCommands = {
  status: { it: "stato", en: "status" },
  latest: { it: "ultimi", en: "latest" },
  preferences: { it: "preferenze", en: "preferences" },
  help: { it: "aiuto", en: "help" },
} as const;

export type BotCommand = keyof typeof botCommands;

/**
 * Comandi del Control Center dell'owner (D198): nomi diversi da quelli dei venditori, accettati
 * soltanto nella chat privata dell'owner e dal suo utente.
 */
export const ownerCommands = [
  "console",
  "incidenti",
  "lavori",
  "quote",
  "commerciale",
  "metriche",
  "negozi",
  "prestazioni",
  "versione",
] as const;

export type OwnerCommand = (typeof ownerCommands)[number];
