import { appCopy } from "./app-copy";
import type { Language } from "./i18n";
import { displayTimeZone, type NotificationView } from "./view-models";

/** Preferenze dell'account con i valori ammessi, condivise fra Impostazioni e server. */

export const themes = ["system", "light", "dark"] as const;
export type Theme = (typeof themes)[number];

export const timeZones = [
  "Europe/Rome",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Madrid",
  "America/New_York",
] as const;
export type TimeZone = (typeof timeZones)[number];

export const maxTemplateLength = 2000;

export function isTheme(value: unknown): value is Theme {
  return (themes as readonly unknown[]).includes(value);
}

export function isTimeZone(value: unknown): value is TimeZone {
  return (timeZones as readonly unknown[]).includes(value);
}

/** Aspetto applicato alle pagine dell'account: tema e fuso delle date. */
export interface DisplayPreferences {
  theme: Theme;
  timeZone: TimeZone;
}

export const defaultDisplay: DisplayPreferences = {
  theme: "system",
  timeZone: displayTimeZone,
};

/** Modello di messaggio predefinito, per ogni lingua dell'acquirente. */
export function defaultTemplate(language: Language): string {
  const { settings } = appCopy[language];
  return language === "it" ? settings.templateDefaultIt : settings.templateDefaultEn;
}

/** Dati della shell dell'area: aspetto scelto, campanella e istante di riferimento. */
export interface ShellData {
  display: DisplayPreferences;
  /** Null prima della conferma dell'email, quando la campanella non compare. */
  notifications: NotificationView[] | null;
  now: string;
}

/** Shell della pagina corrente, dal loader che la fornisce. */
export function matchedShell(matches: Array<{ loaderData?: unknown }>): ShellData | undefined {
  return matches
    .map((match) => (match.loaderData as { shell?: ShellData } | undefined)?.shell)
    .filter((shell) => shell !== undefined)
    .at(-1);
}
