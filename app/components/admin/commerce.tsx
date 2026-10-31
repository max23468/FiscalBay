import { Link } from "react-router";

import { StatusBadge } from "~/components/status";
import type { SectionData } from "../../admin-console.server";
import { ActionForm, DataTable, Disclosure, Panel, Stat, StatGrid, TextField } from "./kit";
import { localValue, useAdmin } from "./use-admin";

type CommerceData = Extract<SectionData, { section: "commerciale" }>;

function Promotions({ promotions, now }: { promotions: CommerceData["promotions"]; now: string }) {
  const { t, date } = useAdmin();
  const c = t.commerce;
  const fields = (id?: string, startsAt?: string, endsAt?: string | null, quota?: number) => (
    <div className="grid gap-3 sm:grid-cols-3">
      <TextField
        label={c.startsAt}
        name="inizio"
        type="datetime-local"
        required
        defaultValue={localValue(startsAt ?? null)}
      />
      {/* Vuota: la promozione dura finché non si termina. */}
      <TextField
        label={c.endsAt}
        name="fine"
        type="datetime-local"
        defaultValue={localValue(endsAt ?? null)}
      />
      <TextField
        label={c.promoQuota}
        name="quota"
        type="number"
        min={1}
        max={100}
        required
        defaultValue={quota}
        key={id}
      />
    </div>
  );
  return (
    <Panel title={c.promotions}>
      <ul className="grid gap-3">
        {promotions.map((promotion) => {
          const ended = !!promotion.endsAt && Date.parse(promotion.endsAt) <= Date.parse(now);
          return (
            <li key={promotion.id} className="grid gap-3 rounded-lg border p-3">
              <p className="text-sm font-medium">
                {date(promotion.startsAt)} – {promotion.endsAt ? date(promotion.endsAt) : c.noEnd} ·{" "}
                {promotion.quota}
              </p>
              {ended ? null : (
                <div className="grid gap-2">
                  <Disclosure label={c.edit}>
                    <ActionForm
                      intent="save-promotion"
                      fields={{ promozione: promotion.id }}
                      submit={t.common.save}
                      reason
                    >
                      {fields(promotion.id, promotion.startsAt, promotion.endsAt, promotion.quota)}
                    </ActionForm>
                  </Disclosure>
                  <Disclosure label={c.end} destructive>
                    <ActionForm
                      intent="end-promotion"
                      fields={{ promozione: promotion.id }}
                      submit={c.end}
                      destructive
                      reason
                    />
                  </Disclosure>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <Disclosure label={c.newPromotion}>
        <ActionForm intent="save-promotion" submit={t.common.save} reason>
          {fields()}
        </ActionForm>
      </Disclosure>
    </Panel>
  );
}

export function CommerceView({ data, now }: { data: CommerceData; now: string }) {
  const { t, date, money, href } = useAdmin();
  const c = t.commerce;
  const seats = data.seats;
  const payment = (item: CommerceData["revenue"]["payments"][number]) => ({
    key: item.id,
    cells: [
      date(item.paidAt),
      <Link
        key="workspace"
        to={href(`spazi/${encodeURIComponent(item.workspaceId)}`)}
        className="text-primary underline-offset-4 hover:underline"
      >
        {item.ownerEmail ?? item.workspaceId}
      </Link>,
      t.coverage[item.source],
      <span key="paid" className="font-code">
        {money(item.amountPaid, item.currency)}
      </span>,
      item.amountRefunded ? (
        <span key="refunded" className="font-code">
          {money(item.amountRefunded, item.currency)}
        </span>
      ) : (
        ""
      ),
      item.revocation ? t.workspace.revocation[item.revocation] : "",
    ],
  });
  const paymentHead = [
    t.audit.at,
    t.stores.workspace,
    t.workspace.source,
    t.workspace.paid,
    t.workspace.refunded,
    t.workspace.revoked,
  ];
  return (
    <>
      <StatGrid>
        <Stat
          label={t.summary.seats}
          value={seats.available}
          note={t.summary.seatsNote(seats.total)}
        />
        <Stat
          label={c.seats}
          value={seats.sold + seats.gifted}
          note={c.seatsNote(seats.sold, seats.gifted, seats.reserved)}
        />
        <Stat
          label={t.summary.revenue}
          value={money(data.revenue.last30)}
          note={t.summary.revenueNote(money(data.revenue.total))}
        />
        <Stat
          label={c.refundedTotal}
          value={money(data.revenue.refunded)}
          note={c.refundedNote(seats.refunded, seats.regranted)}
          tone={data.revenue.refunded > 0 ? "warning" : undefined}
        />
      </StatGrid>

      <Panel title={c.revenue}>
        <h3 className="text-sm font-medium">{c.reversals}</h3>
        <DataTable head={paymentHead} rows={data.revenue.reversals.map(payment)} numeric={[3, 4]} />
        <h3 className="text-sm font-medium">{c.erasures}</h3>
        <DataTable
          head={[t.audit.at, t.workspace.customer, t.workspace.source, t.workspace.grantedBy]}
          rows={data.revenue.erasures.map((item) => ({
            key: item.customerId,
            cells: [date(item.at), item.customerId, item.source, item.recordedBy ?? ""],
          }))}
        />
        <h3 className="text-sm font-medium">{c.payments}</h3>
        <DataTable head={paymentHead} rows={data.revenue.payments.map(payment)} numeric={[3, 4]} />
      </Panel>

      <Panel title={c.prices}>
        <p className="text-sm text-muted-foreground">{c.generation(data.generation)}</p>
        <DataTable
          head={[t.accounts.plan, t.workspace.paid, t.stores.state]}
          numeric={[1]}
          rows={data.prices.map((price) => ({
            key: price.offer,
            cells: [
              c.offer[price.offer],
              <span key="net" className="font-code">
                {money(price.net)}
              </span>,
              <StatusBadge key="state" tone={price.state === "ok" ? "success" : "warning"}>
                {c.priceState[price.state]}
                {price.mismatch ? ` (${price.mismatch})` : ""}
              </StatusBadge>,
            ],
          }))}
        />
      </Panel>

      <Panel title={c.quota}>
        <p className="text-sm">
          {c.quotaCurrent(data.quota.quota)}
          {data.quota.next
            ? ` · ${c.quotaNext(data.quota.next.quota, date(data.quota.next.effectiveAt))}`
            : ""}
        </p>
        <Disclosure label={c.schedule}>
          <ActionForm intent="schedule-quota" submit={c.schedule} reason>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField
                label={c.quotaValue}
                name="quota"
                type="number"
                min={1}
                max={100}
                required
              />
              <TextField label={c.effectiveAt} name="decorrenza" type="datetime-local" required />
            </div>
          </ActionForm>
        </Disclosure>
      </Panel>

      <Promotions promotions={data.promotions} now={now} />
    </>
  );
}
