import { waitUntil } from "cloudflare:workers";

import { accessPath, securityPath } from "./app-links";
import { logFailure } from "./errors";
import { languageFromPath, localizedPath, type Language } from "./i18n";

const authEmailFrom = "noreply@fiscalbay.it";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

const buttons: Record<Language, { continue: string; security: string }> = {
  it: { continue: "Continua su FiscalBay", security: "Apri Sicurezza" },
  en: { continue: "Continue to FiscalBay", security: "Open Security" },
};

async function sendAccountEmail(
  environment: Env,
  input: { to: string; subject: string; message: string; url: string; button: string },
): Promise<void> {
  const safeUrl = escapeHtml(input.url);
  await environment.AUTH_EMAIL.send({
    from: { email: authEmailFrom, name: "FiscalBay" },
    replyTo: "supporto@fiscalbay.it",
    to: input.to,
    subject: input.subject,
    text: `${input.message}\n\n${input.url}`,
    html: `<p>${escapeHtml(input.message)}</p><p><a href="${safeUrl}">${escapeHtml(input.button)}</a></p>`,
  });
}

/**
 * Lingua di un link Better Auth: la pagina di ritorno (`callbackURL`) è già localizzata da
 * chi ha avviato la richiesta, quindi una pagina `/en` vuol dire inglese.
 */
export function linkLanguage(url: string): Language {
  const callback = new URL(url).searchParams.get("callbackURL");
  if (!callback) return "it";
  try {
    return languageFromPath(new URL(callback, url).pathname);
  } catch {
    return "it";
  }
}

const authTexts = {
  verify: {
    it: {
      subject: "Conferma l’indirizzo email di FiscalBay",
      message: "Conferma il tuo indirizzo email per collegare i tuoi negozi eBay a FiscalBay.",
    },
    en: {
      subject: "Confirm your FiscalBay email address",
      message: "Confirm your email address to connect your eBay stores to FiscalBay.",
    },
  },
  reset: {
    it: {
      subject: "Reimposta la password di FiscalBay",
      message: "Hai richiesto di reimpostare la password.",
    },
    en: {
      subject: "Reset your FiscalBay password",
      message: "You asked to reset your password.",
    },
  },
} as const;

export type AuthEmailKind = keyof typeof authTexts | "change-email";

/** Email dei link di Better Auth, nella lingua della pagina da cui è partita la richiesta. */
export function sendAuthEmail(
  environment: Env,
  kind: AuthEmailKind,
  input: { to: string; url: string; newEmail?: string },
): void {
  const language = linkLanguage(input.url);
  const text =
    kind === "change-email"
      ? language === "en"
        ? {
            subject: "Confirm your FiscalBay email change",
            message: `You asked to use ${input.newEmail} to sign in to FiscalBay. If you did not make this request, ignore this email.`,
          }
        : {
            subject: "Conferma il cambio email di FiscalBay",
            message: `Hai chiesto di usare ${input.newEmail} per accedere a FiscalBay. Se la richiesta non è tua, ignora questa email.`,
          }
      : authTexts[kind][language];
  waitUntil(
    sendAccountEmail(environment, {
      to: input.to,
      url: input.url,
      button: buttons[language].continue,
      ...text,
    }).catch((error: unknown) => logFailure({ error, operation: "account_email" })),
  );
}

/**
 * Chi si registra con un indirizzo già usato riceve la stessa risposta di un nuovo account;
 * il titolare riceve questa email, nella lingua della pagina di registrazione.
 */
export async function sendExistingAccountEmail(
  environment: Env,
  to: string,
  request?: Request,
): Promise<void> {
  const body: unknown = await request?.json().catch(() => null);
  const callback =
    typeof body === "object" && body !== null && "callbackURL" in body ? body.callbackURL : null;
  const language =
    typeof callback === "string"
      ? linkLanguage(`${environment.APP_ORIGIN}/?callbackURL=${encodeURIComponent(callback)}`)
      : "it";
  const text =
    language === "en"
      ? {
          subject: "You already have a FiscalBay account",
          message:
            "Someone tried to create a FiscalBay account with this address, which is already registered. If it was you, sign in or reset your password from the sign-in page. Otherwise, ignore this email.",
        }
      : {
          subject: "Hai già un account FiscalBay",
          message:
            "Qualcuno ha provato a creare un account FiscalBay con questo indirizzo, che è già registrato. Se eri tu, accedi o reimposta la password dalla pagina di accesso. Altrimenti ignora questa email.",
        };
  await sendAccountEmail(environment, {
    to,
    url: new URL(localizedPath(language, accessPath), environment.APP_ORIGIN).toString(),
    button: buttons[language].continue,
    ...text,
  }).catch((error: unknown) => logFailure({ error, operation: "account_email" }));
}

export type SecurityEvent =
  | { kind: "password-reset" }
  | { kind: "method-linked" | "method-removed"; method: "google" | "ebay" | "password" }
  | { kind: "passkey-added" | "passkey-removed" };

const methodNames: Record<Language, Record<"google" | "ebay" | "password", string>> = {
  it: { google: "Google", ebay: "eBay", password: "email e password" },
  en: { google: "Google", ebay: "eBay", password: "email and password" },
};

function securityText(event: SecurityEvent, language: Language) {
  const it = language === "it";
  const check = it
    ? "Se la richiesta non è tua, apri Sicurezza, controlla i metodi di accesso e reimposta la password."
    : "If you did not make this request, open Security, check your sign-in methods and reset your password.";
  switch (event.kind) {
    case "password-reset":
      return it
        ? {
            subject: "La password di FiscalBay è stata reimpostata",
            message: `La password del tuo account FiscalBay è stata reimpostata e le sessioni aperte sono state chiuse. ${check}`,
          }
        : {
            subject: "Your FiscalBay password was reset",
            message: `The password of your FiscalBay account was reset and open sessions were signed out. ${check}`,
          };
    case "method-linked":
    case "method-removed": {
      const name = methodNames[language][event.method];
      const linked = event.kind === "method-linked";
      return it
        ? {
            subject: linked
              ? "Nuovo metodo di accesso su FiscalBay"
              : "Metodo di accesso rimosso da FiscalBay",
            message: `${linked ? "È stato collegato" : "È stato rimosso"} l’accesso con ${name} ${linked ? "al" : "dal"} tuo account FiscalBay. ${check}`,
          }
        : {
            subject: linked
              ? "New sign-in method on FiscalBay"
              : "Sign-in method removed from FiscalBay",
            message: `Sign-in with ${name} was ${linked ? "added to" : "removed from"} your FiscalBay account. ${check}`,
          };
    }
    case "passkey-added":
    case "passkey-removed": {
      const added = event.kind === "passkey-added";
      return it
        ? {
            subject: added ? "Nuova passkey su FiscalBay" : "Passkey rimossa da FiscalBay",
            message: `${added ? "È stata aggiunta una passkey al" : "È stata rimossa una passkey dal"} tuo account FiscalBay. ${check}`,
          }
        : {
            subject: added ? "New passkey on FiscalBay" : "Passkey removed from FiscalBay",
            message: `A passkey was ${added ? "added to" : "removed from"} your FiscalBay account. ${check}`,
          };
    }
  }
}

/**
 * Avvisa il titolare di una modifica ai metodi di accesso, all'indirizzo corrente e nella lingua
 * con cui ha accettato i Termini. Fuori dal percorso della risposta: un invio fallito si registra
 * nei log senza annullare la modifica.
 */
export function notifySecurityEvent(environment: Env, userId: string, event: SecurityEvent): void {
  waitUntil(
    (async () => {
      const user = await environment.DB.prepare(
        `SELECT u."email",
                (SELECT t.language FROM terms_acceptances t WHERE t.user_id = u."id"
                  ORDER BY t.accepted_at DESC LIMIT 1) AS language
           FROM "user" u WHERE u."id" = ?`,
      )
        .bind(userId)
        .first<{ email: string; language: Language | null }>();
      if (!user) return;
      const language = user.language === "en" ? "en" : "it";
      await sendAccountEmail(environment, {
        to: user.email,
        url: new URL(localizedPath(language, securityPath), environment.APP_ORIGIN).toString(),
        button: buttons[language].security,
        ...securityText(event, language),
      });
    })().catch((error: unknown) => logFailure({ error, operation: "account_email" })),
  );
}
