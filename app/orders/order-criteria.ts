import {
  fiscalSituations,
  orderPeriods,
  orderPeriodStart,
  paymentStatuses,
  premiumOrderPeriods,
  shippingStatuses,
  type FiscalSituation,
  type PaymentStatus,
  type ShippingStatus,
} from "../view-models";
import { searchTokens } from "./order-search";

/** Ordini letti al massimo in una richiesta: oltre servono ricerca o filtri. */
export const maxListedOrders = 300;

/** Criteri dell'elenco, già validati: un valore assente non filtra. */
export type OrderCriteria = {
  storeId?: string;
  /** Ordini creati da questo istante in poi. */
  since?: string;
  payment?: PaymentStatus;
  shipping?: ShippingStatus;
  fiscal?: FiscalSituation;
  /** Parole cercate nella forma di confronto: ognuna deve comparire nei dati consultabili. */
  tokens?: string[];
  /** Ordini entrati negli elenchi fino a questo istante: l'istantanea dell'elenco aperto. */
  listedBefore?: string;
  /** Ordini entrati negli elenchi dopo questo istante: i nuovi rispetto all'istantanea. */
  listedAfter?: string;
  /** Ordini che nell'elenco seguono questo, dal più recente con spareggio per ID. */
  after?: { creationTime: string; id: string };
};

/**
 * Ordini di un insieme: quelli indicati fra quelli dei criteri, oppure tutti i criteri.
 * `provisional` ammette gli acquisti non pagati come il dettaglio aperto con «Non pagato».
 */
export type OrderScope = { ids?: string[]; criteria: OrderCriteria; provisional?: boolean };

/** Ordini di un insieme, quanti hanno il dato da sbloccare e quanti il dato disponibile. */
export type OrderTally = { orders: number; locked: number; available: number };

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

/** Filtri della barra degli Ordini, nell'indirizzo dell'elenco. */
export const listFilterParams = [
  "negozio",
  "periodo",
  "pagamento",
  "spedizione",
  "fiscale",
] as const;

export type ListFilterParam = (typeof listFilterParams)[number];

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
  const known = <Value extends string>(name: ListFilterParam, values: readonly Value[]) => {
    const value = search.get(name);
    return values.find((candidate) => candidate === value);
  };
  const period = known(
    "periodo",
    orderPeriods.filter((value) => plan === "premium" || !premiumOrderPeriods.has(value)),
  );
  const tokens = searchTokens(query);
  const raw = search.get("negozio");
  return {
    storeId: raw && raw.length <= 64 ? raw : undefined,
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

/**
 * Esportazione aperta dalle Impostazioni: gli ordini del periodo scelto, come nell'elenco senza
 * altri filtri. Come nell'elenco, un periodo Premium nel Free non restringe gli ordini.
 */
export function periodScope(period: string, premium: boolean, now: Date): OrderScope {
  const { since } = orderCriteria(
    new URLSearchParams({ periodo: period }),
    now,
    premium ? "premium" : "free",
  );
  return { criteria: { since, listedBefore: now.toISOString() } };
}

/**
 * Opzione «solo con il Codice Fiscale disponibile»: limita i criteri a quegli ordini. null se il
 * filtro fiscale degli Ordini ne esclude già ogni ordine.
 */
export function onlyAvailable(scope: OrderScope): OrderScope | null {
  const { fiscal } = scope.criteria;
  if (fiscal && fiscal !== "available") return null;
  return { ...scope, criteria: { ...scope.criteria, fiscal: "available" } };
}
