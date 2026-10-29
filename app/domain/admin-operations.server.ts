import { stalledDeletions } from "./account-deletion.server";
import { stalledEbayDeletions } from "./ebay-account-deletion.server";
import { auditInProgress } from "./admin-audit.server";
import { bulkDataAnomalies, quotaAnomalies } from "./ebay-quotas.server";
import { stalledReceiptMilliseconds, taskPeriods, type ScheduledTask } from "./work-timing";
import { storeLabelSql } from "./store-state.server";

/**
 * Stato operativo per la console (§15): lavori periodici, ricevute dei provider, letture dei
 * negozi, dettagli degli ordini e consegne Telegram. Le anomalie derivano dallo stato corrente e
 * raggruppano le occorrenze della stessa causa: un problema risolto esce dall'elenco al rientro
 * osservato, non per una chiusura manuale. Nessun dato dei buyer o valore fiscale.
 */

export type Severity = "p1" | "p2" | "p3";

export type AnomalyKind =
  | "ebay_quota"
  | "ebay_bulk_data"
  | "ebay_down"
  | "store_reads"
  | "order_details"
  | "task_stalled"
  | "receipts_stalled"
  | "telegram_failed"
  | "ebay_suspended"
  | "service_off"
  | "account_deletion"
  | "audit_unrecorded"
  | "credential_expiry"
  | "credential_undated";

/** Oggetto colpito, con il collegamento al contesto nella console. */
export type AnomalySubject = { id: string; label: string; href: string };

export type Anomaly = {
  key: string;
  kind: AnomalyKind;
  severity: Severity;
  /** Prima occorrenza ancora in corso. */
  since: string;
  /** Occorrenze raggruppate. */
  count: number;
  subjects: AnomalySubject[];
};

export type TaskState = {
  task: ScheduledTask;
  periodMinutes: number;
  slot: string | null;
  queuedAt: string | null;
  doneAt: string | null;
  running: boolean;
  stalled: boolean;
};

export type ReceiptState = {
  provider: "ebay" | "stripe" | "telegram";
  pending: number;
  stalled: number;
  oldest: string | null;
};

const minute = 60_000;

/** Giorni prima della scadenza di una credenziale in cui l'owner riceve l'avviso (§29). */
export const credentialWarningDays = 45;

/** Oltre questa attesa una riga del registro ancora «in corso» non ha ricevuto l'esito. */
const unrecordedAuditMs = 10 * minute;

/** Turno dei compiti periodici: fermo se non concluso oltre due periodi o un'ora dall'accodamento. */
export async function taskStates(db: D1Database, now = new Date()): Promise<TaskState[]> {
  const { results } = await db
    .prepare("SELECT task, slot, queued_at, done_at, locked_until FROM scheduled_tasks")
    .all<{
      task: string;
      slot: string;
      queued_at: string | null;
      done_at: string | null;
      locked_until: string | null;
    }>();
  const rows = new Map(results.map((row) => [row.task, row]));
  const at = now.getTime();
  return (Object.entries(taskPeriods) as [ScheduledTask, number][]).map(([task, period]) => {
    const row = rows.get(task);
    const running = !!row?.locked_until && Date.parse(row.locked_until) > at;
    const behind = !row || Date.parse(row.slot) + 2 * period < at;
    const lost =
      !!row && !row.done_at && !!row.queued_at && Date.parse(row.queued_at) + 60 * minute < at;
    return {
      task,
      periodMinutes: period / minute,
      slot: row?.slot ?? null,
      queuedAt: row?.queued_at ?? null,
      doneAt: row?.done_at ?? null,
      running,
      stalled: !running && (behind || lost),
    };
  });
}

/** Ricevute dei provider non ancora completate e ancora valide, per provider. */
export async function receiptStates(db: D1Database, now = new Date()): Promise<ReceiptState[]> {
  const { results } = await db
    .prepare(`SELECT provider, COUNT(*) AS pending,
        SUM(COALESCE(queued_at, event_at) <= ?2) AS stalled, MIN(event_at) AS oldest
      FROM webhook_receipts WHERE completed_at IS NULL AND expires_at > ?1 GROUP BY provider`)
    .bind(now.toISOString(), new Date(now.getTime() - stalledReceiptMilliseconds).toISOString())
    .all<ReceiptState>();
  const byProvider = new Map(results.map((row) => [row.provider, row]));
  return (["ebay", "stripe", "telegram"] as const).map(
    (provider) => byProvider.get(provider) ?? { provider, pending: 0, stalled: 0, oldest: null },
  );
}

/**
 * Riprova subito i dettagli degli ordini non riusciti di un negozio: la prossima lettura li
 * richiede invece di aspettare l'attesa crescente. Restituisce quanti ne ha anticipati.
 */
export async function retryOrderDetails(db: D1Database, storeId: string, now = new Date()) {
  const result = await db
    .prepare(`UPDATE order_source_refs SET detail_retry_at = ?2
      WHERE store_id = ?1 AND detail_error IS NOT NULL
        AND (detail_retry_at IS NULL OR detail_retry_at > ?2)`)
    .bind(storeId, now.toISOString())
    .run();
  return result.meta.changes;
}

const storeHref = (id: string) => `negozi?q=${encodeURIComponent(id)}`;
const workspaceHref = (id: string) => `spazi/${encodeURIComponent(id)}`;

const severityOrder: Record<Severity, number> = { p1: 0, p2: 1, p3: 2 };

/** Anomalie aperte, dalla più grave e poi dalla più vecchia. */
export async function listAnomalies(db: D1Database, now = new Date()): Promise<Anomaly[]> {
  const at = now.toISOString();
  const [
    { results: failing },
    { results: details },
    { results: telegram },
    { results: limits },
    { results: activeStores },
    { results: switchedOff },
    { results: unrecorded },
    { results: credentials },
  ] = await db.batch<Record<string, string | number | null>>([
    // Negozi attivi con le ultime due letture fallite, come nella campanella del venditore.
    db
      .prepare(`SELECT s.id, ${storeLabelSql("s")} AS label, s.ebay_environment AS environment,
            (SELECT MIN(started_at) FROM (SELECT started_at FROM sync_runs r
              WHERE r.store_id = s.id ORDER BY started_at DESC, id DESC LIMIT 2)) AS since
          FROM ebay_stores s JOIN ebay_store_credentials c ON c.store_id = s.id
          WHERE s.disconnected_at IS NULL AND s.data_deleted_at IS NULL AND c.rejected_at IS NULL
            AND c.refresh_expires_at > ?1
            AND NOT EXISTS (SELECT 1 FROM ebay_store_pauses p WHERE p.store_id = s.id)
            AND 2 = (SELECT COUNT(*) FROM (SELECT ok FROM sync_runs r WHERE r.store_id = s.id
              ORDER BY started_at DESC, id DESC LIMIT 2) WHERE ok = 0)`)
      .bind(at),
    db.prepare(`SELECT s.id, ${storeLabelSql("s")} AS label, COUNT(*) AS count
          FROM order_source_refs r JOIN ebay_stores s ON s.id = r.store_id
          WHERE r.detail_error IS NOT NULL AND s.data_deleted_at IS NULL GROUP BY s.id`),
    db
      .prepare(`SELECT workspace_id AS id, COUNT(*) AS count, MIN(failed_at) AS since
          FROM telegram_deliveries WHERE failed_at IS NOT NULL
            AND julianday(failed_at) > julianday(?1) - 1 GROUP BY workspace_id`)
      .bind(at),
    db.prepare("SELECT api_origin AS id, until FROM ebay_rate_limits WHERE until > ?").bind(at),
    // Negozi attivi già letti almeno una volta, per riconoscere quando eBay non risponde.
    db
      .prepare(`SELECT s.ebay_environment AS environment, COUNT(*) AS count
          FROM ebay_stores s JOIN ebay_store_credentials c ON c.store_id = s.id
          WHERE s.disconnected_at IS NULL AND s.data_deleted_at IS NULL AND c.rejected_at IS NULL
            AND c.refresh_expires_at > ? AND NOT EXISTS (SELECT 1 FROM ebay_store_pauses p
              WHERE p.store_id = s.id)
            AND EXISTS (SELECT 1 FROM sync_runs r WHERE r.store_id = s.id)
          GROUP BY s.ebay_environment`)
      .bind(at),
    // Servizi spenti dalla console: chiamate eBay, invii Telegram e nuovi acquisti.
    db.prepare(`SELECT name AS id, updated_at AS since FROM service_settings
          WHERE name IN ('ebay_calls', 'telegram_sends') AND value = 'false'
        UNION ALL SELECT 'purchases_open', updated_at FROM admission_settings
          WHERE purchases_open = 0`),
    // Operazioni della console partite senza che la loro riga abbia ricevuto l'esito.
    db
      .prepare(`SELECT operation AS id, COUNT(*) AS count, MIN(at) AS since FROM admin_audit
          WHERE outcome = '${auditInProgress}' AND julianday(at) <= julianday(?)
          GROUP BY operation`)
      .bind(new Date(now.getTime() - unrecordedAuditMs).toISOString()),
    // Credenziali del registro in scadenza o già scadute, e voci senza data.
    db
      .prepare(`SELECT name AS id, expires_on AS expires, recorded_at AS recorded,
          julianday(expires_on) <= julianday(?1) AS expired FROM credential_expiries
        WHERE expires_on IS NULL OR julianday(expires_on) - ?2 <= julianday(?1)
        ORDER BY expires_on IS NULL, expires_on, name`)
      .bind(at, credentialWarningDays),
  ]);
  const active = new Map(
    (activeStores as { environment: string; count: number }[]).map((row) => [
      row.environment,
      row.count,
    ]),
  );
  const anomalies: Anomaly[] = [];
  const subject = (row: Record<string, string | number | null>): AnomalySubject => ({
    id: String(row.id),
    label: String(row.label),
    href: storeHref(String(row.id)),
  });

  for (const quota of await quotaAnomalies(db, now))
    if (!quota.resolvedAt)
      anomalies.push({
        key: quota.key,
        kind: "ebay_quota",
        severity: quota.severity,
        since: quota.openedAt,
        count: 1,
        subjects: [{ id: quota.subject, label: quota.subject, href: "quote" }],
      });

  for (const bulk of await bulkDataAnomalies(db, now))
    anomalies.push({
      key: bulk.key,
      kind: "ebay_bulk_data",
      severity: bulk.severity,
      since: bulk.openedAt,
      count: 1,
      subjects: [{ id: bulk.subject, label: bulk.subject, href: "quote" }],
    });

  // Tutti i negozi attivi di un ambiente non si leggono: è eBay, un solo problema.
  for (const environment of ["production", "sandbox"]) {
    const stores = failing.filter((row) => row.environment === environment);
    const total = active.get(environment) ?? 0;
    if (stores.length === 0) continue;
    const since = stores.map((row) => String(row.since)).sort()[0]!;
    anomalies.push(
      stores.length === total && total > 1
        ? {
            key: `ebay_down:${environment}`,
            kind: "ebay_down",
            severity: "p1",
            since,
            count: stores.length,
            subjects: [{ id: environment, label: environment, href: "quote" }],
          }
        : {
            key: `store_reads:${environment}`,
            kind: "store_reads",
            severity: "p2",
            since,
            count: stores.length,
            subjects: stores.map(subject),
          },
    );
  }

  if (details.length > 0)
    anomalies.push({
      key: "order_details",
      kind: "order_details",
      severity: "p3",
      since: at,
      count: details.reduce((total, row) => total + Number(row.count), 0),
      subjects: details.map(subject),
    });

  // Più lavori fermi insieme hanno di solito una sola causa, come il cron che non parte.
  const stalled = (await taskStates(db, now)).filter((task) => task.stalled);
  if (stalled.length > 0)
    anomalies.push({
      key: "task_stalled",
      kind: "task_stalled",
      severity: stalled.some((task) => task.task === "billing" || task.task === "token_refresh")
        ? "p1"
        : "p2",
      since: stalled.map((task) => task.queuedAt ?? task.slot ?? at).sort()[0]!,
      count: stalled.length,
      subjects: stalled.map((task) => ({ id: task.task, label: task.task, href: "lavori" })),
    });

  const delayed = (await receiptStates(db, now)).filter((receipts) => receipts.stalled > 0);
  if (delayed.length > 0)
    anomalies.push({
      key: "receipts_stalled",
      kind: "receipts_stalled",
      severity: delayed.some((receipts) => receipts.provider === "stripe") ? "p1" : "p2",
      since: delayed.map((receipts) => receipts.oldest ?? at).sort()[0]!,
      count: delayed.reduce((total, receipts) => total + receipts.stalled, 0),
      subjects: delayed.map((receipts) => ({
        id: receipts.provider,
        label: receipts.provider,
        href: "lavori",
      })),
    });

  if (telegram.length > 0)
    anomalies.push({
      key: "telegram_failed",
      kind: "telegram_failed",
      severity: "p3",
      since: telegram.map((row) => String(row.since)).sort()[0]!,
      count: telegram.reduce((total, row) => total + Number(row.count), 0),
      subjects: telegram.map((row) => ({
        id: String(row.id),
        label: String(row.id),
        href: workspaceHref(String(row.id)),
      })),
    });

  if (limits.length > 0)
    anomalies.push({
      key: "ebay_suspended",
      kind: "ebay_suspended",
      severity: "p2",
      since: at,
      count: limits.length,
      subjects: limits.map((row) => ({
        id: String(row.id),
        label: String(row.id).replace(/^https:\/\//u, ""),
        href: "quote",
      })),
    });

  if (switchedOff.length > 0)
    anomalies.push({
      key: "service_off",
      kind: "service_off",
      severity: "p2",
      since: switchedOff.map((row) => String(row.since)).sort()[0]!,
      count: switchedOff.length,
      subjects: switchedOff.map((row) => ({
        id: String(row.id),
        label: String(row.id),
        href: "interruttori",
      })),
    });

  // Rinnovi non fermati: un abbonamento di un account cancellato può ancora addebitare. Le
  // cancellazioni richieste da eBay ferme da oltre un'ora si aggiungono come P2.
  const [deletions, ebayDeletions] = await Promise.all([
    stalledDeletions(db, now),
    stalledEbayDeletions(db, now),
  ]);
  if (deletions.length + ebayDeletions.length > 0)
    anomalies.push({
      key: "account_deletion",
      kind: "account_deletion",
      severity: deletions.some((deletion) => deletion.renewals_blocked_at) ? "p1" : "p2",
      since: [...deletions, ...ebayDeletions].map((deletion) => deletion.requested_at).sort()[0]!,
      count: deletions.length + ebayDeletions.length,
      subjects: [
        ...deletions.map((deletion) => ({
          id: deletion.id,
          label: deletion.workspace_id ?? deletion.id,
          href: "lavori",
        })),
        ...ebayDeletions.map((deletion) => ({
          id: deletion.id,
          label: `eBay ${deletion.ebay_environment}`,
          href: "lavori",
        })),
      ],
    });

  if (unrecorded.length > 0)
    anomalies.push({
      key: "audit_unrecorded",
      kind: "audit_unrecorded",
      severity: "p3",
      since: unrecorded.map((row) => String(row.since)).sort()[0]!,
      count: unrecorded.reduce((total, row) => total + Number(row.count), 0),
      subjects: unrecorded.map((row) => ({
        id: String(row.id),
        label: String(row.id),
        href: "registro",
      })),
    });

  // Una credenziale scaduta ferma la funzione che la usa; una in scadenza va rinnovata.
  const expiring = credentials.filter((row) => row.expires !== null);
  if (expiring.length > 0)
    anomalies.push({
      key: "credential_expiry",
      kind: "credential_expiry",
      severity: expiring.some((row) => row.expired) ? "p1" : "p2",
      since: new Date(
        Date.parse(`${String(expiring[0]!.expires)}T00:00:00.000Z`) -
          credentialWarningDays * 24 * 60 * minute,
      ).toISOString(),
      count: expiring.length,
      subjects: expiring.map((row) => ({
        id: String(row.id),
        label: `${String(row.id)} · ${String(row.expires)}`,
        href: "",
      })),
    });

  const undated = credentials.filter((row) => row.expires === null);
  if (undated.length > 0)
    anomalies.push({
      key: "credential_undated",
      kind: "credential_undated",
      severity: "p3",
      since: undated.map((row) => String(row.recorded)).sort()[0]!,
      count: undated.length,
      subjects: undated.map((row) => ({ id: String(row.id), label: String(row.id), href: "" })),
    });

  return anomalies.sort(
    (a, b) =>
      severityOrder[a.severity] - severityOrder[b.severity] || a.since.localeCompare(b.since),
  );
}
