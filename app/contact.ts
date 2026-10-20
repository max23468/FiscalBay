import type { AddressView, ContactsView } from "./view-models";

/**
 * Forma di visualizzazione di telefono, email e indirizzo dell'acquirente. Come per CF e
 * Partita IVA, la formattazione non corregge né sostituisce il dato di eBay, che resta
 * conservato com'è: un valore che non si riconosce con certezza si mostra originale e non
 * diventa un collegamento.
 */

/** Prefissi internazionali dei Paesi di fatturazione più frequenti. */
const callingCodes: Record<string, string> = {
  IT: "39",
  SM: "378",
  VA: "39",
  CH: "41",
  AT: "43",
  DE: "49",
  FR: "33",
  ES: "34",
  PT: "351",
  GB: "44",
  IE: "353",
  BE: "32",
  NL: "31",
  LU: "352",
  DK: "45",
  SE: "46",
  NO: "47",
  FI: "358",
  PL: "48",
  CZ: "420",
  SK: "421",
  HU: "36",
  RO: "40",
  BG: "359",
  HR: "385",
  SI: "386",
  GR: "30",
  MT: "356",
  CY: "357",
  EE: "372",
  LV: "371",
  LT: "370",
  US: "1",
  CA: "1",
  AU: "61",
};

const knownCodes = [...new Set(Object.values(callingCodes))].sort((a, b) => b.length - a.length);

/** In Italia, San Marino e Vaticano lo zero iniziale fa parte del numero. */
const keepsLeadingZero = new Set(["39", "378"]);

export interface PhoneView {
  /** Forma leggibile, con il prefisso internazionale staccato. */
  display: string;
  /** Forma internazionale senza spazi, per `tel:` e per la copia. */
  international: string;
}

/**
 * Telefono nella forma internazionale. Senza prefisso vale il Paese di fatturazione; un
 * numero con lettere, troppo corto o di un Paese senza prefisso noto resta null.
 */
export function phoneView(raw: string, country: string | null): PhoneView | null {
  const compact = raw.trim().replace(/[\s.\-()/]/gu, "");
  if (!/^\+?\d+$/u.test(compact)) return null;
  let digits: string;
  if (compact.startsWith("+")) digits = compact.slice(1);
  else if (compact.startsWith("00")) digits = compact.slice(2);
  else {
    const code = country ? callingCodes[country.toUpperCase()] : undefined;
    if (!code) return null;
    digits = code + (keepsLeadingZero.has(code) ? compact : compact.replace(/^0/u, ""));
  }
  if (digits.length < 8 || digits.length > 15 || digits.startsWith("0")) return null;
  const code = knownCodes.find((candidate) => digits.startsWith(candidate));
  const national = code ? digits.slice(code.length) : null;
  const international = `+${digits}`;
  // Cellulari italiani a dieci cifre: 333 123 4567.
  if (code === "39" && national && /^3\d{9}$/u.test(national))
    return {
      display: `+39 ${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6)}`,
      international,
    };
  // Un numero internazionale già diviso in gruppi conserva quelli della fonte.
  const source = raw.trim();
  if (/^(?:\+|00)/u.test(source) && /\d[\s.\-/]+\d/u.test(source))
    return {
      display: `+${source
        .replace(/^(?:\+|00)/u, "")
        .replace(/[()]/gu, "")
        .replace(/[\s.\-/]+/gu, " ")}`,
      international,
    };
  return { display: code && national ? `+${code} ${national}` : international, international };
}

export interface EmailView {
  address: string;
  /**
   * Indirizzo alias di eBay: i messaggi passano dalla messaggistica eBay, dove non si possono
   * chiedere dati personali, quindi non riceve la richiesta del Codice Fiscale.
   */
  relay: boolean;
}

/** Email senza spazi e con il dominio in minuscolo; null se non ha la forma di un indirizzo. */
export function emailView(raw: string): EmailView | null {
  const value = raw.trim();
  const separator = value.lastIndexOf("@");
  if (separator < 1 || /\s/u.test(value)) return null;
  const domain = value.slice(separator + 1).toLowerCase();
  if (!/^[^@]+\.[a-z]{2,}$/u.test(domain)) return null;
  return {
    address: `${value.slice(0, separator)}@${domain}`,
    relay: /(?:^|\.)ebay\.[a-z.]+$/u.test(domain),
  };
}

/** Parole che restano minuscole dentro un indirizzo, salvo all'inizio. */
const lowerWords = new Set(["di", "del", "dello", "della", "dei", "degli", "delle", "e", "ed"]);
/** Sigle che restano maiuscole. */
const upperWords = new Set(["snc", "srl", "srls", "spa", "sas", "ss", "sp", "sr", "km"]);
const romanNumeral = /^[ivxlcdm]+$/u;

function capitalize(part: string) {
  return part.charAt(0).toUpperCase() + part.slice(1);
}

/**
 * Testo scritto tutto in maiuscolo con l'iniziale maiuscola per parola («VIA DELL'ORTO 12B» →
 * «Via dell'Orto 12B»). Un testo che contiene già minuscole resta com'è; parole con cifre,
 * sigle note, numeri romani e «c/o» conservano la loro forma.
 */
export function addressCase(text: string): string {
  if (!/\p{Lu}/u.test(text) || /\p{Ll}/u.test(text)) return text;
  return text
    .split(/(\s+)/u)
    .map((word, index) => {
      if (/^\s+$/u.test(word) || /\d/u.test(word)) return word;
      const lower = word.toLowerCase();
      const bare = lower.replace(/[.,;]+$/u, "");
      if (bare === "c/o") return lower;
      if (index > 0 && lowerWords.has(bare)) return lower;
      if (upperWords.has(bare.replaceAll(".", ""))) return word;
      if (romanNumeral.test(bare) && !lowerWords.has(bare)) return word;
      // Apostrofi e trattini separano parti con la propria iniziale: Sant'Angelo, Dell'Orto.
      return lower
        .split(/(['’-])/u)
        .map((part, partIndex) =>
          partIndex === 0 && index > 0 && /^(?:dell|dall|nell|sull|all|d)$/u.test(part)
            ? part
            : capitalize(part),
        )
        .join("");
    })
    .join("");
}

/**
 * Contatti nella forma mostrata, calcolati sul server per area reale e anteprima: il browser
 * riceve soltanto il risultato. L'indirizzo perde le maiuscole di eBay e gli spazi superflui.
 */
export function contactsView(order: {
  phone: string | null;
  email: string | null;
  billingAddress: AddressView | null;
  shipTo: { country: string | null } | null;
}): ContactsView {
  const address = order.billingAddress;
  return {
    phone: order.phone
      ? phoneView(order.phone, address?.countryCode ?? order.shipTo?.country ?? null)
      : null,
    email: order.email ? emailView(order.email) : null,
    billingAddress: address
      ? {
          ...address,
          line: addressCase(address.line.replace(/\s+/gu, " ").trim()),
          city: addressCase(address.city.replace(/\s+/gu, " ").trim()),
          province: address.province?.trim().toUpperCase() || null,
        }
      : null,
  };
}
