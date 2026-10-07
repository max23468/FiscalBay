import { env } from "cloudflare:workers";
import { ShieldCheck } from "lucide-react";
import { redirect } from "react-router";

import { AccessNotice, AccountSecurity, AccountShell } from "~/components/account";
import { PageTitle } from "~/components/icon-tile";
import { notifySecurityEvent } from "../account-email.server";
import { assertSameOrigin, requireAccountArea } from "../account-area.server";
import { forwardToAuth, redirectWithCookies } from "../auth-route.server";
import {
  listActiveSessions,
  passkeyChangeBlock,
  recentSignIn,
  revokeOtherSessions,
  revokeSession,
  type AuthSession,
} from "../domain/sessions.server";
import {
  accountMethods,
  listSignInMethods,
  removeAccountMethod,
  removePasskey,
  type AccountMethod,
} from "../domain/sign-in-methods.server";
import { accessNotice } from "../access-notice";
import { accessPath } from "../app-links";
import { appCopy } from "../app-copy";
import { languageFromPath, localizedPath } from "../i18n";
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

/** Metodi di accesso, email, passkey e sessioni; ogni esito torna a questa pagina. */
export async function action({ request }: Route.ActionArgs) {
  assertSameOrigin(request);
  const { language, session } = await requireAccountArea(request);
  const auth = session as AuthSession;
  const form = await request.formData();
  const field = (name: string) => String(form.get(name) ?? "");
  const intent = field("intent");
  const security = new URL(request.url).pathname;
  const notice = (value: string) => redirect(`${security}?accesso=${value}`, 303);
  const authError = `${localizedPath(language, "/auth/error")}?provider=`;

  // Chiudere sessioni protegge l'account: basta la sessione corrente, anche non recente.
  if (intent === "esci-altri") {
    await revokeOtherSessions(env.DB, session.user.id, session.session.id);
    return notice("sessioni-chiuse");
  }
  if (intent === "esci-sessione") {
    const id = field("id");
    if (!id || id.length > 128) return notice("errore");
    if (id === session.session.id) {
      return redirectWithCookies(
        localizedPath(language),
        await forwardToAuth(env, request, "/sign-out"),
      );
    }
    await revokeSession(env.DB, session.user.id, id);
    return notice("sessione-chiusa");
  }

  if (intent === "passkey-remove") {
    const block = passkeyChangeBlock(auth);
    if (block) return notice(block);
    const id = field("id");
    if (!id || id.length > 128) return notice("errore");
    const removed = await removePasskey(env.DB, session.user.id, id);
    if (removed) notifySecurityEvent(env, session.user.id, { kind: "passkey-removed" });
    return notice(removed ? "passkey-rimossa" : "ultimo-accesso");
  }

  // Il link al proprio indirizzo imposta o cambia la password; al reset crea l'account
  // credential che manca a chi è entrato con Google, eBay o passkey.
  if (intent === "password") {
    const response = await forwardToAuth(env, request, "/request-password-reset", {
      email: session.user.email,
      redirectTo: `${new URL(env.APP_ORIGIN).origin}${localizedPath(language, accessPath)}`,
    });
    if (response.status === 429) return notice("troppi-tentativi");
    return notice(response.ok ? "password-link" : "errore");
  }

  // Collegare, rimuovere e cambiare email richiedono un accesso delle ultime 24 ore.
  if (!recentSignIn(auth)) return notice("nuovo-accesso");
  const method = field("metodo");

  if (intent === "collega-metodo") {
    if (method !== "google" && method !== "ebay") return notice("errore");
    const response = await forwardToAuth(env, request, "/link-social", {
      provider: method,
      callbackURL: `${security}?accesso=metodo-collegato`,
      errorCallbackURL: `${authError}${method}`,
    });
    if (!response.ok) return notice(response.status === 429 ? "troppi-tentativi" : "errore");
    const { url } = await response.clone().json<{ url: string }>();
    return redirectWithCookies(url, response);
  }

  if (intent === "rimuovi-metodo") {
    if (!Object.hasOwn(accountMethods, method)) return notice("errore");
    const removed = await removeAccountMethod(env.DB, session.user.id, method as AccountMethod);
    if (!removed) return notice("ultimo-metodo");
    notifySecurityEvent(env, session.user.id, {
      kind: "method-removed",
      method: method as AccountMethod,
    });
    return notice(method === "ebay" ? "ebay-rimosso" : "metodo-rimosso");
  }

  if (intent === "cambia-email") {
    const email = field("email").trim();
    if (!email || email.length > 254) return notice("email-non-valida");
    const response = await forwardToAuth(env, request, "/change-email", {
      newEmail: email,
      callbackURL: `${security}?accesso=email-confermata`,
    });
    if (response.status === 429) return notice("troppi-tentativi");
    // La risposta non distingue un indirizzo già registrato: non rivela chi usa FiscalBay.
    return notice(response.ok ? "email-richiesta" : "email-non-valida");
  }

  return notice("errore");
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
