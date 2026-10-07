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
  account: Pick<AccountView, "plan">;
  now: string;
  ebayDown: boolean;
  elsewhere: boolean;
  /**
   * Schermata preparatoria del collegamento. Nell'area reale collegare e ricollegare la aprono;
   * senza, l'anteprima simula l'esito.
   */
  connectHref?: string;
  /** Impostazioni esistono: le scorciatoie verso notifiche, piano e supporto hanno una meta. */
  settings: boolean;
}

/** La schermata preparatoria riporta ai negozi con «Annulla». */
function connectFromStores(connectHref: string) {
  return `${connectHref}?da=negozi`;
}

/** Ricollegamento dalla schermata preparatoria, nello stesso ambiente eBay del negozio. */
function reconnectHref(connectHref: string, store: StoreView) {
  const environment = store.sandbox ? "sandbox" : "production";
  return `${connectHref}?ricollega&environment=${environment}&da=negozi`;
}

/** Nome proprio dell'ambiente di prova di eBay, uguale nelle due lingue. */
const sandboxLabel = "eBay Sandbox";

function marketplaceText(store: StoreView) {
  if (store.sandbox) return sandboxLabel;
  return store.marketplace ? marketplaceLabel(store.marketplace) : null;
}

/** Account e marketplace sotto il nome, senza ripetere il nome quando coincide. */
function StoreSubtitle({ store }: { store: StoreView }) {
  const account = store.username !== store.name ? store.username : null;
  const marketplace = marketplaceText(store);
  return (
    <>
      {account ? <span className="font-code">{account}</span> : null}
      {account && marketplace ? " · " : null}
      {marketplace}
    </>
  );
}

function hasSubtitle(store: StoreView) {
  return store.username !== store.name || marketplaceText(store) !== null;
}

function connectionStatus(
  store: StoreView,
  t: AppCopy,
): { tone: StatusTone; label: string; icon?: StatusIconType } {
  if (store.connection === "disconnected") {
    return { tone: "neutral", icon: Unplug, label: t.stores.state.disconnected };
  }
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
  connectHref,
  t,
  links,
}: {
  store: StoreView;
  ebayDown: boolean;
  connectHref?: string;
  t: AppCopy;
  links: AppLinks;
}) {
  const disconnected = store.connection === "disconnected";
  return (
    <section aria-labelledby="store-actions" className="grid gap-3 border-t pt-5">
      <h3 id="store-actions" className="flex items-center gap-2.5 text-sm font-semibold">
        <IconTile icon={SlidersHorizontal} tone="teal" size="sm" />
        {t.stores.sectionActions}
      </h3>
      {disconnected ? (
        <div className="grid gap-2">
          <ReconnectButton store={store} ebayDown={ebayDown} connectHref={connectHref} t={t} />
        </div>
      ) : store.pauseReason === "plan" ? (
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
        <ReadActions store={store} ebayDown={ebayDown} t={t} />
      )}
      {store.connection === "active" ? (
        <p className="text-sm text-muted-foreground">{t.stores.pauseHint}</p>
      ) : null}
      {/* Dopo l'eliminazione resta soltanto il ricollegamento. */}
      {disconnected && store.dataDeleted ? null : <DisconnectActions store={store} t={t} />}
    </section>
  );
}

/** Letture a richiesta e pausa, nella stessa forma: pulsanti larghi con icona. */
function ReadActions({ store, ebayDown, t }: { store: StoreView; ebayDown: boolean; t: AppCopy }) {
  const action = useAction();
  const run = (intent: string) => action.run(intent, { store: store.id });
  const needsReconnect =
    store.issue !== undefined ||
    store.connection === "reconnect_required" ||
    store.connection === "error";
  // Anche un negozio da ricollegare può essere in pausa: il pulsante segue la pausa.
  const paused = store.pauseReason !== undefined;
  // Senza sincronizzazione continua non ci sono letture da avviare a richiesta.
  const syncAvailable = store.targetMinutes !== null;
  return (
    <div className="grid gap-2">
      {needsReconnect || !syncAvailable ? null : (
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
      {syncAvailable ? (
        <Button
          variant="outline"
          className="justify-start"
          disabled={ebayDown || needsReconnect || store.connection !== "active"}
          onClick={() => run("store-reimport")}
        >
          <History aria-hidden="true" data-icon="inline-start" />
          {t.stores.reimport}
        </Button>
      ) : null}
      <Button
        variant="outline"
        className="justify-start"
        onClick={() => run(paused ? "store-resume" : "store-pause")}
      >
        {paused ? (
          <Play aria-hidden="true" data-icon="inline-start" />
        ) : (
          <Pause aria-hidden="true" data-icon="inline-start" />
        )}
        {paused ? t.stores.resume : t.stores.pause}
      </Button>
    </div>
  );
}

/** Scollega ed elimina dati; un negozio già scollegato offre solo l'eliminazione. */
function DisconnectActions({ store, t }: { store: StoreView; t: AppCopy }) {
  const action = useAction();
  const run = (intent: string, fields: Record<string, string> = {}) =>
    action.run(intent, { store: store.id, ...fields });
  const [confirmName, setConfirmName] = useState("");
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,16rem),1fr))] gap-2 border-t pt-3">
      {store.connection === "disconnected" ? null : (
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
      )}
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
              onClick={() => run("store-delete", { conferma: confirmName.trim() })}
            >
              {t.stores.deleteConfirm}
            </AlertDialogClose>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/**
 * Ricollega: nell'area reale apre la schermata preparatoria, nell'anteprima simula l'esito.
 * Nell'avviso del problema è il pulsante piccolo dell'avviso, fra le azioni ha la loro forma.
 */
function ReconnectButton({
  store,
  ebayDown,
  connectHref,
  t,
  inAlert = false,
}: {
  store: StoreView;
  ebayDown: boolean;
  connectHref?: string;
  t: AppCopy;
  inAlert?: boolean;
}) {
  const action = useAction();
  const look = inAlert
    ? { size: "sm" as const }
    : { variant: "outline" as const, className: "justify-start" };
  const content = (
    <>
      {inAlert ? null : <Link2 aria-hidden="true" data-icon="inline-start" />}
      {t.stores.reconnect}
    </>
  );
  if (connectHref && !ebayDown) {
    return (
      <Link
        to={reconnectHref(connectHref, store)}
        data-slot="button"
        className={cn(buttonVariants(look), look.className)}
      >
        {content}
      </Link>
    );
  }
  return (
    <Button
      {...look}
      disabled={ebayDown}
      focusableWhenDisabled
      onClick={() => action.run("store-fix", { store: store.id })}
    >
      {content}
    </Button>
  );
}

function syncDescription(store: StoreView, ebayDown: boolean, t: AppCopy) {
  if (store.connection === "disconnected") {
    return store.dataDeleted ? t.stores.deletedHint : t.stores.disconnectedHint;
  }
  if (ebayDown) return t.stores.ebayDown;
  if (store.connection === "active") {
    return store.targetMinutes === null
      ? t.stores.syncNotScheduled
      : t.stores.target(store.targetMinutes);
  }
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
  return (
    <div className="grid gap-7 px-4 pb-6">
      {store.issue ? (
        <StatusAlert tone="warning" title={t.stores.issue[store.issue].title}>
          <span className="grid justify-items-start gap-3">
            {t.stores.issue[store.issue].body}
            {store.issue === "unverifiable" && data.settings ? (
              <Link
                to={appHref(links, "impostazioni/supporto")}
                className="underline underline-offset-4"
              >
                {t.authError.support}
              </Link>
            ) : null}
            <ReconnectButton
              store={store}
              ebayDown={data.ebayDown}
              connectHref={data.connectHref}
              t={t}
              inAlert
            />
          </span>
        </StatusAlert>
      ) : null}
      {!store.issue && store.consentExpiring && store.consentExpiresAt ? (
        <StatusAlert tone="info" title={t.access.consentExpiringTitle(store.name)}>
          <span className="grid justify-items-start gap-3">
            {(store.connection === "paused"
              ? t.stores.consentExpiringPaused
              : t.access.consentExpiringBody)(
              formatDate(store.consentExpiresAt, links.language, "date"),
            )}
            <ReconnectButton
              store={store}
              ebayDown={data.ebayDown}
              connectHref={data.connectHref}
              t={t}
              inAlert
            />
          </span>
        </StatusAlert>
      ) : null}
      {data.ebayDown ? <StatusAlert tone="warning" title={t.stores.ebayDown} /> : null}
      <ConnectionSection store={store} now={data.now} t={t} language={links.language} />
      <SyncSection store={store} data={data} t={t} language={links.language} />
      <RecentSection store={store} t={t} language={links.language} />
      <NotificationsSection store={store} settings={data.settings} t={t} links={links} />
      <StoreActions
        store={store}
        ebayDown={data.ebayDown}
        connectHref={data.connectHref}
        t={t}
        links={links}
      />
    </div>
  );
}

type SectionProps = { store: StoreView; t: AppCopy; language: Language };

function ConnectionSection({ store, now, t, language }: SectionProps & { now: string }) {
  const status = connectionStatus(store, t);
  const needsReconnect = store.issue !== undefined;
  const expired =
    store.connection === "reconnect_required" ||
    (store.consentExpiresAt !== null && store.consentExpiresAt <= now);
  const row = "grid gap-0.5";
  return (
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
          <dd className="font-code wrap-anywhere">{store.username}</dd>
        </div>
        {marketplaceText(store) ? (
          <div className={row}>
            <dt className="text-muted-foreground">{t.stores.marketplace}</dt>
            <dd>{marketplaceText(store)}</dd>
          </div>
        ) : null}
        {store.connectedAt ? (
          <div className={row}>
            <dt className="text-muted-foreground">{t.stores.connectedSince}</dt>
            <dd>{formatDate(store.connectedAt, language, "date")}</dd>
          </div>
        ) : null}
        {store.consentExpiresAt ? (
          <div className={row}>
            <dt className="text-muted-foreground">{t.stores.consentUntil}</dt>
            <dd className={expired ? "text-warning" : undefined}>
              {expired
                ? t.stores.consentExpired
                : formatDate(store.consentExpiresAt, language, "date")}
            </dd>
          </div>
        ) : null}
      </dl>
      {/* Con il consenso in scadenza l'avviso in cima al pannello chiede già di ricollegare. */}
      {needsReconnect ||
      expired ||
      store.consentExpiring ||
      store.connection === "disconnected" ? null : (
        <p className="text-sm text-muted-foreground">{t.stores.consentHint}</p>
      )}
    </section>
  );
}

function SyncSection({ store, data, t, language }: SectionProps & { data: StoresPageData }) {
  return (
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
        {store.historyDays === null ? null : (
          <>
            <li className="text-muted-foreground">{t.stores.history(store.historyDays)}</li>
            <li className="text-muted-foreground">
              {store.importing
                ? t.stores.importRunning
                : store.lastSyncAt
                  ? t.stores.importDone
                  : t.stores.importNotStarted}
            </li>
          </>
        )}
      </ul>
      <dl className="grid gap-0.5 text-sm">
        <dt className="text-muted-foreground">{t.stores.orders}</dt>
        <dd className="font-code">{store.importedOrders}</dd>
      </dl>
    </section>
  );
}

/** Un negozio mai sincronizzato non ha aggiornamenti: niente titolo vuoto. */
function RecentSection({ store, t, language }: SectionProps) {
  if (store.recent.length === 0) return null;
  return (
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
  );
}

function NotificationsSection({
  store,
  settings,
  t,
  links,
}: {
  store: StoreView;
  settings: boolean;
  t: AppCopy;
  links: AppLinks;
}) {
  return (
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
      {settings ? (
        <p className="text-sm text-muted-foreground">
          {t.stores.notificationsShortcut}{" "}
          <Link
            to={appHref(links, "impostazioni/notifiche")}
            className="font-medium text-foreground underline underline-offset-4 hover:text-muted-foreground"
          >
            {t.stores.notificationsLink}
          </Link>
        </p>
      ) : null}
    </section>
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
  // «Già collegato a un altro account» è l'esito di un tentativo, non uno stato della pagina.
  const [attempted, setAttempted] = useState(false);
  const premium = data.account.plan === "premium";
  const connect = <ConnectButton data={data} t={t} onElsewhere={() => setAttempted(true)} />;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <PageTitle
          icon={Store}
          tone="teal"
          description={
            data.stores.length > 0 ? (
              <p className="text-sm text-muted-foreground">
                {t.stores.planScope(premium ? t.settings.premium : t.settings.free)}
              </p>
            ) : undefined
          }
        >
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
          {premium ? null : <FreeNotes stores={data.stores} t={t} />}
          <StoreTable stores={data.stores} premium={premium} now={data.now} t={t} links={links} />
          <StoreList stores={data.stores} premium={premium} now={data.now} t={t} links={links} />
        </>
      )}
      <StoreSheet data={data} t={t} links={links} />
    </div>
  );
}

/** Pannello del negozio con URL proprio; resta visibile mentre si chiude. */
function StoreSheet({ data, t, links }: { data: StoresPageData; t: AppCopy; links: AppLinks }) {
  const navigate = useNavigate();
  const storesHref = appHref(links, "negozi");
  const [shownDetail, setShownDetail] = useState(data.detail);
  if (data.detail && data.detail !== shownDetail) setShownDetail(data.detail);
  // Il focus va sul pannello: la lettura parte dal titolo e la vista resta in cima.
  const panel = useRef<HTMLDivElement>(null);
  return (
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
              <SheetTitle className="text-pretty wrap-anywhere">{shownDetail.name}</SheetTitle>
              {hasSubtitle(shownDetail) ? (
                <SheetDescription>
                  <StoreSubtitle store={shownDetail} />
                </SheetDescription>
              ) : null}
            </span>
          </SheetHeader>
          <StoreDetail store={shownDetail} data={data} t={t} links={links} />
        </SheetContent>
      ) : null}
    </Sheet>
  );
}

/** Limiti del Free validi per tutto lo spazio, sopra l'elenco. */
function FreeNotes({ stores, t }: { stores: StoreView[]; t: AppCopy }) {
  return (
    <div className="grid gap-2">
      {stores.some((store) => store.pauseReason === "plan") ? (
        <p className="text-sm leading-relaxed text-pretty text-muted-foreground">
          {t.stores.freeLimit}
        </p>
      ) : null}
      <PremiumNote>{t.stores.notificationsFree}</PremiumNote>
    </div>
  );
}

/** Collega: nell'area reale apre la schermata preparatoria, nell'anteprima simula l'esito. */
function ConnectButton({
  data,
  t,
  onElsewhere,
}: {
  data: StoresPageData;
  t: AppCopy;
  onElsewhere: () => void;
}) {
  const action = useAction();
  if (data.connectHref && !data.ebayDown) {
    return (
      <Link
        to={connectFromStores(data.connectHref)}
        data-slot="button"
        className={buttonVariants()}
      >
        <Plus aria-hidden="true" data-icon="inline-start" />
        {t.stores.connect}
      </Link>
    );
  }
  return (
    <Button
      disabled={data.ebayDown}
      onClick={() => (data.elsewhere ? onElsewhere() : action.run("store-connect"))}
    >
      <Plus aria-hidden="true" data-icon="inline-start" />
      {t.stores.connect}
    </Button>
  );
}

type ListProps = {
  stores: StoreView[];
  premium: boolean;
  now: string;
  t: AppCopy;
  links: AppLinks;
};

/** Tabella da desktop: tutta la riga apre il pannello del negozio. */
function StoreTable({ stores, premium, now, t, links }: ListProps) {
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
                    <InitialsTile name={store.name} />
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
function StoreList({ stores, premium, now, t, links }: ListProps) {
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
              <InitialsTile name={store.name} />
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
