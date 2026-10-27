import { Link } from "react-router";

import { Badge } from "~/components/ui/badge";
import type { Anomaly, Severity } from "../../domain/admin-operations.server";
import { ActionForm } from "./kit";
import { useAdmin } from "./use-admin";

const severityTone: Record<Severity, "danger" | "warning" | "neutral"> = {
  p1: "danger",
  p2: "warning",
  p3: "neutral",
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  const { t } = useAdmin();
  return <Badge variant={severityTone[severity]}>{t.severity[severity]}</Badge>;
}

/** Azione pertinente all'anomalia, eseguita qui o nel contesto collegato. */
function AnomalyAction({ anomaly }: { anomaly: Anomaly }) {
  const { t, href } = useAdmin();
  const label = t.overview.kinds[anomaly.kind].action;
  if (anomaly.kind === "task_stalled" || anomaly.kind === "receipts_stalled") {
    const intent = anomaly.kind === "task_stalled" ? "requeue-task" : "resume-receipts";
    const field = anomaly.kind === "task_stalled" ? "lavoro" : "provider";
    return (
      <div className="flex flex-wrap gap-4">
        {anomaly.subjects.map((subject) => (
          <ActionForm
            key={subject.id}
            intent={intent}
            fields={{ [field]: subject.id }}
            submit={`${label}: ${subject.label}`}
          />
        ))}
      </div>
    );
  }
  if (
    anomaly.kind === "ebay_quota" ||
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
  return null;
}

export function AnomalyList({ anomalies }: { anomalies: Anomaly[] }) {
  const { t, href, date } = useAdmin();
  if (anomalies.length === 0) return <p className="text-muted-foreground">{t.overview.clear}</p>;
  return (
    <ul className="grid gap-3">
      {anomalies.map((anomaly) => {
        const kind = t.overview.kinds[anomaly.kind];
        return (
          <li key={anomaly.key} className="grid gap-2 rounded-xl border bg-card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <SeverityBadge severity={anomaly.severity} />
              <h2 className="font-semibold">{kind.title}</h2>
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
                      {subject.label}
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
