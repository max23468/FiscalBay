import { env } from "cloudflare:workers";
import { redirect } from "react-router";

import type { SearchResults } from "~/components/shell-search";
import {
  assertSameOrigin,
  requestedEbayEnvironment,
  requireAccountArea,
  type AccountArea,
} from "../account-area.server";
import { ordersPath } from "../app-links";
import { searchVisibleOrders } from "../domain/orders.server";
import { orderAllowance } from "../domain/grants.server";
import { listStoreScopes } from "../domain/stores.server";
import { errorResponse, postOnly } from "../error-response";
import { localizedPath } from "../i18n";
import { measure } from "../observability.server";
import { listCriteria, type OrderCriteria } from "../orders/order-criteria";
import { listFilters } from "../orders/order-list";
import { searchQuery, searchTokens } from "../orders/order-search";
import { accountSearchScope, searchHref } from "../orders/order-search.server";
import type { Route } from "./+types/order-search";

export const loader = postOnly;

/**
 * Ricerca ordini della barra superiore, con lo stesso filtro della pagina Ordini. La query
 * arriva nel corpo e l'elenco la riceve cifrata, così un Codice Fiscale o una Partita IVA non
 * finiscono in URL, referrer o log. Con `Accept: application/json` risponde con i primi ordini,
 * il loro numero e gli indirizzi; un modulo inviato senza JavaScript apre direttamente l'elenco.
 */
export async function action({ request }: Route.ActionArgs) {
  assertSameOrigin(request);
  const json = request.headers.get("accept")?.includes("application/json") ?? false;
  let area: AccountArea;
  try {
    area = await requireAccountArea(request);
  } catch (error) {
    if (json && error instanceof Response) return errorResponse(request, "AUTH_REQUIRED");
    throw error;
  }
  const form = await request.formData();
  const language = form.get("language") === "en" ? "en" : "it";
  const environment = requestedEbayEnvironment(request);
  const query = searchQuery(form.get("q"));
  const path = localizedPath(language, ordersPath);
  // Dagli Ordini la ricerca conserva i filtri dell'elenco, anche nei suggerimenti e nel conteggio.
  const filters = listFilters(new URLSearchParams(String(form.get("filters") ?? "")));
  const kept = new URLSearchParams(environment === "sandbox" ? { environment } : {});
  for (const [name, value] of filters) kept.set(name, value);
  const href = query
    ? await searchHref(env.BETTER_AUTH_SECRET, accountSearchScope(area.session), path, query, kept)
    : `${path}${kept.size ? `?${kept}` : ""}`;
  if (!json) return redirect(href, 303);
  const now = new Date();
  const { items, total } = query
    ? await measure("d1", "orders", async () =>
        searchVisibleOrders(
          env.DB,
          area.session.user.id,
          environment,
          now,
          searchTokens(query),
          5,
          filters.size ? await listedFilters(area, environment, filters, now) : {},
        ),
      )
    : { items: [], total: 0 };
  const search = href.slice(path.length);
  return Response.json(
    {
      items: items.map((item) => ({ ...item, href: `${path}/${item.id}${search}` })),
      total,
      href,
    } satisfies SearchResults,
    { headers: { "cache-control": "no-store" } },
  );
}

/**
 * Filtri degli Ordini nella forma della loro query, con le stesse regole dell'elenco: negozi
 * filtrabili dell'ambiente e periodi Premium soltanto con Premium.
 */
async function listedFilters(
  area: AccountArea,
  environment: ReturnType<typeof requestedEbayEnvironment>,
  filters: URLSearchParams,
  now: Date,
): Promise<OrderCriteria> {
  const userId = area.session.user.id;
  const [stores, allowance] = await Promise.all([
    listStoreScopes(env.DB, userId),
    orderAllowance(env.DB, userId, now),
  ]);
  const storeIds = stores
    .filter(
      (store) => store.ebayEnvironment === environment && !store.pauseReasons.includes("plan"),
    )
    .map((store) => store.id);
  const { filters: criteria } = listCriteria(
    filters,
    now,
    allowance?.premium ? "premium" : "free",
    storeIds,
    null,
  );
  return criteria;
}
