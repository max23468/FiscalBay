import { env } from "cloudflare:workers";
import { redirect } from "react-router";

import type { SearchResults } from "~/components/shell-search";
import { previewOrdersPath } from "../app-links";
import { buyerNameView } from "../contact";
import { localizedPath } from "../i18n";
import { searchQuery } from "../orders/order-search";
import { searchHref } from "../orders/order-search.server";
import { previewSearchMatches, previewSearchScope } from "../preview/order-list.server";
import { assertPreviewAvailable, currentScenario } from "../preview/state.server";
import type { Route } from "./+types/preview-search";

/** Il percorso riceve soltanto ricerche: una lettura non ha contenuto. */
export function loader() {
  assertPreviewAvailable();
  return new Response(null, { status: 405, headers: { allow: "POST" } });
}

/**
 * Ricerca della barra superiore sugli scenari sintetici, con la stessa risposta della route
 * reale: query nel corpo, elenco con la ricerca cifrata nell'indirizzo.
 */
export async function action({ request }: Route.ActionArgs) {
  const [{ language, scenario }, form] = await Promise.all([
    currentScenario(request),
    request.formData(),
  ]);
  const query = searchQuery(form.get("q"));
  const path = localizedPath(language, previewOrdersPath);
  const href = query
    ? await searchHref(env.BETTER_AUTH_SECRET, previewSearchScope, path, query)
    : path;
  if (!request.headers.get("accept")?.includes("application/json")) return redirect(href, 303);
  const matches = query ? previewSearchMatches(scenario.orders, query) : [];
  const search = href.slice(path.length);
  return Response.json(
    {
      items: matches.slice(0, 5).map((order) => ({
        id: order.id,
        ebayOrderId: order.ebayOrderId,
        buyerName: buyerNameView(order.buyerName) ?? order.buyerUsername ?? "",
        detail: order.items[0]?.title ?? "",
        href: `${path}/${order.id}${search}`,
      })),
      total: matches.length,
      href,
    } satisfies SearchResults,
    { headers: { "cache-control": "no-store" } },
  );
}
