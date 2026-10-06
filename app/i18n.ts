export const languages = ["it", "en"] as const;
export type Language = (typeof languages)[number];

/** Ogni lingua con il proprio nome, in qualunque lingua sia l'interfaccia. */
/** Formati di date, numeri e Paesi: l'inglese è britannico, come il copy. */
export const locales: Record<Language, string> = { it: "it-IT", en: "en-GB" };

export const languageNames: Record<Language, string> = { it: "Italiano", en: "English" };

export function languageFromPath(path: string): Language {
  // `/en.data` è la richiesta dei dati di `/en` durante una navigazione nel browser.
  return /^\/en(?:\/|\.data$|$)/u.test(path) ? "en" : "it";
}

export function localizedPath(language: Language, path = "/"): string {
  return language === "en" ? `/en${path === "/" ? "" : path}` : path;
}

const amountGrouping = { it: "min2", en: "always" } as const;

export function formatAmount(minor: number, currency: string, language: Language): string {
  if (!Number.isSafeInteger(minor) || !/^[A-Z]{3}$/u.test(currency)) {
    throw new RangeError("invalid_amount");
  }
  return new Intl.NumberFormat(locales[language], {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    // CLDR ha cambiato il raggruppamento italiano (1249 contro 1.249): una regola esplicita
    // evita testi diversi fra server e browser con dati ICU meno recenti.
    useGrouping: amountGrouping[language],
  }).format(minor / 100);
}
