import { cn } from "cn";
import { CircleCheck, TriangleAlert } from "lucide-react";
import { Link } from "react-router";

import { StatusBadge } from "~/components/status";
import type { SectionData } from "../../admin-console.server";
import type { AdminCopy } from "../../copy/admin-copy";
import type { Anomaly, Severity } from "../../domain/admin-operations.server";
import { AuditList } from "./governance";
import { ActionForm, Panel, Stat, StatGrid } from "./kit";
import { useAdmin } from "./use-admin";

const severityTone: Record<Severity, "danger" | "warning" | "neutral"> = {
  p1: "danger",
  p2: "warning",
  p3: "neutral",
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  const { t } = useAdmin();
  return <StatusBadge tone={severityTone[severity]}>{t.severity[severity]}</StatusBadge>;
}

/** Nome leggibile dell'oggetto: lavoro, provider, quota o operazione al posto del codice. */
function subjectName(id: string, kind: Anomaly["kind"], t: AdminCopy) {
  if (kind === "task_stalled")
    return t.labels.tasks[id as keyof AdminCopy["labels"]["tasks"]] ?? id;
  if (kind === "receipts_stalled")
    return t.labels.providers[id as keyof AdminCopy["labels"]["providers"]] ?? id;
  if (kind === "ebay_quota" || kind === "ebay_down")
    return id
      .replace("production", "Production")
      .replace("sandbox", "Sandbox")
      .replaceAll(":", " · ");
  if (kind === "service_off")
    return t.switches.names[id as keyof AdminCopy["switches"]["names"]] ?? id;
  if (kind === "audit_unrecorded") return t.labels.operations[id] ?? id;
  return id;
}

/** Azione pertinente all'anomalia, eseguita qui o nel contesto collegato. */
function AnomalyAction({ anomaly }: { anomaly: Anomaly }) {
  const { t, href } = useAdmin();
  const label = t.overview.kinds[anomaly.kind].action;
  if (anomaly.kind === "task_stalled" || anomaly.kind === "receipts_stalled") {
    const intent = anomaly.kind === "task_stalled" ? "requeue-task" : "resume-receipts";
    const field = anomaly.kind === "task_stalled" ? "lavoro" : "provider";
    return (
      <div className="grid gap-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        <div className="flex flex-wrap gap-2">
          {anomaly.subjects.map((subject) => (
            <ActionForm
              key={subject.id}
              intent={intent}
              fields={{ [field]: subject.id }}
              submit={subjectName(subject.id, anomaly.kind, t)}
            />
          ))}
        </div>
      </div>
    );
  }
  if (
    anomaly.kind === "ebay_quota" ||
    anomaly.kind === "ebay_bulk_data" ||
    anomaly.kind === "ebay_down" ||
    anomaly.kind === "ebay_suspended"
  )
    return (
      <Link
        to={href("quote")}
        className="text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        {label}
      </Link>
    );
  if (anomaly.kind === "service_off")
    return (
      <Link
        to={href("interruttori")}
        className="text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        {label}
      </Link>
    );
  return null;
}

export function AnomalyList({ anomalies }: { anomalies: Anomaly[] }) {
  const { t, href, date } = useAdmin();
  return (
    <ul className="grid gap-3">
      {anomalies.map((anomaly) => {
        const kind = t.overview.kinds[anomaly.kind];
        return (
          <li key={anomaly.key} className="grid gap-2 rounded-lg border bg-card p-3 sm:p-4">
            <div className="flex flex-wrap items-center gap-2">
              <SeverityBadge severity={anomaly.severity} />
              <h3 className="font-semibold">{kind.title}</h3>
              <span className="text-sm text-muted-foreground">
                {t.overview.count(anomaly.count)} · {t.overview.since(date(anomaly.since))}
              </span>
            </div>
            <p className="text-sm text-pretty">{kind.consequence}</p>
            {anomaly.kind === "task_stalled" || anomaly.kind === "receipts_stalled" ? null : (
              <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {anomaly.subjects.map((subject) => (
                  <li key={subject.id}>
                    <Link
                      to={href(subject.href)}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {subjectName(subject.label, anomaly.kind, t)}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <AnomalyAction anomaly={anomaly} />
          </li>
        );
      })}
    </ul>
  );
}

type OverviewData = Extract<SectionData, { section: "panoramica" }>;

/**
 * Panoramica: prima lo stato, con le anomalie aperte, poi i numeri chiave che portano alle
 * sezioni e le ultime operazioni del registro.
 */
export function Overview({ data }: { data: OverviewData }) {
  const { t, href, money } = useAdmin();
  const s = t.summary;
  const { anomalies, summary } = data;
  const urgent = anomalies.some((anomaly) => anomaly.severity === "p1");
  const covered = summary.coverage.premium + summary.coverage.lifetime + summary.coverage.trial;
  return (
    <>
      <section
        aria-labelledby="admin-status"
        className={cn(
          "grid gap-3 rounded-xl border p-4 sm:p-5",
          anomalies.length === 0
            ? "border-success/30 bg-success-surface"
            : urgent
              ? "border-danger/30 bg-danger-surface"
              : "border-warning/30 bg-warning-surface",
        )}
      >
        <h2 id="admin-status" className="flex items-center gap-2 text-lg font-semibold">
          {anomalies.length === 0 ? (
            <CircleCheck aria-hidden="true" className="size-5 text-success" />
          ) : (
            <TriangleAlert
              aria-hidden="true"
              className={cn("size-5", urgent ? "text-danger" : "text-warning")}
            />
          )}
          {anomalies.length === 0 ? s.ok : s.issues(anomalies.length)}
        </h2>
        {anomalies.length > 0 ? <AnomalyList anomalies={anomalies} /> : null}
      </section>
      <StatGrid wide={3}>
        <Stat
          label={s.accounts}
          value={summary.users}
          note={summary.waitlisted > 0 ? s.waitlisted(summary.waitlisted) : undefined}
          href={href("account")}
        />
        <Stat
          label={s.paid}
          value={covered + summary.coverage.admin}
          note={s.paidNote(
            summary.coverage.premium,
            summary.coverage.lifetime,
            summary.coverage.trial,
            summary.coverage.admin,
          )}
          href={href("account")}
        />
        <Stat
          label={s.stores}
          value={summary.stores.active}
          note={s.storeProblems(summary.stores.problems)}
          tone={summary.stores.problems > 0 ? "warning" : undefined}
          href={href(summary.stores.problems > 0 ? "negozi?problemi=1" : "negozi")}
        />
        <Stat
          label={s.revenue}
          value={money(data.revenue.last30)}
          note={s.revenueNote(money(data.revenue.total))}
          href={href("commerciale")}
        />
        <Stat
          label={s.seats}
          value={data.seats.available}
          note={s.seatsNote(data.seats.total)}
          href={href("commerciale")}
        />
        <Stat
          label={s.jobs}
          value={`${data.tasks.regular}/${data.tasks.total}`}
          note={s.jobsNote(data.tasks.total - data.tasks.regular)}
          tone={data.tasks.regular < data.tasks.total ? "warning" : undefined}
          href={href("lavori")}
        />
      </StatGrid>
      <Panel title={s.recent}>
        <AuditList entries={data.recent} />
        <Link
          to={href("registro")}
          className="w-fit text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          {s.openAudit}
        </Link>
      </Panel>
    </>
  );
}
