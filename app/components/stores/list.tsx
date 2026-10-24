import { ChevronRight } from "lucide-react";
import { Link } from "react-router";

import { StatusBadge } from "~/components/status";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import type { AppCopy } from "../../app-copy";
import { appHref, type AppLinks } from "../../app-links";
import type { StoreView } from "../../view-models";
import {
  connectionStatus,
  LastSync,
  marketplaceText,
  notificationsLabel,
  StoreSubtitle,
  StoreTile,
} from "./store";

type ListProps = {
  stores: StoreView[];
  premium: boolean;
  now: string;
  t: AppCopy;
  links: AppLinks;
};

/** Tabella da desktop: tutta la riga apre il pannello del negozio. */
export function StoreTable({ stores, premium, now, t, links }: ListProps) {
  const { language } = links;
  const storesHref = appHref(links, "negozi");
  return (
    <div className="hidden overflow-hidden rounded-xl border bg-card lg:block">
      <Table aria-label={t.stores.list}>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">{t.stores.store}</TableHead>
            <TableHead>{t.stores.connection}</TableHead>
            <TableHead className="pl-8">{t.stores.lastSync}</TableHead>
            {premium ? <TableHead>{t.stores.notifications}</TableHead> : null}
            <TableHead className="text-right">{t.stores.orders}</TableHead>
            <TableHead className="w-10 pr-4">
              <span className="sr-only">{t.stores.openDetail}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stores.map((store) => {
            const status = connectionStatus(store, t);
            return (
              // Tutta la riga apre il negozio: il collegamento si estende sulla riga.
              <TableRow
                key={store.id}
                className="relative hover:bg-muted/50 has-[a:focus-visible]:bg-muted/50"
              >
                <TableCell className="max-w-72 py-4 pl-4 whitespace-normal">
                  <Link
                    to={`${storesHref}/${store.id}`}
                    preventScrollReset
                    className="flex items-center gap-3 rounded-sm outline-none after:absolute after:inset-0 focus-visible:ring-3 focus-visible:ring-ring"
                  >
                    <StoreTile store={store} />
                    <span className="grid min-w-0 gap-0.5">
                      <span className="font-medium text-pretty wrap-anywhere hover:underline hover:underline-offset-4">
                        {store.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        <StoreSubtitle store={store} />
                      </span>
                    </span>
                  </Link>
                </TableCell>
                <TableCell>
                  <span className="flex items-center">
                    <StatusBadge tone={status.tone} icon={status.icon} filled>
                      {status.label}
                    </StatusBadge>
                  </span>
                </TableCell>
                <TableCell>
                  <span className="flex items-center">
                    <LastSync store={store} t={t} now={now} language={language} />
                  </span>
                </TableCell>
                {premium ? (
                  <TableCell className="text-muted-foreground">
                    {notificationsLabel(store, t)}
                  </TableCell>
                ) : null}
                <TableCell className="font-code text-right">{store.importedOrders}</TableCell>
                <TableCell className="pr-4">
                  <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground" />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

/** Elenco da mobile e tablet, con gli stessi dati della tabella. */
export function StoreList({ stores, premium, now, t, links }: ListProps) {
  const { language } = links;
  const storesHref = appHref(links, "negozi");
  return (
    <ul aria-label={t.stores.list} className="grid divide-y border-y lg:hidden">
      {stores.map((store) => {
        const status = connectionStatus(store, t);
        return (
          <li key={store.id}>
            <Link
              to={`${storesHref}/${store.id}`}
              preventScrollReset
              className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 py-4 outline-none focus-visible:ring-3 focus-visible:ring-ring"
            >
              <StoreTile store={store} />
              <span className="grid min-w-0 gap-1">
                <span className="font-medium text-pretty wrap-anywhere">{store.name}</span>
                {store.username !== store.name ? (
                  <span className="font-code text-xs text-muted-foreground">{store.username}</span>
                ) : null}
                <span className="text-xs text-muted-foreground">
                  {marketplaceText(store) ? `${marketplaceText(store)} · ` : null}
                  {t.stores.orders}: <span className="font-code">{store.importedOrders}</span>
                </span>
              </span>
              <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground" />
              <span className="col-span-2 col-start-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <StatusBadge tone={status.tone} icon={status.icon} filled>
                  {status.label}
                </StatusBadge>
                <LastSync store={store} t={t} now={now} language={language} slot={false} />
                {premium ? (
                  <span className="text-muted-foreground">
                    {t.stores.notifications}: {notificationsLabel(store, t)}
                  </span>
                ) : null}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
