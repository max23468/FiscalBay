import { cn } from "cn";
import { ChevronRight, EllipsisVertical, Package } from "lucide-react";
import { m } from "motion/react";
import { useId } from "react";
import { Link } from "react-router";

import { useAction } from "~/components/app-shell";
import { dotTones, toneFor } from "~/components/tile-tone";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import type { AppCopy } from "../../app-copy";
import { formatAmount, type Language } from "../../i18n";
import {
  countryName,
  formatDate,
  marketplaceLabel,
  type AddressView,
  type OrderView,
} from "../../view-models";
import { FiscalCodes, FiscalNotes, type FiscalProps } from "./fiscal";
import { buyerLabel, paymentLabel, shippingLabel, type PillTone } from "./status";

/** Azioni secondarie disponibili nella pagina: eBay ed esportazione del singolo ordine. */
export interface SecondaryActions {
  openOnEbay: boolean;
  exportable: boolean;
}

/** Stato di pagamento o spedizione: etichetta tinta, il testo resta la fonte. */
function StatePill({ tone, children }: { tone: PillTone; children: string }) {
  return <Badge variant={tone}>{children}</Badge>;
}

/** Area di tocco invisibile di almeno 44 px per i collegamenti testuali, come per i pulsanti. */
const coarseTarget =
  "relative pointer-coarse:after:absolute pointer-coarse:after:-inset-x-2 pointer-coarse:after:-inset-y-3";

/** Ritardo tra una scheda e la successiva quando compaiono insieme, fino a un massimo di passi. */
const enterStep = 40;
const maxEnterSteps = 6;

export function AddressLines({ address, language }: { address: AddressView; language: Language }) {
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

export function EmailAddress({ email }: { email: string }) {
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

/** Miniatura dell'articolo, o un segnaposto della stessa misura. */
export function ItemThumbnail({ src }: { src?: string }) {
  return src ? (
    <img
      src={src}
      alt=""
      width="40"
      height="40"
      loading="lazy"
      referrerPolicy="no-referrer"
      className="size-10 shrink-0 rounded-md border bg-muted object-cover"
    />
  ) : (
    <span
      aria-hidden="true"
      className="grid size-10 shrink-0 place-items-center rounded-md border bg-muted text-muted-foreground"
    >
      <Package className="size-4" />
    </span>
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

/** Menu delle azioni secondarie; assente se la pagina non ne offre. */
function OrderMenu({
  order,
  t,
  actions,
}: {
  order: OrderView;
  t: AppCopy;
  actions: SecondaryActions;
}) {
  const action = useAction();
  if (!actions.openOnEbay && !actions.exportable) return null;
  return (
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
        {actions.openOnEbay ? (
          <DropdownMenuItem onClick={() => action.run("open-on-ebay", { order: order.id })}>
            {t.orders.openOnEbay}
          </DropdownMenuItem>
        ) : null}
        {actions.exportable ? (
          <DropdownMenuItem onClick={() => action.run("export", { ids: order.id })}>
            {t.orders.exportOrder}
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function OrderCard({
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
  actions,
}: FiscalProps & {
  detailHref: string;
  selecting: boolean;
  selected: boolean;
  onSelect: (selected: boolean) => void;
  isNew: boolean;
  /** Posizione tra le schede comparse insieme, per l’ingresso scalato; assente per i nuovi ordini in cima. */
  enterIndex?: number;
  actions: SecondaryActions;
}) {
  const titleId = useId();
  const [first, second, ...rest] = order.items;
  const shown = [first, second].filter((item) => item !== undefined);
  const payment = paymentLabel(order, t);
  const shipping = shippingLabel(order, t);
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
          <h2 id={titleId} className="min-w-0 text-[0.9375rem] leading-snug font-semibold">
            <Link
              to={detailHref}
              preventScrollReset
              className={cn(
                "rounded-sm break-words outline-none hover:underline hover:underline-offset-4 focus-visible:ring-3 focus-visible:ring-ring",
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
              <OrderMenu order={order} t={t} actions={actions} />
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
          <span className="min-w-0 text-pretty break-words">
            {order.storeName}
            {order.marketplace ? `, ${marketplaceLabel(order.marketplace)}` : null}
          </span>
        </p>
        <p className="mt-1.5 flex flex-wrap gap-1.5">
          <StatePill tone={payment.tone}>{payment.label}</StatePill>
          <StatePill tone={shipping.tone}>{shipping.label}</StatePill>
          {order.reconciliationIssue ? (
            <StatePill tone="warning">{t.orders.reconciliationTitle}</StatePill>
          ) : null}
        </p>
      </header>
      <div className="flex gap-3">
        {/* Miniatura sempre presente, così gli articoli partono allo stesso punto. */}
        <ItemThumbnail src={order.thumbnail} />
        <ul className="grid min-w-0 content-start gap-1 text-sm leading-snug">
          {shown.map((item, index) => (
            <li
              key={item.id}
              className={cn(
                "line-clamp-2 text-pretty break-words",
                index > 0 && "text-muted-foreground",
              )}
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
        <p className="grid min-w-0 content-start gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">{t.order.buyer}</span>
          <span className="text-sm leading-snug font-medium text-pretty break-words sm:min-h-10">
            {buyerLabel(order, t)}
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
