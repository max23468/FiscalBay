import { env } from "cloudflare:workers";
import { data, redirect } from "react-router";

import { notifySecurityEvent } from "./account-email.server";
import type { AccountArea } from "./account-area.server";
import {
  accessPath,
  accountDeletionPath,
  appUrl,
  securityPath,
  securityReturnPath,
} from "./app-links";
import { actionFailure } from "./area-actions.server";
import { forwardToAuth, redirectWithCookies } from "./auth-route.server";
import { deletionReauthenticated } from "./domain/account-deletion.server";
import { pendingEmailChange } from "./domain/email-change.server";
import {
  passkeyChangeBlock,
  recentSignIn,
  revokeOtherSessions,
  revokeSession,
} from "./domain/sessions.server";
import {
  accountMethods,
  removeAccountMethod,
  removePasskey,
  type AccountMethod,
} from "./domain/sign-in-methods.server";
import { appCopy } from "./app-copy";
import { localizedPath } from "./i18n";
import { turnstileActions } from "./turnstile";
import { turnstileFailure } from "./turnstile.server";
import type { ActionResult } from "./view-models";

/**
 * Percorso Auth a cui l'azione della Sicurezza inoltra un invio di email o una password: il
 * filtro per IP di quel percorso si applica prima della sessione e di Turnstile, poi l'inoltro
 * è già ammesso.
 */
export function securityAuthPath(intent: string, form: FormData): string | null {
  if (intent === "password") return "/request-password-reset";
  if (intent === "reinvia-email" || intent === "cambia-email") return "/change-email";
  if (intent === "account-delete") return "/delete-user";
  if (intent === "conferma-accesso" && form.get("metodo") === "password") return "/sign-in/email";
  return null;
}

/** Esito della conferma dell'identità, letto dal riquadro senza lasciare la pagina. */
export type ConfirmResult = { ok: boolean; notice?: string };

/**
 * Richiesta di cancellazione dell'account (§30), dalle Impostazioni o, per chi non ha ancora
 * completato la registrazione o verificato l'email, dalla pagina di accesso e dall'avviso della
 * verifica: accesso degli ultimi minuti e indirizzo dell'account scritto per esteso, poi Better
 * Auth manda il link, anche a un indirizzo non ancora verificato. La conferma dal link avvia la
 * cancellazione e il lavoro dalla coda.
 */
export async function requestAccountDeletion(
  request: Request,
  { language, session }: Pick<AccountArea, "language" | "session">,
  confirmation: string,
  admitted = false,
): Promise<ActionResult | ReturnType<typeof data<ActionResult>>> {
  const t = appCopy[language].settings.privacy;
  if (!deletionReauthenticated(session.session.createdAt))
    return actionFailure(403, t.deleteAccountReauth);
  const email = session.user.email;
  if (confirmation.trim().toLowerCase() !== email.toLowerCase())
    return actionFailure(400, t.deleteAccountMismatch);
  const response = await forwardToAuth(
    env,
    request,
    "/delete-user",
    { callbackURL: localizedPath(language, accountDeletionPath) },
    admitted,
  );
  if (!response.ok)
    return actionFailure(response.status === 429 ? 429 : 503, t.deleteAccountFailed);
  return { ok: true, notice: t.deleteAccountSent(email) } satisfies ActionResult;
}

/** Metodi di accesso, email, passkey e sessioni; ogni esito torna alla Sicurezza. */
export async function securityAction(
  request: Request,
  { language, session }: Pick<AccountArea, "language" | "session">,
  form: FormData,
  admitted = false,
): Promise<Response | ReturnType<typeof data<ConfirmResult>>> {
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

  // Conferma dell'identità sul posto, senza uscire: la password apre una nuova sessione al
  // posto di quella in uso; dopo una passkey si chiude la sessione precedente, se era dello
  // stesso utente. In entrambi i casi la sessione nuova è un accesso recente.
  if (intent === "conferma-accesso") {
    const confirmed = (ok: boolean, response?: Response) => {
      const headers = new Headers({ "cache-control": "no-store" });
      for (const cookie of response?.headers.getSetCookie() ?? [])
        headers.append("set-cookie", cookie);
      return data<ConfirmResult>(
        ok ? { ok } : { ok, notice: appCopy[language].access.confirmFailed },
        { status: ok ? 200 : 400, headers },
      );
    };
    if (field("metodo") === "password") {
      const response = await forwardToAuth(
        env,
        request,
        "/sign-in/email",
        { email: session.user.email, password: field("password") },
        admitted,
      );
      if (!response.ok) return confirmed(false);
      await revokeSession(env.DB, session.user.id, session.session.id);
      return confirmed(true, response);
    }
    if (field("metodo") === "passkey") {
      const previous = field("precedente");
      const same =
        recentSignIn(session) &&
        !!previous &&
        previous.length <= 128 &&
        (previous === session.session.id ||
          (await revokeSession(env.DB, session.user.id, previous)));
      return confirmed(same);
    }
    return confirmed(false);
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
    const block = passkeyChangeBlock(session);
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
    const check = await turnstileFailure(env, request, form, turnstileActions.passwordReset);
    if (check) return notice(check);
    const response = await forwardToAuth(
      env,
      request,
      "/request-password-reset",
      { email: session.user.email, redirectTo: appUrl(env, language, accessPath) },
      admitted,
    );
    if (response.status === 429) return notice("troppi-tentativi");
    return notice(response.ok ? "password-link" : "errore");
  }

  // Collegare, rimuovere e cambiare email richiedono un accesso delle ultime 24 ore.
  if (!recentSignIn(session)) return notice("nuovo-accesso");
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
    if (intent === "reinvia-email") {
      const check = await turnstileFailure(env, request, form, turnstileActions.emailLink);
      if (check) return notice(check);
    }
    const pending =
      intent === "reinvia-email"
        ? await pendingEmailChange(env.DB, session.user.id, session.user.email)
        : null;
    const email = (intent === "reinvia-email" ? (pending?.new_email ?? "") : field("email")).trim();
    if (!email || email.length > 254) return notice("email-non-valida");
    const response = await forwardToAuth(
      env,
      request,
      "/change-email",
      { newEmail: email, callbackURL: `${security}?accesso=email-confermata` },
      admitted,
    );
    if (response.status === 429) return notice("troppi-tentativi");
    // La risposta non distingue un indirizzo già registrato: non rivela chi usa FiscalBay.
    return notice(response.ok ? "email-richiesta" : "email-non-valida");
  }

  return notice("errore");
}
