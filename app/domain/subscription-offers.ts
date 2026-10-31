import type Stripe from "stripe";

/** Periodicità del prezzo di un elemento dell'abbonamento; null per un prezzo non ricorrente. */
function itemOffer(item: Stripe.SubscriptionItem): "monthly" | "annual" | null {
  const interval = item.price.recurring?.interval;
  return interval === "year" ? "annual" : interval === "month" ? "monthly" : null;
}

/**
 * Periodicità del periodo pagato e del prossimo rinnovo. Il prezzo dell'abbonamento è quello
 * del rinnovo; finché il periodo pagato non è concluso (`trialing`, per un acquisto durante la
 * prova o un cambio programmato) vale quella dei metadati, scritta all'acquisto e al cambio.
 */
export function subscriptionOffers(subscription: Stripe.Subscription, metadataOffer: string) {
  const item = subscription.items.data[0];
  const renewal = (item && itemOffer(item)) ?? (metadataOffer as "monthly" | "annual");
  return {
    offer: subscription.status === "trialing" ? (metadataOffer as "monthly" | "annual") : renewal,
    renewal,
  };
}
