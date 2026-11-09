import type Stripe from "stripe";

import {
  closeCheckoutSession,
  isMissingObject,
  stripeCall,
  stripeEnvironment,
  stripeId,
} from "../integrations/stripe.server";
import { inSequence } from "../sequence";
import { sqlList } from "./sql.server";

/** Stati in cui un abbonamento Stripe può ancora incassare. */
export const openSubscriptionStatuses = [
  "active",
  "trialing",
  "past_due",
  "unpaid",
  "incomplete",
  "paused",
] as const;

/** Stati finali di un abbonamento Stripe: chiuso, non addebita più. */
const closedSubscriptionStatuses = ["canceled", "incomplete_expired"] as const;

/** Stati di un abbonamento che si rinnova da solo, salvo disdetta. */
export const renewingSubscriptionStatuses = ["active", "trialing"] as const;

export function isRenewingSubscription(status: string) {
  return (renewingSubscriptionStatuses as readonly string[]).includes(status);
}

function isClosedSubscription(status: string) {
  return (closedSubscriptionStatuses as readonly string[]).includes(status);
}

/** Abbonamento `s` di `stripe_subscriptions` che può ancora incassare. */
export const openSubscriptionFilterSql = `s.unavailable_at IS NULL
  AND s.status IN (${sqlList(openSubscriptionStatuses)})`;

/**
 * Abbonamento dello spazio che può ancora incassare, come un pagamento da confermare o un
 * rinnovo da regolarizzare: un nuovo acquisto o la prova lo sovrapporrebbero.
 */
export function openSubscriptionSql(workspace: string, environment?: string) {
  return `EXISTS (SELECT 1 FROM stripe_subscriptions s WHERE s.workspace_id = ${workspace}
    ${environment ? `AND s.environment = ${environment}` : ""} AND ${openSubscriptionFilterSql})`;
}

/** Sessione `c` di `subscription_checkouts` di mensile o annuale ancora in grado di incassare. */
export function openCheckoutSql(alias: string, at: string) {
  return `${alias}.session_id IS NOT NULL AND julianday(${alias}.expires_at) > julianday(${at})`;
}

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

/**
 * Nessun nuovo addebito per mensile o annuale: la sessione ancora aperta scade, così non può più
 * incassare, e se è stata completata nel frattempo il suo abbonamento si chiude con gli altri.
 * Gli abbonamenti che possono ancora incassare si chiudono subito, senza conguagli né rimborsi
 * automatici. Una chiamata a Stripe alla volta: il turno resta entro i limiti.
 */
export async function endOpenSubscriptions(
  env: Env,
  stripe: Stripe,
  workspaceId: string,
  now: Date,
) {
  const [{ results }, { results: checkouts }] = await env.DB.batch<{ id: string }>([
    env.DB.prepare(`SELECT s.id FROM stripe_subscriptions s WHERE s.workspace_id = ?1 AND s.environment = ?2
        AND ${openSubscriptionFilterSql}`).bind(workspaceId, stripeEnvironment(env)),
    env.DB.prepare(`SELECT c.session_id AS id FROM subscription_checkouts c
        WHERE c.workspace_id = ?1 AND ${openCheckoutSql("c", "?2")}`).bind(
      workspaceId,
      now.toISOString(),
    ),
  ]);
  const late = await inSequence(checkouts!, async ({ id }) => {
    const session = await closeCheckoutSession(stripe, id);
    await env.DB.prepare("DELETE FROM subscription_checkouts WHERE session_id = ?").bind(id).run();
    return session.status === "complete" && session.subscription
      ? [stripeId(session.subscription)]
      : [];
  });
  await inSequence([...new Set([...results!.map(({ id }) => id), ...late.flat()])], (id) =>
    cancelSubscription(env, stripe, id, now),
  );
}
