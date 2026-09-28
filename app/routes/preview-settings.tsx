import { data, isRouteErrorResponse, useOutletContext } from "react-router";

import { SettingsPage, type SettingsPageData } from "~/components/settings";
import { NotFoundState } from "~/components/not-found";
import { appCopy } from "../app-copy";
import { languageFromPath } from "../i18n";
import { currentScenario, simulateAction } from "../preview/state.server";
import { settingsSections, type SettingsSection } from "../view-models";
import type { PreviewContext } from "./preview";
import type { Route } from "./+types/preview-settings";

function isSection(value: string | undefined): value is SettingsSection {
  return (settingsSections as readonly string[]).includes(value ?? "");
}

export function meta({ location, params }: Route.MetaArgs): Route.MetaDescriptors {
  const t = appCopy[languageFromPath(location.pathname)];
  const title = isSection(params.sezione)
    ? `${t.settings.sections[params.sezione].title} | ${t.settings.title}`
    : t.settings.title;
  return [{ title: `FiscalBay | ${title}` }, { name: "robots", content: "noindex, nofollow" }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { scenario } = await currentScenario(request);
  if (params.sezione !== undefined && !isSection(params.sezione)) {
    throw data(null, { status: 404 });
  }
  const page: SettingsPageData = {
    section: params.sezione ?? null,
    account: scenario.account,
    stores: scenario.stores.filter((store) => store.pauseReason !== "plan"),
    sessions: scenario.sessions,
    diagnostics: scenario.diagnostics,
    telegramChat: scenario.telegramChat,
    exportEstimate: {
      orders: scenario.orders.length,
      locked: scenario.orders.filter((order) => order.fiscal.state === "locked").length,
    },
    now: scenario.now,
  };
  return page;
}

/** Azioni dei componenti: nell'anteprima nessun effetto, solo la risposta simulata. */
export async function action({ request }: Route.ActionArgs) {
  return simulateAction(request, await request.formData());
}

export default function PreviewSettings({ loaderData }: Route.ComponentProps) {
  const { t, links } = useOutletContext<PreviewContext>();
  return <SettingsPage data={loaderData} t={t} links={links} />;
}

/** Un indirizzo inesistente resta dentro l'app, con la strada per tornare all'elenco. */
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const { t, links } = useOutletContext<PreviewContext>();
  if (!isRouteErrorResponse(error) || error.status !== 404) throw error;
  return <NotFoundState kind="page" t={t} links={links} />;
}
