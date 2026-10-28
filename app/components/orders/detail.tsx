import { cn } from "cn";
import { useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";

import { StatusAlert } from "~/components/status";
import { CopyButton } from "~/components/tax-code";
import { buttonLink } from "~/components/ui/button-variants";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { appHref } from "../../app-links";
import { formatAmount, type Language } from "../../i18n";
import { buyerNameView, contactText } from "../../contact";
import { exportOrderHref, exportSection } from "../../orders/export-scope";
import { itemPrice, marketplaceLabel, type OrderView } from "../../view-models";
import { countryName, formatDate } from "../../format";
import { BuyerAddress, EmailLink, ItemThumbnail, PhoneNumber, type SecondaryActions } from "./card";
import { FiscalCodes, FiscalNotes, MissingOrderHelp, type FiscalProps } from "./fiscal";
import type { OrdersAccount } from "./labels";
import {
  billingCopyText,
  contactCopyLabels,
  fromListState,
  missingContact,
  orderLinkSelector,
} from "./labels";
import { ebayListingHref, ebayOrderHref } from "../../orders/ebay-links";
import { buyerLabel, paymentLabel, shippingLabel } from "./status";
import { useTimeZone } from "~/components/time-zone";
import { useCopy, useLinks } from "~/components/copy-context";

/**
 * Spiegazioni complete del dato, suggerimento e richiesta all'acquirente,
 * nel riquadro in cima al pannello insieme al codice.
 */
function FiscalDetail({
  order,
  account,
  ebayDown,
  templates,
}: Pick<FiscalProps, "order" | "account" | "ebayDown"> & {
  templates: Record<Language, string>;
}) {
  const { t, language } = useCopy();
  const zone = useTimeZone();
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <FiscalNotes order={order} account={account} ebayDown={ebayDown} compact={false} />
      {order.fiscal.state === "missing" ? (
        <MissingOrderHelp key={order.id} order={order} templates={templates} />
      ) : null}
      {order.lastSyncedAt ? (
        <p className="text-xs text-muted-foreground">
          {t.order.source(formatDate(order.lastSyncedAt, language, "dateTime", zone))}
        </p>
      ) : null}
    </div>
  );
}

function ItemPrice({ item }: { item: OrderView["items"][number] }) {
  const { t, language } = useCopy();
  const price = itemPrice(item);
  return (
    <span>
      {price && !price.unit ? t.order.lineAmount : t.order.price}:{" "}
      {price ? (
        <span className="font-code">{formatAmount(price.minor, item.currency, language)}</span>
      ) : (
        t.orders.notProvided
      )}
    </span>
  );
}

function Recipient({ order }: { order: OrderView }) {
  const { t, language } = useCopy();
  const recipient = order.shipTo;
  if (!recipient)
    return <span className="text-muted-foreground">{missingContact(order, "recipient", t)}</span>;
  const locality = [
    recipient.locality ? contactText(recipient.locality) : null,
    recipient.country ? countryName(recipient.country, language) : null,
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <>
      <span className="block">
        {buyerNameView(recipient.name) ?? missingContact(order, "recipient", t)}
      </span>
      {locality ? <span className="block">{locality}</span> : null}
    </>
  );
}

function OrderDetail({ order }: { order: OrderView }) {
  const { t, language } = useCopy();
  const zone = useTimeZone();
  const row = "grid min-w-0 gap-0.5 [overflow-wrap:anywhere]";
  const missing = <span className="text-muted-foreground">{t.orders.notProvided}</span>;
  const billing = billingCopyText(order, language, t);
  return (
    <Tabs defaultValue="details" className="gap-0 px-4 pb-6">
      <TabsList variant="line" className="sticky top-0 z-10 mb-5 bg-popover">
        <TabsTrigger value="details">{t.order.tabDetails}</TabsTrigger>
        <TabsTrigger value="items">
          {t.order.tabItems} ({order.items.length})
        </TabsTrigger>
      </TabsList>
      <TabsContent value="details" className="grid gap-7">
        {order.reconciliationIssue ? (
          <StatusAlert tone="warning" title={t.orders.reconciliationTitle}>
            {t.orders.reconciliationBody}
          </StatusAlert>
        ) : null}
        <section aria-labelledby="order-payment" className="grid gap-3">
          <h3 id="order-payment" className="text-sm font-semibold">
            {t.order.summary}
          </h3>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div className={row}>
              <dt className="text-muted-foreground">{t.orders.paymentStatus}</dt>
              <dd className="break-words">{paymentLabel(order, t).label}</dd>
            </div>
            <div className={row}>
              <dt className="text-muted-foreground">{t.orders.shippingStatus}</dt>
              <dd className="break-words">{shippingLabel(order, t).label}</dd>
            </div>
            <div className={row}>
              <dt className="text-muted-foreground">{t.order.total}</dt>
              <dd className="font-code font-medium">
                {formatAmount(order.totalMinor, order.currency, language)}
              </dd>
            </div>
            <div className={row}>
              <dt className="text-muted-foreground">{t.order.created}</dt>
              <dd>
                <time dateTime={order.createdAt}>
                  {formatDate(order.createdAt, language, "dateTime", zone)}
                </time>
              </dd>
            </div>
            {order.marketplace ? (
              <div className={row}>
                <dt className="text-muted-foreground">{t.order.marketplace}</dt>
                <dd>{marketplaceLabel(order.marketplace)}</dd>
              </div>
            ) : null}
            <div className={cn(row, "col-span-2")}>
              <dt className="text-muted-foreground">{t.order.store}</dt>
              <dd className="text-pretty break-words">{order.storeName}</dd>
            </div>
          </dl>
        </section>
        <section aria-labelledby="order-buyer" className="grid gap-3 border-t pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id="order-buyer" className="text-sm font-semibold">
              {t.order.buyer}
            </h3>
            {billing ? (
              <CopyButton
                key={order.id}
                value={billing}
                labels={{
                  ...contactCopyLabels(t.orders.billingData, order.ebayOrderId, t),
                  copy: t.orders.copyBillingData,
                }}
                tone="neutral"
                text={t.orders.copyBillingData}
              />
            ) : null}
          </div>
          <dl className="grid gap-3 text-sm">
            <div className={row}>
              <dt className="text-muted-foreground">{t.profile.name}</dt>
              <dd className="text-pretty [overflow-wrap:anywhere]">
                {buyerNameView(order.buyerName) ?? missingContact(order, "name", t)}
              </dd>
            </div>
            <div className={row}>
              <dt className="text-muted-foreground">{t.order.username}</dt>
              <dd className="font-code break-words">{order.buyerUsername ?? missing}</dd>
            </div>
            <div className={row}>
              <dt className="text-muted-foreground">{t.orders.billingAddress}</dt>
              <dd className="text-pretty">
                <BuyerAddress
                  order={order}
                  copy={contactCopyLabels(t.orders.billingAddress, order.ebayOrderId, t)}
                />
              </dd>
            </div>
            <div className={row}>
              <dt className="text-muted-foreground">{t.orders.phone}</dt>
              <dd>
                {order.phone ? (
                  <PhoneNumber
                    phone={order.phone}
                    view={order.contacts.phone}
                    copy={contactCopyLabels(t.orders.phone, order.ebayOrderId, t)}
                  />
                ) : (
                  <span className="text-muted-foreground">{missingContact(order, "phone", t)}</span>
                )}
              </dd>
            </div>
            <div className={row}>
              <dt className="text-muted-foreground">{t.orders.email}</dt>
              <dd>
                {order.email ? (
                  <EmailLink
                    email={order.email}
                    view={order.contacts.email}
                    copy={contactCopyLabels(t.orders.email, order.ebayOrderId, t)}
                  />
                ) : (
                  <span className="text-muted-foreground">{missingContact(order, "email", t)}</span>
                )}
              </dd>
            </div>
            <div className={row}>
              <dt className="text-muted-foreground">{t.order.recipient}</dt>
              <dd className="text-pretty break-words">
                <Recipient order={order} />
              </dd>
            </div>
          </dl>
        </section>
        <section aria-labelledby="order-update" className="grid gap-3 border-t pt-5">
          <h3 id="order-update" className="text-sm font-semibold">
            {t.order.update}
          </h3>
          <dl className="grid gap-3 text-sm">
            <div className={row}>
              <dt className="text-muted-foreground">{t.order.updatedOnEbay}</dt>
              <dd>
                <time dateTime={order.updatedAt}>
                  {formatDate(order.updatedAt, language, "dateTime", zone)}
                </time>
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
                {/* La miniatura dell'ordine appartiene all'articolo solo se è l'unico. */}
                <ItemThumbnail src={order.items.length === 1 ? order.thumbnail : undefined} />
                <p className="min-w-0 leading-relaxed text-pretty [overflow-wrap:anywhere] font-medium">
                  {item.title}
                </p>
              </div>
              <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>
                  {item.sku ? (
                    <>
                      {t.order.sku}: <span className="font-code break-all">{item.sku}</span>
                    </>
                  ) : (
                    t.order.noSku
                  )}
                </span>
                <span>
                  {t.orders.quantity}: <span className="font-code">{item.quantity}</span>
                </span>
                <ItemPrice item={item} />
                {item.listingId ? (
                  <a
                    href={ebayListingHref(item.listingId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-foreground underline underline-offset-4 hover:no-underline"
                  >
                    {t.order.viewListing}
                  </a>
                ) : null}
              </p>
            </li>
          ))}
        </ul>
      </TabsContent>
    </Tabs>
  );
}

function openedFromList(state: unknown) {
  return (state as Partial<typeof fromListState> | null)?.fromList === true;
}

/**
 * Pannello del dettaglio con indirizzo proprio; chiuderlo torna all'elenco con gli stessi
 * criteri. Aperto dall'elenco, la chiusura torna alla sua voce della cronologia, così Indietro
 * non riapre il pannello; da un collegamento diretto o dopo una ricarica senza quella voce
 * sostituisce il dettaglio con l'elenco.
 */
export function OrderSheet({
  detail,
  account,
  ebayDown,
  templates,
  confirmUnlock,
  unlock,
  actions,
}: {
  detail: OrderView | null;
  account: OrdersAccount;
  ebayDown: boolean;
  templates: Record<Language, string>;
  confirmUnlock?: boolean;
  unlock: {
    submit: (ids: string[], skipConfirmation?: boolean) => void;
    pending: ReadonlySet<string>;
    revealed: ReadonlySet<string>;
  };
  actions: SecondaryActions;
}) {
  const { links } = useLinks();
  const { t } = useCopy();
  const zone = useTimeZone();
  const { language } = links;
  const location = useLocation();
  const navigate = useNavigate();
  // Il pannello conserva l'ultimo ordine durante l'animazione di chiusura.
  const [shown, setShown] = useState(detail);
  if (detail && detail !== shown) setShown(detail);
  // Il focus va sul pannello: la lettura parte dal titolo e la vista resta in cima.
  const panel = useRef<HTMLDivElement>(null);
  return (
    <Sheet
      open={detail !== null}
      onOpenChange={(open) => {
        if (!open) {
          if (openedFromList(location.state)) void navigate(-1);
          else
            void navigate(`${appHref(links, "ordini")}${location.search}`, {
              replace: true,
              preventScrollReset: true,
            });
        }
      }}
    >
      {shown ? (
        <SheetContent
          ref={panel}
          initialFocus={panel}
          // Il focus torna sulla scheda dell'ordine, se è fra quelle caricate, anche da un
          // collegamento diretto o quando il browser non dà il focus al link cliccato.
          finalFocus={() => document.querySelector<HTMLElement>(orderLinkSelector(shown.id))}
          closeLabel={t.shell.close}
          className="outline-none"
          header={
            <SheetHeader>
              <SheetTitle className="break-words">{t.order.title(shown.ebayOrderId)}</SheetTitle>
              <SheetDescription className="text-pretty [overflow-wrap:anywhere]">
                {formatDate(shown.createdAt, language, "dateTime", zone)} · {buyerLabel(shown, t)}
              </SheetDescription>
            </SheetHeader>
          }
        >
          {actions.openOnEbay || actions.exportable ? (
            <div className="flex flex-wrap gap-2 px-4">
              {actions.openOnEbay ? (
                <a
                  href={ebayOrderHref(shown.ebayOrderId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  {...buttonLink({ variant: "outline", size: "sm" })}
                >
                  {t.orders.openOnEbay}
                </a>
              ) : null}
              {actions.exportable ? (
                <Link
                  to={exportOrderHref(
                    appHref(links, exportSection),
                    new URLSearchParams(location.search),
                    shown.id,
                  )}
                  {...buttonLink({ variant: "outline", size: "sm" })}
                >
                  {t.orders.exportOrder}
                </Link>
              ) : null}
            </div>
          ) : null}
          {/* Il dato fiscale, protagonista, resta visibile sopra le schede Dettagli e Articoli. */}
          <div className="mx-4 mb-5 grid gap-3 rounded-xl border bg-muted/30 p-3">
            <FiscalCodes
              order={shown}
              account={account}
              ebayDown={ebayDown}
              revealed={unlock.revealed.has(shown.id)}
              unlocking={unlock.pending.has(shown.id)}
              onUnlock={unlock.submit}
              confirmUnlock={confirmUnlock}
            />
            <FiscalDetail
              order={shown}
              account={account}
              ebayDown={ebayDown}
              templates={templates}
            />
          </div>
          <OrderDetail order={shown} />
        </SheetContent>
      ) : null}
    </Sheet>
  );
}
