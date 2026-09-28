import type { Language } from "./i18n";

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
  | { kind: "ebay-down"; at: string }
  | { kind: "quota"; until: string }
  | { kind: "store-issue"; storeId: string; storeName: string }
  | { kind: "importing"; count: number };

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

export type FiscalView =
  | { state: "available"; identifiers: TaxIdentifierView[] }
  /**
   * Prima dello sblocco arriva solo il nome del dato: Codice Fiscale, oppure
   * Partita IVA quando l'ordine riporta soltanto quella.
   */
  | { state: "locked"; shownAs: "CF" | "PIVA" }
  | { state: "missing" }
  | { state: "checking" }
  | { state: "error" };

export type FiscalState = FiscalView["state"];

export const fiscalStates: FiscalState[] = ["available", "locked", "missing", "checking", "error"];

export type PaymentStatus = "paid" | "unpaid" | "refunded";

export const paymentStatuses: PaymentStatus[] = ["paid", "unpaid", "refunded"];

/** Stato di evasione; un ordine annullato non viene spedito. */
export type ShippingStatus = "to_ship" | "shipped" | "delivered" | "cancelled";

export const shippingStatuses: ShippingStatus[] = ["to_ship", "shipped", "delivered", "cancelled"];

export interface AddressView {
  line: string;
  postalCode: string;
  city: string;
  province: string | null;
  countryCode: string;
}

export interface OrderItemView {
  id: string;
  title: string;
  sku: string | null;
  quantity: number;
  priceMinor: number;
}

export interface SuggestionView {
  value: string;
  sourceOrder: string;
  sourceDate: string;
  /** Precedenti con codici diversi: si propone il più recente con un avviso. */
  conflict: boolean;
}

export interface OrderView {
  id: string;
  ebayOrderId: string;
  createdAt: string;
  storeId: string;
  storeName: string;
  marketplace: string;
  buyerName: string;
  buyerUsername: string;
  shipTo: { name: string; locality: string; country: string };
  items: OrderItemView[];
  totalMinor: number;
  currency: string;
  payment: PaymentStatus;
  shipping: ShippingStatus;
  /** Indirizzo di fatturazione dell'acquirente; non è un dato fiscale da sbloccare. */
  billingAddress: AddressView | null;
  phone: string | null;
  email: string | null;
  fiscal: FiscalView;
  suggestion?: SuggestionView;
  thumbnail?: string;
  lastSyncedAt: string;
}

export type ConnectionState = "active" | "paused" | "reconnect_required" | "error";

export interface StoreSyncView {
  at: string;
  ok: boolean;
  newOrders: number;
}

export interface StoreView {
  id: string;
  name: string;
  username: string;
  marketplace: string;
  connection: ConnectionState;
  /** Pausa manuale o per piano: la seconda non lascia consultare i dati. */
  pauseReason?: "manual" | "plan";
  issue?: "reconnect" | "permissions" | "unverifiable";
  syncing: boolean;
  lastSyncAt: string | null;
  notifications: boolean | null;
  importedOrders: number;
  historyDays: number;
  importing: boolean;
  connectedAt: string;
  consentExpiresAt: string;
  targetMinutes: number;
  recent: StoreSyncView[];
}

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
  email: string;
  plan: Plan;
  trialAvailable: boolean;
  /** Sblocchi del ciclo Free in corso. */
  quota?: { used: number; limit: number; cycleEndsAt: string };
  premium?: { period: "monthly" | "annual" | "lifetime"; renewsAt: string | null };
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

export const settingsSections = [
  "piano",
  "notifiche",
  "esportazione",
  "sicurezza",
  "aspetto",
  "messaggio",
  "privacy",
  "supporto",
] as const;

export type SettingsSection = (typeof settingsSections)[number];

/** Fuso di visualizzazione finché la scelta delle Impostazioni non viene salvata sul server. */
export const displayTimeZone = "Europe/Rome";

export function formatDate(
  value: string,
  language: Language,
  style: "date" | "dateTime" | "time" = "dateTime",
): string {
  const options: Intl.DateTimeFormatOptions =
    style === "date"
      ? { dateStyle: "medium" }
      : style === "time"
        ? { timeStyle: "short" }
        : { dateStyle: "medium", timeStyle: "short" };
  return new Intl.DateTimeFormat(language, { ...options, timeZone: displayTimeZone }).format(
    new Date(value),
  );
}

/** Nome del Paese nella lingua dell'interfaccia, dal codice ISO. */
export function countryName(code: string, language: Language): string {
  return new Intl.DisplayNames(language, { type: "region" }).of(code) ?? code;
}

/** Tempo relativo rispetto a un istante fornito dal server, stabile fra server e browser. */
export function formatRelative(value: string, now: string, language: Language): string {
  const minutes = Math.round((new Date(value).getTime() - new Date(now).getTime()) / 60_000);
  const format = new Intl.RelativeTimeFormat(language, { numeric: "auto" });
  if (Math.abs(minutes) < 60) return format.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return format.format(hours, "hour");
  return format.format(Math.round(hours / 24), "day");
}
