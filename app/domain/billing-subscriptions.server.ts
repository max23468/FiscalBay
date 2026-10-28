import type Stripe from "stripe";

import { isMissingObject, stripeCall } from "../integrations/stripe.server";
import { isClosedSubscription } from "./grants.server";

/**
 * Chiude subito un abbonamento su Stripe, senza conguaglio né rimborso, e ne registra lo stato.
 * Uno già chiuso non si chiude una seconda volta; uno che Stripe non restituisce più non può
 * addebitare e resta indisponibile.
 */
export async function cancelSubscription(env: Env, stripe: Stripe, id: string, now: Date) {
  const at = now.toISOString();
  let status: string;
  try {
    const current = await stripeCall(() => stripe.subscriptions.retrieve(id));
    status = isClosedSubscription(current.status)
      ? current.status
      : (await stripeCall(() => stripe.subscriptions.cancel(id))).status;
  } catch (error) {
    if (!isMissingObject(error)) throw error;
    await env.DB.prepare(
      "UPDATE stripe_subscriptions SET unavailable_at = COALESCE(unavailable_at, ?1) WHERE id = ?2",
    )
      .bind(at, id)
      .run();
    return;
  }
  await env.DB.prepare(`UPDATE stripe_subscriptions SET status = ?1, synced_at = ?2
      WHERE id = ?3 AND julianday(synced_at) <= julianday(?2)`)
    .bind(status, at, id)
    .run();
}
