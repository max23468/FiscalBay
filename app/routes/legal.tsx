import { FileText, ShieldCheck } from "lucide-react";
import { buttonLink } from "~/components/ui/button-variants";

import { StandalonePage } from "~/components/standalone-page";
import type { Route } from "./+types/legal";
import { appCopy, pageTitle } from "../app-copy";
import { legalVersions } from "../domain/registration.server";
import { languageFromPath, localizedPath } from "../i18n";

const documents = { termini: "terms", privacy: "privacy" } as const;

export function loader({ request }: Route.LoaderArgs) {
  const { pathname } = new URL(request.url);
  const document: keyof typeof documents = pathname.endsWith("/privacy") ? "privacy" : "termini";
  return {
    language: languageFromPath(pathname),
    document,
    version: legalVersions[documents[document]],
  };
}

export function meta({ loaderData }: Route.MetaArgs): Route.MetaDescriptors {
  return [{ title: pageTitle(appCopy[loaderData.language].legal[loaderData.document]) }];
}

export default function Legal({ loaderData }: Route.ComponentProps) {
  const { language, document, version } = loaderData;
  const t = appCopy[language].legal;
  return (
    <StandalonePage
      icon={document === "privacy" ? ShieldCheck : FileText}
      tone="neutral"
      title={t[document]}
      homeHref={localizedPath(language)}
    >
      <p className="text-sm text-muted-foreground">{t.version(version)}</p>
      <p className="leading-relaxed text-pretty text-muted-foreground">{t.draft}</p>
      <a href={localizedPath(language)} {...buttonLink({ variant: "outline", className: "w-fit" })}>
        {appCopy[language].errors.home}
      </a>
    </StandalonePage>
  );
}
