import type { AppCopy } from "../../app-copy";
import { buyerNameView } from "../../contact";
import type { Language } from "../../i18n";
import { displayTaxValue } from "../../tax-quality";
import {
  addressRows,
  type AccountView,
  type OrderView,
  type TaxIdentifierView,
} from "../../view-models";

/**
 * Solo valori già autorizzati dal server; suggerimenti e identificativi bloccati esclusi.
 * CF e Partita IVA italiani nella forma mostrata nel riquadro fiscale.
 */
export function billingCopyText(order: OrderView, language: Language, t: AppCopy): string {
  const name = order.maskedContacts?.includes("name") ? null : buyerNameView(order.buyerName);
  const address = order.contacts.billingAddress
    ? addressRows(order.contacts.billingAddress, language)
    : [];
  const identifiers =
    order.fiscal.state === "available"
      ? order.fiscal.identifiers
          .filter((identifier) => identifier.value.trim())
          .map((identifier) => {
            const label = identifierLabel(identifier, t);
            const value = displayTaxValue(identifier);
            return label ? `${label}: ${value}` : value;
          })
      : [];
  return [name, ...address, ...identifiers].filter(Boolean).join("\n");
}

/** Un'assenza mascherata è distinta solo quando la fonte lo dichiara. */
export function missingContact(
  order: OrderView,
  field: NonNullable<OrderView["maskedContacts"]>[number],
  t: AppCopy,
): string {
  return order.maskedContacts?.includes(field) ? t.orders.maskedContact : t.orders.notProvided;
}

/** Piano, prova e sblocchi del ciclo: tutto ciò che la pagina Ordini usa dell'account. */
export type OrdersAccount = Pick<AccountView, "plan" | "quota" | "trial"> &
  Partial<Pick<AccountView, "trialAvailable">>;

export function identifierLabel(identifier: TaxIdentifierView, t: AppCopy) {
  return identifier.type === "OTHER"
    ? (identifier.typeLabel ?? "")
    : t.orders.identifier[identifier.type];
}

export function taxCodeLabels(label: string, order: string, t: AppCopy) {
  return {
    copy: t.orders.copy(label, order),
    copied: t.orders.copied,
    copyFailed: t.orders.copyFailed,
    locked: t.orders.lockedLabel(label),
  };
}

/** Etichette del pulsante Copia di un contatto, con il nome del dato e dell'ordine. */
export function contactCopyLabels(label: string, order: string, t: AppCopy) {
  return {
    copy: t.orders.copy(label.toLowerCase(), order),
    copied: t.orders.copied,
    copyFailed: t.orders.contactCopyFailed,
  };
}

/** Sblocchi rimasti nel ciclo; null senza limite (Premium). */
export function remainingUnlocks(account: OrdersAccount) {
  return account.quota ? Math.max(account.quota.limit - account.quota.used, 0) : null;
}

/** Pagina dell'ordine nel Seller Hub di eBay. */
export function ebayOrderHref(ebayOrderId: string) {
  return `https://www.ebay.it/sh/ord/details?orderid=${encodeURIComponent(ebayOrderId)}`;
}

/** Pagina dell'inserzione su eBay. */
export function ebayListingHref(listingId: string) {
  return `https://www.ebay.it/itm/${encodeURIComponent(listingId)}`;
}

/** Stato della navigazione dall'elenco al dettaglio: chiudere il pannello torna indietro. */
export const fromListState = { fromList: true } as const;

/** Collegamento al dettaglio nella scheda, che riceve il focus quando il pannello si chiude. */
export function orderLinkSelector(id: string) {
  return `[data-order-link="${CSS.escape(id)}"]`;
}
