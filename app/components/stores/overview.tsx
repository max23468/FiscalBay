import { ChevronRight, ExternalLink, RefreshCw } from "lucide-react";
import { Link } from "react-router";

import { useAction } from "~/components/action";
import { useHydrated } from "~/components/hydrated";
import { StatusBadge } from "~/components/status";
import { useDate } from "~/components/time-zone";
import { Button } from "~/components/ui/button";
import { buttonLink } from "~/components/ui/button-variants";
import { useCopy, useLinks } from "~/components/copy-context";
import type { AppCopy } from "../../app-copy";
import { appHref } from "../../app-links";
import { type StoreView } from "../../view-models";
import { PauseButton, ReconnectButton } from "./actions";
import {
  FeedbackSummary,
  LastSync,
  RecentList,
  StoreSubtitle,
  StoreTile,
  type SectionProps,
} from "./store";
import {
  connectionStatus,
  ebayDownFor,
  ebayDownText,
  hasSubtitle,
  needsReconnect,
  syncDescription,
  type StoresPageData,
} from "./state";

/** Valore di un riquadro della scheda: etichetta sopra, valore sotto. */
function OverviewStat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid min-w-0 content-start gap-1 rounded-lg bg-muted/50 p-3">
      <dt className="text-xs text-pretty text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{children}</dd>
    </div>
  );
}

/** Intestazione della scheda: logo, nome, account, feedback, stato e pagina eBay. */
function OverviewIdentity({ store }: { store: StoreView }) {
  const { t } = useCopy();
  const status = connectionStatus(store, t);
  return (
    <div className="flex items-start gap-4">
      <StoreTile store={store} size="xl" />
      <div className="grid min-w-0 flex-1 justify-items-start gap-1">
        <h2 id="store-overview" className="text-xl font-semibold text-pretty wrap-anywhere">
          {store.name}
        </h2>
        {hasSubtitle(store) ? (
          <p className="text-sm text-muted-foreground">
            <StoreSubtitle store={store} />
          </p>
        ) : null}
        {store.feedback ? (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span className="text-muted-foreground">{t.stores.feedback}:</span>
            <FeedbackSummary feedback={store.feedback} />
          </p>
        ) : null}
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
          <StatusBadge tone={status.tone} icon={status.icon} filled>
            {status.label}
          </StatusBadge>
          {store.storeUrl ? (
            <a
              href={store.storeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium link-underline hover:text-muted-foreground"
            >
              {t.stores.openStore}
              <ExternalLink aria-hidden="true" className="size-3.5" />
            </a>
          ) : null}
        </span>
      </div>
    </div>
  );
}

/** Storico in breve: importato, in corso o non ancora iniziato; null prima del primo avvio. */
function historyText(store: StoreView, t: AppCopy) {
  if (store.historyDays === null) return null;
  if (!store.importing && store.lastSyncAt) return t.stores.historyImported(store.historyDays);
  return store.importing ? t.stores.historyRunning : t.stores.historyPending;
}

/** Riquadri della scheda: ordini, ultima lettura, storico e scadenza dell'autorizzazione. */
function OverviewStats({ store, now }: SectionProps & { now: string }) {
  const { t } = useCopy();
  const date = useDate();
  const history = historyText(store, t);
  const expired =
    store.connection === "reconnect_required" ||
    (store.consentExpiresAt !== null && store.consentExpiresAt <= now);
  return (
    <dl className="grid grid-cols-2 gap-3">
      <OverviewStat label={t.stores.orders}>
        <span className="font-code">{store.importedOrders}</span>
      </OverviewStat>
      <OverviewStat label={t.stores.lastRead}>
        <LastSync store={store} now={now} slot={false} wrap />
      </OverviewStat>
      {history ? <OverviewStat label={t.stores.historyLabel}>{history}</OverviewStat> : null}
      {store.consentExpiresAt ? (
        <OverviewStat label={t.stores.consentUntil}>
          <span className={expired ? "text-warning" : undefined}>
            {expired ? t.stores.consentExpired : date(store.consentExpiresAt, "date")}
          </span>
        </OverviewStat>
      ) : null}
    </dl>
  );
}

/** Ultime letture dei recenti, dalla più recente. */
function OverviewRecent({ store }: SectionProps) {
  const { t } = useCopy();
  return (
    <div className="grid content-start gap-2">
      <h3 className="text-sm font-semibold">{t.stores.sectionRecent}</h3>
      <RecentList store={store} />
    </div>
  );
}

/**
 * Azioni frequenti della scheda: lettura o ricollegamento, pausa e dettagli. Reimportazione,
 * scollegamento ed eliminazione restano nel pannello. Sotto `sm` i pulsanti stanno in colonna
 * a tutta larghezza, da `sm` in riga.
 */
function OverviewActions({ store, data }: { store: StoreView; data: StoresPageData }) {
  const { links } = useLinks();
  const { t } = useCopy();
  const action = useAction();
  const ready = useHydrated();
  const disconnected = store.connection === "disconnected";
  const button = "w-full sm:w-auto";
  return (
    <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:flex-wrap lg:col-start-1">
      {disconnected || needsReconnect(store) ? (
        <ReconnectButton
          store={store}
          ebayDown={ebayDownFor(data, store)}
          connectHref={data.connectHref}
          prominent
        />
      ) : store.connection === "active" ? (
        <Button
          size="sm"
          className={button}
          disabled={!ready || ebayDownFor(data, store) || store.syncing}
          onClick={() => action.run("store-sync", { store: store.id })}
        >
          <RefreshCw aria-hidden="true" data-icon="inline-start" />
          {t.stores.syncNow}
        </Button>
      ) : null}
      {disconnected || store.pauseReason === "plan" || store.pauseReason === "admin" ? null : (
        <PauseButton store={store} size="sm" className={button} />
      )}
      <Link
        to={`${appHref(links, "negozi")}/${store.id}`}
        preventScrollReset
        {...buttonLink({ variant: "outline", size: "sm", className: button })}
      >
        {t.stores.details}
        <ChevronRight aria-hidden="true" data-icon="inline-end" />
      </Link>
    </div>
  );
}

/**
 * Con un solo negozio, il caso più comune, la pagina lo mostra per esteso: stato, letture,
 * storico e autorizzazione si leggono senza aprire il pannello, che resta completo. Da desktop
 * gli aggiornamenti stanno nella colonna destra; su mobile precedono le azioni.
 */
export function StoreOverview({ store, data }: { store: StoreView; data: StoresPageData }) {
  const { t } = useCopy();
  return (
    <section
      aria-labelledby="store-overview"
      className="grid gap-5 rounded-xl border bg-card p-4 sm:p-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-x-6"
    >
      <div className="grid content-start gap-5 lg:col-start-1">
        <OverviewIdentity store={store} />
        <OverviewStats store={store} now={data.now} />
        <p className="text-sm text-muted-foreground">
          {syncDescription(store, ebayDownFor(data, store) ? ebayDownText(data, t) : null, t)}
        </p>
      </div>
      {store.recent.length > 0 ? (
        <div className="border-t pt-5 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
          <OverviewRecent store={store} />
        </div>
      ) : null}
      <OverviewActions store={store} data={data} />
    </section>
  );
}
