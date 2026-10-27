import { Badge } from "~/components/ui/badge";
import type { ReceiptState, TaskState } from "../../domain/admin-operations.server";
import type { EnvironmentQuotas, QuotaAnomaly } from "../../domain/ebay-quotas.server";
import { SeverityBadge } from "./overview";
import { ActionForm, DataTable, Panel } from "./kit";
import { useAdmin } from "./use-admin";

export function JobsView({ tasks, receipts }: { tasks: TaskState[]; receipts: ReceiptState[] }) {
  const { t, date } = useAdmin();
  const j = t.jobs;
  return (
    <>
      <Panel title={j.tasks}>
        <DataTable
          head={[j.task, j.slot, t.stores.state, ""]}
          rows={tasks.map((task) => ({
            key: task.task,
            cells: [
              <div key="task" className="grid gap-0.5">
                <span className="font-medium">{task.task}</span>
                <span className="text-xs text-muted-foreground">{j.every(task.periodMinutes)}</span>
              </div>,
              task.slot ? date(task.slot) : "",
              task.running ? (
                <Badge variant="info">{j.running}</Badge>
              ) : task.stalled ? (
                <Badge variant="warning">{j.stalled}</Badge>
              ) : task.doneAt ? (
                <Badge variant="success">
                  {j.done} {date(task.doneAt)}
                </Badge>
              ) : (
                <Badge variant="neutral">{j.waiting}</Badge>
              ),
              task.running || task.doneAt ? null : (
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
              receipt.provider,
              receipt.pending,
              receipt.stalled,
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
                <span className="font-medium">{anomaly.subject}</span>
                <span>{percent(anomaly.share)}</span>
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
      {quotas.map((environment) => (
        <Panel key={environment.environment} title={q.environment[environment.environment]}>
          {environment.read === "failed" ? (
            <p role="alert" className="text-sm text-danger">
              {q.failed}
            </p>
          ) : (
            <DataTable
              head={[q.api, q.call, q.limit, q.used, q.remaining, q.reset]}
              rows={environment.rows.map((row) => ({
                key: `${row.api}:${row.resource}`,
                cells: [
                  row.api,
                  <div key="call" className="flex flex-wrap items-center gap-2">
                    <span className={row.used ? "font-medium" : undefined}>{row.resource}</span>
                    {row.over ? <Badge variant="warning">{q.over}</Badge> : null}
                  </div>,
                  `${row.rate.limit} (${q.window(row.rate.windowSeconds)})`,
                  `${row.rate.used} · ${percent(row.share)}`,
                  row.rate.remaining,
                  row.rate.resetAt ? date(row.rate.resetAt) : "",
                ],
              }))}
            />
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
      ))}
    </>
  );
}
