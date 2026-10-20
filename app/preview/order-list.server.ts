import { ordersPageSize } from "../order-list";
import { orderSearchText, searchFold, searchTokens } from "../order-search";
import { displayTaxValue } from "../tax-quality";
import {
  fiscalSituation,
  fiscalSituations,
  paymentStatuses,
  shippingStatuses,
  type OrderView,
} from "../view-models";

/** La ricerca dell'anteprima è legata soltanto all'anteprima: i suoi dati sono sintetici. */
export const previewSearchScope = "anteprima";

/** Valore di un filtro dell'URL, ignorato se non è tra quelli previsti. */
function known(params: URLSearchParams, name: string, values: readonly string[]) {
  const value = params.get(name);
  return value && values.includes(value) ? value : null;
}

/**
 * Ricerca sugli scenari sintetici con le regole dell'area reale: testo dell'ordine e soltanto
 * i valori fiscali disponibili, mai quelli da sbloccare.
 */
function matchesSearch(order: OrderView, tokens: string[]) {
  if (tokens.length === 0) return true;
  const fiscal =
    order.fiscal.state === "available"
      ? order.fiscal.identifiers.flatMap((id) => [id.value, displayTaxValue(id)])
      : [];
  const text = `${orderSearchText(order)} ${searchFold(fiscal.join(" "))}`;
  return tokens.every((token) => text.includes(token));
}

/** Criteri dell'URL e ricerca sugli scenari sintetici. L'area reale filtra con la query D1. */
function matchesOrder(order: OrderView, params: URLSearchParams, now: string, tokens: string[]) {
  if (!matchesSearch(order, tokens)) return false;
  const store = params.get("negozio");
  if (store && order.storeId !== store) return false;
  const marketplace = params.get("marketplace");
  if (marketplace && order.marketplace !== marketplace) return false;
  const payment = known(params, "pagamento", paymentStatuses);
  if (payment && order.payment.status !== payment) return false;
  const shipping = known(params, "spedizione", shippingStatuses);
  if (shipping && order.shipping.status !== shipping) return false;
  const fiscal = known(params, "fiscale", fiscalSituations);
  if (fiscal && fiscalSituation(order.fiscal) !== fiscal) return false;
  const days = Number(known(params, "periodo", ["7", "30", "90"]));
  if (
    days > 0 &&
    new Date(now).getTime() - new Date(order.createdAt).getTime() > days * 86_400_000
  ) {
    return false;
  }
  return true;
}

const newestFirst = (a: OrderView, b: OrderView) =>
  b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id);

/**
 * Ordini che corrispondono ai criteri e alla ricerca, dal più recente, fino alla pagina
 * indicata da `mostra`; `nextHref` riceve la query della pagina successiva.
 */
export function previewOrderPage(
  orders: OrderView[],
  search: URLSearchParams,
  query: string | null,
  now: string,
  href: (query: URLSearchParams) => string,
) {
  const tokens = searchTokens(query);
  const filtered = orders
    .filter((order) => matchesOrder(order, search, now, tokens))
    .sort(newestFirst);
  const shown = Math.max(Number(search.get("mostra")) || 1, 1);
  const next = new URLSearchParams(search);
  next.set("mostra", String(shown + 1));
  return {
    orders: filtered.slice(0, shown * ordersPageSize),
    total: filtered.length,
    nextHref: filtered.length > shown * ordersPageSize ? href(next) : null,
  };
}

/** Ordini della ricerca della barra superiore, dal più recente, come «Vedi tutti». */
export function previewSearchMatches(orders: OrderView[], query: string) {
  const tokens = searchTokens(query);
  return orders.filter((order) => matchesSearch(order, tokens)).sort(newestFirst);
}
