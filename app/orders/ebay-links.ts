/** Pagina dell'ordine nel Seller Hub di eBay, aperta dagli Ordini e dai messaggi Telegram. */
export function ebayOrderHref(ebayOrderId: string) {
  return `https://www.ebay.it/sh/ord/details?orderid=${encodeURIComponent(ebayOrderId)}`;
}

/** Pagina dell'inserzione su eBay. */
export function ebayListingHref(listingId: string) {
  return `https://www.ebay.it/itm/${encodeURIComponent(listingId)}`;
}
