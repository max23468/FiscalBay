import { z } from "zod";

import { isProduction } from "../app-links";
import { logFailure } from "../errors";
import { createStripeClient, stripeRead } from "../integrations/stripe.server";
import { reconcileSubscription } from "./billing.server";
import { grantLifetime, type LifetimeGrant } from "./lifetime.server";

/**
 * Concessioni della console amministrativa (§6.3): Premium temporaneo, estensione gratuita di
 * un abbonamento e lifetime in omaggio. Ogni concessione registra autore e motivo, non figura
 * come incasso e non tocca quota, prova o ciclo.
 */

const concession = z.object({
  workspaceId: z.string().min(1).max(128),
  author: z.string().trim().min(1).max(128),
  reason: z.string().trim().min(1).max(500),
});

/** Giorni concessi in una volta: oltre l'anno serve una valutazione separata. */
const maxGrantDays = 366;

const day = 86_400_000;

export type PremiumGrant =
  | { result: "done"; startsAt: string; endsAt: string }
  | { result: "invalid" | "not_found" | "lifetime" | "unavailable" };

/**
 * Premium concesso per un numero di giorni. Parte dalla fine dell'ultima copertura in corso,
 * pagata, di prova o concessa, così non consuma il periodo già pagato; con un abbonamento che
 * si rinnova ne rinvia il rinnovo, o il primo addebito scelto durante la prova, alla fine della
 * concessione, senza conguaglio. Un rinnovo già disdetto non si riattiva: la concessione
 * prolunga soltanto il diritto. Stripe si aggiorna prima della copertura: ripetuta dopo un
 * errore, la concessione calcola gli stessi istanti.
 */
export async function grantPremium(
  env: Env,
  input: { workspaceId: string; author: string; reason: string; days: number },
  now = new Date(),
): Promise<PremiumGrant> {
  const parsed = concession.safeParse(input);
  if (
    !parsed.success ||
    !Number.isInteger(input.days) ||
    input.days < 1 ||
    input.days > maxGrantDays
  )
    return { result: "invalid" };
  const at = now.toISOString();
  const workspace = await env.DB.prepare(`SELECT
      EXISTS (SELECT 1 FROM workspace_entitlements e WHERE e.workspace_id = w.id
        AND e.source = 'lifetime' AND e.revoked_at IS NULL) AS lifetime,
      (SELECT MAX(e.ends_at) FROM workspace_entitlements e WHERE e.workspace_id = w.id
        AND e.revoked_at IS NULL AND julianday(e.ends_at) > julianday(?2)) AS covered_until,
      (SELECT s.id FROM stripe_subscriptions s WHERE s.workspace_id = w.id AND s.environment = ?3
        AND s.unavailable_at IS NULL AND s.status IN ('active', 'trialing')
        AND s.cancel_at_period_end = 0
        ORDER BY julianday(s.current_period_start) DESC LIMIT 1) AS subscription,
      (SELECT s.current_period_end FROM stripe_subscriptions s WHERE s.workspace_id = w.id
        AND s.environment = ?3 AND s.unavailable_at IS NULL AND s.status IN ('active', 'trialing')
        AND s.cancel_at_period_end = 0
        ORDER BY julianday(s.current_period_start) DESC LIMIT 1) AS renews_at
    FROM workspaces w WHERE w.id = ?1`)
    .bind(parsed.data.workspaceId, at, isProduction(env) ? "live" : "test")
    .first<{
      lifetime: number;
      covered_until: string | null;
      subscription: string | null;
      renews_at: string | null;
    }>();
  if (!workspace) return { result: "not_found" };
  if (workspace.lifetime) return { result: "lifetime" };
  const start = Math.max(
    now.getTime(),
    workspace.covered_until ? Date.parse(workspace.covered_until) : 0,
  );
  const end = start + input.days * day;
  const startsAt = new Date(start).toISOString();
  const endsAt = new Date(end).toISOString();
  const postpone =
    workspace.subscription && workspace.renews_at && Date.parse(workspace.renews_at) < end
      ? workspace.subscription
      : null;
  let stripe = null;
  if (postpone) {
    if (!env.STRIPE_SECRET_KEY) return { result: "unavailable" };
    try {
      stripe = await createStripeClient(env.STRIPE_SECRET_KEY);
      await stripeRead(() =>
        stripe!.subscriptions.update(postpone, {
          trial_end: Math.floor(end / 1000),
          proration_behavior: "none",
        }),
      );
    } catch (error) {
      logFailure({ error, operation: "billing" });
      return { result: "unavailable" };
    }
  }
  await env.DB.prepare(`INSERT INTO workspace_entitlements (id, workspace_id, source, starts_at,
      ends_at, granted_by, grant_reason) VALUES (?1, ?2, 'admin', ?3, ?4, ?5, ?6)`)
    .bind(
      crypto.randomUUID(),
      parsed.data.workspaceId,
      startsAt,
      endsAt,
      parsed.data.author,
      parsed.data.reason,
    )
    .run();
  if (stripe && postpone)
    // Il webhook e il cron rileggono comunque l'abbonamento: un errore qui non annulla nulla.
    await reconcileSubscription(env, stripe, postpone, now).catch((error: unknown) =>
      logFailure({ error, operation: "billing" }),
    );
  return { result: "done", startsAt, endsAt };
}

/** Lifetime in omaggio: occupa uno dei venti posti e chiude l'abbonamento dello spazio. */
export async function grantLifetimeConcession(
  env: Env,
  input: { workspaceId: string; author: string; reason: string },
  now = new Date(),
): Promise<LifetimeGrant | "invalid"> {
  const parsed = concession.safeParse(input);
  if (!parsed.success) return "invalid";
  const stripe = env.STRIPE_SECRET_KEY ? await createStripeClient(env.STRIPE_SECRET_KEY) : null;
  return grantLifetime(env, stripe, parsed.data, now);
}
