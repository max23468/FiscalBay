import { Badge } from "~/components/ui/badge";
import type { AuditRow } from "../../domain/admin-audit.server";
import type { WorkspaceDetail } from "../../domain/admin-directory.server";
import type { StoreStatus } from "../../domain/stores.server";
import { AuditTable } from "./governance";
import { ActionForm, DataTable, Disclosure, Facts, Panel, TextField } from "./kit";
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
          <span className="font-medium">{item.name}</span>
          <Badge
            variant={
              item.connection === "active"
                ? "success"
                : item.connection === "reconnect_required"
                  ? "warning"
                  : "neutral"
            }
          >
            {w.store.connection[item.connection]}
          </Badge>
          {item.pauseReasons.map((reason) => (
            <Badge key={reason} variant="outline">
              {reason}
            </Badge>
          ))}
          {workspace.freeStore?.storeId === item.id && free ? (
            <Badge variant="info">{w.freeStore}</Badge>
          ) : null}
        </div>
        <Facts
          items={[
            ["ID", item.id],
            [w.store.lastSync, item.lastSyncAt ? date(item.lastSyncAt) : w.store.never],
            [t.stores.orders, item.importedOrders],
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
    <Disclosure label={w.store.transfer}>
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

export function WorkspaceView({
  workspace,
  audit,
}: {
  workspace: WorkspaceDetail;
  audit: AuditRow[];
}) {
  const { t, date, money } = useAdmin();
  const w = t.workspace;
  const fields = { spazio: workspace.id };
  return (
    <>
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
      </Panel>

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
          <Disclosure label={w.grantPremium}>
            <ActionForm intent="grant-premium" fields={fields} submit={w.grantPremium} reason>
              <TextField label={w.days} name="giorni" type="number" min={1} max={366} required />
            </ActionForm>
          </Disclosure>
          <Disclosure label={w.grantLifetime}>
            <ActionForm intent="grant-lifetime" fields={fields} submit={w.grantLifetime} reason>
              <p className="text-sm text-muted-foreground">{w.grantLifetimeHint}</p>
            </ActionForm>
          </Disclosure>
        </div>
      </Panel>

      <Panel title={w.subscriptions}>
        <DataTable
          head={["ID", t.accounts.plan, t.stores.state, w.renewsAt]}
          rows={workspace.subscriptions.map((item) => ({
            key: item.id,
            cells: [
              item.id,
              item.offer,
              `${item.status}${item.cancelAtPeriodEnd ? ` · ${w.cancelAtEnd}` : ""}`,
              date(item.periodEnd),
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
                  {customer.id}
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
          head={[w.period, w.grantedBy, w.revoked, ""]}
          rows={workspace.extensions.map((item) => ({
            key: item.id,
            cells: [
              `${w.months(item.months)} · ${date(item.grantedAt, "date")}`,
              `${item.actor}: ${item.reason}`,
              item.revokedAt ? date(item.revokedAt, "date") : "",
              item.revokedAt ? null : (
                <Disclosure key="revoke" label={w.revoke}>
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

      <Stores workspace={workspace} />

      <Panel title={t.audit.title}>
        <AuditTable entries={audit} />
      </Panel>
    </>
  );
}
