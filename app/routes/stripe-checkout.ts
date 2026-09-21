import { env } from "cloudflare:workers";
import { z } from "zod";

import { createAuth } from "../auth.server";
import {
  createManagedCheckout,
  createStripeClient,
  type PremiumOffer,
} from "../domain/stripe.server";

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
    return new Response("Origine non valida", { status: 403 });
  }

  const session = await createAuth(env).api.getSession({ headers: request.headers });
  if (!session) return new Response("Accesso richiesto", { status: 401 });

  const parsed = checkoutSchema.safeParse(Object.fromEntries(await request.formData()));
  if (!parsed.success) return new Response("Offerta non valida", { status: 400 });

  const membership = await env.DB.prepare(
    "SELECT workspace_id FROM workspace_members WHERE user_id = ? ORDER BY workspace_id LIMIT 1",
  )
    .bind(session.user.id)
    .first<{ workspace_id: string }>();
  if (!membership) return new Response("Account senza area di lavoro", { status: 403 });

  const checkout = await createManagedCheckout(createStripeClient(env.STRIPE_SECRET_KEY), {
    offer: parsed.data.offer,
    priceId: env[priceByOffer[parsed.data.offer]],
    workspaceId: membership.workspace_id,
    email: session.user.email,
    appOrigin: new URL(env.APP_ORIGIN).origin,
  });
  if (!checkout.url) return new Response("Checkout non disponibile", { status: 502 });

  return new Response(null, { status: 303, headers: { Location: checkout.url } });
}
