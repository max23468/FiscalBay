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
function messageFor(
  t: AuthErrorCopy,
  error: string | null,
  provider: string | null,
): { title: string; body: string } {
  if (error === "email_not_found") return t.ebayWithoutEmail;
  if (error === "account_not_linked") return t.accountNotLinked;
  if (error === "account_already_linked_to_different_user")
    return {
      title: t.alreadyLinked.title,
      body:
        provider === "google" || provider === "ebay"
          ? t.alreadyLinked.body(provider === "google" ? "Google" : "eBay")
          : t.alreadyLinked.generic,
    };
  return t;
}

export function meta({ location }: Route.MetaArgs): Route.MetaDescriptors {
  const language = languageFromPath(location.pathname);
  const search = new URLSearchParams(location.search);
  return [
    {
      title: `FiscalBay | ${messageFor(appCopy[language].authError, search.get("error"), search.get("provider")).title}`,
    },
  ];
}

export default function AuthError({ matches }: Route.ComponentProps) {
  const language = matches[0]?.loaderData?.language ?? "it";
  const t = appCopy[language].authError;
  const [search] = useSearchParams();
  const message = messageFor(t, search.get("error"), search.get("provider"));
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
        data-slot="button"
        className={cn(buttonVariants({ variant: "outline" }), "w-fit")}
      >
        {t.back}
      </a>
    </StandalonePage>
  );
}
