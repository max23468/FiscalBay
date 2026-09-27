import { cn } from "cn";
import {
  Check,
  EllipsisVertical,
  ListChecks,
  MessageSquareText,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Link, useFetcher, useLocation, useNavigate, useSearchParams } from "react-router";

import { useNotice } from "~/components/app-shell";
import { LedgerIndicator } from "~/components/brand";
import { EmptyState } from "~/components/empty-state";
import { StatusAlert, StatusBadge, StatusIcon } from "~/components/status";
import { TaxCode } from "~/components/tax-code";
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
import { Checkbox } from "~/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Field, FieldLabel } from "~/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { Skeleton } from "~/components/ui/skeleton";
import { Spinner } from "~/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import type { AppCopy } from "../app-copy";
import { appHref, type AppLinks } from "../app-links";
import { formatAmount, type Language } from "../i18n";
import {
  formatDate,
  formatRelative,
  marketplaceLabel,
  type AccountView,
  type FiscalState,
  type PaymentStatus,
  type ShippingStatus,
  type AddressView,
  countryName,
  type OrderView,
  type TaxIdentifierView,
} from "../view-models";

export type OrdersNotice =
  | { kind: "ebay-down"; at: string }
  | { kind: "quota"; until: string }
  | { kind: "store-issue"; storeId: string; storeName: string }
  | { kind: "importing"; count: number; days: number };

export interface OrdersPageData {
  view: "list" | "no-store" | "loading" | "empty";
  orders: OrderView[];
  incoming: OrderView[];
  total: number;
  nextHref: string | null;
  /** Ordine aperto nel pannello, anche se fuori dalla pagina caricata. */
  detail: OrderView | null;
  stores: Array<{ id: string; name: string }>;
  marketplaces: string[];
  account: AccountView;
  notices: OrdersNotice[];
  sync: { running: boolean; lastAt: string | null; storeName: string | null };
  onboarding: Array<{
    label: "stepAccount" | "stepEmail" | "stepStore" | "stepSync";
    done: boolean;
  }>;
  messageTemplate: string;
  now: string;
}

export interface UnlockResult {
  unlocked: string[];
  remaining: number | null;
}

const fiscalStates: FiscalState[] = ["available", "locked", "missing", "checking", "error"];
const paymentStatuses: PaymentStatus[] = ["paid", "unpaid", "refunded"];
const shippingStatuses: ShippingStatus[] = ["to_ship", "shipped", "delivered", "cancelled"];

function identifierLabel(identifier: TaxIdentifierView, t: AppCopy) {
  return identifier.type === "OTHER"
    ? (identifier.typeLabel ?? "")
    : t.orders.identifier[identifier.type];
}

function taxCodeLabels(label: string, order: string, t: AppCopy) {
  return {
    copy: t.orders.copy(label, order),
    copied: t.orders.copied,
    copyFailed: t.orders.copyFailed,
    locked: t.orders.lockedLabel,
  };
}

function remainingUnlocks(account: AccountView) {
  return account.quota ? Math.max(account.quota.limit - account.quota.used, 0) : null;
}

function IdentifierEntry({
  identifier,
  order,
  t,
  revealed,
}: {
  identifier: TaxIdentifierView;
  order: OrderView;
  t: AppCopy;
  revealed: boolean;
}) {
  const label = identifierLabel(identifier, t);
  const { quality } = identifier;
  const review = quality !== "valid" && quality !== "unchecked";
  const updated = identifier.updated === true && !review;
  return (
    <div className="grid gap-2">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <TaxCode
        value={identifier.value}
        labels={taxCodeLabels(label, order.ebayOrderId, t)}
        reveal={revealed}
      />
      {review ? (
        <div className="grid gap-1.5">
          <StatusBadge tone="warning">{t.orders.toVerify}</StatusBadge>
          <p className="text-sm leading-relaxed text-pretty text-muted-foreground">
            {t.orders.quality[quality]}
          </p>
        </div>
      ) : null}
      {quality === "unchecked" ? (
        <p className="text-sm text-muted-foreground">{t.orders.quality.unchecked}</p>
      ) : null}
      {updated ? (
        <div className="grid gap-1.5">
          <StatusBadge tone="info">{t.orders.updated}</StatusBadge>
          <p className="text-sm text-muted-foreground">{t.orders.updatedHint}</p>
        </div>
      ) : null}
    </div>
  );
}

function UnlockButton({
  order,
  t,
  unlocking,
  onUnlock,
  size,
}: {
  order: OrderView;
  t: AppCopy;
  unlocking: boolean;
  onUnlock: (ids: string[]) => void;
  size?: "sm";
}) {
  return (
    <Button
      size={size}
      className="w-fit"
      disabled={unlocking}
      focusableWhenDisabled
      aria-busy={unlocking || undefined}
      onClick={() => onUnlock([order.id])}
    >
      {unlocking ? (
        <Spinner
          label={t.orders.unlock}
          aria-hidden="true"
          role={undefined}
          data-icon="inline-start"
        />
      ) : null}
      {t.orders.unlock}
    </Button>
  );
}

function LockedFiscal({
  order,
  t,
  language,
  account,
  unlocking,
  onUnlock,
}: {
  order: OrderView;
  t: AppCopy;
  language: Language;
  account: AccountView;
  unlocking: boolean;
  onUnlock: (ids: string[]) => void;
}) {
  const remaining = remainingUnlocks(account);
  const exhausted = remaining === 0 && account.quota;
  return (
    <div className="grid gap-2">
      <p className="text-xs font-medium text-muted-foreground">{t.orders.identifier.CF}</p>
      <TaxCode value={null} labels={taxCodeLabels(t.orders.identifier.CF, order.ebayOrderId, t)} />
      <p className="max-w-md text-sm leading-relaxed text-pretty text-muted-foreground">
        {exhausted
          ? t.orders.lockedExhausted(formatDate(exhausted.cycleEndsAt, language, "date"))
          : t.orders.lockedHint(remaining ?? 0)}
      </p>
      {exhausted ? null : (
        <UnlockButton order={order} t={t} unlocking={unlocking} onUnlock={onUnlock} />
      )}
    </div>
  );
}

/** Dato non disponibile: assente per natura, in verifica o non letto. */
function UnavailableFiscal({ order, t }: { order: OrderView; t: AppCopy }) {
  const notify = useNotice();
  const state = order.fiscal.state as "missing" | "checking" | "error";
  const tone = state === "missing" ? "neutral" : state === "checking" ? "info" : "danger";
  const hint =
    state === "error"
      ? t.orders.errorHint
      : state === "missing"
        ? t.orders.missingHint
        : t.orders.checkingHint;
  return (
    <div className="grid gap-2">
      <div className="flex min-h-10 items-center">
        <StatusBadge tone={tone}>{t.orders.fiscal[state]}</StatusBadge>
      </div>
      <p className="max-w-md text-sm leading-relaxed text-pretty text-muted-foreground">{hint}</p>
      {state === "error" ? (
        <Button variant="outline" className="mt-1 w-fit" onClick={() => notify(t.orders.retried)}>
          {t.orders.retry}
        </Button>
      ) : null}
    </div>
  );
}

/**
 * Stato fiscale completo nel dettaglio: dato copiabile, sblocco con quota,
 * assenza, verifica o errore, con le spiegazioni per esteso.
 */
function FiscalBlock({
  order,
  t,
  language,
  account,
  revealed,
  unlocking,
  onUnlock,
}: {
  order: OrderView;
  t: AppCopy;
  language: Language;
  account: AccountView;
  revealed: boolean;
  unlocking: boolean;
  onUnlock: (ids: string[]) => void;
}) {
  const { fiscal } = order;
  if (fiscal.state === "available") {
    return (
      <div className="grid gap-4">
        {fiscal.identifiers.map((identifier) => (
          <IdentifierEntry
            key={`${identifier.type}:${identifier.value}`}
            identifier={identifier}
            order={order}
            t={t}
            revealed={revealed}
          />
        ))}
      </div>
    );
  }
  if (fiscal.state === "locked") {
    return (
      <LockedFiscal
        order={order}
        t={t}
        language={language}
        account={account}
        unlocking={unlocking}
        onUnlock={onUnlock}
      />
    );
  }
  return <UnavailableFiscal order={order} t={t} />;
}

/** Riquadro della misura del Codice Fiscale per gli stati senza valore. */
function FiscalSlot({ tone, children }: { tone: "neutral" | "info" | "danger"; children: string }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-10 w-56 max-w-full items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-1 text-sm",
        tone === "danger" ? "text-danger" : "text-muted-foreground",
      )}
    >
      <StatusIcon tone={tone} className="size-3.5" />
      {children}
    </span>
  );
}

const cardRow = "flex flex-wrap items-center gap-x-3 gap-y-2";

function CardLabel({ children }: { children: string }) {
  return <p className="text-xs font-medium text-muted-foreground">{children}</p>;
}

/**
 * Spiegazione completa del dato fiscale. Nella scheda occupa tutta la
 * larghezza sotto acquirente e codice, così non allunga la colonna del codice.
 */
function CardNote({ tone, children }: { tone?: "warning" | "info"; children: React.ReactNode }) {
  return (
    <p
      className={cn(
        "flex gap-1.5 text-sm leading-relaxed text-pretty sm:col-span-2",
        tone === "warning" ? "text-foreground" : "text-muted-foreground",
      )}
    >
      {tone ? <StatusIcon tone={tone} className="mt-1 size-3.5" /> : null}
      <span>{children}</span>
    </p>
  );
}

function IdentifierNote({
  identifier,
  t,
  prefix,
}: {
  identifier: TaxIdentifierView;
  t: AppCopy;
  prefix: string;
}) {
  const { quality } = identifier;
  if (quality !== "valid" && quality !== "unchecked") {
    return (
      <CardNote tone="warning">
        {prefix}
        {t.orders.toVerify}. {t.orders.quality[quality]}
      </CardNote>
    );
  }
  if (quality === "unchecked") {
    return (
      <CardNote>
        {prefix}
        {t.orders.quality.unchecked}
      </CardNote>
    );
  }
  if (!identifier.updated) return null;
  return (
    <CardNote tone="info">
      {prefix}
      {t.orders.updated}. {t.orders.updatedHint}
    </CardNote>
  );
}

function CardLocked({
  order,
  t,
  language,
  account,
  unlocking,
  onUnlock,
}: {
  order: OrderView;
  t: AppCopy;
  language: Language;
  account: AccountView;
  unlocking: boolean;
  onUnlock: (ids: string[]) => void;
}) {
  const remaining = remainingUnlocks(account);
  const exhausted = remaining === 0 && account.quota;
  return (
    <>
      <div className="grid content-start gap-1.5">
        <CardLabel>{t.orders.identifier.CF}</CardLabel>
        <div className={cardRow}>
          <TaxCode
            value={null}
            labels={taxCodeLabels(t.orders.identifier.CF, order.ebayOrderId, t)}
          />
          {exhausted ? null : (
            <UnlockButton order={order} t={t} unlocking={unlocking} onUnlock={onUnlock} size="sm" />
          )}
        </div>
      </div>
      <CardNote>
        {exhausted
          ? t.orders.lockedExhausted(formatDate(exhausted.cycleEndsAt, language, "date"))
          : t.orders.lockedHint(remaining ?? 0)}
      </CardNote>
    </>
  );
}

function CardUnavailable({ order, t }: { order: OrderView; t: AppCopy }) {
  const notify = useNotice();
  const state = order.fiscal.state as "missing" | "checking" | "error";
  const tone = state === "missing" ? "neutral" : state === "checking" ? "info" : "danger";
  const hint =
    state === "error"
      ? t.orders.errorHint
      : state === "missing"
        ? t.orders.missingHint
        : t.orders.checkingHint;
  return (
    <>
      <div className="grid content-start gap-1.5">
        <CardLabel>{t.orders.identifier.CF}</CardLabel>
        <div className={cardRow}>
          <FiscalSlot tone={tone}>{t.orders.fiscal[state]}</FiscalSlot>
          {state === "error" ? (
            <Button variant="outline" size="sm" onClick={() => notify(t.orders.retried)}>
              {t.orders.retry}
            </Button>
          ) : null}
        </div>
      </div>
      <CardNote>{hint}</CardNote>
      {state === "missing" && order.suggestion ? (
        <CardNote tone="info">{t.orders.suggestion}</CardNote>
      ) : null}
    </>
  );
}

/**
 * Stato fiscale nella scheda: etichetta e riquadro della stessa misura per
 * ogni stato, con l'azione accanto, affiancati all'acquirente; sotto, la
 * spiegazione completa a tutta larghezza.
 */
function CardFiscal({
  order,
  t,
  language,
  account,
  revealed,
  unlocking,
  onUnlock,
}: {
  order: OrderView;
  t: AppCopy;
  language: Language;
  account: AccountView;
  revealed: boolean;
  unlocking: boolean;
  onUnlock: (ids: string[]) => void;
}) {
  const { fiscal } = order;
  if (fiscal.state === "locked") {
    return (
      <CardLocked
        order={order}
        t={t}
        language={language}
        account={account}
        unlocking={unlocking}
        onUnlock={onUnlock}
      />
    );
  }
  if (fiscal.state !== "available") return <CardUnavailable order={order} t={t} />;
  const several = fiscal.identifiers.length > 1;
  return (
    <>
      <div className="grid content-start gap-3">
        {fiscal.identifiers.map((identifier) => {
          const name = identifierLabel(identifier, t);
          return (
            <div key={`${identifier.type}:${identifier.value}`} className="grid gap-1.5">
              <CardLabel>{name}</CardLabel>
              <TaxCode
                value={identifier.value}
                labels={taxCodeLabels(name, order.ebayOrderId, t)}
                reveal={revealed}
              />
            </div>
          );
        })}
      </div>
      {fiscal.identifiers.map((identifier) => (
        <IdentifierNote
          key={`note:${identifier.type}:${identifier.value}`}
          identifier={identifier}
          t={t}
          prefix={several ? `${identifierLabel(identifier, t)}: ` : ""}
        />
      ))}
    </>
  );
}

function AddressLines({ address, language }: { address: AddressView; language: Language }) {
  const province = address.province ? ` (${address.province})` : "";
  return (
    <>
      <span className="block">{address.line}</span>
      <span className="block">
        {address.postalCode} {address.city}
        {province}, {countryName(address.countryCode, language)}
      </span>
    </>
  );
}

/**
 * Indirizzo fiscale e contatti dell'acquirente: dati non fiscali, visibili
 * anche con il Codice Fiscale da sbloccare. Un dato assente resta indicato.
 */
function BuyerContacts({
  order,
  t,
  language,
}: {
  order: OrderView;
  t: AppCopy;
  language: Language;
}) {
  const missing = <span className="text-muted-foreground">{t.orders.notProvided}</span>;
  return (
    <dl className="grid gap-x-4 gap-y-2 text-sm leading-snug sm:col-span-2 sm:grid-cols-subgrid">
      <div className="grid content-start gap-0.5 sm:row-span-2">
        <dt className="text-xs font-medium text-muted-foreground">{t.orders.taxAddress}</dt>
        <dd className="text-pretty">
          {order.taxAddress ? (
            <AddressLines address={order.taxAddress} language={language} />
          ) : (
            missing
          )}
        </dd>
      </div>
      <div className="grid content-start gap-0.5">
        <dt className="text-xs font-medium text-muted-foreground">{t.orders.phone}</dt>
        <dd className="font-code">{order.phone ?? missing}</dd>
      </div>
      <div className="grid min-w-0 content-start gap-0.5">
        <dt className="text-xs font-medium text-muted-foreground">{t.orders.email}</dt>
        <dd className="break-all">{order.email ?? missing}</dd>
      </div>
    </dl>
  );
}

function OrderCard({
  order,
  t,
  language,
  account,
  detailHref,
  selecting,
  selected,
  onSelect,
  revealed,
  unlocking,
  onUnlock,
  isNew,
}: {
  order: OrderView;
  t: AppCopy;
  language: Language;
  account: AccountView;
  detailHref: string;
  selecting: boolean;
  selected: boolean;
  onSelect: (selected: boolean) => void;
  revealed: boolean;
  unlocking: boolean;
  onUnlock: (ids: string[]) => void;
  isNew: boolean;
}) {
  const notify = useNotice();
  const titleId = useId();
  const [first, second, ...rest] = order.items;
  const shown = [first, second].filter((item) => item !== undefined);
  return (
    <article
      aria-labelledby={titleId}
      className={cn(
        // Da due colonne la scheda occupa tre righe condivise con quella accanto:
        // intestazione, articolo e acquirente iniziano alla stessa altezza.
        "flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-4 transition-[border-color] duration-(--duration-quick) lg:row-span-3 lg:grid lg:grid-rows-subgrid",
        selected && "border-ring",
        isNew &&
          "animate-[notice-in_var(--duration-fast)_var(--ease-smooth-out)] motion-reduce:animate-none",
      )}
    >
      <header className="grid gap-0.5">
        <div className="flex items-center justify-between gap-3">
          <h3 id={titleId} className="font-code text-[0.9375rem] leading-snug font-semibold">
            <Link
              to={detailHref}
              preventScrollReset
              className="rounded-sm outline-none hover:underline hover:underline-offset-4 focus-visible:ring-3 focus-visible:ring-ring"
            >
              {t.order.title(order.ebayOrderId)}
            </Link>
          </h3>
          <div className="-my-1 -mr-1.5 flex shrink-0 items-center gap-1">
            <span className="font-code mr-1 text-[0.9375rem] font-semibold whitespace-nowrap">
              {formatAmount(order.totalMinor, order.currency, language)}
            </span>
            {selecting ? (
              <Checkbox
                checked={selected}
                onCheckedChange={(checked) => onSelect(checked === true)}
                aria-label={t.orders.selectOrder(order.ebayOrderId)}
                className="mx-1.5"
              />
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t.orders.moreActions(order.ebayOrderId)}
                    />
                  }
                >
                  <EllipsisVertical aria-hidden="true" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => notify(t.preview.simulated)}>
                    {t.orders.openOnEbay}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => notify(t.orders.exportNotice)}>
                    {t.orders.exportOrder}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <p className="flex flex-wrap gap-x-1.5 text-xs text-muted-foreground">
            <time dateTime={order.createdAt} className="whitespace-nowrap">
              {formatDate(order.createdAt, language)}
            </time>
            <span aria-hidden="true">·</span>
            <span className="whitespace-nowrap">
              {t.orders.payment[order.payment]} · {t.orders.shipping[order.shipping]}
            </span>
            <span aria-hidden="true">·</span>
            <span className="text-pretty">
              {order.storeName}, {marketplaceLabel(order.marketplace)}
            </span>
          </p>
          <Link
            to={detailHref}
            preventScrollReset
            className="shrink-0 rounded-sm text-xs font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring pointer-coarse:py-1.5"
          >
            {t.orders.details}
          </Link>
        </div>
      </header>
      <div className="flex gap-3">
        {order.thumbnail ? (
          <img
            src={order.thumbnail}
            alt=""
            width="40"
            height="40"
            className="size-10 shrink-0 rounded-md border bg-muted object-cover"
          />
        ) : null}
        <ul className="grid min-w-0 content-start gap-1 text-sm leading-snug">
          {shown.map((item, index) => (
            <li
              key={item.id}
              className={cn("line-clamp-2 text-pretty", index > 0 && "text-muted-foreground")}
            >
              {item.title}
              {item.quantity > 1 ? (
                <span className="whitespace-nowrap text-muted-foreground">
                  {" "}
                  · {t.orders.quantity}: {item.quantity}
                </span>
              ) : null}
            </li>
          ))}
          {rest.length > 0 ? (
            <li className="text-xs text-muted-foreground">{t.orders.itemsMore(rest.length)}</li>
          ) : null}
        </ul>
      </div>
      <div className="grid content-start gap-x-4 gap-y-3 border-t pt-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <p className="grid content-start gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">{t.order.buyer}</span>
          <span className="flex items-center text-sm leading-snug font-medium text-pretty sm:min-h-10">
            {order.buyerName}
          </span>
        </p>
        <CardFiscal
          order={order}
          t={t}
          language={language}
          account={account}
          revealed={revealed}
          unlocking={unlocking}
          onUnlock={onUnlock}
        />
        <BuyerContacts order={order} t={t} language={language} />
      </div>
    </article>
  );
}

function OrderDetail({
  order,
  t,
  language,
  account,
  template,
  revealed,
  unlocking,
  onUnlock,
}: {
  order: OrderView;
  t: AppCopy;
  language: Language;
  account: AccountView;
  template: string;
  revealed: boolean;
  unlocking: boolean;
  onUnlock: (ids: string[]) => void;
}) {
  const notify = useNotice();
  const row = "grid gap-0.5";
  return (
    <Tabs defaultValue="details" className="gap-0 px-4 pb-6">
      <TabsList variant="line" className="mb-5">
        <TabsTrigger value="details">{t.order.tabDetails}</TabsTrigger>
        <TabsTrigger value="items">
          {t.order.tabItems} ({order.items.length})
        </TabsTrigger>
      </TabsList>
      <TabsContent value="details" className="grid gap-7">
        <section aria-labelledby="order-fiscal" className="grid gap-3">
          <h3 id="order-fiscal" className="text-sm font-semibold">
            {t.order.fiscal}
          </h3>
          <FiscalBlock
            order={order}
            t={t}
            language={language}
            account={account}
            revealed={revealed}
            unlocking={unlocking}
            onUnlock={onUnlock}
          />
          {order.fiscal.state === "missing" ? (
            <div className="grid gap-3">
              {order.suggestion ? (
                <div className="grid gap-2 rounded-lg border p-3">
                  <p className="text-xs font-medium text-muted-foreground">{t.orders.suggestion}</p>
                  <TaxCode
                    value={order.suggestion.value}
                    labels={taxCodeLabels(t.orders.identifier.CF, order.ebayOrderId, t)}
                  />
                  <p className="text-sm leading-relaxed text-pretty text-muted-foreground">
                    {t.orders.suggestionHint(
                      order.suggestion.sourceOrder,
                      formatDate(order.suggestion.sourceDate, language, "date"),
                    )}
                  </p>
                  {order.suggestion.conflict ? (
                    <StatusAlert tone="warning" title={t.orders.toVerify}>
                      {t.orders.suggestionConflict}
                    </StatusAlert>
                  ) : null}
                </div>
              ) : null}
              <Button
                variant="outline"
                className="w-fit"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      template.replaceAll("{ordine}", order.ebayOrderId),
                    );
                    notify(t.orders.requestCopied);
                  } catch {
                    notify(t.orders.copyFailed);
                  }
                }}
              >
                <MessageSquareText aria-hidden="true" data-icon="inline-start" />
                {t.orders.requestMessage}
              </Button>
            </div>
          ) : null}
          <p className="text-xs text-muted-foreground">
            {t.order.source(formatDate(order.lastSyncedAt, language))}
          </p>
        </section>
        <section aria-labelledby="order-buyer" className="grid gap-3 border-t pt-5">
          <h3 id="order-buyer" className="text-sm font-semibold">
            {t.order.buyer}
          </h3>
          <dl className="grid gap-3 text-sm">
            <div className={row}>
              <dt className="text-muted-foreground">{t.order.buyer}</dt>
              <dd className="text-pretty">{order.buyerName}</dd>
            </div>
            <div className={row}>
              <dt className="text-muted-foreground">{t.order.username}</dt>
              <dd className="font-code">{order.buyerUsername}</dd>
            </div>
            <div className={row}>
              <dt className="text-muted-foreground">{t.orders.taxAddress}</dt>
              <dd className="text-pretty">
                {order.taxAddress ? (
                  <AddressLines address={order.taxAddress} language={language} />
                ) : (
                  <span className="text-muted-foreground">{t.orders.notProvided}</span>
                )}
              </dd>
            </div>
            <div className={row}>
              <dt className="text-muted-foreground">{t.orders.phone}</dt>
              <dd className="font-code">
                {order.phone ?? (
                  <span className="font-sans text-muted-foreground">{t.orders.notProvided}</span>
                )}
              </dd>
            </div>
            <div className={row}>
              <dt className="text-muted-foreground">{t.orders.email}</dt>
              <dd className="break-all">
                {order.email ?? (
                  <span className="text-muted-foreground">{t.orders.notProvided}</span>
                )}
              </dd>
            </div>
            <div className={row}>
              <dt className="text-muted-foreground">{t.order.recipient}</dt>
              <dd className="text-pretty">
                {order.shipTo.name}, {order.shipTo.locality},{" "}
                {countryName(order.shipTo.country, language)}
              </dd>
            </div>
          </dl>
        </section>
        <section aria-labelledby="order-payment" className="grid gap-3 border-t pt-5">
          <h3 id="order-payment" className="text-sm font-semibold">
            {t.order.payment}
          </h3>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div className={row}>
              <dt className="text-muted-foreground">{t.orders.paymentStatus}</dt>
              <dd>{t.orders.payment[order.payment]}</dd>
            </div>
            <div className={row}>
              <dt className="text-muted-foreground">{t.orders.shippingStatus}</dt>
              <dd>{t.orders.shipping[order.shipping]}</dd>
            </div>
            <div className={row}>
              <dt className="text-muted-foreground">{t.order.total}</dt>
              <dd className="font-code font-medium">
                {formatAmount(order.totalMinor, order.currency, language)}
              </dd>
            </div>
            <div className={row}>
              <dt className="text-muted-foreground">{t.order.created}</dt>
              <dd>{formatDate(order.createdAt, language)}</dd>
            </div>
            <div className={row}>
              <dt className="text-muted-foreground">{t.order.marketplace}</dt>
              <dd>{marketplaceLabel(order.marketplace)}</dd>
            </div>
            <div className={cn(row, "col-span-2")}>
              <dt className="text-muted-foreground">{t.order.store}</dt>
              <dd className="text-pretty">{order.storeName}</dd>
            </div>
          </dl>
        </section>
      </TabsContent>
      <TabsContent value="items">
        <ul className="grid divide-y border-y">
          {order.items.map((item) => (
            <li key={item.id} className="grid gap-1.5 py-4 text-sm">
              <p className="leading-relaxed text-pretty font-medium">{item.title}</p>
              <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>
                  {t.order.sku}: <span className="font-code">{item.sku ?? t.order.noSku}</span>
                </span>
                <span>
                  {t.orders.quantity}: <span className="font-code">{item.quantity}</span>
                </span>
                <span>
                  {t.order.price}:{" "}
                  <span className="font-code">
                    {formatAmount(item.priceMinor, order.currency, language)}
                  </span>
                </span>
              </p>
            </li>
          ))}
        </ul>
      </TabsContent>
    </Tabs>
  );
}

function FilterSelect({
  label,
  name,
  value,
  options,
  allLabel,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  allLabel: string;
  onChange: (name: string, value: string) => void;
}) {
  const id = useId();
  const items = [{ value: "", label: allLabel }, ...options];
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select items={items} value={value} onValueChange={(next) => onChange(name, next ?? "")}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

function OrdersToolbar({
  data,
  t,
  selecting,
  onToggleSelect,
}: {
  data: OrdersPageData;
  t: AppCopy;
  selecting: boolean;
  onToggleSelect: () => void;
}) {
  const [params, setParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterKeys = ["negozio", "marketplace", "periodo", "pagamento", "spedizione", "fiscale"];
  const active = filterKeys.filter((key) => params.get(key)).length;
  const change = (name: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value);
    else next.delete(name);
    next.delete("mostra");
    setParams(next, { preventScrollReset: true });
  };
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end">
      <div className="flex flex-wrap items-center justify-end gap-2 md:order-last md:shrink-0">
        <Button
          variant="outline"
          className="mr-auto md:hidden"
          aria-expanded={filtersOpen}
          aria-controls="orders-filters"
          onClick={() => setFiltersOpen((open) => !open)}
        >
          <SlidersHorizontal aria-hidden="true" data-icon="inline-start" />
          {t.orders.filters}
          {active > 0 ? <span className="font-code">({active})</span> : null}
        </Button>
        <Button
          variant={selecting ? "secondary" : "outline"}
          aria-pressed={selecting}
          onClick={onToggleSelect}
        >
          <ListChecks aria-hidden="true" data-icon="inline-start" />
          {t.orders.select}
        </Button>
      </div>
      <div
        id="orders-filters"
        className={cn(
          "grid gap-3 sm:grid-cols-2 md:flex-1 md:grid-cols-3 xl:grid-cols-6",
          !filtersOpen && "max-md:hidden",
        )}
      >
        {data.stores.length > 1 ? (
          <FilterSelect
            label={t.orders.store}
            name="negozio"
            value={params.get("negozio") ?? ""}
            options={data.stores.map((store) => ({ value: store.id, label: store.name }))}
            allLabel={t.orders.all}
            onChange={change}
          />
        ) : null}
        {data.marketplaces.length > 1 ? (
          <FilterSelect
            label={t.orders.marketplace}
            name="marketplace"
            value={params.get("marketplace") ?? ""}
            options={data.marketplaces.map((id) => ({ value: id, label: marketplaceLabel(id) }))}
            allLabel={t.orders.all}
            onChange={change}
          />
        ) : null}
        <FilterSelect
          label={t.orders.period}
          name="periodo"
          value={params.get("periodo") ?? ""}
          options={[
            { value: "7", label: t.orders.last7 },
            { value: "30", label: t.orders.last30 },
            ...(data.account.plan === "premium" ? [{ value: "90", label: t.orders.last90 }] : []),
          ]}
          allLabel={t.orders.all}
          onChange={change}
        />
        <FilterSelect
          label={t.orders.paymentStatus}
          name="pagamento"
          value={params.get("pagamento") ?? ""}
          options={paymentStatuses.map((status) => ({
            value: status,
            label: t.orders.payment[status],
          }))}
          allLabel={t.orders.all}
          onChange={change}
        />
        <FilterSelect
          label={t.orders.shippingStatus}
          name="spedizione"
          value={params.get("spedizione") ?? ""}
          options={shippingStatuses.map((status) => ({
            value: status,
            label: t.orders.shipping[status],
          }))}
          allLabel={t.orders.all}
          onChange={change}
        />
        <FilterSelect
          label={t.orders.fiscalStatus}
          name="fiscale"
          value={params.get("fiscale") ?? ""}
          options={fiscalStates.map((state) => ({ value: state, label: t.orders.fiscal[state] }))}
          allLabel={t.orders.all}
          onChange={change}
        />
      </div>
    </div>
  );
}

function SelectionBar({
  t,
  selected,
  lockedSelected,
  remaining,
  onUnlock,
  onCancel,
}: {
  t: AppCopy;
  selected: number;
  lockedSelected: string[];
  remaining: number | null;
  onUnlock: (ids: string[]) => void;
  onCancel: () => void;
}) {
  const notify = useNotice();
  const count = lockedSelected.length;
  const exceeds = remaining !== null && count > remaining;
  return (
    <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 mt-6 md:bottom-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-popover px-4 py-3 shadow-md">
        <p className="grid text-sm" aria-live="polite">
          <span className="font-medium">{t.orders.selected(selected)}</span>
          <span className="text-xs text-muted-foreground">{t.orders.selectedLocked(count)}</span>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <AlertDialog>
            <AlertDialogTrigger render={<Button disabled={count === 0} />}>
              {t.orders.unlockSelected(count)}
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t.orders.unlockTitle(count)}</AlertDialogTitle>
                <AlertDialogDescription>
                  {exceeds
                    ? t.orders.unlockExceeds(count, remaining ?? 0)
                    : remaining === null
                      ? null
                      : t.orders.unlockConfirmText(count, remaining)}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t.orders.cancel}</AlertDialogCancel>
                <AlertDialogClose
                  disabled={exceeds}
                  render={<Button />}
                  onClick={() => onUnlock(lockedSelected)}
                >
                  {t.orders.unlockConfirm}
                </AlertDialogClose>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button
            variant="outline"
            disabled={selected === 0}
            onClick={() => notify(t.orders.exportNotice)}
          >
            {t.orders.exportSelected}
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            {t.orders.cancelSelection}
          </Button>
        </div>
      </div>
    </div>
  );
}

function OrdersHeader({
  data,
  t,
  language,
}: {
  data: OrdersPageData;
  t: AppCopy;
  language: Language;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
      <div className="grid gap-1">
        <h1 className="text-2xl font-bold sm:text-3xl">{t.orders.title}</h1>
        {data.view === "list" ? (
          <p className="text-sm text-muted-foreground">
            {t.orders.count(data.total)} · {t.orders.sortedBy}
          </p>
        ) : null}
      </div>
      {data.sync.lastAt || data.sync.running ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <LedgerIndicator active={data.sync.running} />
          {data.sync.running
            ? t.orders.refreshingTitle
            : data.sync.lastAt
              ? t.orders.syncedAgo(formatRelative(data.sync.lastAt, data.now, language))
              : null}
        </p>
      ) : null}
    </header>
  );
}

function OrdersNotices({
  data,
  t,
  language,
  links,
}: {
  data: OrdersPageData;
  t: AppCopy;
  language: Language;
  links: AppLinks;
}) {
  if (data.notices.length === 0 && !data.sync.running) return null;
  return (
    <div className="grid gap-3">
      {data.sync.running && data.view === "list" ? (
        <StatusAlert tone="info" title={t.orders.refreshingTitle}>
          {t.orders.refreshingBody}
        </StatusAlert>
      ) : null}
      {data.notices.map((notice) => {
        switch (notice.kind) {
          case "ebay-down":
            return (
              <StatusAlert key={notice.kind} tone="warning" title={t.orders.ebayDownTitle}>
                {t.orders.ebayDownBody(formatDate(notice.at, language))}
              </StatusAlert>
            );
          case "quota":
            return (
              <StatusAlert key={notice.kind} tone="warning" title={t.orders.quotaTitle}>
                <span className="grid justify-items-start gap-3">
                  {t.orders.quotaBody(formatDate(notice.until, language))}
                  <Link
                    to={appHref(links, "impostazioni/piano")}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    {t.orders.quotaAction}
                  </Link>
                </span>
              </StatusAlert>
            );
          case "store-issue":
            return (
              <StatusAlert
                key={`${notice.kind}:${notice.storeId}`}
                tone="warning"
                title={t.orders.storeIssueTitle(notice.storeName)}
              >
                <span className="grid justify-items-start gap-3">
                  {t.orders.storeIssueBody}
                  <Link
                    to={appHref(links, `negozi/${notice.storeId}`)}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    {t.orders.storeIssueAction}
                  </Link>
                </span>
              </StatusAlert>
            );
          case "importing":
            return (
              <StatusAlert key={notice.kind} tone="info" title={t.orders.importingTitle}>
                {t.orders.importingBody(notice.count, notice.days)}
              </StatusAlert>
            );
        }
        return null;
      })}
    </div>
  );
}

function FirstUse({ data, t }: { data: OrdersPageData; t: AppCopy }) {
  const notify = useNotice();
  return (
    <div className="grid gap-6">
      <EmptyState
        title={t.orders.firstUseTitle}
        description={t.orders.firstUseBody}
        action={
          <Button onClick={() => notify(t.preview.simulated)}>{t.orders.connectStore}</Button>
        }
      />
      <section aria-labelledby="onboarding" className="grid gap-3">
        <h2 id="onboarding" className="text-sm font-semibold">
          {t.orders.steps}
        </h2>
        <ol className="grid gap-2 text-sm sm:grid-cols-4">
          {data.onboarding.map((step, index) => (
            <li
              key={step.label}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2.5",
                !step.done && "text-muted-foreground",
              )}
            >
              {step.done ? (
                <Check aria-hidden="true" className="size-4 text-success" />
              ) : (
                <span
                  aria-hidden="true"
                  className="font-code grid size-4 place-items-center text-xs"
                >
                  {index + 1}
                </span>
              )}
              {t.orders[step.label]}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function LoadingGrid({ t }: { t: AppCopy }) {
  return (
    <div aria-busy="true" className="grid gap-4 lg:grid-cols-2">
      <span className="sr-only" role="status">
        {t.orders.loading}
      </span>
      {[0, 1, 2, 3].map((index) => (
        <div key={index} aria-hidden="true" className="grid gap-5 rounded-xl border bg-card p-5">
          <div className="grid gap-2">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-5 w-56" />
          </div>
          <Skeleton className="h-10 w-56" />
          <div className="grid gap-2 border-t pt-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
          <Skeleton className="h-3 w-48" />
        </div>
      ))}
    </div>
  );
}

type Unlock = ReturnType<typeof useUnlock>;

/** Sblocco tramite l'azione del server: il dato arriva solo dopo la verifica della quota. */
function useUnlock(unlockAction: string, t: AppCopy) {
  const notify = useNotice();
  const fetcher = useFetcher<UnlockResult>();
  const handled = useRef<UnlockResult | undefined>(undefined);
  useEffect(() => {
    const result = fetcher.data;
    if (fetcher.state !== "idle" || !result || handled.current === result) return;
    handled.current = result;
    notify(
      result.unlocked.length === 1
        ? t.orders.unlocked(result.remaining)
        : t.orders.unlockedMany(result.unlocked.length),
    );
  }, [fetcher.state, fetcher.data, notify, t]);
  return {
    submit: (ids: string[]) =>
      void fetcher.submit({ ids: ids.join(",") }, { method: "post", action: unlockAction }),
    pending: new Set(
      fetcher.state === "idle" ? [] : String(fetcher.formData?.get("ids") ?? "").split(","),
    ),
    // Gli ordini appena sbloccati mostrano il dato con una dissolvenza.
    revealed: new Set(fetcher.data?.unlocked ?? []),
  };
}

function SearchChip({ t }: { t: AppCopy }) {
  const location = useLocation();
  const navigate = useNavigate();
  const query = new URLSearchParams(location.search).get("q");
  if (!query) return null;
  return (
    <p className="-mt-2 flex items-center gap-2 text-sm">
      <span className="text-pretty">{t.orders.searchActive(query)}</span>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t.orders.clearSearch}
        onClick={() => {
          const next = new URLSearchParams(location.search);
          next.delete("q");
          void navigate({ search: next.toString() }, { preventScrollReset: true });
        }}
      >
        <X aria-hidden="true" />
      </Button>
    </p>
  );
}

function LoadMore({ data, t }: { data: OrdersPageData; t: AppCopy }) {
  return (
    <div className="flex justify-center">
      {data.nextHref ? (
        <Link
          to={data.nextHref}
          preventScrollReset
          className={buttonVariants({ variant: "outline" })}
        >
          {t.orders.loadMore}
        </Link>
      ) : (
        <p className="text-sm text-muted-foreground">{t.orders.allShown}</p>
      )}
    </div>
  );
}

function OrdersList({
  data,
  t,
  links,
  unlock,
}: {
  data: OrdersPageData;
  t: AppCopy;
  links: AppLinks;
  unlock: Unlock;
}) {
  const { language } = links;
  const location = useLocation();
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [showIncoming, setShowIncoming] = useState(false);
  const stopSelecting = () => {
    setSelecting(false);
    setSelected(new Set());
  };
  const submit = (ids: string[]) => {
    stopSelecting();
    unlock.submit(ids);
  };
  const ordersHref = appHref(links, "ordini");
  const orders = showIncoming ? [...data.incoming, ...data.orders] : data.orders;
  const incomingIds = new Set(data.incoming.map((order) => order.id));
  const lockedSelected = orders
    .filter((order) => selected.has(order.id) && order.fiscal.state === "locked")
    .map((order) => order.id);
  const hasFilters = [...new URLSearchParams(location.search).keys()].some(
    (key) => key !== "mostra",
  );
  return (
    <>
      <OrdersToolbar
        data={data}
        t={t}
        selecting={selecting}
        onToggleSelect={() => (selecting ? stopSelecting() : setSelecting(true))}
      />
      <SearchChip t={t} />
      {data.incoming.length > 0 && !showIncoming ? (
        <div className="flex justify-center">
          <Button variant="secondary" onClick={() => setShowIncoming(true)}>
            {t.orders.newOrders(data.incoming.length)} · {t.orders.showNew}
          </Button>
        </div>
      ) : null}
      {orders.length === 0 ? (
        <EmptyState
          variant="search"
          title={t.orders.noResultsTitle}
          description={t.orders.noResultsBody}
          action={
            hasFilters ? (
              <Link
                to={ordersHref}
                preventScrollReset
                className={buttonVariants({ variant: "outline" })}
              >
                {t.orders.resetFilters}
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          <section aria-label={t.orders.list} className="grid gap-3 lg:grid-cols-2">
            {orders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                t={t}
                language={language}
                account={data.account}
                detailHref={`${ordersHref}/${order.id}${location.search}`}
                selecting={selecting}
                selected={selected.has(order.id)}
                onSelect={(value) =>
                  setSelected((current) => {
                    const next = new Set(current);
                    if (value) next.add(order.id);
                    else next.delete(order.id);
                    return next;
                  })
                }
                revealed={unlock.revealed.has(order.id)}
                unlocking={unlock.pending.has(order.id)}
                onUnlock={submit}
                isNew={showIncoming && incomingIds.has(order.id)}
              />
            ))}
          </section>
          <LoadMore data={data} t={t} />
        </>
      )}
      {selecting ? (
        <SelectionBar
          t={t}
          selected={selected.size}
          lockedSelected={lockedSelected}
          remaining={remainingUnlocks(data.account)}
          onUnlock={submit}
          onCancel={stopSelecting}
        />
      ) : null}
    </>
  );
}

function OrderSheet({
  data,
  t,
  links,
  unlock,
}: {
  data: OrdersPageData;
  t: AppCopy;
  links: AppLinks;
  unlock: Unlock;
}) {
  const { language } = links;
  const location = useLocation();
  const navigate = useNavigate();
  // Il pannello conserva l'ultimo ordine durante l'animazione di chiusura.
  const [shown, setShown] = useState(data.detail);
  if (data.detail && data.detail !== shown) setShown(data.detail);
  // Il focus va sul pannello: la lettura parte dal titolo e la vista resta in cima.
  const panel = useRef<HTMLDivElement>(null);
  return (
    <Sheet
      open={data.detail !== null}
      onOpenChange={(open) => {
        if (!open) {
          void navigate(`${appHref(links, "ordini")}${location.search}`, {
            preventScrollReset: true,
          });
        }
      }}
    >
      {shown ? (
        <SheetContent
          ref={panel}
          initialFocus={panel}
          closeLabel={t.shell.close}
          className="sm:max-w-lg"
        >
          <SheetHeader>
            <SheetTitle className="font-code">{t.order.title(shown.ebayOrderId)}</SheetTitle>
            <SheetDescription className="text-pretty">
              {formatDate(shown.createdAt, language)} · {shown.buyerName}
            </SheetDescription>
          </SheetHeader>
          <OrderDetail
            order={shown}
            t={t}
            language={language}
            account={data.account}
            template={data.messageTemplate}
            revealed={unlock.revealed.has(shown.id)}
            unlocking={unlock.pending.has(shown.id)}
            onUnlock={unlock.submit}
          />
        </SheetContent>
      ) : null}
    </Sheet>
  );
}

/**
 * Pagina Ordini: la home dopo l'accesso. Ricerca e filtri vivono nell'URL,
 * così dettaglio, indietro e ricarica conservano il contesto.
 */
export function OrdersPage({
  data,
  t,
  links,
  unlockAction,
}: {
  data: OrdersPageData;
  t: AppCopy;
  links: AppLinks;
  unlockAction: string;
}) {
  const { language } = links;
  const unlock = useUnlock(unlockAction, t);
  return (
    <div className="grid gap-6">
      <OrdersHeader data={data} t={t} language={language} />
      <OrdersNotices data={data} t={t} language={language} links={links} />
      {data.view === "no-store" ? (
        <FirstUse data={data} t={t} />
      ) : data.view === "loading" ? (
        <LoadingGrid t={t} />
      ) : data.view === "empty" ? (
        <EmptyState
          variant="search"
          title={t.orders.noOrdersTitle}
          description={t.orders.noOrdersBody(
            data.sync.storeName ?? "",
            data.sync.lastAt ? formatDate(data.sync.lastAt, language) : "",
          )}
        />
      ) : (
        <OrdersList data={data} t={t} links={links} unlock={unlock} />
      )}
      <OrderSheet data={data} t={t} links={links} unlock={unlock} />
    </div>
  );
}
