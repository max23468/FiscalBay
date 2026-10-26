import type Stripe from "stripe";
import { z } from "zod";

import { isProduction } from "../app-links";
import { priceGeneration } from "../catalog";
import { ApplicationError, logFailure } from "../errors";
import type { Language } from "../i18n";
import { catalogMismatch } from "../integrations/stripe-account.server";
import {
  createBoundedStripeClient,
  createStripeClient,
  isMissingObject,
  stripeCall,
  stripeEnvironment,
  stripeId,
  stripeSecretKey,
} from "../integrations/stripe.server";
import type { AccountView } from "../view-models";
import { openSubscriptionStatuses } from "./grants.server";
import {
  isLifetimeSession,
  reconcileLifetime,
  reconcileLifetimeReservations,
} from "./lifetime.server";
import {
  customerCharges,
  paymentReversal,
  recordErasure,
  reversalIntent,
  reversalStatements,
  type Reversal,
} from "./refunds.server";
import { inSequence } from "../sequence";
import { sqlList } from "./sql.server";
import { dayMilliseconds } from "../time";

/**
 * Effetti commerciali di Stripe. Webhook e riconciliazione periodica arrivano qui con un solo
 * riferimento verificato e rileggono sempre lo stato corrente da Stripe: un evento duplicato,
 * tardivo o fuori ordine produce la stessa rilettura, mai un diritto in più. Ogni fattura
 * pagata attribuisce una sola copertura, per il periodo che ha pagato; un rinnovo non pagato
 * non ne crea una e lo spazio torna subito al Free. Un rimborso totale o una disputa persa
 * revocano soltanto la copertura di quel pagamento. Un errore o un oggetto non più disponibile
 * non inventano diritti, rimborsi o revoche.
 */

/** Rinnovo rifiutato in modo autorevole: Free subito, prezzo protetto per sette giorni. */
const lapsedStatuses = ["past_due", "unpaid"] as const;

const pricePromiseMs = 7 * dayMilliseconds;

const ownerSchema = z.object({
  workspace_id: z.string().min(1).max(128),
  offer: z.enum(["monthly", "annual"]),
  price_generation: z.string().min(1).max(32),
});

const iso = (seconds: number) => new Date(seconds * 1000).toISOString();

/** Periodicità del prezzo di un elemento dell'abbonamento; null per un prezzo non ricorrente. */
function itemOffer(item: Stripe.SubscriptionItem): "monthly" | "annual" | null {
  const interval = item.price.recurring?.interval;
  return interval === "year" ? "annual" : interval === "month" ? "monthly" : null;
}

/**
 * Periodicità del periodo pagato e del prossimo rinnovo. Il prezzo dell'abbonamento è quello
 * del rinnovo; finché il periodo pagato non è concluso (`trialing`, per un acquisto durante la
 * prova o un cambio programmato) vale quella dei metadati, scritta all'acquisto e al cambio.
 */
export function subscriptionOffers(subscription: Stripe.Subscription, metadataOffer: string) {
  const item = subscription.items.data[0];
  const renewal = (item && itemOffer(item)) ?? (metadataOffer as "monthly" | "annual");
  return {
    offer: subscription.status === "trialing" ? (metadataOffer as "monthly" | "annual") : renewal,
    renewal,
  };
}

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
  // Il pagamento riuscito della fattura, per riconoscerne rimborsi e dispute.
  const payment = invoice.payments?.data.find((candidate) => candidate.status === "paid")?.payment;
  return {
    invoiceId: invoice.id,
    paymentIntent: payment?.payment_intent ? stripeId(payment.payment_intent) : null,
    startsAt: iso(start),
    endsAt: iso(end),
    amountPaid: invoice.amount_paid,
    currency: invoice.currency,
    paidAt: iso(paidAt),
  };
}

/**
 * Oggetto a cui si riferisce l'evento: un abbonamento, una sessione lifetime o un cliente
 * cancellato; null per gli eventi senza effetti commerciali. Rimborsi e dispute portano al
 * pagamento, poi alla fattura o alla sessione che l'ha incassato.
 */
async function eventTarget(
  stripe: Stripe,
  topic: string,
  objectId: string,
): Promise<{ subscription: string } | { lifetime: string } | { erasure: string } | null> {
  if (topic.startsWith("customer.subscription.")) return { subscription: objectId };
  if (topic === "customer.deleted") return { erasure: objectId };
  if (topic.startsWith("charge.")) {
    const intent = await reversalIntent(stripe, topic, objectId);
    if (!intent) return null;
    const payments = await stripeCall(() =>
      stripe.invoicePayments.list({
        payment: { type: "payment_intent", payment_intent: intent },
        limit: 1,
      }),
    );
    // Managed Payments emette una fattura anche per il lifetime: senza abbonamento il pagamento
    // si cerca nella sessione Checkout che l'ha incassato.
    const invoice = payments.data[0]?.invoice;
    const subscription = invoice
      ? await eventTarget(stripe, "invoice.paid", stripeId(invoice))
      : null;
    if (subscription) return subscription;
    const sessions = await stripeCall(() =>
      stripe.checkout.sessions.list({ payment_intent: intent, limit: 1 }),
    );
    const session = sessions.data[0];
    return session && isLifetimeSession(session) ? { lifetime: session.id } : null;
  }
  if (topic.startsWith("checkout.session.")) {
    const session = await stripeCall(() => stripe.checkout.sessions.retrieve(objectId));
    if (session.subscription) return { subscription: stripeId(session.subscription) };
    return isLifetimeSession(session) ? { lifetime: session.id } : null;
  }
  if (topic.startsWith("invoice.")) {
    const invoice = await stripeCall(() => stripe.invoices.retrieve(objectId));
    const subscription = invoice.parent?.subscription_details?.subscription;
    return subscription ? { subscription: stripeId(subscription) } : null;
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
  const key = stripeSecretKey(env);
  if (!key) throw new ApplicationError("UPSTREAM_UNAVAILABLE");
  const stripe = await createBoundedStripeClient(key, fetcher);
  let target: Awaited<ReturnType<typeof eventTarget>>;
  try {
    target = await eventTarget(stripe, receipt.topic, receipt.objectId);
  } catch (error) {
    if (!isMissingObject(error)) throw error;
    logFailure({ error, operation: "billing" });
    return;
  }
  if (target && "subscription" in target)
    await reconcileSubscription(env, stripe, target.subscription, now);
  else if (target && "lifetime" in target)
    await reconcileLifetime(env, stripe, target.lifetime, now);
  else if (target)
    await inSequence(await recordErasure(env, stripe, target.erasure, now), (subscription) =>
      reconcileSubscription(env, stripe, subscription, now),
    );
}

/**
 * Rilegge l'abbonamento, le sue fatture pagate e i loro addebiti, poi aggiorna stato e
 * coperture: una fattura rimborsata per intero o con la disputa persa ha la copertura revocata,
 * anche se Stripe la segnala prima che la copertura esista. Ripetuta produce lo stesso
 * risultato. Scaduta la tutela del prezzo, un rinnovo ancora non pagato
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
    subscription = await stripeCall(() => stripe.subscriptions.retrieve(subscriptionId));
  } catch (error) {
    if (!isMissingObject(error)) throw error;
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
  subscription = await scheduleProtectionEnd(stripe, subscription, item, now);
  const invoices = await stripeCall(() =>
    stripe.invoices.list({
      subscription: subscription.id,
      status: "paid",
      limit: 24,
      expand: ["data.payments"],
    }),
  );
  const coverages = invoices.data.flatMap((invoice) => paidCoverage(invoice) ?? []);
  const charges = await customerCharges(env.DB, stripe, stripeId(subscription.customer));
  // Una richiesta alla volta, soltanto per gli addebiti con rimborsi o con una disputa. Senza
  // un addebito leggibile l'esito già registrato resta.
  const reversals = await inSequence(coverages, async (coverage): Promise<Reversal | null> => {
    const charge = coverage.paymentIntent ? charges.get(coverage.paymentIntent) : undefined;
    return charge ? paymentReversal(stripe, charge) : null;
  });
  const offers = subscriptionOffers(subscription, owner.data.offer);
  // Lo spazio deve esistere: un abbonamento di uno spazio cancellato non ricrea nulla.
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO stripe_subscriptions (id, workspace_id, environment, customer_id,
        offer, price_generation, status, current_period_start, current_period_end,
        cancel_at_period_end, synced_at, checked_at, renewal_offer)
      SELECT ?1, w.id, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?11, ?12 FROM workspaces w WHERE w.id = ?2
      ON CONFLICT(id) DO UPDATE SET offer = excluded.offer, renewal_offer = excluded.renewal_offer,
        price_generation = excluded.price_generation, status = excluded.status,
        current_period_start = excluded.current_period_start,
        current_period_end = excluded.current_period_end,
        cancel_at_period_end = excluded.cancel_at_period_end, synced_at = excluded.synced_at,
        checked_at = excluded.checked_at, unavailable_at = NULL
      WHERE julianday(excluded.synced_at) >= julianday(stripe_subscriptions.synced_at)`).bind(
      subscription.id,
      owner.data.workspace_id,
      stripeEnvironment(env),
      stripeId(subscription.customer),
      offers.offer,
      owner.data.price_generation,
      subscription.status,
      iso(item.current_period_start),
      iso(item.current_period_end),
      // La disdetta dal portale può indicare la fine del periodo o un istante esplicito.
      subscription.cancel_at_period_end || !!subscription.cancel_at ? 1 : 0,
      at,
      offers.renewal,
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
    ...coverages.flatMap((coverage, index) => {
      const reversal = reversals[index];
      return reversal
        ? reversalStatements(env.DB, "stripe_invoice_id", coverage.invoiceId, reversal, at)
        : [];
    }),
  ]);
  const lapsed = (lapsedStatuses as readonly string[]).includes(subscription.status);
  if (lapsed && now.getTime() >= protectionEnd(item) * 1000) {
    const canceled = await stripeCall(() => stripe.subscriptions.cancel(subscription.id));
    await env.DB.prepare(
      `UPDATE stripe_subscriptions SET status = ?1, synced_at = ?2 WHERE id = ?3
        AND julianday(synced_at) <= julianday(?2)`,
    )
      .bind(canceled.status, at, subscription.id)
      .run();
  }
}

/** Fine della tutela del prezzo di un rinnovo non pagato, in secondi come in Stripe. */
const protectionEnd = (item: Stripe.SubscriptionItem) =>
  item.current_period_start + pricePromiseMs / 1000;

/**
 * Un rinnovo non pagato si chiude su Stripe all'istante esatto in cui finisce la tutela del
 * prezzo: alla chiusura Stripe sospende i tentativi sulla fattura aperta, così nessun incasso
 * arriva dopo e applica in silenzio il vecchio listino. Un pagamento riuscito entro la tutela
 * toglie la chiusura programmata da FiscalBay; una disdetta che arriva prima resta.
 */
async function scheduleProtectionEnd(
  stripe: Stripe,
  subscription: Stripe.Subscription,
  item: Stripe.SubscriptionItem,
  now: Date,
) {
  const end = protectionEnd(item);
  const lapsed = (lapsedStatuses as readonly string[]).includes(subscription.status);
  const update = (params: Stripe.SubscriptionUpdateParams) =>
    stripeCall(() => stripe.subscriptions.update(subscription.id, params));
  if (
    lapsed &&
    now.getTime() < end * 1000 &&
    !(subscription.cancel_at && subscription.cancel_at <= end)
  )
    return update({ cancel_at: end, proration_behavior: "none" });
  if (!lapsed && subscription.status === "active" && subscription.cancel_at === end)
    return update({ cancel_at: "" });
  return subscription;
}

const sessionWindowMs = 2 * dayMilliseconds;
const batchSize = 25;
/** Sessioni completate lette per turno: ben oltre il volume atteso di due giorni. */
const sessionScanLimit = 1000;

/**
 * Rete di sicurezza del cron per i webhook mancati o tardivi, anche con il browser chiuso.
 * Prima le sessioni completate degli ultimi due giorni senza abbonamento locale o senza posto
 * lifetime attivo, poi le prenotazioni dei posti, poi gli abbonamenti dovuti: rinnovo scaduto
 * o tutela del prezzo finita e non ancora riletti, poi attivazioni in attesa da oltre un'ora,
 * infine una rilettura al giorno. Ogni tentativo, riuscito o no, aggiorna `checked_at`: un
 * abbonamento che fallisce non torna in testa a ogni turno. Con 25 abbonamenti e due richieste
 * ciascuno, più al massimo venti posti, per turno orario il carico resta molto sotto i limiti
 * di Stripe. Ogni passo registra il proprio errore senza fermare gli altri e il turno si
 * conclude: quanto non riuscito torna al turno seguente.
 */
export async function reconcileBilling(env: Env, fetcher: typeof fetch = fetch, now = new Date()) {
  const key = stripeSecretKey(env);
  if (!key) return;
  const stripe = await createBoundedStripeClient(key, fetcher);
  const attempt = (subscription: string) =>
    reconcileSubscription(env, stripe, subscription, now).catch((error: unknown) =>
      logFailure({ error, operation: "billing" }),
    );
  // Un abbonamento alla volta: il turno resta entro i limiti di Stripe anche quando è lento.
  try {
    // Tutte le pagine dei due giorni: un volume alto di acquisti non lascia sessioni indietro.
    const sessions = await stripeCall(() =>
      stripe.checkout.sessions
        .list({
          status: "complete",
          created: { gte: Math.floor((now.getTime() - sessionWindowMs) / 1000) },
          limit: 100,
        })
        .autoPagingToArray({ limit: sessionScanLimit }),
    );
    const ids = [
      ...new Set(
        sessions.flatMap((session) =>
          session.subscription ? [stripeId(session.subscription)] : [],
        ),
      ),
    ];
    const lifetimes = sessions.filter(isLifetimeSession).map((session) => session.id);
    const { results: known } = await env.DB.prepare(
      `SELECT id FROM stripe_subscriptions WHERE id IN (${ids.map(() => "?").join(", ")})
      UNION SELECT provider_reference FROM lifetime_allocations WHERE status = 'active'
        AND provider_reference IN (${lifetimes.map(() => "?").join(", ")})`,
    )
      .bind(...ids, ...lifetimes)
      .all<{ id: string }>();
    const local = new Set(known.map((row) => row.id));
    await inSequence(
      ids.filter((id) => !local.has(id)),
      attempt,
    );
    await inSequence(
      lifetimes.filter((session) => !local.has(session)),
      (id) =>
        reconcileLifetime(env, stripe, id, now).catch((error: unknown) =>
          logFailure({ error, operation: "billing" }),
        ),
    );
  } catch (error) {
    logFailure({ error, operation: "billing" });
  }
  await reconcileLifetimeReservations(env, stripe, now).catch((error: unknown) =>
    logFailure({ error, operation: "billing" }),
  );
  const at = now.toISOString();
  // Le sessioni scadute da oltre due giorni sono già state rilette: il riferimento non serve.
  await env.DB.prepare(`DELETE FROM subscription_checkouts
      WHERE julianday(expires_at) < julianday(?1, '-2 days')`)
    .bind(at)
    .run()
    .catch((error: unknown) => logFailure({ error, operation: "billing" }));
  const { results } = await env.DB.prepare(`UPDATE stripe_subscriptions SET checked_at = ?1
    WHERE id IN (SELECT s.id FROM stripe_subscriptions s
      WHERE s.environment = ?2 AND s.unavailable_at IS NULL
        AND s.status IN (${sqlList(openSubscriptionStatuses)})
        AND (${dueSql} OR julianday(s.checked_at) <= julianday(?1, '-1 hour') AND ${pendingSql}
          OR julianday(s.checked_at) <= julianday(?1, '-1 day'))
      ORDER BY CASE WHEN ${dueSql} THEN 0 WHEN ${pendingSql} THEN 1 ELSE 2 END,
        julianday(s.checked_at) LIMIT ${batchSize})
    RETURNING id`)
    .bind(at, stripeEnvironment(env))
    .all<{ id: string }>();
  await inSequence(
    results.map(({ id }) => id),
    attempt,
  );
}

/** Rinnovo scaduto o tutela del prezzo finita, non ancora riletti dopo quell'istante. */
const dueSql = `(julianday(s.current_period_end) <= julianday(?1)
    AND julianday(s.checked_at) < julianday(s.current_period_end)
  OR s.status IN (${sqlList(lapsedStatuses)})
    AND julianday(s.current_period_start, '+7 days') <= julianday(?1)
    AND julianday(s.checked_at) < julianday(s.current_period_start, '+7 days'))`;

/**
 * Abbonamento senza una copertura in corso: pagamento o rinnovo ancora da confermare. Una
 * copertura revocata dopo un rimborso non è un pagamento da confermare.
 */
const pendingSql = `NOT EXISTS (SELECT 1 FROM workspace_entitlements e
  WHERE e.workspace_id = s.workspace_id AND julianday(e.starts_at) <= julianday(?1)
    AND (e.ends_at IS NULL OR julianday(?1) < julianday(e.ends_at)))`;

/**
 * Stato del pagamento mostrato nel piano. Il lifetime prevale su tutto, senza rinnovi. Con una
 * copertura pagata, o concessa a un abbonamento che si rinnova: periodicità, rinnovo o fine
 * dopo la disdetta. Una concessione senza abbonamento indica la sua fine. Senza copertura, o con
 * la sola prova: pagamento in attesa di conferma, rinnovo non riuscito, con il prezzo protetto
 * fino a sette giorni dall'inizio del periodo non pagato, oppure pagamento rimborsato.
 */
export async function subscriptionView(
  db: D1Database,
  env: Env,
  workspaceId: string,
  coverage: { source: string; endsAt: string | null } | null,
  now = new Date(),
): Promise<Pick<AccountView, "premium" | "payment" | "grant">> {
  if (coverage?.source === "lifetime") {
    const allocation = await db
      .prepare("SELECT kind FROM lifetime_allocations WHERE workspace_id = ? AND status = 'active'")
      .bind(workspaceId)
      .first<{ kind: "sale" | "gift" }>();
    // Il diritto lifetime richiede un posto attivo dello spazio.
    return {
      premium: {
        period: "lifetime",
        renewsAt: null,
        ...(allocation!.kind === "gift" ? { granted: true as const } : {}),
      },
    };
  }
  const grant =
    coverage?.source === "admin" && coverage.endsAt ? { grant: { endsAt: coverage.endsAt } } : {};
  // Lifetime completato su Stripe con il pagamento ancora da confermare: senza copertura è
  // l'attivazione in corso, con un abbonamento il passaggio a vita in conferma.
  const pending = (await db
    .prepare(`SELECT 1 FROM lifetime_allocations WHERE workspace_id = ? AND status = 'reserved'
      AND completed_at IS NOT NULL`)
    .bind(workspaceId)
    .first())
    ? { payment: { state: "pending" as const, lifetime: true as const } }
    : {};
  if (pending.payment && (!coverage || coverage.source === "trial")) return pending;
  const row = await db
    .prepare(`SELECT offer, renewal_offer, status, current_period_start, current_period_end,
        cancel_at_period_end
      FROM stripe_subscriptions WHERE workspace_id = ? AND environment = ?
        AND unavailable_at IS NULL AND status IN (${sqlList(openSubscriptionStatuses)})
      ORDER BY julianday(current_period_start) DESC LIMIT 1`)
    .bind(workspaceId, stripeEnvironment(env))
    .first<{
      offer: "monthly" | "annual";
      renewal_offer: "monthly" | "annual" | null;
      status: string;
      current_period_start: string;
      current_period_end: string;
      cancel_at_period_end: number;
    }>();
  // Senza copertura, un pagamento rimborsato o con la disputa persa spiega il ritorno al Free:
  // il lifetime, che non torna in vendita perché il posto resta occupato, oppure il periodo in
  // corso, con il rinnovo se l'abbonamento continua. Un nuovo abbonamento da confermare o da
  // regolarizzare prevale.
  const refunded = coverage
    ? null
    : await db
        .prepare(`SELECT source FROM workspace_entitlements WHERE workspace_id = ?1
          AND revocation IS NOT NULL AND (source = 'lifetime'
            OR julianday(starts_at) <= julianday(?2) AND julianday(?2) < julianday(ends_at))
          ORDER BY source = 'lifetime' LIMIT 1`)
        .bind(workspaceId, now.toISOString())
        .first<{ source: string }>();
  const renewing = !!row && ["active", "trialing"].includes(row.status);
  if (refunded && (!row || (renewing && refunded.source !== "lifetime")))
    return {
      payment: {
        state: "refunded",
        ...(refunded.source === "lifetime"
          ? { lifetime: true as const }
          : row && !row.cancel_at_period_end
            ? { renewsAt: row.current_period_end }
            : {}),
      },
    };
  if (!row) return { ...grant, ...pending };
  // Una concessione a un abbonamento che si rinnova ne ha rinviato il rinnovo alla sua fine.
  if (
    coverage?.source === "premium" ||
    (coverage?.source === "admin" && ["active", "trialing"].includes(row.status))
  ) {
    if (!row.cancel_at_period_end)
      return {
        ...pending,
        premium: {
          period: row.offer,
          renewsAt: row.current_period_end,
          // Cambio di periodicità programmato: vale dal rinnovo.
          ...(row.renewal_offer && row.renewal_offer !== row.offer
            ? { nextPeriod: row.renewal_offer }
            : {}),
        },
      };
    // Dopo la disdetta Premium dura fino all'ultima copertura, concessioni comprese.
    const last = await db
      .prepare(`SELECT MAX(ends_at) AS ends_at FROM workspace_entitlements WHERE workspace_id = ?1
        AND revoked_at IS NULL AND julianday(ends_at) > julianday(?2)`)
      .bind(workspaceId, now.toISOString())
      .first<{ ends_at: string | null }>();
    return {
      ...pending,
      // L'aggregato restituisce sempre una riga, anche senza coperture future.
      premium: { period: row.offer, renewsAt: null, endsAt: last!.ends_at ?? coverage.endsAt },
    };
  }
  // Durante la prova un acquisto ancora da confermare resta visibile; un'altra copertura,
  // come una concessione, prevale.
  if (coverage && coverage.source !== "trial") return { ...grant, ...pending };
  // Scelto durante la prova: nessun incasso finché la prova non finisce; disdetto, nessuno.
  if (coverage?.source === "trial" && row.status === "trialing")
    return {
      payment: {
        state: "scheduled",
        period: row.offer,
        chargeAt: row.current_period_end,
        ...(row.cancel_at_period_end ? { cancelled: true as const } : {}),
      },
    };
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

/**
 * Abbonamento rinnovabile dello spazio: periodo pagato in corso, o concessione che ne ha
 * rinviato il rinnovo, e nessuna disdetta.
 */
async function renewingSubscription(db: D1Database, env: Env, userId: string, now: Date) {
  return db
    .prepare(`SELECT s.id, s.workspace_id, s.price_generation FROM stripe_subscriptions s
      JOIN workspace_members wm ON wm.workspace_id = s.workspace_id
      WHERE wm.user_id = ?1 AND s.environment = ?2 AND s.unavailable_at IS NULL
        AND s.status IN ('active', 'trialing') AND s.cancel_at_period_end = 0
        AND EXISTS (SELECT 1 FROM workspace_entitlements e WHERE e.workspace_id = s.workspace_id
          AND e.source IN ('premium', 'admin') AND e.revoked_at IS NULL
          AND julianday(e.starts_at) <= julianday(?3) AND julianday(?3) < julianday(e.ends_at))
      ORDER BY julianday(s.current_period_start) DESC LIMIT 1`)
    .bind(userId, stripeEnvironment(env), now.toISOString())
    .first<{ id: string; workspace_id: string; price_generation: string }>();
}

/**
 * Lo spazio ha un abbonamento che addebiterà ancora: un periodo pagato che si rinnova oppure
 * quello scelto durante la prova, con il primo addebito alla sua fine. Scollegare l'ultimo
 * negozio non lo ferma.
 */
export async function subscriptionRenews(db: D1Database, env: Env, userId: string) {
  const row = await db
    .prepare(`SELECT 1 FROM stripe_subscriptions s
      JOIN workspace_members wm ON wm.workspace_id = s.workspace_id
      WHERE wm.user_id = ?1 AND s.environment = ?2 AND s.unavailable_at IS NULL
        AND s.status IN ('active', 'trialing') AND s.cancel_at_period_end = 0 LIMIT 1`)
    .bind(userId, stripeEnvironment(env))
    .first();
  return !!row;
}

/**
 * Prezzo ricorrente della periodicità richiesta nella generazione dell'abbonamento: il listino
 * resta quello con cui è nato, anche dopo una generazione nuova (§6.2). Null se manca o non è
 * conforme; il prezzo di una generazione precedente deve restare attivo su Stripe.
 */
async function generationPrice(
  stripe: Stripe,
  product: string,
  generation: string,
  offer: "monthly" | "annual",
) {
  const prices = await stripeCall(() =>
    stripe.prices.list({ product, type: "recurring", limit: 100, expand: ["data.product"] }),
  );
  const price = prices.data.find(
    (candidate) =>
      candidate.metadata.price_generation === generation &&
      candidate.metadata.offer === offer &&
      !candidate.metadata.role,
  );
  if (!price) return null;
  // L'importo si confronta con il listino corrente; quello di una generazione precedente è
  // il suo prezzo su Stripe.
  const net =
    generation === priceGeneration.id
      ? priceGeneration.net[offer]
      : // Stryker disable next-line UnaryOperator: senza importo nessun valore coincide con null.
        (price.unit_amount ?? -1);
  return catalogMismatch(price, offer, net) ? null : price;
}

export type PeriodChange = "done" | "unchanged" | "not_allowed" | "unavailable";

/**
 * Cambio di periodicità alla fine del periodo pagato, senza conguaglio (§6.2). Il prezzo
 * dell'altra periodicità della stessa generazione parte al rinnovo: fino ad allora Stripe
 * registra l'abbonamento come `trialing` e non addebita nulla, e i metadati conservano la
 * periodicità del periodo pagato. Lo stesso percorso annulla un cambio programmato. Dopo la
 * modifica l'abbonamento si rilegge, come per un evento del webhook.
 */
export async function changeSubscriptionPeriod(
  env: Env,
  userId: string,
  target: "monthly" | "annual",
  now = new Date(),
): Promise<PeriodChange> {
  const local = await renewingSubscription(env.DB, env, userId, now);
  if (!local) return "not_allowed";
  const key = stripeSecretKey(env);
  if (!key) return "unavailable";
  try {
    const stripe = await createStripeClient(key);
    const subscription = await stripeCall(() => stripe.subscriptions.retrieve(local.id));
    const owner = ownerSchema.safeParse(subscription.metadata);
    const item = subscription.items.data[0];
    if (
      !owner.success ||
      owner.data.workspace_id !== local.workspace_id ||
      !item ||
      !["active", "trialing"].includes(subscription.status) ||
      subscription.cancel_at_period_end ||
      subscription.cancel_at ||
      subscription.schedule
    )
      return "not_allowed";
    const offers = subscriptionOffers(subscription, owner.data.offer);
    if (offers.renewal === target) return "unchanged";
    const price = await generationPrice(
      stripe,
      stripeId(item.price.product as string | { id: string }),
      owner.data.price_generation,
      target,
    );
    if (!price) {
      logFailure({ error: new UnknownSubscription(), operation: "billing" });
      return "unavailable";
    }
    await stripeCall(() =>
      stripe.subscriptions.update(subscription.id, {
        items: [{ id: item.id, price: price.id }],
        trial_end: item.current_period_end,
        proration_behavior: "none",
        metadata: { ...subscription.metadata, offer: offers.offer },
      }),
    );
    await reconcileSubscription(env, stripe, subscription.id, now);
    return "done";
  } catch (error) {
    logFailure({ error, operation: "billing" });
    return "unavailable";
  }
}

const notErasedSql = (alias: string) => `NOT EXISTS (SELECT 1 FROM stripe_customer_erasures r
  WHERE r.customer_id = ${alias}.customer_id)`;

/**
 * Cliente Stripe dello spazio, espressione SQL: quello dell'abbonamento che può ancora
 * incassare, poi del lifetime in vigore, poi dell'abbonamento più recente e infine del lifetime
 * rimborsato. Il portale lo apre e un nuovo abbonamento lo riusa, così disdetta, metodo di
 * pagamento e documenti restano su un solo cliente. Un cliente con i dati finanziari cancellati
 * non si riapre.
 */
export function workspaceCustomerSql(workspace: string, environment: string) {
  const subscription = (open: boolean) => `(SELECT s.customer_id FROM stripe_subscriptions s
    WHERE s.workspace_id = ${workspace} AND s.environment = ${environment} AND ${notErasedSql("s")}
      ${open ? `AND s.unavailable_at IS NULL AND s.status IN (${sqlList(openSubscriptionStatuses)})` : ""}
    ORDER BY julianday(s.current_period_start) DESC LIMIT 1)`;
  const lifetime = (inForce: boolean) => `(SELECT a.customer_id FROM lifetime_allocations a
    WHERE a.workspace_id = ${workspace} AND a.status = 'active' AND a.customer_id IS NOT NULL
      AND ${notErasedSql("a")}${
        inForce
          ? ` AND EXISTS (SELECT 1 FROM workspace_entitlements e WHERE e.workspace_id = a.workspace_id
        AND e.source = 'lifetime' AND e.revoked_at IS NULL)`
          : ""
      })`;
  return `COALESCE(${subscription(true)}, ${lifetime(true)}, ${subscription(false)},
    ${lifetime(false)})`;
}

/**
 * Portale clienti di Stripe per disdetta, metodo di pagamento e documenti, con il ritorno al
 * piano. Null senza un cliente Stripe dello spazio nell'ambiente corrente.
 */
export async function openBillingPortal(
  env: Env,
  userId: string,
  returnUrl: string,
  language: Language,
): Promise<string | null> {
  const key = stripeSecretKey(env);
  if (!key) return null;
  const row = await env.DB.prepare(`SELECT ${workspaceCustomerSql("wm.workspace_id", "?2")}
      AS customer_id FROM workspace_members wm WHERE wm.user_id = ?1`)
    .bind(userId, stripeEnvironment(env))
    .first<{ customer_id: string | null }>();
  const customer = row?.customer_id;
  if (!customer) return null;
  const stripe = await createStripeClient(key);
  const session = await stripeCall(() =>
    stripe.billingPortal.sessions.create({
      customer,
      return_url: returnUrl,
      locale: language,
    }),
  );
  return session.url;
}

/**
 * Cancellazione dell'account (§30): dopo la conferma nessun nuovo addebito. Gli abbonamenti
 * dello spazio che possono ancora incassare si chiudono subito su Stripe, senza conguaglio né
 * rimborso automatico, e le sessioni lifetime ancora aperte scadono. True quando nulla può più
 * addebitare; false senza chiave, con un errore di Stripe o con un pagamento lifetime ancora in
 * conferma, che non si può fermare: il job conserva i riferimenti minimi, ripete e avvisa.
 */
export async function stopRenewals(
  env: Env,
  workspaceId: string,
  fetcher: typeof fetch = fetch,
  now = new Date(),
): Promise<boolean> {
  const at = now.toISOString();
  const [subscriptions, sessions, checkouts] = await env.DB.batch<{ id: string }>([
    env.DB.prepare(`SELECT id FROM stripe_subscriptions WHERE workspace_id = ?1
        AND environment = ?2 AND unavailable_at IS NULL
        AND status NOT IN ('canceled', 'incomplete_expired')`).bind(
      workspaceId,
      stripeEnvironment(env),
    ),
    env.DB.prepare(`SELECT provider_reference AS id FROM lifetime_allocations
        WHERE workspace_id = ? AND status = 'reserved' AND provider_reference IS NOT NULL`).bind(
      workspaceId,
    ),
    // Sessione di mensile o annuale ancora in grado di incassare.
    env.DB.prepare(`SELECT session_id AS id FROM subscription_checkouts WHERE workspace_id = ?1
        AND session_id IS NOT NULL AND julianday(expires_at) > julianday(?2)`).bind(
      workspaceId,
      at,
    ),
  ]);
  if (!subscriptions!.results.length && !sessions!.results.length && !checkouts!.results.length)
    return true;
  const key = stripeSecretKey(env);
  if (!key) return false;
  try {
    const stripe = await createBoundedStripeClient(key, fetcher);
    const stop = async (id: string) => {
      let status: string;
      try {
        const current = await stripeCall(() => stripe.subscriptions.retrieve(id));
        status = ["canceled", "incomplete_expired"].includes(current.status)
          ? current.status
          : (await stripeCall(() => stripe.subscriptions.cancel(id))).status;
      } catch (error) {
        // Un abbonamento che Stripe non restituisce più non può addebitare.
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
    };
    const close = async (id: string) => {
      const session = await stripeCall(() => stripe.checkout.sessions.retrieve(id));
      if (session.status === "open") await stripeCall(() => stripe.checkout.sessions.expire(id));
      // Scaduta: il posto si libera; pagata: il posto resta con i riferimenti all'acquisto.
      await reconcileLifetime(env, stripe, id, now);
    };
    // Una sessione aperta si chiude; una completata ha creato un abbonamento da fermare.
    const checkout = async (id: string) => {
      const session = await stripeCall(() => stripe.checkout.sessions.retrieve(id));
      if (session.status === "open") await stripeCall(() => stripe.checkout.sessions.expire(id));
      else if (session.subscription) await stop(stripeId(session.subscription));
    };
    await inSequence(
      checkouts!.results.map(({ id }) => id),
      checkout,
    );
    await inSequence(
      subscriptions!.results.map(({ id }) => id),
      stop,
    );
    await inSequence(
      sessions!.results.map(({ id }) => id),
      close,
    );
    const waiting = await env.DB.prepare(`SELECT 1 FROM lifetime_allocations
        WHERE workspace_id = ? AND status = 'reserved' AND provider_reference IS NOT NULL`)
      .bind(workspaceId)
      .first();
    return !waiting;
  } catch (error) {
    logFailure({ error, operation: "billing" });
    return false;
  }
}
