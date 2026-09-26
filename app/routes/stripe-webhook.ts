import { env } from "cloudflare:workers";
import type Stripe from "stripe";
import { errorResponse, logFailure } from "../errors";

import {
  recordStripeEvent,
  verifyStripeEvent,
  type StripeSecrets,
} from "../integrations/stripe.server";

export async function action({ request }: { request: Request }) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return errorResponse(request, "INVALID_REQUEST");

  let event: Stripe.Event;
  try {
    event = await verifyStripeEvent(
      await request.text(),
      signature,
      (env as Env & StripeSecrets).STRIPE_WEBHOOK_SECRET,
    );
  } catch {
    return errorResponse(request, "INVALID_REQUEST");
  }

  try {
    await recordStripeEvent(env.DB, event);
    return new Response(null, { status: 204 });
  } catch {
    logFailure({ request, code: "INTERNAL_ERROR", operation: "stripe_webhook" });
    return errorResponse(request, "INTERNAL_ERROR");
  }
}
