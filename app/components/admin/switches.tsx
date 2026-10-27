import { Link } from "react-router";

import { Badge } from "~/components/ui/badge";
import type { SectionData } from "../../admin-console.server";
import type { SettingState } from "../../domain/service-settings.server";
import { ActionForm, DataTable, Disclosure, Panel, TextField } from "./kit";
import { useAdmin } from "./use-admin";

type SwitchesData = Extract<SectionData, { section: "interruttori" }>;

type SwitchKey = "free_waitlist" | "purchases_open" | "ebay_calls" | "telegram_sends";

/** Stato normale del servizio: soltanto la lista d'attesa è spenta di norma. */
const normal: Record<SwitchKey, boolean> = {
  free_waitlist: false,
  purchases_open: true,
  ebay_calls: true,
  telegram_sends: true,
};

/** Un interruttore: stato, da quando vale e l'operazione opposta con il motivo. */
function SwitchRow({ name, state }: { name: SwitchKey; state: SettingState<boolean> }) {
  const { t, date } = useAdmin();
  const s = t.switches;
  const usual = state.value === normal[name];
  const next = !state.value;
  return (
    <li className="grid gap-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{s.names[name]}</span>
        <Badge variant={usual ? "success" : "warning"}>{state.value ? s.on : s.off}</Badge>
        <span className="text-sm text-muted-foreground">
          {state.since ? s.since(date(state.since)) : s.fallback}
        </span>
      </div>
      {/* A stato cambiato il modulo riparte chiuso: il motivo non passa all'operazione opposta. */}
      <Disclosure key={String(state.value)} label={next ? s.turnOn : s.turnOff}>
        <ActionForm
          intent="set-switch"
          fields={{ interruttore: name, stato: next ? "on" : "off" }}
          submit={next ? s.turnOn : s.turnOff}
          destructive={next !== normal[name]}
          reason
        >
          <p className="text-sm text-pretty text-muted-foreground">{s.hints[name]}</p>
        </ActionForm>
      </Disclosure>
    </li>
  );
}

/**
 * Interruttori dei servizi, ammissione e soglie (§15, §32). Ogni cambio chiede il motivo, vale
 * subito e resta nel registro.
 */
export function SwitchesView({ data }: { data: SwitchesData }) {
  const { t, date, href } = useAdmin();
  const s = t.switches;
  return (
    <>
      <Panel title={s.services}>
        <ul className="grid gap-3">
          <SwitchRow name="ebay_calls" state={data.ebay} />
          <SwitchRow name="telegram_sends" state={data.telegram} />
          <SwitchRow name="purchases_open" state={data.purchases} />
        </ul>
      </Panel>

      <Panel title={s.admission}>
        <ul className="grid gap-3">
          <SwitchRow name="free_waitlist" state={data.waitlist} />
        </ul>
        <h3 className="text-sm font-medium">{s.waiting}</h3>
        {data.waitingTotal > data.waiting.length ? (
          <p className="text-sm text-muted-foreground">{s.waitingMore(data.waitingTotal)}</p>
        ) : null}
        <DataTable
          head={[t.accounts.email, t.accounts.waitlisted, t.workspace.actions]}
          rows={data.waiting.map((item) => ({
            key: item.workspaceId,
            cells: [
              <Link
                key="workspace"
                to={href(`spazi/${encodeURIComponent(item.workspaceId)}`)}
                className="text-primary underline-offset-4 hover:underline"
              >
                {item.email}
              </Link>,
              date(item.waitlistedAt),
              <Disclosure key="admit" label={s.admit}>
                <ActionForm
                  intent="admit-waitlisted"
                  fields={{ spazio: item.workspaceId }}
                  submit={s.admit}
                  reason
                />
              </Disclosure>,
            ],
          }))}
        />
      </Panel>

      <Panel title={s.quotaAttention}>
        <p className="text-sm">
          {s.current(data.quotaAttention.value)} ·{" "}
          <span className="text-muted-foreground">
            {data.quotaAttention.since ? s.since(date(data.quotaAttention.since)) : s.fallback}
          </span>
        </p>
        <Disclosure label={s.change}>
          <ActionForm intent="quota-attention" submit={t.common.save} reason>
            <p className="text-sm text-pretty text-muted-foreground">{s.hints.quota}</p>
            <TextField
              label={s.percent}
              name="soglia"
              type="number"
              min={50}
              max={85}
              required
              defaultValue={data.quotaAttention.value}
              className="max-w-40"
            />
          </ActionForm>
        </Disclosure>
      </Panel>
    </>
  );
}
