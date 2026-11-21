import { env } from "cloudflare:workers";
import {
  data,
  isRouteErrorResponse,
  redirect,
  type ShouldRevalidateFunctionArgs,
} from "react-router";

import { VerifyEmail } from "~/components/access-notice";
import { useLinks } from "~/components/copy-context";
import { NotFoundState } from "~/components/not-found";
import { OrdersLoading } from "~/components/orders/loading";
import { OrdersPage } from "~/components/orders/page";

import { appCopy, pageTitle } from "../app-copy";
import { appHref, isDemoPath } from "../app-links";
import { historyWindowDays } from "../domain/history-window.server";
import { languageFromPath, localizedPath } from "../i18n";
import { rememberedStoreHref, revalidateUnlessSnapshot } from "../orders/order-list";
import { openSearch } from "../orders/order-search.server";
import {
  readUnlockForm,
  remainingUnlocks,
  unlockFailure,
  unlockIntent,
  type OrdersPageData,
  type UnlockResult,
} from "../orders/page-data";
import { defaultTemplate } from "../preferences";
import { previewOrderPage, previewSearchScope } from "../preview/order-list.server";
import { scenarioVerified } from "../preview/scenarios.server";
import {
  assertPreviewAction,
  currentScenario,
  demoAction,
  pageScenario,
  previewRoot,
  simulateAction,
  writePreviewState,
} from "../preview/state.server";
import { sourceParam } from "../signup-source";
import type { Route } from "./+types/preview-orders";

export function meta({ location }: Route.MetaArgs): Route.MetaDescriptors {
  const t = appCopy[languageFromPath(location.pathname)];
  const title = isDemoPath(location.pathname)
    ? `${t.orders.title} | ${t.demo.name}`
    : t.orders.title;
  return [{ title: pageTitle(title) }, { name: "robots", content: "noindex, nofollow" }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { language, scenario, state, demo } = await pageScenario(request);
  // Come la navigazione verso gli Ordini dell'area reale, prima che arrivino i dati.
  if (scenario.view === "loading") return { loading: true as const };
  const ordersPath = localizedPath(language, `${previewRoot(request)}/ordini`);
  const search = new URL(request.url).searchParams;
  // La provenienza resta al layout della demo: i link dell'elenco non la ripetono.
  search.delete(sourceParam);
  const stores = scenario.stores
    .filter((store) => store.pauseReason !== "plan")
    .map((store) => ({ id: store.id, name: store.name }));
  // Come nell'area reale, un nuovo accesso riapre il negozio scelto l'ultima volta.
  const remembered = rememberedStoreHref(
    request,
    ordersPath,
    params.ordine,
    stores.map((store) => store.id),
  );
  if (remembered) throw redirect(remembered);
  const query = await openSearch(env.BETTER_AUTH_SECRET, previewSearchScope, search);
  const page = previewOrderPage(
    scenario.orders,
    scenario.incoming,
    search,
    query,
    scenario.now,
    scenario.account.plan,
    (next) => `${ordersPath}?${next.toString()}`,
  );
  const detail = params.ordine
    ? ([...scenario.orders, ...scenario.incoming].find((order) => order.id === params.ordine)
      ?? null)
    : null;
  if (params.ordine && !detail) throw data(null, { status: 404 });
  const vintage = scenario.stores[0];
  const verified = scenarioVerified(scenario);
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
      // Come nell'area reale: prima del primo avvio vale la finestra del piano.
      historyDays:
        vintage?.historyDays
        ?? historyWindowDays(scenario.account.plan === "premium", new Date(scenario.now)),
    },
    onboarding: scenario.onboarding,
    marketingProposal: !!scenario.marketingProposal && !state.marketingAnswered,
    messageTemplates: { it: defaultTemplate("it"), en: defaultTemplate("en") },
    now: scenario.now,
    confirmUnlock: state.confirmUnlock !== false,
    // La demo non ha Impostazioni né esportazione, e gli ordini di esempio non esistono su eBay.
    settings: !demo,
    // Come nell'area reale, prima della conferma dell'email non si collega né si esporta.
    exportable: verified && !demo,
    openOnEbay: !demo,
    ...(verified ? {} : { connectHref: null }),
  };
  return {
    ...pageData,
    email: verified
      ? null
      : {
          address: scenario.account.email,
          deletion: { methods: scenario.signInMethods, currentSession: null, ready: true },
        },
  };
}

/** L'istantanea aggiunta all'indirizzo è quella della risposta già mostrata. */
export function shouldRevalidate(args: ShouldRevalidateFunctionArgs) {
  return revalidateUnlessSnapshot(args);
}

/**
 * Sblocco simulato con gli stessi controlli del server reale su appartenenza e quota; le altre
 * azioni rispondono con la simulazione comune.
 */
export async function action({ request }: Route.ActionArgs) {
  assertPreviewAction(request);
  const readOnly = demoAction(request);
  if (readOnly) return readOnly;
  const form = await request.formData();
  if (form.get("intent") !== unlockIntent) return simulateAction(request, form);
  const { state, scenario } = await currentScenario(request);
  const unlock = readUnlockForm(form);
  const ids = [...new Set(unlock.ids.filter(Boolean))];
  const { skipConfirmation } = unlock;
  const remaining = remainingUnlocks(scenario.account);
  if (ids.length === 0 || ids.some((id) => !scenario.lockedValues[id])) {
    return data(unlockFailure(remaining), { status: 400 });
  }
  if (remaining !== null && ids.length > remaining)
    return data(unlockFailure(remaining), { status: 409 });
  if (state.scenario === "sblocco-non-riuscito" && !state.saveFailed)
    return data(unlockFailure(remaining), {
      status: 409,
      headers: { "Set-Cookie": await writePreviewState({ ...state, saveFailed: true }) },
    });
  const result: UnlockResult = {
    unlocked: ids,
    remaining: remaining === null ? null : remaining - ids.length,
  };
  return data(result, {
    headers: {
      "Set-Cookie": await writePreviewState({
        ...state,
        unlocked: [...state.unlocked, ...ids],
        confirmUnlock: ids.length === 1 && skipConfirmation ? false : state.confirmUnlock,
      }),
    },
  });
}

export default function PreviewOrders({ loaderData }: Route.ComponentProps) {
  const { links } = useLinks();
  if ("loading" in loaderData) return <OrdersLoading />;
  const { email } = loaderData;
  return (
    <OrdersPage
      data={loaderData}
      unlockAction={appHref(links, "ordini")}
      notice={
        email ? (
          <VerifyEmail email={email.address} verified={false} deletion={email.deletion} />
        ) : null
      }
    />
  );
}

/** Un indirizzo inesistente resta dentro l'app, con la strada per tornare all'elenco. */
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  // Il 503 di Auth o database: il layout mostra già la pagina a sé, come l'area reale.
  if (isRouteErrorResponse(error) && error.status === 503) return null;
  if (!isRouteErrorResponse(error) || error.status !== 404) throw error;
  return <NotFoundState kind="order" />;
}
