import { cn } from "cn";

import { Badge } from "~/components/ui/badge";
import type { AdminCopy } from "../../copy/admin-copy";
import type { ReceiptState, TaskState } from "../../domain/admin-operations.server";
import type { EnvironmentQuotas, QuotaAnomaly, QuotaRow } from "../../domain/ebay-quotas.server";
import { SeverityBadge } from "./overview";
import { ActionForm, DataTable, Disclosure, Panel } from "./kit";
import { useAdmin } from "./use-admin";

export function JobsView({ tasks, receipts }: { tasks: TaskState[]; receipts: ReceiptState[] }) {
  const { t, date } = useAdmin();
  const j = t.jobs;
  return (
    <>
      <Panel title={j.tasks}>
        <DataTable
          head={[j.task, t.stores.state, j.slot, ""]}
          rows={tasks.map((task) => ({
            key: task.task,
            cells: [
              <span key="task" className="grid gap-0.5">
                <span className="font-medium">{t.labels.tasks[task.task]}</span>
                <span className="text-xs text-muted-foreground">{j.every(task.periodMinutes)}</span>
              </span>,
              task.running ? (
                <Badge key="state" variant="info">
                  {j.running}
                </Badge>
              ) : task.stalled ? (
                <Badge key="state" variant="warning">
                  {j.stalled}
                </Badge>
              ) : task.doneAt ? (
                <Badge key="state" variant="success">
                  {j.done} {date(task.doneAt)}
                </Badge>
              ) : (
                <Badge key="state" variant="neutral">
                  {j.waiting}
                </Badge>
              ),
              task.slot ? date(task.slot) : "",
              // Un lavoro fermo si riaccoda anche se l'ultimo turno, ormai vecchio, è concluso.
              task.running || (task.doneAt && !task.stalled) ? null : (
                <ActionForm
                  key="requeue"
                  intent="requeue-task"
                  fields={{ lavoro: task.task }}
                  submit={j.requeue}
                />
              ),
            ],
          }))}
        />
      </Panel>
      <Panel title={j.receipts}>
        <DataTable
          head={[j.provider, j.pending, j.stalledCount, j.oldest, ""]}
          rows={receipts.map((receipt) => ({
            key: receipt.provider,
            cells: [
              <span key="provider" className="font-medium">
                {t.labels.providers[receipt.provider]}
              </span>,
              receipt.pending,
              receipt.stalled > 0 ? (
                <span key="stalled" className="text-warning">
                  {receipt.stalled}
                </span>
              ) : (
                0
              ),
              receipt.oldest ? date(receipt.oldest) : "",
              receipt.stalled > 0 ? (
                <ActionForm
                  key="resume"
                  intent="resume-receipts"
                  fields={{ provider: receipt.provider }}
                  submit={j.resume}
                />
              ) : null,
            ],
          }))}
        />
      </Panel>
    </>
  );
}

/** Barra del consumo della quota, ambra oltre la soglia. */
function Usage({ row, t }: { row: QuotaRow; t: AdminCopy }) {
  const { percent } = useAdmin();
  return (
    <span className="grid min-w-32 gap-1">
      <span className={cn("font-code", row.over && "text-warning")}>{percent(row.share)}</span>
      <span aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-muted">
        <span
          className={cn("block h-full rounded-full", row.over ? "bg-warning" : "bg-primary")}
          style={{ width: `${Math.min(100, Math.round(row.share * 100))}%` }}
        />
      </span>
      {row.rate.consumed > row.rate.used ? (
        <span className="text-xs text-muted-foreground">{t.quotas.shared(row.rate.used)}</span>
      ) : null}
    </span>
  );
}

function QuotaTable({ rows }: { rows: QuotaRow[] }) {
  const { t, date } = useAdmin();
  const q = t.quotas;
  return (
    <DataTable
      head={[q.call, q.used, q.remaining, q.limit, q.reset]}
      rows={rows.map((row) => ({
        key: `${row.api}:${row.resource}`,
        cells: [
          <span key="call" className="grid gap-0.5">
            <span className="font-medium break-all">{row.resource}</span>
            <span className="text-xs text-muted-foreground">{row.api}</span>
          </span>,
          <Usage key="usage" row={row} t={t} />,
          <span key="remaining" className="font-code">
            {row.rate.remaining}
          </span>,
          <span key="limit" className="font-code">
            {row.rate.limit} · {q.window(row.rate.windowSeconds)}
          </span>,
          row.rate.resetAt ? date(row.rate.resetAt) : "",
        ],
      }))}
    />
  );
}

export function QuotasView({
  quotas,
  anomalies,
}: {
  quotas: EnvironmentQuotas[];
  anomalies: QuotaAnomaly[];
}) {
  const { t, date, percent } = useAdmin();
  const q = t.quotas;
  return (
    <>
      {anomalies.length > 0 ? (
        <Panel title={q.anomalies}>
          <ul className="grid gap-2 text-sm">
            {anomalies.map((anomaly) => (
              <li key={anomaly.key} className="flex flex-wrap items-center gap-2">
                <SeverityBadge severity={anomaly.severity} />
                <span className="font-medium">
                  {anomaly.subject
                    .replace("production", "Production")
                    .replace("sandbox", "Sandbox")
                    .replaceAll(":", " · ")}
                </span>
                <span className="font-code">{percent(anomaly.share)}</span>
                <span className="text-muted-foreground">
                  {anomaly.resolvedAt
                    ? q.resolved(date(anomaly.resolvedAt))
                    : t.overview.since(date(anomaly.openedAt))}
                </span>
              </li>
            ))}
          </ul>
          {anomalies.some((anomaly) => !anomaly.resolvedAt) ? (
            <p className="text-sm">{q.request}</p>
          ) : null}
        </Panel>
      ) : null}
      {quotas.map((environment) => {
        const used = environment.rows.filter((row) => row.used);
        const others = environment.rows.filter((row) => !row.used);
        return (
          <Panel key={environment.environment} title={q.environment[environment.environment]}>
            {environment.read === "failed" ? (
              <p role="alert" className="text-sm text-danger">
                {q.failed}
              </p>
            ) : (
              <>
                <QuotaTable rows={used} />
                {others.length > 0 ? (
                  <Disclosure label={q.otherCalls(others.length)}>
                    <QuotaTable rows={others} />
                  </Disclosure>
                ) : null}
              </>
            )}
            <div className="grid gap-1">
              <h3 className="text-sm font-medium">{q.suspended}</h3>
              {environment.suspended.length === 0 ? (
                <p className="text-sm text-muted-foreground">{q.noneSuspended}</p>
              ) : (
                <ul className="grid gap-1 text-sm">
                  {environment.suspended.map((item) => (
                    <li key={item.call ?? "all"}>
                      {item.call ?? q.allCalls} · {q.until(date(item.until))}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Panel>
        );
      })}
    </>
  );
}
