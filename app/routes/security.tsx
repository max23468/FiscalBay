import { env } from "cloudflare:workers";
import { ShieldCheck } from "lucide-react";
import { redirect } from "react-router";

import { AccessNotice, AccountSecurity, AccountShell } from "~/components/account";
import { PageTitle } from "~/components/icon-tile";
import { createAuth } from "../auth.server";
import { registrationStatus } from "../domain/registration.server";
import {
  listActiveSessions,
  passkeyChangeBlock,
  type AuthSession,
} from "../domain/sessions.server";
import { listSignInMethods } from "../domain/sign-in-methods.server";
import { accessNotice } from "../access-notice";
import { appCopy } from "../app-copy";
import { languageFromPath, localizedPath } from "../i18n";
import type { Route } from "./+types/security";

export function meta({ location }: Route.MetaArgs): Route.MetaDescriptors {
  const t = appCopy[languageFromPath(location.pathname)];
  return [{ title: `FiscalBay | ${t.shell.security}` }];
}

/** Sicurezza dell'account: metodi di accesso, email e sessioni, per chi ha confermato l'email. */
export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const language = languageFromPath(url.pathname);
  const session = await createAuth(env).api.getSession({ headers: request.headers });
  const status = session ? await registrationStatus(env.DB, session.user.id) : null;
  // Senza sessione, email confermata o registrazione completa la radice mostra il passo che
  // manca; l'esito eventualmente arrivato resta nell'indirizzo.
  if (!session?.user.emailVerified || !status?.profile || !status.termsAccepted) {
    throw redirect(`${localizedPath(language)}${url.search}`, {
      headers: { "cache-control": "no-store" },
    });
  }
  const now = new Date();
  return {
    language,
    notice: accessNotice(url.searchParams, language),
    name: `${status.profile.firstName} ${status.profile.lastName}`,
    email: session.user.email,
    methods: await listSignInMethods(env.DB, session.user.id),
    sessions: await listActiveSessions(env.DB, session.user.id, session.session.id, language, now),
    now: now.toISOString(),
    // Avviso da mostrare se la registrazione di una passkey viene rifiutata.
    passkeyBlock: passkeyChangeBlock(session as AuthSession, now) ?? "nuovo-accesso",
  };
}

export default function Security({ loaderData }: Route.ComponentProps) {
  const { language } = loaderData;
  const t = appCopy[language];
  return (
    <AccountShell language={language} account={loaderData} security>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
        <PageTitle icon={ShieldCheck} tone="neutral">
          {t.shell.security}
        </PageTitle>
        <AccessNotice language={language} notice={loaderData.notice} />
        <AccountSecurity
          language={language}
          email={loaderData.email}
          methods={loaderData.methods}
          sessions={loaderData.sessions}
          now={loaderData.now}
          passkeyBlock={loaderData.passkeyBlock}
        />
      </div>
    </AccountShell>
  );
}
