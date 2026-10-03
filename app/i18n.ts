export const languages = ["it", "en"] as const;
export type Language = (typeof languages)[number];

/** Ogni lingua con il proprio nome, in qualunque lingua sia l'interfaccia. */
/** Formati di date, numeri e Paesi: l'inglese è britannico, come il copy. */
export const locales: Record<Language, string> = { it: "it-IT", en: "en-GB" };

export const languageNames: Record<Language, string> = { it: "Italiano", en: "English" };

export function languageFromPath(path: string): Language {
  return path === "/en" || path.startsWith("/en/") ? "en" : "it";
}

export function localizedPath(language: Language, path = "/"): string {
  return language === "en" ? `/en${path === "/" ? "" : path}` : path;
}

export function formatAmount(minor: number, currency: string, language: Language): string {
  if (!Number.isSafeInteger(minor) || !/^[A-Z]{3}$/u.test(currency)) {
    throw new RangeError("invalid_amount");
  }
  return new Intl.NumberFormat(locales[language], {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}
