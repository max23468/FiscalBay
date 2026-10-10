import { z } from "zod";

import {
  orderObservationSchema,
  type MaskedBuyerField,
  type OrderObservation,
} from "../../domain/order-import.server";
import { parseMinor } from "../../money";
import { upstreamJson } from "../http.server";
import { ebayApiUrl, type EbayAccess } from "./environment.server";

type Amount = { value: string; currency: string };
type Contact = {
  fullName?: string;
  email?: string;
  primaryPhone?: { phoneNumber?: string };
  contactAddress?: Record<string, unknown> & { addressLine1?: string };
};

/** Campi dell'ordine Fulfillment letti dal modello; li valida lo schema dell'osservazione. */
type FulfillmentOrderDetail = {
  orderId: string;
  creationDate: string;
  lastModifiedDate: string;
  orderPaymentStatus?: string;
  orderFulfillmentStatus?: string;
  cancelStatus?: { cancelState?: string };
  pricingSummary: { total: Amount };
  buyer?: { username?: string; buyerRegistrationAddress?: Contact };
  fulfillmentStartInstructions?: Array<{ shippingStep?: { shipTo?: Contact } }>;
  lineItems?: Array<{
    lineItemId: string;
    legacyItemId?: string;
    title: string;
    sku?: string;
    quantity: number;
    lineItemCost?: Amount;
    listingMarketplaceId?: string;
  }>;
};

const money = ({ value, currency }: Amount) => ({ minor: parseMinor(value, currency), currency });

const day = 86_400_000;
// eBay smette di restituire email dopo 14 giorni e nome, telefono e prima riga dell'indirizzo
// dopo 90: oltre quelle età un campo assente è mascherato, non rimosso.
const emailDays = 14;
const contactDays = 90;

/**
 * Campi dell'acquirente assenti per il mascheramento eBay alla data della lettura. Un campo
 * presente resta un dato fornito, anche oltre il limite.
 */
function maskedFields(
  order: FulfillmentOrderDetail,
  registration: Contact | undefined,
  shipTo: Contact | undefined,
  observedAt: string,
): MaskedBuyerField[] {
  const age = (Date.parse(observedAt) - Date.parse(order.creationDate)) / day;
  // Un campo annidato conta solo se eBay ha fornito il contenitore che lo racchiude.
  const fields: Array<[MaskedBuyerField, unknown, number, unknown]> = [
    ["email", registration?.email, emailDays, true],
    ["name", registration?.fullName, contactDays, true],
    ["phone", registration?.primaryPhone?.phoneNumber, contactDays, true],
    [
      "billingAddress.addressLine1",
      registration?.contactAddress?.addressLine1,
      contactDays,
      registration?.contactAddress,
    ],
    ["shipTo.name", shipTo?.fullName, contactDays, shipTo],
    ["shipTo.phone", shipTo?.primaryPhone?.phoneNumber, contactDays, shipTo],
    [
      "shipTo.address.addressLine1",
      shipTo?.contactAddress?.addressLine1,
      contactDays,
      shipTo?.contactAddress,
    ],
  ];
  return fields.flatMap(([field, value, days, container]) =>
    age > days && !value && container ? [field] : [],
  );
}

/**
 * Lettura Fulfillment come osservazione validata del modello ordini, con importi esatti. I campi
 * non previsti, inclusi i dati fiscali, non entrano nell'osservazione. `observedAt` distingue
 * i campi mascherati per l'età dell'ordine da quelli assenti.
 */
export function fulfillmentObservation(payload: unknown, observedAt: string): OrderObservation {
  const order = payload as FulfillmentOrderDetail;
  const lineItems = order.lineItems ?? [];
  const registration = order.buyer?.buyerRegistrationAddress;
  const shipTo = order.fulfillmentStartInstructions?.[0]?.shippingStep?.shipTo;
  const marketplaces = new Set(lineItems.map((item) => item.listingMarketplaceId));
  return orderObservationSchema.parse({
    source: "fulfillment",
    externalOrderId: order.orderId,
    provisional: false,
    creationTime: order.creationDate,
    lastModifiedTime: order.lastModifiedDate,
    marketplaceId: marketplaces.size === 1 ? [...marketplaces][0] : null,
    total: money(order.pricingSummary.total),
    paymentStatus: order.orderPaymentStatus,
    fulfillmentStatus: order.orderFulfillmentStatus,
    cancelStatus: order.cancelStatus?.cancelState,
    buyer: {
      username: order.buyer?.username,
      name: registration?.fullName,
      email: registration?.email,
      phone: registration?.primaryPhone?.phoneNumber,
      billingAddress: registration?.contactAddress,
      shipTo: shipTo && {
        name: shipTo.fullName,
        phone: shipTo.primaryPhone?.phoneNumber,
        address: shipTo.contactAddress,
      },
      masked: maskedFields(order, registration, shipTo, observedAt),
    },
    items: lineItems.map((item) => ({
      lineItemId: item.lineItemId,
      legacyItemId: item.legacyItemId,
      // Stessa forma di `OrderLineItemID` Trading (articolo-transazione), da qualificare
      // sugli ordini combinati: senza coincidenza gli ordini restano distinti.
      stableKey: item.legacyItemId ? `${item.legacyItemId}-${item.lineItemId}` : null,
      title: item.title,
      sku: item.sku,
      quantity: item.quantity,
      total: item.lineItemCost ? money(item.lineItemCost) : null,
    })),
  });
}

const fulfillmentOrderSchema = z.looseObject({ orderId: z.string().min(1) });

/** Seconda osservazione, mai prova di assenza autorevole né sostituto di Trading. */
export function fulfillmentTaxIdentifiers(payload: unknown) {
  const order = z
    .object({
      buyer: z
        .object({
          taxIdentifier: z
            .object({
              taxpayerId: z.string().trim().min(1),
              taxIdentifierType: z.string().trim().min(1),
              issuingCountry: z
                .string()
                .regex(/^[A-Z]{2}$/u)
                .nullish(),
            })
            .nullish(),
        })
        .nullish(),
    })
    .parse(payload);
  const tax = order.buyer?.taxIdentifier;
  return tax
    ? [
        {
          value: tax.taxpayerId,
          type: tax.taxIdentifierType,
          issuingCountry: tax.issuingCountry ?? null,
          source: "ebay_fulfillment" as const,
        },
      ]
    : [];
}
const fulfillmentPageSchema = z.looseObject({
  orders: z.array(fulfillmentOrderSchema).default([]),
  total: z.number().int().nonnegative(),
  // Validato prima di seguirlo: può essere relativo o puntare altrove.
  next: z.string().optional(),
});

export type FulfillmentOrder = z.infer<typeof fulfillmentOrderSchema>;
export type FulfillmentPage = z.infer<typeof fulfillmentPageSchema>;

export function parseFulfillmentPage(payload: unknown): FulfillmentPage {
  return fulfillmentPageSchema.parse(payload);
}

export function mergeFulfillmentOrders(pages: ReadonlyArray<FulfillmentPage>): FulfillmentOrder[] {
  const orders = new Map<string, FulfillmentOrder>();
  for (const page of pages) {
    for (const order of page.orders) orders.set(order.orderId, order);
  }
  return [...orders.values()];
}

export function buildLastModifiedFilter(
  checkpoint: Date,
  end: Date,
  overlapMilliseconds: number,
): string {
  if (
    !Number.isFinite(checkpoint.getTime()) ||
    !Number.isFinite(end.getTime()) ||
    !Number.isFinite(overlapMilliseconds) ||
    overlapMilliseconds < 0 ||
    checkpoint > end
  ) {
    throw new RangeError("Intervallo incrementale eBay non valido");
  }
  const start = new Date(checkpoint.getTime() - overlapMilliseconds);
  return `lastmodifieddate:[${start.toISOString()}..${end.toISOString()}]`;
}

/** Ordini creati nell'intervallo, estremi inclusi: date UTC già normalizzate. */
export function buildCreationDateFilter(from: string, until: string): string {
  return `creationdate:[${from}..${until}]`;
}

const ordersPath = "/sell/fulfillment/v1/order";

/**
 * Una pagina di `getOrders`: la prima con limite e filtro, le successive dal link `next` di eBay,
 * seguito solo sulla stessa origine API dell'ambiente.
 */
export async function readFulfillmentOrders(
  access: EbayAccess,
  page: { limit: number; filter: string } | { next: string },
): Promise<FulfillmentPage> {
  let url: URL;
  if ("next" in page) {
    url = ebayApiUrl(access.configuration, page.next, ordersPath);
  } else {
    url = ebayApiUrl(access.configuration, access.configuration.ordersUrl, ordersPath);
    url.searchParams.set("limit", String(page.limit));
    url.searchParams.set("filter", page.filter);
  }
  return upstreamJson(access.fetcher, url.href, fulfillmentPageSchema, {
    headers: { authorization: `Bearer ${access.accessToken}` },
  });
}

/** Un solo ordine con `getOrder`, per la lettura del dettaglio. */
export async function readFulfillmentOrder(
  access: EbayAccess,
  orderId: string,
  tax?: { marketplaceId?: string },
): Promise<unknown> {
  const url = ebayApiUrl(
    access.configuration,
    `${access.configuration.ordersUrl}/${encodeURIComponent(orderId)}`,
    ordersPath,
  );
  const headers: Record<string, string> = { authorization: `Bearer ${access.accessToken}` };
  if (tax) {
    url.searchParams.set("fieldGroups", "TAX_BREAKDOWN");
    if (tax.marketplaceId !== undefined) {
      headers["X-EBAY-C-MARKETPLACE-ID"] = z
        .string()
        .regex(/^EBAY_[A-Z_]{2,20}$/u)
        .parse(tax.marketplaceId);
    }
  }
  return upstreamJson(access.fetcher, url.href, fulfillmentOrderSchema, {
    headers,
  });
}
