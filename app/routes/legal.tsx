import type { Route } from "./+types/legal";
import { appCopy } from "../app-copy";
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
  return [{ title: `${appCopy[loaderData.language].legal[loaderData.document]} | FiscalBay` }];
}

export default function Legal({ loaderData }: Route.ComponentProps) {
  const { language, document, version } = loaderData;
  const t = appCopy[language].legal;
  return (
    <main className="mx-auto grid w-[min(42rem,calc(100%-2rem))] gap-3 py-16">
      <a href={localizedPath(language)} className="text-sm font-semibold text-primary">
        FiscalBay
      </a>
      <h1 className="text-3xl font-bold">{t[document]}</h1>
      <p className="font-code text-sm text-muted-foreground">{t.version(version)}</p>
      <p className="text-muted-foreground">{t.draft}</p>
    </main>
  );
}
