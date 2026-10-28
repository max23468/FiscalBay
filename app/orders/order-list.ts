import type { ShouldRevalidateFunctionArgs } from "react-router";

import type { OrderCriteria } from "../domain/orders.server";
import {
  fiscalSituations,
  orderPeriods,
  orderPeriodStart,
  paymentStatuses,
  premiumOrderPeriods,
  shippingStatuses,
} from "../view-models";
import { searchTokens } from "./order-search";

/** Ordini mostrati per ogni «Carica altri», nell'area reale e nell'anteprima. */
export const ordersPageSize = 6;

/** Ordini letti al massimo in una richiesta: oltre servono ricerca o filtri. */
export const maxListedOrders = 300;

/** Pagine dell'elenco già caricate con «Carica altri». */
export const pagesParam = "mostra";

/**
 * Istantanea dell'elenco aperto: gli ordini entrati negli elenchi dopo di essa non si
 * inseriscono fra quelli già letti, così «Carica altri», dettaglio, Indietro e ricarica
 * ritrovano lo stesso ordine. Nell'indirizzo è un cursore opaco.
 */
export const snapshotParam = "vista";

/** Cursore opaco dell'istantanea; l'ordine dell'elenco è sempre dal più recente, poi per ID. */
export function snapshotCursor(at: Date): string {
  return at.getTime().toString(36);
}

/** Istante dell'istantanea; null se il cursore è assente o non valido. */
export function snapshotInstant(cursor: string | null): Date | null {
  if (!cursor || !/^[0-9a-z]{1,10}$/u.test(cursor)) return null;
  const at = new Date(Number.parseInt(cursor, 36));
  return Number.isNaN(at.getTime()) ? null : at;
}

/** Parametri che appartengono all'elenco aperto: un nuovo filtro o una nuova ricerca li toglie. */
export function withoutListPosition(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params);
  next.delete(pagesParam);
  next.delete(snapshotParam);
  return next;
}

/**
 * L'unico cambio è l'istantanea aggiunta all'indirizzo che ne era privo: la pagina la riceve
 * già dalla risposta che sta mostrando e non serve una nuova lettura.
 */
function snapshotOnlyAdded(current: URL, next: URL): boolean {
  if (current.pathname !== next.pathname || current.searchParams.has(snapshotParam)) return false;
  if (!next.searchParams.has(snapshotParam)) return false;
  const rest = new URLSearchParams(next.searchParams);
  rest.delete(snapshotParam);
  return rest.toString() === current.searchParams.toString();
}

/** Regola di nuova lettura delle pagine che mostrano l'elenco Ordini o lo contengono. */
export function revalidateUnlessSnapshot({
  currentUrl,
  nextUrl,
  defaultShouldRevalidate,
}: Pick<ShouldRevalidateFunctionArgs, "currentUrl" | "nextUrl" | "defaultShouldRevalidate">) {
  return snapshotOnlyAdded(currentUrl, nextUrl) ? false : defaultShouldRevalidate;
}

/**
 * Negozio ricordato fra le sessioni nel browser, insieme all'ordinamento che è sempre dal più
 * recente. Ricerca, periodo e altri filtri sono temporanei e non si ricordano.
 */
export const rememberedStoreCookie = "fiscalbay-negozio";

/** Ricorda o dimentica nel browser il negozio scelto fra i filtri. */
export function rememberStore(storeId: string | null) {
  const secure = location.protocol === "https:" ? "; secure" : "";
  document.cookie = storeId
    ? `${rememberedStoreCookie}=${encodeURIComponent(storeId)}; path=/; max-age=31536000; samesite=lax${secure}`
    : `${rememberedStoreCookie}=; path=/; max-age=0; samesite=lax${secure}`;
}

/** Negozio ricordato nella richiesta, se fra quelli che l'elenco può filtrare. */
export function rememberedStore(cookie: string | null, storeIds: readonly string[]): string | null {
  const value = cookie
    ?.split(/;\s*/u)
    .find((part) => part.startsWith(`${rememberedStoreCookie}=`))
    ?.slice(rememberedStoreCookie.length + 1);
  if (!value) return null;
  try {
    const id = decodeURIComponent(value);
    // Il filtro del negozio compare soltanto con più negozi: con uno solo resterebbe invisibile.
    return storeIds.length > 1 && storeIds.includes(id) ? id : null;
  } catch {
    return null;
  }
}

/**
 * Criteri dell'elenco dall'indirizzo: un valore sconosciuto, o un'opzione del piano Premium in
 * Free, vale come «Tutti». La ricerca, già decifrata, diventa un elenco di parole.
 */
export function orderCriteria(
  search: URLSearchParams,
  now: Date,
  plan: "free" | "premium",
  query: string | null = null,
): OrderCriteria {
  const known = <Value extends string>(name: string, values: readonly Value[]) => {
    const value = search.get(name);
    return values.find((candidate) => candidate === value);
  };
  const period = known(
    "periodo",
    orderPeriods.filter((value) => plan === "premium" || !premiumOrderPeriods.has(value)),
  );
  const tokens = searchTokens(query);
  const value = (name: string) => {
    const raw = search.get(name);
    return raw && raw.length <= 64 ? raw : undefined;
  };
  return {
    storeId: value("negozio"),
    since: period ? orderPeriodStart(period, now).toISOString() : undefined,
    payment: known("pagamento", paymentStatuses),
    shipping: known("spedizione", shippingStatuses),
    fiscal: known("fiscale", fiscalSituations),
    tokens: tokens.length ? tokens : undefined,
  };
}

/**
 * Criteri dell'elenco aperto, uguali per la pagina Ordini e per l'esportazione: filtri
 * dall'indirizzo, negozio soltanto fra quelli filtrabili e istantanea dell'elenco. Senza
 * istantanea l'elenco si apre adesso.
 */
export function listCriteria(
  query: URLSearchParams,
  now: Date,
  plan: "free" | "premium",
  storeIds: readonly string[],
  search: string | null,
) {
  const opened = snapshotInstant(query.get(snapshotParam));
  const snapshot = new Date(Math.min(opened?.getTime() ?? now.getTime(), now.getTime()));
  const parsed = orderCriteria(query, now, plan, search);
  // Come gli altri filtri, un negozio che non è fra quelli filtrabili vale come «Tutti».
  const filters: OrderCriteria = {
    ...parsed,
    storeId: storeIds.find((id) => id === parsed.storeId),
  };
  return {
    opened,
    snapshot,
    filters,
    criteria: { ...filters, listedBefore: snapshot.toISOString() } satisfies OrderCriteria,
  };
}
