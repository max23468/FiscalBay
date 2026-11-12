import { contactsView } from "../contact";
import type {
  FiscalNotice,
  OrderView,
  PaymentStatus,
  ShippingStatus,
  StoreView,
  SuggestionView,
  TaxIdentifierView,
} from "../view-models";

/** Istante di riferimento fisso: date e tempi relativi restano stabili. */
export const previewNow = "2026-09-27T13:00:00Z";

export const minutesAgo = (minutes: number) =>
  new Date(new Date(previewNow).getTime() - minutes * 60_000).toISOString();

/**
 * Immagini degli articoli dell'anteprima e delle schermate del sito: illustrazioni originali,
 * senza foto di terzi né marchi, su un fondo chiaro da catalogo. Sono data URL come le miniature
 * che l'app riceve da eBay e non chiedono altre origini.
 */
const picture = (shapes: string, defs = "") =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 96 96"><defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#faf6ee"/><stop offset="1" stop-color="#e2d9c7"/></linearGradient>${defs}</defs><rect width="96" height="96" fill="url(#bg)"/><ellipse cx="48" cy="84" rx="32" ry="4" fill="#000" opacity=".14"/>${shapes}</svg>`,
  )}`;

const gradient = (id: string, from: string, to: string) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient>`;

const chrome = gradient("chrome", "#f8fafc", "#7b8794");
const brass = gradient("brass", "#fbe08a", "#a8701c");

const productImages = {
  helmet: picture(
    `<path d="M 26 62C22 36 38 16 56 16c16 0 26 14 26 34v20c0 4-4 6-8 6H46c-2-10-8-14-20-14Z" fill="url(#shell)"/>
     <path d="M 55 16c12 14 16 36 14 60" fill="none" stroke="#fff" stroke-width="7"/>
     <path d="M 46 76h32" stroke="#292524" stroke-width="4" stroke-linecap="round"/>
     <path d="M 23 47c10-7 23-7 32-3l-2 7c-10-3-20-3-29 1Z" fill="#3b2a1e"/>
     <circle cx="60" cy="59" r="3.5" fill="url(#chrome)" stroke="#57534e" stroke-width=".6"/>
     <path d="M 50 76c-2 7 2 9 9 10" fill="none" stroke="#7c4a21" stroke-width="3" stroke-linecap="round"/>
     <ellipse cx="44" cy="29" rx="9" ry="5" fill="#fff" opacity=".4" transform="rotate(-35 44 29)"/>`,
    gradient("shell", "#ef4444", "#8f1313") + chrome,
  ),
  sign: picture(
    `<rect x="12" y="22" width="72" height="52" rx="5" fill="url(#enamel)" stroke="#0b2a55" stroke-width="1.5"/>
     <rect x="17" y="27" width="62" height="42" rx="3" fill="none" stroke="#fde68a" stroke-width="2"/>
     <text x="48" y="48" text-anchor="middle" font-family="Georgia,serif" font-size="14" font-weight="700" fill="#fff">GARAGE</text>
     <path d="M 26 57h44" stroke="#fde68a" stroke-width="3" stroke-linecap="round"/>
     <circle cx="17" cy="27" r="1.8" fill="url(#chrome)"/><circle cx="79" cy="27" r="1.8" fill="url(#chrome)"/><circle cx="17" cy="69" r="1.8" fill="url(#chrome)"/><circle cx="79" cy="69" r="1.8" fill="url(#chrome)"/>
     <path d="M 70 68l9-6v8Z" fill="#7f1d1d" opacity=".55"/>`,
    gradient("enamel", "#2563eb", "#0f3a7a") + chrome,
  ),
  headlight: picture(
    `<path d="M 40 74h16l3 10H37Z" fill="#57534e"/>
     <circle cx="48" cy="44" r="32" fill="url(#chrome)" stroke="#57606a" stroke-width="1"/>
     <circle cx="48" cy="44" r="25" fill="url(#glass)" stroke="#94a3b8" stroke-width="1.5"/>
     <path d="M 26 44h44M 48 22v44M 33 29l30 30M 63 29 33 59" stroke="#fff" stroke-width=".8" opacity=".55"/>
     <circle cx="48" cy="44" r="7" fill="#fffbeb"/>
     <path d="M 31 31c5-6 12-9 19-9" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".85"/>`,
    chrome +
      `<radialGradient id="glass"><stop offset="0" stop-color="#fffbeb"/><stop offset=".7" stop-color="#fde68a"/><stop offset="1" stop-color="#b08a3a"/></radialGradient>`,
  ),
  typewriter: picture(
    `<rect x="32" y="12" width="32" height="30" fill="#fff" stroke="#d6d3d1"/>
     <path d="M 37 20h22M 37 26h22M 37 32h14" stroke="#a8a29e" stroke-width="1.5"/>
     <rect x="18" y="36" width="60" height="9" rx="4" fill="#1c1917"/>
     <circle cx="17" cy="40" r="5" fill="url(#chrome)"/><circle cx="79" cy="40" r="5" fill="url(#chrome)"/>
     <path d="M 22 44h52l10 36H12Z" fill="url(#body)"/>
     <g fill="#f5f5f4" stroke="#1c1917" stroke-width=".8"><circle cx="28" cy="56" r="3.2"/><circle cx="38" cy="56" r="3.2"/><circle cx="48" cy="56" r="3.2"/><circle cx="58" cy="56" r="3.2"/><circle cx="68" cy="56" r="3.2"/><circle cx="24" cy="65" r="3.2"/><circle cx="34" cy="65" r="3.2"/><circle cx="44" cy="65" r="3.2"/><circle cx="54" cy="65" r="3.2"/><circle cx="64" cy="65" r="3.2"/><circle cx="74" cy="65" r="3.2"/></g>
     <rect x="32" y="71" width="32" height="5" rx="2.5" fill="#f5f5f4" stroke="#1c1917" stroke-width=".8"/>`,
    gradient("body", "#3f7a68", "#17392f") + chrome,
  ),
  horn: picture(
    `<path d="M 70 42C52 42 36 38 16 18v52c20-20 36-20 54-20Z" fill="url(#brass)" stroke="#7c5211" stroke-width="1"/>
     <ellipse cx="16" cy="44" rx="6" ry="26" fill="#6b4410"/>
     <ellipse cx="16" cy="44" rx="3" ry="18" fill="#2b1b06"/>
     <path d="M 30 32c10 6 22 9 34 10" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".7"/>
     <rect x="66" y="40" width="9" height="12" rx="2" fill="url(#brass)" stroke="#7c5211"/>
     <ellipse cx="82" cy="46" rx="10" ry="14" fill="url(#bulb)"/>
     <ellipse cx="79" cy="40" rx="3" ry="5" fill="#fff" opacity=".4"/>`,
    brass + gradient("bulb", "#dc2626", "#6d0f0f"),
  ),
  toolbox: picture(
    `<path d="M 36 30v-7c0-3 2-5 5-5h14c3 0 5 2 5 5v7" fill="none" stroke="url(#chrome)" stroke-width="5"/>
     <path d="M 16 44l6-16h52l6 16Z" fill="url(#lid)"/>
     <rect x="12" y="44" width="72" height="36" rx="3" fill="url(#box)"/>
     <path d="M 12 52h72" stroke="#7f1d1d" stroke-width="1.5"/>
     <rect x="27" y="43" width="9" height="14" rx="2" fill="url(#chrome)" stroke="#57606a" stroke-width=".6"/>
     <rect x="60" y="43" width="9" height="14" rx="2" fill="url(#chrome)" stroke="#57606a" stroke-width=".6"/>
     <path d="M 20 66h24" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".3"/>`,
    gradient("lid", "#ef5a4a", "#b42318") + gradient("box", "#d9402f", "#7f1d1d") + chrome,
  ),
  mirror: picture(
    `<path d="M 48 62c0 8 3 14 8 22" fill="none" stroke="url(#chrome)" stroke-width="6" stroke-linecap="round"/>
     <circle cx="46" cy="36" r="27" fill="url(#chrome)" stroke="#57606a"/>
     <circle cx="46" cy="36" r="21" fill="url(#sky)"/>
     <path d="M 25 42c7-5 12-3 18 0s14 3 24-2v6a21 21 0 0 1-42 0Z" fill="#4b7a5c"/>
     <path d="M 34 22l18-6-22 26Z" fill="#fff" opacity=".4"/>`,
    chrome + gradient("sky", "#bae6fd", "#3b82c4"),
  ),
  tank: picture(
    `<path d="M 10 58C12 38 32 26 54 26c14 0 28 8 32 22 2 8-2 14-10 16-22 6-46 6-58 2-5-2-8-4-8-8Z" fill="url(#paint)" stroke="#0f5e5a" stroke-width="1"/>
     <path d="M 16 56c20-10 44-14 66-8" fill="none" stroke="#fef3c7" stroke-width="5"/>
     <rect x="42" y="18" width="16" height="9" rx="3" fill="url(#chrome)" stroke="#57606a" stroke-width=".7"/>
     <ellipse cx="50" cy="48" rx="9" ry="6" fill="#fef3c7" stroke="#b45309" stroke-width="1.2"/>
     <path d="M 26 38c8-6 18-8 28-8" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".55"/>`,
    gradient("paint", "#2dd4bf", "#0f766e") + chrome,
  ),
  speedometer: picture(
    `<circle cx="48" cy="44" r="34" fill="url(#chrome)" stroke="#57606a"/>
     <circle cx="48" cy="44" r="28" fill="#141414"/>
     <g stroke="#f5f5f4" stroke-width="2.4" stroke-linecap="round"><path d="M 26 58l4-2.2M 22 44h5M 26 30l4 2.2M 36 20l2.4 4M 48 17v5M 60 20l-2.4 4M 70 30l-4 2.2M 74 44h-5M 70 58l-4-2.2"/></g>
     <path d="M 48 44 67 31" stroke="#ef4444" stroke-width="3" stroke-linecap="round"/>
     <circle cx="48" cy="44" r="4.5" fill="url(#chrome)"/>
     <rect x="38" y="56" width="20" height="7" rx="1" fill="#f5f5f4"/>
     <path d="M 42 56v7M 46 56v7M 50 56v7M 54 56v7" stroke="#141414" stroke-width=".7"/>
     <path d="M 28 28c6-7 14-10 22-10" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".35"/>`,
    chrome,
  ),
  goggles: picture(
    `<path d="M 4 46c6-3 8-3 12-2M 92 46c-6-3-8-3-12-2" fill="none" stroke="#5b3a1e" stroke-width="8" stroke-linecap="round"/>
     <path d="M 12 34c10-5 22-4 30 2 4 3 8 3 12 0 8-6 20-7 30-2 3 10 1 24-8 30-9 5-20 2-25-8-2-4-4-4-6 0-5 10-16 13-25 8-9-6-11-20-8-30Z" fill="url(#leather)"/>
     <ellipse cx="30" cy="48" rx="13" ry="12" fill="url(#lens)" stroke="url(#chrome)" stroke-width="3"/>
     <ellipse cx="66" cy="48" rx="13" ry="12" fill="url(#lens)" stroke="url(#chrome)" stroke-width="3"/>
     <path d="M 23 43l9-6M 59 43l9-6" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".65"/>`,
    gradient("leather", "#8a5a2c", "#4a2c12") + gradient("lens", "#fcd34d", "#b45309") + chrome,
  ),
};

// Logo del negozio eBay, come lo restituisce `GetStore`; gli altri negozi non ne hanno uno.
const storeLogo = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><rect width="48" height="48" fill="#fff"/><circle cx="24" cy="24" r="17" fill="none" stroke="#b45309" stroke-width="3"/><path d="M 15 27h18M 18 27l3-8h6l3 8M 17 31a2 2 0 1 0 0 .1M 31 31a2 2 0 1 0 0 .1" fill="none" stroke="#1f2937" stroke-width="2.5" stroke-linecap="round"/></svg>`,
)}`;

export const stores = {
  vintage: {
    id: "neg-vintage",
    name: "Vintage Garage Italia",
    username: "vintage_garage_it",
    logoUrl: storeLogo,
    storeUrl: "https://www.ebay.it/str/vintagegarageitalia",
    feedback: { score: 4_812, positivePercent: 99.8, topRated: true },
    marketplace: "EBAY_IT",
  },
  outlet: {
    id: "neg-outlet",
    name: "Outlet ricambi auto e moto d’epoca - magazzino secondario",
    username: "outlet_ricambi_epoca",
    marketplace: "EBAY_IT",
  },
  retro: {
    id: "neg-retro",
    name: "Retro Parts Europe",
    username: "retroparts_eu",
    marketplace: "EBAY_DE",
  },
  bottega: {
    id: "neg-bottega",
    name: "Bottega Retrò Sardegna",
    username: "bottega_retro_ss",
    marketplace: "EBAY_IT",
  },
} as const;

type StoreKey = keyof typeof stores;

export interface OrderSeed extends Omit<
  OrderView,
  | "storeId"
  | "storeName"
  | "marketplace"
  | "lastSyncedAt"
  | "updatedAt"
  | "payment"
  | "shipping"
  | "items"
  | "suggestions"
  | "contacts"
> {
  store: StoreKey;
  /** Stato normalizzato, oppure codice eBay non previsto. */
  payment: PaymentStatus | { code: string };
  shipping: ShippingStatus | { code: string };
  items: Array<Omit<OrderView["items"][number], "currency">>;
  /** Ultima modifica su eBay; senza, quella della creazione. */
  updatedAt?: string;
  suggestion?: SuggestionView;
  /** Valori presenti ma da sbloccare nel piano Free. */
  lockable?: TaxIdentifierView[];
}

/** Condizione dell'ultima lettura negli ordini dello scenario dei dati discordanti. */
export const readNotices: Partial<Record<string, FiscalNotice>> = {
  "ord-01": "notReturned",
  "ord-10": "masked",
  "ord-12": "lastKnown",
  "ord-13": "checking",
};

export const cf = (
  value: string,
  quality: TaxIdentifierView["quality"] = "valid",
): TaxIdentifierView => ({
  type: "CF",
  value,
  quality,
});

/** Riga con prezzo unitario: l'importo della riga è prezzo per quantità. */
const item = (
  id: string,
  title: string,
  priceMinor: number,
  quantity = 1,
  sku: string | null = null,
) => ({
  id,
  title,
  totalMinor: priceMinor * quantity,
  quantity,
  sku,
});

export const seeds: OrderSeed[] = [
  {
    id: "ord-01",
    ebayOrderId: "16-84213-57096",
    createdAt: minutesAgo(180),
    store: "vintage",
    buyerName: "Società Cooperativa Agricola Val di Non e Valle di Sole Soc. Coop.",
    buyerUsername: "coop_valdinon",
    shipTo: {
      name: "Magazzino Cooperativa, c/o Ufficio acquisti",
      locality: "Cles (TN)",
      country: "IT",
    },
    items: [
      item(
        "it-01a",
        "Macchina da scrivere portatile meccanica anni 50 revisionata con custodia",
        50_300,
        2,
        "MSC-OL-44",
      ),
      item("it-01b", "Custodia protettiva e accessori", 14_500, 1, "CUS-12"),
      item("it-01c", "Nastro inchiostrato bicolore compatibile", 2_450, 4, null),
      // Prezzo di lotto: l'importo non si divide in centesimi esatti per la quantità.
      {
        id: "it-01d",
        title: "Molle di ricambio assortite",
        totalMinor: 1_000,
        quantity: 3,
        sku: null,
      },
    ],
    thumbnail: productImages.typewriter,
    totalMinor: 125_900,
    currency: "EUR",
    payment: "paid",
    shipping: "to_ship",
    billingAddress: {
      line: "Via Trento 1",
      postalCode: "38023",
      city: "Cles",
      province: "TN",
      countryCode: "IT",
    },
    phone: "+39 354 281 7701",
    email: "8b41f7c2d09e36a5c1f7@members.ebay.com",
    fiscal: {
      state: "available",
      identifiers: [{ type: "PIVA", value: "01234567897", quality: "valid" }],
    },
  },
  {
    id: "ord-02",
    ebayOrderId: "27-10293-84756",
    // La prima riga dell'elenco, e quindi delle immagini del sito, mostra due ordini di un
    // articolo con il Codice Fiscale; la cooperativa con la Partita IVA segue.
    createdAt: minutesAgo(38),
    updatedAt: minutesAgo(25),
    store: "vintage",
    buyerName: "Maria Rossi",
    buyerUsername: "maria.rossi80",
    shipTo: { name: "Maria Rossi", locality: "Roma (RM)", country: "IT" },
    items: [
      {
        ...item(
          "it-02a",
          "Casco jet anni 60 in fibra rosso restaurato vintage moto scooter taglia M",
          18_900,
          1,
          "CASCO-60R",
        ),
        listingId: "286104553201",
      },
    ],
    totalMinor: 18_900,
    currency: "EUR",
    payment: "paid",
    shipping: "shipped",
    billingAddress: {
      line: "Via Appia Nuova 120",
      postalCode: "00183",
      city: "Roma",
      province: "RM",
      countryCode: "IT",
    },
    phone: "+39 354 618 2740",
    email: "3f7c19e8a2b64d05c1e9@members.ebay.com",
    fiscal: { state: "available", identifiers: [cf("RSSMRA80A41H501Y")] },
    thumbnail: productImages.helmet,
  },
  {
    id: "ord-03",
    ebayOrderId: "05-48217-36194",
    createdAt: minutesAgo(140),
    store: "vintage",
    buyerName: "Luca Bianchi",
    buyerUsername: "lucab_75",
    shipTo: { name: "Luca Bianchi", locality: "Milano (MI)", country: "IT" },
    items: [
      item(
        "it-03a",
        "Faro anteriore cromato anni 60 restaurato per scooter d’epoca diametro 130 mm",
        12_900,
        1,
        "FARO-130",
      ),
    ],
    totalMinor: 12_900,
    currency: "EUR",
    payment: "paid",
    shipping: "to_ship",
    billingAddress: {
      line: "Corso Buenos Aires 40",
      postalCode: "20124",
      city: "Milano",
      province: "MI",
      countryCode: "IT",
    },
    phone: null,
    email: "a90d3e71c4f8b2607de3@members.ebay.com",
    fiscal: { state: "locked", shownAs: "CF" },
    lockable: [cf("BNCLCU75C12F205G")],
    thumbnail: productImages.headlight,
  },
  {
    id: "ord-04",
    ebayOrderId: "19-62740-31885",
    createdAt: minutesAgo(260),
    store: "vintage",
    buyerName: "Giulia Verdi",
    buyerUsername: "giuliaverdi",
    shipTo: { name: "Giulia Verdi", locality: "Torino (TO)", country: "IT" },
    items: [
      item(
        "it-04a",
        "Clacson a tromba in ottone anni 30 con pompetta originale auto d’epoca",
        6_500,
        1,
        "CLAC-30",
      ),
    ],
    thumbnail: productImages.horn,
    totalMinor: 6_500,
    currency: "EUR",
    payment: "paid",
    shipping: "to_ship",
    billingAddress: {
      line: "Via Po 18",
      postalCode: "10123",
      city: "Torino",
      province: "TO",
      countryCode: "IT",
    },
    phone: "+39 354 902 1136",
    email: null,
    fiscal: { state: "error" },
  },
  {
    id: "ord-05",
    ebayOrderId: "31-77421-10058",
    createdAt: minutesAgo(410),
    store: "vintage",
    buyerName: "Giovanni Maria Alessandro Bartolomeo De Santis Lombardi",
    buyerUsername: "gm_desantis",
    shipTo: { name: "Studio De Santis Lombardi", locality: "Bari (BA)", country: "IT" },
    items: [
      item(
        "it-05a",
        "Cassetta attrezzi in lamiera anni 50 verniciata rossa officina vintage",
        8_900,
        1,
        "CASS-50",
      ),
      item("it-05b", "Set chiavi inglesi cromate vintage 6 pezzi", 2_490, 2, "CHIA-06"),
      item("it-05c", "Oliatore in ottone da officina anni 40", 1_800, 1, null),
    ],
    thumbnail: productImages.toolbox,
    totalMinor: 15_680,
    currency: "EUR",
    payment: "paid",
    shipping: "to_ship",
    billingAddress: {
      line: "Via Sparano da Bari 55",
      postalCode: "70121",
      city: "Bari",
      province: "BA",
      countryCode: "IT",
    },
    phone: "+39 354 377 5021",
    email: "c62e08b5f1a94d73e80c@members.ebay.com",
    fiscal: { state: "missing" },
  },
  {
    id: "ord-06",
    ebayOrderId: "08-33110-45672",
    createdAt: minutesAgo(600),
    store: "vintage",
    buyerName: "Anna Esposito",
    buyerUsername: "anna_espo",
    shipTo: { name: "Anna Esposito", locality: "Napoli (NA)", country: "IT" },
    items: [
      item(
        "it-06a",
        "Specchietto retrovisore tondo cromato anni 60 per moto e scooter d’epoca",
        3_900,
        1,
        "SPE-22",
      ),
    ],
    thumbnail: productImages.mirror,
    totalMinor: 3_900,
    currency: "EUR",
    payment: "paid",
    shipping: "in_progress",
    billingAddress: {
      line: "Via Toledo 210",
      postalCode: "80134",
      city: "Napoli",
      province: "NA",
      countryCode: "IT",
    },
    phone: "+39 354 760 4418",
    email: "e15b7a03d2c86f49b1a6@members.ebay.com",
    fiscal: { state: "available", identifiers: [cf("SPSNNA85T55F83", "format")] },
  },
  {
    id: "ord-07",
    ebayOrderId: "22-90807-66341",
    createdAt: minutesAgo(900),
    store: "vintage",
    buyerName: "Marco Ferrari",
    buyerUsername: "ferrari.marco",
    shipTo: { name: "Marco Ferrari", locality: "Modena (MO)", country: "IT" },
    items: [
      item(
        "it-07a",
        "Serbatoio moto anni 60 verniciato originale verde acqua con tappo cromato",
        15_000,
        1,
        "SERB-60",
      ),
    ],
    totalMinor: 15_000,
    currency: "EUR",
    payment: "paid",
    shipping: "to_ship",
    billingAddress: {
      line: "Via Emilia Est 300",
      postalCode: "41121",
      city: "Modena",
      province: "MO",
      countryCode: "IT",
    },
    phone: "+39 354 145 8863",
    email: "07d4c9e2b16fa385d07b@members.ebay.com",
    fiscal: { state: "available", identifiers: [cf("BNCGPP70L12F205O", "name")] },
    thumbnail: productImages.tank,
  },
  {
    id: "ord-08",
    ebayOrderId: "14-20983-11275",
    createdAt: minutesAgo(1_300),
    store: "vintage",
    buyerName: "Chiara Romano",
    buyerUsername: "chiara_r",
    shipTo: { name: "Chiara Romano", locality: "Genova (GE)", country: "IT" },
    items: [item("it-08a", "Candela di accensione", 1_999, 1, "CAN-08")],
    totalMinor: 1_999,
    currency: "EUR",
    payment: "unpaid",
    shipping: "to_ship",
    billingAddress: null,
    phone: null,
    email: "5ea20f8c7b13d964ae02@members.ebay.com",
    fiscal: { state: "checking" },
  },
  {
    id: "ord-09",
    ebayOrderId: "02-44519-70831",
    createdAt: minutesAgo(1_800),
    store: "vintage",
    buyerName: "Paolo Conti",
    buyerUsername: "pconti",
    shipTo: { name: "Paolo Conti", locality: "Verona (VR)", country: "IT" },
    items: [item("it-09a", "Pedale freno", 999, 1, null)],
    totalMinor: 999,
    currency: "EUR",
    payment: "paid",
    shipping: "to_ship",
    billingAddress: {
      line: "Via Mazzini 7",
      postalCode: "37121",
      city: "Verona",
      province: "VR",
      countryCode: "IT",
    },
    phone: "+39 354 553 0297",
    email: "b38f16d0e7a25c49f8d1@members.ebay.com",
    fiscal: { state: "locked", shownAs: "PIVA" },
    lockable: [{ type: "PIVA", value: "04567890126", quality: "valid" }],
  },
  {
    id: "ord-10",
    ebayOrderId: "11-60325-94410",
    createdAt: minutesAgo(2_600),
    updatedAt: minutesAgo(1_300),
    store: "vintage",
    buyerName: "Elena Galli",
    buyerUsername: "elena.galli",
    shipTo: { name: "Galli Restauri S.n.c.", locality: "Bergamo (BG)", country: "IT" },
    items: [
      item(
        "it-10a",
        "Contachilometri meccanico anni 60 con cruscotto completo restaurato",
        21_200,
        1,
        "CRU-500",
      ),
    ],
    thumbnail: productImages.speedometer,
    totalMinor: 21_200,
    currency: "EUR",
    payment: "paid",
    shipping: "shipped",
    billingAddress: {
      line: "Via XX Settembre 14",
      postalCode: "24122",
      city: "Bergamo",
      province: "BG",
      countryCode: "IT",
    },
    phone: "+39 354 228 9614",
    email: "2c91e6a7f04b8d35c6e1@members.ebay.com",
    fiscal: {
      state: "available",
      identifiers: [
        cf("GLLLNE82D45A794P"),
        { type: "PIVA", value: "03456789019", quality: "valid" },
      ],
    },
  },
  {
    id: "ord-11",
    ebayOrderId: "09-11873-20564",
    createdAt: minutesAgo(3_400),
    store: "vintage",
    buyerName: "Francesca Colombo",
    buyerUsername: "fra_colombo",
    shipTo: { name: "Francesca Colombo", locality: "Como (CO)", country: "IT" },
    items: [item("it-11a", "Portapacchi posteriore", 4_500, 1, "POR-11")],
    totalMinor: 4_500,
    currency: "EUR",
    payment: "unpaid",
    shipping: "cancelled",
    billingAddress: {
      line: "Via Vittorio Emanuele II 5",
      postalCode: "22100",
      city: "Como",
      province: "CO",
      countryCode: "IT",
    },
    phone: null,
    email: "francesca@colomborestauri.it",
    fiscal: { state: "missing" },
  },
  {
    id: "ord-12",
    ebayOrderId: "25-30491-88120",
    createdAt: minutesAgo(4_800),
    updatedAt: minutesAgo(3_100),
    store: "vintage",
    buyerName: "Roberto Ricci",
    buyerUsername: "rricci",
    shipTo: { name: "Roberto Ricci", locality: "Pisa (PI)", country: "IT" },
    items: [item("it-12a", "Sella biposto", 3_000, 1, "SEL-02")],
    totalMinor: 3_000,
    currency: "EUR",
    payment: "partially_refunded",
    shipping: "shipped",
    billingAddress: {
      line: "Lungarno Pacinotti 3",
      postalCode: "56126",
      city: "Pisa",
      province: "PI",
      countryCode: "IT",
    },
    phone: "+39 354 836 1172",
    email: "d7083fb1c5e92a64d3f7@members.ebay.com",
    fiscal: { state: "available", identifiers: [cf("RCCRRT77B10G702J")] },
  },
  {
    id: "ord-13",
    ebayOrderId: "18-72630-51207",
    createdAt: minutesAgo(700),
    store: "retro",
    buyerName: "Hans Müller",
    buyerUsername: "hmueller_de",
    shipTo: { name: "Hans Müller", locality: "München", country: "DE" },
    items: [item("it-13a", "Scheinwerfer Chrom, Nachbau", 6_400, 1, "SCH-01")],
    totalMinor: 6_400,
    currency: "EUR",
    payment: "paid",
    // Stato eBay non previsto: compare con il codice originale.
    shipping: { code: "ON_HOLD" },
    billingAddress: {
      line: "Leopoldstraße 20",
      postalCode: "80802",
      city: "München",
      province: null,
      countryCode: "DE",
    },
    phone: "+49 000 1000013",
    email: "94ae7c20b6f1d853ea09@members.ebay.com",
    fiscal: {
      state: "available",
      identifiers: [
        {
          type: "OTHER",
          typeLabel: "Steuernummer (DE)",
          value: "12/345/67890",
          quality: "unchecked",
        },
      ],
    },
  },
  {
    id: "ord-14",
    ebayOrderId: "30-55012-90876",
    createdAt: minutesAgo(1_100),
    store: "outlet",
    buyerName: "Tecnoufficio S.r.l.",
    buyerUsername: "tecnoufficio_srl",
    shipTo: { name: "Tecnoufficio S.r.l.", locality: "Padova (PD)", country: "IT" },
    items: [item("it-14a", "Lotto di 20 molle frizione assortite", 3_990, 1, "MOL-20")],
    totalMinor: 3_990,
    currency: "EUR",
    payment: "paid",
    shipping: "to_ship",
    billingAddress: {
      line: "Via Venezia 60",
      postalCode: "35131",
      city: "Padova",
      province: "PD",
      countryCode: "IT",
    },
    phone: "+39 354 671 3385",
    email: "1fb6d48e0a93c752f1b4@members.ebay.com",
    fiscal: {
      state: "available",
      identifiers: [{ type: "PIVA", value: "09876543217", quality: "valid" }],
    },
  },
];

export const incomingSeeds: OrderSeed[] = [
  {
    id: "ord-20",
    ebayOrderId: "40-73156-20482",
    createdAt: minutesAgo(3),
    store: "vintage",
    buyerName: "Giorgio Neri",
    buyerUsername: "gneri",
    shipTo: { name: "Giorgio Neri", locality: "Parma (PR)", country: "IT" },
    items: [
      item(
        "it-20a",
        "Insegna smaltata officina Garage anni 50 originale lamiera 70x50 cm collezione",
        16_500,
        1,
        "INS-50",
      ),
    ],
    thumbnail: productImages.sign,
    totalMinor: 16_500,
    currency: "EUR",
    payment: "paid",
    shipping: "to_ship",
    billingAddress: {
      line: "Strada Farini 9",
      postalCode: "43121",
      city: "Parma",
      province: "PR",
      countryCode: "IT",
    },
    phone: "+39 354 409 6658",
    email: "6d20a9f3e8c17b45d2a0@members.ebay.com",
    fiscal: { state: "available", identifiers: [cf("NREGRG80A01G337P")] },
  },
  {
    id: "ord-21",
    ebayOrderId: "40-91628-47305",
    createdAt: minutesAgo(1),
    store: "vintage",
    buyerName: "Martina Greco",
    buyerUsername: "martina.greco",
    shipTo: { name: "Martina Greco", locality: "Lecce (LE)", country: "IT" },
    items: [
      item(
        "it-21a",
        "Occhiali da moto anni 50 in pelle lenti ambra originali vintage aviatore",
        6_900,
        1,
        null,
      ),
    ],
    thumbnail: productImages.goggles,
    totalMinor: 6_900,
    currency: "EUR",
    payment: "paid",
    shipping: "to_ship",
    billingAddress: {
      line: "Via Trinchese 30",
      postalCode: "73100",
      city: "Lecce",
      province: "LE",
      countryCode: "IT",
    },
    phone: null,
    email: "f3c850d7a1e62b94c7f3@members.ebay.com",
    fiscal: { state: "checking" },
  },
];

export function storeView(key: StoreKey, overrides: Partial<StoreView> = {}): StoreView {
  const base = stores[key];
  return {
    ...base,
    connection: "active",
    syncing: false,
    lastSyncAt: minutesAgo(key === "vintage" ? 5 : 12),
    notifications: null,
    importedOrders: key === "vintage" ? 128 : key === "outlet" ? 46 : key === "retro" ? 19 : 7,
    historyDays: 30,
    importing: false,
    connectedAt: "2026-06-14T09:20:00Z",
    consentExpiresAt: "2028-03-14T09:20:00Z",
    targetMinutes: 30,
    recent: [
      { at: minutesAgo(5), ok: true, newOrders: 1 },
      { at: minutesAgo(35), ok: true, newOrders: 0 },
      { at: minutesAgo(65), ok: true, newOrders: 2 },
    ],
    ...overrides,
  };
}

export function toOrder(seed: OrderSeed, storeList: StoreView[]): OrderView {
  const { store, lockable: _lockable, payment, shipping, suggestion, updatedAt, ...order } = seed;
  const view = storeList.find((candidate) => candidate.id === stores[store].id);
  return {
    ...order,
    contacts: contactsView(order),
    items: order.items.map((line) => ({ ...line, currency: order.currency })),
    payment: typeof payment === "string" ? { status: payment } : { status: null, ...payment },
    shipping: typeof shipping === "string" ? { status: shipping } : { status: null, ...shipping },
    suggestions: suggestion ? [suggestion] : [],
    storeId: stores[store].id,
    storeName: stores[store].name,
    marketplace: stores[store].marketplace,
    lastSyncedAt: view?.lastSyncAt ?? minutesAgo(5),
    updatedAt: updatedAt ?? order.createdAt,
  };
}
