import { env } from "cloudflare:workers";
import type Stripe from "stripe";

import { recordStripeEvent, verifyStripeEvent } from "../domain/stripe.server";

export async function action({ request }: { request: Request }) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Firma mancante", { status: 400 });

  let event: Stripe.Event;
  try {
    event = await verifyStripeEvent(await request.text(), signature, env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return new Response("Firma non valida", { status: 400 });
  }

  try {
    await recordStripeEvent(env.DB, event);
    return new Response(null, { status: 204 });
  } catch {
    return new Response("Evento non registrato", { status: 500 });
  }
}
