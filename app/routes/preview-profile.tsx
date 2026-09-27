import { useOutletContext } from "react-router";

import { ProfilePage } from "~/components/settings";
import { appCopy } from "../app-copy";
import { languageFromPath } from "../i18n";
import { currentScenario } from "../preview/state.server";
import type { PreviewContext } from "./preview";
import type { Route } from "./+types/preview-profile";

export function meta({ location }: Route.MetaArgs): Route.MetaDescriptors {
  const t = appCopy[languageFromPath(location.pathname)];
  return [
    { title: `FiscalBay | ${t.profile.title}` },
    { name: "robots", content: "noindex, nofollow" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { scenario } = await currentScenario(request);
  return { account: scenario.account };
}

export default function PreviewProfile({ loaderData }: Route.ComponentProps) {
  const { t, links } = useOutletContext<PreviewContext>();
  return <ProfilePage account={loaderData.account} t={t} links={links} />;
}
