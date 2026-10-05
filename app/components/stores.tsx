import { cn } from "cn";
import {
  Bell,
  ChevronRight,
  CirclePause,
  History,
  Link2,
  Pause,
  Play,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  Store,
  Trash2,
  Unplug,
} from "lucide-react";
import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router";

import { useAction } from "~/components/app-shell";
import { LedgerIndicator } from "~/components/brand";
import { EmptyState } from "~/components/empty-state";
import { IconTile, InitialsTile, PageTitle } from "~/components/icon-tile";
import {
  PremiumNote,
  StatusAlert,
  StatusBadge,
  StatusIcon,
  type StatusIconType,
} from "~/components/status";
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
import { buttonVariants } from "~/components/ui/button-variants";
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
  type StatusTone,
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

function connectionStatus(
  store: StoreView,
  t: AppCopy,
): { tone: StatusTone; label: string; icon?: StatusIconType } {
  if (store.connection === "paused") {
    return {
      tone: "neutral",
      icon: CirclePause,
      label: store.pauseReason === "plan" ? t.stores.pausedByPlan : t.stores.state.paused,
    };
  }
  if (store.connection === "reconnect_required") {
    return { tone: "warning", label: t.stores.state.reconnect_required };
  }
  if (store.connection === "error") {
    return {
      tone: "warning",
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
  slot = true,
}: {
  store: StoreView;
  t: AppCopy;
  now: string;
  language: Language;
  /** In tabella lo slot vuoto allinea il testo alle righe con l'indicatore. */
  slot?: boolean;
}) {
  // Le righe della tessera indicano una sincronizzazione che procede: un negozio
  // sospeso o mai sincronizzato mostra solo il testo.
  const live = store.connection === "active" && store.lastSyncAt !== null;
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap text-muted-foreground">
      {live || store.syncing ? (
        <LedgerIndicator active={store.syncing} />
      ) : slot ? (
        <span aria-hidden="true" className="w-4 shrink-0" />
      ) : null}
      {store.syncing
        ? t.stores.syncing
        : store.lastSyncAt
          ? formatRelative(store.lastSyncAt, now, language)
          : t.stores.never}
    </span>
  );
}

/** In tabella e nella lista l'etichetta resta breve; il dettaglio spiega la sospensione. */
function notificationsLabel(store: StoreView, t: AppCopy, detail = false) {
  if (store.notifications === null) return t.stores.notificationsFree;
  if (!store.notifications) return t.stores.notificationsOff;
  // Senza sincronizzazione non arrivano ordini da notificare.
  const syncing = store.connection === "active" && store.issue === undefined;
  if (syncing) return t.stores.notificationsOn;
  return detail ? t.stores.notificationsHeldHint : t.stores.notificationsHeld;
}

/** Azioni del negozio: una colonna di pulsanti uguali, poi le due disconnessioni. */
function StoreActions({
  store,
  ebayDown,
  t,
  links,
}: {
  store: StoreView;
  ebayDown: boolean;
  t: AppCopy;
  links: AppLinks;
}) {
  const action = useAction();
  const run = (intent: string) => action.run(intent, { store: store.id });
  const [confirmName, setConfirmName] = useState("");
  const needsReconnect =
    store.issue !== undefined ||
    store.connection === "reconnect_required" ||
    store.connection === "error";
  const planPaused = store.pauseReason === "plan";
  return (
    <section aria-labelledby="store-actions" className="grid gap-3 border-t pt-5">
      <h3 id="store-actions" className="flex items-center gap-2.5 text-sm font-semibold">
        <IconTile icon={SlidersHorizontal} tone="teal" size="sm" />
        {t.stores.sectionActions}
      </h3>
      {planPaused ? (
        // La causa della pausa è già spiegata in Sincronizzazione.
        <div className="grid justify-items-start">
          <Link
            to={appHref(links, "impostazioni/piano")}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            {t.stores.chooseFreeStore}
          </Link>
        </div>
      ) : (
        // Stessa forma per ogni azione: una colonna di pulsanti larghi con icona.
        <div className="grid gap-2">
          {needsReconnect ? null : (
            <Button
              variant="outline"
              className="justify-start"
              disabled={ebayDown || store.connection !== "active"}
              onClick={() => run("store-sync")}
            >
              <RefreshCw aria-hidden="true" data-icon="inline-start" />
              {t.stores.syncNow}
            </Button>
          )}
          <Button
            variant="outline"
            className="justify-start"
            disabled={ebayDown || needsReconnect || store.connection !== "active"}
            onClick={() => run("store-reimport")}
          >
            <History aria-hidden="true" data-icon="inline-start" />
            {t.stores.reimport}
          </Button>
          <Button
            variant="outline"
            className="justify-start"
            onClick={() => run(store.connection === "paused" ? "store-resume" : "store-pause")}
          >
            {store.connection === "paused" ? (
              <Play aria-hidden="true" data-icon="inline-start" />
            ) : (
              <Pause aria-hidden="true" data-icon="inline-start" />
            )}
            {store.connection === "paused" ? t.stores.resume : t.stores.pause}
          </Button>
        </div>
      )}
      {store.connection === "active" ? (
        <p className="text-sm text-muted-foreground">{t.stores.pauseHint}</p>
      ) : null}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,16rem),1fr))] gap-2 border-t pt-3">
        <AlertDialog>
          <AlertDialogTrigger
            render={
              <Button
                variant="destructive"
                className="h-auto min-h-9 justify-start py-2 whitespace-normal text-left"
              />
            }
          >
            <Unplug aria-hidden="true" data-icon="inline-start" />
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
                onClick={() => run("store-disconnect")}
              >
                {t.stores.disconnect}
              </AlertDialogClose>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <AlertDialog onOpenChange={() => setConfirmName("")}>
          <AlertDialogTrigger
            render={
              <Button
                variant="destructive"
                className="h-auto min-h-9 justify-start py-2 whitespace-normal text-left"
              />
            }
          >
            <Trash2 aria-hidden="true" data-icon="inline-start" />
            {t.stores.disconnectDelete}
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-balance">
                {t.stores.disconnectDelete}
              </AlertDialogTitle>
              <AlertDialogDescription>
                <strong>{store.name}</strong>. {t.stores.deleteBody}
              </AlertDialogDescription>
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
                onClick={() => run("store-delete")}
              >
                {t.stores.deleteConfirm}
              </AlertDialogClose>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </section>
  );
}

function syncDescription(store: StoreView, ebayDown: boolean, t: AppCopy) {
  if (ebayDown) return t.stores.ebayDown;
  if (store.connection === "active") return t.stores.target(store.targetMinutes);
  if (store.pauseReason === "plan") return t.stores.planPauseHint;
  if (store.connection === "paused") return t.stores.pauseHint;
  return t.stores.syncSuspended;
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
  const action = useAction();
  const run = (intent: string) => action.run(intent, { store: store.id });
  const { language } = links;
  const status = connectionStatus(store, t);
  const needsReconnect = store.issue !== undefined;
  const expired = store.connection === "reconnect_required" || store.consentExpiresAt <= data.now;
  const row = "grid gap-0.5";
  return (
    <div className="grid gap-7 px-4 pb-6">
      {store.issue ? (
        <StatusAlert tone="warning" title={t.stores.issue[store.issue].title}>
          <span className="grid justify-items-start gap-3">
            {t.stores.issue[store.issue].body}
            {store.issue === "unverifiable" ? (
              <Link
                to={appHref(links, "impostazioni/supporto")}
                className="underline underline-offset-4"
              >
                {t.authError.support}
              </Link>
            ) : null}
            <Button
              size="sm"
              disabled={data.ebayDown}
              focusableWhenDisabled
              onClick={() => run("store-fix")}
            >
              {t.stores.reconnect}
            </Button>
          </span>
        </StatusAlert>
      ) : null}
      {data.ebayDown ? <StatusAlert tone="warning" title={t.stores.ebayDown} /> : null}
      <section aria-labelledby="store-connection" className="grid gap-3">
        <h3 id="store-connection" className="flex items-center gap-2.5 text-sm font-semibold">
          <IconTile icon={Link2} tone="teal" size="sm" />
          {t.stores.sectionConnection}
        </h3>
        <StatusBadge tone={status.tone} icon={status.icon} filled>
          {status.label}
        </StatusBadge>
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
            <dd className={expired ? "text-warning" : undefined}>
              {expired
                ? t.stores.consentExpired
                : formatDate(store.consentExpiresAt, language, "date")}
            </dd>
          </div>
        </dl>
        {needsReconnect || expired ? null : (
          <p className="text-sm text-muted-foreground">{t.stores.consentHint}</p>
        )}
      </section>
      <section aria-labelledby="store-sync" className="grid gap-3 border-t pt-5">
        <h3 id="store-sync" className="flex items-center gap-2.5 text-sm font-semibold">
          <IconTile icon={RefreshCw} tone="teal" size="sm" />
          {t.stores.sectionSync}
        </h3>
        <ul className="grid gap-2 text-sm">
          <li>
            <LastSync store={store} t={t} now={data.now} language={language} slot={false} />
          </li>
          <li className="text-muted-foreground">{syncDescription(store, data.ebayDown, t)}</li>
          <li className="text-muted-foreground">{t.stores.history(store.historyDays)}</li>
          <li className="text-muted-foreground">
            {store.importing
              ? t.stores.importRunning
              : store.lastSyncAt
                ? t.stores.importDone
                : t.stores.importNotStarted}
          </li>
        </ul>
        <dl className="grid gap-0.5 text-sm">
          <dt className="text-muted-foreground">{t.stores.orders}</dt>
          <dd className="font-code">{store.importedOrders}</dd>
        </dl>
      </section>
      {/* Un negozio mai sincronizzato non ha aggiornamenti: niente titolo vuoto. */}
      {store.recent.length > 0 ? (
        <section aria-labelledby="store-recent" className="grid gap-3 border-t pt-5">
          <h3 id="store-recent" className="flex items-center gap-2.5 text-sm font-semibold">
            <IconTile icon={History} tone="teal" size="sm" />
            {t.stores.sectionRecent}
          </h3>
          <ul className="grid gap-2 text-sm">
            {store.recent.map((sync) => (
              <li key={sync.at} className="grid gap-0.5">
                <span
                  className={cn(
                    "inline-flex items-center gap-2",
                    sync.ok ? "text-foreground" : "text-danger",
                  )}
                >
                  <StatusIcon tone={sync.ok ? "success" : "danger"} className="size-3.5" />
                  {sync.ok ? t.stores.recentOk(sync.newOrders) : t.stores.recentFailed}
                </span>
                <time dateTime={sync.at} className="pl-5.5 text-muted-foreground">
                  {formatDate(sync.at, language)}
                </time>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section aria-labelledby="store-notifications" className="grid gap-2 border-t pt-5">
        <h3 id="store-notifications" className="flex items-center gap-2.5 text-sm font-semibold">
          <IconTile icon={Bell} tone="teal" size="sm" />
          {t.stores.sectionNotifications}
        </h3>
        {store.notifications === null ? (
          <PremiumNote>{t.stores.notificationsFree}</PremiumNote>
        ) : (
          <p className="text-sm">{notificationsLabel(store, t, true)}</p>
        )}
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
      <StoreActions store={store} ebayDown={data.ebayDown} t={t} links={links} />
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
  const action = useAction();
  const navigate = useNavigate();
  const { language } = links;
  const storesHref = appHref(links, "negozi");
  const [shownDetail, setShownDetail] = useState(data.detail);
  if (data.detail && data.detail !== shownDetail) setShownDetail(data.detail);
  // Il focus va sul pannello: la lettura parte dal titolo e la vista resta in cima.
  const panel = useRef<HTMLDivElement>(null);
  // «Già collegato a un altro account» è l'esito di un tentativo, non uno stato della pagina.
  const [attempted, setAttempted] = useState(false);
  const premium = data.account.plan === "premium";
  const connect = (
    <Button
      disabled={data.ebayDown}
      onClick={() => (data.elsewhere ? setAttempted(true) : action.run("store-connect"))}
    >
      <Plus aria-hidden="true" data-icon="inline-start" />
      {t.stores.connect}
    </Button>
  );
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <PageTitle icon={Store} tone="teal">
          {t.stores.title}
        </PageTitle>
        {data.stores.length > 0 ? connect : null}
      </header>
      {data.elsewhere && attempted ? (
        <StatusAlert tone="warning" title={t.stores.elsewhereTitle}>
          {t.stores.elsewhereBody}
          <a href="mailto:supporto@fiscalbay.it" className="block underline underline-offset-4">
            {t.authError.support}: supporto@fiscalbay.it
          </a>
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
          {premium ? null : (
            <div className="grid gap-2">
              {data.stores.length > 1 ? (
                <p className="text-sm leading-relaxed text-pretty text-muted-foreground">
                  {t.stores.freeLimit}
                </p>
              ) : null}
              <PremiumNote>{t.stores.notificationsFree}</PremiumNote>
            </div>
          )}
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
                {data.stores.map((store) => {
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
                          <InitialsTile name={store.name} />
                          <span className="grid min-w-0 gap-0.5">
                            <span className="font-medium text-pretty hover:underline hover:underline-offset-4">
                              {store.name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              <span className="font-code">{store.username}</span> ·{" "}
                              {marketplaceLabel(store.marketplace)}
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
                          <LastSync store={store} t={t} now={data.now} language={language} />
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
          <ul aria-label={t.stores.list} className="grid divide-y border-y lg:hidden">
            {data.stores.map((store) => {
              const status = connectionStatus(store, t);
              return (
                <li key={store.id}>
                  <Link
                    to={`${storesHref}/${store.id}`}
                    preventScrollReset
                    className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 py-4 outline-none focus-visible:ring-3 focus-visible:ring-ring"
                  >
                    <InitialsTile name={store.name} />
                    <span className="grid min-w-0 gap-1">
                      <span className="font-medium text-pretty">{store.name}</span>
                      <span className="font-code text-xs text-muted-foreground">
                        {store.username}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {marketplaceLabel(store.marketplace)} · {t.stores.orders}:{" "}
                        <span className="font-code">{store.importedOrders}</span>
                      </span>
                    </span>
                    <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground" />
                    <span className="col-span-2 col-start-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                      <StatusBadge tone={status.tone} icon={status.icon} filled>
                        {status.label}
                      </StatusBadge>
                      <LastSync
                        store={store}
                        t={t}
                        now={data.now}
                        language={language}
                        slot={false}
                      />
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
            <SheetHeader className="flex-row items-center gap-3">
              <InitialsTile name={shownDetail.name} size="lg" />
              <span className="grid min-w-0 gap-1">
                <SheetTitle className="text-pretty">{shownDetail.name}</SheetTitle>
                <SheetDescription>
                  <span className="font-code">{shownDetail.username}</span> ·{" "}
                  {marketplaceLabel(shownDetail.marketplace)}
                </SheetDescription>
              </span>
            </SheetHeader>
            <StoreDetail store={shownDetail} data={data} t={t} links={links} />
          </SheetContent>
        ) : null}
      </Sheet>
    </div>
  );
}
