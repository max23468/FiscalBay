import { waitUntil } from "cloudflare:workers";

import { supportEmail } from "./app-copy";
import { accessPath, securityPath, storesPath } from "./app-links";
import { ApplicationError, logFailure } from "./errors";
import { languageFromPath, localizedPath, type Language } from "./i18n";

const emailFrom = { email: "noreply@fiscalbay.it", name: "FiscalBay" };

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/**
 * Invio non riuscito. Il codice del provider (`E_RECIPIENT_SUPPRESSED`, `E_RATE_LIMIT_EXCEEDED`
 * e simili) è un'etichetta fissa che i log possono riportare; il messaggio no. `undeliverable`
 * distingue un indirizzo nella lista di soppressione, dopo un rimbalzo o un reclamo, da un
 * errore che un nuovo tentativo può superare.
 */
export class EmailError extends ApplicationError {
  readonly undeliverable: boolean;
  constructor(readonly failure: string) {
    super("UPSTREAM_UNAVAILABLE");
    this.name = "EmailError";
    this.undeliverable = failure === "E_RECIPIENT_SUPPRESSED";
  }
}

/** Invia con il binding dell'ambiente; ogni rifiuto diventa un `EmailError`. */
export async function sendEmail(
  env: Env,
  message: { to: string; replyTo: string; subject: string; text: string; html?: string },
): Promise<void> {
  try {
    await env.AUTH_EMAIL.send({ ...message, from: emailFrom });
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
    throw new EmailError(/^E_[A-Z_]{1,60}$/u.test(code) ? code : "unknown");
  }
}

const buttons: Record<Language, { continue: string; security: string; stores: string }> = {
  it: { continue: "Continua su FiscalBay", security: "Apri Sicurezza", stores: "Apri Negozi" },
  en: { continue: "Continue to FiscalBay", security: "Open Security", stores: "Open Stores" },
};

/**
 * Chiusura comune delle email di servizio: arrivano a tutti i piani, anche senza il consenso
 * alle comunicazioni promozionali, e una risposta raggiunge l'assistenza (Reply-To).
 */
const serviceFooter: Record<Language, string> = {
  it: `Email di servizio del tuo account FiscalBay, inviata anche senza consenso alle comunicazioni promozionali. Per assistenza rispondi a questa email o scrivi a ${supportEmail}.`,
  en: `Service email about your FiscalBay account, sent even without consent to promotional messages. For help, reply to this email or write to ${supportEmail}.`,
};

/** Testo e HTML dello stesso modello, nella lingua del destinatario. */
export function accountEmailBody(input: {
  language: Language;
  message: string;
  url: string;
  button: string;
}): { text: string; html: string } {
  const { language, message, url, button } = input;
  const footer = serviceFooter[language];
  const muted = "color:#6b7280;font-size:13px;line-height:1.5";
  return {
    text: `${message}\n\n${button}: ${url}\n\n--\n${footer}`,
    html: `<!doctype html><html lang="${language}"><body style="margin:0;padding:24px;background:#ffffff;color:#111827;font-family:system-ui,-apple-system,'Segoe UI',sans-serif">
<div style="max-width:560px;margin:0 auto">
<p style="margin:0 0 24px;font-size:18px;font-weight:600">FiscalBay</p>
<p style="margin:0 0 24px;font-size:15px;line-height:1.6">${escapeHtml(message)}</p>
<p style="margin:0 0 32px"><a href="${escapeHtml(url)}" style="display:inline-block;padding:10px 18px;border-radius:8px;background:#111827;color:#ffffff;text-decoration:none;font-weight:600">${escapeHtml(button)}</a></p>
<p style="margin:0 0 8px;${muted}">${escapeHtml(url)}</p>
<p style="margin:0;${muted}">${escapeHtml(footer)}</p>
</div></body></html>`,
  };
}

async function sendAccountEmail(
  env: Env,
  input: {
    to: string;
    language: Language;
    subject: string;
    message: string;
    url: string;
    button: string;
  },
): Promise<void> {
  await sendEmail(env, {
    replyTo: supportEmail,
    to: input.to,
    subject: input.subject,
    ...accountEmailBody(input),
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
  env: Env,
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
    sendAccountEmail(env, {
      language,
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
  env: Env,
  to: string,
  request?: Request,
): Promise<void> {
  const body: unknown = await request?.json().catch(() => null);
  const callback =
    typeof body === "object" && body !== null && "callbackURL" in body ? body.callbackURL : null;
  const language =
    typeof callback === "string"
      ? linkLanguage(`${env.APP_ORIGIN}/?callbackURL=${encodeURIComponent(callback)}`)
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
  await sendAccountEmail(env, {
    language,
    to,
    url: new URL(localizedPath(language, accessPath), env.APP_ORIGIN).toString(),
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
export function notifySecurityEvent(env: Env, userId: string, event: SecurityEvent): void {
  waitUntil(
    (async () => {
      const user = await env.DB.prepare(
        `SELECT u."email",
                (SELECT t.language FROM terms_acceptances t WHERE t.user_id = u."id"
                  ORDER BY t.accepted_at DESC LIMIT 1) AS language
           FROM "user" u WHERE u."id" = ?`,
      )
        .bind(userId)
        .first<{ email: string; language: Language | null }>();
      if (!user) return;
      const language = user.language === "en" ? "en" : "it";
      await sendAccountEmail(env, {
        language,
        to: user.email,
        url: new URL(localizedPath(language, securityPath), env.APP_ORIGIN).toString(),
        button: buttons[language].security,
        ...securityText(event, language),
      });
    })().catch((error: unknown) => logFailure({ error, operation: "account_email" })),
  );
}

/**
 * Preavviso di inattività del Free: senza un accesso entro `deadline` le letture dei negozi si
 * fermano. Il compito che lo invia registra il preavviso soltanto se l'invio riesce.
 */
export async function sendInactivityNotice(
  env: Env,
  input: { to: string; language: Language; deadline: string },
): Promise<void> {
  const { language, deadline } = input;
  await sendAccountEmail(env, {
    language,
    to: input.to,
    url: new URL(localizedPath(language, storesPath), env.APP_ORIGIN).toString(),
    button: buttons[language].stores,
    ...(language === "en"
      ? {
          subject: "Your FiscalBay stores will stop updating",
          message: `You have not opened FiscalBay for 30 days. With the Free plan, sign in by ${deadline} to keep reading new orders from eBay; otherwise reading pauses until you resume it from Stores. Your orders stay available.`,
        }
      : {
          subject: "I tuoi negozi su FiscalBay smetteranno di aggiornarsi",
          message: `Non apri FiscalBay da 30 giorni. Con il piano Free, accedi entro il ${deadline} per continuare a leggere i nuovi ordini da eBay; altrimenti le letture si fermano finché non le riprendi da Negozi. I tuoi ordini restano disponibili.`,
        }),
  });
}
