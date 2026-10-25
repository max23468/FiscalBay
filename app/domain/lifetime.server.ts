import type Stripe from "stripe";
import { z } from "zod";

import { isProduction } from "../app-links";
import { priceGeneration, type LifetimeOffer, type PremiumOffer } from "../catalog";
import { ApplicationError, logFailure } from "../errors";
import { isMissingObject, stripeRead } from "../integrations/stripe.server";
import type { UpstreamError } from "../integrations/http.server";
import { openSubscriptionStatuses, storeReadSql } from "./grants.server";
import { paymentReversal, reversalStatements } from "./refunds.server";

/**
 * Venti posti lifetime fra vendite e omaggi (D031). Il numero del posto è il vincolo atomico
 * del tetto: una prenotazione occupa il posto più basso libero prima del Checkout, la conferma
 * verificata di Stripe lo rende attivo e soltanto una sessione che non può più incassare lo
 * libera. Un posto attivo, anche rimborsato o di un account cancellato, non torna disponibile.
 */
export const lifetimeSlots = 20;

/**
 * Durata della sessione Checkout e della prenotazione: Stripe accetta da 30 minuti a 24 ore.
 * Un'ora lascia il tempo di pagare senza tenere fermo a lungo uno degli ultimi posti.
 */
const reservationMs = 60 * 60 * 1000;

/**
 * Rinnovo troppo vicino: se arrivasse prima del pagamento, il cliente pagherebbe un nuovo
 * periodo che il credito calcolato oggi non conta.
 */
const renewalMarginMs = 10 * 60 * 1000;

const sqlList = (values: readonly string[]) => values.map((value) => `'${value}'`).join(", ");

const environmentOf = (env: Env) => (isProduction(env) ? "live" : "test");

/** Una chiamata a Stripe alla volta, nell'ordine dato: il turno resta entro i limiti. */
const inSequence = (steps: Array<() => Promise<unknown>>) =>
  steps.reduce<Promise<unknown>>((previous, step) => previous.then(step), Promise.resolve());

/** Primo posto libero, espressione per `INSERT ... SELECT`. */
const freeSlotSql = `WITH RECURSIVE n(slot) AS (SELECT 1 UNION ALL SELECT slot + 1 FROM n
    WHERE slot < ${lifetimeSlots})`;
const freeSlotWhere = "slot NOT IN (SELECT slot FROM lifetime_allocations)";

/** Lifetime in vigore: un rimborso o una disputa persa lo revocano e il posto resta occupato. */
const lifetimeInForceSql = (workspace: string) => `EXISTS (SELECT 1 FROM workspace_entitlements e
  WHERE e.workspace_id = ${workspace} AND e.source = 'lifetime' AND e.revoked_at IS NULL)`;

/**
 * Netto del listino per una periodicità della generazione dell'abbonamento. Null per una
 * generazione che il catalogo non conosce: quando ne arriva una nuova, quella precedente
 * resta nel catalogo finché esistono abbonamenti che la usano.
 */
function generationNet(generation: string, offer: PremiumOffer) {
  return generation === priceGeneration.id ? priceGeneration.net[offer] : null;
}

/**
 * Valore netto del periodo pagato non ancora usato, in centesimi, proporzionale al tempo
 * residuo sull'istante UTC. I giorni di prova e le concessioni non sono periodo pagato.
 */
export function unusedCredit(net: number, period: { startsAt: string; endsAt: string }, now: Date) {
  const start = Date.parse(period.startsAt);
  const end = Date.parse(period.endsAt);
  const at = Math.max(now.getTime(), start);
  if (!(end > start) || at >= end) return 0;
  return Math.floor((net * (end - at)) / (end - start));
}

type LifetimeContext = {
  workspaceId: string;
  offer: LifetimeOffer | null;
  /** Posto dello spazio già prenotato da una sessione precedente, non ancora completata. */
  reservation: { slot: number; reference: string | null } | null;
  /**
   * Abbonamento che il lifetime sostituisce, con il rinnovo se ancora previsto e il cliente
   * Stripe, salvo dopo la cancellazione dei suoi dati finanziari.
   */
  subscription: { customerId: string | null; renewsAt: string | null } | null;
};

/**
 * Stato del lifetime per lo spazio dell'utente. Non si offre con un posto già attivo, con un
 * pagamento lifetime da confermare o con un primo pagamento dell'abbonamento ancora aperto; un
 * abbonamento pagato, scelto durante la prova o con un rinnovo da regolarizzare si sostituisce.
 * Il credito vale soltanto per il periodo pagato in corso, nella generazione dell'abbonamento.
 */
export async function lifetimeContext(
  db: D1Database,
  env: Env,
  userId: string,
  now = new Date(),
): Promise<LifetimeContext | null> {
  const at = now.toISOString();
  const workspace = await db
    .prepare(`SELECT w.id, ${storeReadSql("w.id")} AS synced,
        (SELECT COUNT(*) FROM lifetime_allocations) AS taken,
        a.slot, a.status, a.provider_reference, a.completed_at
      FROM workspaces w JOIN workspace_members wm ON wm.workspace_id = w.id
      LEFT JOIN lifetime_allocations a ON a.workspace_id = w.id
      WHERE wm.user_id = ?1`)
    .bind(userId)
    .first<{
      id: string;
      synced: number;
      taken: number;
      slot: number | null;
      status: "reserved" | "active" | null;
      provider_reference: string | null;
      completed_at: string | null;
    }>();
  if (!workspace) return null;
  const [subscription, paid] = await db.batch<Record<string, unknown>>([
    db
      .prepare(`SELECT CASE WHEN EXISTS (SELECT 1 FROM stripe_customer_erasures r
            WHERE r.customer_id = stripe_subscriptions.customer_id) THEN NULL
          ELSE customer_id END AS customer_id, status, offer, price_generation, current_period_end,
          cancel_at_period_end, status IN (${sqlList(openSubscriptionStatuses)}) AS open
        FROM stripe_subscriptions WHERE workspace_id = ?1 AND environment = ?2
          AND unavailable_at IS NULL
        ORDER BY julianday(current_period_start) DESC LIMIT 1`)
      .bind(workspace.id, environmentOf(env)),
    db
      .prepare(`SELECT starts_at, ends_at FROM workspace_entitlements
        WHERE workspace_id = ?1 AND source = 'premium' AND stripe_invoice_id IS NOT NULL
          AND revoked_at IS NULL AND julianday(starts_at) <= julianday(?2)
          AND julianday(?2) < julianday(ends_at)
        ORDER BY julianday(ends_at) DESC LIMIT 1`)
      .bind(workspace.id, at),
  ]);
  const row = subscription!.results[0] as
    | {
        customer_id: string | null;
        status: string;
        offer: "monthly" | "annual";
        price_generation: string;
        current_period_end: string;
        cancel_at_period_end: number;
        open: number;
      }
    | undefined;
  const period = paid!.results[0] as { starts_at: string; ends_at: string } | undefined;
  const own = workspace.status ? workspace : null;
  const reservation =
    own?.status === "reserved" && !own.completed_at
      ? { slot: own.slot!, reference: own.provider_reference }
      : null;
  // Lo stesso cliente Stripe anche dopo un abbonamento chiuso, con un periodo pagato residuo.
  const context = {
    workspaceId: workspace.id,
    reservation,
    subscription: row
      ? {
          customerId: row.customer_id,
          renewsAt:
            ["active", "trialing"].includes(row.status) && !row.cancel_at_period_end
              ? row.current_period_end
              : null,
        }
      : null,
  };
  // Posto attivo, pagamento lifetime in conferma o primo pagamento dell'abbonamento aperto.
  if ((own && !reservation) || (row && ["incomplete", "paused"].includes(row.status)))
    return { ...context, offer: null };
  const net = row && period ? generationNet(row.price_generation, row.offer) : 0;
  if (net === null) return { ...context, offer: null };
  const credit = period
    ? unusedCredit(net, { startsAt: period.starts_at, endsAt: period.ends_at }, now)
    : 0;
  const state = !workspace.synced
    ? "needs-sync"
    : !reservation && workspace.taken >= lifetimeSlots
      ? "sold-out"
      : "available";
  return { ...context, offer: { state, credit, replaces: !!row?.open } };
}

/**
 * Prenota un posto per una nuova sessione: lo stesso posto dello spazio se ne aveva già uno
 * per una sessione ormai chiusa, altrimenti il primo libero. Restituisce il posto, o null se
 * non ce ne sono o se una richiesta concorrente dello stesso spazio l'ha già preso.
 */
export async function reserveLifetime(
  db: D1Database,
  workspaceId: string,
  reservation: LifetimeContext["reservation"],
  now: Date,
) {
  const at = now.toISOString();
  const expiresAt = new Date(now.getTime() + reservationMs).toISOString();
  const row = reservation
    ? await db
        .prepare(`UPDATE lifetime_allocations SET provider_reference = NULL, expires_at = ?3
          WHERE slot = ?1 AND workspace_id = ?2 AND status = 'reserved' AND completed_at IS NULL
            AND provider_reference IS ?4
          RETURNING slot`)
        .bind(reservation.slot, workspaceId, expiresAt, reservation.reference)
        .first<{ slot: number }>()
    : await db
        .prepare(`${freeSlotSql}
          INSERT INTO lifetime_allocations (slot, workspace_id, status, kind, expires_at, created_at)
          SELECT slot, ?1, 'reserved', 'sale', ?2, ?3 FROM n WHERE ${freeSlotWhere}
          ORDER BY slot LIMIT 1
          ON CONFLICT DO NOTHING RETURNING slot`)
        .bind(workspaceId, expiresAt, at)
        .first<{ slot: number }>();
  return row ? { slot: row.slot, expiresAt } : null;
}

/**
 * Lega la sessione alla prenotazione prima che il suo indirizzo arrivi al cliente: soltanto la
 * sessione registrata può incassare. False se la prenotazione è cambiata nel frattempo.
 */
export async function bindLifetimeSession(
  db: D1Database,
  workspaceId: string,
  reservation: { slot: number; expiresAt: string },
  sessionId: string,
) {
  const result = await db
    .prepare(`UPDATE lifetime_allocations SET provider_reference = ?4
      WHERE slot = ?1 AND workspace_id = ?2 AND status = 'reserved' AND expires_at = ?3
        AND provider_reference IS NULL`)
    .bind(reservation.slot, workspaceId, reservation.expiresAt, sessionId)
    .run();
  return result.meta.changes === 1;
}

/**
 * Libera una prenotazione senza sessione registrata: nessun cliente ne ha ricevuto
 * l'indirizzo, quindi nessuna sessione può incassare per essa.
 */
export async function releaseUnboundReservation(
  db: D1Database,
  workspaceId: string,
  reservation: { slot: number; expiresAt: string },
) {
  await db
    .prepare(`DELETE FROM lifetime_allocations WHERE slot = ?1 AND workspace_id = ?2
      AND status = 'reserved' AND expires_at = ?3 AND provider_reference IS NULL`)
    .bind(reservation.slot, workspaceId, reservation.expiresAt)
    .run();
}

/** Il rinnovo, o il primo addebito, cadrebbe prima della scadenza del checkout lifetime. */
export function renewsDuringCheckout(renewsAt: string | null, now: Date) {
  return !!renewsAt && Date.parse(renewsAt) <= now.getTime() + reservationMs + renewalMarginMs;
}

const lifetimeOwner = z.object({
  workspace_id: z.string().min(1).max(128),
  offer: z.literal("lifetime"),
});

/** Sessione lifetime senza i riferimenti del nostro checkout: nessun effetto. */
class UnknownLifetimeSession extends ApplicationError {
  constructor(readonly failure: string) {
    super("INVALID_REQUEST");
  }
}

/** La sessione completata non può più incassare: pagamento annullato o rifiutato. */
const failedIntentStatuses = ["canceled", "requires_payment_method"];

/** La sessione è una vendita lifetime del nostro checkout. */
export function isLifetimeSession(session: Stripe.Checkout.Session) {
  return session.mode === "payment" && session.metadata?.offer === "lifetime";
}

/**
 * Rilegge una sessione lifetime e ne applica lo stato corrente. Pagata: posto attivo, diritto
 * senza scadenza con la prova dell'incasso e chiusura dell'abbonamento sostituito. Completata
 * con il pagamento in conferma: il posto resta. Scaduta, o con il pagamento asincrono fallito:
 * il posto si libera. Ripetuta produce lo stesso risultato; un pagamento confermato senza
 * posto, dopo una liberazione, occupa il primo libero o, a posti finiti, si segnala senza
 * attribuire il diritto né rimborsare. Un rimborso totale o una disputa persa revocano il
 * diritto e il posto resta occupato.
 */
export async function reconcileLifetime(
  env: Env,
  stripe: Stripe,
  sessionId: string,
  now = new Date(),
) {
  const at = now.toISOString();
  let session: Stripe.Checkout.Session;
  try {
    session = await stripeRead(() =>
      stripe.checkout.sessions.retrieve(sessionId, { expand: ["payment_intent.latest_charge"] }),
    );
  } catch (error) {
    // Una sessione sparita non prova né un incasso né la sua assenza: il posto resta.
    if (!isMissingObject(error as UpstreamError)) throw error;
    logFailure({ error, operation: "billing" });
    return;
  }
  const owner = lifetimeOwner.safeParse(session.metadata);
  if (!owner.success || !isLifetimeSession(session) || session.livemode !== isProduction(env)) {
    logFailure({ error: new UnknownLifetimeSession("unknown_session"), operation: "billing" });
    return;
  }
  const workspaceId = owner.data.workspace_id;
  const intent =
    session.payment_intent && typeof session.payment_intent !== "string"
      ? session.payment_intent
      : null;
  const release = () =>
    env.DB.prepare(
      "DELETE FROM lifetime_allocations WHERE provider_reference = ? AND status = 'reserved'",
    )
      .bind(session.id)
      .run();
  if (session.status === "expired") return void (await release());
  if (session.status === "open") {
    // Oltre la scadenza Stripe la chiude a breve; chiuderla qui libera subito il posto.
    const local = await env.DB.prepare(
      "SELECT expires_at FROM lifetime_allocations WHERE provider_reference = ? AND status = 'reserved'",
    )
      .bind(session.id)
      .first<{ expires_at: string }>();
    if (local && Date.parse(local.expires_at) <= now.getTime()) {
      await stripeRead(() => stripe.checkout.sessions.expire(session.id));
      await release();
    }
    return;
  }
  if (session.payment_status !== "paid") {
    if (intent && failedIntentStatuses.includes(intent.status)) return void (await release());
    // Pagamento asincrono in conferma: il posto resta fino all'esito.
    await env.DB.prepare(`UPDATE lifetime_allocations SET completed_at = COALESCE(completed_at, ?1)
        WHERE provider_reference = ?2 AND status = 'reserved'`)
      .bind(at, session.id)
      .run();
    return;
  }
  const charge =
    intent?.latest_charge && typeof intent.latest_charge !== "string" ? intent.latest_charge : null;
  const reversal = charge ? await paymentReversal(stripe, charge) : null;
  const paidAt = new Date((charge?.created ?? session.created) * 1000).toISOString();
  const customer = session.customer
    ? typeof session.customer === "string"
      ? session.customer
      : session.customer.id
    : null;
  await env.DB.batch([
    env.DB.prepare(`UPDATE lifetime_allocations SET status = 'active', activated_at = ?2,
        customer_id = ?3, completed_at = COALESCE(completed_at, ?2), expires_at = NULL
      WHERE provider_reference = ?1 AND status = 'reserved'`).bind(session.id, at, customer),
    // Pagata dopo una liberazione: occupa il primo posto libero, se lo spazio non ne ha già uno.
    env.DB.prepare(`${freeSlotSql}
      INSERT INTO lifetime_allocations (slot, workspace_id, status, kind, provider_reference,
        customer_id, completed_at, activated_at, created_at)
      SELECT slot, w.id, 'active', 'sale', ?2, ?3, ?4, ?4, ?4 FROM n, workspaces w
      WHERE w.id = ?1 AND ${freeSlotWhere}
        AND NOT EXISTS (SELECT 1 FROM lifetime_allocations WHERE provider_reference = ?2)
        AND NOT EXISTS (SELECT 1 FROM lifetime_allocations WHERE workspace_id = ?1)
      ORDER BY slot LIMIT 1
      ON CONFLICT DO NOTHING`).bind(workspaceId, session.id, customer, at),
    env.DB.prepare(`INSERT INTO workspace_entitlements (id, workspace_id, source, starts_at,
        stripe_checkout_session_id, amount_paid, currency, paid_at)
      SELECT ?1, a.workspace_id, 'lifetime', ?4, ?3, ?5, ?6, ?4 FROM lifetime_allocations a
      WHERE a.provider_reference = ?3 AND a.workspace_id = ?2 AND a.status = 'active'
      ON CONFLICT DO NOTHING`).bind(
      crypto.randomUUID(),
      workspaceId,
      session.id,
      paidAt,
      intent?.amount_received ?? session.amount_total ?? 0,
      intent?.currency ?? session.currency ?? "eur",
    ),
    ...(reversal
      ? reversalStatements(env.DB, "stripe_checkout_session_id", session.id, reversal, at)
      : []),
  ]);
  const granted = await env.DB.prepare(
    "SELECT revoked_at FROM workspace_entitlements WHERE stripe_checkout_session_id = ?",
  )
    .bind(session.id)
    .first<{ revoked_at: string | null }>();
  if (!granted) {
    // Incasso senza posto: lo gestisce l'assistenza, il tetto non cambia.
    logFailure({ error: new UnknownLifetimeSession("lifetime_unallocated"), operation: "billing" });
    return;
  }
  // Rimborsato prima dell'attivazione: l'abbonamento sostituito resta quello in vigore.
  if (!granted.revoked_at) await endReplacedSubscriptions(env, stripe, workspaceId, now);
}

/**
 * Con il lifetime l'abbonamento dello spazio non si rinnova più: si chiude subito, senza
 * conguagli né rimborsi automatici, perché il periodo pagato non usato è già stato detratto. Le
 * coperture già pagate restano fino alla loro fine.
 */
export async function endReplacedSubscriptions(
  env: Env,
  stripe: Stripe,
  workspaceId: string,
  now = new Date(),
) {
  const { results } = await env.DB.prepare(`SELECT id FROM stripe_subscriptions
      WHERE workspace_id = ?1 AND environment = ?2 AND unavailable_at IS NULL
        AND status IN (${sqlList(openSubscriptionStatuses)})`)
    .bind(workspaceId, environmentOf(env))
    .all<{ id: string }>();
  const end = async (id: string) => {
    // Un abbonamento già chiuso su Stripe non si chiude una seconda volta.
    const current = await stripeRead(() => stripe.subscriptions.retrieve(id));
    const canceled = ["canceled", "incomplete_expired"].includes(current.status)
      ? current
      : await stripeRead(() => stripe.subscriptions.cancel(id));
    await env.DB.prepare(`UPDATE stripe_subscriptions SET status = ?1, synced_at = ?2
        WHERE id = ?3 AND julianday(synced_at) <= julianday(?2)`)
      .bind(canceled.status, now.toISOString(), id)
      .run();
  };
  await inSequence(
    results.map(
      ({ id }) =>
        () =>
          end(id),
    ),
  );
}

/** Lifetime venduti riletti per turno, ognuno una volta al giorno. */
const lifetimeChecks = 5;

/**
 * Passo del cron per i posti: prenotazioni scadute o in attesa di un pagamento asincrono si
 * rileggono da Stripe; una prenotazione mai legata a una sessione si libera alla scadenza; un
 * lifetime in vigore con un abbonamento ancora aperto lo chiude; un lifetime venduto e non
 * revocato si rilegge una volta al giorno, per un rimborso o una disputa di cui il webhook non
 * è arrivato. Ogni elemento registra il proprio errore senza fermare gli altri.
 */
export async function reconcileLifetimeReservations(env: Env, stripe: Stripe, now = new Date()) {
  const at = now.toISOString();
  const [, due, replaced, sold] = await env.DB.batch<Record<string, string>>([
    env.DB.prepare(`DELETE FROM lifetime_allocations WHERE status = 'reserved'
        AND provider_reference IS NULL AND julianday(expires_at) <= julianday(?)`).bind(at),
    env.DB.prepare(`SELECT provider_reference FROM lifetime_allocations
        WHERE status = 'reserved' AND provider_reference IS NOT NULL
          AND (julianday(expires_at) <= julianday(?) OR completed_at IS NOT NULL)
        ORDER BY slot`).bind(at),
    env.DB.prepare(`SELECT DISTINCT a.workspace_id
        FROM lifetime_allocations a JOIN stripe_subscriptions s ON s.workspace_id = a.workspace_id
        WHERE a.status = 'active' AND s.environment = ?1 AND s.unavailable_at IS NULL
          AND s.status IN (${sqlList(openSubscriptionStatuses)})
          AND ${lifetimeInForceSql("a.workspace_id")}`).bind(environmentOf(env)),
    env.DB.prepare(`UPDATE lifetime_allocations SET checked_at = ?1 WHERE slot IN (
        SELECT a.slot FROM lifetime_allocations a
        WHERE a.status = 'active' AND a.kind = 'sale'
          AND (a.checked_at IS NULL OR julianday(a.checked_at) <= julianday(?1, '-1 day'))
          AND EXISTS (SELECT 1 FROM workspace_entitlements e
            WHERE e.stripe_checkout_session_id = a.provider_reference AND e.revoked_at IS NULL)
        ORDER BY a.checked_at IS NOT NULL, julianday(a.checked_at), a.slot
        LIMIT ${lifetimeChecks})
      RETURNING provider_reference`).bind(at),
  ]);
  const logged = (step: () => Promise<unknown>) => () =>
    step().catch((error: unknown) => logFailure({ error, operation: "billing" }));
  await inSequence([
    ...due!.results.map(({ provider_reference }) =>
      logged(() => reconcileLifetime(env, stripe, provider_reference!, now)),
    ),
    ...replaced!.results.map(({ workspace_id }) =>
      logged(() => endReplacedSubscriptions(env, stripe, workspace_id!, now)),
    ),
    ...sold!.results.map(({ provider_reference }) =>
      logged(() => reconcileLifetime(env, stripe, provider_reference!, now)),
    ),
  ]);
}

export type LifetimeGrant = "done" | "owned" | "pending" | "sold-out" | "not_found";

/**
 * Lifetime in omaggio, dalla console amministrativa: consuma uno dei venti posti, registra
 * autore e motivo e chiude l'abbonamento dello spazio come un acquisto. Posto e diritto sono
 * un unico commit; uno spazio con una prenotazione aperta aspetta l'esito del suo checkout.
 */
export async function grantLifetime(
  env: Env,
  stripe: Stripe | null,
  input: { workspaceId: string; author: string; reason: string },
  now = new Date(),
): Promise<LifetimeGrant> {
  const at = now.toISOString();
  const [slot] = await env.DB.batch<{ slot: number }>([
    env.DB.prepare(`${freeSlotSql}
      INSERT INTO lifetime_allocations (slot, workspace_id, status, kind, activated_at, created_at)
      SELECT slot, w.id, 'active', 'gift', ?2, ?2 FROM n, workspaces w
      WHERE w.id = ?1 AND ${freeSlotWhere}
        AND NOT EXISTS (SELECT 1 FROM lifetime_allocations WHERE workspace_id = ?1)
      ORDER BY slot LIMIT 1
      ON CONFLICT DO NOTHING RETURNING slot`).bind(input.workspaceId, at),
    env.DB.prepare(`INSERT INTO workspace_entitlements (id, workspace_id, source, starts_at,
        granted_by, grant_reason)
      SELECT ?1, a.workspace_id, 'lifetime', ?3, ?4, ?5 FROM lifetime_allocations a
      WHERE a.workspace_id = ?2 AND a.status = 'active' AND a.kind = 'gift' AND a.activated_at = ?3
      ON CONFLICT DO NOTHING`).bind(
      crypto.randomUUID(),
      input.workspaceId,
      at,
      input.author,
      input.reason,
    ),
  ]);
  if (!slot!.results.length) {
    const row = await env.DB.prepare(`SELECT w.id, a.status,
        (SELECT COUNT(*) FROM lifetime_allocations) AS taken
      FROM workspaces w LEFT JOIN lifetime_allocations a ON a.workspace_id = w.id WHERE w.id = ?`)
      .bind(input.workspaceId)
      .first<{ id: string; status: string | null; taken: number }>();
    if (!row) return "not_found";
    if (row.status) return row.status === "active" ? "owned" : "pending";
    return "sold-out";
  }
  if (stripe)
    await endReplacedSubscriptions(env, stripe, input.workspaceId, now).catch((error: unknown) =>
      // Il cron ripete la chiusura: il diritto concesso resta.
      logFailure({ error, operation: "billing" }),
    );
  return "done";
}
