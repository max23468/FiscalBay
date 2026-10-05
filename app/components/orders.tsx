import { cn } from "cn";
import {
  Check,
  Clock,
  ChevronRight,
  ClipboardList,
  EllipsisVertical,
  ListChecks,
  MessageSquareText,
  Package,
  Plus,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { domMax, LazyMotion, m, MotionConfig } from "motion/react";
import { useEffect, useEffectEvent, useId, useRef, useState } from "react";
import { Link, useFetcher, useLocation, useNavigate, useSearchParams } from "react-router";

import { useAction, useNotice } from "~/components/app-shell";
import { EmptyState } from "~/components/empty-state";
import { PageTitle } from "~/components/icon-tile";
import { dotTones, toneFor } from "~/components/tile-tone";
import { UnlockIcon } from "~/components/icons";
import { StatusAlert, StatusBadge, StatusIcon } from "~/components/status";
import { TaxCode } from "~/components/tax-code";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import type { VisibleOrder } from "../domain/orders.server";
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
import { Badge } from "~/components/ui/badge";
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
  type AddressView,
  type OrdersNotice,
  fiscalStates,
  paymentStatuses,
  shippingStatuses,
  countryName,
  type OrderView,
  type PaymentStatus,
  type ShippingStatus,
  type TaxIdentifierView,
} from "../view-models";

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
  sync: {
    running: boolean;
    lastAt: string | null;
    storeId: string | null;
    storeName: string | null;
  };
  onboarding: Array<{
    label: "stepAccount" | "stepEmail" | "stepStore" | "stepSync";
    done: boolean;
  }>;
  messageTemplate: string;
  now: string;
  confirmUnlock?: boolean;
}

export interface UnlockResult {
  unlocked: string[];
  remaining: number | null;
}

/** Ordini importati: solo valori persistenti e identificativi già autorizzati dal server. */
export function ImportedOrders({
  orders,
  language,
  t,
}: {
  orders: VisibleOrder[];
  language: Language;
  t: AppCopy;
}) {
  const [params, setParams] = useSearchParams();
  const detail = orders.find((order) => order.id === params.get("ordine"));
  const href = (id: string) => {
    const next = new URLSearchParams(params);
    next.set("ordine", id);
    return `?${next}`;
  };
  const close = () => {
    const next = new URLSearchParams(params);
    next.delete("ordine");
    setParams(next, { preventScrollReset: true });
  };
  const payment: Record<string, string> = {
    PAID: t.orders.payment.paid,
    PENDING: t.orders.paymentPending,
    FULLY_REFUNDED: t.orders.payment.refunded,
  };
  const shipping: Record<string, string> = {
    NOT_STARTED: t.orders.shipping.to_ship,
    IN_PROGRESS: t.orders.shipping.in_progress,
    FULFILLED: t.orders.shipping.shipped,
  };
  const fields = (order: VisibleOrder, expanded = false) => (
    <div className="grid min-w-0 gap-4">
      <dl className="grid gap-2 text-sm">
        {[
          [t.orders.store, order.storeName],
          [t.order.buyer, order.summary?.buyer?.username ?? t.orders.notImported],
          [
            t.orders.paymentStatus,
            order.summary?.orderPaymentStatus
              ? (payment[order.summary.orderPaymentStatus] ?? order.summary.orderPaymentStatus)
              : t.orders.notImported,
          ],
          [
            t.orders.shippingStatus,
            order.summary?.orderFulfillmentStatus
              ? (shipping[order.summary.orderFulfillmentStatus] ??
                order.summary.orderFulfillmentStatus)
              : t.orders.notImported,
          ],
        ].map(([label, value]) => (
          <div key={label} className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-3">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="break-words">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="grid gap-2">
        <p className="text-sm font-medium">{t.order.tabItems}</p>
        {order.summary?.lineItems?.length ? (
          <ul className="grid gap-2 text-sm">
            {order.summary.lineItems.slice(0, expanded ? undefined : 2).map((item) => (
              <li key={item.lineItemId} className="break-words">
                {item.title}{" "}
                <span className="text-muted-foreground">
                  ({t.orders.quantity}: {item.quantity})
                </span>
                {expanded && item.sku ? <p className="font-code">SKU: {item.sku}</p> : null}
              </li>
            ))}
            {!expanded && order.summary.lineItems.length > 2 ? (
              <li>{t.orders.itemsMore(order.summary.lineItems.length - 2)}</li>
            ) : null}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{t.orders.notImported}</p>
        )}
      </div>
      <div className="grid gap-2">
        <p className="text-sm font-medium">{t.orders.taxData}</p>
        <StatusBadge
          tone={
            order.fiscalState === "available"
              ? "success"
              : order.fiscalState === "locked"
                ? "locked"
                : "neutral"
          }
        >
          {order.fiscalState === "unchecked"
            ? t.orders.fiscalUnchecked
            : t.orders.fiscal[order.fiscalState]}
        </StatusBadge>
        {order.taxIdentifiers.map((identifier) => {
          const label =
            identifier.type === "CODICE_FISCALE"
              ? t.orders.identifier.CF
              : identifier.type === "VAT_ID"
                ? t.orders.identifier.PIVA
                : identifier.type;
          return (
            <div key={`${identifier.type}:${identifier.value}`} className="grid gap-1">
              <span className="text-sm text-muted-foreground">{label}</span>
              <TaxCode
                value={identifier.value}
                labels={{
                  copy: t.orders.copy(label, order.ebayOrderId),
                  copied: t.orders.copied,
                  copyFailed: t.orders.copyFailed,
                  locked: t.orders.lockedLabel(label),
                }}
              />
              {expanded ? (
                <p className="text-sm text-muted-foreground">
                  {t.order.source(formatDate(identifier.observedAt, language))}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
  return (
    <>
      <section className="grid gap-4 sm:grid-cols-2" aria-label={t.access.list}>
        {orders.map((order) => (
          <Card key={order.id}>
            <CardHeader>
              <CardTitle className="flex flex-wrap justify-between gap-3">
                <h2 className="min-w-0 break-words">
                  <Link
                    to={href(order.id)}
                    preventScrollReset
                    className="underline-offset-4 hover:underline"
                  >
                    {t.orders.orderLabel(order.ebayOrderId)}
                  </Link>
                </h2>
                <strong className="font-code">
                  {formatAmount(order.totalMinor, order.currency, language)}
                </strong>
              </CardTitle>
              <CardDescription>{formatDate(order.creationTime, language)}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {fields(order)}
              <Link
                to={href(order.id)}
                preventScrollReset
                className="w-fit text-sm underline underline-offset-4"
                aria-label={`${t.orders.details}: ${t.orders.orderLabel(order.ebayOrderId)}`}
              >
                {t.orders.details}
              </Link>
            </CardContent>
          </Card>
        ))}
      </section>
      <Sheet
        open={!!detail}
        onOpenChange={(open) => {
          if (!open) close();
        }}
      >
        <SheetContent closeLabel={t.shell.close} className="sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>
              {detail ? t.orders.orderLabel(detail.ebayOrderId) : t.orders.details}
            </SheetTitle>
            <SheetDescription>
              {detail
                ? `${formatDate(detail.creationTime, language)} · ${formatAmount(detail.totalMinor, detail.currency, language)}`
                : ""}
            </SheetDescription>
          </SheetHeader>
          {detail ? (
            <div className="grid gap-4 px-4 pb-6">
              {fields(detail, true)}
              <p className="text-sm text-muted-foreground">
                {t.orders.updated}: {formatDate(detail.lastModifiedTime, language)}
              </p>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}

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
    locked: t.orders.lockedLabel(label),
  };
}

function isEbayDown(data: OrdersPageData) {
  return data.notices.some((notice) => notice.kind === "ebay-down");
}

function importingNotice(data: OrdersPageData) {
  return data.notices.find((notice) => notice.kind === "importing");
}

function remainingUnlocks(account: AccountView) {
  return account.quota ? Math.max(account.quota.limit - account.quota.used, 0) : null;
}

function UnlockButton({
  order,
  t,
  unlocking,
  onUnlock,
  remaining,
  confirmUnlock = true,
}: {
  order: OrderView;
  t: AppCopy;
  unlocking: boolean;
  onUnlock: (ids: string[], skipConfirmation?: boolean) => void;
  remaining: number | null;
  confirmUnlock?: boolean;
}) {
  const [dontAsk, setDontAsk] = useState(false);
  const cancel = useRef<HTMLButtonElement>(null);
  if (!confirmUnlock)
    return (
      <Button
        size="sm"
        className="w-fit"
        disabled={unlocking}
        focusableWhenDisabled
        aria-busy={unlocking || undefined}
        onClick={() => onUnlock([order.id])}
      >
        <UnlockIcon aria-hidden="true" data-icon="inline-start" />
        {t.orders.unlock}
      </Button>
    );
  return (
    <AlertDialog
      onOpenChange={(open) => {
        if (!open) setDontAsk(false);
      }}
    >
      <AlertDialogTrigger
        render={
          <Button
            size="sm"
            className="w-fit"
            disabled={unlocking}
            focusableWhenDisabled
            aria-busy={unlocking || undefined}
          />
        }
      >
        {unlocking ? (
          <Spinner
            label={t.orders.unlock}
            aria-hidden="true"
            role={undefined}
            data-icon="inline-start"
          />
        ) : (
          <UnlockIcon aria-hidden="true" data-icon="inline-start" />
        )}
        {t.orders.unlock}
      </AlertDialogTrigger>
      <AlertDialogContent initialFocus={cancel}>
        <AlertDialogHeader>
          <AlertDialogTitle>{t.orders.unlockTitle(1)}</AlertDialogTitle>
          <AlertDialogDescription>
            {t.orders.orderLabel(order.ebayOrderId)}
            {remaining === null ? null : ` · ${t.orders.unlockConfirmText(1, remaining)}`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <label className="flex items-start gap-2 text-sm">
          <Checkbox
            aria-label={t.orders.dontAskUnlock}
            checked={dontAsk}
            onCheckedChange={(checked) => setDontAsk(checked === true)}
          />
          {t.orders.dontAskUnlock}
        </label>
        <AlertDialogFooter>
          <AlertDialogCancel ref={cancel}>{t.orders.cancel}</AlertDialogCancel>
          <AlertDialogClose render={<Button />} onClick={() => onUnlock([order.id], dontAsk)}>
            {t.orders.unlockConfirm}
          </AlertDialogClose>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Riquadro della misura del Codice Fiscale per gli stati senza valore. */
function FiscalSlot({ tone, children }: { tone: "neutral" | "info" | "danger"; children: string }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-10 w-56 max-w-full min-w-fit items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-1 text-sm whitespace-nowrap",
        tone === "danger" ? "text-danger" : "text-muted-foreground",
      )}
    >
      <StatusIcon tone={tone} className="size-3.5" />
      {children}
    </span>
  );
}

const cardRow = "flex flex-wrap items-center gap-x-3 gap-y-2";

type PillTone = "success" | "warning" | "info" | "neutral";

const paymentTone: Record<PaymentStatus, PillTone> = {
  paid: "success",
  unpaid: "warning",
  refunded: "neutral",
};

const shippingTone: Record<ShippingStatus, PillTone> = {
  to_ship: "warning",
  shipped: "info",
  delivered: "success",
  cancelled: "neutral",
};

/** Stato di pagamento o spedizione: etichetta tinta, il testo resta la fonte. */
function StatePill({ tone, children }: { tone: PillTone; children: string }) {
  return <Badge variant={tone}>{children}</Badge>;
}

/** Area di tocco invisibile di almeno 44 px per i collegamenti testuali, come per i pulsanti. */
const coarseTarget =
  "relative pointer-coarse:after:absolute pointer-coarse:after:-inset-x-2 pointer-coarse:after:-inset-y-3";

function CardLabel({ children }: { children: string }) {
  return <p className="text-xs font-medium text-muted-foreground">{children}</p>;
}

/**
 * Spiegazione del dato fiscale. Nella scheda occupa tutta la larghezza sotto
 * acquirente e codice, così non allunga la colonna del codice.
 */
function CardNote({ tone, children }: { tone?: "info"; children: React.ReactNode }) {
  return (
    <p className="flex gap-1.5 text-sm leading-relaxed text-pretty text-muted-foreground sm:col-span-2">
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
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm leading-relaxed text-pretty sm:col-span-2">
        <StatusBadge tone="warning">{t.orders.toVerify}</StatusBadge>
        <span className="text-muted-foreground">
          {prefix}
          {t.orders.quality[quality]}
        </span>
      </div>
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

/** Contesto comune al dato fiscale di una scheda o del dettaglio. */
interface FiscalProps {
  order: OrderView;
  t: AppCopy;
  language: Language;
  account: AccountView;
  /** eBay non risponde: le azioni che lo richiedono restano sospese. */
  ebayDown: boolean;
  revealed: boolean;
  unlocking: boolean;
  onUnlock: (ids: string[], skipConfirmation?: boolean) => void;
  confirmUnlock?: boolean;
}

function unavailableTone(state: "missing" | "checking" | "error") {
  return state === "missing" ? "neutral" : state === "checking" ? "info" : "danger";
}

/**
 * Riquadro del dato fiscale con la sua azione: stessa forma per ogni stato,
 * nella scheda accanto all'acquirente e nel dettaglio in cima al pannello.
 */
function FiscalCodes({
  order,
  t,
  account,
  ebayDown,
  revealed,
  unlocking,
  onUnlock,
  confirmUnlock,
}: FiscalProps) {
  const action = useAction();
  const { fiscal } = order;
  if (fiscal.state === "available") {
    return (
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
                warning={
                  identifier.quality !== "valid" && identifier.quality !== "unchecked"
                    ? t.orders.toVerify
                    : undefined
                }
              />
            </div>
          );
        })}
      </div>
    );
  }
  const exhausted = fiscal.state === "locked" && remainingUnlocks(account) === 0;
  // Prima dello sblocco il nome è Codice Fiscale, o Partita IVA se l'ordine ha solo quella.
  const label = t.orders.identifier[fiscal.state === "locked" ? fiscal.shownAs : "CF"];
  return (
    <div className="grid content-start gap-1.5">
      <CardLabel>{label}</CardLabel>
      <div className={cardRow}>
        {fiscal.state === "locked" ? (
          <>
            <TaxCode value={null} labels={taxCodeLabels(label, order.ebayOrderId, t)} />
            {exhausted ? null : (
              <UnlockButton
                order={order}
                t={t}
                unlocking={unlocking}
                onUnlock={onUnlock}
                remaining={remainingUnlocks(account)}
                confirmUnlock={confirmUnlock}
              />
            )}
          </>
        ) : (
          <>
            <FiscalSlot tone={action.pending ? "info" : unavailableTone(fiscal.state)}>
              {t.orders.fiscal[action.pending ? "checking" : fiscal.state]}
            </FiscalSlot>
            {fiscal.state === "error" ? (
              <Button
                variant="outline"
                size="sm"
                disabled={ebayDown || action.pending}
                focusableWhenDisabled
                onClick={() => action.run("retry", { order: order.id })}
              >
                {t.orders.retry}
              </Button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function unavailableHint(state: "missing" | "checking" | "error", ebayDown: boolean, t: AppCopy) {
  if (state === "missing") return t.orders.missingHint;
  if (state === "checking") return t.orders.checkingHint;
  return ebayDown ? t.orders.errorHintEbayDown : t.orders.errorHint;
}

/** Ordini rimasti prima dello sblocco; a sblocchi esauriti, quando riprendono. */
function LockedNote({
  t,
  language,
  account,
  compact,
}: Pick<FiscalProps, "t" | "language" | "account"> & { compact: boolean }) {
  const remaining = remainingUnlocks(account);
  if (remaining === null || !account.quota) return null;
  const cycleEnd = formatDate(account.quota.cycleEndsAt, language, "date");
  if (remaining > 0) return <CardNote>{t.orders.lockedHint(remaining)}</CardNote>;
  return (
    <CardNote>
      {compact ? t.orders.lockedUntil(cycleEnd) : t.orders.lockedExhausted(cycleEnd)}
    </CardNote>
  );
}

/**
 * Spiegazioni del dato fiscale. Nella scheda restano brevi, perché l'avviso
 * in cima alla pagina spiega già le condizioni comuni; nel dettaglio sono complete.
 */
function FiscalNotes({
  order,
  t,
  language,
  account,
  ebayDown,
  compact,
}: Pick<FiscalProps, "order" | "t" | "language" | "account" | "ebayDown"> & {
  compact: boolean;
}) {
  const { fiscal } = order;
  if (fiscal.state === "available") {
    const several = fiscal.identifiers.length > 1;
    return fiscal.identifiers.map((identifier) => (
      <IdentifierNote
        key={`note:${identifier.type}:${identifier.value}`}
        identifier={identifier}
        t={t}
        prefix={several ? `${identifierLabel(identifier, t)}: ` : ""}
      />
    ));
  }
  if (fiscal.state === "locked") {
    return <LockedNote t={t} language={language} account={account} compact={compact} />;
  }
  return (
    <>
      <CardNote>{unavailableHint(fiscal.state, ebayDown, t)}</CardNote>
      {compact && fiscal.state === "missing" && order.suggestion ? (
        <CardNote tone="info">
          {t.orders.suggestionFrom}{" "}
          <span className="font-code text-foreground">{order.suggestion.value}</span>.{" "}
          {t.orders.suggestionCheck}
        </CardNote>
      ) : null}
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

function EmailAddress({ email }: { email: string }) {
  const separator = email.lastIndexOf("@");
  const local = separator < 0 ? email : email.slice(0, separator);
  const domain = separator < 0 ? null : email.slice(separator);
  return (
    <>
      <span className="inline-block max-w-full [overflow-wrap:anywhere]">{local}</span>
      {domain === null ? null : (
        <>
          <wbr />
          <span className="inline-block max-w-full [overflow-wrap:anywhere]">{domain}</span>
        </>
      )}
    </>
  );
}

/**
 * Indirizzo di fatturazione e contatti dell'acquirente: dati non fiscali, visibili
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
      <div className="grid content-start gap-0.5">
        <dt className="text-xs font-medium text-muted-foreground">{t.orders.billingAddress}</dt>
        <dd className="text-pretty">
          {order.billingAddress ? (
            <AddressLines address={order.billingAddress} language={language} />
          ) : (
            missing
          )}
        </dd>
      </div>
      <div className="grid content-start gap-0.5">
        <dt className="text-xs font-medium text-muted-foreground">{t.orders.phone}</dt>
        <dd className="font-code">{order.phone ?? missing}</dd>
      </div>
      <div className="grid min-w-0 content-start gap-0.5 sm:col-span-2">
        <dt className="text-xs font-medium text-muted-foreground">{t.orders.email}</dt>
        <dd>{order.email ? <EmailAddress email={order.email} /> : missing}</dd>
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
  ebayDown,
  revealed,
  unlocking,
  onUnlock,
  isNew,
  confirmUnlock,
  enterIndex,
}: FiscalProps & {
  detailHref: string;
  selecting: boolean;
  selected: boolean;
  onSelect: (selected: boolean) => void;
  isNew: boolean;
  /** Posizione tra le schede comparse insieme, per l’ingresso scalato; assente per i nuovi ordini in cima. */
  enterIndex?: number;
}) {
  const action = useAction();
  const titleId = useId();
  const [first, second, ...rest] = order.items;
  const shown = [first, second].filter((item) => item !== undefined);
  return (
    // Un nuovo ordine entra con un breve ingresso; le schede esistenti si
    // spostano con un riordino FLIP invece di saltare.
    <m.article
      layout="position"
      initial={isNew ? { opacity: 0, y: -4 } : false}
      animate={{ opacity: 1, y: 0 }}
      aria-labelledby={titleId}
      style={
        enterIndex === undefined
          ? undefined
          : { animationDelay: `${Math.min(enterIndex, maxEnterSteps) * enterStep}ms` }
      }
      className={cn(
        enterIndex !== undefined &&
          "animate-[rise-in_var(--duration-fast)_var(--ease-smooth-out)_both] motion-reduce:animate-none",
        // Da due colonne la scheda occupa quattro righe condivise con quella accanto:
        // intestazione, articolo, acquirente e «Dettaglio» iniziano alla stessa altezza.
        "flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-4 transition-[border-color] duration-(--duration-quick) lg:row-span-4 lg:grid lg:grid-rows-subgrid",
        selected && "border-ring",
      )}
    >
      <header className="grid gap-0.5">
        <div className="flex items-center justify-between gap-3">
          <h2 id={titleId} className="text-[0.9375rem] leading-snug font-semibold">
            <Link
              to={detailHref}
              preventScrollReset
              className={cn(
                "rounded-sm outline-none hover:underline hover:underline-offset-4 focus-visible:ring-3 focus-visible:ring-ring",
                coarseTarget,
              )}
            >
              {t.order.title(order.ebayOrderId)}
            </Link>
          </h2>
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
                  <DropdownMenuItem onClick={() => action.run("open-on-ebay", { order: order.id })}>
                    {t.orders.openOnEbay}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => action.run("export", { ids: order.id })}>
                    {t.orders.exportOrder}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
        <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
          <time dateTime={order.createdAt} className="whitespace-nowrap">
            {formatDate(order.createdAt, language)}
          </time>
          <span aria-hidden="true">·</span>
          {/* Il punto ha la tinta del negozio, la stessa del suo avatar in Negozi. */}
          <span
            aria-hidden="true"
            className={cn("size-2 shrink-0 rounded-full", dotTones[toneFor(order.storeName)])}
          />
          <span className="text-pretty">
            {order.storeName}, {marketplaceLabel(order.marketplace)}
          </span>
        </p>
        <p className="mt-1.5 flex flex-wrap gap-1.5">
          <StatePill tone={paymentTone[order.payment]}>{t.orders.payment[order.payment]}</StatePill>
          <StatePill tone={shippingTone[order.shipping]}>
            {t.orders.shipping[order.shipping]}
          </StatePill>
        </p>
      </header>
      <div className="flex gap-3">
        {/* Miniatura sempre presente, così gli articoli partono allo stesso punto. */}
        {order.thumbnail ? (
          <img
            src={order.thumbnail}
            alt=""
            width="40"
            height="40"
            className="size-10 shrink-0 rounded-md border bg-muted object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="grid size-10 shrink-0 place-items-center rounded-md border bg-muted text-muted-foreground"
          >
            <Package className="size-4" />
          </span>
        )}
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
      {/* Colonna fiscale fissa, larga quanto il riquadro del codice: l'azione va
          sotto il riquadro invece di schiacciare la colonna dell'acquirente. */}
      <div className="grid content-start gap-x-4 gap-y-3 border-t pt-3 sm:grid-cols-[minmax(0,1fr)_14.5rem]">
        <p className="grid content-start gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">{t.order.buyer}</span>
          <span className="text-sm leading-snug font-medium text-pretty sm:min-h-10">
            {order.buyerName}
          </span>
        </p>
        <FiscalCodes
          order={order}
          t={t}
          language={language}
          account={account}
          ebayDown={ebayDown}
          revealed={revealed}
          unlocking={unlocking}
          onUnlock={onUnlock}
          confirmUnlock={confirmUnlock}
        />
        <FiscalNotes
          order={order}
          t={t}
          language={language}
          account={account}
          ebayDown={ebayDown}
          compact
        />
        <BuyerContacts order={order} t={t} language={language} />
      </div>
      {/* In fondo alla scheda, lontano dal menu delle azioni accanto all'importo. */}
      <footer className="flex justify-end">
        <Link
          to={detailHref}
          preventScrollReset
          className={cn(
            "inline-flex items-center gap-0.5 rounded-sm text-xs font-medium text-foreground underline decoration-border underline-offset-4 outline-none hover:decoration-foreground focus-visible:ring-3 focus-visible:ring-ring",
            coarseTarget,
          )}
        >
          {t.orders.details}
          <ChevronRight aria-hidden="true" className="size-3.5" />
        </Link>
      </footer>
    </m.article>
  );
}

/**
 * Spiegazioni complete del dato, suggerimento e richiesta all'acquirente,
 * nel riquadro in cima al pannello insieme al codice.
 */
function FiscalDetail({
  order,
  t,
  language,
  account,
  ebayDown,
  template,
}: Pick<FiscalProps, "order" | "t" | "language" | "account" | "ebayDown"> & {
  template: string;
}) {
  const notify = useNotice();
  return (
    <>
      <FiscalNotes
        order={order}
        t={t}
        language={language}
        account={account}
        ebayDown={ebayDown}
        compact={false}
      />
      {order.fiscal.state === "missing" ? (
        <div className="grid gap-3">
          {order.suggestion ? (
            <div className="grid gap-2 rounded-lg border bg-card p-3">
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
    </>
  );
}

function OrderDetail({ order, t, language }: { order: OrderView; t: AppCopy; language: Language }) {
  const row = "grid gap-0.5";
  return (
    <Tabs defaultValue="details" className="gap-0 px-4 pb-6">
      <TabsList variant="line" className="sticky top-0 z-10 mb-5 bg-popover">
        <TabsTrigger value="details">{t.order.tabDetails}</TabsTrigger>
        <TabsTrigger value="items">
          {t.order.tabItems} ({order.items.length})
        </TabsTrigger>
      </TabsList>
      <TabsContent value="details" className="grid gap-7">
        <section aria-labelledby="order-payment" className="grid gap-3">
          <h3 id="order-payment" className="text-sm font-semibold">
            {t.order.summary}
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
        <section aria-labelledby="order-buyer" className="grid gap-3 border-t pt-5">
          <h3 id="order-buyer" className="text-sm font-semibold">
            {t.order.buyer}
          </h3>
          <dl className="grid gap-3 text-sm">
            <div className={row}>
              <dt className="text-muted-foreground">{t.profile.name}</dt>
              <dd className="text-pretty">{order.buyerName}</dd>
            </div>
            <div className={row}>
              <dt className="text-muted-foreground">{t.order.username}</dt>
              <dd className="font-code">{order.buyerUsername}</dd>
            </div>
            <div className={row}>
              <dt className="text-muted-foreground">{t.orders.billingAddress}</dt>
              <dd className="text-pretty">
                {order.billingAddress ? (
                  <AddressLines address={order.billingAddress} language={language} />
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
              <dd>
                {order.email ? (
                  <EmailAddress email={order.email} />
                ) : (
                  <span className="text-muted-foreground">{t.orders.notProvided}</span>
                )}
              </dd>
            </div>
            <div className={row}>
              <dt className="text-muted-foreground">{t.order.recipient}</dt>
              <dd className="text-pretty">
                <span className="block">{order.shipTo.name}</span>
                <span className="block">
                  {order.shipTo.locality}, {countryName(order.shipTo.country, language)}
                </span>
              </dd>
            </div>
          </dl>
        </section>
      </TabsContent>
      <TabsContent value="items">
        <ul className="grid divide-y border-y">
          {order.items.map((item) => (
            <li key={item.id} className="grid gap-1.5 py-4 text-sm">
              <div className="flex items-start gap-3">
                {order.items.length === 1 && order.thumbnail ? (
                  <img
                    src={order.thumbnail}
                    alt=""
                    width="40"
                    height="40"
                    className="size-10 shrink-0 rounded-md border bg-muted object-cover"
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="grid size-10 shrink-0 place-items-center rounded-md border bg-muted text-muted-foreground"
                  >
                    <Package className="size-4" />
                  </span>
                )}
                <p className="leading-relaxed text-pretty font-medium">{item.title}</p>
              </div>
              <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>
                  {item.sku ? (
                    <>
                      {t.order.sku}: <span className="font-code">{item.sku}</span>
                    </>
                  ) : (
                    t.order.noSku
                  )}
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

interface FilterOption {
  value: string;
  label: string;
  /** Opzione del piano Premium: visibile con la corona ma non selezionabile. */
  premium?: boolean;
}

function FilterSelect({
  label,
  name,
  value,
  options,
  allLabel,
  premiumLabel,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  options: FilterOption[];
  allLabel: string;
  premiumLabel: string;
  onChange: (name: string, value: string) => void;
}) {
  const id = useId();
  const items: FilterOption[] = [{ value: "", label: allLabel }, ...options];
  // Un valore sconosciuto nell'URL vale come «Tutti», come fa il server.
  const current = items.some((item) => item.value === value && !item.premium) ? value : "";
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select items={items} value={current} onValueChange={(next) => onChange(name, next ?? "")}>
        <SelectTrigger id={id} className="w-full min-w-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="min-w-0">
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value} disabled={item.premium}>
              {item.label}
              {item.premium ? (
                <>
                  <StatusIcon tone="premium" className="ml-auto" />
                  <span className="text-xs">{premiumLabel}</span>
                </>
              ) : null}
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
  selectRef,
}: {
  data: OrdersPageData;
  t: AppCopy;
  selecting: boolean;
  onToggleSelect: () => void;
  selectRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const empty = data.total === 0;
  const action = useAction();
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
        {data.confirmUnlock === false ? (
          <Button
            variant="outline"
            size="sm"
            disabled={action.pending}
            onClick={() => action.run("unlock-confirmation")}
          >
            {t.orders.restoreUnlockConfirmation}
          </Button>
        ) : null}
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
          ref={selectRef}
          aria-pressed={selecting}
          disabled={empty && !selecting}
          focusableWhenDisabled
          onClick={onToggleSelect}
        >
          <ListChecks aria-hidden="true" data-icon="inline-start" />
          {t.orders.select}
        </Button>
      </div>
      <div
        id="orders-filters"
        className={cn(
          "grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 md:flex-1 md:grid-cols-3 xl:grid-cols-6",
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
            premiumLabel={t.orders.premiumOption}
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
            premiumLabel={t.orders.premiumOption}
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
            { value: "90", label: t.orders.last90, premium: data.account.plan !== "premium" },
          ]}
          allLabel={t.orders.all}
          premiumLabel={t.orders.premiumOption}
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
          premiumLabel={t.orders.premiumOption}
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
          premiumLabel={t.orders.premiumOption}
          onChange={change}
        />
        <FilterSelect
          label={t.orders.fiscalStatus}
          name="fiscale"
          value={params.get("fiscale") ?? ""}
          options={fiscalStates.map((state) => ({ value: state, label: t.orders.fiscal[state] }))}
          allLabel={t.orders.all}
          premiumLabel={t.orders.premiumOption}
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
  selected: string[];
  lockedSelected: string[];
  remaining: number | null;
  onUnlock: (ids: string[]) => void;
  onCancel: () => void;
}) {
  const action = useAction();
  const count = lockedSelected.length;
  const exceeds = remaining !== null && count > remaining;
  const bar = useRef<HTMLDivElement>(null);
  // L'altezza della barra solleva gli avvisi brevi della shell, che altrimenti la coprirebbero.
  useEffect(() => {
    const root = document.documentElement.style;
    const observer = new ResizeObserver(([entry]) =>
      root.setProperty("--selection-bar", `${entry!.borderBoxSize[0]!.blockSize}px`),
    );
    observer.observe(bar.current!);
    return () => {
      observer.disconnect();
      root.removeProperty("--selection-bar");
    };
  }, []);
  return (
    <div
      ref={bar}
      className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 mt-6 md:bottom-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-popover px-4 py-3 shadow-md">
        <p className="grid text-sm" aria-live="polite">
          <span className="font-medium">{t.orders.selected(selected.length)}</span>
          <span className="text-xs text-muted-foreground">{t.orders.selectedLocked(count)}</span>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button variant={count === 0 ? "secondary" : "default"} disabled={count === 0} />
              }
            >
              <UnlockIcon aria-hidden="true" data-icon="inline-start" />
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
            disabled={selected.length === 0}
            onClick={() => action.run("export", { ids: selected.join(",") })}
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
  // Durante il caricamento lo stato dell'aggiornamento non è ancora noto.
  const loading = data.view === "loading";
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
          ) : loading ? (
            <Skeleton aria-hidden="true" className="h-4 w-36" />
          ) : null
        }
      >
        {t.orders.title}
      </PageTitle>
      {loading ? null : <SyncStatus data={data} t={t} language={language} />}
    </header>
  );
}

function syncLabel(data: OrdersPageData, t: AppCopy, language: Language) {
  if (isEbayDown(data)) return t.orders.ebayDownTitle;
  const importing = importingNotice(data);
  if (importing) return t.orders.importingStatus(importing.count);
  if (data.sync.running) return t.orders.refreshingTitle;
  return data.sync.lastAt
    ? t.orders.syncedAgo(formatRelative(data.sync.lastAt, data.now, language))
    : null;
}

/** Importazione, aggiornamento o ultimo aggiornamento: un solo indicatore per la pagina. */
function SyncStatus({
  data,
  t,
  language,
}: {
  data: OrdersPageData;
  t: AppCopy;
  language: Language;
}) {
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
        <Spinner label={label} aria-hidden="true" role={undefined} />
      ) : (
        <Clock aria-hidden="true" className="size-4" />
      )}
      {label}
    </p>
  );
}

/** Negozio da ricollegare: l'avviso porta al suo pannello, dove si ricollega. */
export function StoreIssueAlert({
  storeId,
  storeName,
  t,
  links,
}: {
  storeId: string;
  storeName: string;
  t: AppCopy;
  links: AppLinks;
}) {
  return (
    <StatusAlert tone="warning" title={t.orders.storeIssueTitle(storeName)}>
      <span className="grid justify-items-start gap-3">
        {t.orders.storeIssueBody}
        <Link
          to={appHref(links, `negozi/${storeId}`)}
          data-slot="button"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          {t.orders.storeIssueAction}
        </Link>
      </span>
    </StatusAlert>
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
  if (data.notices.every((notice) => notice.kind === "importing")) return null;
  return (
    <div className="grid gap-3">
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
                    data-slot="button"
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    {t.orders.quotaAction}
                  </Link>
                </span>
              </StatusAlert>
            );
          case "store-issue":
            return (
              <StoreIssueAlert
                key={`${notice.kind}:${notice.storeId}`}
                storeId={notice.storeId}
                storeName={notice.storeName}
                t={t}
                links={links}
              />
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

function FirstUse({ data, t }: { data: OrdersPageData; t: AppCopy }) {
  const action = useAction();
  const current = data.onboarding.findIndex((step) => !step.done);
  return (
    <EmptyState
      title={t.orders.firstUseTitle}
      description={t.orders.firstUseBody}
      action={
        <Button onClick={() => action.run("store-connect")}>
          <Plus aria-hidden="true" data-icon="inline-start" />
          {t.orders.connectStore}
        </Button>
      }
    >
      <section aria-labelledby="onboarding" className="grid gap-2 border-t pt-4">
        <h3 id="onboarding" className="text-xs font-medium text-muted-foreground">
          {t.orders.steps}
        </h3>
        <ol className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2">
          {data.onboarding.map((step, index) => (
            <li
              key={step.label}
              aria-current={index === current ? "step" : undefined}
              className={cn(
                "flex items-center gap-2",
                !step.done && index !== current && "text-muted-foreground",
                index === current && "font-medium",
              )}
            >
              {step.done ? (
                <Check aria-hidden="true" className="size-4 text-success" />
              ) : (
                <span
                  aria-hidden="true"
                  className={cn(
                    "font-code grid size-4 place-items-center rounded-full text-[0.625rem]",
                    index === current ? "bg-primary text-primary-foreground" : "border",
                  )}
                >
                  {index + 1}
                </span>
              )}
              {t.orders[step.label]}
            </li>
          ))}
        </ol>
      </section>
    </EmptyState>
  );
}

function LoadingGrid({ t }: { t: AppCopy }) {
  return (
    <div
      aria-busy="true"
      className="grid gap-6 [&_[data-slot=skeleton]]:bg-border dark:[&_[data-slot=skeleton]]:bg-muted"
    >
      <span className="sr-only" role="status">
        {t.orders.loading}
      </span>
      {/* Stessa riga dei filtri dell'elenco, così i dati non spostano la pagina. */}
      <div
        aria-hidden="true"
        className="hidden gap-3 md:grid md:grid-cols-[repeat(4,minmax(0,1fr))_auto]"
      >
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="grid gap-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
        <Skeleton className="h-9 w-28 self-end justify-self-end" />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} aria-hidden="true" className="grid gap-3 rounded-xl border bg-card p-4">
            <div className="grid gap-1.5">
              <div className="flex justify-between gap-3">
                <Skeleton className="h-4 w-44" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="h-3 w-64 max-w-full" />
            </div>
            <div className="flex gap-3">
              <Skeleton className="size-10 shrink-0" />
              <div className="grid flex-1 content-start gap-1.5">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
            <div className="grid gap-3 border-t pt-3 sm:grid-cols-[minmax(0,1fr)_14rem]">
              <div className="grid content-start gap-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-36" />
              </div>
              <div className="grid content-start gap-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-10 w-56 max-w-full" />
              </div>
              <div className="grid content-start gap-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-40" />
              </div>
              <div className="grid content-start gap-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
            <Skeleton className="h-3 w-16 justify-self-end" />
          </div>
        ))}
      </div>
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
    submit: (ids: string[], skipConfirmation = false) =>
      void fetcher.submit(
        { intent: "unlock", ids: ids.join(","), skipConfirmation: String(skipConfirmation) },
        { method: "post", action: unlockAction },
      ),
    pending: new Set(
      fetcher.state === "idle" ? [] : String(fetcher.formData?.get("ids") ?? "").split(","),
    ),
    // Gli ordini appena sbloccati mostrano il dato con una dissolvenza.
    revealed: new Set(fetcher.data?.unlocked ?? []),
  };
}

function SearchChip({ t, clearable = true }: { t: AppCopy; clearable?: boolean }) {
  const location = useLocation();
  const navigate = useNavigate();
  const query = new URLSearchParams(location.search).get("q");
  if (!query) return null;
  return (
    <p className="-mt-2 flex items-center gap-2 text-sm">
      <span className="text-pretty">{t.orders.searchActive(query)}</span>
      {clearable ? (
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
      ) : null}
    </p>
  );
}

function LoadMore({ data, t }: { data: OrdersPageData; t: AppCopy }) {
  const [params] = useSearchParams();
  return (
    <div className="flex justify-center">
      {data.nextHref ? (
        <Link
          to={data.nextHref}
          preventScrollReset
          data-slot="button"
          className={buttonVariants({ variant: "outline" })}
        >
          {t.orders.loadMore}
        </Link>
      ) : (
        <p className="text-sm text-muted-foreground">
          {importingNotice(data)
            ? t.orders.importMore
            : ["7", "30", "90"].includes(params.get("periodo") ?? "")
              ? t.orders.allShown
              : t.orders.allShownAll}
        </p>
      )}
    </div>
  );
}

/** Ritardo tra una scheda e la successiva quando compaiono insieme, fino a un massimo di passi. */
const enterStep = 40;
const maxEnterSteps = 6;

/** Distanza dall'inizio della pagina entro cui l'utente è considerato in cima alla lista. */
const topThreshold = 120;

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
  const ebayDown = isEbayDown(data);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const selectRef = useRef<HTMLButtonElement>(null);
  const [showIncoming, setShowIncoming] = useState(false);
  // Nuovi ordini: inseriti subito se l'utente è in cima alla lista e non sta
  // selezionando; altrimenti resta l'indicatore, così nulla si sposta mentre legge.
  const hasIncoming = data.incoming.length > 0;
  const insertAtTop = useEffectEvent(() => {
    if (window.scrollY < topThreshold && !selecting) setShowIncoming(true);
  });
  useEffect(() => {
    if (!hasIncoming) return;
    insertAtTop();
    window.addEventListener("scroll", insertAtTop, { passive: true });
    return () => window.removeEventListener("scroll", insertAtTop);
  }, [hasIncoming]);
  const stopSelecting = () => {
    setSelecting(false);
    setSelected(new Set());
    selectRef.current?.focus();
  };
  const submit = (ids: string[], skipConfirmation = false) => {
    stopSelecting();
    unlock.submit(ids, skipConfirmation);
  };
  const ordersHref = appHref(links, "ordini");
  // La lista resta dal più recente anche quando i nuovi ordini arrivano in un ordine diverso.
  const orders = showIncoming
    ? [...[...data.incoming].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), ...data.orders]
    : data.orders;
  const incomingIds = new Set(data.incoming.map((order) => order.id));
  // Ogni scheda riceve la sua posizione d'ingresso la prima volta che compare e la
  // conserva: con «Carica altri» entrano soltanto le nuove, dalla prima in giù.
  const enterIndexes = useRef(new Map<string, number>()).current;
  const entering = orders.filter(
    (order) => !enterIndexes.has(order.id) && !incomingIds.has(order.id),
  );
  entering.forEach((order, index) => enterIndexes.set(order.id, index));
  const lockedSelected = orders
    .filter((order) => selected.has(order.id) && order.fiscal.state === "locked")
    .map((order) => order.id);
  const criteria = new URLSearchParams(location.search);
  criteria.delete("mostra");
  const onlySearch = criteria.has("q") && [...criteria.keys()].every((key) => key === "q");
  return (
    <>
      <OrdersToolbar
        data={data}
        t={t}
        selecting={selecting}
        selectRef={selectRef}
        onToggleSelect={() => (selecting ? stopSelecting() : setSelecting(true))}
      />
      <SearchChip t={t} clearable={orders.length > 0 || !onlySearch} />
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
          className="rounded-xl border bg-card px-5"
          title={t.orders.noResultsTitle}
          description={onlySearch ? t.orders.noSearchResultsBody : t.orders.noResultsBody}
          action={
            criteria.size > 0 ? (
              <Link
                to={ordersHref}
                preventScrollReset
                data-slot="button"
                className={buttonVariants({ variant: "outline" })}
              >
                {onlySearch ? t.orders.clearSearch : t.orders.resetFilters}
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          <LazyMotion features={domMax} strict>
            <MotionConfig
              reducedMotion="user"
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              <section aria-label={t.orders.list} className="grid gap-3 lg:grid-cols-2">
                {orders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    t={t}
                    language={language}
                    account={data.account}
                    ebayDown={ebayDown}
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
                    confirmUnlock={data.confirmUnlock}
                    isNew={showIncoming && incomingIds.has(order.id)}
                    enterIndex={enterIndexes.get(order.id)}
                  />
                ))}
              </section>
            </MotionConfig>
          </LazyMotion>
          <LoadMore data={data} t={t} />
        </>
      )}
      {selecting ? (
        <SelectionBar
          t={t}
          selected={[...selected]}
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
  const action = useAction();
  const ebayDown = isEbayDown(data);
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
          className="sm:max-w-lg outline-none"
          header={
            <SheetHeader>
              <SheetTitle>{t.order.title(shown.ebayOrderId)}</SheetTitle>
              <SheetDescription className="text-pretty">
                {formatDate(shown.createdAt, language)} · {shown.buyerName}
              </SheetDescription>
            </SheetHeader>
          }
        >
          <div className="flex flex-wrap gap-2 px-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => action.run("open-on-ebay", { order: shown.id })}
            >
              {t.orders.openOnEbay}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => action.run("export", { ids: shown.id })}
            >
              {t.orders.exportOrder}
            </Button>
          </div>
          {/* Il dato fiscale, protagonista, resta visibile sopra le schede Dettagli e Articoli. */}
          <div className="mx-4 mb-5 grid gap-3 rounded-xl border bg-muted/30 p-3">
            <FiscalCodes
              order={shown}
              t={t}
              language={language}
              account={data.account}
              ebayDown={ebayDown}
              revealed={unlock.revealed.has(shown.id)}
              unlocking={unlock.pending.has(shown.id)}
              onUnlock={unlock.submit}
              confirmUnlock={data.confirmUnlock}
            />
            <FiscalDetail
              order={shown}
              t={t}
              language={language}
              account={data.account}
              ebayDown={ebayDown}
              template={data.messageTemplate}
            />
          </div>
          <OrderDetail order={shown} t={t} language={language} />
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
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <OrdersHeader data={data} t={t} language={language} />
      <OrdersNotices data={data} t={t} language={language} links={links} />
      {data.view === "no-store" ? (
        <FirstUse data={data} t={t} />
      ) : data.view === "loading" ? (
        <LoadingGrid t={t} />
      ) : data.view === "empty" ? (
        <EmptyState
          variant="all-clear"
          title={t.orders.noOrdersTitle}
          description={t.orders.noOrdersBody(
            data.sync.storeName ?? "",
            data.sync.lastAt ? formatDate(data.sync.lastAt, language) : "",
          )}
          action={
            data.sync.storeId ? (
              <Link
                to={appHref(links, `negozi/${data.sync.storeId}`)}
                data-slot="button"
                className={buttonVariants({ variant: "outline" })}
              >
                {t.orders.openStore}
              </Link>
            ) : undefined
          }
        />
      ) : (
        <OrdersList data={data} t={t} links={links} unlock={unlock} />
      )}
      <OrderSheet data={data} t={t} links={links} unlock={unlock} />
    </div>
  );
}
