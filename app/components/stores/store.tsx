import { cn } from "cn";
import { useState } from "react";

import { LedgerIndicator } from "~/components/brand";
import { IconTile, InitialsTile } from "~/components/icon-tile";
import { StatusBadge, StatusIcon } from "~/components/status";
import { useTimeZone } from "~/components/time-zone";
import { locales, type Language } from "../../i18n";
import { type StoreView } from "../../view-models";
import { formatDate, formatRelative } from "../../format";
import { marketplaceText } from "./state";
import { useCopy } from "~/components/copy-context";

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

export function LastSync({
  store,
  now,
  slot = true,
  wrap = false,
}: {
  store: StoreView;
  now: string;
  /** In tabella lo slot vuoto allinea il testo alle righe con l'indicatore. */
  slot?: boolean;
  /** Nei riquadri stretti della scheda il testo va a capo. */
  wrap?: boolean;
}) {
  const { t, language } = useCopy();
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

export type SectionProps = { store: StoreView };

/** Punteggio e percentuale positiva del feedback, con il badge Top Rated. */
export function FeedbackSummary({ feedback }: { feedback: NonNullable<StoreView["feedback"]> }) {
  const { t, language } = useCopy();
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

/** Ultime letture del negozio, dalla più recente. */
export function RecentList({ store }: SectionProps) {
  const { t, language } = useCopy();
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
