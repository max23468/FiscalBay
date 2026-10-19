import { data, isRouteErrorResponse, useOutletContext } from "react-router";

import { OrdersPage, type OrdersPageData, type UnlockResult } from "~/components/orders/page";
import { NotFoundState } from "~/components/not-found";
import { appHref } from "../app-links";
import { appCopy } from "../app-copy";
import { languageFromPath, localizedPath } from "../i18n";
import { currentScenario, simulateAction, writePreviewState } from "../preview/state.server";
import { ordersPageSize } from "../order-list";
import { displayTaxValue } from "../tax-quality";
import { fiscalStates, paymentStatuses, shippingStatuses, type OrderView } from "../view-models";
import type { PreviewContext } from "./preview";
import type { Route } from "./+types/preview-orders";

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

/**
 * Criteri dell'URL sugli scenari sintetici: la ricerca considera soltanto i valori fiscali
 * disponibili, mai quelli da sbloccare. L'area reale filtra con la query del dominio.
 */
function matchesOrder(order: OrderView, params: URLSearchParams, now: string) {
  const query = params.get("q")?.trim().toLocaleLowerCase();
  if (query) {
    const text = [
      order.ebayOrderId,
      order.buyerName ?? "",
      order.buyerUsername ?? "",
      ...order.items.flatMap((item) => [item.title, item.sku ?? ""]),
      ...(order.fiscal.state === "available"
        ? order.fiscal.identifiers.flatMap((id) => [id.value, displayTaxValue(id)])
        : []),
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
  if (payment && order.payment.status !== payment) return false;
  const shipping = known(params, "spedizione", shippingStatuses);
  if (shipping && order.shipping.status !== shipping) return false;
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

/**
 * Ordini che corrispondono ai criteri, dal più recente, fino alla pagina indicata da `mostra`;
 * `nextHref` riceve la query della pagina successiva.
 */
function orderPage(
  orders: OrderView[],
  search: URLSearchParams,
  now: string,
  href: (query: URLSearchParams) => string,
) {
  const filtered = orders
    .filter((order) => matchesOrder(order, search, now))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
  const shown = Math.max(Number(search.get("mostra")) || 1, 1);
  const next = new URLSearchParams(search);
  next.set("mostra", String(shown + 1));
  return {
    orders: filtered.slice(0, shown * ordersPageSize),
    total: filtered.length,
    nextHref: filtered.length > shown * ordersPageSize ? href(next) : null,
  };
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { language, scenario, state } = await currentScenario(request);
  const search = new URL(request.url).searchParams;
  const page = orderPage(
    scenario.orders,
    search,
    scenario.now,
    (query) => `${localizedPath(language, "/anteprima/ordini")}?${query.toString()}`,
  );
  const detail = params.ordine
    ? ([...scenario.orders, ...scenario.incoming].find((order) => order.id === params.ordine) ??
      null)
    : null;
  if (params.ordine && !detail) throw data(null, { status: 404 });
  const vintage = scenario.stores[0];
  const pageData: OrdersPageData = {
    view: scenario.view,
    ...page,
    incoming: scenario.incoming,
    detail,
    stores: scenario.stores
      .filter((store) => store.pauseReason !== "plan")
      .map((store) => ({ id: store.id, name: store.name })),
    marketplaces: [
      ...new Set(
        scenario.orders.flatMap((order) => (order.marketplace ? [order.marketplace] : [])),
      ),
    ],
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
    confirmUnlock: state.confirmUnlock !== false,
    settings: true,
    exportable: true,
    openOnEbay: true,
  };
  return pageData;
}

/**
 * Sblocco simulato con gli stessi controlli del server reale su appartenenza e
 * quota; le altre azioni rispondono con la simulazione comune.
 */
export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  if (form.get("intent") !== "unlock") return simulateAction(request, form);
  const { state, scenario } = await currentScenario(request);
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
    return data<UnlockResult>({ unlocked: [], remaining, error: true }, { status: 400 });
  }
  if (remaining !== null && ids.length > remaining)
    return data<UnlockResult>({ unlocked: [], remaining, error: true }, { status: 409 });
  if (state.scenario === "sblocco-non-riuscito" && !state.saveFailed)
    return data<UnlockResult>(
      { unlocked: [], remaining, error: true },
      {
        status: 409,
        headers: {
          "Set-Cookie": await writePreviewState({ ...state, saveFailed: true }),
        },
      },
    );
  const result: UnlockResult = {
    unlocked: ids,
    remaining: remaining === null ? null : remaining - ids.length,
  };
  return data(result, {
    headers: {
      "Set-Cookie": await writePreviewState({
        ...state,
        unlocked: [...state.unlocked, ...ids],
        confirmUnlock:
          ids.length === 1 && form.get("skipConfirmation") === "true" ? false : state.confirmUnlock,
      }),
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
