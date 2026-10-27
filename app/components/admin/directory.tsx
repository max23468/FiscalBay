import { Form, Link } from "react-router";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import type { AccountRow, StoreRow } from "../../domain/admin-directory.server";
import { ActionForm, DataTable } from "./kit";
import { useAdmin } from "./use-admin";

/** Ricerca nella sezione, con il filtro facoltativo dei soli problemi. */
function Search({ query, problems }: { query: string; problems?: boolean }) {
  const { t } = useAdmin();
  return (
    <Form method="get" role="search" className="flex flex-wrap items-end gap-3">
      <div className="grid min-w-64 flex-1 gap-1.5">
        <Label htmlFor="admin-search">{t.common.search}</Label>
        <Input
          id="admin-search"
          name="q"
          type="search"
          defaultValue={query}
          placeholder={t.common.searchPlaceholder}
        />
      </div>
      {problems === undefined ? null : (
        <Label className="flex h-9 items-center gap-2 font-normal">
          <Checkbox name="problemi" value="1" defaultChecked={problems} />
          {t.stores.problems}
        </Label>
      )}
      <Button type="submit" variant="outline">
        {t.common.search}
      </Button>
    </Form>
  );
}

/** Pagina seguente con la stessa ricerca. */
function More({
  more,
  offset,
  query,
  problems,
}: {
  more: boolean;
  offset: number;
  query: string;
  problems?: boolean;
}) {
  const { t } = useAdmin();
  if (!more) return null;
  const search = new URLSearchParams({ ...(query ? { q: query } : {}), da: String(offset + 50) });
  if (problems) search.set("problemi", "1");
  return (
    <Link
      to={{ search: `?${search}` }}
      className="text-sm font-medium text-primary underline-offset-4 hover:underline"
    >
      {t.common.more}
    </Link>
  );
}

export function AccountsView({
  rows,
  query,
  more,
  offset,
}: {
  rows: AccountRow[];
  query: string;
  more: boolean;
  offset: number;
}) {
  const { t, date, href } = useAdmin();
  const a = t.accounts;
  return (
    <>
      <Search query={query} />
      <DataTable
        head={[a.email, a.name, a.company, a.plan, a.stores, a.created]}
        rows={rows.map((row) => ({
          key: `${row.userId}:${row.workspaceId ?? ""}`,
          cells: [
            <div key="email" className="flex flex-wrap items-center gap-2">
              {row.workspaceId ? (
                <Link
                  to={href(`spazi/${encodeURIComponent(row.workspaceId)}`)}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  {row.email}
                </Link>
              ) : (
                <span>{row.email}</span>
              )}
              {row.admin ? <Badge variant="info">{a.admin}</Badge> : null}
              {row.waitlisted ? <Badge variant="neutral">{a.waitlisted}</Badge> : null}
            </div>,
            row.name,
            row.company ?? "",
            row.workspaceId ? t.coverage[row.coverage ?? "free"] : a.noWorkspace,
            row.stores,
            date(row.createdAt, "date"),
          ],
        }))}
      />
      <More more={more} offset={offset} query={query} />
    </>
  );
}

/**
 * Stato del negozio in una sola etichetta: dati eliminati, scollegato, da ricollegare o in pausa
 * con il motivo, altrimenti attivo; la lettura in corso si aggiunge accanto.
 */
function StoreState({ row }: { row: StoreRow }) {
  const { t } = useAdmin();
  const l = t.labels;
  const [tone, label] = row.removed
    ? (["neutral", l.storeState.removed] as const)
    : row.disconnected
      ? (["neutral", l.storeState.disconnected] as const)
      : row.consent !== "valid"
        ? (["warning", l.storeState.reconnect] as const)
        : row.pauses.length > 0
          ? ([
              "neutral",
              `${l.storeState.paused}: ${row.pauses
                .map((pause) => l.pause[pause as keyof typeof l.pause] ?? pause)
                .join(", ")}`,
            ] as const)
          : (["success", l.storeState.active] as const);
  return (
    <span className="flex flex-wrap gap-1">
      <Badge variant={tone}>{label}</Badge>
      {row.syncing ? <Badge variant="info">{t.stores.syncing}</Badge> : null}
    </span>
  );
}

export function StoresView({
  rows,
  query,
  problems,
  more,
  offset,
}: {
  rows: StoreRow[];
  query: string;
  problems: boolean;
  more: boolean;
  offset: number;
}) {
  const { t, date, href } = useAdmin();
  const s = t.stores;
  return (
    <>
      <Search query={query} problems={problems} />
      <DataTable
        head={[
          s.store,
          s.workspace,
          s.state,
          t.workspace.store.lastSync,
          s.problemsColumn,
          t.workspace.actions,
        ]}
        rows={rows.map((row) => ({
          key: row.id,
          cells: [
            <span key="store" className="font-medium break-words">
              {row.label}
            </span>,
            <Link
              key="workspace"
              to={href(`spazi/${encodeURIComponent(row.workspaceId)}`)}
              className="break-all text-primary underline-offset-4 hover:underline"
            >
              {row.ownerEmail ?? row.workspaceId}
            </Link>,
            <StoreState key="state" row={row} />,
            row.lastSuccessAt ? date(row.lastSuccessAt) : t.workspace.store.never,
            row.failures >= 2 || row.detailErrors > 0 ? (
              <span key="problems" className="grid gap-0.5 text-warning">
                {row.failures >= 2 ? <span>{s.failedReads}</span> : null}
                {row.detailErrors > 0 ? <span>{s.failedDetails(row.detailErrors)}</span> : null}
              </span>
            ) : (
              ""
            ),
            row.removed || row.disconnected ? null : (
              <div key="actions" className="flex flex-wrap gap-2">
                <ActionForm
                  intent="store-sync"
                  fields={{ negozio: row.id, spazio: row.workspaceId }}
                  submit={t.workspace.store.sync}
                />
                {row.detailErrors > 0 ? (
                  <ActionForm
                    intent="retry-details"
                    fields={{ negozio: row.id, spazio: row.workspaceId }}
                    submit={t.workspace.store.retryDetails}
                  />
                ) : null}
              </div>
            ),
          ],
        }))}
      />
      <More more={more} offset={offset} query={query} problems={problems} />
    </>
  );
}
