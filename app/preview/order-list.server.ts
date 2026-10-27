import {
  maxListedOrders,
  ordersPageSize,
  pagesParam,
  snapshotCursor,
  snapshotInstant,
  snapshotParam,
} from "../orders/order-list";
import type { ExportTally } from "../orders/export-scope";
import { orderSearchText, searchFold, searchTokens } from "../orders/order-search";
import { orderCriteria, type OrderCriteria } from "../domain/orders.server";
import { displayTaxValue } from "../tax-quality";
import { fiscalSituation, type OrderView, type Plan } from "../view-models";

/** La ricerca dell'anteprima è legata soltanto all'anteprima: i suoi dati sono sintetici. */
export const previewSearchScope = "anteprima";

/**
 * Ricerca sugli scenari sintetici con le regole dell'area reale: testo dell'ordine e soltanto
 * i valori fiscali disponibili, mai quelli da sbloccare.
 */
function matchesSearch(order: OrderView, tokens: readonly string[]) {
  if (tokens.length === 0) return true;
  const fiscal =
    order.fiscal.state === "available"
      ? order.fiscal.identifiers.flatMap((id) => [id.value, displayTaxValue(id)])
      : [];
  const text = `${orderSearchText(order)} ${searchFold(fiscal.join(" "))}`;
  return tokens.every((token) => text.includes(token));
}

/**
 * Criteri dell'area reale, letti e validati da `orderCriteria`, applicati agli scenari
 * sintetici: l'area reale li esegue nella query D1.
 */
function matchesOrder(order: OrderView, criteria: OrderCriteria) {
  return (
    matchesSearch(order, criteria.tokens ?? []) &&
    (!criteria.storeId || order.storeId === criteria.storeId) &&
    (!criteria.since || Date.parse(order.createdAt) >= Date.parse(criteria.since)) &&
    (!criteria.payment || order.payment.status === criteria.payment) &&
    (!criteria.shipping || order.shipping.status === criteria.shipping) &&
    (!criteria.fiscal || fiscalSituation(order.fiscal) === criteria.fiscal)
  );
}

/** Dal più recente, con spareggio per ID decrescente come la query D1. */
const newestFirst = (a: OrderView, b: OrderView) =>
  a.createdAt === b.createdAt
    ? Number(a.id < b.id) - Number(a.id > b.id)
    : Number(a.createdAt < b.createdAt) - Number(a.createdAt > b.createdAt);

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
  plan: Plan,
  href: (query: URLSearchParams) => string,
) {
  const { filtered, waiting, snapshot, arrival, incomingAtTop } = previewListing(
    orders,
    incoming,
    search,
    query,
    now,
    plan,
  );
  const shown = Math.min(
    Math.max(Math.trunc(Number(search.get(pagesParam))) || 1, 1),
    Math.floor(maxListedOrders / ordersPageSize),
  );
  const more = filtered.length > shown * ordersPageSize;
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
    nextHref: more && shown * ordersPageSize < maxListedOrders ? href(next) : null,
    limited: more && shown * ordersPageSize >= maxListedOrders,
    incoming: waiting,
    freshHref: waiting > 0 ? href(fresh) : null,
    incomingAtTop,
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
  plan: Plan,
) {
  const criteria = orderCriteria(search, new Date(now), plan, query);
  const matching = (list: OrderView[]) => list.filter((order) => matchesOrder(order, criteria));
  const arrival = new Date(new Date(now).getTime() + arrivalDelay);
  const snapshot = snapshotInstant(search.get(snapshotParam)) ?? new Date(now);
  const arrived = snapshot >= arrival;
  const filtered = matching(arrived ? [...orders, ...incoming] : orders).sort(newestFirst);
  const waiting = arrived ? [] : matching(incoming);
  return {
    filtered,
    waiting: waiting.length,
    // Come nell'area reale: i nuovi ordini entrano da soli soltanto sopra il primo mostrato.
    incomingAtTop:
      waiting.length > 0 &&
      (filtered.length === 0 || waiting.every((order) => newestFirst(order, filtered[0]!) < 0)),
    snapshot,
    arrival,
  };
}

/** Ordini di un'esportazione dell'anteprima, con quelli da sbloccare e quelli con il dato. */
export function previewTally(orders: OrderView[]): ExportTally {
  return {
    orders: orders.length,
    locked: orders.filter((order) => order.fiscal.state === "locked").length,
    available: orders.filter((order) => order.fiscal.state === "available").length,
  };
}

/** Ordini della ricerca della barra superiore, dal più recente, come «Vedi tutti». */
export function previewSearchMatches(orders: OrderView[], query: string) {
  const tokens = searchTokens(query);
  return orders.filter((order) => matchesSearch(order, tokens)).sort(newestFirst);
}
