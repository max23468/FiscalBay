import type Stripe from "stripe";

import { ApplicationError, logFailure } from "../errors";
import {
  isMissingObject,
  stripeCall,
  stripeEnvironment,
  stripeId,
} from "../integrations/stripe.server";

/**
 * Rimborsi, dispute e cancellazioni finanziarie (§6.4, §6.6). Con Managed Payments li decide
 * anche Stripe: l'assistenza Link rimborsa entro 60 giorni e Stripe gestisce le dispute.
 * FiscalBay rilegge il pagamento e revoca soltanto la copertura che ha pagato, quando il cliente
 * ha riavuto l'intero importo: rimborso totale riuscito oppure disputa persa. Un rimborso
 * parziale si registra senza diventare giorni; una disputa aperta non revoca nulla. Prova,
 * concessioni, altre coperture e sblocchi degli ordini restano.
 */

/** Rimborsi riusciti, in centesimi, e revoca dovuta. */
export type Reversal = { refunded: number; revocation: "refund" | "dispute" | null };

/** Segnalazione per l'assistenza: un'etichetta fissa, senza importi o riferimenti. */
class BillingSignal extends ApplicationError {
  constructor(readonly failure: string) {
    super("INVALID_REQUEST");
  }
}

const signal = (failure: string) =>
  logFailure({ error: new BillingSignal(failure), operation: "billing" });

/**
 * Esito di un addebito per la copertura che ha pagato. Le richieste a Stripe partono soltanto
 * per un addebito con rimborsi o con una disputa: i rimborsi contano quando sono riusciti,
 * le dispute quando sono perse.
 */
export async function paymentReversal(stripe: Stripe, charge: Stripe.Charge): Promise<Reversal> {
  let refunded = 0;
  if (charge.amount_refunded > 0) {
    const refunds = await stripeCall(() => stripe.refunds.list({ charge: charge.id, limit: 100 }));
    refunded = refunds.data
      .filter((refund) => refund.status === "succeeded")
      .reduce((sum, refund) => sum + refund.amount, 0);
  }
  if (refunded >= charge.amount) return { refunded, revocation: "refund" };
  if (charge.disputed) {
    const disputes = await stripeCall(() => stripe.disputes.list({ charge: charge.id, limit: 10 }));
    // Stryker disable next-line MethodExpression: Stripe apre al più una disputa per addebito.
    if (disputes.data.some((dispute) => dispute.status === "lost"))
      return { refunded, revocation: "dispute" };
  }
  return { refunded, revocation: null };
}

/**
 * Esito registrato sulla sola copertura pagata da `reference`, una fattura o una sessione
 * lifetime. La revoca resta anche se il rimborso fallisce dopo o l'oggetto sparisce.
 */
export function reversalStatements(
  db: D1Database,
  proof: "stripe_invoice_id" | "stripe_checkout_session_id",
  reference: string,
  reversal: Reversal,
  at: string,
) {
  return [
    db
      .prepare(`UPDATE workspace_entitlements SET amount_refunded = ?1
        WHERE ${proof} = ?2 AND amount_refunded IS NOT ?1`)
      .bind(reversal.refunded || null, reference),
    ...(reversal.revocation
      ? [
          db
            .prepare(`UPDATE workspace_entitlements SET revoked_at = ?1, revocation = ?2
              WHERE ${proof} = ?3 AND revoked_at IS NULL`)
            .bind(at, reversal.revocation, reference),
        ]
      : []),
  ];
}

const erasedSql = "EXISTS (SELECT 1 FROM stripe_customer_erasures WHERE customer_id = ?)";

/** Il cliente ha chiesto la cancellazione dei dati finanziari: FiscalBay non lo usa più. */
export async function isErasedCustomer(db: D1Database, customerId: string) {
  return !!(await db.prepare(`SELECT 1 WHERE ${erasedSql}`).bind(customerId).first());
}

/**
 * Addebiti di un cliente per payment intent, per le fatture di un abbonamento. Vuoto per un
 * cliente cancellato o non più disponibile: senza addebito leggibile nessuna revoca.
 */
export async function customerCharges(db: D1Database, stripe: Stripe, customerId: string) {
  if (await isErasedCustomer(db, customerId)) return new Map<string, Stripe.Charge>();
  try {
    const charges = await stripeCall(() =>
      stripe.charges.list({ customer: customerId, limit: 100 }),
    );
    // Un tentativo fallito condivide il payment intent con quello riuscito: conta il secondo.
    return new Map(
      charges.data.flatMap((charge) =>
        charge.payment_intent && charge.status === "succeeded"
          ? [[stripeId(charge.payment_intent), charge] as const]
          : [],
      ),
    );
  } catch (error) {
    if (!isMissingObject(error)) throw error;
    logFailure({ error, operation: "billing" });
    return new Map<string, Stripe.Charge>();
  }
}

/**
 * Payment intent dell'evento di rimborso o di disputa, con la segnalazione all'assistenza di
 * una disputa aperta o persa e di un rimborso parziale. Null senza payment intent.
 */
export async function reversalIntent(stripe: Stripe, topic: string, objectId: string) {
  if (topic.startsWith("charge.dispute.")) {
    const dispute = await stripeCall(() => stripe.disputes.retrieve(objectId));
    if (topic === "charge.dispute.created") signal("dispute_opened");
    if (dispute.status === "lost") signal("dispute_lost");
    return dispute.payment_intent ? stripeId(dispute.payment_intent) : null;
  }
  if (topic === "charge.refund.updated") {
    const refund = await stripeCall(() => stripe.refunds.retrieve(objectId));
    return refund.payment_intent ? stripeId(refund.payment_intent) : null;
  }
  const charge = await stripeCall(() => stripe.charges.retrieve(objectId));
  if (charge.amount_refunded > 0 && charge.amount_refunded < charge.amount)
    signal("partial_refund");
  return charge.payment_intent ? stripeId(charge.payment_intent) : null;
}

/**
 * Cliente cancellato su Stripe, per una richiesta tramite Link o dall'assistenza: Stripe ha
 * già chiuso i suoi abbonamenti e cancellato i dati degli oggetti finanziari. Vale soltanto per
 * un cliente di uno spazio di questo ambiente e ancora cancellato quando si rilegge: FiscalBay
 * smette di usarlo, conserva le coperture attribuite e lo spazio e lo segnala all'assistenza.
 * Restituisce gli abbonamenti ancora aperti in locale da rileggere.
 */
export async function recordErasure(env: Env, stripe: Stripe, customerId: string, now: Date) {
  let customer: Stripe.Customer | Stripe.DeletedCustomer | null = null;
  try {
    customer = await stripeCall(() => stripe.customers.retrieve(customerId));
  } catch (error) {
    // Un cliente sparito del tutto non si usa comunque più.
    if (!isMissingObject(error)) throw error;
  }
  if (customer && !customer.deleted) return [];
  const environment = stripeEnvironment(env);
  const recorded = await env.DB.prepare(`INSERT INTO stripe_customer_erasures (customer_id,
      environment, source, received_at)
    SELECT ?1, ?2, 'webhook', ?3
    WHERE EXISTS (SELECT 1 FROM stripe_subscriptions WHERE customer_id = ?1 AND environment = ?2)
      OR EXISTS (SELECT 1 FROM lifetime_allocations WHERE customer_id = ?1)
    ON CONFLICT DO NOTHING`)
    .bind(customerId, environment, now.toISOString())
    .run();
  if (recorded.meta.changes) signal("financial_erasure");
  const { results } = await env.DB.prepare(`SELECT id FROM stripe_subscriptions
      WHERE customer_id = ?1 AND environment = ?2 AND unavailable_at IS NULL
        AND status NOT IN ('canceled', 'incomplete_expired')`)
    .bind(customerId, environment)
    .all<{ id: string }>();
  return results.map(({ id }) => id);
}
