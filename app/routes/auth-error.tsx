import type { Route } from "./+types/auth-error";
import { appCopy } from "../app-copy";
import { languageFromPath, localizedPath } from "../i18n";

export function meta({ location }: Route.MetaArgs): Route.MetaDescriptors {
  const language = languageFromPath(location.pathname);
  return [{ title: `${appCopy[language].authError.title} | FiscalBay` }];
}

export default function AuthError({ matches }: Route.ComponentProps) {
  const language = matches[0]?.loaderData?.language ?? "it";
  const t = appCopy[language].authError;
  return (
    <main className="mx-auto grid w-[min(36rem,calc(100%-2rem))] gap-3 py-16">
      <p className="text-sm font-semibold text-primary">FiscalBay</p>
      <h1 className="text-3xl font-bold">{t.title}</h1>
      <p className="text-muted-foreground">{t.body}</p>
      <a href={localizedPath(language)} className="w-fit text-primary underline underline-offset-4">
        {t.back}
      </a>
    </main>
  );
}
