import { contactsView } from "../contact";
import { productImages } from "./product-images.server";
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

// Logo del negozio eBay, come lo restituisce `GetStore`; gli altri negozi non ne hanno uno.
export const storeLogo = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><rect width="48" height="48" fill="#fff"/><circle cx="24" cy="24" r="17" fill="none" stroke="#b45309" stroke-width="3"/><path d="M 15 27h18M 18 27l3-8h6l3 8M 17 31a2 2 0 1 0 0 .1M 31 31a2 2 0 1 0 0 .1" fill="none" stroke="#1f2937" stroke-width="2.5" stroke-linecap="round"/></svg>`,
)}`;

export const stores = {
  vintage: {
    id: "neg-vintage",
    name: "Vintage Garage Italia",
    username: "vintage_garage_it",
    logoUrl: storeLogo,
    storeUrl: "https://vintage-garage.invalid/str/vintagegarageitalia",
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
export const item = (
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
    email: "8b41f7c2d09e36a5c1f7@members.ebay.invalid",
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
    email: "3f7c19e8a2b64d05c1e9@members.ebay.invalid",
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
    email: "a90d3e71c4f8b2607de3@members.ebay.invalid",
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
    email: "c62e08b5f1a94d73e80c@members.ebay.invalid",
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
    email: "e15b7a03d2c86f49b1a6@members.ebay.invalid",
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
    email: "07d4c9e2b16fa385d07b@members.ebay.invalid",
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
    email: "5ea20f8c7b13d964ae02@members.ebay.invalid",
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
    email: "b38f16d0e7a25c49f8d1@members.ebay.invalid",
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
    email: "2c91e6a7f04b8d35c6e1@members.ebay.invalid",
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
    email: "francesca@colomborestauri.invalid",
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
    email: "d7083fb1c5e92a64d3f7@members.ebay.invalid",
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
    email: "94ae7c20b6f1d853ea09@members.ebay.invalid",
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
    email: "1fb6d48e0a93c752f1b4@members.ebay.invalid",
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
    email: "6d20a9f3e8c17b45d2a0@members.ebay.invalid",
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
    email: "f3c850d7a1e62b94c7f3@members.ebay.invalid",
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
