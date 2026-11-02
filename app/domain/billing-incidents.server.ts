import type Stripe from "stripe";

import { logFailure } from "../errors";
import { inSequence } from "../sequence";
import { stripeCall, stripeEnvironment } from "../integrations/stripe.server";
import { erasedCustomerSql, paymentReversal } from "./refunds.server";

/** Incasso senza diritto, deduplicato per Checkout e limitato a uno spazio ancora esistente. */
export async function recordUnallocatedLifetime(
  env: Env,
  input: { sessionId: string; workspaceId: string; customerId: string | null },
  now: Date,
) {
  await env.DB.prepare(`INSERT INTO billing_incidents
      (session_id, workspace_id, customer_id, environment, opened_at, checked_at)
    SELECT ?1, w.id, ?3, ?4, ?5, ?5 FROM workspaces w WHERE w.id = ?2
      AND NOT ${erasedCustomerSql("?3")}
      AND NOT EXISTS (SELECT 1 FROM account_deletions d WHERE d.workspace_id = w.id)
    ON CONFLICT(session_id) DO NOTHING`)
    .bind(
      input.sessionId,
      input.workspaceId,
      input.customerId,
      stripeEnvironment(env),
      now.toISOString(),
    )
    .run();
}

export async function resolveBillingIncident(db: D1Database, sessionId: string, now: Date) {
  await db
    .prepare(
      "UPDATE billing_incidents SET resolved_at = ?2 WHERE session_id = ?1 AND resolved_at IS NULL",
    )
    .bind(sessionId, now.toISOString())
    .run();
}

/** Rilettura giornaliera, senza assegnazioni, rimborsi o altre scritture su Stripe. */
export async function reconcileBillingIncidents(env: Env, stripe: Stripe, now: Date) {
  const at = now.toISOString();
  const { results } = await env.DB.prepare(`UPDATE billing_incidents SET checked_at = ?1
    WHERE session_id IN (SELECT session_id FROM billing_incidents
      WHERE environment = ?2 AND resolved_at IS NULL AND julianday(checked_at) <= julianday(?1, '-1 day')
        AND NOT EXISTS (SELECT 1 FROM stripe_customer_erasures e WHERE e.customer_id = billing_incidents.customer_id)
      ORDER BY checked_at LIMIT 5) RETURNING session_id, workspace_id`)
    .bind(at, stripeEnvironment(env))
    .all<{ session_id: string; workspace_id: string }>();
  await inSequence(results, async (row) => {
    try {
      const granted = await env.DB.prepare(
        "SELECT 1 FROM workspace_entitlements WHERE stripe_checkout_session_id = ?",
      )
        .bind(row.session_id)
        .first();
      if (granted) {
        await resolveBillingIncident(env.DB, row.session_id, now);
        return;
      }
      const session = await stripeCall(() =>
        stripe.checkout.sessions.retrieve(row.session_id, {
          expand: ["payment_intent.latest_charge"],
        }),
      );
      const intent = typeof session.payment_intent === "object" ? session.payment_intent : null;
      const charge = typeof intent?.latest_charge === "object" ? intent.latest_charge : null;
      if (session.livemode !== (stripeEnvironment(env) === "live")) return;
      if (
        session.mode !== "payment" ||
        session.metadata?.offer !== "lifetime" ||
        session.metadata.workspace_id !== row.workspace_id
      )
        return;
      if (charge && (await paymentReversal(stripe, charge)).revocation)
        await resolveBillingIncident(env.DB, row.session_id, now);
    } catch (error) {
      logFailure({ error, operation: "billing" });
    }
  });
}
