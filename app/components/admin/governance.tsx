import { Link } from "react-router";

import { StatusBadge } from "~/components/status";
import { Field, FieldLabel } from "~/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import type { AuditOutcome } from "../../copy/admin-copy";
import type { AbuseSignal } from "../../domain/abuse-review.server";
import type { AuditRow } from "../../domain/admin-audit.server";
import type { ServiceNotice } from "../../domain/service-notices.server";
import { maxNoticeBody, maxNoticeTitle } from "../../limits";
import { ActionForm, DataTable, Disclosure, Panel, TextField } from "./kit";
import { localValue, useAdmin } from "./use-admin";

/** Oggetto dell'operazione: lo spazio con l'email del titolare e il negozio, se ci sono. */
function AuditTarget({ entry }: { entry: AuditRow }) {
  const { href } = useAdmin();
  if (!entry.workspace && !entry.store)
    return (
      <span className="font-code text-xs wrap-anywhere text-muted-foreground">{entry.target}</span>
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
    <StatusBadge
      tone={
        ok
          ? "success"
          : outcome === "failed"
            ? "danger"
            : outcome === "in_progress"
              ? "warning"
              : "neutral"
      }
    >
      {t.labels.outcomes[outcome as AuditOutcome] ?? outcome}
    </StatusBadge>
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
  if (signals.length === 0) return <p className="text-sm text-muted-foreground">{a.none}</p>;
  return (
    <ul className="grid gap-3">
      {signals.map((signal) => (
        <li key={signal.key}>
          <Panel title={`${a.kinds[signal.kind]}: ${signal.current ? signal.value : a.stale}`}>
            {signal.review ? (
              <p className="text-sm">
                <StatusBadge tone={signal.review.outcome === "clear" ? "success" : "warning"}>
                  {a.reviewed[signal.review.outcome]}
                </StatusBadge>{" "}
                {date(signal.review.at)}
              </p>
            ) : (
              <StatusBadge tone="warning">{a.toReview}</StatusBadge>
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
                  {workspace.premium ? <StatusBadge tone="premium">{a.paying}</StatusBadge> : null}
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
                    destructive
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
  const prefix = notice?.id ?? "new";
  const area = (name: string, label: string, value?: string) => (
    <Field>
      <FieldLabel htmlFor={`${prefix}-${name}`}>{label}</FieldLabel>
      <Textarea
        id={`${prefix}-${name}`}
        name={name}
        required
        maxLength={maxNoticeBody}
        defaultValue={value}
      />
    </Field>
  );
  const tones = (["info", "warning"] as const).map((tone) => ({
    value: tone,
    label: n.tone[tone],
  }));
  return (
    <div className="grid gap-3">
      <Field className="w-fit">
        <FieldLabel htmlFor={`${prefix}-tono`}>{n.toneLabel}</FieldLabel>
        <Select items={tones} name="tono" defaultValue={notice?.tone ?? "info"}>
          <SelectTrigger id={`${prefix}-tono`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {tones.map((tone) => (
              <SelectItem key={tone.value} value={tone.value}>
                {tone.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <div className="grid gap-3 md:grid-cols-2">
        <TextField
          label={n.titleIt}
          name="titolo_it"
          required
          maxLength={maxNoticeTitle}
          defaultValue={notice?.titleIt}
        />
        <TextField
          label={n.titleEn}
          name="titolo_en"
          required
          maxLength={maxNoticeTitle}
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
        <ActionForm intent="save-notice" submit={t.common.save} primary>
          <NoticeFields />
        </ActionForm>
      </Panel>
      {notices.map((notice) => {
        const current = state(notice);
        const editable = current === "active" || current === "scheduled";
        return (
          <Panel key={notice.id} title={notice.titleIt}>
            <p className="flex flex-wrap items-center gap-2 text-sm">
              <StatusBadge tone={current === "active" ? "success" : "neutral"}>
                {n.state[current]}
              </StatusBadge>
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
                    primary
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
