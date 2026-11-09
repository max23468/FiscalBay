import { englishSettingsSections } from "./area-sections.ts";
import { currencyExponent } from "./money.ts";

export const languages = ["it", "en"] as const;
export type Language = (typeof languages)[number];

export function isLanguage(value: string): value is Language {
  return (languages as readonly string[]).includes(value);
}

/** Formati di date, numeri e Paesi: l'inglese è britannico, come il copy. */
export const locales: Record<Language, string> = { it: "it-IT", en: "en-GB" };

/** Ogni lingua con il proprio nome, in qualunque lingua sia l'interfaccia. */
export const languageNames: Record<Language, string> = { it: "Italiano", en: "English" };

export function languageFromPath(path: string): Language {
  // `/en.data` è la richiesta dei dati di `/en` durante una navigazione nel browser.
  return /^\/en(?:\/|\.data$|$)/u.test(path) ? "en" : "it";
}

/**
 * Segmenti italiani degli indirizzi con il nome inglese e i segmenti che possono seguirli. Un
 * segmento assente, come l'identificativo di un ordine o di un negozio, resta uguale nelle due
 * lingue. Le sezioni della console restano in italiano: l'area è del solo owner.
 */
interface Segment {
  en: string;
  next?: Record<string, Segment>;
}

const leaf = (en: string): Segment => ({ en });

const settingsSections: Record<string, Segment> = Object.fromEntries(
  Object.entries(englishSettingsSections).map(([italian, english]) => [italian, leaf(english)]),
);

/** Pagine dell'area riservata, uguali nell'anteprima. */
const areaPages: Record<string, Segment> = {
  ordini: leaf("orders"),
  negozi: { en: "stores", next: { collega: leaf("link") } },
  impostazioni: { en: "settings", next: settingsSections },
  novita: leaf("whats-new"),
  profilo: leaf("profile"),
  lingua: leaf("language"),
  ricerca: leaf("search"),
};

const segments: Record<string, Segment> = {
  funzionalita: leaf("features"),
  prezzi: leaf("pricing"),
  sicurezza: leaf("security"),
  supporto: leaf("support"),
  termini: leaf("terms"),
  privacy: leaf("privacy"),
  faq: leaf("faq"),
  accesso: leaf("sign-in"),
  "cancellazione-account": leaf("account-deletion"),
  guide: {
    en: "guides",
    next: {
      "trovare-codice-fiscale-ordini-ebay": leaf("find-tax-code-ebay-orders"),
      "codice-fiscale-non-visibile-ordine-ebay": leaf("tax-code-not-visible-ebay-order"),
      "chiedere-codice-fiscale-acquirente-ebay": leaf("ask-ebay-buyer-tax-code"),
      "codice-fiscale-fattura-elettronica-ebay": leaf("tax-code-e-invoice-ebay"),
      "esportare-ordini-ebay-excel-csv": leaf("export-ebay-orders-excel-csv"),
      "partita-iva-acquirente-ebay": leaf("buyer-vat-number-ebay"),
      "alternativa-probay-codice-fiscale-ebay": leaf("probay-alternative-ebay-tax-code"),
    },
  },
  auth: { en: "auth", next: { error: leaf("error") } },
  app: { en: "app", next: areaPages },
  anteprima: { en: "preview", next: areaPages },
};

/** Traduce i segmenti di un percorso; `toEnglish` falso riporta i nomi inglesi a quelli italiani. */
function translateSegments(path: string, toEnglish: boolean) {
  let level: Record<string, Segment> | undefined = segments;
  return path
    .split("/")
    .map((part) => {
      if (!part || !level) return part;
      const entry: [string, Segment] | undefined = Object.entries(level).find(([italian, node]) =>
        toEnglish ? italian === part : node.en === part,
      );
      level = entry?.[1].next;
      if (!entry) return part;
      return toEnglish ? entry[1].en : entry[0];
    })
    .join("/");
}

export function localizedPath(language: Language, path = "/"): string {
  if (language === "it") return path;
  const at = path.search(/[?#]/u);
  const [pathname, rest] = at < 0 ? [path, ""] : [path.slice(0, at), path.slice(at)];
  return `/en${pathname === "/" ? "" : translateSegments(pathname, true)}${rest}`;
}

/** Sezione delle Impostazioni con il nome italiano, dal parametro dell'indirizzo in una delle due lingue. */
export function settingsSectionParam(value: string | undefined) {
  if (value === undefined) return undefined;
  return Object.entries(settingsSections).find(([, node]) => node.en === value)?.[0] ?? value;
}

/**
 * Percorso italiano senza prefisso di lingua di un indirizzo servito, la forma con cui il codice
 * riconosce pagine e sezioni in entrambe le lingue.
 */
export function canonicalPath(pathname: string): string {
  if (languageFromPath(pathname) === "it") return pathname;
  return translateSegments(pathname.replace(/^\/en/u, ""), false) || "/";
}

/**
 * Nuovo indirizzo di una pagina inglese aperta con i vecchi segmenti italiani, come `/en/prezzi`:
 * il Worker risponde con un redirect permanente. `null` per un indirizzo già corretto.
 */
export function movedEnglishPath(pathname: string): string | null {
  if (languageFromPath(pathname) !== "en") return null;
  const data = pathname.endsWith(".data") ? ".data" : "";
  const page = data ? pathname.slice(0, -data.length) : pathname;
  // Un segmento che nelle due lingue non coincide ha un solo nome valido per ciascuna.
  const italian = page
    .replace(/^\/en/u, "")
    .split("/")
    .reduce(
      ({ level, parts }, part) => {
        const entry = level
          ? Object.entries(level).find(([key, node]) => part === key || part === node.en)
          : undefined;
        return { level: entry?.[1].next, parts: [...parts, entry?.[0] ?? part] };
      },
      { level: segments as Record<string, Segment> | undefined, parts: [] as string[] },
    )
    .parts.join("/");
  const target = localizedPath("en", italian || "/");
  return target === page ? null : `${target}${data}`;
}

export function formatAmount(minor: number, currency: string, language: Language): string {
  if (!Number.isSafeInteger(minor)) throw new RangeError("invalid_amount");
  const exponent = currencyExponent(currency);
  return new Intl.NumberFormat(locales[language], {
    style: "currency",
    currency,
    // Il dollaro da solo non distingue USD, CAD e AUD.
    currencyDisplay: currency === "EUR" ? "symbol" : "code",
    minimumFractionDigits: exponent,
    maximumFractionDigits: exponent,
    // CLDR ha cambiato il raggruppamento italiano (1249 contro 1.249): una regola esplicita
    // evita testi diversi fra server e browser con dati ICU meno recenti.
    useGrouping: "always",
  }).format(minor / 10 ** exponent);
}
