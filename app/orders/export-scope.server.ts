import { env } from "cloudflare:workers";

import type { AccountArea } from "../account-area.server";
import type { OrderCriteria } from "../domain/orders.server";
import { listStores } from "../domain/stores.server";
import type { EbayEnvironment } from "../view-models";
import { exportScope, type ExportScope } from "./export-scope";
import { listCriteria, orderCriteria } from "./order-list";
import { accountSearchScope, openSearch } from "./order-search.server";

/**
 * Ordini di un'esportazione: quelli indicati fra quelli dei criteri, oppure tutti i criteri.
 * `provisional` ammette gli acquisti non pagati come il dettaglio aperto con «Non pagato».
 */
export type ExportFilter = { ids?: string[]; criteria: OrderCriteria; provisional?: boolean };

/**
 * Ambito ricevuto dagli Ordini nella forma della loro query D1: stessi negozi filtrabili, stessi
 * filtri, stessa ricerca e stessa istantanea, così il file contiene gli ordini dell'elenco e la
 * selezione conta soltanto quelli ancora presenti. L'ordine del dettaglio segue invece le regole
 * del dettaglio: negozi consultabili, ambiente, conservazione e diritti, con gli acquisti non
 * pagati soltanto se l'elenco ha «Non pagato». null se l'esportazione non viene dagli Ordini.
 */
export async function accountExportScope(
  area: AccountArea,
  query: URLSearchParams,
  ebayEnvironment: EbayEnvironment,
  premium: boolean,
  now: Date,
): Promise<{ scope: ExportScope; filter: ExportFilter } | null> {
  const scope = exportScope(query);
  if (!scope) return null;
  const [stores, search] = await Promise.all([
    listStores(env.DB, area.session.user.id),
    openSearch(env.BETTER_AUTH_SECRET, accountSearchScope(area.session), query),
  ]);
  const storeIds = stores
    .filter(
      (store) => store.ebayEnvironment === ebayEnvironment && !store.pauseReasons.includes("plan"),
    )
    .map((store) => store.id);
  const { criteria } = listCriteria(query, now, premium ? "premium" : "free", storeIds, search);
  if (scope.kind === "orders" && scope.detail)
    return {
      scope,
      filter: { ids: scope.ids, criteria: {}, provisional: criteria.payment === "unpaid" },
    };
  return { scope, filter: { ids: scope.kind === "orders" ? scope.ids : undefined, criteria } };
}

/**
 * Esportazione aperta dalle Impostazioni: gli ordini del periodo scelto, come nell'elenco senza
 * altri filtri. Come nell'elenco, un periodo Premium nel Free non restringe gli ordini.
 */
export function periodExportFilter(period: string, premium: boolean, now: Date): ExportFilter {
  const { since } = orderCriteria(
    new URLSearchParams({ periodo: period }),
    now,
    premium ? "premium" : "free",
  );
  return { criteria: { since, listedBefore: now.toISOString() } };
}

/**
 * Opzione «solo con dati fiscali disponibili»: limita i criteri a quegli ordini. null se il
 * filtro fiscale degli Ordini ne esclude già ogni ordine.
 */
export function onlyAvailable(filter: ExportFilter): ExportFilter | null {
  const { fiscal } = filter.criteria;
  if (fiscal && fiscal !== "available") return null;
  return { ...filter, criteria: { ...filter.criteria, fiscal: "available" } };
}
