import { z } from "zod";

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

  const seconds = retryAfter?.trim() ? Number(retryAfter) : Number.NaN;
  const dateDelay = retryAfter ? (Date.parse(retryAfter) - now) / 1000 : Number.NaN;
  const delaySeconds = Number.isFinite(seconds)
    ? seconds
    : Number.isFinite(dateDelay)
      ? dateDelay
      : 2 ** Math.max(0, attempt - 1);
  return { retryable: true, delaySeconds: Math.max(1, Math.min(300, Math.ceil(delaySeconds))) };
}
