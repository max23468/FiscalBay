import type Stripe from "stripe";
import { z } from "zod";

import { isProduction } from "../app-links";
import { ApplicationError, logFailure } from "../errors";
import type { UpstreamError } from "../integrations/http.server";
import { createStripeReader, isMissingObject, stripeRead } from "../integrations/stripe.server";
import type { AccountView } from "../view-models";
import { activeEntitlementSql, openSubscriptionStatuses } from "./grants.server";

/**
 * Effetti commerciali di Stripe. Webhook e riconciliazione periodica arrivano qui con un solo
 * riferimento verificato e rileggono sempre lo stato corrente da Stripe: un evento duplicato,
 * tardivo o fuori ordine produce la stessa rilettura, mai un diritto in più. Ogni fattura
 * pagata attribuisce una sola copertura, per il periodo che ha pagato; un rinnovo non pagato
 * non ne crea una e lo spazio torna subito al Free. Un errore o un oggetto non più disponibile
 * non inventano diritti, rimborsi o revoche.
 */

/** Rinnovo rifiutato in modo autorevole: Free subito, prezzo protetto per sette giorni. */
const lapsedStatuses = ["past_due", "unpaid"] as const;

const pricePromiseMs = 7 * 86_400_000;

const sqlList = (values: readonly string[]) => values.map((value) => `'${value}'`).join(", ");

const ownerSchema = z.object({
  workspace_id: z.string().min(1).max(128),
  offer: z.enum(["monthly", "annual"]),
  price_generation: z.string().min(1).max(32),
});

const environmentOf = (env: Env) => (isProduction(env) ? "live" : "test");

const iso = (seconds: number) => new Date(seconds * 1000).toISOString();

/** Identificativo di un riferimento Stripe, espanso o no. */
const idOf = (reference: string | { id: string }) =>
  typeof reference === "string" ? reference : reference.id;

/** Abbonamento senza i riferimenti scritti dal nostro checkout: nessun effetto. */
class UnknownSubscription extends ApplicationError {
  readonly failure = "unknown_subscription";
  constructor() {
    super("INVALID_REQUEST");
  }
}

/**
 * Periodo pagato da una fattura: le righe dell'abbonamento, non quelle una tantum. Null senza
 * incasso o senza righe dell'abbonamento.
 */
export function paidCoverage(invoice: Stripe.Invoice) {
  const paidAt = invoice.status_transitions.paid_at;
  if (invoice.status !== "paid" || invoice.amount_paid <= 0 || !paidAt) return null;
  const periods = invoice.lines.data
    .filter((line) => line.parent?.type === "subscription_item_details")
    .map((line) => line.period);
  // Senza righe dell'abbonamento il minimo supera il massimo e la fattura non copre nulla.
  const start = Math.min(...periods.map((period) => period.start));
  const end = Math.max(...periods.map((period) => period.end));
  if (end <= start) return null;
  return {
    invoiceId: invoice.id,
    startsAt: iso(start),
    endsAt: iso(end),
    amountPaid: invoice.amount_paid,
    currency: invoice.currency,
    paidAt: iso(paidAt),
  };
}

/** Abbonamento a cui si riferisce l'evento; null per gli eventi senza effetti commerciali. */
async function eventSubscription(stripe: Stripe, topic: string, objectId: string) {
  if (topic.startsWith("customer.subscription.")) return objectId;
  if (topic.startsWith("checkout.session.")) {
    const session = await stripeRead(() => stripe.checkout.sessions.retrieve(objectId));
    // Una sessione di pagamento una tantum non ha abbonamento.
    return session.subscription ? idOf(session.subscription) : null;
  }
  if (topic.startsWith("invoice.")) {
    const invoice = await stripeRead(() => stripe.invoices.retrieve(objectId));
    const subscription = invoice.parent?.subscription_details?.subscription;
    return subscription ? idOf(subscription) : null;
  }
  return null;
}

/**
 * Effetto di una ricevuta Stripe verificata. Senza chiave la ricevuta resta in coda; un
 * oggetto non più disponibile si segnala e non ha effetti.
 */
export async function applyStripeEvent(
  env: Env,
  receipt: { topic: string; objectId: string },
  fetcher: typeof fetch = fetch,
  now = new Date(),
) {
  if (!env.STRIPE_SECRET_KEY) throw new ApplicationError("UPSTREAM_UNAVAILABLE");
  const stripe = await createStripeReader(env.STRIPE_SECRET_KEY, fetcher);
  let subscription: string | null;
  try {
    subscription = await eventSubscription(stripe, receipt.topic, receipt.objectId);
  } catch (error) {
    if (!isMissingObject(error as UpstreamError)) throw error;
    logFailure({ error, operation: "billing" });
    return;
  }
  if (subscription) await reconcileSubscription(env, stripe, subscription, now);
}

/**
 * Rilegge l'abbonamento e le sue fatture pagate, poi aggiorna stato e coperture. Ripetuta
 * produce lo stesso risultato. Scaduta la tutela del prezzo, un rinnovo ancora non pagato
 * viene chiuso su Stripe: un incasso tardivo non riapplica in silenzio il vecchio listino.
 */
export async function reconcileSubscription(
  env: Env,
  stripe: Stripe,
  subscriptionId: string,
  now = new Date(),
) {
  const at = now.toISOString();
  let subscription: Stripe.Subscription;
  try {
    subscription = await stripeRead(() => stripe.subscriptions.retrieve(subscriptionId));
  } catch (error) {
    if (!isMissingObject(error as UpstreamError)) throw error;
    // Le coperture già pagate restano: l'assenza dell'oggetto non prova un rimborso.
    await env.DB.prepare(
      `UPDATE stripe_subscriptions SET unavailable_at = COALESCE(unavailable_at, ?1), checked_at = ?1
        WHERE id = ?2`,
    )
      .bind(at, subscriptionId)
      .run();
    logFailure({ error, operation: "billing" });
    return;
  }
  const owner = ownerSchema.safeParse(subscription.metadata);
  const item = subscription.items.data[0];
  if (!owner.success || !item || subscription.livemode !== isProduction(env)) {
    logFailure({ error: new UnknownSubscription(), operation: "billing" });
    return;
  }
  const invoices = await stripeRead(() =>
    stripe.invoices.list({ subscription: subscription.id, status: "paid", limit: 24 }),
  );
  const coverages = invoices.data.flatMap((invoice) => paidCoverage(invoice) ?? []);
  // Lo spazio deve esistere: un abbonamento di uno spazio cancellato non ricrea nulla.
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO stripe_subscriptions (id, workspace_id, environment, customer_id,
        offer, price_generation, status, current_period_start, current_period_end,
        cancel_at_period_end, synced_at, checked_at)
      SELECT ?1, w.id, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?11 FROM workspaces w WHERE w.id = ?2
      ON CONFLICT(id) DO UPDATE SET offer = excluded.offer,
        price_generation = excluded.price_generation, status = excluded.status,
        current_period_start = excluded.current_period_start,
        current_period_end = excluded.current_period_end,
        cancel_at_period_end = excluded.cancel_at_period_end, synced_at = excluded.synced_at,
        checked_at = excluded.checked_at, unavailable_at = NULL
      WHERE julianday(excluded.synced_at) >= julianday(stripe_subscriptions.synced_at)`).bind(
      subscription.id,
      owner.data.workspace_id,
      environmentOf(env),
      idOf(subscription.customer),
      owner.data.offer,
      owner.data.price_generation,
      subscription.status,
      iso(item.current_period_start),
      iso(item.current_period_end),
      // La disdetta dal portale può indicare la fine del periodo o un istante esplicito.
      subscription.cancel_at_period_end || !!subscription.cancel_at ? 1 : 0,
      at,
    ),
    ...coverages.map((coverage) =>
      env.DB.prepare(`INSERT INTO workspace_entitlements (id, workspace_id, source, starts_at,
          ends_at, stripe_invoice_id, amount_paid, currency, paid_at)
        SELECT ?1, s.workspace_id, 'premium', ?3, ?4, ?5, ?6, ?7, ?8
          FROM stripe_subscriptions s WHERE s.id = ?2
        ON CONFLICT DO NOTHING`).bind(
        crypto.randomUUID(),
        subscription.id,
        coverage.startsAt,
        coverage.endsAt,
        coverage.invoiceId,
        coverage.amountPaid,
        coverage.currency,
        coverage.paidAt,
      ),
    ),
  ]);
  const lapsed = (lapsedStatuses as readonly string[]).includes(subscription.status);
  if (lapsed && now.getTime() >= item.current_period_start * 1000 + pricePromiseMs) {
    const canceled = await stripeRead(() => stripe.subscriptions.cancel(subscription.id));
    await env.DB.prepare(
      `UPDATE stripe_subscriptions SET status = ?1, synced_at = ?2 WHERE id = ?3
        AND julianday(synced_at) <= julianday(?2)`,
    )
      .bind(canceled.status, at, subscription.id)
      .run();
  }
}

const sessionWindowMs = 2 * 86_400_000;
const batchSize = 25;

/**
 * Rete di sicurezza del cron per i webhook mancati o tardivi, anche con il browser chiuso.
 * Prima le sessioni completate degli ultimi due giorni senza abbonamento locale, poi gli
 * abbonamenti dovuti: rinnovo scaduto o tutela del prezzo finita e non ancora riletti, poi
 * attivazioni in attesa da oltre un'ora, infine una rilettura al giorno. Ogni tentativo,
 * riuscito o no, aggiorna `checked_at`: un abbonamento che fallisce non torna in testa a ogni
 * turno. Con 25 abbonamenti e due richieste ciascuno per turno orario il carico resta molto
 * sotto i limiti di Stripe. Ogni passo registra il proprio errore senza fermare gli altri e il
 * turno si conclude: quanto non riuscito torna al turno seguente.
 */
export async function reconcileBilling(env: Env, fetcher: typeof fetch = fetch, now = new Date()) {
  if (!env.STRIPE_SECRET_KEY) return;
  const stripe = await createStripeReader(env.STRIPE_SECRET_KEY, fetcher);
  const attempt = (subscription: string) =>
    reconcileSubscription(env, stripe, subscription, now).catch((error: unknown) =>
      logFailure({ error, operation: "billing" }),
    );
  // Un abbonamento alla volta: il turno resta entro i limiti di Stripe anche quando è lento.
  const inSequence = (ids: string[]) =>
    ids.reduce<Promise<void>>(
      (previous, id) => previous.then(() => attempt(id)),
      Promise.resolve(),
    );
  try {
    const sessions = await stripeRead(() =>
      stripe.checkout.sessions.list({
        status: "complete",
        created: { gte: Math.floor((now.getTime() - sessionWindowMs) / 1000) },
        limit: 100,
      }),
    );
    const ids = [
      ...new Set(
        sessions.data.flatMap((session) =>
          session.subscription ? [idOf(session.subscription)] : [],
        ),
      ),
    ];
    const { results: known } = await env.DB.prepare(
      `SELECT id FROM stripe_subscriptions WHERE id IN (${ids.map(() => "?").join(", ")})`,
    )
      .bind(...ids)
      .all<{ id: string }>();
    const local = new Set(known.map((row) => row.id));
    await inSequence(ids.filter((id) => !local.has(id)));
  } catch (error) {
    logFailure({ error, operation: "billing" });
  }
  const at = now.toISOString();
  const { results } = await env.DB.prepare(`UPDATE stripe_subscriptions SET checked_at = ?1
    WHERE id IN (SELECT s.id FROM stripe_subscriptions s
      WHERE s.environment = ?2 AND s.unavailable_at IS NULL
        AND s.status IN (${sqlList(openSubscriptionStatuses)})
        AND (${dueSql} OR julianday(s.checked_at) <= julianday(?1, '-1 hour') AND ${pendingSql}
          OR julianday(s.checked_at) <= julianday(?1, '-1 day'))
      ORDER BY ${dueSql} DESC, julianday(s.checked_at) LIMIT ${batchSize})
    RETURNING id`)
    .bind(at, environmentOf(env))
    .all<{ id: string }>();
  await inSequence(results.map(({ id }) => id));
}

/** Rinnovo scaduto o tutela del prezzo finita, non ancora riletti dopo quell'istante. */
const dueSql = `(julianday(s.current_period_end) <= julianday(?1)
    AND julianday(s.checked_at) < julianday(s.current_period_end)
  OR s.status IN (${sqlList(lapsedStatuses)})
    AND julianday(s.current_period_start, '+7 days') <= julianday(?1)
    AND julianday(s.checked_at) < julianday(s.current_period_start, '+7 days'))`;

/** Abbonamento senza una copertura in corso: pagamento o rinnovo ancora da confermare. */
const pendingSql = `NOT ${activeEntitlementSql("s.workspace_id", "?1")}`;

/**
 * Stato del pagamento mostrato nel piano. Con una copertura pagata: periodicità, rinnovo o
 * fine dopo la disdetta. Senza, o con la sola prova: pagamento in attesa di conferma oppure
 * rinnovo non riuscito, con il prezzo protetto fino a sette giorni dall'inizio del periodo
 * non pagato.
 */
export async function subscriptionView(
  db: D1Database,
  env: Env,
  workspaceId: string,
  coverage: { source: string; endsAt: string | null } | null,
  now = new Date(),
): Promise<Pick<AccountView, "premium" | "payment">> {
  const row = await db
    .prepare(`SELECT offer, status, current_period_start, current_period_end, cancel_at_period_end
      FROM stripe_subscriptions WHERE workspace_id = ? AND environment = ?
        AND unavailable_at IS NULL AND status IN (${sqlList(openSubscriptionStatuses)})
      ORDER BY julianday(current_period_start) DESC LIMIT 1`)
    .bind(workspaceId, environmentOf(env))
    .first<{
      offer: "monthly" | "annual";
      status: string;
      current_period_start: string;
      current_period_end: string;
      cancel_at_period_end: number;
    }>();
  if (!row) return {};
  if (coverage?.source === "premium")
    return {
      premium: row.cancel_at_period_end
        ? { period: row.offer, renewsAt: null, endsAt: coverage.endsAt }
        : { period: row.offer, renewsAt: row.current_period_end },
    };
  // Durante la prova un acquisto ancora da confermare resta visibile; un'altra copertura,
  // come una concessione, prevale.
  if (coverage && coverage.source !== "trial") return {};
  if ((lapsedStatuses as readonly string[]).includes(row.status)) {
    const protectedUntil = Date.parse(row.current_period_start) + pricePromiseMs;
    return protectedUntil > now.getTime()
      ? {
          payment: {
            state: "renewal-failed",
            protectedUntil: new Date(protectedUntil).toISOString(),
          },
        }
      : {};
  }
  return row.status === "paused" ? {} : { payment: { state: "pending" } };
}
