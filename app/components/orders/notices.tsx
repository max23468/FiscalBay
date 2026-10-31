import { cn } from "cn";
import { ClipboardList, Clock } from "lucide-react";
import { Link } from "react-router";

import { useAction } from "~/components/action";
import { useCopy, useLinks } from "~/components/copy-context";
import { PageTitle } from "~/components/icon-tile";
import { StatusAlert, StatusIcon } from "~/components/status";
import { useDate } from "~/components/time-zone";
import { Button } from "~/components/ui/button";
import { buttonLink } from "~/components/ui/button-variants";
import { Spinner } from "~/components/ui/spinner";
import type { AppCopy } from "../../app-copy";
import { appHref } from "../../app-links";
import { formatRelative } from "../../format";
import type { Language } from "../../i18n";
import { trialDaysLeft, trialEnding } from "../../view-models";
import { importingNotice, isEbayDown } from "./labels";
import type { OrdersPageData } from "./page";

export function OrdersHeader({ data }: { data: OrdersPageData }) {
  const { t } = useCopy();
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
      <PageTitle
        icon={ClipboardList}
        tone="blue"
        description={
          data.view === "list" ? (
            <p className="text-sm text-muted-foreground">
              {t.orders.count(data.total)}
              {data.total > 0 ? ` · ${t.orders.sortedBy}` : null}
            </p>
          ) : null
        }
      >
        {t.orders.title}
      </PageTitle>
      <SyncStatus data={data} />
    </header>
  );
}

function syncLabel(data: OrdersPageData, t: AppCopy, language: Language) {
  const down = data.notices.find((notice) => notice.kind === "ebay-down");
  if (down) return down.maintenance ? t.orders.ebayPausedTitle : t.orders.ebayDownTitle;
  const importing = importingNotice(data);
  if (importing) return t.orders.importingStatus(importing.count);
  if (data.sync.running) return t.orders.refreshingTitle;
  return data.sync.lastAt
    ? t.orders.syncedAgo(formatRelative(data.sync.lastAt, data.now, language))
    : null;
}

/** Importazione, aggiornamento o ultimo aggiornamento: un solo indicatore per la pagina. */
function SyncStatus({ data }: { data: OrdersPageData }) {
  const { t, language } = useCopy();
  const importing = importingNotice(data);
  const { running } = data.sync;
  const down = isEbayDown(data);
  const label = syncLabel(data, t, language);
  if (!label) return null;
  return (
    <p
      className={cn(
        "flex items-center gap-2 text-sm",
        down ? "text-warning" : "text-muted-foreground",
      )}
      role="status"
    >
      {down ? (
        <StatusIcon tone="warning" />
      ) : running || importing ? (
        <Spinner />
      ) : (
        <Clock aria-hidden="true" className="size-4" />
      )}
      {label}
    </p>
  );
}

/** Negozio da ricollegare: l'avviso porta al suo pannello, dove si ricollega. */
function StoreIssueAlert({ storeId, storeName }: { storeId: string; storeName: string }) {
  const { links } = useLinks();
  const { t } = useCopy();
  return (
    <StatusAlert tone="warning" title={t.orders.storeIssueTitle(storeName)}>
      <span className="grid justify-items-start gap-3">
        {t.orders.storeIssueBody}
        <Link
          to={appHref(links, `negozi/${storeId}`)}
          {...buttonLink({ variant: "outline", size: "sm" })}
        >
          {t.orders.storeIssueAction}
        </Link>
      </span>
    </StatusAlert>
  );
}

export function OrdersNotices({ data }: { data: OrdersPageData }) {
  const { links } = useLinks();
  const { t } = useCopy();
  const date = useDate();
  // L'esito arriva anche quando l'avviso, con la prova attivata, non c'è più.
  const trialAction = useAction();
  if (data.notices.every((notice) => notice.kind === "importing")) return null;
  return (
    <div className="grid gap-3">
      {data.notices.map((notice) => {
        switch (notice.kind) {
          case "ebay-down":
            return (
              <StatusAlert
                key={notice.kind}
                tone="warning"
                title={notice.maintenance ? t.orders.ebayPausedTitle : t.orders.ebayDownTitle}
              >
                {notice.maintenance
                  ? notice.at
                    ? t.orders.ebayPausedBody(date(notice.at))
                    : t.orders.ebayPausedNeverBody
                  : notice.at
                    ? t.orders.ebayDownBody(date(notice.at))
                    : t.orders.ebayDownNeverBody}
              </StatusAlert>
            );
          case "store-read-failed":
            return (
              <StatusAlert
                key={`${notice.kind}:${notice.storeId}`}
                tone="warning"
                title={t.orders.storeReadFailedTitle(notice.storeName)}
              >
                <span className="grid justify-items-start gap-3">
                  {t.orders.storeReadFailedBody(date(notice.at))}
                  <Link
                    to={appHref(links, `negozi/${notice.storeId}`)}
                    {...buttonLink({ variant: "outline", size: "sm" })}
                  >
                    {t.orders.openStore}
                  </Link>
                </span>
              </StatusAlert>
            );
          case "quota":
            return (
              <StatusAlert key={notice.kind} tone="warning" title={t.orders.quotaTitle}>
                <span className="grid justify-items-start gap-3">
                  {t.orders.quotaBody(date(notice.until))}
                  {/* Con la prova disponibile l'avviso la offre al posto dell'acquisto; senza la
                      pagina del piano nessun collegamento a una destinazione assente. */}
                  {trialOffered(data) ? (
                    <StartTrial action={trialAction} />
                  ) : data.settings ? (
                    <Link
                      to={appHref(links, "impostazioni/piano")}
                      {...buttonLink({ variant: "outline", size: "sm" })}
                    >
                      {t.orders.quotaAction}
                    </Link>
                  ) : null}
                </span>
              </StatusAlert>
            );
          case "waitlist":
            return (
              <StatusAlert key={notice.kind} tone="info" title={t.orders.waitlistTitle}>
                <span className="grid justify-items-start gap-3">
                  {notice.purchase
                    ? `${t.settings.plan.waitlisted} ${t.settings.plan.waitlistedPurchase}`
                    : t.settings.plan.waitlisted}
                  {notice.purchase && data.settings ? (
                    <Link
                      to={appHref(links, "impostazioni/piano")}
                      {...buttonLink({ variant: "outline", size: "sm" })}
                    >
                      {t.orders.quotaAction}
                    </Link>
                  ) : null}
                </span>
              </StatusAlert>
            );
          case "store-issue":
            return (
              <StoreIssueAlert
                key={`${notice.kind}:${notice.storeId}`}
                storeId={notice.storeId}
                storeName={notice.storeName}
              />
            );
          case "consent-expiring":
            return (
              <StatusAlert
                key={`${notice.kind}:${notice.storeId}`}
                tone="info"
                title={t.orders.consentExpiringTitle(notice.storeName)}
              >
                <span className="grid justify-items-start gap-3">
                  {t.orders.consentExpiringBody(date(notice.at, "date"))}
                  {/* Il consenso è ancora valido: il ricollegamento parte subito dalla
                      schermata preparatoria, fuori dalle route dell'app. Con eBay che non
                      risponde resta sospeso, come in Negozi. */}
                  {isEbayDown(data) ? (
                    <Button variant="outline" size="sm" disabled focusableWhenDisabled>
                      {t.orders.reconnectStore}
                    </Button>
                  ) : (
                    <a
                      href={`${appHref(links, "negozi/collega")}?ricollega=${encodeURIComponent(notice.storeId)}&environment=${notice.ebayEnvironment}`}
                      {...buttonLink({ variant: "outline", size: "sm" })}
                    >
                      {t.orders.reconnectStore}
                    </a>
                  )}
                </span>
              </StatusAlert>
            );
          // L'importazione compare nell'indicatore dell'intestazione e in fondo all'elenco.
          case "importing":
            return null;
        }
        return null;
      })}
    </div>
  );
}

/**
 * Prova Premium: un invito discreto dopo la prima lettura riuscita, anche senza ordini, poi il
 * tempo rimasto, in evidenza negli ultimi giorni con il rimando al piano.
 */
export function TrialNotice({ data }: { data: OrdersPageData }) {
  const { links } = useLinks();
  const { t } = useCopy();
  const date = useDate();
  // Fuori dal pulsante: l'esito arriva dopo che l'invito ha lasciato posto ai giorni rimasti.
  const action = useAction();
  const { trial } = data.account;
  if (trial) {
    if (!trialEnding(trial.endsAt, data.now))
      return (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <StatusIcon tone="premium" />
          {t.orders.trialStatus(trialDaysLeft(trial.endsAt, data.now))}
        </p>
      );
    return (
      <StatusAlert tone="premium" title={t.orders.trialEndingTitle(date(trial.endsAt))}>
        <span className="grid justify-items-start gap-3">
          {t.orders.trialEndingBody}
          <Link
            to={appHref(links, "impostazioni/piano")}
            {...buttonLink({ variant: "outline", size: "sm" })}
          >
            {t.orders.trialEndingAction}
          </Link>
        </span>
      </StatusAlert>
    );
  }
  // Con gli sblocchi esauriti la prova è già l'azione dell'avviso.
  if (!trialOffered(data) || data.notices.some((notice) => notice.kind === "quota")) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
      <p className="flex items-center gap-2">
        <StatusIcon tone="premium" />
        {t.orders.trialOffer}
      </p>
      <StartTrial action={action} />
    </div>
  );
}

/** La prova si offre dopo la prima lettura riuscita, con l'elenco o senza ordini. */
function trialOffered(data: OrdersPageData) {
  return (
    !data.account.trial &&
    data.account.trialAvailable &&
    !!data.sync.lastAt &&
    (data.view === "list" || data.view === "empty")
  );
}

function StartTrial({ action }: { action: ReturnType<typeof useAction> }) {
  const { t } = useCopy();
  return (
    <Button
      variant="outline"
      size="sm"
      pending={action.pending}
      onClick={() => action.run("start-trial")}
    >
      {t.settings.plan.trialAction}
    </Button>
  );
}
