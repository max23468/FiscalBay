import type { AppCopy } from "../../app-copy";
import { buyerNameView } from "../../contact";
import type { OrderView, PaymentStatus, ShippingStatus, SourceStatus } from "../../view-models";

export type PillTone = "success" | "warning" | "info" | "neutral";

const paymentTone: Record<PaymentStatus, PillTone> = {
  paid: "success",
  unpaid: "warning",
  partially_refunded: "neutral",
  refunded: "neutral",
};

const shippingTone: Record<ShippingStatus, PillTone> = {
  to_ship: "warning",
  in_progress: "info",
  shipped: "success",
  cancelled: "neutral",
};

/**
 * Etichetta e tono di uno stato dell'ordine: uno stato eBay non previsto compare con il codice
 * originale in tono neutro, uno stato non fornito come tale.
 */
function sourceLabel<Status extends string>(
  value: SourceStatus<Status>,
  labels: Record<Status, string>,
  tones: Record<Status, PillTone>,
  t: AppCopy,
) {
  if (value.status !== null) return { label: labels[value.status], tone: tones[value.status] };
  return { label: value.code ?? t.orders.notProvided, tone: "neutral" as const };
}

export function paymentLabel(order: OrderView, t: AppCopy) {
  return sourceLabel(order.payment, t.orders.payment, paymentTone, t);
}

export function shippingLabel(order: OrderView, t: AppCopy) {
  return sourceLabel(order.shipping, t.orders.shipping, shippingTone, t);
}

/** Nome dell'acquirente; senza nome, lo username eBay. */
export function buyerLabel(order: OrderView, t: AppCopy) {
  return (
    buyerNameView(order.buyerName) ??
    order.buyerUsername ??
    (order.maskedContacts?.includes("name") ? t.orders.maskedContact : t.orders.notProvided)
  );
}
