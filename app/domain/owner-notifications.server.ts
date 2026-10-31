import { originUrl } from "../app-links";
import { adminCopy } from "../copy/admin-copy";
import { ownerTelegramCopy as copy } from "../copy/owner-telegram";
import { logFailure } from "../errors";
import { untilStopped } from "../sequence";
import { formatAmount } from "../i18n";
import { ownerChatId, telegramConfigured } from "../integrations/telegram.server";
import { activeCoverageSql } from "./grants.server";
import { at, ownerRetryMs, sendPanel, type Panel, type Row } from "./owner-panels.server";

/**
 * Avvisi commerciali all'owner (§15, D219): registrazioni, ammissioni, primo negozio, prove,
 * acquisti, disdette, rinnovi non pagati, rimborsi, dispute, cancellazioni finanziarie, posti
 * lifetime e cancellazioni dell'account. I fatti arrivano in `owner_notifications` dai trigger
 * delle tabelle che li registrano, con una chiave univoca per fatto: webhook ripetuti, la
 * riconciliazione oraria e scritture concorrenti non producono doppioni. Qui si aggiungono le
 * prove concluse, che non hanno una scrittura propria, e la disputa aperta.
 *
 * L'invio è seriale, al più dieci messaggi per turno: ogni avviso si prende con un claim, così
 * due turni sovrapposti non lo inviano due volte. Cinque tentativi con attese crescenti fino a
 * sei ore; il primo invio fallito ferma gli altri fino al turno successivo, come per gli
 * incidenti. Nei messaggi soltanto piano, importi e istanti: lo spazio si apre dalla console.
 */

export type NotificationKind =
  | "registered"
  | "admitted"
  | "store_linked"
  | "trial_started"
  | "trial_ended"
  | "purchase"
  | "cancel_scheduled"
  | "renewal_unpaid"
  | "subscription_closed"
  | "refund"
  | "dispute_opened"
  | "dispute_lost"
  | "financial_erasure"
  | "lifetime_seats"
  | "account_deleted";

/** Avvisi per turno: il resto parte al turno successivo. */
const perRun = 10;
/** Tentativi prima di rinunciare a un avviso. */
export const maxAttempts = 5;
/** Un claim più vecchio appartiene a un turno interrotto e si riprende. */
const claimMs = 15 * 60_000;
/** Giorni dopo cui la pulizia giornaliera elimina gli avvisi, inviati o no. */
export const notificationRetentionDays = 30;
/**
 * Prove concluse rilette a ogni turno: due giorni coprono un cron fermo a lungo, e la chiave
 * impedisce che una prova già avvisata lo sia di nuovo.
 */
const trialWindowDays = 2;

type Detail = {
  waitlisted?: number;
  since?: string;
  ends?: string;
  purchased?: number;
  offer?: "monthly" | "annual" | "lifetime";
  amount?: number;
  currency?: string;
  refunded?: number;
  paid?: number | null;
  unpaid?: number;
  origin?: "webhook" | "support";
  left?: number;
  total?: number;
};

type NotificationRow = {
  key: string;
  kind: NotificationKind;
  workspace_id: string | null;
  detail: string;
  occurred_at: string;
  attempts: number;
  claim_token: string;
};

/** Spazio dell'avviso letto all'invio: niente nomi né email, soltanto stato e conteggi. */
type Space = { createdAt: string; stores: number; coverage: string | null };

const t = adminCopy.it;
const n = copy.notifications;

/** Prove concluse di recente, con o senza un acquisto dopo il loro inizio. */
export async function recordEndedTrials(db: D1Database, now = new Date()) {
  await db
    .prepare(`INSERT INTO owner_notifications (key, kind, workspace_id, detail, occurred_at)
      SELECT 'trial_ended:' || t.id, 'trial_ended', t.workspace_id,
        json_object('purchased', EXISTS (SELECT 1 FROM workspace_funnel_steps m
          WHERE m.workspace_id = t.workspace_id AND m.step = 'purchase'
            AND julianday(m.occurred_at) >= julianday(t.starts_at))),
        COALESCE(t.revoked_at, t.ends_at)
      FROM workspace_entitlements t WHERE t.source = 'trial'
        AND julianday(COALESCE(t.revoked_at, t.ends_at)) <= julianday(?1)
        AND julianday(COALESCE(t.revoked_at, t.ends_at)) > julianday(?1) - ?2
      ON CONFLICT(key) DO NOTHING`)
    .bind(now.toISOString(), trialWindowDays)
    .run();
}

/**
 * Disputa aperta su un pagamento di uno spazio di questo ambiente: Stripe la gestisce e nulla
 * cambia nei diritti, quindi non ha una riga propria. Un pagamento estraneo, o senza un
 * abbonamento o un lifetime, non avvisa.
 */
export async function recordDisputeOpened(
  db: D1Database,
  disputeId: string,
  target: { subscription: string } | { lifetime: string } | { erasure: string } | null,
  now = new Date(),
) {
  if (!target || "erasure" in target) return;
  const source =
    "subscription" in target
      ? db
          .prepare("SELECT workspace_id, offer FROM stripe_subscriptions WHERE id = ?")
          .bind(target.subscription)
      : db
          .prepare(`SELECT workspace_id, 'lifetime' AS offer FROM lifetime_allocations
            WHERE provider_reference = ? AND workspace_id IS NOT NULL`)
          .bind(target.lifetime);
  const row = await source.first<{ workspace_id: string; offer: string }>();
  if (!row) return;
  await db
    .prepare(`INSERT INTO owner_notifications (key, kind, workspace_id, detail, occurred_at)
      SELECT ?1, 'dispute_opened', id, json_object('offer', ?3), ?4 FROM workspaces WHERE id = ?2
      ON CONFLICT(key) DO NOTHING`)
    .bind(`dispute_opened:${disputeId}`, row.workspace_id, row.offer, now.toISOString())
    .run();
}

const amount = (minor: number | null | undefined, currency: string | undefined) =>
  minor !== null && minor !== undefined && currency
    ? formatAmount(minor, currency.toUpperCase(), "it")
    : "n.d.";

const offerName = (offer: Detail["offer"]) => (offer ? t.commerce.offer[offer] : "n.d.");

/** Righe della sezione commerciale, per avviso. */
function commerceRows(kind: NotificationKind, detail: Detail, occurredAt: string): Row[] {
  switch (kind) {
    case "registered":
      return [
        [n.labels.registeredAt, at(occurredAt)],
        [n.labels.waitlist, detail.waitlisted ? n.yes : n.no],
      ];
    case "admitted":
      return [
        [n.labels.waitingSince, at(detail.since)],
        [n.labels.admittedAt, at(occurredAt)],
      ];
    case "store_linked":
      return [[n.labels.linkedAt, at(occurredAt)]];
    case "trial_started":
      return [
        [n.labels.startedAt, at(occurredAt)],
        [n.labels.endsAt, at(detail.ends)],
      ];
    case "trial_ended":
      return [
        [n.labels.endedAt, at(occurredAt)],
        [n.labels.outcome, detail.purchased ? n.withPurchase : n.withoutPurchase],
      ];
    case "purchase":
      return [
        [n.labels.plan, offerName(detail.offer)],
        [n.labels.amount, amount(detail.amount, detail.currency)],
        [n.labels.paidAt, at(occurredAt)],
      ];
    case "cancel_scheduled":
      return [
        [n.labels.plan, offerName(detail.offer)],
        [n.labels.coveredUntil, at(detail.ends)],
      ];
    case "renewal_unpaid":
      return [
        [n.labels.plan, offerName(detail.offer)],
        [n.labels.since, at(occurredAt)],
      ];
    case "subscription_closed":
      return [
        [n.labels.plan, offerName(detail.offer)],
        [n.labels.reason, detail.unpaid ? n.closedUnpaid : n.closedCancelled],
      ];
    case "refund": {
      const total =
        detail.paid !== null && detail.paid !== undefined && (detail.refunded ?? 0) >= detail.paid;
      return [
        [n.labels.plan, offerName(detail.offer)],
        [n.labels.refunded, amount(detail.refunded, detail.currency)],
        [n.labels.paid, amount(detail.paid, detail.currency)],
        [n.labels.outcome, total ? n.refundTotal : n.refundPartial],
      ];
    }
    case "dispute_opened":
      return [
        [n.labels.plan, offerName(detail.offer)],
        [n.labels.outcome, n.disputeOpen],
      ];
    case "dispute_lost":
      return [
        [n.labels.plan, offerName(detail.offer)],
        [n.labels.paid, amount(detail.paid, detail.currency)],
        [n.labels.outcome, n.disputeLost],
      ];
    case "financial_erasure":
      return [[n.labels.origin, detail.origin === "support" ? n.fromSupport : n.fromLink]];
    case "lifetime_seats":
      return [[n.labels.seatsLeft, copy.lifetimeLeft(detail.left ?? 0, detail.total ?? 0)]];
    case "account_deleted":
      return [
        [n.labels.requestedAt, at(occurredAt)],
        [n.labels.paidCoverage, detail.paid ? n.yes : n.no],
      ];
  }
}

/** Titolo con l'icona dell'avviso; i posti esauriti hanno il proprio. */
function title(kind: NotificationKind, detail: Detail) {
  if (kind === "lifetime_seats" && detail.left === 0) return n.titles.lifetime_sold_out;
  return n.titles[kind];
}

export function notificationPanel(env: Env, row: NotificationRow, space: Space | null): Panel {
  const detail = JSON.parse(row.detail) as Detail;
  const href = row.workspace_id
    ? `/admin/spazi/${encodeURIComponent(row.workspace_id)}`
    : row.kind === "lifetime_seats"
      ? "/admin/commerciale"
      : "/admin/account";
  return {
    title: title(row.kind, detail),
    sections: [
      ...(space
        ? [
            {
              title: n.space,
              rows: [
                [n.labels.openedAt, at(space.createdAt)],
                [copy.stores, String(space.stores)],
                [
                  n.labels.coverage,
                  t.coverage[(space.coverage ?? "free") as keyof typeof t.coverage],
                ],
              ] satisfies Row[],
            },
          ]
        : []),
      { title: n.commerce, rows: commerceRows(row.kind, detail, row.occurred_at) },
    ],
    buttons: [[{ text: copy.openConsole, url: originUrl(env, href) }]],
  };
}

async function spaceOf(db: D1Database, workspaceId: string | null, now: Date) {
  if (!workspaceId) return null;
  return db
    .prepare(`SELECT w.created_at AS createdAt,
        (SELECT COUNT(*) FROM ebay_stores s WHERE s.workspace_id = w.id
          AND s.disconnected_at IS NULL AND s.data_deleted_at IS NULL) AS stores,
        ${activeCoverageSql("source", "w.id", "?2")} AS coverage
      FROM workspaces w WHERE w.id = ?1`)
    .bind(workspaceId, now.toISOString())
    .first<Space>();
}

/**
 * Prende il prossimo avviso dovuto: nuovo, da ritentare o rimasto in un turno interrotto. Un
 * avviso interrotto che ha già esaurito i tentativi passa fra quelli non riusciti.
 */
async function claim(db: D1Database, now: Date) {
  const time = now.toISOString();
  const stale = new Date(now.getTime() - claimMs).toISOString();
  await db
    .prepare(`UPDATE owner_notifications SET status = 'failed', claim_token = NULL,
        claimed_at = NULL WHERE status = 'processing' AND claimed_at <= ?1 AND attempts >= ?2`)
    .bind(stale, maxAttempts)
    .run();
  return db
    .prepare(`UPDATE owner_notifications SET status = 'processing', claim_token = ?1,
        claimed_at = ?2, attempts = attempts + 1
      WHERE key = (SELECT key FROM owner_notifications
        WHERE attempts < ?4 AND ((status = 'pending' AND (retry_at IS NULL OR retry_at <= ?2))
          OR (status = 'processing' AND claimed_at <= ?3))
        ORDER BY rowid LIMIT 1)
      RETURNING key, kind, workspace_id, detail, occurred_at, attempts, claim_token`)
    .bind(crypto.randomUUID(), time, stale, maxAttempts)
    .first<NotificationRow>();
}

/** Invia gli avvisi dovuti, uno alla volta. Restituisce quanti sono partiti. */
export async function deliverOwnerNotifications(env: Env, fetcher: typeof fetch, now = new Date()) {
  if (!telegramConfigured(env) || !ownerChatId(env)) return 0;
  const db = env.DB;
  const chatId = ownerChatId(env)!;
  let sent = 0;
  // Fino a `perRun` avvisi; il primo invio non riuscito ferma gli altri fino al turno successivo.
  await untilStopped(Array.from({ length: perRun }), async () => {
    const row = await claim(db, now);
    if (!row) return "stop";
    try {
      await sendPanel(
        env,
        chatId,
        notificationPanel(env, row, await spaceOf(db, row.workspace_id, now)),
        now,
        fetcher,
      );
    } catch (error) {
      await db
        .prepare(`UPDATE owner_notifications SET status = ?3, retry_at = ?4, claim_token = NULL,
            claimed_at = NULL WHERE key = ?1 AND claim_token = ?2`)
        .bind(
          row.key,
          row.claim_token,
          row.attempts >= maxAttempts ? "failed" : "pending",
          new Date(now.getTime() + ownerRetryMs(row.attempts, error)).toISOString(),
        )
        .run();
      logFailure({ error, operation: "owner_notifications" });
      return "stop";
    }
    await db
      .prepare(`UPDATE owner_notifications SET status = 'sent', sent_at = ?3, claim_token = NULL,
          claimed_at = NULL, retry_at = NULL WHERE key = ?1 AND claim_token = ?2`)
      .bind(row.key, row.claim_token, now.toISOString())
      .run();
    sent += 1;
    return "continue";
  });
  return sent;
}

/** Turno degli avvisi commerciali: prove concluse, poi invio. */
export async function runOwnerNotifications(env: Env, fetcher: typeof fetch, now = new Date()) {
  await recordEndedTrials(env.DB, now);
  return deliverOwnerNotifications(env, fetcher, now);
}
