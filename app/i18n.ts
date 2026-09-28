export const languages = ["it", "en"] as const;
export type Language = (typeof languages)[number];

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
  return new Intl.NumberFormat(language, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}
