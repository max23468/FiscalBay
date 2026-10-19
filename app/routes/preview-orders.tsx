import { data, isRouteErrorResponse, useOutletContext } from "react-router";

import { OrdersPage, type OrdersPageData, type UnlockResult } from "~/components/orders/page";
import { NotFoundState } from "~/components/not-found";
import { appHref } from "../app-links";
import { appCopy } from "../app-copy";
import { languageFromPath, localizedPath } from "../i18n";
import { currentScenario, simulateAction, writePreviewState } from "../preview/state.server";
import { orderPage } from "../order-list";
import type { PreviewContext } from "./preview";
import type { Route } from "./+types/preview-orders";

export function meta({ location }: Route.MetaArgs): Route.MetaDescriptors {
  const t = appCopy[languageFromPath(location.pathname)];
  return [
    { title: `FiscalBay | ${t.orders.title}` },
    { name: "robots", content: "noindex, nofollow" },
  ];
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
