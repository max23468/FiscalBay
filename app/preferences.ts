import type { AppCopy } from "./app-copy";
import type { Language } from "./i18n";
import { type NotificationView } from "./view-models";
import { displayTimeZone } from "./format";

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

/** Orari ammessi del riepilogo Telegram giornaliero. */
export const telegramDigestTimes = ["08:00", "12:00", "18:00", "21:00"] as const;

/** Validità del deep link che collega la chat Telegram, in minuti. */
export const telegramLinkMinutes = 15;

export function isTheme(value: unknown): value is Theme {
  return (themes as readonly unknown[]).includes(value);
}

export function isTimeZone(value: unknown): value is TimeZone {
  return (timeZones as readonly unknown[]).includes(value);
}

/** Nome del fuso: quello dell'elenco, altrimenti la città dell'identificativo IANA. */
export function zoneLabel(zone: string | null, t: AppCopy): string | null {
  if (!zone) return null;
  return isTimeZone(zone)
    ? t.settings.appearance.timeZones[zone]
    : (zone.split("/").at(-1) ?? zone).replaceAll("_", " ");
}

/** Fuso scelto: uno dell'elenco, oppure quello del dispositivo (predefinito). */
export type TimeZoneChoice = TimeZone | "auto";

/** Fuso del dispositivo, scritto dal browser nell'area dell'account e letto dal server. */
export const timeZoneCookie = "fiscalbay_fuso";

/** Identificativo IANA che `Intl` riconosce; null per qualunque altro valore. */
export function validTimeZone(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 64 || !/^[A-Za-z][\w+\-/]*$/u.test(value))
    return null;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return value;
  } catch {
    return null;
  }
}

/** Fuso del dispositivo dal cookie della richiesta, se valido. */
export function detectedTimeZone(cookieHeader: string | null): string | null {
  const match = new RegExp(`(?:^|;\\s*)${timeZoneCookie}=([^;]*)`, "u").exec(cookieHeader ?? "");
  return match ? validTimeZone(decodeURIComponent(match[1]!)) : null;
}

/** Fuso delle date: quello scelto, oppure quello del dispositivo, altrimenti Roma. */
export function effectiveTimeZone(choice: TimeZoneChoice, detected: string | null): string {
  return choice === "auto" ? (detected ?? displayTimeZone) : choice;
}

/** Aspetto applicato alle pagine dell'account: tema e fuso delle date. */
export interface DisplayPreferences {
  theme: Theme;
  timeZone: string;
}

export const defaultDisplay: DisplayPreferences = {
  theme: "system",
  timeZone: displayTimeZone,
};

/**
 * Messaggio all'acquirente nella sua lingua, indipendente da quella dell'interfaccia: per questo
 * resta fuori dai testi dell'app, che il browser carica una lingua alla volta.
 */
const buyerMessages: Record<Language, { template: string; subject: (order: string) => string }> = {
  it: {
    template:
      "Buongiorno e grazie per l’acquisto. Per emettere la fattura elettronica dell’ordine {ordine} ci serve il tuo Codice Fiscale. Se acquisti con Partita IVA, indicaci quella e la ragione sociale. Grazie.",
    subject: (order) => `Ordine eBay ${order}: Codice Fiscale per la fattura`,
  },
  en: {
    template:
      "Hello and thank you for your purchase. To issue the electronic invoice for order {ordine} we need your Italian tax code (Codice Fiscale). If you are buying with a VAT number, please send that and your company name instead. Thank you.",
    subject: (order) => `eBay order ${order}: tax code for the invoice`,
  },
};

/** Modello di messaggio predefinito, per ogni lingua dell'acquirente. */
export function defaultTemplate(language: Language): string {
  return buyerMessages[language].template;
}

/** Oggetto dell'email all'acquirente, nella lingua del messaggio. */
export function requestEmailSubject(language: Language, order: string): string {
  return buyerMessages[language].subject(order);
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
