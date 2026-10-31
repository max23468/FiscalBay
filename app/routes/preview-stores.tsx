import { data, isRouteErrorResponse } from "react-router";

import { AccessNotice } from "~/components/access-notice";
import { StoresPage } from "~/components/stores/page";
import type { StoresPageData } from "~/components/stores/state";
import { NotFoundState } from "~/components/not-found";
import { accessNotice } from "../access-notice";
import { appCopy, pageTitle } from "../app-copy";
import { languageFromPath } from "../i18n";
import type { AccountView } from "../view-models";
import { assertPreviewAction, verifiedPageScenario, simulateAction } from "../preview/state.server";
import type { Route } from "./+types/preview-stores";

export function meta({ location }: Route.MetaArgs): Route.MetaDescriptors {
  const t = appCopy[languageFromPath(location.pathname)];
  return [{ title: pageTitle(t.stores.title) }, { name: "robots", content: "noindex, nofollow" }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { scenario, language } = await verifiedPageScenario(request);
  const detail = params.negozio
    ? (scenario.stores.find((store) => store.id === params.negozio) ?? null)
    : null;
  if (params.negozio && !detail) throw data(null, { status: 404 });
  const page: StoresPageData = {
    stores: scenario.stores,
    detail,
    account: scenario.account,
    now: scenario.now,
    ebayDown: scenario.ebayDown ? ["production"] : [],
    ebayMaintenance: scenario.ebayMaintenance,
    settings: true,
    notificationSettings: true,
    // Come nell'area reale: un abbonamento che addebiterà ancora, anche con il pagamento in
    // attivazione o dopo un periodo rimborsato, non si disdice scollegando.
    subscriptionRenews: renewsAfterUnlink(scenario.account),
  };
  // Come nell'area reale, l'esito del collegamento arriva nell'indirizzo.
  return { page, notice: accessNotice(new URL(request.url).searchParams, language) };
}

function renewsAfterUnlink({ premium, payment }: Pick<AccountView, "premium" | "payment">) {
  if (premium?.renewsAt && premium.period !== "lifetime") return true;
  if (payment?.state === "scheduled") return !payment.cancelled;
  if (payment?.state === "pending") return !payment.lifetime;
  return payment?.state === "refunded" && !!payment.renewsAt;
}

/** Azioni dei componenti: nell'anteprima nessun effetto, solo la risposta simulata. */
export async function action({ request }: Route.ActionArgs) {
  assertPreviewAction(request);
  return simulateAction(request, await request.formData());
}

export default function PreviewStores({ loaderData }: Route.ComponentProps) {
  return <StoresPage data={loaderData.page} notice={<AccessNotice notice={loaderData.notice} />} />;
}

/** Un indirizzo inesistente resta dentro l'app, con la strada per tornare all'elenco. */
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  // Il 503 di Auth o database: il layout mostra già la pagina a sé, come l'area reale.
  if (isRouteErrorResponse(error) && error.status === 503) return null;
  if (!isRouteErrorResponse(error) || error.status !== 404) throw error;
  return <NotFoundState kind="store" />;
}
