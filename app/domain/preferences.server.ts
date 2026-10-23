import type { Language } from "../i18n";
import {
  defaultDisplay,
  defaultTemplate,
  isTheme,
  isTimeZone,
  maxTemplateLength,
  type Theme,
  type TimeZoneChoice,
} from "../preferences";
import { legalVersions } from "./registration.server";

/**
 * Preferenze dell'account: ogni valore ha una sola fonte, la riga di `user_preferences`, e un
 * valore assente vale il predefinito. La conferma dello sblocco resta in `unlock_preferences` e
 * il consenso marketing in `marketing_consents`, con la prova di ogni scelta.
 */
export interface Preferences {
  /** Lingua scelta; null finché l'utente non ne sceglie una e vale quella dell'indirizzo. */
  language: Language | null;
  theme: Theme;
  /** Fuso scelto; «auto» segue il dispositivo. */
  timeZone: TimeZoneChoice;
  /** Modello di messaggio per lingua dell'acquirente; null vale il testo predefinito. */
  templates: Record<Language, string | null>;
}

type PreferenceRow = {
  language: Language | null;
  theme: "light" | "dark" | null;
  time_zone: string | null;
  template_it: string | null;
  template_en: string | null;
};

export async function readPreferences(db: D1Database, userId: string): Promise<Preferences> {
  const row = await db
    .prepare(
      "SELECT language, theme, time_zone, template_it, template_en FROM user_preferences WHERE user_id = ?",
    )
    .bind(userId)
    .first<PreferenceRow>();
  return {
    language: row?.language ?? null,
    theme: row?.theme ?? defaultDisplay.theme,
    // Un fuso tolto dall'elenco torna al rilevamento automatico invece di rompere le date.
    timeZone: isTimeZone(row?.time_zone) ? row.time_zone : "auto",
    templates: { it: row?.template_it ?? null, en: row?.template_en ?? null },
  };
}

/** Scelte semplici salvate a ogni modifica, con il valore già validato. */
export type PreferenceChange =
  | { name: "language"; value: Language }
  | { name: "theme"; value: Theme }
  | { name: "timeZone"; value: TimeZoneChoice };

/** Valida una scelta inviata dal modulo; null se nome o valore non sono ammessi. */
export function parsePreference(name: string, value: string): PreferenceChange | null {
  if (name === "language" && (value === "it" || value === "en")) return { name, value };
  if (name === "theme" && isTheme(value)) return { name, value };
  if (name === "time-zone" && (value === "auto" || isTimeZone(value)))
    return { name: "timeZone", value };
  return null;
}

const columns = { language: "language", theme: "theme", timeZone: "time_zone" } as const;

export async function savePreference(
  db: D1Database,
  userId: string,
  change: PreferenceChange,
  now = new Date(),
): Promise<void> {
  const column = columns[change.name];
  // Tema del sistema e fuso automatico non si conservano: valgono già senza riga.
  const value =
    (change.name === "theme" && change.value === defaultDisplay.theme) ||
    (change.name === "timeZone" && change.value === "auto")
      ? null
      : change.value;
  await db
    .prepare(
      `INSERT INTO user_preferences (user_id, ${column}, updated_at) VALUES (?1, ?2, ?3)
       ON CONFLICT (user_id) DO UPDATE SET ${column} = ?2, updated_at = ?3`,
    )
    .bind(userId, value, now.toISOString())
    .run();
}

/**
 * Testi del modello inviati con Salva: obbligatori ed entro la lunghezza massima. Un testo
 * uguale al predefinito non si conserva, così segue le revisioni del testo predefinito.
 */
export function parseTemplates(form: FormData): Record<Language, string | null> | null {
  const read = (language: Language) => {
    const text = String(form.get(language) ?? "").trim();
    if (!text || text.length > maxTemplateLength) return undefined;
    return text === defaultTemplate(language) ? null : text;
  };
  const it = read("it");
  const en = read("en");
  return it === undefined || en === undefined ? null : { it, en };
}

export async function saveTemplates(
  db: D1Database,
  userId: string,
  templates: Record<Language, string | null>,
  now = new Date(),
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO user_preferences (user_id, template_it, template_en, updated_at)
       VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT (user_id) DO UPDATE SET template_it = ?2, template_en = ?3, updated_at = ?4`,
    )
    .bind(userId, templates.it, templates.en, now.toISOString())
    .run();
}

/** Testi del modello da usare negli Ordini, con il predefinito dove non c'è una scelta. */
export function messageTemplates(preferences: Preferences): Record<Language, string> {
  return {
    it: preferences.templates.it ?? defaultTemplate("it"),
    en: preferences.templates.en ?? defaultTemplate("en"),
  };
}

/** Vale l'ultima scelta registrata; senza scelte il consenso non è dato. */
export async function marketingConsent(db: D1Database, userId: string): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT granted FROM marketing_consents WHERE user_id = ?
       ORDER BY recorded_at DESC, rowid DESC LIMIT 1`,
    )
    .bind(userId)
    .first<{ granted: number }>();
  return row?.granted === 1;
}

/** Ogni scelta resta come prova, con la versione del testo e la lingua in cui è stata resa. */
export async function recordMarketingConsent(
  db: D1Database,
  userId: string,
  granted: boolean,
  language: Language,
  now = new Date(),
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO marketing_consents (id, user_id, granted, text_version, language, recorded_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      userId,
      granted ? 1 : 0,
      legalVersions.marketing,
      language,
      now.toISOString(),
    )
    .run();
}
