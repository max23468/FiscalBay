import { maxListedOrders, pagesParam, snapshotParam } from "./order-list";

/**
 * Ambito dell'esportazione richiamata dagli Ordini, uguale nell'area reale e nell'anteprima.
 * L'indirizzo dell'esportazione porta l'intera query dell'elenco (filtri, ricerca cifrata,
 * istantanea e pagine caricate) e, se c'è, la selezione: i filtri e l'istantanea danno lo
 * stesso conteggio dell'elenco, il resto serve a tornarvi con lo stesso contesto.
 */

/** Ordini scelti, con la selezione o dal menu di un ordine: prevalgono sui filtri. */
export const exportOrdersParam = "ordini";

/** Sezione delle Impostazioni che riceve l'ambito. */
export const exportSection = "impostazioni/esportazione";

export type ExportScope =
  | { kind: "orders"; ids: string[] }
  | { kind: "filtered"; criteria: URLSearchParams };

/** Ordini dell'esportazione, quanti hanno il dato da sbloccare e quanti il dato disponibile. */
export interface ExportTally {
  orders: number;
  locked: number;
  available: number;
}

/** Selezione, singolo ordine o elenco filtrato degli Ordini, da esportare così com'è. */
export interface ExportContext {
  kind: ExportScope["kind"];
  /** Numero eBay quando l'ambito è un solo ordine. */
  order: string | null;
  /** L'elenco ha filtri o una ricerca attivi. */
  filtered: boolean;
  /** Torna all'elenco degli Ordini con lo stesso contesto. */
  returnHref: string;
  /** Ambito trasmesso alla creazione del file, nella forma dell'indirizzo. */
  query: string;
  estimate: ExportTally;
}

/** Ambito ricevuto dagli Ordini nella forma della sezione, uguale nell'area reale e nell'anteprima. */
export function exportContext(
  scope: ExportScope,
  query: URLSearchParams,
  ordersPath: string,
  order: string | null,
  estimate: ExportTally,
): ExportContext {
  return {
    kind: scope.kind,
    order: scope.kind === "orders" && scope.ids.length === 1 ? order : null,
    // Istantanea e ambiente eBay non restringono l'elenco.
    filtered:
      scope.kind === "filtered" &&
      [...scope.criteria.keys()].some((key) => key !== snapshotParam && key !== "environment"),
    returnHref: exportReturnHref(ordersPath, query),
    query: query.toString(),
    estimate,
  };
}

/** Indirizzo dell'esportazione da un elenco, con la selezione se presente. */
export function exportHref(path: string, list: URLSearchParams, ids?: readonly string[]) {
  const next = new URLSearchParams(list);
  if (ids) next.set(exportOrdersParam, ids.join(","));
  else next.delete(exportOrdersParam);
  return next.size ? `${path}?${next}` : path;
}

/**
 * Ambito ricevuto dall'esportazione; null se l'esportazione è aperta dalle Impostazioni, senza
 * contesto degli Ordini. Una selezione vuota o fuori misura non vale come «tutti gli ordini».
 */
export function exportScope(query: URLSearchParams): ExportScope | null {
  const ids = query.get(exportOrdersParam);
  if (ids !== null) {
    const unique = [...new Set(ids.split(","))].filter((id) => id && id.length <= 128);
    return { kind: "orders", ids: unique.slice(0, maxListedOrders) };
  }
  const criteria = new URLSearchParams(query);
  criteria.delete(pagesParam);
  return criteria.size ? { kind: "filtered", criteria } : null;
}

/** Elenco degli Ordini da cui è partita l'esportazione, con lo stesso contesto. */
export function exportReturnHref(ordersPath: string, query: URLSearchParams) {
  const next = new URLSearchParams(query);
  next.delete(exportOrdersParam);
  return next.size ? `${ordersPath}?${next}` : ordersPath;
}

/**
 * Selezione da ripristinare tornando all'elenco da cui è partita l'esportazione, con Indietro o
 * con il collegamento della sezione. Vale soltanto per quello stesso indirizzo, istantanea
 * compresa, e resta nella scheda del browser.
 */
const selectionKey = "fiscalbay-selezione-esportata";

export function keepExportedSelection(list: string, ids: readonly string[]) {
  try {
    sessionStorage.setItem(selectionKey, JSON.stringify({ list, ids }));
  } catch {
    // Senza memoria di sessione la selezione si rifà a mano.
  }
}

export function exportedSelection(list: string): string[] | null {
  try {
    const saved: unknown = JSON.parse(sessionStorage.getItem(selectionKey) ?? "null");
    if (
      saved &&
      typeof saved === "object" &&
      "list" in saved &&
      saved.list === list &&
      "ids" in saved &&
      Array.isArray(saved.ids)
    )
      return saved.ids.filter((id): id is string => typeof id === "string");
  } catch {
    // Un valore illeggibile vale come nessuna selezione.
  }
  return null;
}

export function forgetExportedSelection() {
  try {
    sessionStorage.removeItem(selectionKey);
  } catch {
    // Nessuna memoria da liberare.
  }
}
