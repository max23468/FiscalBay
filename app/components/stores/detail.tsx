import { Bell, History, Link2, RefreshCw } from "lucide-react";
import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router";

import { PremiumNote, StatusAlert, StatusBadge } from "~/components/status";
import { useTimeZone } from "~/components/time-zone";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { buttonLink } from "~/components/ui/button-variants";
import { appHref } from "../../app-links";
import { type StoreView } from "../../view-models";
import { formatDate } from "../../format";
import { ReconnectButton, StoreActions } from "./actions";
import {
  FeedbackSummary,
  LastSync,
  RecentList,
  StoreSection,
  StoreSubtitle,
  StoreTile,
  type SectionProps,
} from "./store";
import {
  connectionStatus,
  ebayDownFor,
  hasSubtitle,
  marketplaceText,
  notificationsLabel,
  syncDescription,
  type StoresPageData,
} from "./state";
import { useCopy, useLinks } from "~/components/copy-context";

/** Pannello del negozio con URL proprio; resta visibile mentre si chiude. */
export function StoreSheet({ data }: { data: StoresPageData }) {
  const { links } = useLinks();
  const { t } = useCopy();
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
        <SheetContent ref={panel} initialFocus={panel} closeLabel={t.shell.close}>
          <SheetHeader className="flex-row items-center gap-3">
            <StoreTile store={shownDetail} size="lg" />
            <span className="grid min-w-0 gap-1">
              <SheetTitle className="text-pretty wrap-anywhere">{shownDetail.name}</SheetTitle>
              {hasSubtitle(shownDetail) ? (
                <SheetDescription>
                  <StoreSubtitle store={shownDetail} />
                </SheetDescription>
              ) : null}
            </span>
          </SheetHeader>
          <StoreDetail store={shownDetail} data={data} />
        </SheetContent>
      ) : null}
    </Sheet>
  );
}

/** Avviso del pannello che si risolve ricollegando il negozio, con il pulsante in fondo. */
function ReconnectNotice({
  tone,
  title,
  store,
  data,
  children,
}: {
  tone: "warning" | "info";
  title: string;
  store: StoreView;
  data: StoresPageData;
  children: React.ReactNode;
}) {
  return (
    <StatusAlert tone={tone} title={title}>
      <span className="grid justify-items-start gap-3">
        {children}
        <ReconnectButton
          store={store}
          ebayDown={ebayDownFor(data, store)}
          connectHref={data.connectHref}
          prominent
        />
      </span>
    </StatusAlert>
  );
}

function StoreDetail({ store, data }: { store: StoreView; data: StoresPageData }) {
  const { links } = useLinks();
  const { t } = useCopy();
  const zone = useTimeZone();
  return (
    <div className="grid gap-7 px-4 pb-6">
      {store.issue ? (
        <ReconnectNotice
          tone="warning"
          title={t.stores.issue[store.issue].title}
          store={store}
          data={data}
        >
          {t.stores.issue[store.issue].body}
          {store.issue === "unverifiable" && data.settings ? (
            <Link
              to={appHref(links, "impostazioni/supporto")}
              className="underline underline-offset-4"
            >
              {t.common.contactSupport}
            </Link>
          ) : null}
        </ReconnectNotice>
      ) : null}
      {!store.issue && store.consentExpiring && store.consentExpiresAt ? (
        <ReconnectNotice
          tone="info"
          title={t.orders.consentExpiringTitle(store.name)}
          store={store}
          data={data}
        >
          {(store.connection === "paused"
            ? t.stores.consentExpiringPaused
            : t.orders.consentExpiringBody)(
            formatDate(store.consentExpiresAt, links.language, "date", zone),
          )}
        </ReconnectNotice>
      ) : null}
      {ebayDownFor(data, store) ? <StatusAlert tone="warning" title={t.stores.ebayDown} /> : null}
      <ConnectionSection store={store} now={data.now} />
      <SyncSection store={store} data={data} />
      <RecentSection store={store} />
      <NotificationsSection store={store} settings={data.notificationSettings} />
      <StoreActions
        store={store}
        ebayDown={ebayDownFor(data, store)}
        connectHref={data.connectHref}
        renewsAlone={
          !!data.subscriptionRenews &&
          data.stores.every((other) => other.id === store.id || other.connection === "disconnected")
        }
      />
    </div>
  );
}

function ConnectionSection({ store, now }: SectionProps & { now: string }) {
  const { t, language } = useCopy();
  const zone = useTimeZone();
  const status = connectionStatus(store, t);
  const expired =
    store.connection === "reconnect_required" ||
    (store.consentExpiresAt !== null && store.consentExpiresAt <= now);
  const row = "grid gap-0.5";
  return (
    <StoreSection
      id="store-connection"
      icon={Link2}
      title={t.stores.sectionConnection}
      className="grid gap-3"
    >
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
        {store.feedback ? (
          <div className={row}>
            <dt className="text-muted-foreground">{t.stores.feedback}</dt>
            <dd className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <FeedbackSummary feedback={store.feedback} />
            </dd>
          </div>
        ) : null}
        {store.connectedAt ? (
          <div className={row}>
            <dt className="text-muted-foreground">{t.stores.connectedSince}</dt>
            <dd>{formatDate(store.connectedAt, language, "date", zone)}</dd>
          </div>
        ) : null}
        {store.consentExpiresAt ? (
          <div className={row}>
            <dt className="text-muted-foreground">{t.stores.consentUntil}</dt>
            <dd className={expired ? "text-warning" : undefined}>
              {expired
                ? t.stores.consentExpired
                : formatDate(store.consentExpiresAt, language, "date", zone)}
            </dd>
          </div>
        ) : null}
      </dl>
      {store.storeUrl ? (
        <a
          href={store.storeUrl}
          target="_blank"
          rel="noopener noreferrer"
          {...buttonLink({ variant: "outline", size: "sm", className: "justify-self-start" })}
        >
          {t.stores.openStore}
        </a>
      ) : null}
    </StoreSection>
  );
}

function SyncSection({ store, data }: SectionProps & { data: StoresPageData }) {
  const { t } = useCopy();
  return (
    <StoreSection id="store-sync" icon={RefreshCw} title={t.stores.sectionSync}>
      <ul className="grid gap-2 text-sm">
        <li>
          <LastSync store={store} now={data.now} slot={false} />
        </li>
        <li className="text-muted-foreground">
          {syncDescription(store, ebayDownFor(data, store), t)}
        </li>
        {store.historyDays === null ? null : !store.importing && store.lastSyncAt ? (
          <li className="text-muted-foreground">{t.stores.importDone(store.historyDays)}</li>
        ) : (
          <>
            <li className="text-muted-foreground">{t.stores.history(store.historyDays)}</li>
            <li className="text-muted-foreground">
              {store.importing ? t.stores.importRunning : t.stores.importNotStarted}
            </li>
          </>
        )}
      </ul>
      <dl className="grid gap-0.5 text-sm">
        <dt className="text-muted-foreground">{t.stores.orders}</dt>
        <dd className="font-code">{store.importedOrders}</dd>
      </dl>
    </StoreSection>
  );
}

/** Un negozio mai sincronizzato non ha aggiornamenti: niente titolo vuoto. */
function RecentSection({ store }: SectionProps) {
  const { t } = useCopy();
  if (store.recent.length === 0) return null;
  return (
    <StoreSection id="store-recent" icon={History} title={t.stores.sectionRecent}>
      <RecentList store={store} />
    </StoreSection>
  );
}

function NotificationsSection({ store, settings }: { store: StoreView; settings: boolean }) {
  const { links } = useLinks();
  const { t } = useCopy();
  return (
    <StoreSection
      id="store-notifications"
      icon={Bell}
      title={t.stores.sectionNotifications}
      className="grid gap-2 border-t pt-5"
    >
      {store.notifications === null ? (
        <PremiumNote>{t.stores.notificationsFree}</PremiumNote>
      ) : (
        <p className="text-sm">{notificationsLabel(store, t, true)}</p>
      )}
      {settings ? (
        <p className="text-sm text-muted-foreground">
          <Link
            to={appHref(links, "impostazioni/notifiche")}
            className="font-medium text-foreground underline underline-offset-4 hover:text-muted-foreground"
          >
            {t.stores.notificationsLink}
          </Link>
        </p>
      ) : null}
    </StoreSection>
  );
}
