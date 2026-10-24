import { cn } from "cn";
import { CirclePause, Unplug } from "lucide-react";
import { useState } from "react";

import { LedgerIndicator } from "~/components/brand";
import { IconTile, InitialsTile } from "~/components/icon-tile";
import { StatusBadge, StatusIcon, type StatusIconType } from "~/components/status";
import { useTimeZone } from "~/components/time-zone";
import type { AppCopy } from "../../app-copy";
import { locales, type Language } from "../../i18n";
import {
  formatDate,
  formatRelative,
  marketplaceLabel,
  type AccountView,
  type StatusTone,
  type StoreView,
} from "../../view-models";

/** Nome proprio dell'ambiente di prova di eBay, uguale nelle due lingue. */
export interface StoresPageData {
  stores: StoreView[];
  detail: StoreView | null;
  account: Pick<AccountView, "plan">;
  now: string;
  /** Ambienti in cui eBay non risponde: le azioni che lo chiamano restano sospese. */
  ebayDown: Array<"production" | "sandbox">;
  elsewhere: boolean;
  /**
   * Schermata preparatoria del collegamento. Nell'area reale collegare e ricollegare la aprono;
   * senza, l'anteprima simula l'esito.
   */
  connectHref?: string;
  /** Impostazioni esistono: le scorciatoie verso notifiche, piano e supporto hanno una meta. */
  settings: boolean;
}

const sandboxLabel = "eBay Sandbox";

export function marketplaceText(store: StoreView) {
  if (store.sandbox) return sandboxLabel;
  return store.marketplace ? marketplaceLabel(store.marketplace) : null;
}

/** Logo del negozio eBay; senza logo, o se non si carica, le iniziali del nome. */
const logoSizes = {
  md: { pixels: 36, className: "size-9 rounded-lg" },
  lg: { pixels: 44, className: "size-11 rounded-xl" },
  xl: { pixels: 56, className: "size-14 rounded-2xl" },
};

export function StoreTile({
  store,
  size = "md",
}: {
  store: StoreView;
  size?: keyof typeof logoSizes;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  if (!store.logoUrl || failed === store.logoUrl)
    return <InitialsTile name={store.name} size={size} />;
  return (
    <img
      src={store.logoUrl}
      alt=""
      width={logoSizes[size].pixels}
      height={logoSizes[size].pixels}
      referrerPolicy="no-referrer"
      onError={() => setFailed(store.logoUrl!)}
      className={cn("shrink-0 border bg-white object-contain", logoSizes[size].className)}
    />
  );
}

/** Account e marketplace sotto il nome, senza ripetere il nome quando coincide. */
export function StoreSubtitle({ store }: { store: StoreView }) {
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

export function hasSubtitle(store: StoreView) {
  return store.username !== store.name || marketplaceText(store) !== null;
}

export function connectionStatus(
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

export function LastSync({
  store,
  t,
  now,
  language,
  slot = true,
  wrap = false,
}: {
  store: StoreView;
  t: AppCopy;
  now: string;
  language: Language;
  /** In tabella lo slot vuoto allinea il testo alle righe con l'indicatore. */
  slot?: boolean;
  /** Nei riquadri stretti della scheda il testo va a capo. */
  wrap?: boolean;
}) {
  // Le righe della tessera indicano una sincronizzazione che procede: un negozio
  // sospeso o mai sincronizzato mostra solo il testo.
  const live = store.connection === "active" && store.lastSyncAt !== null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 text-muted-foreground",
        wrap ? "min-w-0" : "whitespace-nowrap",
      )}
    >
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
export function notificationsLabel(store: StoreView, t: AppCopy, detail = false) {
  if (store.notifications === null) return t.stores.notificationsFree;
  if (!store.notifications) return t.stores.notificationsOff;
  // Senza sincronizzazione non arrivano ordini da notificare.
  const syncing = store.connection === "active" && store.issue === undefined;
  if (syncing) return t.stores.notificationsOn;
  return detail ? t.stores.notificationsHeldHint : t.stores.notificationsHeld;
}

/** eBay non risponde nell'ambiente del negozio. */
export function ebayDownFor(data: StoresPageData, store: StoreView) {
  return data.ebayDown.includes(store.sandbox ? "sandbox" : "production");
}

export function syncDescription(store: StoreView, ebayDown: boolean, t: AppCopy) {
  if (store.connection === "disconnected") {
    return t.stores.disconnectedHint;
  }
  if (ebayDown) return t.stores.ebayDown;
  if (store.connection === "active") return t.stores.target(store.targetMinutes);
  if (store.pauseReason === "plan") return t.stores.planPauseHint;
  if (store.connection === "paused") return t.stores.pauseHint;
  return t.stores.syncSuspended;
}

export type SectionProps = { store: StoreView; t: AppCopy; language: Language };

/** Punteggio e percentuale positiva del feedback, con il badge Top Rated. */
export function FeedbackSummary({
  feedback,
  t,
  language,
}: {
  feedback: NonNullable<StoreView["feedback"]>;
  t: AppCopy;
  language: Language;
}) {
  return (
    <>
      <span>
        <span className="font-code">{formatCount(feedback.score, language)}</span>
        {feedback.positivePercent === null
          ? null
          : ` · ${t.stores.positiveFeedback(formatPercent(feedback.positivePercent, language))}`}
      </span>
      {feedback.topRated ? <StatusBadge tone="success">{t.stores.topRated}</StatusBadge> : null}
    </>
  );
}

const formatCount = (value: number, language: Language) =>
  new Intl.NumberFormat(locales[language], { useGrouping: "always" }).format(value);

/** Percentuale come la riporta eBay, con al massimo un decimale. */
const formatPercent = (value: number, language: Language) =>
  new Intl.NumberFormat(locales[language], { style: "percent", maximumFractionDigits: 1 }).format(
    value / 100,
  );

/** Sezione del pannello del negozio: titolo con icona, poi il contenuto. */
export function StoreSection({
  id,
  icon,
  title,
  className = "grid gap-3 border-t pt-5",
  children,
}: {
  id: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className={className}>
      <h3 id={id} className="flex items-center gap-2.5 text-sm font-semibold">
        <IconTile icon={icon} tone="teal" size="sm" />
        {title}
      </h3>
      {children}
    </section>
  );
}

/** Autorizzazione eBay da rinnovare o lettura bloccata da un problema del negozio. */
export function needsReconnect(store: StoreView) {
  return (
    store.issue !== undefined ||
    store.connection === "reconnect_required" ||
    store.connection === "error"
  );
}

/** Ultime letture del negozio, dalla più recente. */
export function RecentList({ store, t, language }: SectionProps) {
  const zone = useTimeZone();
  return (
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
            {formatDate(sync.at, language, "dateTime", zone)}
          </time>
        </li>
      ))}
    </ul>
  );
}
