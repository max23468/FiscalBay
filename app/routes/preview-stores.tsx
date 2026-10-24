import { data, isRouteErrorResponse, useOutletContext } from "react-router";

import { StoresPage } from "~/components/stores/page";
import type { StoresPageData } from "~/components/stores/state";
import { NotFoundState, UnavailableState } from "~/components/not-found";
import { appCopy, pageTitle } from "../app-copy";
import { languageFromPath } from "../i18n";
import { pageScenario, simulateAction } from "../preview/state.server";
import type { PreviewContext } from "./preview";
import type { Route } from "./+types/preview-stores";

export function meta({ location }: Route.MetaArgs): Route.MetaDescriptors {
  const t = appCopy[languageFromPath(location.pathname)];
  return [{ title: pageTitle(t.stores.title) }, { name: "robots", content: "noindex, nofollow" }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { scenario } = await pageScenario(request);
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
    elsewhere: scenario.elsewhere,
    settings: true,
    // Come nell'area reale: un abbonamento che si rinnova non si disdice scollegando.
    subscriptionRenews:
      !!scenario.account.premium?.renewsAt && scenario.account.premium.period !== "lifetime",
  };
  return page;
}

/** Azioni dei componenti: nell'anteprima nessun effetto, solo la risposta simulata. */
export async function action({ request }: Route.ActionArgs) {
  return simulateAction(request, await request.formData());
}

export default function PreviewStores({ loaderData }: Route.ComponentProps) {
  const { t, links } = useOutletContext<PreviewContext>();
  return <StoresPage data={loaderData} t={t} links={links} />;
}

/** Un indirizzo inesistente resta dentro l'app, con la strada per tornare all'elenco. */
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const { t, links } = useOutletContext<PreviewContext>();
  if (isRouteErrorResponse(error) && error.status === 503) return <UnavailableState t={t} />;
  if (!isRouteErrorResponse(error) || error.status !== 404) throw error;
  return <NotFoundState kind="store" t={t} links={links} />;
}
