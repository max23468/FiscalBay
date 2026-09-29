import { cn } from "cn";
import { LogIn } from "lucide-react";
import { useSearchParams } from "react-router";

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
  // Better Auth indica la causa nel parametro `error`; i codici non previsti usano il testo generico.
  const error = useSearchParams()[0].get("error");
  const message =
    error === "email_not_found"
      ? t.ebayWithoutEmail
      : error === "account_not_linked"
        ? t.accountNotLinked
        : t;
  return (
    <StandalonePage
      icon={LogIn}
      tone="amber"
      title={message.title}
      homeHref={localizedPath(language)}
    >
      <p className="leading-relaxed text-pretty text-muted-foreground">{message.body}</p>
      <a
        href={localizedPath(language)}
        className={cn(buttonVariants({ variant: "outline" }), "w-fit")}
      >
        {t.back}
      </a>
    </StandalonePage>
  );
}
