import { env } from "cloudflare:workers";
import { redirect } from "react-router";

import { notifySecurityEvent } from "./account-email.server";
import type { AccountArea } from "./account-area.server";
import { accessPath, securityPath, securityReturnPath } from "./app-links";
import { forwardToAuth, redirectWithCookies } from "./auth-route.server";
import { pendingEmailChange } from "./domain/email-change.server";
import {
  passkeyChangeBlock,
  recentSignIn,
  revokeOtherSessions,
  revokeSession,
  type AuthSession,
} from "./domain/sessions.server";
import {
  accountMethods,
  removeAccountMethod,
  removePasskey,
  type AccountMethod,
} from "./domain/sign-in-methods.server";
import { localizedPath } from "./i18n";

/** Metodi di accesso, email, passkey e sessioni; ogni esito torna alla Sicurezza. */
export async function securityAction(
  request: Request,
  { language, session }: AccountArea,
  form: FormData,
): Promise<Response> {
  const auth = session as AuthSession;
  const field = (name: string) => String(form.get(name) ?? "");
  const intent = field("intent");
  const security = localizedPath(language, securityPath);
  const notice = (value: string) => redirect(`${security}?accesso=${value}`, 303);
  const authError = `${localizedPath(language, "/auth/error")}?provider=`;

  if (intent === "riautentica") {
    const target = securityReturnPath(language, field("returnTo")) ?? security;
    return redirectWithCookies(
      `${localizedPath(language, accessPath)}?${new URLSearchParams({ returnTo: target })}`,
      await forwardToAuth(env, request, "/sign-out"),
    );
  }

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

  if (intent === "passkey-remove" || intent === "passkey-rename") {
    const block = passkeyChangeBlock(auth);
    if (block) return notice(block);
    const id = field("id");
    if (!id || id.length > 128) return notice("errore");
    if (intent === "passkey-rename") {
      const name = field("name").trim();
      if (!name || name.length > 80) return notice("passkey-nome-non-valido");
      const response = await forwardToAuth(env, request, "/passkey/update-passkey", { id, name });
      return notice(response.ok ? "passkey-rinominata" : "errore");
    }
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

  if (intent === "cambia-email" || intent === "reinvia-email") {
    const pending =
      intent === "reinvia-email"
        ? await pendingEmailChange(env.DB, session.user.id, session.user.email)
        : null;
    const email = (intent === "reinvia-email" ? (pending?.new_email ?? "") : field("email")).trim();
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
