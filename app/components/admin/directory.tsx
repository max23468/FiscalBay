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
          s.failures,
          s.details,
          "",
        ]}
        rows={rows.map((row) => ({
          key: row.id,
          cells: [
            <div key="store" className="grid gap-0.5">
              <span className="font-medium">{row.label}</span>
              <span className="text-xs text-muted-foreground">{row.id}</span>
            </div>,
            <Link
              key="workspace"
              to={href(`spazi/${encodeURIComponent(row.workspaceId)}`)}
              className="text-primary underline-offset-4 hover:underline"
            >
              {row.workspaceId.slice(0, 8)}
            </Link>,
            <div key="state" className="flex flex-wrap gap-1">
              {row.removed ? (
                <Badge variant="neutral">{s.removed}</Badge>
              ) : row.disconnected ? (
                <Badge variant="neutral">{s.disconnected}</Badge>
              ) : (
                <Badge variant={row.consent === "valid" ? "success" : "warning"}>
                  {s.consent[row.consent]}
                </Badge>
              )}
              {row.pauses.map((pause) => (
                <Badge key={pause} variant="outline">
                  {pause}
                </Badge>
              ))}
              {row.syncing ? <Badge variant="info">{s.syncing}</Badge> : null}
            </div>,
            row.lastSuccessAt ? date(row.lastSuccessAt) : t.workspace.store.never,
            row.failures,
            row.detailErrors,
            row.removed || row.disconnected ? null : (
              <div key="actions" className="grid gap-2">
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
