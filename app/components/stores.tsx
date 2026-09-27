import { ChevronRight, Plus } from "lucide-react";
import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router";

import { useNotice } from "~/components/app-shell";
import { LedgerIndicator } from "~/components/brand";
import { EmptyState } from "~/components/empty-state";
import { StatusAlert, StatusBadge, type StatusTone } from "~/components/status";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import { Field, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import type { AppCopy } from "../app-copy";
import { appHref, type AppLinks } from "../app-links";
import type { Language } from "../i18n";
import {
  formatDate,
  formatRelative,
  marketplaceLabel,
  type AccountView,
  type StoreView,
} from "../view-models";

export interface StoresPageData {
  stores: StoreView[];
  detail: StoreView | null;
  account: AccountView;
  now: string;
  ebayDown: boolean;
  elsewhere: boolean;
}

function connectionStatus(store: StoreView, t: AppCopy): { tone: StatusTone; label: string } {
  if (store.connection === "paused") {
    return {
      tone: "neutral",
      label: store.pauseReason === "plan" ? t.stores.pausedByPlan : t.stores.state.paused,
    };
  }
  if (store.connection === "reconnect_required") {
    return { tone: "warning", label: t.stores.state.reconnect_required };
  }
  if (store.connection === "error") {
    return {
      tone: "danger",
      label: store.issue ? t.stores.issue[store.issue].title : t.stores.state.error,
    };
  }
  return { tone: "success", label: t.stores.state.active };
}

function LastSync({
  store,
  t,
  now,
  language,
}: {
  store: StoreView;
  t: AppCopy;
  now: string;
  language: Language;
}) {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap text-muted-foreground">
      <LedgerIndicator active={store.syncing} />
      {store.syncing
        ? t.stores.syncing
        : store.lastSyncAt
          ? formatRelative(store.lastSyncAt, now, language)
          : t.stores.never}
    </span>
  );
}

function notificationsLabel(store: StoreView, t: AppCopy) {
  if (store.notifications === null) return t.stores.notificationsPremium;
  return store.notifications ? t.stores.notificationsOn : t.stores.notificationsOff;
}

function StoreDetail({
  store,
  data,
  t,
  links,
}: {
  store: StoreView;
  data: StoresPageData;
  t: AppCopy;
  links: AppLinks;
}) {
  const notify = useNotice();
  const [confirmName, setConfirmName] = useState("");
  const { language } = links;
  const status = connectionStatus(store, t);
  const needsReconnect = store.issue !== undefined;
  const planPaused = store.pauseReason === "plan";
  const row = "grid gap-0.5";
  return (
    <div className="grid gap-7 px-4 pb-6">
      {store.issue ? (
        <StatusAlert tone="warning" title={t.stores.issue[store.issue].title}>
          {t.stores.issue[store.issue].body}
        </StatusAlert>
      ) : null}
      {data.ebayDown ? <StatusAlert tone="warning" title={t.stores.ebayDown} /> : null}
      <section aria-labelledby="store-connection" className="grid gap-3">
        <h3 id="store-connection" className="text-sm font-semibold">
          {t.stores.sectionConnection}
        </h3>
        <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div className={row}>
            <dt className="text-muted-foreground">{t.stores.account}</dt>
            <dd className="font-code">{store.username}</dd>
          </div>
          <div className={row}>
            <dt className="text-muted-foreground">{t.stores.marketplace}</dt>
            <dd>{marketplaceLabel(store.marketplace)}</dd>
          </div>
          <div className={row}>
            <dt className="text-muted-foreground">{t.stores.connectedSince}</dt>
            <dd>{formatDate(store.connectedAt, language, "date")}</dd>
          </div>
          <div className={row}>
            <dt className="text-muted-foreground">{t.stores.consentUntil}</dt>
            <dd>{formatDate(store.consentExpiresAt, language, "date")}</dd>
          </div>
        </dl>
        <p className="text-xs text-muted-foreground">{t.stores.consentHint}</p>
      </section>
      <section aria-labelledby="store-sync" className="grid gap-3 border-t pt-5">
        <h3 id="store-sync" className="text-sm font-semibold">
          {t.stores.sectionSync}
        </h3>
        <ul className="grid gap-2 text-sm">
          <li>
            <LastSync store={store} t={t} now={data.now} language={language} />
          </li>
          <li className="text-muted-foreground">{t.stores.target(store.targetMinutes)}</li>
          <li className="text-muted-foreground">{t.stores.history(store.historyDays)}</li>
          <li className="text-muted-foreground">
            {store.importing ? t.stores.importRunning : t.stores.importDone}
          </li>
          <li className="text-muted-foreground">
            {t.stores.orders}: <span className="font-code">{store.importedOrders}</span>
          </li>
        </ul>
      </section>
      <section aria-labelledby="store-recent" className="grid gap-3 border-t pt-5">
        <h3 id="store-recent" className="text-sm font-semibold">
          {t.stores.sectionRecent}
        </h3>
        <ul className="grid gap-2 text-sm">
          {store.recent.map((sync) => (
            <li key={sync.at} className="flex flex-wrap justify-between gap-x-4 gap-y-0.5">
              <span className={sync.ok ? "text-foreground" : "text-danger"}>
                {sync.ok ? t.stores.recentOk(sync.newOrders) : t.stores.recentFailed}
              </span>
              <time dateTime={sync.at} className="text-muted-foreground">
                {formatDate(sync.at, language)}
              </time>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="store-notifications" className="grid gap-2 border-t pt-5">
        <h3 id="store-notifications" className="text-sm font-semibold">
          {t.stores.sectionNotifications}
        </h3>
        <p className="text-sm">{notificationsLabel(store, t)}</p>
        <p className="text-sm text-muted-foreground">
          {t.stores.notificationsShortcut}{" "}
          <Link
            to={appHref(links, "impostazioni/notifiche")}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            {t.stores.notificationsLink}
          </Link>
        </p>
      </section>
      <section aria-labelledby="store-actions" className="grid gap-3 border-t pt-5">
        <h3 id="store-actions" className="text-sm font-semibold">
          {t.stores.sectionActions}
        </h3>
        {planPaused ? (
          <p className="text-sm text-muted-foreground">{t.stores.planPauseHint}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {needsReconnect ? (
              <Button disabled={data.ebayDown} onClick={() => notify(t.preview.simulated)}>
                {t.stores.reconnect}
              </Button>
            ) : (
              <Button
                variant="secondary"
                disabled={data.ebayDown || store.connection !== "active"}
                onClick={() => notify(t.preview.simulated)}
              >
                {t.stores.syncNow}
              </Button>
            )}
            <Button
              variant="outline"
              disabled={data.ebayDown || needsReconnect}
              onClick={() => notify(t.preview.simulated)}
            >
              {t.stores.reimport}
            </Button>
            <Button variant="outline" onClick={() => notify(t.preview.simulated)}>
              {store.connection === "paused" ? t.stores.resume : t.stores.pause}
            </Button>
          </div>
        )}
        {store.connection === "active" ? (
          <p className="text-xs text-muted-foreground">{t.stores.pauseHint}</p>
        ) : null}
        <div className="flex flex-wrap gap-2 border-t pt-3">
          <AlertDialog>
            <AlertDialogTrigger render={<Button variant="destructive" />}>
              {t.stores.disconnect}
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t.stores.disconnectTitle(store.name)}</AlertDialogTitle>
                <AlertDialogDescription>{t.stores.disconnectBody}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t.stores.cancel}</AlertDialogCancel>
                <AlertDialogClose
                  render={<Button variant="destructive-solid" />}
                  onClick={() => notify(t.preview.simulated)}
                >
                  {t.stores.disconnect}
                </AlertDialogClose>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <AlertDialog onOpenChange={() => setConfirmName("")}>
            <AlertDialogTrigger render={<Button variant="destructive" />}>
              {t.stores.disconnectDelete}
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t.stores.deleteTitle(store.name)}</AlertDialogTitle>
                <AlertDialogDescription>{t.stores.deleteBody}</AlertDialogDescription>
              </AlertDialogHeader>
              <Field>
                <FieldLabel htmlFor="store-delete-confirm">{t.stores.deleteLabel}</FieldLabel>
                <Input
                  id="store-delete-confirm"
                  autoComplete="off"
                  value={confirmName}
                  onChange={(event) => setConfirmName(event.target.value)}
                />
              </Field>
              <AlertDialogFooter>
                <AlertDialogCancel>{t.stores.cancel}</AlertDialogCancel>
                <AlertDialogClose
                  disabled={confirmName.trim() !== store.name}
                  render={<Button variant="destructive-solid" />}
                  onClick={() => notify(t.preview.simulated)}
                >
                  {t.stores.deleteConfirm}
                </AlertDialogClose>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </section>
    </div>
  );
}

/** Negozi eBay: lista leggera, dettaglio e azioni nel pannello con URL proprio. */
export function StoresPage({
  data,
  t,
  links,
}: {
  data: StoresPageData;
  t: AppCopy;
  links: AppLinks;
}) {
  const notify = useNotice();
  const navigate = useNavigate();
  const { language } = links;
  const storesHref = appHref(links, "negozi");
  const [shownDetail, setShownDetail] = useState(data.detail);
  if (data.detail && data.detail !== shownDetail) setShownDetail(data.detail);
  // Il focus va sul pannello: la lettura parte dal titolo e la vista resta in cima.
  const panel = useRef<HTMLDivElement>(null);
  const connect = (
    <Button onClick={() => notify(t.preview.simulated)}>
      <Plus aria-hidden="true" data-icon="inline-start" />
      {t.stores.connect}
    </Button>
  );
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-bold sm:text-3xl">{t.stores.title}</h1>
        {data.stores.length > 0 ? connect : null}
      </header>
      {data.elsewhere ? (
        <StatusAlert tone="warning" title={t.stores.elsewhereTitle}>
          {t.stores.elsewhereBody}
        </StatusAlert>
      ) : null}
      {data.ebayDown ? <StatusAlert tone="warning" title={t.stores.ebayDown} /> : null}
      {data.stores.length === 0 ? (
        <EmptyState
          title={t.orders.firstUseTitle}
          description={t.orders.firstUseBody}
          action={connect}
        />
      ) : (
        <>
          {data.account.plan === "free" && data.stores.length > 1 ? (
            <p className="max-w-2xl text-sm leading-relaxed text-pretty text-muted-foreground">
              {t.stores.freeLimit}
            </p>
          ) : null}
          <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
            <Table aria-label={t.stores.list}>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">{t.stores.store}</TableHead>
                  <TableHead>{t.stores.connection}</TableHead>
                  <TableHead>{t.stores.lastSync}</TableHead>
                  <TableHead>{t.stores.plan}</TableHead>
                  <TableHead>{t.stores.notifications}</TableHead>
                  <TableHead className="pr-4 text-right">{t.stores.orders}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.stores.map((store) => {
                  const status = connectionStatus(store, t);
                  return (
                    <TableRow key={store.id} className="has-[a:focus-visible]:bg-muted/50">
                      <TableCell className="max-w-72 py-4 pl-4 whitespace-normal">
                        <Link
                          to={`${storesHref}/${store.id}`}
                          preventScrollReset
                          className="grid gap-0.5 rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring"
                        >
                          <span className="font-medium text-pretty hover:underline hover:underline-offset-4">
                            {store.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            <span className="font-code">{store.username}</span> ·{" "}
                            {marketplaceLabel(store.marketplace)}
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                      </TableCell>
                      <TableCell>
                        <LastSync store={store} t={t} now={data.now} language={language} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {store.pauseReason === "plan" ? t.stores.pausedByPlan : t.stores.included}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {notificationsLabel(store, t)}
                      </TableCell>
                      <TableCell className="font-code pr-4 text-right">
                        {store.importedOrders}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <ul aria-label={t.stores.list} className="grid divide-y border-y md:hidden">
            {data.stores.map((store) => {
              const status = connectionStatus(store, t);
              return (
                <li key={store.id}>
                  <Link
                    to={`${storesHref}/${store.id}`}
                    preventScrollReset
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 py-4 outline-none focus-visible:ring-3 focus-visible:ring-ring"
                  >
                    <span className="grid min-w-0 gap-1">
                      <span className="font-medium text-pretty">{store.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {marketplaceLabel(store.marketplace)} · {t.stores.orders}:{" "}
                        <span className="font-code">{store.importedOrders}</span>
                      </span>
                    </span>
                    <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground" />
                    <span className="col-span-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                      <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                      <LastSync store={store} t={t} now={data.now} language={language} />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
      <Sheet
        open={data.detail !== null}
        onOpenChange={(open) => {
          if (!open) void navigate(storesHref, { preventScrollReset: true });
        }}
      >
        {shownDetail ? (
          <SheetContent
            ref={panel}
            initialFocus={panel}
            closeLabel={t.shell.close}
            className="sm:max-w-lg"
          >
            <SheetHeader>
              <SheetTitle className="text-pretty">{shownDetail.name}</SheetTitle>
              <SheetDescription>
                <span className="font-code">{shownDetail.username}</span> ·{" "}
                {marketplaceLabel(shownDetail.marketplace)}
              </SheetDescription>
            </SheetHeader>
            <StoreDetail store={shownDetail} data={data} t={t} links={links} />
          </SheetContent>
        ) : null}
      </Sheet>
    </div>
  );
}
