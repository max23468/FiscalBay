import type Stripe from "stripe";

import { exitReasons, isExitReason, maxExitComment, type ExitReason } from "../exit-reasons";
import { dayMilliseconds } from "../time";
import { activeCoverageSql } from "./grants.server";

/**
 * Motivi di uscita (D314): perché un abbonato disdice dal portale Stripe e perché un utente
 * cancella l'account. La disdetta porta `cancellation_details` dell'abbonamento, la
 * cancellazione il motivo scelto nella richiesta, che aspetta la conferma dal link email in
 * `account_deletion_feedback`. Ogni uscita è una riga di `exit_feedback` con la stessa chiave
 * dell'avviso all'owner, che la legge all'invio. Rispondere è sempre facoltativo.
 *
 * Nei primi 30 giorni la riga porta chiave, spazio, commento e istante; poi la pulizia li toglie
 * e resta l'istantanea anonima, con motivo, piano, fascia di anzianità e mese, per 24 mesi. La
 * cancellazione dello spazio toglie subito il commento di una sua disdetta.
 */

export type ExitKind = "cancellation" | "account_deletion";
export type ExitPlan = "free" | "trial" | "monthly" | "annual" | "lifetime" | "granted";
export type Tenure = "under_1" | "1_3" | "3_6" | "6_12" | "over_12";

/** Giorni in cui un'uscita conserva commento, spazio e istante. */
export const exitDetailDays = 30;
/** Mesi dopo cui l'istantanea anonima si elimina. */
export const exitSnapshotMonths = 24;
/** Ore entro cui il motivo della richiesta aspetta la conferma: il link vale un'ora. */
const pendingHours = 24;

/** Opzioni del portale Stripe accettate; le altre contano come «Altro». */
const portalReasons: Record<string, ExitReason> = {
  too_expensive: "too_expensive",
  unused: "unused",
  switched_service: "switched_service",
  missing_features: "missing_features",
  low_quality: "low_quality",
  other: "other",
};

/**
 * Commento ripulito: senza caratteri di controllo e direzioni invisibili, spazi ridotti, al più
 * `maxExitComment` caratteri; vuoto diventa null. Non è un anonimizzatore.
 */
export function normalizeExitComment(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const clean = value
    .replace(/\r\n?/gu, "\n")
    .replace(/[\p{Cc}\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/gu, (char) =>
      char === "\n" ? char : " ",
    )
    .replace(/[^\S\n]+/gu, " ")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
  if (!clean) return null;
  return Array.from(clean).slice(0, maxExitComment).join("").trim();
}

/** Fascia di anzianità dalla creazione dello spazio o dell'account. */
export function tenureBand(since: string | null | undefined, now: Date): Tenure {
  const parsed = since ? Date.parse(since) : Number.NaN;
  const months = Number.isFinite(parsed) ? (now.getTime() - parsed) / (30.44 * dayMilliseconds) : 0;
  if (months < 1) return "under_1";
  if (months < 3) return "1_3";
  if (months < 6) return "3_6";
  if (months < 12) return "6_12";
  return "over_12";
}

/** Mese UTC dell'uscita, `AAAA-MM`. */
export const exitMonth = (now: Date) => now.toISOString().slice(0, 7);

/** Primo mese di una finestra di `months` mesi di calendario che termina con quello corrente. */
function firstMonth(now: Date, months: number) {
  return exitMonth(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1)));
}

/** Piano dalla copertura in vigore e dall'offerta dell'abbonamento. */
function planOf(coverage: string | null, offer: string | null): ExitPlan {
  if (coverage === "trial") return "trial";
  if (coverage === "lifetime") return "lifetime";
  if (coverage === "admin") return "granted";
  if (coverage === "premium") return offer === "annual" ? "annual" : "monthly";
  return "free";
}

const cancellationKeyPrefix = (subscriptionId: string) => `cancel_scheduled:${subscriptionId}:`;

/**
 * Disdetta dal portale, dopo l'aggiornamento dell'abbonamento: la riga nasce soltanto se esiste
 * l'avviso della disdetta, quindi non per le chiusure che FiscalBay programma su un rinnovo non
 * pagato. Una lettura successiva aggiorna motivo e commento senza cancellarli; un abbonamento
 * riattivato toglie l'uscita ancora recente.
 */
export async function recordCancellationFeedback(
  db: D1Database,
  subscription: Pick<
    Stripe.Subscription,
    "id" | "cancel_at_period_end" | "cancel_at" | "status"
  > & {
    cancellation_details?: Pick<
      Stripe.Subscription.CancellationDetails,
      "feedback" | "comment"
    > | null;
  },
  now = new Date(),
) {
  const prefix = cancellationKeyPrefix(subscription.id);
  if (!subscription.cancel_at_period_end && !subscription.cancel_at) {
    await db
      .prepare(`DELETE FROM exit_feedback WHERE kind = 'cancellation'
        AND substr(source_key, 1, length(?1)) = ?1`)
      .bind(prefix)
      .run();
    return;
  }
  const details = subscription.cancellation_details;
  const feedback = details?.feedback ? (portalReasons[details.feedback] ?? "other") : null;
  const row = await db
    .prepare(`SELECT n.key, s.workspace_id AS workspaceId, s.offer, s.status,
        w.created_at AS createdAt
      FROM stripe_subscriptions s
      JOIN owner_notifications n ON n.key = ?1 || s.current_period_end
      JOIN workspaces w ON w.id = s.workspace_id
      WHERE s.id = ?2`)
    .bind(prefix, subscription.id)
    .first<{
      key: string;
      workspaceId: string;
      offer: string;
      status: string;
      createdAt: string;
    }>();
  if (!row) return;
  const plan: ExitPlan =
    row.status === "trialing" ? "trial" : row.offer === "annual" ? "annual" : "monthly";
  await db
    .prepare(`INSERT INTO exit_feedback (id, kind, reason, plan, tenure, month, source_key,
        workspace_id, comment, recorded_at)
      VALUES (?1, 'cancellation', ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
      ON CONFLICT(source_key) DO UPDATE SET reason = COALESCE(excluded.reason, reason),
        comment = COALESCE(excluded.comment, comment)`)
    .bind(
      crypto.randomUUID(),
      feedback,
      plan,
      tenureBand(row.createdAt, now),
      exitMonth(now),
      row.key,
      row.workspaceId,
      normalizeExitComment(details?.comment),
      now.toISOString(),
    )
    .run();
}

/**
 * Motivo scelto nella richiesta di cancellazione: resta in attesa della conferma dal link. Una
 * richiesta senza risposta toglie quella precedente.
 */
export async function saveDeletionFeedback(
  db: D1Database,
  userId: string,
  input: { reason: unknown; comment: unknown },
  now = new Date(),
) {
  const reason = isExitReason(input.reason) ? input.reason : null;
  const comment = normalizeExitComment(input.comment);
  if (!reason && !comment) {
    await db.prepare("DELETE FROM account_deletion_feedback WHERE user_id = ?").bind(userId).run();
    return;
  }
  await db
    .prepare(`INSERT INTO account_deletion_feedback (user_id, reason, comment, recorded_at)
      VALUES (?1, ?2, ?3, ?4) ON CONFLICT(user_id) DO UPDATE SET reason = excluded.reason,
        comment = excluded.comment, recorded_at = excluded.recorded_at`)
    .bind(userId, reason, comment, now.toISOString())
    .run();
}

/**
 * Istruzioni per la conferma della cancellazione, nello stesso commit che registra la richiesta:
 * l'uscita nasce soltanto se la richiesta `deletionId` è stata appena scritta, con il motivo in
 * attesa se c'è, che poi si elimina. Piano e anzianità si leggono prima.
 */
export async function deletionFeedbackStatements(
  db: D1Database,
  deletion: { id: string; userId: string; workspaceId: string | null },
  now = new Date(),
) {
  const at = now.toISOString();
  const context = await db
    .prepare(`SELECT u."createdAt" AS userCreatedAt, w.created_at AS spaceCreatedAt,
        ${activeCoverageSql("source", "w.id", "?3")} AS coverage,
        (SELECT s.offer FROM stripe_subscriptions s WHERE s.workspace_id = w.id
          ORDER BY julianday(s.current_period_end) DESC LIMIT 1) AS offer
      FROM "user" u LEFT JOIN workspaces w ON w.id = ?2 WHERE u."id" = ?1`)
    .bind(deletion.userId, deletion.workspaceId, at)
    .first<{
      userCreatedAt: string | number | null;
      spaceCreatedAt: string | null;
      coverage: string | null;
      offer: string | null;
    }>();
  const userCreated =
    typeof context?.userCreatedAt === "number"
      ? new Date(context.userCreatedAt).toISOString()
      : context?.userCreatedAt;
  return [
    db
      .prepare(`INSERT INTO exit_feedback (id, kind, reason, plan, tenure, month, source_key,
          comment, recorded_at)
        SELECT ?1, 'account_deletion', f.reason, ?2, ?3, ?4, 'account_deleted:' || d.id,
          f.comment, ?5
        FROM account_deletions d
        LEFT JOIN account_deletion_feedback f ON f.user_id = d.user_id
        WHERE d.id = ?6 AND d.user_id = ?7
        ON CONFLICT(source_key) DO NOTHING`)
      .bind(
        crypto.randomUUID(),
        planOf(context?.coverage ?? null, context?.offer ?? null),
        tenureBand(context?.spaceCreatedAt ?? userCreated, now),
        exitMonth(now),
        at,
        deletion.id,
        deletion.userId,
      ),
    db.prepare("DELETE FROM account_deletion_feedback WHERE user_id = ?").bind(deletion.userId),
  ];
}

/**
 * Cancellazione dello spazio: le sue disdette perdono subito commento, spazio e chiave; l'istante
 * resta fino alla pulizia dei 30 giorni, per i conteggi recenti.
 */
export function forgetWorkspaceExits(db: D1Database, workspaceId: string) {
  return db
    .prepare(`UPDATE exit_feedback SET comment = NULL, source_key = NULL, workspace_id = NULL
      WHERE workspace_id = ?`)
    .bind(workspaceId);
}

/** Motivo e commento dell'uscita di un avviso all'owner, se ci sono. */
export async function exitOfNotification(db: D1Database, key: string) {
  return db
    .prepare("SELECT reason, comment FROM exit_feedback WHERE source_key = ?")
    .bind(key)
    .first<{ reason: ExitReason | null; comment: string | null }>();
}

/**
 * Pulizia giornaliera: dettaglio tolto dopo 30 giorni, istantanee eliminate dopo 24 mesi, motivi
 * in attesa di una conferma mai arrivata eliminati dopo un giorno.
 */
export function purgeExitFeedback(db: D1Database, now: Date) {
  const at = now.toISOString();
  return [
    db
      .prepare(`UPDATE exit_feedback SET comment = NULL, source_key = NULL, workspace_id = NULL,
          recorded_at = NULL
        WHERE recorded_at IS NOT NULL AND julianday(recorded_at) < julianday(?1) - ?2`)
      .bind(at, exitDetailDays),
    db
      .prepare("DELETE FROM exit_feedback WHERE month < ?")
      .bind(firstMonth(now, exitSnapshotMonths)),
    db
      .prepare("DELETE FROM account_deletion_feedback WHERE recorded_at < ?")
      .bind(new Date(now.getTime() - pendingHours * 3_600_000).toISOString()),
  ];
}

export type ExitWindow = "days30" | "months3" | "months12";
export type ExitCounts = Record<ExitKind, Record<ExitReason | "none", Record<ExitWindow, number>>>;

/** Uscite recenti con il commento, per console e bot. */
export type RecentExit = {
  id: string;
  kind: ExitKind;
  reason: ExitReason | null;
  plan: ExitPlan;
  comment: string;
  workspaceId: string | null;
  recordedAt: string;
};

/**
 * Uscite per tipo e motivo negli ultimi 30 giorni, negli ultimi tre e dodici mesi di
 * calendario, e commenti dei 30 giorni dal più recente.
 */
export async function exitOverview(db: D1Database, now = new Date()) {
  const at = now.toISOString();
  const [counts, recent] = await db.batch<
    | {
        kind: ExitKind;
        reason: ExitReason | null;
        days30: number;
        months3: number;
        months12: number;
      }
    | RecentExit
  >([
    db
      .prepare(`SELECT kind, reason,
          SUM(recorded_at IS NOT NULL AND julianday(recorded_at) >= julianday(?1) - ?2) AS days30,
          SUM(month >= ?3) AS months3, SUM(month >= ?4) AS months12
        FROM exit_feedback WHERE month >= ?4 GROUP BY kind, reason`)
      .bind(at, exitDetailDays, firstMonth(now, 3), firstMonth(now, 12)),
    db.prepare(`SELECT id, kind, reason, plan, comment, workspace_id AS workspaceId,
          recorded_at AS recordedAt
        FROM exit_feedback WHERE comment IS NOT NULL AND recorded_at IS NOT NULL
        ORDER BY recorded_at DESC LIMIT 50`),
  ]);
  const empty = () =>
    Object.fromEntries(
      [...exitReasons, "none"].map((reason) => [reason, { days30: 0, months3: 0, months12: 0 }]),
    ) as ExitCounts[ExitKind];
  const totals: ExitCounts = { cancellation: empty(), account_deletion: empty() };
  for (const row of counts!.results as Array<{
    kind: ExitKind;
    reason: ExitReason | null;
    days30: number;
    months3: number;
    months12: number;
  }>) {
    totals[row.kind][row.reason ?? "none"] = {
      days30: row.days30,
      months3: row.months3,
      months12: row.months12,
    };
  }
  return { counts: totals, recent: recent!.results as RecentExit[] };
}
