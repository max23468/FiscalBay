import { cn } from "cn";
import { LogIn } from "lucide-react";

import { StandalonePage } from "~/components/standalone-page";
import { buttonVariants } from "~/components/ui/button-variants";
import type { Route } from "./+types/auth-error";
import { appCopy } from "../app-copy";
import { languageFromPath, localizedPath } from "../i18n";

export function meta({ location }: Route.MetaArgs): Route.MetaDescriptors {
  const language = languageFromPath(location.pathname);
  return [{ title: `FiscalBay | ${appCopy[language].authError.title}` }];
}

export default function AuthError({ matches }: Route.ComponentProps) {
  const language = matches[0]?.loaderData?.language ?? "it";
  const t = appCopy[language].authError;
  return (
    <StandalonePage icon={LogIn} tone="amber" title={t.title} homeHref={localizedPath(language)}>
      <p className="leading-relaxed text-pretty text-muted-foreground">{t.body}</p>
      <a
        href={localizedPath(language)}
        className={cn(buttonVariants({ variant: "outline" }), "w-fit")}
      >
        {t.back}
      </a>
    </StandalonePage>
  );
}
