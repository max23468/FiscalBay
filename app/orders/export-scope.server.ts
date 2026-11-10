import { env } from "cloudflare:workers";

import { listStores } from "../domain/stores.server";
import type { EbayEnvironment } from "../view-models";
import { listCriteria, type OrderScope } from "./order-criteria";
import { exportScope, type ExportScope } from "./export-scope";
import { accountSearchScope, openSearch } from "./order-search.server";

/**
 * Ambito ricevuto dagli Ordini nella forma della loro query D1: stessi negozi filtrabili, stessi
 * filtri, stessa ricerca e stessa istantanea, così il file contiene gli ordini dell'elenco e la
 * selezione conta soltanto quelli ancora presenti. L'ordine del dettaglio segue invece le regole
 * del dettaglio: negozi consultabili, ambiente, conservazione e diritti, con gli acquisti non
 * pagati soltanto se l'elenco ha «Non pagato». null se l'esportazione non viene dagli Ordini.
 */
export async function accountExportScope(
  session: { user: { id: string }; session: { id: string } },
  query: URLSearchParams,
  ebayEnvironment: EbayEnvironment,
  premium: boolean,
  now: Date,
): Promise<{
  scope: ExportScope;
  filter: OrderScope;
  names: { search: string | null; store: string | null };
} | null> {
  const scope = exportScope(query);
  if (!scope) return null;
  const [stores, search] = await Promise.all([
    listStores(env.DB, session.user.id),
    openSearch(env.BETTER_AUTH_SECRET, accountSearchScope(session), query),
  ]);
  const storeIds = stores
    .filter(
      (store) => store.ebayEnvironment === ebayEnvironment && !store.pauseReasons.includes("plan"),
    )
    .map((store) => store.id);
  const { criteria } = listCriteria(query, now, premium ? "premium" : "free", storeIds, search);
  const store = criteria.storeId
    ? (stores.find((candidate) => candidate.id === criteria.storeId)?.name ?? null)
    : null;
  const names = { search: search?.trim() || null, store };
  if (scope.kind === "orders" && scope.detail)
    return {
      scope,
      filter: { ids: scope.ids, criteria: {}, provisional: criteria.payment === "unpaid" },
      names,
    };
  return {
    scope,
    filter: { ids: scope.kind === "orders" ? scope.ids : undefined, criteria },
    names,
  };
}
