import type { TaxIdentifierType, TaxQuality } from "./view-models";

export function taxIdentifierType(type: string, country: string | null): TaxIdentifierType {
  if (country !== null && country !== "IT") return "OTHER";
  if (["CODICE_FISCALE", "CodiceFiscale"].includes(type)) return "CF";
  return type === "PartitaIVA" || (country === "IT" && ["VAT_ID", "VATIN"].includes(type))
    ? "PIVA"
    : "OTHER";
}

/**
 * Forma mostrata e copiata: CF e Partita IVA italiani senza spazi e in maiuscolo, gli altri tipi
 * come forniti. Non corregge un valore errato; l'originale resta quello della fonte.
 */
export function displayTaxValue(identifier: { type: TaxIdentifierType; value: string }) {
  return identifier.type === "OTHER"
    ? identifier.value
    : identifier.value.replace(/\s/gu, "").toUpperCase();
}

/** Normalizzazione per il confronto; il valore originale rimane quello della fonte. */
export function taxComparisonKey(tax: {
  type: string;
  issuingCountry: string | null;
  value: string;
}) {
  const kind = taxIdentifierType(tax.type, tax.issuingCountry);
  const value = kind === "OTHER" ? tax.value.trim() : tax.value.replace(/\s/gu, "").toUpperCase();
  return JSON.stringify([kind === "OTHER" ? tax.type : kind, tax.issuingCountry, value]);
}

const oddValues = [
  1, 0, 5, 7, 9, 13, 15, 17, 19, 21, 2, 4, 18, 20, 11, 3, 6, 8, 12, 14, 16, 10, 22, 25, 24, 23,
];

function nameCode(value: string, given: boolean) {
  const consonants = value.replace(/[AEIOU]/gu, "");
  if (given && consonants.length >= 4) return consonants[0]! + consonants[2]! + consonants[3]!;
  return (consonants + value.replace(/[^AEIOU]/gu, "") + "XXX").slice(0, 3);
}

/** Solo controlli formali locali: nessuna verifica di esistenza o identità. */
export function taxQuality(
  tax: { type: string; issuingCountry: string | null; value: string },
  names: Array<string | null | undefined>,
): TaxQuality {
  const kind = taxIdentifierType(tax.type, tax.issuingCountry);
  if (kind === "OTHER") return "unchecked";
  const value = tax.value.replace(/\s/gu, "").toUpperCase();
  // Anche il CF provvisorio/numerico usa undici cifre e questo controllo.
  if (kind === "PIVA" || value.length === 11) {
    if (!/^\d{11}$/u.test(value) || /^0+$/u.test(value)) return "format";
    const sum = Array.from(value.slice(0, 10)).reduce((total, digit, index) => {
      const number = Number(digit) * (index % 2 ? 2 : 1);
      return total + (number > 9 ? number - 9 : number);
    }, 0);
    return (10 - (sum % 10)) % 10 === Number(value[10]) ? "valid" : "checksum";
  }
  if (
    !/^[A-Z]{6}[\dLMNPQRSTUV]{2}[ABCDEHLMPRST][\dLMNPQRSTUV]{2}[A-Z][\dLMNPQRSTUV]{3}[A-Z]$/u.test(
      value,
    )
  )
    return "format";
  const digits = value.replace(/[LMNPQRSTUV]/gu, (char) => String("LMNPQRSTUV".indexOf(char)));
  const day = Number(digits.slice(9, 11));
  if (!((day >= 1 && day <= 31) || (day >= 41 && day <= 71))) return "format";
  const month = "ABCDEHLMPRST".indexOf(value[8]!);
  // Il secolo non è ricavabile dal CF: 00 ammette febbraio bisestile (2000).
  // Stryker disable next-line ArithmeticOperator: per YY 00-99, 2000+YY e 2000-YY hanno la stessa bisestilità.
  const year = 2000 + Number(digits.slice(6, 8));
  const maxDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  if (day % 40 > maxDay) return "format";
  const sum = Array.from(value.slice(0, 15)).reduce((total, char, index) => {
    const number = /\d/u.test(char) ? Number(char) : char.charCodeAt(0) - 65;
    return total + (index % 2 ? number : oddValues[number]!);
  }, 0);
  if (String.fromCharCode(65 + (sum % 26)) !== value[15]) return "checksum";
  if ([6, 7, 9, 10, 12, 13, 14].some((index) => /[A-Z]/u.test(value[index]!)))
    return "unverifiable";
  let comparable = false;
  let ambiguous = false;
  for (const name of names) {
    if (!name) continue;
    const plain = name
      .split(/\bc\s*\/\s*o\b/iu)[0]!
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .trim();
    if (!/^[a-z\s'’-]+$/iu.test(plain)) continue;
    const parts = plain
      .toUpperCase()
      .split(/\s+/u)
      .map((part) => part.replace(/['’-]/gu, ""));
    if (parts.length !== 2) {
      ambiguous = true;
      continue;
    }
    comparable = true;
    if (
      [parts, [...parts].reverse()].some(
        ([surname, given]) =>
          nameCode(surname!, false) + nameCode(given!, true) === value.slice(0, 6),
      )
    )
      return "valid";
  }
  return comparable && !ambiguous ? "name" : "unverifiable";
}
