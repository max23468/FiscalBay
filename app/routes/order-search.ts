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
import { errorResponse } from "../error-response";
import { localizedPath } from "../i18n";
import { measure } from "../observability.server";
import { searchQuery, searchTokens } from "../orders/order-search";
import { accountSearchScope, searchHref } from "../orders/order-search.server";
import type { Route } from "./+types/order-search";

/** Il percorso riceve soltanto ricerche: una lettura non ha contenuto. */
export function loader() {
  return new Response(null, { status: 405, headers: { allow: "POST" } });
}

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
  const kept = new URLSearchParams(environment === "sandbox" ? { environment } : {});
  const href = query
    ? await searchHref(env.BETTER_AUTH_SECRET, accountSearchScope(area.session), path, query, kept)
    : `${path}${kept.size ? `?${kept}` : ""}`;
  if (!json) return redirect(href, 303);
  const { items, total } = query
    ? await measure("d1", "orders", () =>
        searchVisibleOrders(
          env.DB,
          area.session.user.id,
          environment,
          new Date(),
          searchTokens(query),
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
