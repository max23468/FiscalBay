import { env } from "cloudflare:workers";
import {
  data,
  isRouteErrorResponse,
  redirect,
  useOutletContext,
  type ShouldRevalidateFunctionArgs,
} from "react-router";

import { OrdersPage, type OrdersPageData, type UnlockResult } from "~/components/orders/page";
import { NotFoundState, UnavailableState } from "~/components/not-found";
import { appHref } from "../app-links";
import { appCopy } from "../app-copy";
import { languageFromPath, localizedPath } from "../i18n";
import { defaultTemplate } from "../preferences";
import { rememberedStore, snapshotOnlyAdded } from "../orders/order-list";
import { openSearch } from "../orders/order-search.server";
import { previewOrderPage, previewSearchScope } from "../preview/order-list.server";
import {
  currentScenario,
  pageScenario,
  simulateAction,
  writePreviewState,
} from "../preview/state.server";
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
  const { language, scenario, state } = await pageScenario(request);
  const search = new URL(request.url).searchParams;
  const stores = scenario.stores
    .filter((store) => store.pauseReason !== "plan")
    .map((store) => ({ id: store.id, name: store.name }));
  // Come nell'area reale, un nuovo accesso riapre il negozio scelto l'ultima volta.
  const remembered =
    search.size === 0 && !params.ordine
      ? rememberedStore(
          request.headers.get("cookie"),
          stores.map((store) => store.id),
        )
      : null;
  if (remembered)
    throw redirect(
      `${localizedPath(language, "/anteprima/ordini")}?negozio=${encodeURIComponent(remembered)}`,
    );
  const query = await openSearch(env.BETTER_AUTH_SECRET, previewSearchScope, search);
  const page = previewOrderPage(
    scenario.orders,
    scenario.incoming,
    search,
    query,
    scenario.now,
    (next) => `${localizedPath(language, "/anteprima/ordini")}?${next.toString()}`,
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
    search: query,
    detail,
    stores,
    account: scenario.account,
    notices: scenario.notices,
    sync: {
      running: scenario.syncRunning,
      lastAt: vintage?.lastSyncAt ?? null,
      storeId: vintage?.id ?? null,
      storeName: vintage?.name ?? null,
      historyDays: vintage?.historyDays ?? 30,
    },
    onboarding: scenario.onboarding,
    messageTemplates: { it: defaultTemplate("it"), en: defaultTemplate("en") },
    now: scenario.now,
    confirmUnlock: state.confirmUnlock !== false,
    settings: true,
    exportable: true,
    openOnEbay: true,
  };
  return pageData;
}

/** L'istantanea aggiunta all'indirizzo è quella della risposta già mostrata. */
export function shouldRevalidate({
  currentUrl,
  nextUrl,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  return snapshotOnlyAdded(currentUrl, nextUrl) ? false : defaultShouldRevalidate;
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
  if (isRouteErrorResponse(error) && error.status === 503) return <UnavailableState t={t} />;
  if (!isRouteErrorResponse(error) || error.status !== 404) throw error;
  return <NotFoundState kind="order" t={t} links={links} />;
}
