import { cn } from "cn";
import { useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";

import { useAction } from "~/components/app-shell";
import { StatusAlert } from "~/components/status";
import { CopyButton } from "~/components/tax-code";
import { Button } from "~/components/ui/button";
import { buttonVariants } from "~/components/ui/button-variants";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import type { AppCopy } from "../../app-copy";
import { appHref, type AppLinks } from "../../app-links";
import { formatAmount, type Language } from "../../i18n";
import { buyerNameView, contactText } from "../../contact";
import {
  countryName,
  formatDate,
  itemPrice,
  marketplaceLabel,
  type OrderView,
} from "../../view-models";
import { BuyerAddress, EmailLink, ItemThumbnail, PhoneNumber, type SecondaryActions } from "./card";
import {
  FiscalCodes,
  FiscalNotes,
  MissingOrderHelp,
  type FiscalProps,
  type OrdersAccount,
} from "./fiscal";
import { billingCopyText, contactCopyLabels, ebayOrderHref, missingContact } from "./labels";
import { buyerLabel, paymentLabel, shippingLabel } from "./status";

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
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <FiscalNotes
        order={order}
        t={t}
        language={language}
        account={account}
        ebayDown={ebayDown}
        compact={false}
      />
      {order.fiscal.state === "missing" ? (
        <MissingOrderHelp
          key={order.id}
          order={order}
          t={t}
          language={language}
          template={template}
        />
      ) : null}
      {order.lastSyncedAt ? (
        <p className="text-xs text-muted-foreground">
          {t.order.source(formatDate(order.lastSyncedAt, language))}
        </p>
      ) : null}
    </div>
  );
}

function ItemPrice({
  item,
  t,
  language,
}: {
  item: OrderView["items"][number];
  t: AppCopy;
  language: Language;
}) {
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

function Recipient({ order, t, language }: { order: OrderView; t: AppCopy; language: Language }) {
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

function OrderDetail({ order, t, language }: { order: OrderView; t: AppCopy; language: Language }) {
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
                <time dateTime={order.createdAt}>{formatDate(order.createdAt, language)}</time>
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
                  t={t}
                  language={language}
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
                <Recipient order={order} t={t} language={language} />
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
                <ItemPrice item={item} t={t} language={language} />
              </p>
            </li>
          ))}
        </ul>
      </TabsContent>
    </Tabs>
  );
}

/** Pannello del dettaglio con indirizzo proprio; chiuderlo torna all'elenco con gli stessi criteri. */
export function OrderSheet({
  detail,
  account,
  ebayDown,
  template,
  confirmUnlock,
  t,
  links,
  unlock,
  actions,
}: {
  detail: OrderView | null;
  account: OrdersAccount;
  ebayDown: boolean;
  template: string;
  confirmUnlock?: boolean;
  t: AppCopy;
  links: AppLinks;
  unlock: {
    submit: (ids: string[], skipConfirmation?: boolean) => void;
    pending: ReadonlySet<string>;
    revealed: ReadonlySet<string>;
  };
  actions: SecondaryActions;
}) {
  const { language } = links;
  const location = useLocation();
  const navigate = useNavigate();
  const action = useAction();
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
              <SheetTitle className="break-words">{t.order.title(shown.ebayOrderId)}</SheetTitle>
              <SheetDescription className="text-pretty [overflow-wrap:anywhere]">
                {formatDate(shown.createdAt, language)} · {buyerLabel(shown, t)}
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
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  {t.orders.openOnEbay}
                </a>
              ) : null}
              {actions.exportable ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => action.run("export", { ids: shown.id })}
                >
                  {t.orders.exportOrder}
                </Button>
              ) : null}
            </div>
          ) : null}
          {/* Il dato fiscale, protagonista, resta visibile sopra le schede Dettagli e Articoli. */}
          <div className="mx-4 mb-5 grid gap-3 rounded-xl border bg-muted/30 p-3">
            <FiscalCodes
              order={shown}
              t={t}
              language={language}
              account={account}
              ebayDown={ebayDown}
              revealed={unlock.revealed.has(shown.id)}
              unlocking={unlock.pending.has(shown.id)}
              onUnlock={unlock.submit}
              confirmUnlock={confirmUnlock}
            />
            <FiscalDetail
              order={shown}
              t={t}
              language={language}
              account={account}
              ebayDown={ebayDown}
              template={template}
            />
          </div>
          <OrderDetail order={shown} t={t} language={language} />
        </SheetContent>
      ) : null}
    </Sheet>
  );
}
