import { displayTaxValue } from "./tax-quality";
import { fiscalStates, paymentStatuses, shippingStatuses, type OrderView } from "./view-models";

/** Ordini mostrati per ogni «Carica altri». */
export const ordersPageSize = 6;

/** Valore di un filtro dell'URL, ignorato se non è tra quelli previsti. */
function known(params: URLSearchParams, name: string, values: readonly string[]) {
  const value = params.get(name);
  return value && values.includes(value) ? value : null;
}

/**
 * Criteri dell'URL applicati sul server agli ordini già autorizzati: la ricerca considera soltanto
 * i valori fiscali disponibili, mai quelli da sbloccare.
 */
export function matchesOrder(order: OrderView, params: URLSearchParams, now: string) {
  const query = params.get("q")?.trim().toLocaleLowerCase();
  if (query) {
    const text = [
      order.ebayOrderId,
      order.buyerName ?? "",
      order.buyerUsername ?? "",
      ...order.items.flatMap((item) => [item.title, item.sku ?? ""]),
      ...(order.fiscal.state === "available"
        ? order.fiscal.identifiers.flatMap((id) => [id.value, displayTaxValue(id)])
        : []),
    ]
      .join(" ")
      .toLocaleLowerCase();
    if (!query.split(/\s+/u).every((token) => text.includes(token))) return false;
  }
  const store = params.get("negozio");
  if (store && order.storeId !== store) return false;
  const marketplace = params.get("marketplace");
  if (marketplace && order.marketplace !== marketplace) return false;
  const payment = known(params, "pagamento", paymentStatuses);
  if (payment && order.payment.status !== payment) return false;
  const shipping = known(params, "spedizione", shippingStatuses);
  if (shipping && order.shipping.status !== shipping) return false;
  const fiscal = known(params, "fiscale", fiscalStates);
  if (fiscal && order.fiscal.state !== fiscal) return false;
  const days = Number(known(params, "periodo", ["7", "30", "90"]));
  if (
    days > 0 &&
    new Date(now).getTime() - new Date(order.createdAt).getTime() > days * 86_400_000
  ) {
    return false;
  }
  return true;
}

/**
 * Ordini che corrispondono ai criteri, dal più recente, fino alla pagina indicata da `mostra`;
 * `nextHref` riceve la query della pagina successiva.
 */
export function orderPage(
  orders: OrderView[],
  search: URLSearchParams,
  now: string,
  href: (query: URLSearchParams) => string,
) {
  const filtered = orders
    .filter((order) => matchesOrder(order, search, now))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
  const shown = Math.max(Number(search.get("mostra")) || 1, 1);
  const next = new URLSearchParams(search);
  next.set("mostra", String(shown + 1));
  return {
    orders: filtered.slice(0, shown * ordersPageSize),
    total: filtered.length,
    nextHref: filtered.length > shown * ordersPageSize ? href(next) : null,
  };
}
