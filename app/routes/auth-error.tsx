import { LogIn } from "lucide-react";
import { useSearchParams } from "react-router";

import { StandalonePage } from "~/components/standalone-page";
import { buttonLink } from "~/components/ui/button-variants";
import type { Route } from "./+types/auth-error";
import { appCopy, pageTitle, supportEmail } from "../app-copy";
import { accessPath, securityReturnPath } from "../app-links";
import { languageFromPath, localizedPath } from "../i18n";

type AuthErrorCopy = (typeof appCopy)["it"]["authError"];

// Better Auth indica la causa nel parametro `error`; i codici non previsti usano il testo generico.
function messageFor(
  t: AuthErrorCopy,
  error: string | null,
  provider: string | null,
): { title: string; body: string } {
  if (error === "email_not_found") return t.ebayWithoutEmail;
  if (error === "registration_approval_required") return t.registrationRestricted;
  if (error === "account_not_linked") return t.accountNotLinked;
  if (error === "delete_link") return t.deletionLink;
  if (error === "delete_failed") return t.deletionFailed;
  if (error === "account_deletion_in_progress") return t.deletionInProgress;
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
      title: pageTitle(
        messageFor(appCopy[language].authError, search.get("error"), search.get("provider")).title,
      ),
    },
  ];
}

export default function AuthError({ matches }: Route.ComponentProps) {
  const language = matches[0]?.loaderData?.language ?? "it";
  const t = appCopy[language].authError;
  const [search] = useSearchParams();
  const message = messageFor(t, search.get("error"), search.get("provider"));
  const returnTo = securityReturnPath(language, search.get("returnTo"));
  return (
    <StandalonePage
      icon={LogIn}
      tone="amber"
      title={message.title}
      homeHref={localizedPath(language)}
    >
      <p className="leading-relaxed text-pretty text-muted-foreground">{message.body}</p>
      <a href={`mailto:${supportEmail}`} className="w-fit underline underline-offset-4">
        {appCopy[language].common.contactSupport}: {supportEmail}
      </a>
      {/* Si torna all'accesso; con la sessione l'accesso porta all'app. */}
      <a
        href={`${localizedPath(language, accessPath)}${returnTo ? `?${new URLSearchParams({ returnTo })}` : ""}`}
        {...buttonLink({ variant: "outline", className: "w-fit" })}
      >
        {t.back}
      </a>
    </StandalonePage>
  );
}
