import type { Route } from "./+types/auth-error";
import { languageFromPath, localizedPath, translate } from "../i18n";

export function meta({ location }: Route.MetaArgs): Route.MetaDescriptors {
  const language = languageFromPath(location.pathname);
  return [{ title: `${translate(language, "authIncomplete")} — FiscalBay` }];
}

export default function AuthError({ matches }: Route.ComponentProps) {
  const language = matches[0]?.loaderData?.language ?? "it";
  return (
    <main className="mx-auto grid w-[min(36rem,calc(100%-2rem))] gap-3 py-16">
      <p className="text-sm font-semibold text-primary">FiscalBay</p>
      <h1 className="text-3xl font-bold">{translate(language, "authIncomplete")}</h1>
      <p className="text-muted-foreground">{translate(language, "authRetry")}</p>
      <a href={localizedPath(language)} className="w-fit text-primary underline underline-offset-4">
        {translate(language, "backHome")}
      </a>
    </main>
  );
}
