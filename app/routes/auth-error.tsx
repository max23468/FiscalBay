import type { Route } from "./+types/auth-error";
import { languageFromPath, localizedPath, translate } from "../i18n";

export function meta({ location }: Route.MetaArgs): Route.MetaDescriptors {
  const language = languageFromPath(location.pathname);
  return [{ title: `${translate(language, "authIncomplete")} — FiscalBay` }];
}

export default function AuthError({ matches }: Route.ComponentProps) {
  const language = matches[0]?.loaderData?.language ?? "it";
  return (
    <main>
      <section className="empty">
        <p className="eyebrow">FiscalBay</p>
        <h1>{translate(language, "authIncomplete")}</h1>
        <p>{translate(language, "authRetry")}</p>
        <a href={localizedPath(language)}>{translate(language, "backHome")}</a>
      </section>
    </main>
  );
}
