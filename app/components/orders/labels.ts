import type { AppCopy } from "../../app-copy";
import type { AccountView, TaxIdentifierView } from "../../view-models";

/** Piano e sblocchi del ciclo: tutto ciò che la pagina Ordini usa dell'account. */
export type OrdersAccount = Pick<AccountView, "plan" | "quota">;

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

/** Stato della navigazione dall'elenco al dettaglio: chiudere il pannello torna indietro. */
export const fromListState = { fromList: true } as const;

/** Collegamento al dettaglio nella scheda, che riceve il focus quando il pannello si chiude. */
export function orderLinkSelector(id: string) {
  return `[data-order-link="${CSS.escape(id)}"]`;
}
