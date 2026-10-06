import { z } from "zod";

import type { OrderObservation } from "../../domain/order-import.server";
import { parseMinor } from "../../money";
import { retryAfterSeconds } from "../http.server";

const text = z.string().optional();
const amount = z.looseObject({ value: z.string(), currency: z.string() });
const contactAddress = z
  .looseObject({
    addressLine1: text,
    addressLine2: text,
    city: text,
    postalCode: text,
    stateOrProvince: text,
    countryCode: text,
  })
  .optional();
const phone = z.looseObject({ phoneNumber: text }).optional();

/** Campi dell'ordine Fulfillment usati dal modello; gli altri, inclusi i dati fiscali, no. */
export const fulfillmentOrderDetailSchema = z.looseObject({
  orderId: z.string().min(1),
  creationDate: z.iso.datetime(),
  lastModifiedDate: z.iso.datetime(),
  orderPaymentStatus: text,
  orderFulfillmentStatus: text,
  cancelStatus: z.looseObject({ cancelState: text }).optional(),
  pricingSummary: z.looseObject({ total: amount }),
  buyer: z
    .looseObject({
      username: text,
      buyerRegistrationAddress: z
        .looseObject({ fullName: text, email: text, primaryPhone: phone, contactAddress })
        .optional(),
    })
    .optional(),
  fulfillmentStartInstructions: z
    .array(
      z.looseObject({
        shippingStep: z
          .looseObject({
            shipTo: z
              .looseObject({ fullName: text, primaryPhone: phone, contactAddress })
              .optional(),
          })
          .optional(),
      }),
    )
    .optional(),
  lineItems: z
    .array(
      z.looseObject({
        lineItemId: z.string().min(1),
        legacyItemId: text,
        title: z.string(),
        sku: text,
        quantity: z.number().int().positive(),
        lineItemCost: amount.optional(),
        listingMarketplaceId: text,
      }),
    )
    .default([]),
});

/** Lettura Fulfillment come osservazione del modello ordini, con importi esatti. */
export function fulfillmentObservation(payload: unknown): OrderObservation {
  const order = fulfillmentOrderDetailSchema.parse(payload);
  const registration = order.buyer?.buyerRegistrationAddress;
  const shipTo = order.fulfillmentStartInstructions?.[0]?.shippingStep?.shipTo;
  const marketplaces = new Set(order.lineItems.map((item) => item.listingMarketplaceId));
  const money = ({ value, currency }: z.infer<typeof amount>) => ({
    minor: parseMinor(value, currency),
    currency,
  });
  return {
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
    },
    items: order.lineItems.map((item) => ({
      lineItemId: item.lineItemId,
      // Stessa forma di `OrderLineItemID` Trading (articolo-transazione), da qualificare
      // sugli ordini combinati: senza coincidenza gli ordini restano distinti.
      stableKey: item.legacyItemId ? `${item.legacyItemId}-${item.lineItemId}` : null,
      title: item.title,
      sku: item.sku,
      quantity: item.quantity,
      total: item.lineItemCost ? money(item.lineItemCost) : null,
    })),
  };
}

const fulfillmentOrderSchema = z.looseObject({ orderId: z.string().min(1) });
const fulfillmentPageSchema = z.looseObject({
  orders: z.array(fulfillmentOrderSchema).default([]),
  total: z.number().int().nonnegative(),
  next: z.string().url().optional(),
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

export function classifyEbayRetry(
  status: number,
  retryAfter: string | null,
  attempt: number,
  now = Date.now(),
): { retryable: false } | { retryable: true; delaySeconds: number } {
  if (status !== 429 && status < 500) return { retryable: false };

  const delaySeconds = retryAfterSeconds(retryAfter, now) ?? 2 ** Math.max(0, attempt - 1);
  return { retryable: true, delaySeconds: Math.max(1, Math.min(300, Math.ceil(delaySeconds))) };
}
