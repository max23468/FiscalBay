import { data, isRouteErrorResponse, useOutletContext } from "react-router";

import { OrdersPage, type OrdersPageData, type UnlockResult } from "~/components/orders";
import { NotFoundState } from "~/components/not-found";
import { appHref } from "../app-links";
import { appCopy } from "../app-copy";
import { languageFromPath, localizedPath } from "../i18n";
import { currentScenario, writePreviewState } from "../preview/state.server";
import { fiscalStates, paymentStatuses, shippingStatuses, type OrderView } from "../view-models";
import type { PreviewContext } from "./preview";
import type { Route } from "./+types/preview-orders";

const pageSize = 6;

export function meta({ location }: Route.MetaArgs): Route.MetaDescriptors {
  const t = appCopy[languageFromPath(location.pathname)];
  return [
    { title: `FiscalBay | ${t.orders.title}` },
    { name: "robots", content: "noindex, nofollow" },
  ];
}

/** Valore di un filtro dell'URL, ignorato se non è tra quelli previsti. */
function known(params: URLSearchParams, name: string, values: readonly string[]) {
  const value = params.get(name);
  return value && values.includes(value) ? value : null;
}

function matches(order: OrderView, params: URLSearchParams, now: string) {
  const query = params.get("q")?.trim().toLocaleLowerCase();
  if (query) {
    const text = [
      order.ebayOrderId,
      order.buyerName,
      ...order.items.flatMap((item) => [item.title, item.sku ?? ""]),
      ...(order.fiscal.state === "available" ? order.fiscal.identifiers.map((id) => id.value) : []),
    ]
      .join(" ")
      .toLocaleLowerCase();
    if (!query.split(/\s+/u).every((token) => text.includes(token))) return false;
  }
  const store = params.get("negozio");
  if (store && order.storeId !== store) return false;
  const marketplace = params.get("marketplace");
  if (marketplace && order.marketplace !== marketplace) return false;
  const payment = known(params, "pagamento", paymentStatuses);
  if (payment && order.payment !== payment) return false;
  const shipping = known(params, "spedizione", shippingStatuses);
  if (shipping && order.shipping !== shipping) return false;
  const fiscal = known(params, "fiscale", fiscalStates);
  if (fiscal && order.fiscal.state !== fiscal) return false;
  const days = Number(known(params, "periodo", ["7", "30", "90"]));
  if (
    days > 0 &&
    new Date(now).getTime() - new Date(order.createdAt).getTime() > days * 86_400_000
  ) {
    return false;
  }
  return true;
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { language, scenario } = await currentScenario(request);
  const url = new URL(request.url);
  const search = url.searchParams;
  const filtered = scenario.orders
    .filter((order) => matches(order, search, scenario.now))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
  const shown = Math.max(Number(search.get("mostra")) || 1, 1);
  const next = new URLSearchParams(search);
  next.set("mostra", String(shown + 1));
  const detail = params.ordine
    ? ([...scenario.orders, ...scenario.incoming].find((order) => order.id === params.ordine) ??
      null)
    : null;
  if (params.ordine && !detail) throw data(null, { status: 404 });
  const vintage = scenario.stores[0];
  const page: OrdersPageData = {
    view: scenario.view,
    orders: filtered.slice(0, shown * pageSize),
    incoming: scenario.incoming,
    total: filtered.length,
    nextHref:
      filtered.length > shown * pageSize
        ? `${localizedPath(language, "/anteprima/ordini")}?${next.toString()}`
        : null,
    detail,
    stores: scenario.stores
      .filter((store) => store.pauseReason !== "plan")
      .map((store) => ({ id: store.id, name: store.name })),
    marketplaces: [...new Set(scenario.orders.map((order) => order.marketplace))],
    account: scenario.account,
    notices: scenario.notices,
    sync: {
      running: scenario.syncRunning,
      lastAt: vintage?.lastSyncAt ?? null,
      storeId: vintage?.id ?? null,
      storeName: vintage?.name ?? null,
    },
    onboarding: scenario.onboarding,
    messageTemplate:
      appCopy[language].settings[language === "it" ? "templateDefaultIt" : "templateDefaultEn"],
    now: scenario.now,
  };
  return page;
}

/** Sblocco simulato: stessi controlli del server reale su appartenenza e quota. */
export async function action({ request }: Route.ActionArgs) {
  const [{ state, scenario }, form] = await Promise.all([
    currentScenario(request),
    request.formData(),
  ]);
  const ids = [
    ...new Set(
      String(form.get("ids") ?? "")
        .split(",")
        .filter(Boolean),
    ),
  ];
  const quota = scenario.account.quota;
  const remaining = quota ? quota.limit - quota.used : null;
  if (ids.length === 0 || ids.some((id) => !scenario.lockedValues[id])) {
    throw data(null, { status: 400 });
  }
  if (remaining !== null && ids.length > remaining) throw data(null, { status: 409 });
  const result: UnlockResult = {
    unlocked: ids,
    remaining: remaining === null ? null : remaining - ids.length,
  };
  return data(result, {
    headers: {
      "Set-Cookie": await writePreviewState({ ...state, unlocked: [...state.unlocked, ...ids] }),
    },
  });
}

export default function PreviewOrders({ loaderData }: Route.ComponentProps) {
  const { t, links } = useOutletContext<PreviewContext>();
  return (
    <OrdersPage data={loaderData} t={t} links={links} unlockAction={appHref(links, "ordini")} />
  );
}

/** Un indirizzo inesistente resta dentro l'app, con la strada per tornare all'elenco. */
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const { t, links } = useOutletContext<PreviewContext>();
  if (!isRouteErrorResponse(error) || error.status !== 404) throw error;
  return <NotFoundState kind="order" t={t} links={links} />;
}
