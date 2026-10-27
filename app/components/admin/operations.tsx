import { cn } from "cn";

import { Badge } from "~/components/ui/badge";
import type { AdminCopy } from "../../copy/admin-copy";
import type { ReceiptState, TaskState } from "../../domain/admin-operations.server";
import type { EnvironmentQuotas, QuotaAnomaly, QuotaRow } from "../../domain/ebay-quotas.server";
import type { TechnicalMetrics } from "../../domain/technical-metrics.server";
import { locales } from "../../i18n";
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
          head={[j.task, t.stores.state, j.slot, t.workspace.actions]}
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
          head={[j.provider, j.pending, j.stalledCount, j.oldest, t.workspace.actions]}
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

/** Nome da un elenco della console; un valore fuori elenco resta com'è scritto nel dataset. */
const named = (names: Record<string, string>, value: string) => names[value] ?? value;

export function MetricsView({ metrics }: { metrics: TechnicalMetrics }) {
  const { t, language } = useAdmin();
  const m = t.metrics;
  // Stime e durate in millisecondi, intere come le misure del browser.
  const whole = (value: number) => Math.round(value).toLocaleString(locales[language]);
  const count = (value: number) => <span className="font-code">{whole(value)}</span>;
  /** Quantili 75 e 95 di una misura del browser; un trattino quando nessun report la porta. */
  const pair = (value: { p75: number | null; p95: number | null }) =>
    value.p75 === null || value.p95 === null ? (
      "–"
    ) : (
      <span className="font-code whitespace-nowrap">
        {whole(value.p75)} / {whole(value.p95)}
      </span>
    );
  if (metrics.read !== "ok")
    return (
      <Panel title={m.invocations}>
        <p role="alert" className={cn("text-sm", metrics.read === "failed" && "text-danger")}>
          {metrics.read === "failed" ? m.failed : m.unconfigured}
        </p>
      </Panel>
    );
  return (
    <>
      <p className="text-sm text-muted-foreground">{m.estimate(metrics.windowHours)}</p>
      <Panel title={m.invocations}>
        <DataTable
          head={[m.kind, m.method, m.outcome, m.count, m.mean, "p50", "p95", "p99"]}
          rows={metrics.invocations.map((row) => ({
            key: `${row.invocation}:${row.detail}:${row.method}:${row.outcome}`,
            cells: [
              <span key="kind" className="grid gap-0.5">
                <span className="font-medium">{named(m.detail, row.detail)}</span>
                <span className="text-xs text-muted-foreground">
                  {named(m.invocation, row.invocation)}
                </span>
              </span>,
              row.method,
              <span key="outcome" className="font-code">
                {row.outcome}
              </span>,
              count(row.count),
              count(row.meanMs),
              count(row.p50Ms),
              count(row.p95Ms),
              count(row.p99Ms),
            ],
          }))}
        />
      </Panel>
      <Panel title={m.phases}>
        <DataTable
          head={[m.phase, m.outcome, m.calls, m.perInvocation, m.mean, "p50", "p95", "p99"]}
          rows={metrics.phases.map((row) => ({
            key: `${row.invocation}:${row.phase}:${row.operation}:${row.outcome}`,
            cells: [
              <span key="phase" className="grid gap-0.5">
                <span className="font-medium">
                  {named(m.phaseName, row.phase)} · {row.operation}
                </span>
                <span className="text-xs text-muted-foreground">
                  {named(m.invocation, row.invocation)}
                </span>
              </span>,
              <span key="outcome" className="font-code">
                {row.outcome}
              </span>,
              count(row.calls),
              count(row.invocations),
              count(row.meanMs),
              count(row.p50Ms),
              count(row.p95Ms),
              count(row.p99Ms),
            ],
          }))}
        />
      </Panel>
      <Panel title={m.pages}>
        <DataTable
          head={[
            m.page,
            m.reports,
            `TTFB ${m.quantiles}`,
            `FCP ${m.quantiles}`,
            `LCP ${m.quantiles}`,
            `${m.ready} ${m.quantiles}`,
            m.server,
          ]}
          rows={metrics.pages.map((row) => ({
            key: row.page,
            cells: [
              <span key="page" className="font-medium">
                {named(m.pageName, row.page)}
              </span>,
              count(row.reports),
              pair(row.measures.ttfb),
              pair(row.measures.fcp),
              pair(row.measures.lcp),
              pair(row.measures.ready),
              <span key="server" className="grid gap-0.5">
                {(["auth", "d1", "ebay", "render"] as const).map((phase) => (
                  <span key={phase} className="whitespace-nowrap">
                    {m.phaseName[phase]} {pair(row.measures[`server_${phase}`])}
                  </span>
                ))}
              </span>,
            ],
          }))}
        />
      </Panel>
    </>
  );
}
