import { Link } from "react-router";

import { Badge } from "~/components/ui/badge";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import type { AbuseSignal } from "../../domain/abuse-review.server";
import type { AuditRow } from "../../domain/admin-audit.server";
import type { ServiceNotice } from "../../domain/service-notices.server";
import { ActionForm, DataTable, Disclosure, Panel, TextField } from "./kit";
import { localValue, useAdmin } from "./use-admin";

/** Oggetto dell'operazione: lo spazio con l'email del titolare e il negozio, se ci sono. */
function AuditTarget({ entry }: { entry: AuditRow }) {
  const { href } = useAdmin();
  if (!entry.workspace && !entry.store)
    return (
      <span className="font-code text-xs break-all text-muted-foreground">{entry.target}</span>
    );
  return (
    <span className="grid gap-0.5">
      {entry.workspace ? (
        <Link
          to={href(`spazi/${encodeURIComponent(entry.workspace.id)}`)}
          className="text-primary underline-offset-4 hover:underline"
        >
          {entry.workspace.email ?? entry.workspace.id}
        </Link>
      ) : null}
      {entry.store ? (
        <span className="text-xs text-muted-foreground">{entry.store.label ?? entry.store.id}</span>
      ) : null}
    </span>
  );
}

function Outcome({ outcome }: { outcome: string }) {
  const { t } = useAdmin();
  const ok = ["done", "prepared", "queued", "merged", "already"].includes(outcome);
  return (
    <Badge variant={ok ? "success" : outcome === "failed" ? "danger" : "neutral"}>
      {t.labels.outcomes[outcome] ?? outcome}
    </Badge>
  );
}

export function AuditTable({ entries }: { entries: AuditRow[] }) {
  const { t, date } = useAdmin();
  const a = t.audit;
  return (
    <DataTable
      label={a.title}
      head={[a.operation, a.at, a.actor, a.target, t.common.reason, a.outcome]}
      rows={entries.map((entry) => ({
        key: entry.id,
        cells: [
          <span key="operation" className="font-medium">
            {t.labels.operations[entry.operation] ?? entry.operation}
          </span>,
          date(entry.at),
          entry.actorEmail ?? entry.actor,
          <AuditTarget key="target" entry={entry} />,
          entry.reason ?? "",
          <Outcome key="outcome" outcome={entry.outcome} />,
        ],
      }))}
    />
  );
}

/** Ultime operazioni in forma compatta, per la panoramica. */
export function AuditList({ entries }: { entries: AuditRow[] }) {
  const { t, date } = useAdmin();
  if (entries.length === 0) return <p className="text-sm text-muted-foreground">{t.common.none}</p>;
  return (
    <ul className="grid divide-y text-sm">
      {entries.map((entry) => (
        <li key={entry.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
          <span className="font-medium">
            {t.labels.operations[entry.operation] ?? entry.operation}
          </span>
          <Outcome outcome={entry.outcome} />
          <span className="text-muted-foreground">{date(entry.at)}</span>
          <span className="basis-full sm:basis-auto">
            <AuditTarget entry={entry} />
          </span>
        </li>
      ))}
    </ul>
  );
}

export function AbuseView({ signals }: { signals: AbuseSignal[] }) {
  const { t, date, href } = useAdmin();
  const a = t.abuse;
  if (signals.length === 0) return <p className="text-muted-foreground">{a.none}</p>;
  return (
    <ul className="grid gap-3">
      {signals.map((signal) => (
        <li key={signal.key}>
          <Panel title={`${a.kinds[signal.kind]}: ${signal.value}`}>
            {signal.review ? (
              <p className="text-sm">
                <Badge variant={signal.review.outcome === "clear" ? "success" : "warning"}>
                  {a.reviewed[signal.review.outcome]}
                </Badge>{" "}
                {date(signal.review.at)}
              </p>
            ) : (
              <Badge variant="warning">{a.toReview}</Badge>
            )}
            <ul className="grid gap-1 text-sm">
              {signal.workspaces.map((workspace) => (
                <li key={workspace.id} className="flex flex-wrap items-center gap-2">
                  <Link
                    to={href(`spazi/${encodeURIComponent(workspace.id)}`)}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    {workspace.email ?? workspace.id}
                  </Link>
                  {workspace.premium ? <Badge variant="premium">{a.paying}</Badge> : null}
                </li>
              ))}
            </ul>
            <div className="grid gap-2">
              <Disclosure label={a.clear}>
                <ActionForm
                  intent="review-abuse"
                  fields={{ segnalazione: signal.key, esito: "clear" }}
                  submit={a.clear}
                  reason
                />
              </Disclosure>
              {signal.workspaces
                .filter((workspace) => !workspace.premium)
                .map((workspace) => (
                  <Disclosure
                    key={workspace.id}
                    label={`${a.suspend} ${workspace.email ?? workspace.id}`}
                  >
                    <ActionForm
                      intent="review-abuse"
                      fields={{
                        segnalazione: signal.key,
                        esito: "suspended",
                        spazio: workspace.id,
                      }}
                      submit={`${a.suspend} ${workspace.email ?? workspace.id}`}
                      destructive
                      reason
                    />
                  </Disclosure>
                ))}
            </div>
          </Panel>
        </li>
      ))}
    </ul>
  );
}

function NoticeFields({ notice }: { notice?: ServiceNotice }) {
  const { t } = useAdmin();
  const n = t.notices;
  const area = (name: string, label: string, value?: string) => (
    <div className="grid gap-1.5">
      <Label htmlFor={`${notice?.id ?? "new"}-${name}`}>{label}</Label>
      <Textarea
        id={`${notice?.id ?? "new"}-${name}`}
        name={name}
        required
        maxLength={1000}
        defaultValue={value}
      />
    </div>
  );
  return (
    <div className="grid gap-3">
      <Label className="grid w-fit gap-1.5">
        {n.toneLabel}
        <select
          name="tono"
          defaultValue={notice?.tone ?? "info"}
          className="h-9 rounded-lg border border-input bg-card px-3 text-sm font-normal"
        >
          <option value="info">{n.tone.info}</option>
          <option value="warning">{n.tone.warning}</option>
        </select>
      </Label>
      <div className="grid gap-3 md:grid-cols-2">
        <TextField
          label={n.titleIt}
          name="titolo_it"
          required
          maxLength={120}
          defaultValue={notice?.titleIt}
        />
        <TextField
          label={n.titleEn}
          name="titolo_en"
          required
          maxLength={120}
          defaultValue={notice?.titleEn}
        />
        {area("testo_it", n.bodyIt, notice?.bodyIt)}
        {area("testo_en", n.bodyEn, notice?.bodyEn)}
        <TextField
          label={n.startsAt}
          name="inizio"
          type="datetime-local"
          required
          defaultValue={localValue(notice?.startsAt ?? null)}
        />
        <TextField
          label={n.endsAt}
          name="fine"
          type="datetime-local"
          required
          defaultValue={localValue(notice?.endsAt ?? null)}
        />
      </div>
    </div>
  );
}

export function NoticesView({ notices, now }: { notices: ServiceNotice[]; now: string }) {
  const { t, date } = useAdmin();
  const n = t.notices;
  const at = Date.parse(now);
  const state = (notice: ServiceNotice) =>
    notice.withdrawnAt
      ? "withdrawn"
      : Date.parse(notice.endsAt) <= at
        ? "ended"
        : Date.parse(notice.startsAt) > at
          ? "scheduled"
          : "active";
  return (
    <>
      <Panel title={n.new}>
        <ActionForm intent="save-notice" submit={t.common.save}>
          <NoticeFields />
        </ActionForm>
      </Panel>
      {notices.map((notice) => {
        const current = state(notice);
        const editable = current === "active" || current === "scheduled";
        return (
          <Panel key={notice.id} title={notice.titleIt}>
            <p className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant={current === "active" ? "success" : "neutral"}>
                {n.state[current]}
              </Badge>
              {date(notice.startsAt)} – {date(notice.endsAt)}
            </p>
            {editable ? (
              <div className="grid gap-4">
                <p className="text-sm text-pretty">{notice.bodyIt}</p>
                <Disclosure label={n.edit}>
                  <ActionForm
                    intent="save-notice"
                    fields={{ comunicazione: notice.id }}
                    submit={t.common.save}
                  >
                    <NoticeFields notice={notice} />
                  </ActionForm>
                </Disclosure>
                <ActionForm
                  intent="withdraw-notice"
                  fields={{ comunicazione: notice.id }}
                  submit={n.withdraw}
                  destructive
                />
              </div>
            ) : (
              <p className="text-sm text-pretty">{notice.bodyIt}</p>
            )}
          </Panel>
        );
      })}
    </>
  );
}
