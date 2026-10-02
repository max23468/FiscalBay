import { env } from "cloudflare:workers";
import { KeyRound, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { data } from "react-router";

import { StandalonePage } from "~/components/standalone-page";
import { Button } from "~/components/ui/button";
import { appCopy } from "../app-copy";
import { createAuth } from "../auth.server";
import { adminAccess, type AuthSession } from "../domain/sessions.server";
import { languageFromPath, localizedPath } from "../i18n";
import { formatDate } from "../view-models";
import type { Route } from "./+types/admin";

export function meta({ location }: Route.MetaArgs): Route.MetaDescriptors {
  const language = languageFromPath(location.pathname);
  return [
    { title: `FiscalBay | ${appCopy[language].admin.title}` },
    { name: "robots", content: "noindex" },
  ];
}

export function headers(): HeadersInit {
  return { "cache-control": "no-store" };
}

export async function loader({ request }: Route.LoaderArgs) {
  const language = languageFromPath(new URL(request.url).pathname);
  const session = (await createAuth(env).api.getSession({
    headers: request.headers,
  })) as AuthSession | null;
  const access = adminAccess(session);
  // Per chi non è admin l'area non esiste: nessun indizio sulla sua presenza.
  if (access === "none") throw data(null, { status: 404 });
  return {
    language,
    access,
    confirmedAt: access === "granted" ? new Date(session!.session.createdAt).toISOString() : null,
  };
}

/** Accesso con passkey: Better Auth propone solo le passkey dell'utente della sessione. */
function PasskeyConfirm({
  language,
}: {
  language: Route.ComponentProps["loaderData"]["language"];
}) {
  const t = appCopy[language].admin;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  return (
    <div className="grid gap-3">
      <p className="leading-relaxed text-pretty text-muted-foreground">{t.verifyBody}</p>
      <Button
        type="button"
        className="w-fit"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError(false);
          try {
            const { authClient } = await import("../passkey-client");
            const result = await authClient.signIn.passkey();
            if (result.error) setError(true);
            else window.location.reload();
          } catch {
            setError(true);
          } finally {
            setPending(false);
          }
        }}
      >
        <KeyRound aria-hidden="true" data-icon="inline-start" />
        {t.verifyTitle}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {t.verifyFailed}
        </p>
      ) : null}
    </div>
  );
}

export default function Admin({ loaderData }: Route.ComponentProps) {
  const { language, access, confirmedAt } = loaderData;
  const t = appCopy[language].admin;
  return (
    <StandalonePage
      icon={access === "granted" ? ShieldCheck : KeyRound}
      tone={access === "granted" ? "green" : "amber"}
      title={access === "granted" ? t.title : t.verifyTitle}
      homeHref={localizedPath(language)}
    >
      {confirmedAt ? (
        <p className="leading-relaxed text-muted-foreground">
          {t.granted(formatDate(confirmedAt, language))}
        </p>
      ) : (
        <PasskeyConfirm language={language} />
      )}
      <a href={localizedPath(language)} className="w-fit text-sm underline underline-offset-4">
        {t.back}
      </a>
    </StandalonePage>
  );
}
