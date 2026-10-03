import { env } from "cloudflare:workers";
import { cn } from "cn";
import { KeyRound, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { data } from "react-router";

import { StandalonePage } from "~/components/standalone-page";
import { Button } from "~/components/ui/button";
import { buttonVariants } from "~/components/ui/button-variants";
import { Spinner } from "~/components/ui/spinner";
import { appCopy } from "../app-copy";
import { createAuth } from "../auth.server";
import { adminAccess, type AuthSession } from "../domain/sessions.server";
import { languageFromPath, localizedPath, type Language } from "../i18n";
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

/** Parametro aggiunto dopo un accesso con passkey riuscito, per spiegare un esito senza verifica. */
const confirmedParam = "conferma";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const language = languageFromPath(url.pathname);
  const session = (await createAuth(env).api.getSession({
    headers: request.headers,
  })) as AuthSession | null;
  const access = adminAccess(session);
  // Chi non è admin riceve la stessa risposta di un indirizzo inesistente.
  if (access === "none") throw data(null, { status: 404 });
  return {
    language,
    access,
    // La passkey ha aperto una sessione, ma il dispositivo non ha verificato l'utente.
    unverified: access === "verify" && url.searchParams.has(confirmedParam),
    confirmedAt: access === "granted" ? new Date(session!.session.createdAt).toISOString() : null,
  };
}

/** Accesso con passkey: Better Auth propone solo le passkey dell'utente della sessione. */
function PasskeyConfirm({ language, unverified }: { language: Language; unverified: boolean }) {
  const t = appCopy[language].admin;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  // L'esito senza verifica resta visibile fino al tentativo successivo.
  const [retried, setRetried] = useState(false);
  return (
    <div className="grid gap-3">
      <p className="leading-relaxed text-pretty text-muted-foreground">{t.verifyBody}</p>
      <Button
        type="button"
        className="w-fit"
        disabled={pending}
        focusableWhenDisabled
        aria-busy={pending || undefined}
        onClick={async () => {
          setPending(true);
          setError(false);
          setRetried(true);
          try {
            const { authClient } = await import("../passkey-client");
            const result = await authClient.signIn.passkey();
            if (result.error) setError(true);
            else window.location.replace(`${localizedPath(language, "/admin")}?${confirmedParam}`);
          } catch {
            setError(true);
          } finally {
            setPending(false);
          }
        }}
      >
        {pending ? (
          <Spinner
            label={t.verifyTitle}
            aria-hidden="true"
            role={undefined}
            data-icon="inline-start"
          />
        ) : (
          <KeyRound aria-hidden="true" data-icon="inline-start" />
        )}
        {t.verifyTitle}
      </Button>
      {error || (unverified && !retried) ? (
        <p role="alert" className="text-sm text-danger">
          {t.verifyFailed}
        </p>
      ) : null}
    </div>
  );
}

export default function Admin({ loaderData }: Route.ComponentProps) {
  const { language, access, unverified, confirmedAt } = loaderData;
  const t = appCopy[language].admin;
  return (
    <StandalonePage
      icon={access === "granted" ? ShieldCheck : KeyRound}
      tone={access === "granted" ? "green" : "amber"}
      title={t.title}
      homeHref={localizedPath(language)}
    >
      {confirmedAt ? (
        <p className="leading-relaxed text-pretty text-muted-foreground">
          {t.granted(formatDate(confirmedAt, language))}
        </p>
      ) : (
        <PasskeyConfirm language={language} unverified={unverified} />
      )}
      <a
        href={localizedPath(language)}
        className={cn(buttonVariants({ variant: "outline" }), "w-fit")}
      >
        {t.back}
      </a>
    </StandalonePage>
  );
}
