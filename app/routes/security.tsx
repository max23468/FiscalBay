import { env } from "cloudflare:workers";
import { ShieldCheck } from "lucide-react";

import { AccessNotice, AccountSecurity, AccountShell } from "~/components/account";
import { PageTitle } from "~/components/icon-tile";
import { requireAccountArea } from "../account-area.server";
import {
  listActiveSessions,
  passkeyChangeBlock,
  recentSignIn,
  type AuthSession,
} from "../domain/sessions.server";
import { listSignInMethods } from "../domain/sign-in-methods.server";
import { accessNotice } from "../access-notice";
import { appCopy } from "../app-copy";
import { languageFromPath } from "../i18n";
import type { Route } from "./+types/security";

export function meta({ location }: Route.MetaArgs): Route.MetaDescriptors {
  const t = appCopy[languageFromPath(location.pathname)];
  return [{ title: `FiscalBay | ${t.shell.security}` }];
}

/** Sicurezza dell'account: metodi di accesso, email e sessioni, per chi ha confermato l'email. */
export async function loader({ request }: Route.LoaderArgs) {
  const { language, session, account } = await requireAccountArea(request);
  const url = new URL(request.url);
  const now = new Date();
  return {
    language,
    notice: accessNotice(url.searchParams, language),
    ...account,
    methods: await listSignInMethods(env.DB, session.user.id),
    sessions: await listActiveSessions(env.DB, session.user.id, session.session.id, language, now),
    now: now.toISOString(),
    recent: recentSignIn(session as AuthSession, now),
    passkeyRestriction: passkeyChangeBlock(session as AuthSession, now),
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
          recent={loaderData.recent}
          passkeyRestriction={loaderData.passkeyRestriction}
        />
      </div>
    </AccountShell>
  );
}
