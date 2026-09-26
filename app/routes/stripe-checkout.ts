import { env } from "cloudflare:workers";
import { z } from "zod";

import { createAuth } from "../auth.server";
import { errorResponse } from "../errors";
import {
  createManagedCheckout,
  createStripeClient,
  type PremiumOffer,
  type StripeSecrets,
} from "../integrations/stripe.server";

const checkoutSchema = z.object({
  offer: z.enum(["monthly", "annual", "lifetime"]),
});

const priceByOffer: Record<
  PremiumOffer,
  "STRIPE_PRICE_MONTHLY" | "STRIPE_PRICE_ANNUAL" | "STRIPE_PRICE_LIFETIME"
> = {
  monthly: "STRIPE_PRICE_MONTHLY",
  annual: "STRIPE_PRICE_ANNUAL",
  lifetime: "STRIPE_PRICE_LIFETIME",
};

export async function action({ request }: { request: Request }) {
  if (request.headers.get("origin") !== new URL(env.APP_ORIGIN).origin) {
    return errorResponse(request, "FORBIDDEN");
  }

  const session = await createAuth(env).api.getSession({ headers: request.headers });
  if (!session) return errorResponse(request, "AUTH_REQUIRED");

  const parsed = checkoutSchema.safeParse(Object.fromEntries(await request.formData()));
  if (!parsed.success) return errorResponse(request, "INVALID_REQUEST");

  const membership = await env.DB.prepare(
    "SELECT workspace_id FROM workspace_members WHERE user_id = ? ORDER BY workspace_id LIMIT 1",
  )
    .bind(session.user.id)
    .first<{ workspace_id: string }>();
  if (!membership) return errorResponse(request, "FORBIDDEN");

  const checkout = await createManagedCheckout(
    createStripeClient((env as Env & StripeSecrets).STRIPE_SECRET_KEY),
    {
      offer: parsed.data.offer,
      priceId: env[priceByOffer[parsed.data.offer]],
      workspaceId: membership.workspace_id,
      email: session.user.email,
      appOrigin: new URL(env.APP_ORIGIN).origin,
    },
  );
  if (!checkout.url) return errorResponse(request, "CHECKOUT_PENDING");

  return new Response(null, { status: 303, headers: { Location: checkout.url } });
}
