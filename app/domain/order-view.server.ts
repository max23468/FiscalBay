import type { BuyerSnapshot } from "./order-observation.server";
import type { VisibleOrder } from "./orders.server";
import { contactsView } from "../contact";
import { taxIdentifierType } from "../tax-quality";
import type {
  FiscalNotice,
  FiscalView,
  OrderView,
  PaymentStatus,
  ShippingStatus,
  SourceStatus,
} from "../view-models";

/**
 * Avvertenza su un dato disponibile, uguale nella pagina Ordini e nel file: l'ultima lettura non
 * riuscita, in corso o che non riporta più il valore letto in precedenza.
 */
export function fiscalNotice(order: VisibleOrder): FiscalNotice | null {
  return order.taxVerification === "error"
    ? "lastKnown"
    : order.taxVerification === "checking"
      ? "checking"
      : order.taxAvailability === "masked"
        ? "masked"
        : order.taxAvailability === "absent" || order.taxAvailability === "not_included"
          ? "notReturned"
          : null;
}

/** Dato fiscale nella forma della pagina Ordini: valori presenti soltanto se autorizzati. */
function fiscalView(order: VisibleOrder): FiscalView {
  if (order.fiscalState === "available") {
    const notice = fiscalNotice(order);
    return {
      state: "available",
      identifiers: order.taxIdentifiers.map((identifier) => {
        const type = taxIdentifierType(identifier.type, identifier.issuingCountry);
        return {
          type,
          ...(type === "OTHER" ? { typeLabel: identifier.type } : {}),
          value: identifier.value,
          quality: identifier.quality,
          updated: identifier.updated,
        };
      }),
      ...(notice ? { notice } : {}),
    };
  }
  if (order.fiscalState === "locked") {
    // Lo sblocco resta sospeso finché l'acquisto non è pagato (D174) o durante una nuova verifica.
    const hold = order.provisional
      ? ("unpaid" as const)
      : order.taxVerification === "checking"
        ? ("checking" as const)
        : null;
    return { state: "locked", shownAs: order.lockedShownAs, ...(hold ? { hold } : {}) };
  }
  // La situazione estera nasce soltanto da un paese di fatturazione presente e diverso dall'Italia.
  if (order.fiscalState === "foreign")
    return {
      state: "missing",
      reason: "foreign",
      country: order.summary.buyer!.billingAddress!.countryCode!,
    };
  if (order.fiscalState === "missing") {
    const reason = order.taxAvailability;
    return reason === "masked" || reason === "removed"
      ? { state: "missing", reason }
      : { state: "missing" };
  }
  return { state: order.fiscalState };
}

function sourceStatus<Status extends string>(
  status: Status | "unknown" | null,
  code: string | null,
): SourceStatus<Status> {
  return status === null || status === "unknown"
    ? // Senza stato normalizzato manca anche il codice originale.
      { status: null, code }
    : { status };
}

/** Luogo di consegna sintetico: città, provincia tra parentesi. */
function locality(address: NonNullable<BuyerSnapshot["shipTo"]>["address"]) {
  if (!address?.city) return null;
  return address.stateOrProvince ? `${address.city} (${address.stateOrProvince})` : address.city;
}

/** ID dell'inserzione eBay in testa all'identità stabile della riga (`<inserzione>-<riga>`). */
function listingId(stableKey: string | null): string | null {
  return stableKey?.match(/^(\d{6,19})-/u)?.[1] ?? null;
}

/**
 * Ordine persistito nella vista condivisa con l'anteprima. Prima riga d'indirizzo e località
 * compongono l'indirizzo di fatturazione; un dato non fornito da eBay resta null.
 */
export function orderView(order: VisibleOrder): OrderView {
  const buyer = order.summary.buyer;
  const billing = buyer?.billingAddress;
  const shipTo = buyer?.shipTo;
  const line = [billing?.addressLine1, billing?.addressLine2].filter(Boolean).join(", ");
  // La miniatura è la prima immagine d'inserzione disponibile fra gli articoli.
  const thumbnail = order.summary.lineItems.find((item) => item.imageUrl)?.imageUrl;
  const view: Omit<OrderView, "contacts"> = {
    id: order.id,
    ebayOrderId: order.ebayOrderId,
    createdAt: order.creationTime,
    storeId: order.storeId,
    storeName: order.storeName,
    marketplace: order.marketplaceId,
    buyerName: buyer?.name ?? null,
    buyerUsername: buyer?.username ?? null,
    shipTo: shipTo
      ? {
          name: shipTo.name,
          locality: locality(shipTo.address),
          country: shipTo.address?.countryCode ?? null,
        }
      : null,
    items: order.summary.lineItems.map((item) => ({
      id: item.lineItemId,
      title: item.title,
      sku: item.sku,
      quantity: item.quantity,
      // Un importo in un'altra valuta non si mostra come se fosse nella valuta dell'ordine.
      totalMinor: item.currency === order.currency ? item.totalMinor : null,
      currency: order.currency,
      listingId: listingId(item.stableKey),
    })),
    totalMinor: order.totalMinor,
    currency: order.currency,
    payment: sourceStatus<PaymentStatus>(order.summary.payment, order.summary.orderPaymentStatus),
    shipping: sourceStatus<ShippingStatus>(
      order.summary.shipping,
      order.summary.orderFulfillmentStatus,
    ),
    billingAddress:
      billing &&
      [line, billing.city, billing.postalCode, billing.stateOrProvince, billing.countryCode].some(
        (value) => value?.trim(),
      )
        ? {
            line,
            postalCode: billing.postalCode ?? "",
            city: billing.city ?? "",
            province: billing.stateOrProvince,
            countryCode: billing.countryCode ?? "",
          }
        : null,
    phone: buyer?.phone ?? shipTo?.phone ?? null,
    email: buyer?.email ?? null,
    ...(buyer?.masked?.length
      ? {
          maskedContacts: [
            ...(!buyer.name && buyer.masked.includes("name") ? ["name" as const] : []),
            ...(!buyer.email && buyer.masked.includes("email") ? ["email" as const] : []),
            ...(!buyer.phone &&
            !shipTo?.phone &&
            (buyer.masked.includes("phone") || buyer.masked.includes("shipTo.phone"))
              ? ["phone" as const]
              : []),
            ...(!billing?.addressLine1 && buyer.masked.includes("billingAddress.addressLine1")
              ? ["billingAddress" as const]
              : []),
            ...(!shipTo?.name && buyer.masked.includes("shipTo.name")
              ? ["recipient" as const]
              : []),
          ],
        }
      : {}),
    fiscal: fiscalView(order),
    suggestions: order.suggestions ?? [],
    ...(order.suggestionStatus ? { suggestionStatus: order.suggestionStatus } : {}),
    ...(order.reconciliationIssue ? { reconciliationIssue: true } : {}),
    ...(thumbnail ? { thumbnail } : {}),
    lastSyncedAt: order.taxCheckedAt,
    updatedAt: order.lastModifiedTime,
  };
  return { ...view, contacts: contactsView(view) };
}
