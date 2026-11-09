import { data, isRouteErrorResponse, redirect } from "react-router";

import { SettingsPage } from "~/components/settings/page";
import { NotFoundState } from "~/components/not-found";
import { appCopy, pageTitle } from "../app-copy";
import { languageFromPath, settingsSectionParam } from "../i18n";
import { previewSettingsPage } from "../preview/settings-page.server";
import {
  assertPreviewAction,
  verifiedPageScenario,
  simulateAction,
  simulateSecurity,
} from "../preview/state.server";
import { isSettingsSection, mergedSectionUrl } from "../area-sections";
import type { Route } from "./+types/preview-settings";

export function meta({ location, params }: Route.MetaArgs): Route.MetaDescriptors {
  const t = appCopy[languageFromPath(location.pathname)];
  const section = settingsSectionParam(params.sezione);
  const title = isSettingsSection(section)
    ? `${t.settings.sections[section].title} | ${t.settings.title}`
    : t.settings.title;
  return [{ title: pageTitle(title) }, { name: "robots", content: "noindex, nofollow" }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const sezione = settingsSectionParam(params.sezione);
  const merged = mergedSectionUrl(new URL(request.url), sezione);
  if (merged) throw redirect(merged, 301);
  const current = await verifiedPageScenario(request);
  if (sezione !== undefined && !isSettingsSection(sezione)) {
    throw data(null, { status: 404 });
  }
  return previewSettingsPage(request, current, sezione ?? null);
}

/** Azioni dei componenti: nell'anteprima nessun effetto, solo la risposta simulata. */
export async function action({ request }: Route.ActionArgs) {
  assertPreviewAction(request);
  const form = await request.formData();
  return simulateSecurity(request, form) ?? simulateAction(request, form);
}

export default function PreviewSettings({ loaderData }: Route.ComponentProps) {
  return <SettingsPage data={loaderData} />;
}

/** Un indirizzo inesistente resta dentro l'app, con la strada per tornare all'elenco. */
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  // Il 503 di Auth o database: il layout mostra già la pagina a sé, come l'area reale.
  if (isRouteErrorResponse(error) && error.status === 503) return null;
  if (!isRouteErrorResponse(error) || error.status !== 404) throw error;
  return <NotFoundState kind="page" />;
}
