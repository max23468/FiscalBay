import { data, isRouteErrorResponse } from "react-router";

import { SettingsPage } from "~/components/settings/page";
import { NotFoundState } from "~/components/not-found";
import { appCopy, pageTitle } from "../app-copy";
import { languageFromPath } from "../i18n";
import { previewSettingsPage } from "../preview/settings-page.server";
import {
  assertPreviewAction,
  pageScenario,
  simulateAction,
  simulateSecurity,
} from "../preview/state.server";
import { settingsSections, type SettingsSection } from "../view-models";
import type { Route } from "./+types/preview-settings";

function isSection(value: string | undefined): value is SettingsSection {
  return (settingsSections as readonly string[]).includes(value ?? "");
}

export function meta({ location, params }: Route.MetaArgs): Route.MetaDescriptors {
  const t = appCopy[languageFromPath(location.pathname)];
  const title = isSection(params.sezione)
    ? `${t.settings.sections[params.sezione].title} | ${t.settings.title}`
    : t.settings.title;
  return [{ title: pageTitle(title) }, { name: "robots", content: "noindex, nofollow" }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const current = await pageScenario(request);
  if (params.sezione !== undefined && !isSection(params.sezione)) {
    throw data(null, { status: 404 });
  }
  return previewSettingsPage(request, current, params.sezione ?? null);
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
