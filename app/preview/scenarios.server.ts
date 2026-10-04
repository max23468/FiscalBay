import type { Language } from "../i18n";
import { formatDate } from "../view-models";
import type {
  OrdersNotice,
  AccountView,
  DiagnosticsView,
  NotificationView,
  OrderView,
  SessionView,
  StoreView,
  TaxIdentifierView,
} from "../view-models";

/**
 * Scenari sintetici dell'anteprima. Nessun dato reale: nomi, codici e ordini
 * sono inventati, gli indirizzi email usano il dominio riservato `.invalid`.
 * I valori da sbloccare restano in questo modulo server e arrivano al browser
 * solo dopo lo sblocco simulato.
 */

export const scenarioIds = [
  "ordinario",
  "quota-esaurita",
  "aggiornamento",
  "ebay-non-disponibile",
  "negozio-scaduto",
  "dati-discordanti",
  "primo-accesso",
  "importazione",
  "nessun-ordine",
  "caricamento",
  "premium",
  "premium-a-vita",
] as const;

export type ScenarioId = (typeof scenarioIds)[number];

export function isScenarioId(value: unknown): value is ScenarioId {
  return typeof value === "string" && (scenarioIds as readonly string[]).includes(value);
}

const scenarioText: Record<ScenarioId, Record<Language, { name: string; focus: string }>> = {
  ordinario: {
    it: {
      name: "Free, uso ordinario",
      focus: "Codici disponibili, da sbloccare, assenti, da verificare, errori e testi lunghi.",
    },
    en: {
      name: "Free, everyday use",
      focus: "Available, locked, missing and to-review codes, errors and long text.",
    },
  },
  "quota-esaurita": {
    it: {
      name: "Sblocchi esauriti",
      focus:
        "Gli ordini restano consultabili. Codice Fiscale e Partita IVA dei nuovi ordini attendono il prossimo ciclo.",
    },
    en: {
      name: "No unlocks left",
      focus:
        "Orders remain available. Codice Fiscale and Partita IVA of new orders wait for the next cycle.",
    },
  },
  aggiornamento: {
    it: {
      name: "Aggiornamento in corso",
      focus:
        "Indicatore locale, ordini consultabili e nuovi ordini inseriti subito in cima alla lista.",
    },
    en: {
      name: "Update in progress",
      focus: "Local indicator, orders still available, new orders added at the top of the list.",
    },
  },
  "ebay-non-disponibile": {
    it: {
      name: "eBay non risponde",
      focus: "Ultimo aggiornamento, azioni che dipendono da eBay sospese, il resto utilizzabile.",
    },
    en: {
      name: "eBay not responding",
      focus: "Last update time, eBay-dependent actions paused, everything else usable.",
    },
  },
  "negozio-scaduto": {
    it: {
      name: "Problema su un negozio",
      focus:
        "Premium con quattro negozi: uno da ricollegare, uno con autorizzazione incompleta, uno non verificabile.",
    },
    en: {
      name: "Problem with one store",
      focus:
        "Premium with four stores: one to reconnect, one with incomplete authorisation, one that cannot be verified.",
    },
  },
  "dati-discordanti": {
    it: {
      name: "Dati discordanti",
      focus: "Codice aggiornato da eBay, nome non coerente, omocodia e suggerimenti in conflitto.",
    },
    en: {
      name: "Conflicting data",
      focus: "Code updated by eBay, name mismatch, ambiguous codes and conflicting suggestions.",
    },
  },
  "primo-accesso": {
    it: {
      name: "Primo accesso",
      focus:
        "Nessun negozio e primi passi. In Negozi il collegamento simulato risulta già usato da un altro account.",
    },
    en: {
      name: "First sign-in",
      focus:
        "No store and getting started. In Stores the simulated connection is already used by another account.",
    },
  },
  importazione: {
    it: {
      name: "Importazione iniziale",
      focus: "Prime righe già consultabili durante l'importazione dello storico.",
    },
    en: {
      name: "Initial import",
      focus: "First rows available while the history is being imported.",
    },
  },
  "nessun-ordine": {
    it: {
      name: "Nessun ordine",
      focus: "Negozio collegato e aggiornato, periodo senza ordini.",
    },
    en: {
      name: "No orders",
      focus: "Store connected and up to date, no orders in the period.",
    },
  },
  caricamento: {
    it: { name: "Caricamento", focus: "Scheletro aderente al layout delle schede." },
    en: { name: "Loading", focus: "Skeleton matching the card layout." },
  },
  premium: {
    it: {
      name: "Premium, più negozi",
      focus: "Tre negozi, notifiche Telegram, XLSX. Il primo salvataggio automatico fallisce.",
    },
    en: {
      name: "Premium, several stores",
      focus: "Three stores, Telegram notifications, XLSX. The first autosave fails.",
    },
  },
  "premium-a-vita": {
    it: {
      name: "Premium a vita",
      focus:
        "Acquisto una tantum senza rinnovi, negozio messo in pausa dall'utente, Codice Fiscale con carattere di controllo errato.",
    },
    en: {
      name: "Premium, lifetime",
      focus:
        "One-off purchase with no renewals, a store paused by the user, a tax code with a wrong check character.",
    },
  },
};

export function scenarioOptions(language: Language) {
  const reference = formatDate(previewNow, language);
  const clock =
    language === "it"
      ? `Simulazione fissata al ${reference} (Europe/Rome).`
      : `Simulation fixed at ${reference} (Europe/Rome).`;
  return scenarioIds.map((id) => ({
    id,
    ...scenarioText[id][language],
    focus: `${scenarioText[id][language].focus} ${clock}`,
  }));
}

/** Istante di riferimento fisso: date e tempi relativi restano stabili. */
export const previewNow = "2026-09-27T13:00:00Z";

const minutesAgo = (minutes: number) =>
  new Date(new Date(previewNow).getTime() - minutes * 60_000).toISOString();

const thumbnail = (hue: number) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="hsl(${hue} 15% 25%)"/><path d="M 12 17 24 11 36 17v15L 24 38 12 32Zm0 0 12 6 12-6M 24 23v15" fill="none" stroke="hsl(${hue} 20% 75%)" stroke-width="2"/></svg>`,
  )}`;

const stores = {
  vintage: {
    id: "neg-vintage",
    name: "Vintage Garage Italia",
    username: "vintage_garage_it",
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

interface OrderSeed extends Omit<
  OrderView,
  "storeId" | "storeName" | "marketplace" | "lastSyncedAt"
> {
  store: StoreKey;
  /** Valori presenti ma da sbloccare nel piano Free. */
  lockable?: TaxIdentifierView[];
}

const cf = (value: string, quality: TaxIdentifierView["quality"] = "valid"): TaxIdentifierView => ({
  type: "CF",
  value,
  quality,
});

const item = (
  id: string,
  title: string,
  priceMinor: number,
  quantity = 1,
  sku: string | null = null,
) => ({
  id,
  title,
  priceMinor,
  quantity,
  sku,
});

const seeds: OrderSeed[] = [
  {
    id: "ord-01",
    ebayOrderId: "12-34567-89012",
    createdAt: minutesAgo(38),
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
        "Set di ricambi originali per macchina da scrivere meccanica, edizione da collezione",
        50_300,
        2,
        "MSC-OL-44",
      ),
      item("it-01b", "Custodia protettiva e accessori", 14_500, 1, "CUS-12"),
      item("it-01c", "Nastro inchiostrato bicolore compatibile", 2_450, 4, null),
    ],
    totalMinor: 124_900,
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
    phone: "+39 000 1000 001",
    email: "acquisti@coop-valdinon.invalid",
    fiscal: {
      state: "available",
      identifiers: [{ type: "PIVA", value: "01234567890", quality: "valid" }],
    },
  },
  {
    id: "ord-02",
    ebayOrderId: "27-10293-84756",
    createdAt: minutesAgo(95),
    store: "vintage",
    buyerName: "Maria Rossi",
    buyerUsername: "maria.rossi80",
    shipTo: { name: "Maria Rossi", locality: "Roma (RM)", country: "IT" },
    items: [item("it-02a", "Carburatore Dell’Orto PHBG 19 revisionato", 4_990, 1, "CARB-PHBG19")],
    totalMinor: 4_990,
    currency: "EUR",
    payment: "paid",
    shipping: "delivered",
    billingAddress: {
      line: "Via Appia Nuova 120",
      postalCode: "00183",
      city: "Roma",
      province: "RM",
      countryCode: "IT",
    },
    phone: "+39 000 1000 002",
    email: "maria.rossi@esempio.invalid",
    fiscal: { state: "available", identifiers: [cf("RSSMRA80A41H501U")] },
    thumbnail: thumbnail(210),
  },
  {
    id: "ord-03",
    ebayOrderId: "05-55555-12121",
    createdAt: minutesAgo(140),
    store: "vintage",
    buyerName: "Luca Bianchi",
    buyerUsername: "lucab_75",
    shipTo: { name: "Luca Bianchi", locality: "Milano (MI)", country: "IT" },
    items: [item("it-03a", "Faro anteriore cromato per Vespa 125", 1_200, 1, "FARO-V125")],
    totalMinor: 1_200,
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
    email: "lucab75@esempio.invalid",
    fiscal: { state: "locked", shownAs: "CF" },
    lockable: [cf("BNCLCU75C12F205X")],
    thumbnail: thumbnail(30),
  },
  {
    id: "ord-04",
    ebayOrderId: "19-00001-99999",
    createdAt: minutesAgo(260),
    store: "vintage",
    buyerName: "Giulia Verdi",
    buyerUsername: "giuliaverdi",
    shipTo: { name: "Giulia Verdi", locality: "Torino (TO)", country: "IT" },
    items: [item("it-04a", "Guarnizione testata", 750, 1, "GUA-77")],
    totalMinor: 750,
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
    phone: "+39 000 1000 004",
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
      item("it-05a", "Kit frizione", 3_200, 1, "FRZ-01"),
      item("it-05b", "Cavo acceleratore rinforzato", 1_490, 2, "CAV-03"),
      item("it-05c", "Manopole in gomma, coppia", 1_260, 1, null),
    ],
    totalMinor: 8_640,
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
    phone: "+39 000 1000 005",
    email: "studio.desantis@esempio.invalid",
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
    items: [item("it-06a", "Specchietto retrovisore", 2_300, 1, "SPE-22")],
    totalMinor: 2_300,
    currency: "EUR",
    payment: "paid",
    shipping: "shipped",
    billingAddress: {
      line: "Via Toledo 210",
      postalCode: "80134",
      city: "Napoli",
      province: "NA",
      countryCode: "IT",
    },
    phone: "+39 000 1000 006",
    email: "anna.espo@esempio.invalid",
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
    items: [item("it-07a", "Serbatoio verniciato originale anni ’60", 15_000, 1, "SERB-60")],
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
    phone: "+39 000 1000 007",
    email: "ferrari.marco@esempio.invalid",
    fiscal: { state: "available", identifiers: [cf("BNCGPP70L12F205K", "name")] },
    thumbnail: thumbnail(120),
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
    email: "chiara.r@esempio.invalid",
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
    phone: "+39 000 1000 009",
    email: "pconti@esempio.invalid",
    fiscal: { state: "locked", shownAs: "PIVA" },
    lockable: [{ type: "PIVA", value: "04567890123", quality: "valid" }],
  },
  {
    id: "ord-10",
    ebayOrderId: "11-60325-94410",
    createdAt: minutesAgo(2_600),
    store: "vintage",
    buyerName: "Elena Galli",
    buyerUsername: "elena.galli",
    shipTo: { name: "Galli Restauri S.n.c.", locality: "Bergamo (BG)", country: "IT" },
    items: [item("it-10a", "Cruscotto completo restaurato", 21_200, 1, "CRU-500")],
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
    phone: "+39 000 1000 010",
    email: "amministrazione@galli-restauri.invalid",
    fiscal: {
      state: "available",
      identifiers: [
        cf("GLLLNE82D45A794Q"),
        { type: "PIVA", value: "03456789012", quality: "valid" },
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
    email: "fra.colombo@esempio.invalid",
    fiscal: { state: "missing" },
  },
  {
    id: "ord-12",
    ebayOrderId: "25-30491-88120",
    createdAt: minutesAgo(4_800),
    store: "vintage",
    buyerName: "Roberto Ricci",
    buyerUsername: "rricci",
    shipTo: { name: "Roberto Ricci", locality: "Pisa (PI)", country: "IT" },
    items: [item("it-12a", "Sella biposto", 3_000, 1, "SEL-02")],
    totalMinor: 3_000,
    currency: "EUR",
    payment: "refunded",
    shipping: "delivered",
    billingAddress: {
      line: "Lungarno Pacinotti 3",
      postalCode: "56126",
      city: "Pisa",
      province: "PI",
      countryCode: "IT",
    },
    phone: "+39 000 1000 012",
    email: "rricci@esempio.invalid",
    fiscal: { state: "available", identifiers: [cf("RCCRRT77B10G702Z")] },
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
    shipping: "shipped",
    billingAddress: {
      line: "Leopoldstraße 20",
      postalCode: "80802",
      city: "München",
      province: null,
      countryCode: "DE",
    },
    phone: "+49 000 1000013",
    email: "h.mueller@beispiel.invalid",
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
    phone: "+39 000 1000 014",
    email: "ordini@tecnoufficio.invalid",
    fiscal: {
      state: "available",
      identifiers: [{ type: "PIVA", value: "09876543210", quality: "valid" }],
    },
  },
];

const incomingSeeds: OrderSeed[] = [
  {
    id: "ord-20",
    ebayOrderId: "40-10001-20002",
    createdAt: minutesAgo(3),
    store: "vintage",
    buyerName: "Giorgio Neri",
    buyerUsername: "gneri",
    shipTo: { name: "Giorgio Neri", locality: "Parma (PR)", country: "IT" },
    items: [item("it-20a", "Leva cambio cromata", 1_840, 1, "LEV-04")],
    totalMinor: 1_840,
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
    phone: "+39 000 1000 020",
    email: "gneri@esempio.invalid",
    fiscal: { state: "available", identifiers: [cf("NREGGR80A01G337A")] },
  },
  {
    id: "ord-21",
    ebayOrderId: "40-10001-20003",
    createdAt: minutesAgo(1),
    store: "vintage",
    buyerName: "Martina Greco",
    buyerUsername: "martina.greco",
    shipTo: { name: "Martina Greco", locality: "Lecce (LE)", country: "IT" },
    items: [item("it-21a", "Coprisella in similpelle", 2_500, 1, null)],
    totalMinor: 2_500,
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
    email: "martina.greco@esempio.invalid",
    fiscal: { state: "checking" },
  },
];

function storeView(key: StoreKey, overrides: Partial<StoreView> = {}): StoreView {
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

function toOrder(seed: OrderSeed, storeList: StoreView[]): OrderView {
  const { store, lockable: _lockable, ...order } = seed;
  const view = storeList.find((candidate) => candidate.id === stores[store].id);
  return {
    ...order,
    storeId: stores[store].id,
    storeName: stores[store].name,
    marketplace: stores[store].marketplace,
    lastSyncedAt: view?.lastSyncAt ?? minutesAgo(5),
  };
}

export interface Scenario {
  id: ScenarioId;
  now: string;
  account: AccountView;
  stores: StoreView[];
  orders: OrderView[];
  incoming: OrderView[];
  view: "list" | "no-store" | "loading" | "empty";
  notices: OrdersNotice[];
  syncRunning: boolean;
  ebayDown: boolean;
  elsewhere: boolean;
  notifications: NotificationView[];
  sessions: SessionView[];
  diagnostics: DiagnosticsView;
  telegramChat: string | null;
  saveFailsOnce: boolean;
  onboarding: Array<{
    label: "stepAccount" | "stepEmail" | "stepStore" | "stepSync";
    done: boolean;
  }>;
  /** Valori degli ordini bloccati: restano sul server fino allo sblocco. */
  lockedValues: Record<string, TaxIdentifierView[]>;
}

const account = (overrides: Partial<AccountView> = {}): AccountView => ({
  name: "Laura Martini",
  profile: {
    firstName: "Laura",
    lastName: "Martini",
    accountType: "business",
    companyName: "Martini ricambi",
  },
  email: "laura.martini@esempio.invalid",
  plan: "free",
  trialAvailable: true,
  quota: { used: 3, limit: 5, cycleEndsAt: "2026-10-02T12:20:00Z" },
  ...overrides,
});

const premiumAccount = (): AccountView =>
  account({
    plan: "premium",
    trialAvailable: false,
    quota: undefined,
    premium: { period: "annual", renewsAt: "2027-03-12T10:00:00Z" },
  });

const text = {
  maintenance: {
    it: {
      title: "Manutenzione programmata",
      body: "Il 2 ottobre dalle 6:00 alle 6:30 la sincronizzazione sarà sospesa. Gli ordini restano consultabili.",
    },
    en: {
      title: "Scheduled maintenance",
      body: "On 2 October from 6:00 to 6:30 syncing will be paused. Orders remain available.",
    },
  },
  newSignIn: {
    it: {
      title: "Nuovo accesso",
      body: "Accesso da Chrome su Windows, Milano. Se non eri tu, controlla le sessioni in Sicurezza.",
    },
    en: {
      title: "New sign-in",
      body: "Sign-in from Chrome on Windows, Milan. If it wasn’t you, check your sessions in Security.",
    },
  },
  quota: {
    it: {
      title: "Sblocchi esauriti",
      body: "Hai usato i 5 sblocchi di questo ciclo. Il prossimo inizia il 2 ottobre.",
    },
    en: {
      title: "No unlocks left",
      body: "You have used the 5 unlocks for this cycle. The next one starts on 2 October.",
    },
  },
  ebayDown: {
    it: {
      title: "eBay non risponde",
      body: "La sincronizzazione riprenderà appena eBay torna disponibile.",
    },
    en: {
      title: "eBay is not responding",
      body: "Syncing will resume as soon as eBay is available again.",
    },
  },
  expired: {
    it: {
      title: "Collegamento scaduto",
      body: `${stores.outlet.name}: la sincronizzazione è sospesa. Ricollega il negozio.`,
    },
    en: {
      title: "Connection expired",
      body: `${stores.outlet.name}: syncing is paused. Reconnect the store.`,
    },
  },
  permissions: {
    it: {
      title: "Autorizzazione incompleta",
      body: `${stores.retro.name}: eBay non ha concesso l’accesso agli ordini.`,
    },
    en: {
      title: "Incomplete authorisation",
      body: `${stores.retro.name}: eBay did not grant access to orders.`,
    },
  },
  renewal: {
    it: {
      title: "Premium rinnovato",
      body: "L’abbonamento annuale è attivo fino al 12 marzo 2027.",
    },
    en: {
      title: "Premium renewed",
      body: "The annual subscription is active until 12 March 2027.",
    },
  },
};

const sessions = (language: Language): SessionView[] => [
  {
    id: "ses-1",
    device: language === "it" ? "Safari su macOS" : "Safari on macOS",
    location: "Trento",
    lastActiveAt: previewNow,
    current: true,
  },
  {
    id: "ses-2",
    device: language === "it" ? "Safari su iPhone" : "Safari on iPhone",
    location: "Trento",
    lastActiveAt: minutesAgo(180),
    current: false,
  },
  {
    id: "ses-3",
    device: language === "it" ? "Chrome su Windows" : "Chrome on Windows",
    location: "Milano",
    lastActiveAt: minutesAgo(2_900),
    current: false,
  },
];

export function loadScenario(
  id: ScenarioId,
  language: Language,
  unlocked: ReadonlySet<string>,
): Scenario {
  const note = (
    key: keyof typeof text,
    extra: Omit<NotificationView, "title" | "body">,
  ): NotificationView => ({
    ...text[key][language],
    ...extra,
  });
  const common = {
    id,
    now: previewNow,
    incoming: [] as OrderView[],
    view: "list" as Scenario["view"],
    notices: [] as OrdersNotice[],
    syncRunning: false,
    ebayDown: false,
    elsewhere: false,
    sessions: sessions(language),
    telegramChat: null,
    saveFailsOnce: false,
    onboarding: [
      { label: "stepAccount" as const, done: true },
      { label: "stepEmail" as const, done: true },
      { label: "stepStore" as const, done: true },
      { label: "stepSync" as const, done: true },
    ],
    notifications: [
      note("maintenance", { id: "n-maint", tone: "info", at: minutesAgo(300), read: false }),
      note("newSignIn", {
        id: "n-signin",
        tone: "info",
        at: minutesAgo(2_900),
        read: true,
        href: "impostazioni/sicurezza",
      }),
    ],
  };
  const diagnostics = (overrides: Partial<DiagnosticsView> = {}): DiagnosticsView => ({
    version: language === "it" ? "2.0.0 (anteprima)" : "2.0.0 (preview)",
    storeRef: "neg_7f3a91c2",
    syncPhase:
      language === "it" ? "Aggiornamento riuscito, 5 minuti fa" : "Update succeeded, 5 minutes ago",
    errorCode: null,
    rights: "",
    correlationId: "c0a8f3e1-5b2d-4e7a-9c11-7d2f0b6e4a90",
    ...overrides,
  });

  const freeStores = [
    storeView("vintage"),
    storeView("outlet", {
      connection: "paused",
      pauseReason: "plan",
      lastSyncAt: minutesAgo(8_640),
    }),
  ];
  const freeSeeds = seeds.filter((seed) => seed.store === "vintage");
  const premiumStores = [
    storeView("vintage", { notifications: true, historyDays: 365, targetMinutes: 10 }),
    storeView("outlet", { notifications: false, historyDays: 365, targetMinutes: 10 }),
    storeView("retro", { notifications: true, historyDays: 365, targetMinutes: 10 }),
  ];

  let scenario: Omit<Scenario, "orders" | "lockedValues"> & {
    seeds: OrderSeed[];
    premium: boolean;
  };
  switch (id) {
    case "ordinario":
      scenario = {
        ...common,
        account: account(),
        stores: freeStores,
        seeds: freeSeeds,
        premium: false,
        diagnostics: diagnostics(),
      };
      break;
    case "quota-esaurita":
      scenario = {
        ...common,
        account: account({ quota: { used: 5, limit: 5, cycleEndsAt: "2026-10-02T12:20:00Z" } }),
        stores: freeStores,
        seeds: freeSeeds.map((seed) =>
          seed.id === "ord-02"
            ? {
                ...seed,
                fiscal: { state: "locked", shownAs: "CF" },
                lockable: [cf("RSSMRA80A41H501U")],
              }
            : seed,
        ),
        premium: false,
        notices: [{ kind: "quota", until: "2026-10-02T12:20:00Z" }],
        notifications: [
          note("quota", {
            id: "n-quota",
            tone: "warning",
            at: minutesAgo(90),
            read: false,
            href: "impostazioni/piano",
          }),
          ...common.notifications,
        ],
        diagnostics: diagnostics(),
      };
      break;
    case "aggiornamento":
      scenario = {
        ...common,
        account: account(),
        stores: [storeView("vintage", { syncing: true }), freeStores[1]!],
        seeds: freeSeeds,
        premium: false,
        syncRunning: true,
        incoming: incomingSeeds.map((seed) => toOrder(seed, freeStores)),
        diagnostics: diagnostics({
          syncPhase: language === "it" ? "Aggiornamento in corso" : "Update in progress",
        }),
      };
      break;
    case "ebay-non-disponibile":
      scenario = {
        ...common,
        account: account(),
        stores: [
          storeView("vintage", {
            lastSyncAt: minutesAgo(125),
            recent: [
              { at: minutesAgo(5), ok: false, newOrders: 0 },
              { at: minutesAgo(35), ok: false, newOrders: 0 },
              { at: minutesAgo(125), ok: true, newOrders: 1 },
            ],
          }),
          freeStores[1]!,
        ],
        seeds: freeSeeds,
        premium: false,
        ebayDown: true,
        notices: [{ kind: "ebay-down", at: minutesAgo(125) }],
        notifications: [
          note("ebayDown", { id: "n-ebay", tone: "warning", at: minutesAgo(60), read: false }),
          ...common.notifications,
        ],
        diagnostics: diagnostics({
          syncPhase:
            language === "it"
              ? "Aggiornamento non riuscito, 5 minuti fa"
              : "Update failed, 5 minutes ago",
          errorCode: "UPSTREAM_UNAVAILABLE",
        }),
      };
      break;
    case "negozio-scaduto": {
      const troubled = [
        premiumStores[0]!,
        storeView("outlet", {
          connection: "reconnect_required",
          issue: "reconnect",
          notifications: false,
          historyDays: 365,
          targetMinutes: 10,
          lastSyncAt: minutesAgo(1_500),
          recent: [
            { at: minutesAgo(1_440), ok: false, newOrders: 0 },
            { at: minutesAgo(1_500), ok: true, newOrders: 1 },
          ],
        }),
        storeView("retro", {
          connection: "error",
          issue: "permissions",
          notifications: true,
          historyDays: 365,
          targetMinutes: 10,
          lastSyncAt: null,
          importedOrders: 0,
          recent: [{ at: minutesAgo(20), ok: false, newOrders: 0 }],
        }),
        storeView("bottega", {
          connection: "error",
          issue: "unverifiable",
          notifications: false,
          historyDays: 365,
          targetMinutes: 10,
          lastSyncAt: minutesAgo(4_300),
          recent: [
            { at: minutesAgo(40), ok: false, newOrders: 0 },
            { at: minutesAgo(4_300), ok: true, newOrders: 0 },
          ],
        }),
      ];
      scenario = {
        ...common,
        account: premiumAccount(),
        stores: troubled,
        seeds: seeds.filter((seed) => seed.store !== "retro"),
        premium: true,
        telegramChat: "Magazzino Vintage",
        notices: [
          { kind: "store-issue", storeId: stores.outlet.id, storeName: stores.outlet.name },
        ],
        notifications: [
          note("expired", {
            id: "n-expired",
            tone: "warning",
            at: minutesAgo(1_440),
            read: false,
            href: `negozi/${stores.outlet.id}`,
          }),
          note("permissions", {
            id: "n-perm",
            tone: "danger",
            at: minutesAgo(20),
            read: false,
            href: `negozi/${stores.retro.id}`,
          }),
          ...common.notifications,
        ],
        diagnostics: diagnostics({
          storeRef: "neg_2b81d0fa",
          syncPhase:
            language === "it"
              ? "Collegamento scaduto, 1 giorno fa"
              : "Connection expired, 1 day ago",
          errorCode: "STORE_RECONNECT_REQUIRED",
        }),
      };
      break;
    }
    case "dati-discordanti":
      scenario = {
        ...common,
        account: premiumAccount(),
        stores: premiumStores,
        seeds: seeds.map((seed) => {
          if (seed.id === "ord-02")
            return {
              ...seed,
              fiscal: {
                state: "available",
                identifiers: [{ ...cf("RSSMRA80A41H501U"), updated: true }],
              },
            };
          if (seed.id === "ord-09")
            return {
              ...seed,
              fiscal: { state: "available", identifiers: [cf("MRNSRA90L41H50LV", "unverifiable")] },
            };
          if (seed.id === "ord-05") {
            return {
              ...seed,
              suggestion: {
                value: "DSNGNN70E20A662P",
                sourceOrder: "03-88120-44391",
                sourceDate: "2026-08-02T10:00:00Z",
                conflict: true,
              },
            };
          }
          return seed;
        }),
        premium: true,
        telegramChat: "Magazzino Vintage",
        diagnostics: diagnostics(),
      };
      break;
    case "primo-accesso":
      scenario = {
        ...common,
        account: account({ quota: undefined, trialAvailable: false }),
        stores: [],
        seeds: [],
        premium: false,
        view: "no-store",
        elsewhere: true,
        onboarding: [
          { label: "stepAccount", done: true },
          { label: "stepEmail", done: true },
          { label: "stepStore", done: false },
          { label: "stepSync", done: false },
        ],
        notifications: [],
        diagnostics: diagnostics({
          storeRef: null,
          syncPhase: language === "it" ? "Nessun negozio" : "No store",
        }),
      };
      break;
    case "importazione":
      scenario = {
        ...common,
        account: account({ quota: { used: 0, limit: 5, cycleEndsAt: "2026-10-04T12:55:00Z" } }),
        stores: [
          storeView("vintage", {
            syncing: true,
            importing: true,
            importedOrders: 4,
            lastSyncAt: minutesAgo(2),
            connectedAt: minutesAgo(6),
          }),
        ],
        seeds: freeSeeds.slice(0, 4),
        premium: false,
        syncRunning: false,
        notices: [{ kind: "importing", count: 4 }],
        diagnostics: diagnostics({
          syncPhase: language === "it" ? "Importazione dello storico" : "History import",
        }),
      };
      break;
    case "nessun-ordine":
      scenario = {
        ...common,
        account: account({ quota: { used: 0, limit: 5, cycleEndsAt: "2026-10-02T12:20:00Z" } }),
        stores: [storeView("vintage", { importedOrders: 0 })],
        seeds: [],
        premium: false,
        view: "empty",
        diagnostics: diagnostics(),
      };
      break;
    case "caricamento":
      scenario = {
        ...common,
        account: account(),
        stores: freeStores,
        seeds: [],
        premium: false,
        view: "loading",
        diagnostics: diagnostics(),
      };
      break;
    case "premium":
      scenario = {
        ...common,
        account: premiumAccount(),
        stores: premiumStores,
        seeds,
        premium: true,
        telegramChat: "Magazzino Vintage",
        saveFailsOnce: true,
        notifications: [
          note("renewal", {
            id: "n-renew",
            tone: "premium",
            at: minutesAgo(4_000),
            read: true,
            href: "impostazioni/piano",
          }),
          ...common.notifications,
        ],
        diagnostics: diagnostics(),
      };
      break;
    case "premium-a-vita":
      scenario = {
        ...common,
        account: account({
          plan: "premium",
          trialAvailable: false,
          quota: undefined,
          premium: { period: "lifetime", renewsAt: null },
        }),
        stores: [
          premiumStores[0]!,
          storeView("outlet", {
            connection: "paused",
            pauseReason: "manual",
            notifications: false,
            historyDays: 365,
            targetMinutes: 10,
            lastSyncAt: minutesAgo(2_880),
            recent: [{ at: minutesAgo(2_880), ok: true, newOrders: 0 }],
          }),
        ],
        seeds: seeds
          .filter((seed) => seed.store !== "retro")
          .map((seed) =>
            seed.id === "ord-02"
              ? {
                  ...seed,
                  fiscal: {
                    state: "available",
                    identifiers: [cf("RSSMRA80A41H501X", "checksum")],
                  },
                }
              : seed,
          ),
        premium: true,
        diagnostics: diagnostics(),
      };
      break;
  }

  const { seeds: scenarioSeeds, premium, ...rest } = scenario;
  const lockedValues: Record<string, TaxIdentifierView[]> = {};
  let unlockedCount = 0;
  const orders = scenarioSeeds.map((seed) => {
    // Con Premium non ci sono ordini da sbloccare: il valore è subito accessibile.
    if (premium && seed.fiscal.state === "locked") {
      return toOrder(
        { ...seed, fiscal: { state: "available", identifiers: seed.lockable ?? [] } },
        rest.stores,
      );
    }
    if (seed.fiscal.state === "locked" && seed.lockable) {
      if (unlocked.has(seed.id)) {
        unlockedCount++;
        return toOrder(
          { ...seed, fiscal: { state: "available", identifiers: seed.lockable } },
          rest.stores,
        );
      }
      lockedValues[seed.id] = seed.lockable;
    }
    return toOrder(seed, rest.stores);
  });
  const quota = rest.account.quota;
  const currentAccount = quota
    ? {
        ...rest.account,
        quota: { ...quota, used: Math.min(quota.used + unlockedCount, quota.limit) },
      }
    : rest.account;
  const rights = currentAccount.quota
    ? language === "it"
      ? `Free, ${currentAccount.quota.used} di ${currentAccount.quota.limit} ordini sbloccati`
      : `Free, ${currentAccount.quota.used} of ${currentAccount.quota.limit} orders unlocked`
    : currentAccount.plan === "free"
      ? "Free"
      : currentAccount.premium?.period === "lifetime"
        ? language === "it"
          ? "Premium a vita"
          : "Premium, lifetime"
        : language === "it"
          ? "Premium annuale"
          : "Premium, annual";
  return {
    ...rest,
    account: currentAccount,
    diagnostics: { ...rest.diagnostics, rights },
    orders,
    lockedValues,
  };
}
