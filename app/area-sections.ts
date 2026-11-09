/**
 * Categorie delle Impostazioni in tre gruppi: il lavoro sugli ordini, l'account e le
 * preferenze generali con l'assistenza.
 */
export const settingsGroups = [
  { id: "ordini", sections: ["notifiche", "esportazione", "messaggio"] },
  { id: "account", sections: ["account", "piano", "privacy"] },
  { id: "generale", sections: ["aspetto", "supporto"] },
] as const;

export type SettingsSection = (typeof settingsGroups)[number]["sections"][number];

export const settingsSections: readonly SettingsSection[] = settingsGroups.flatMap(
  (group) => group.sections,
);

/** Nome inglese di ogni categoria nell'indirizzo. */
export const englishSettingsSections: Record<SettingsSection, string> = {
  notifiche: "notifications",
  esportazione: "export",
  messaggio: "message",
  account: "account",
  piano: "plan",
  privacy: "privacy",
  aspetto: "appearance",
  supporto: "support",
};

/**
 * Categorie riunite in Account: i loro indirizzi, anche nelle email già inviate, portano alla
 * categoria che le contiene.
 */
const mergedSettingsSections: Readonly<Record<string, SettingsSection>> = {
  profilo: "account",
  sicurezza: "account",
};

export function isSettingsSection(value: string | undefined): value is SettingsSection {
  return (settingsSections as readonly string[]).includes(value ?? "");
}

/**
 * Indirizzo della categoria che contiene la sezione `section` riunita in Account, con la stessa
 * query; null per ogni altra sezione.
 */
export function mergedSectionUrl(url: URL, section: string | undefined): string | null {
  const merged = mergedSettingsSections[section ?? ""];
  return merged ? `${url.pathname.replace(/[^/]+$/u, merged)}${url.search}` : null;
}

/** Pagine dell'area, relative alla radice dell'area reale o dell'anteprima. */
export type AreaPath =
  | ""
  | "ordini"
  | "negozi"
  | `negozi/${string}`
  | "impostazioni"
  | `impostazioni/${SettingsSection}`
  | "novita";
