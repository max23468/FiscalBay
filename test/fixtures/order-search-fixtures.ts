import type { SearchResults } from "../../app/components/shell-search";
import { action as orderSearch } from "../../app/routes/order-search";
import { callRoute } from "./route-fixtures";

/** Ricerca della barra superiore come la invia il browser: query nel corpo, mai nell'URL. */
export function searchRequest(
  cookie: string | null,
  query: string,
  options: { origin?: string | null; json?: boolean; environment?: string } = {},
) {
  const environment = options.environment ? `?environment=${options.environment}` : "";
  return callRoute(orderSearch, `/api/v1/orders/search${environment}`, {
    cookie,
    origin: options.origin,
    headers: options.json === false ? {} : { accept: "application/json" },
    fields: { q: query, language: "it" },
  });
}

export async function searchOrders(cookie: string, query: string): Promise<SearchResults> {
  return (await (await searchRequest(cookie, query)).json()) as SearchResults;
}
