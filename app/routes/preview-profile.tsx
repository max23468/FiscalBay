import { isRouteErrorResponse, useOutletContext } from "react-router";

import { UnavailableState } from "~/components/not-found";
import { ProfilePage } from "~/components/settings/profile";
import { appCopy, pageTitle } from "../app-copy";
import { languageFromPath } from "../i18n";
import { pageScenario, simulateAction } from "../preview/state.server";
import type { PreviewContext } from "./preview";
import type { Route } from "./+types/preview-profile";

export function meta({ location }: Route.MetaArgs): Route.MetaDescriptors {
  const t = appCopy[languageFromPath(location.pathname)];
  return [{ title: pageTitle(t.profile.title) }, { name: "robots", content: "noindex, nofollow" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { scenario } = await pageScenario(request);
  return { account: scenario.account };
}

/** Azioni dei componenti: nell'anteprima nessun effetto, solo la risposta simulata. */
export async function action({ request }: Route.ActionArgs) {
  return simulateAction(request, await request.formData());
}

export default function PreviewProfile({ loaderData }: Route.ComponentProps) {
  const { t, links } = useOutletContext<PreviewContext>();
  return <ProfilePage account={loaderData.account} t={t} links={links} />;
}

/** Con Auth o database non disponibili il profilo non mostra dati. */
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const { t } = useOutletContext<PreviewContext>();
  if (!isRouteErrorResponse(error) || error.status !== 503) throw error;
  return <UnavailableState t={t} />;
}
