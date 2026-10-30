import { CirclePause } from "lucide-react";

import { StatusBadge } from "~/components/status";
import type { AuditRow } from "../../domain/admin-audit.server";
import type { WorkspaceDetail } from "../../domain/admin-directory.server";
import type { StoreStatus } from "../../domain/stores.server";
import { AuditTable } from "./governance";
import { ActionForm, DataTable, Disclosure, Facts, Panel, Stat, StatGrid, TextField } from "./kit";
import { useAdmin } from "./use-admin";

function Stores({ workspace }: { workspace: WorkspaceDetail }) {
  const { t, date } = useAdmin();
  const w = t.workspace;
  const free = !workspace.coverage;
  const store = (item: StoreStatus) => {
    const fields = { negozio: item.id, spazio: workspace.id };
    const adminPaused = item.pauseReasons.includes("admin");
    return (
      <li key={item.id} className="grid gap-3 rounded-lg border p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium break-words">{item.name}</span>
          <StatusBadge
            tone={
              item.connection === "active"
                ? "success"
                : item.connection === "reconnect_required"
                  ? "warning"
                  : "neutral"
            }
          >
            {w.store.connection[item.connection]}
          </StatusBadge>
          {item.pauseReasons.map((reason) => (
            <StatusBadge key={reason} tone="neutral" icon={CirclePause}>
              {t.labels.pause[reason]}
            </StatusBadge>
          ))}
          {workspace.freeStore?.storeId === item.id && free ? (
            <StatusBadge tone="info">{w.freeStore}</StatusBadge>
          ) : null}
        </div>
        <Facts
          items={[
            [w.store.lastSync, item.lastSyncAt ? date(item.lastSyncAt) : w.store.never],
            [t.stores.orders, item.importedOrders],
            ...(item.consentExpiresAt
              ? ([[w.store.consentUntil, date(item.consentExpiresAt, "date")]] as [
                  string,
                  string,
                ][])
              : []),
            [
              "ID",
              <span key="id" className="font-code text-xs wrap-anywhere">
                {item.id}
              </span>,
            ],
          ]}
        />
        <div className="flex flex-wrap gap-3">
          {item.connection === "active" ? (
            <ActionForm intent="store-sync" fields={fields} submit={w.store.sync} />
          ) : null}
          <ActionForm intent="retry-details" fields={fields} submit={w.store.retryDetails} />
        </div>
        <div className="grid gap-2">
          <Disclosure
            key={adminPaused ? "resume" : "pause"}
            label={adminPaused ? w.store.resume : w.store.pause}
            destructive={!adminPaused}
          >
            <ActionForm
              intent={adminPaused ? "store-resume" : "store-pause"}
              fields={fields}
              submit={adminPaused ? w.store.resume : w.store.pause}
              destructive={!adminPaused}
              reason
            />
          </Disclosure>
          {free &&
          item.ebayEnvironment === "production" &&
          workspace.freeStore?.storeId !== item.id ? (
            <Disclosure label={w.store.freeStore}>
              <ActionForm intent="free-store" fields={fields} submit={w.store.freeStore} reason />
            </Disclosure>
          ) : null}
          <Transfer fields={fields} />
        </div>
      </li>
    );
  };
  return (
    <Panel title={w.stores}>
      {workspace.stores.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.common.none}</p>
      ) : (
        <ul className="grid gap-3">{workspace.stores.map(store)}</ul>
      )}
      {workspace.removedStores.length > 0 ? (
        <div className="grid gap-2">
          <h3 className="text-sm font-medium">{w.removedStores}</h3>
          <ul className="grid gap-3">
            {workspace.removedStores.map((item) => (
              <li key={item.id} className="grid gap-2 rounded-lg border p-3">
                <span className="text-sm">
                  {item.label} · {item.id}
                </span>
                <Transfer fields={{ negozio: item.id, spazio: workspace.id }} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Panel>
  );
}

/** Trasferimento in due passi: preparazione con lo stato riletto, poi conferma unica. */
function Transfer({ fields }: { fields: Record<string, string> }) {
  const { t } = useAdmin();
  const w = t.workspace;
  return (
    <Disclosure label={w.store.transfer} destructive>
      <ActionForm
        intent="transfer-prepare"
        fields={fields}
        submit={w.transferPrepare}
        destructive
        reason
        onResult={(result) =>
          result.transfer ? (
            <div className="grid gap-2 rounded-lg bg-warning-surface p-3">
              <p className="text-sm text-pretty">{result.transfer.summary}</p>
              <ActionForm
                intent="transfer-confirm"
                fields={{ trasferimento: result.transfer.id }}
                submit={w.transferConfirm}
                destructive
              />
            </div>
          ) : null
        }
      >
        <TextField label={w.transferTo} name="destinazione" required maxLength={128} />
      </ActionForm>
    </Disclosure>
  );
}

/** Numeri chiave dello spazio: piano con la sua fine, negozi, sblocchi del ciclo e abbonamento. */
function WorkspaceSummary({ workspace, now }: { workspace: WorkspaceDetail; now: string }) {
  const { t, date } = useAdmin();
  const w = t.workspace;
  const at = Date.parse(now);
  // Copertura in corso dell'origine mostrata, per la sua fine.
  const coverage = workspace.coverage
    ? workspace.entitlements.find(
        (item) =>
          item.source === workspace.coverage &&
          !item.revokedAt &&
          Date.parse(item.startsAt) <= at &&
          (!item.endsAt || Date.parse(item.endsAt) > at),
      )
    : undefined;
  const activeStores = workspace.stores.filter((store) => store.connection === "active").length;
  const openSubscription = workspace.subscriptions.find(
    (item) => !item.unavailable && item.status !== "canceled",
  );
  return (
    <StatGrid>
      <Stat
        label={t.accounts.plan}
        value={t.coverage[workspace.coverage ?? "free"]}
        note={
          coverage?.endsAt
            ? w.until(date(coverage.endsAt, "date"))
            : workspace.coverage === "lifetime" && workspace.lifetime
              ? w.lifetimeSeat(workspace.lifetime.slot, workspace.lifetime.kind)
              : undefined
        }
      />
      <Stat
        label={w.stores}
        value={workspace.stores.length}
        note={w.activeStores(activeStores)}
        tone={activeStores < workspace.stores.length ? "warning" : undefined}
      />
      <Stat
        label={w.unlocks}
        value={
          workspace.cycle && !workspace.coverage
            ? `${workspace.cycle.used}/${workspace.cycle.quota}`
            : "–"
        }
        note={
          workspace.cycle && !workspace.coverage
            ? w.cycleUntil(date(workspace.cycle.endsAt, "date"))
            : w.unlimited
        }
      />
      <Stat
        label={w.subscriptions}
        value={
          openSubscription
            ? (t.labels.subscription[openSubscription.status] ?? openSubscription.status)
            : "–"
        }
        note={
          openSubscription
            ? `${t.commerce.offer[openSubscription.offer as "monthly" | "annual"] ?? openSubscription.offer} · ${w.renewsAt} ${date(openSubscription.periodEnd, "date")}`
            : undefined
        }
      />
    </StatGrid>
  );
}

export function WorkspaceView({
  workspace,
  audit,
  now,
}: {
  workspace: WorkspaceDetail;
  audit: AuditRow[];
  now: string;
}) {
  const { t, date, money } = useAdmin();
  const w = t.workspace;
  const fields = { spazio: workspace.id };
  return (
    <>
      <WorkspaceSummary workspace={workspace} now={now} />

      <Stores workspace={workspace} />

      <Panel title={w.entitlements}>
        <DataTable
          head={[w.source, w.period, w.paid, w.revoked, w.grantedBy]}
          rows={workspace.entitlements.map((item) => ({
            key: item.id,
            cells: [
              t.coverage[item.source],
              `${date(item.startsAt, "date")} – ${item.endsAt ? date(item.endsAt, "date") : "∞"}`,
              item.amountPaid === null
                ? ""
                : `${money(item.amountPaid, item.currency ?? "eur")}${
                    item.amountRefunded
                      ? ` · ${w.refunded} ${money(item.amountRefunded, item.currency ?? "eur")}`
                      : ""
                  }`,
              item.revokedAt
                ? `${date(item.revokedAt, "date")}${item.revocation ? ` (${w.revocation[item.revocation]})` : ""}`
                : "",
              item.grantedBy ? `${item.grantedBy}: ${item.reason ?? ""}` : "",
            ],
          }))}
        />
        <div className="grid gap-2">
          <Disclosure label={w.grantPremium} destructive>
            <ActionForm intent="grant-premium" fields={fields} submit={w.grantPremium} reason>
              <TextField label={w.days} name="giorni" type="number" min={1} max={366} required />
            </ActionForm>
          </Disclosure>
          <Disclosure label={w.grantLifetime} destructive>
            <ActionForm intent="grant-lifetime" fields={fields} submit={w.grantLifetime} reason>
              <p className="text-sm text-muted-foreground">{w.grantLifetimeHint}</p>
              {workspace.vacantSeats.length > 0 ? (
                <>
                  <Facts
                    items={[
                      [
                        w.vacantSeats,
                        workspace.vacantSeats
                          .map(
                            (seat) =>
                              `${w.lifetimeSeat(seat.slot, seat.kind)}${seat.customerId ? ` · ${seat.customerId}` : ""}${seat.activatedAt ? ` · ${date(seat.activatedAt, "date")}` : ""}`,
                          )
                          .join("; "),
                      ],
                    ]}
                  />
                  <TextField
                    label={w.vacantSeat}
                    name="posto"
                    type="number"
                    min={1}
                    max={20}
                    aria-describedby={undefined}
                  />
                  <p className="text-sm text-muted-foreground">{w.vacantSeatHint}</p>
                </>
              ) : null}
            </ActionForm>
          </Disclosure>
        </div>
      </Panel>

      <Panel title={w.subscriptions}>
        <DataTable
          head={[t.accounts.plan, t.stores.state, w.renewsAt, "ID"]}
          rows={workspace.subscriptions.map((item) => ({
            key: item.id,
            cells: [
              t.commerce.offer[item.offer as "monthly" | "annual"] ?? item.offer,
              `${t.labels.subscription[item.status] ?? item.status}${item.cancelAtPeriodEnd ? ` · ${w.cancelAtEnd}` : ""}`,
              date(item.periodEnd),
              <span key="id" className="font-code text-xs wrap-anywhere">
                {item.id}
              </span>,
            ],
          }))}
        />
        {workspace.lifetime ? (
          <p className="text-sm">
            {w.lifetimeSeat(workspace.lifetime.slot, workspace.lifetime.kind)}
          </p>
        ) : null}
        {workspace.customers.length > 0 ? (
          <div className="grid gap-2">
            <h3 className="text-sm font-medium">{w.customers}</h3>
            <ul className="grid gap-1 text-sm">
              {workspace.customers.map((customer) => (
                <li key={customer.id}>
                  <span className="font-code text-xs">{customer.id}</span>
                  {customer.erased
                    ? ` · ${w.erased(customer.erased.source, date(customer.erased.at))}`
                    : ""}
                </li>
              ))}
            </ul>
            {workspace.customers.some((customer) => !customer.erased) ? (
              <Disclosure label={w.erasure}>
                <ActionForm intent="record-erasure" fields={fields} submit={w.erasure} reason>
                  <p className="text-sm text-muted-foreground">{w.erasureHint}</p>
                  <TextField label={w.customer} name="cliente" required maxLength={128} />
                </ActionForm>
              </Disclosure>
            ) : null}
          </div>
        ) : null}
      </Panel>

      <Panel title={w.extensions}>
        <DataTable
          head={[w.period, w.grantedBy, w.revoked, t.workspace.actions]}
          rows={workspace.extensions.map((item) => ({
            key: item.id,
            cells: [
              `${w.months(item.months)} · ${date(item.grantedAt, "date")}`,
              `${item.actor}: ${item.reason}`,
              item.revokedAt ? date(item.revokedAt, "date") : "",
              item.revokedAt ? null : (
                <Disclosure key="revoke" label={w.revoke} destructive>
                  <ActionForm
                    intent="revoke-history"
                    fields={{ ...fields, estensione: item.id }}
                    submit={w.revoke}
                    destructive
                    reason
                  />
                </Disclosure>
              ),
            ],
          }))}
        />
        <Disclosure label={w.grantHistory}>
          <ActionForm intent="grant-history" fields={fields} submit={w.grantHistory} reason>
            <TextField label={w.monthsLabel} name="mesi" type="number" min={13} max={24} required />
          </ActionForm>
        </Disclosure>
      </Panel>

      <Panel title={w.profile}>
        <Facts
          items={[
            ["ID", workspace.id],
            [t.accounts.created, date(workspace.createdAt, "date")],
            [t.accounts.plan, t.coverage[workspace.coverage ?? "free"]],
            [
              w.members,
              workspace.members.map((member) => `${member.email} (${member.role})`).join(", "),
            ],
            ...(workspace.profile
              ? ([
                  [
                    w.profile,
                    `${workspace.profile.accountType === "business" ? w.business : w.private}${
                      workspace.profile.company ? ` · ${workspace.profile.company}` : ""
                    }`,
                  ],
                ] as [string, string][])
              : []),
            ...(workspace.profile?.waitlistedAt
              ? ([[t.accounts.waitlisted, date(workspace.profile.waitlistedAt)]] as [
                  string,
                  string,
                ][])
              : []),
            ...(workspace.cycle && !workspace.coverage
              ? ([
                  [
                    w.cycle,
                    w.cycleValue(
                      workspace.cycle.used,
                      workspace.cycle.quota,
                      date(workspace.cycle.endsAt),
                    ),
                  ],
                ] as [string, string][])
              : []),
          ]}
        />
        {workspace.profile?.waitlistedAt ? (
          <Disclosure label={t.switches.admit}>
            <ActionForm
              intent="admit-waitlisted"
              fields={{ spazio: workspace.id }}
              submit={t.switches.admit}
              reason
            />
          </Disclosure>
        ) : null}
      </Panel>

      <Panel title={t.audit.title}>
        <AuditTable entries={audit} />
      </Panel>
    </>
  );
}
