import { data, useOutletContext } from "react-router";

import { StoresPage, type StoresPageData } from "~/components/stores";
import { appCopy } from "../app-copy";
import { languageFromPath } from "../i18n";
import { currentScenario } from "../preview/state.server";
import type { PreviewContext } from "./preview";
import type { Route } from "./+types/preview-stores";

export function meta({ location }: Route.MetaArgs): Route.MetaDescriptors {
  const t = appCopy[languageFromPath(location.pathname)];
  return [
    { title: `FiscalBay | ${t.stores.title}` },
    { name: "robots", content: "noindex, nofollow" },
  ];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { scenario } = await currentScenario(request);
  const detail = params.negozio
    ? (scenario.stores.find((store) => store.id === params.negozio) ?? null)
    : null;
  if (params.negozio && !detail) throw data(null, { status: 404 });
  const page: StoresPageData = {
    stores: scenario.stores,
    detail,
    account: scenario.account,
    now: scenario.now,
    ebayDown: scenario.ebayDown,
    elsewhere: scenario.elsewhere,
  };
  return page;
}

export default function PreviewStores({ loaderData }: Route.ComponentProps) {
  const { t, links } = useOutletContext<PreviewContext>();
  return <StoresPage data={loaderData} t={t} links={links} />;
}
