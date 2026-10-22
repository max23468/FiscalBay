import {
  ordersPageSize,
  pagesParam,
  snapshotCursor,
  snapshotInstant,
  snapshotParam,
} from "../orders/order-list";
import { orderSearchText, searchFold, searchTokens } from "../orders/order-search";
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

/** Gli ordini in arrivo degli scenari entrano negli elenchi subito dopo l'apertura. */
const arrivalDelay = 1_000;

/**
 * Ordini che corrispondono ai criteri e alla ricerca, dal più recente, fino alla pagina
 * indicata da `mostra`, con le regole dell'istantanea dell'area reale: gli ordini in arrivo
 * restano fuori finché l'istantanea non li comprende e intanto si contano. `href` riceve la
 * query delle pagine successive e della nuova istantanea.
 */
export function previewOrderPage(
  orders: OrderView[],
  incoming: OrderView[],
  search: URLSearchParams,
  query: string | null,
  now: string,
  href: (query: URLSearchParams) => string,
) {
  const { filtered, waiting, snapshot, arrival } = previewListing(
    orders,
    incoming,
    search,
    query,
    now,
  );
  const shown = Math.max(Number(search.get(pagesParam)) || 1, 1);
  const cursor = snapshotCursor(snapshot);
  const next = new URLSearchParams(search);
  next.set(pagesParam, String(shown + 1));
  next.set(snapshotParam, cursor);
  const fresh = new URLSearchParams(search);
  fresh.set(snapshotParam, snapshotCursor(arrival));
  return {
    orders: filtered.slice(0, shown * ordersPageSize),
    total: filtered.length,
    snapshot: cursor,
    nextHref: filtered.length > shown * ordersPageSize ? href(next) : null,
    limited: false,
    incoming: waiting,
    freshHref: waiting > 0 ? href(fresh) : null,
  };
}

/**
 * Ordini dell'elenco con i criteri e l'istantanea dell'indirizzo, dal più recente, e ordini in
 * arrivo che l'istantanea non comprende ancora.
 */
export function previewListing(
  orders: OrderView[],
  incoming: OrderView[],
  search: URLSearchParams,
  query: string | null,
  now: string,
) {
  const tokens = searchTokens(query);
  const matching = (list: OrderView[]) =>
    list.filter((order) => matchesOrder(order, search, now, tokens));
  const arrival = new Date(new Date(now).getTime() + arrivalDelay);
  const snapshot = snapshotInstant(search.get(snapshotParam)) ?? new Date(now);
  const arrived = snapshot >= arrival;
  return {
    filtered: matching(arrived ? [...orders, ...incoming] : orders).sort(newestFirst),
    waiting: arrived ? 0 : matching(incoming).length,
    snapshot,
    arrival,
  };
}

/** Ordini della ricerca della barra superiore, dal più recente, come «Vedi tutti». */
export function previewSearchMatches(orders: OrderView[], query: string) {
  const tokens = searchTokens(query);
  return orders.filter((order) => matchesSearch(order, tokens)).sort(newestFirst);
}
