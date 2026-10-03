import { cn } from "cn";
import { LogIn } from "lucide-react";
import { useSearchParams } from "react-router";

import { StandalonePage } from "~/components/standalone-page";
import { buttonVariants } from "~/components/ui/button-variants";
import type { Route } from "./+types/auth-error";
import { appCopy } from "../app-copy";
import { languageFromPath, localizedPath } from "../i18n";

type AuthErrorCopy = (typeof appCopy)["it"]["authError"];

// Better Auth indica la causa nel parametro `error`; i codici non previsti usano il testo generico.
function messageFor(t: AuthErrorCopy, error: string | null): { title: string; body: string } {
  if (error === "email_not_found") return t.ebayWithoutEmail;
  if (error === "account_not_linked") return t.accountNotLinked;
  if (error === "account_already_linked_to_different_user") return t.alreadyLinked;
  return t;
}

export function meta({ location }: Route.MetaArgs): Route.MetaDescriptors {
  const language = languageFromPath(location.pathname);
  const error = new URLSearchParams(location.search).get("error");
  return [{ title: `FiscalBay | ${messageFor(appCopy[language].authError, error).title}` }];
}

export default function AuthError({ matches }: Route.ComponentProps) {
  const language = matches[0]?.loaderData?.language ?? "it";
  const t = appCopy[language].authError;
  const message = messageFor(t, useSearchParams()[0].get("error"));
  return (
    <StandalonePage
      icon={LogIn}
      tone="amber"
      title={message.title}
      homeHref={localizedPath(language)}
    >
      <p className="leading-relaxed text-pretty text-muted-foreground">{message.body}</p>
      <a href="mailto:supporto@fiscalbay.it" className="w-fit underline underline-offset-4">
        {t.support}: supporto@fiscalbay.it
      </a>
      <a
        href={localizedPath(language)}
        className={cn(buttonVariants({ variant: "outline" }), "w-fit")}
      >
        {t.back}
      </a>
    </StandalonePage>
  );
}
