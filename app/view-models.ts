import { locales, type Language } from "./i18n";

/**
 * Dati che le schermate dell'app ricevono dal server. Un Codice Fiscale da
 * sbloccare non arriva mai al browser: la vista conosce soltanto quanti
 * identificativi attendono lo sblocco.
 */

/**
 * Semantica degli stati: il colore accompagna sempre icona e testo.
 * `neutral` indica un dato assente per natura, da non confondere con `danger`.
 */
export type StatusTone =
  | "success"
  | "info"
  | "warning"
  | "danger"
  | "premium"
  | "locked"
  | "neutral";

/** Esito di un'azione inviata al server; l'avviso, se presente, è già nella lingua dell'utente. */
export interface ActionResult {
  ok: boolean;
  notice?: string;
}

export type OrdersNotice =
  /** `at`: ultimo aggiornamento riuscito, null se gli ordini non sono mai stati letti. */
  | { kind: "ebay-down"; at: string | null }
  /** Letture di un solo negozio non riuscite: i suoi ordini sono fermi all'istante `at`. */
  | { kind: "store-read-failed"; storeId: string; storeName: string; at: string }
  | { kind: "quota"; until: string }
  | { kind: "store-issue"; storeId: string; storeName: string }
  | {
      kind: "consent-expiring";
      storeId: string;
      storeName: string;
      at: string;
      ebayEnvironment: EbayEnvironment;
    }
  | { kind: "importing"; count: number };

/** Ambiente eBay di un negozio, condiviso da server e interfaccia. */
export type EbayEnvironment = "production" | "sandbox";

export type Plan = "free" | "premium";

export type TaxIdentifierType = "CF" | "PIVA" | "OTHER";

/** Esito della verifica formale: un'indicazione, mai un blocco del dato. */
export type TaxQuality = "valid" | "format" | "checksum" | "name" | "unverifiable" | "unchecked";

export interface TaxIdentifierView {
  type: TaxIdentifierType;
  /** Nome del tipo estero come riportato da eBay, per `OTHER`. */
  typeLabel?: string;
  value: string;
  quality: TaxQuality;
  /** eBay ha modificato il valore dopo la prima lettura. */
  updated?: boolean;
}

/**
 * Condizione dell'ultima lettura quando resta mostrato un valore letto prima:
 * lettura non riuscita, in corso, senza il dato o con il dato nascosto da eBay.
 */
export type FiscalNotice = "lastKnown" | "checking" | "notReturned" | "masked";

export type FiscalView =
  | { state: "available"; identifiers: TaxIdentifierView[]; notice?: FiscalNotice }
  /**
   * Prima dello sblocco arriva solo il nome del dato: Codice Fiscale, oppure
   * Partita IVA quando l'ordine riporta soltanto quella.
   */
  | {
      state: "locked";
      shownAs: "CF" | "PIVA";
      /**
       * Sblocco sospeso mentre è in corso una nuova verifica eBay, oppure finché l'acquisto non
       * è pagato (D174).
       */
      hold?: "checking" | "unpaid";
    }
  /**
   * Senza motivo eBay non riporta il dato. Altrimenti lo nasconde o lo ha rimosso, oppure
   * l'acquirente ha la fatturazione in un altro Paese.
   */
  | { state: "missing"; reason?: "masked" | "removed" }
  | { state: "missing"; reason: "foreign"; country: string }
  | { state: "checking" }
  | { state: "error" };

export type FiscalState = FiscalView["state"];

/**
 * Situazione fiscale dei filtri: lo stato, con l'acquirente dalla fatturazione estera distinto
 * dal dato non riportato da eBay.
 */
export type FiscalSituation = FiscalState | "foreign";

export const fiscalSituations: FiscalSituation[] = [
  "available",
  "locked",
  "missing",
  "foreign",
  "checking",
  "error",
];

export function fiscalSituation(fiscal: FiscalView): FiscalSituation {
  return fiscal.state === "missing" && fiscal.reason === "foreign" ? "foreign" : fiscal.state;
}

/**
 * Vocabolario normalizzato unico per area reale, anteprima e filtri. Uno stato eBay non
 * previsto non ha una forma normalizzata: si mostra con il codice originale e resta fuori dai
 * filtri.
 */
export type PaymentStatus = "paid" | "unpaid" | "partially_refunded" | "refunded";

export const paymentStatuses: PaymentStatus[] = [
  "paid",
  "unpaid",
  "partially_refunded",
  "refunded",
];

/** Stato di evasione; `in_progress` indica una parte degli articoli spedita. */
export type ShippingStatus = "to_ship" | "in_progress" | "shipped" | "cancelled";

export const shippingStatuses: ShippingStatus[] = [
  "to_ship",
  "in_progress",
  "shipped",
  "cancelled",
];

/** Stato normalizzato, oppure codice originale eBay; entrambi null se la fonte non lo riporta. */
export type SourceStatus<Status extends string> =
  | { status: Status; code?: undefined }
  | { status: null; code: string | null };

export interface AddressView {
  line: string;
  postalCode: string;
  city: string;
  province: string | null;
  countryCode: string;
}

/** Contatti dell'acquirente nella forma mostrata; null dove la forma non è riconosciuta. */
export interface ContactsView {
  phone: { display: string; international: string } | null;
  email: { address: string; relay: boolean } | null;
  billingAddress: AddressView | null;
}

export interface OrderItemView {
  id: string;
  title: string;
  sku: string | null;
  quantity: number;
  /** Importo della riga come fornito da eBay; null se la fonte non lo riporta. */
  totalMinor: number | null;
  currency: string;
  /** Inserzione eBay dell'articolo, quando nota. */
  listingId?: string | null;
}

/**
 * Prezzo da mostrare per una riga: unitario quando l'importo diviso per la quantità è esatto
 * nell'esponente della valuta, altrimenti l'importo della riga. Mai centesimi arrotondati.
 */
export function itemPrice(item: OrderItemView): { minor: number; unit: boolean } | null {
  if (item.totalMinor === null) return null;
  return item.totalMinor % item.quantity === 0
    ? { minor: item.totalMinor / item.quantity, unit: true }
    : { minor: item.totalMinor, unit: false };
}

export interface SuggestionView {
  value: string;
  sourceOrder: string;
  sourceDate: string;
  /** Precedenti con codici diversi: si propone il più recente con un avviso. */
  conflict: boolean;
  identifier?: TaxIdentifierView;
  issuingCountry?: string | null;
  sourceStore?: string;
  source?: string;
}

export interface OrderView {
  id: string;
  ebayOrderId: string;
  createdAt: string;
  storeId: string;
  storeName: string;
  /** Marketplace dell'ordine, quando la fonte lo riporta. */
  marketplace: string | null;
  buyerName: string | null;
  buyerUsername: string | null;
  shipTo: { name: string | null; locality: string | null; country: string | null } | null;
  items: OrderItemView[];
  totalMinor: number;
  currency: string;
  payment: SourceStatus<PaymentStatus>;
  shipping: SourceStatus<ShippingStatus>;
  /** Indirizzo di fatturazione dell'acquirente; non è un dato fiscale da sbloccare. */
  billingAddress: AddressView | null;
  phone: string | null;
  email: string | null;
  /** Assenze dichiarate mascherate dalla fonte, senza deduzioni dal testo. */
  maskedContacts?: ("name" | "phone" | "email" | "billingAddress" | "recipient")[];
  /** Telefono, email e indirizzo nella forma mostrata; gli originali restano qui sopra. */
  contacts: ContactsView;
  fiscal: FiscalView;
  /** Suggerimenti Premium da ordini precedenti, uno per identificativo. */
  suggestions: SuggestionView[];
  /** Perché nessun suggerimento è proposto, quando il motivo è noto. */
  suggestionStatus?: "identity_missing" | "none" | "ambiguous";
  /** Articoli non collegati con certezza agli altri acquisti eBay dello stesso ordine. */
  reconciliationIssue?: boolean;
  thumbnail?: string;
  /** Ultima lettura dei dati fiscali da eBay; null se non ancora avvenuta. */
  lastSyncedAt: string | null;
  /** Ultima modifica dell'ordine su eBay, secondo la fonte. */
  updatedAt: string;
}

export type ConnectionState = "active" | "paused" | "reconnect_required" | "error" | "disconnected";

export interface StoreSyncView {
  at: string;
  ok: boolean;
  newOrders: number;
}

export interface StoreView {
  id: string;
  name: string;
  username: string;
  /** Logo e pagina del negozio eBay, se il venditore ne ha uno. */
  logoUrl?: string | null;
  storeUrl?: string | null;
  /** Feedback del venditore su eBay, quando letto. */
  feedback?: { score: number; positivePercent: number | null; topRated: boolean } | null;
  /** Marketplace prevalente, quando noto. */
  marketplace: string | null;
  /** Negozio dell'ambiente Sandbox di eBay, disponibile solo sul test. */
  sandbox?: boolean;
  connection: ConnectionState;
  /** Pausa manuale o per piano: la seconda non lascia consultare i dati. */
  pauseReason?: "manual" | "plan";
  issue?: "reconnect" | "permissions" | "unverifiable";
  syncing: boolean;
  lastSyncAt: string | null;
  notifications: boolean | null;
  importedOrders: number;
  /** Finestra dello storico; null prima del primo avvio dell'importazione. */
  historyDays: number | null;
  importing: boolean;
  /** Inizio e scadenza del consenso corrente; null per un negozio scollegato. */
  connectedAt: string | null;
  consentExpiresAt: string | null;
  /** Consenso valido che scade entro trenta giorni: il pannello invita a ricollegare. */
  consentExpiring?: boolean;
  /** Frequenza prevista della lettura periodica. */
  targetMinutes: number;
  recent: StoreSyncView[];
}

/** Identificativi letti al massimo in una sola richiesta della campanella. */
export const maxReadNotifications = 50;

export interface NotificationView {
  id: string;
  tone: StatusTone;
  title: string;
  body: string;
  at: string;
  read: boolean;
  /** Percorso relativo alla base dell'app, per aprire il contesto. */
  href?: string;
}

export interface AccountView {
  name: string;
  profile: {
    firstName: string;
    lastName: string;
    accountType: "private" | "business";
    companyName: string | null;
  };
  email: string;
  plan: Plan;
  /** La prova Premium si può attivare: mai usata, nessuna copertura in corso, negozio letto. */
  trialAvailable: boolean;
  /** Prova Premium in corso, senza un'altra copertura: finisce all'istante `endsAt`. */
  trial?: { endsAt: string };
  /**
   * Sblocchi del ciclo Free in corso; senza ciclo avviato nessuno sblocco è disponibile.
   * `nextLimit` compare quando il ciclo seguente avrà una quota diversa, per una promozione
   * che inizia o finisce.
   */
  quota?: { used: number; limit: number; cycleEndsAt: string | null; nextLimit?: number };
  /** `endsAt` compare dopo la disdetta: la copertura pagata finisce senza rinnovo. */
  premium?: {
    period: "monthly" | "annual" | "lifetime";
    renewsAt: string | null;
    endsAt?: string | null;
  };
  /**
   * Pagamento senza copertura in corso: in attesa della conferma di Stripe, abbonamento scelto
   * durante la prova con il primo addebito alla sua fine (`chargeAt`), oppure rinnovo non
   * riuscito con il prezzo protetto fino a `protectedUntil`.
   */
  payment?:
    | { state: "pending" }
    | { state: "scheduled"; period: "monthly" | "annual"; chargeAt: string }
    | { state: "renewal-failed"; protectedUntil: string };
}

export interface SessionView {
  id: string;
  device: string;
  location: string;
  lastActiveAt: string;
  current: boolean;
}

export interface DiagnosticsView {
  version: string;
  storeRef: string | null;
  syncPhase: string;
  errorCode: string | null;
  rights: string;
  correlationId: string;
}

const marketplaces: Record<string, string> = {
  EBAY_IT: "eBay.it",
  EBAY_DE: "eBay.de",
  EBAY_FR: "eBay.fr",
  EBAY_ES: "eBay.es",
  EBAY_GB: "eBay.co.uk",
};

export function marketplaceLabel(id: string) {
  return marketplaces[id] ?? id;
}

/**
 * Categorie delle Impostazioni in tre gruppi: il lavoro sugli ordini, l'account e le
 * preferenze generali con l'assistenza.
 */
export const settingsGroups = [
  { id: "ordini", sections: ["notifiche", "esportazione", "messaggio"] },
  { id: "account", sections: ["profilo", "piano", "sicurezza", "privacy"] },
  { id: "generale", sections: ["aspetto", "supporto"] },
] as const;

export type SettingsSection = (typeof settingsGroups)[number]["sections"][number];

export const settingsSections: readonly SettingsSection[] = settingsGroups.flatMap(
  (group) => group.sections,
);

/** Fuso di visualizzazione predefinito, finché l'utente non ne sceglie un altro. */
export const displayTimeZone = "Europe/Rome";

export function formatDate(
  value: string,
  language: Language,
  style: "date" | "dateTime" | "time" = "dateTime",
  timeZone: string = displayTimeZone,
): string {
  // Il pattern combinato varia fra versioni ICU (virgola oppure "at" in inglese).
  // Un separatore esplicito conserva lo stesso testo fra server e browser.
  if (style === "dateTime") {
    return `${formatDate(value, language, "date", timeZone)}, ${formatDate(value, language, "time", timeZone)}`;
  }
  const options: Intl.DateTimeFormatOptions =
    style === "date" ? { dateStyle: "medium" } : { timeStyle: "short" };
  // ICU recenti abbreviano settembre in «Sept», quelli precedenti in «Sep».
  return new Intl.DateTimeFormat(locales[language], { ...options, timeZone })
    .format(new Date(value))
    .replace("Sept", "Sep");
}

/** Nome del Paese nella lingua dell'interfaccia, dal codice ISO. */
export function countryName(code: string, language: Language): string {
  return /^[A-Z]{2}$/u.test(code)
    ? (new Intl.DisplayNames(locales[language], { type: "region" }).of(code) ?? code)
    : code;
}

/** Stesse righe per la lettura e la copia, senza separatori per campi assenti. */
export function addressRows(address: AddressView, language: Language): string[] {
  const province = address.province ? `(${address.province})` : "";
  return [
    address.line,
    [address.postalCode, address.city, province].filter(Boolean).join(" "),
    countryName(address.countryCode, language),
  ].filter(Boolean);
}

/** Tempo relativo rispetto a un istante fornito dal server, stabile fra server e browser. */
/** Negli ultimi tre giorni la fine della prova si mostra in evidenza. */
const trialEndingMilliseconds = 3 * 24 * 60 * 60 * 1000;

/** Giorni di prova rimasti, contando come intero anche quello in corso. */
export function trialDaysLeft(endsAt: string, now: string) {
  return Math.max(Math.ceil((Date.parse(endsAt) - Date.parse(now)) / 86_400_000), 0);
}

export function trialEnding(endsAt: string, now: string) {
  return Date.parse(endsAt) - Date.parse(now) <= trialEndingMilliseconds;
}

export function formatRelative(value: string, now: string, language: Language): string {
  const minutes = Math.round((new Date(value).getTime() - new Date(now).getTime()) / 60_000);
  const format = new Intl.RelativeTimeFormat(locales[language], { numeric: "auto" });
  if (Math.abs(minutes) < 60) return format.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return format.format(hours, "hour");
  // ICU usa U+0027 in Safari e U+2019 in Workerd per «l’altro ieri».
  return format.format(Math.round(hours / 24), "day").replaceAll("'", "’");
}
