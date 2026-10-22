import { cn } from "cn";
import { ChevronRight, EllipsisVertical, Package } from "lucide-react";
import { m } from "motion/react";
import { useId } from "react";
import { Link } from "react-router";

import { dotTones, toneFor } from "~/components/tile-tone";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLinkItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import type { AppCopy } from "../../app-copy";
import { formatAmount, type Language } from "../../i18n";
import {
  addressRows,
  formatDate,
  marketplaceLabel,
  type AddressView,
  type ContactsView,
  type OrderView,
} from "../../view-models";
import { CopyButton } from "~/components/tax-code";
import { FiscalCodes, FiscalNotes, type FiscalProps } from "./fiscal";
import { ebayOrderHref, fromListState, missingContact } from "./labels";
import { buyerLabel, paymentLabel, shippingLabel, type PillTone } from "./status";

/** Azioni secondarie disponibili nella pagina: eBay ed esportazione del singolo ordine. */
export interface SecondaryActions {
  /** Solo per i negozi eBay reali: per la Sandbox non esiste un indirizzo verificato. */
  openOnEbay: boolean;
  /** Esiste la sezione Esportazione, che riceve selezione, filtri e ricerca degli Ordini. */
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

function AddressLines({
  address,
  language,
  copy,
}: {
  address: AddressView;
  language: Language;
  /** Etichette del pulsante Copia; senza, l'indirizzo è soltanto mostrato. */
  copy?: CopyLabels;
}) {
  const rows = addressRows(address, language);
  const [first, second, third] = rows;
  return (
    <span className="inline-flex max-w-full flex-wrap items-start gap-1">
      <span className="min-w-0 [overflow-wrap:anywhere]">
        {first ? <span className="block">{first}</span> : null}
        {second ? <span className="block">{second}</span> : null}
        {third ? <span className="block">{third}</span> : null}
      </span>
      {copy ? <CopyButton value={rows.join("\n")} labels={copy} tone="neutral" /> : null}
    </span>
  );
}

export type CopyLabels = { copy: string; copied: string; copyFailed: string };

/** Indirizzo anche parziale; l'assenza della via mascherata resta esplicita. */
export function BuyerAddress({
  order,
  t,
  language,
  copy,
}: {
  order: OrderView;
  t: AppCopy;
  language: Language;
  copy?: CopyLabels;
}) {
  const address = order.contacts.billingAddress;
  const masked = order.maskedContacts?.includes("billingAddress");
  if (!address)
    return (
      <span className="text-muted-foreground">{missingContact(order, "billingAddress", t)}</span>
    );
  return (
    <>
      <AddressLines address={address} language={language} copy={masked ? undefined : copy} />
      {masked ? (
        <span className="block text-muted-foreground">{t.orders.maskedContact}</span>
      ) : null}
    </>
  );
}

const contactLink =
  "rounded-sm underline decoration-muted-foreground/40 underline-offset-4 outline-none hover:decoration-current focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Telefono nella forma internazionale, da toccare per chiamare; un numero non riconosciuto
 * resta com'è e non diventa un collegamento.
 */
export function PhoneNumber({
  phone,
  view,
  copy,
}: {
  phone: string;
  view: ContactsView["phone"];
  copy?: CopyLabels;
}) {
  if (!view) return <span className="font-code [overflow-wrap:anywhere]">{phone}</span>;
  return (
    <span className="inline-flex max-w-full flex-wrap items-center gap-1">
      <a
        href={`tel:${view.international}`}
        className={cn("font-code min-w-0 [overflow-wrap:anywhere]", contactLink)}
      >
        {view.display}
      </a>
      {copy ? <CopyButton value={view.international} labels={copy} tone="neutral" /> : null}
    </span>
  );
}

/** Email da aprire nel programma di posta; una forma non riconosciuta resta testo. */
export function EmailLink({
  email,
  view,
  copy,
}: {
  email: string;
  view: ContactsView["email"];
  copy?: CopyLabels;
}) {
  if (!view || view.relay) return <EmailAddress email={view?.address ?? email} />;
  return (
    <span className="inline-flex max-w-full flex-wrap items-center gap-1">
      <a
        href={`mailto:${view.address}`}
        className="group/email min-w-0 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {/* Le parti in blocco non ereditano la sottolineatura del collegamento. */}
        <EmailAddress
          email={view.address}
          className="underline decoration-muted-foreground/40 underline-offset-4 group-hover/email:decoration-current"
        />
      </a>
      {copy ? <CopyButton value={view.address} labels={copy} tone="neutral" /> : null}
    </span>
  );
}

function EmailAddress({ email, className }: { email: string; className?: string }) {
  const separator = email.lastIndexOf("@");
  const local = separator < 0 ? email : email.slice(0, separator);
  const domain = separator < 0 ? null : email.slice(separator);
  return (
    <>
      <span className={cn("inline-block max-w-full [overflow-wrap:anywhere]", className)}>
        {local}
      </span>
      {domain === null ? null : (
        <>
          <wbr />
          <span className={cn("inline-block max-w-full [overflow-wrap:anywhere]", className)}>
            {domain}
          </span>
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
  return (
    <dl className="grid gap-x-4 gap-y-2 text-sm leading-snug sm:col-span-2 sm:grid-cols-subgrid">
      <div className="grid content-start gap-0.5">
        <dt className="text-xs font-medium text-muted-foreground">{t.orders.billingAddress}</dt>
        <dd className="min-w-0 text-pretty [overflow-wrap:anywhere]">
          <BuyerAddress order={order} t={t} language={language} />
        </dd>
      </div>
      <div className="grid content-start gap-0.5">
        <dt className="text-xs font-medium text-muted-foreground">{t.orders.phone}</dt>
        <dd className="min-w-0 [overflow-wrap:anywhere]">
          {order.phone ? (
            <PhoneNumber phone={order.phone} view={order.contacts.phone} />
          ) : (
            <span className="text-muted-foreground">{missingContact(order, "phone", t)}</span>
          )}
        </dd>
      </div>
      <div className="grid min-w-0 content-start gap-0.5 sm:col-span-2">
        <dt className="text-xs font-medium text-muted-foreground">{t.orders.email}</dt>
        <dd>
          {order.email ? (
            <EmailLink email={order.email} view={order.contacts.email} />
          ) : (
            <span className="text-muted-foreground">{missingContact(order, "email", t)}</span>
          )}
        </dd>
      </div>
    </dl>
  );
}

/** Menu delle azioni secondarie; assente se la pagina non ne offre. */
function OrderMenu({
  order,
  t,
  actions,
  exportHref,
}: {
  order: OrderView;
  t: AppCopy;
  actions: SecondaryActions;
  exportHref: string | null;
}) {
  if (!actions.openOnEbay && !exportHref) return null;
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
          <DropdownMenuLinkItem
            href={ebayOrderHref(order.ebayOrderId)}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t.orders.openOnEbay}
          </DropdownMenuLinkItem>
        ) : null}
        {exportHref ? (
          <DropdownMenuLinkItem render={<Link to={exportHref} />}>
            {t.orders.exportOrder}
          </DropdownMenuLinkItem>
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
  exportHref,
}: FiscalProps & {
  detailHref: string;
  /** Esportazione del solo ordine, con il contesto dell'elenco; null se non disponibile. */
  exportHref: string | null;
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
              state={fromListState}
              preventScrollReset
              data-order-link={order.id}
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
              <OrderMenu order={order} t={t} actions={actions} exportHref={exportHref} />
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
          <span className="text-sm leading-snug font-medium text-pretty [overflow-wrap:anywhere] sm:min-h-10">
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
          state={fromListState}
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
