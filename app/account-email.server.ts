import { waitUntil } from "cloudflare:workers";

import { supportEmail } from "./app-copy";
import { accessPath, securityPath, storesPath } from "./app-links";
import { emailVerificationSeconds } from "./domain/email-change.server";
import { ApplicationError, logFailure } from "./errors";
import { languageFromPath, localizedPath, type Language } from "./i18n";
import { escapeMarkup as escapeHtml } from "./markup";

const emailFrom = { email: "noreply@fiscalbay.it", name: "FiscalBay" };

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

/** Icona dell'app servita dal sito: una tessera piena, leggibile su sfondo chiaro e scuro. */
const emailLogoPath = "/apple-touch-icon.png";

/** Contenuto di un'email di servizio, già nella lingua del destinatario. */
export interface AccountEmail {
  subject: string;
  /** Paragrafi del messaggio, dal fatto a cosa fare. */
  paragraphs: string[];
  button: string;
  /** Avvertenza sotto il pulsante: durata del link, oppure cosa fare se non si è stati noi. */
  note?: string;
  /** Anteprima sotto l'oggetto nell'elenco dei messaggi; senza, il primo paragrafo. */
  preview?: string;
  /** Chiusura al posto di quella comune, per chi non ha più un account. */
  footer?: string;
}

/**
 * Chiusura comune: le email di servizio arrivano a ogni account, indipendentemente dal consenso
 * marketing, e una risposta raggiunge l'assistenza (Reply-To).
 */
const serviceFooter: Record<Language, string> = {
  it: `Ricevi questa email perché hai un account FiscalBay. Per assistenza rispondi a questa email o scrivi a ${supportEmail}.`,
  en: `You are receiving this email because you have a FiscalBay account. For help, reply to this email or write to ${supportEmail}.`,
};

const fallbackLabel: Record<Language, string> = {
  it: "Se il pulsante non funziona, copia questo indirizzo nel browser:",
  en: "If the button does not work, copy this address into your browser:",
};

/** Durata dei link di Auth, la stessa per conferma, cambio email e nuova password. */
function linkValidity(language: Language): string {
  const hours = emailVerificationSeconds / 3600;
  if (language === "en")
    return `The link is valid for ${hours === 1 ? "one hour" : `${hours} hours`}.`;
  return `Il link vale ${hours === 1 ? "un’ora" : `${hours} ore`}.`;
}

const font = "font-family:system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const muted = `${font};color:#5b6474;font-size:13px;line-height:1.5`;

/**
 * Testo e HTML dello stesso modello. L'HTML usa tabelle e stili in linea, che i client di posta
 * rispettano anche senza fogli di stile; dichiara il tema chiaro e scuro, così il client adatta i
 * colori invece di invertirli. Il logo è l'icona dell'app servita dall'origine dell'ambiente.
 */
export function accountEmailBody(input: {
  language: Language;
  origin: string;
  url: string;
  email: AccountEmail;
}): { text: string; html: string } {
  const { language, url, email } = input;
  const footer = email.footer ?? serviceFooter[language];
  const preview = email.preview ?? email.paragraphs[0]!;
  const logo = new URL(emailLogoPath, input.origin).toString();
  const text = [
    ...email.paragraphs,
    `${email.button}: ${url}`,
    ...(email.note ? [email.note] : []),
    `--\n${footer}`,
  ].join("\n\n");
  // Spazi invisibili dopo l'anteprima: il client non vi accoda l'inizio del messaggio.
  const filler = "&#847;&zwnj;&nbsp;".repeat(40);
  const paragraphs = email.paragraphs
    .map(
      (paragraph) =>
        `<p style="margin:0 0 16px;${font};font-size:15px;line-height:1.6;color:#111827">${escapeHtml(paragraph)}</p>`,
    )
    .join("");
  const html = `<!doctype html><html lang="${language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light"><title>${escapeHtml(email.subject)}</title></head>
<body style="margin:0;padding:0;background:#f4f6fa;color-scheme:light only">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preview)}${filler}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fa"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e3e8f0;border-radius:12px">
<tr><td style="padding:28px 32px 8px"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td><img src="${escapeHtml(logo)}" width="40" height="40" alt="" style="display:block;border:0;border-radius:9px"></td><td style="padding-left:12px;${font};font-size:18px;font-weight:700;color:#0e3372">FiscalBay</td></tr></table></td></tr>
<tr><td style="padding:16px 32px 0">${paragraphs}</td></tr>
<tr><td style="padding:8px 32px 0"><a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#1a4fa6;color:#ffffff;${font};font-size:15px;font-weight:600;text-decoration:none">${escapeHtml(email.button)}</a></td></tr>
${email.note ? `<tr><td style="padding:16px 32px 0"><p style="margin:0;${muted}">${escapeHtml(email.note)}</p></td></tr>\n` : ""}<tr><td style="padding:24px 32px 28px"><p style="margin:0;${muted}">${escapeHtml(fallbackLabel[language])}<br><a href="${escapeHtml(url)}" style="color:#1a4fa6;word-break:break-all">${escapeHtml(url)}</a></p></td></tr>
</table>
<p style="margin:16px 0 0;max-width:560px;${muted};font-size:12px">${escapeHtml(footer)}</p>
</td></tr></table></body></html>`;
  return { text, html };
}

async function sendAccountEmail(
  env: Env,
  input: { to: string; language: Language; url: string; email: AccountEmail },
): Promise<void> {
  await sendEmail(env, {
    replyTo: supportEmail,
    to: input.to,
    subject: input.email.subject,
    ...accountEmailBody({ ...input, origin: env.APP_ORIGIN }),
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

/**
 * Email dei link di Better Auth: conferma dell'indirizzo, nuova password, cambio email e
 * conferma della cancellazione dell'account.
 */
function authEmail(
  kind: AuthEmailKind,
  language: Language,
  newEmail: string | undefined,
): AccountEmail {
  const validity = linkValidity(language);
  if (language === "en")
    switch (kind) {
      case "verify":
        return {
          subject: "Confirm your FiscalBay email address",
          paragraphs: ["Confirm that this email address is yours to use it with FiscalBay."],
          button: "Confirm email",
          note: `${validity} If you did not ask to use this address with FiscalBay, ignore this email.`,
        };
      case "reset":
        return {
          subject: "Reset your FiscalBay password",
          preview: "Choose a new password for your account.",
          paragraphs: ["We received a request to reset the password of your FiscalBay account."],
          button: "Reset password",
          note: `${validity} If it was not you, ignore this email: your password stays the same.`,
        };
      case "delete-account":
        return {
          subject: "Confirm the deletion of your FiscalBay account",
          paragraphs: [
            "You asked to delete your FiscalBay account.",
            "After you confirm, we sign out every session, stop store reads, notifications and renewals, then erase orders, stores and settings. Deletion cannot be undone.",
          ],
          button: "Delete account",
          note: `${validity} Open the link in the browser where you are signed in. If it was not you, ignore this email and change your password from Settings › Account.`,
        };
      case "change-email":
        return {
          subject: "Confirm your FiscalBay email change",
          paragraphs: [
            `You asked to use ${newEmail} to sign in to FiscalBay.`,
            "After you confirm, the new address receives a second link; until then you keep signing in with this one.",
          ],
          button: "Confirm change",
          note: `${validity} If it was not you, ignore this email: your address stays the same.`,
        };
    }
  switch (kind) {
    case "verify":
      return {
        subject: "Conferma l’indirizzo email di FiscalBay",
        paragraphs: ["Conferma che questo indirizzo email è tuo per usarlo con FiscalBay."],
        button: "Conferma email",
        note: `${validity} Se non hai chiesto di usare questo indirizzo con FiscalBay, ignora questa email.`,
      };
    case "reset":
      return {
        subject: "Reimposta la password di FiscalBay",
        preview: "Scegli una nuova password per il tuo account.",
        paragraphs: [
          "Abbiamo ricevuto una richiesta di reimpostare la password del tuo account FiscalBay.",
        ],
        button: "Reimposta password",
        note: `${validity} Se non sei stato tu, ignora questa email: la password resta quella attuale.`,
      };
    case "delete-account":
      return {
        subject: "Conferma la cancellazione dell’account FiscalBay",
        paragraphs: [
          "Hai chiesto di eliminare il tuo account FiscalBay.",
          "Dopo la conferma chiudiamo tutte le sessioni, fermiamo letture dei negozi, notifiche e rinnovi, poi eliminiamo ordini, negozi e impostazioni. La cancellazione non si può annullare.",
        ],
        button: "Elimina l’account",
        note: `${validity} Apri il link nel browser in cui hai effettuato l’accesso. Se non sei stato tu, ignora questa email e cambia la password da Impostazioni › Account.`,
      };
    case "change-email":
      return {
        subject: "Conferma il cambio email di FiscalBay",
        paragraphs: [
          `Hai chiesto di usare ${newEmail} per accedere a FiscalBay.`,
          "Dopo la conferma il nuovo indirizzo riceve un secondo link; fino ad allora accedi con questo.",
        ],
        button: "Conferma il cambio",
        note: `${validity} Se non sei stato tu, ignora questa email: l’indirizzo resta quello attuale.`,
      };
  }
}

export type AuthEmailKind = "verify" | "reset" | "change-email" | "delete-account";

/** Email dei link di Better Auth, nella lingua della pagina da cui è partita la richiesta. */
export function sendAuthEmail(
  env: Env,
  kind: AuthEmailKind,
  input: { to: string; url: string; newEmail?: string },
): void {
  const language = linkLanguage(input.url);
  waitUntil(
    sendAccountEmail(env, {
      language,
      to: input.to,
      url: input.url,
      email: authEmail(kind, language, input.newEmail),
    }).catch((error: unknown) => logFailure({ error, operation: "account_email" })),
  );
}

/**
 * Chi si registra con un indirizzo già usato riceve la stessa risposta di un nuovo account;
 * il titolare riceve questa email, nella lingua della pagina di registrazione. Come la conferma
 * di un nuovo indirizzo, l'invio esce dal percorso della risposta: il tempo di risposta non
 * rivela che l'indirizzo è registrato.
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
  const email: AccountEmail =
    language === "en"
      ? {
          subject: "You already have a FiscalBay account",
          paragraphs: [
            "Someone tried to create a FiscalBay account with this address, which is already registered.",
            "If it was you, sign in or reset your password from the sign-in page.",
          ],
          button: "Go to sign-in",
          note: "If it was not you, ignore this email: your account has not changed.",
        }
      : {
          subject: "Hai già un account FiscalBay",
          paragraphs: [
            "Qualcuno ha provato a creare un account FiscalBay con questo indirizzo, che è già registrato.",
            "Se eri tu, accedi oppure reimposta la password dalla pagina di accesso.",
          ],
          button: "Vai all’accesso",
          note: "Se non eri tu, ignora questa email: il tuo account non è cambiato.",
        };
  waitUntil(
    sendAccountEmail(env, {
      language,
      to,
      url: new URL(localizedPath(language, accessPath), env.APP_ORIGIN).toString(),
      email,
    }).catch((error: unknown) => logFailure({ error, operation: "account_email" })),
  );
}

export type SecurityEvent =
  | { kind: "password-reset" }
  | { kind: "method-linked" | "method-removed"; method: "google" | "ebay" | "password" }
  | { kind: "passkey-added" | "passkey-removed" };

const methodNames: Record<Language, Record<"google" | "ebay" | "password", string>> = {
  it: { google: "Google", ebay: "eBay", password: "email e password" },
  en: { google: "Google", ebay: "eBay", password: "email and password" },
};

function securityEmail(event: SecurityEvent, language: Language): AccountEmail {
  const it = language === "it";
  const common = {
    button: it ? "Apri Account" : "Open Account",
    note: it
      ? "Se non sei stato tu, apri Account, controlla i metodi di accesso e reimposta la password."
      : "If it was not you, open Account, check your sign-in methods and reset your password.",
  };
  switch (event.kind) {
    case "password-reset":
      return {
        ...common,
        ...(it
          ? {
              subject: "La password di FiscalBay è stata reimpostata",
              paragraphs: [
                "La password del tuo account FiscalBay è stata reimpostata e le sessioni aperte sono state chiuse.",
              ],
            }
          : {
              subject: "Your FiscalBay password was reset",
              paragraphs: [
                "The password of your FiscalBay account was reset and open sessions were signed out.",
              ],
            }),
      };
    case "method-linked":
    case "method-removed": {
      const name = methodNames[language][event.method];
      const linked = event.kind === "method-linked";
      return {
        ...common,
        ...(it
          ? {
              subject: linked
                ? "Nuovo metodo di accesso su FiscalBay"
                : "Metodo di accesso rimosso da FiscalBay",
              paragraphs: [
                `${linked ? "È stato collegato" : "È stato rimosso"} l’accesso con ${name} ${linked ? "al" : "dal"} tuo account FiscalBay.`,
              ],
            }
          : {
              subject: linked
                ? "New sign-in method on FiscalBay"
                : "Sign-in method removed from FiscalBay",
              paragraphs: [
                `Sign-in with ${name} was ${linked ? "added to" : "removed from"} your FiscalBay account.`,
              ],
            }),
      };
    }
    case "passkey-added":
    case "passkey-removed": {
      const added = event.kind === "passkey-added";
      return {
        ...common,
        ...(it
          ? {
              subject: added ? "Nuova passkey su FiscalBay" : "Passkey rimossa da FiscalBay",
              paragraphs: [
                `${added ? "È stata aggiunta una passkey al" : "È stata rimossa una passkey dal"} tuo account FiscalBay.`,
              ],
            }
          : {
              subject: added ? "New passkey on FiscalBay" : "Passkey removed from FiscalBay",
              paragraphs: [
                `A passkey was ${added ? "added to" : "removed from"} your FiscalBay account.`,
              ],
            }),
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
        email: securityEmail(event, language),
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
    email:
      language === "en"
        ? {
            subject: "Your FiscalBay stores will stop updating",
            paragraphs: [
              "You have not opened FiscalBay for 30 days.",
              `With the Free plan, sign in by ${deadline} to keep reading new orders from eBay. Otherwise reading pauses until you resume it from Stores; your orders stay available.`,
            ],
            button: "Open Stores",
          }
        : {
            subject: "I tuoi negozi su FiscalBay smetteranno di aggiornarsi",
            paragraphs: [
              "Non apri FiscalBay da 30 giorni.",
              `Con il piano Free, accedi entro il ${deadline} per continuare a leggere i nuovi ordini da eBay. Altrimenti le letture si fermano finché non le riprendi da Negozi; i tuoi ordini restano disponibili.`,
            ],
            button: "Apri Negozi",
          },
  });
}

/**
 * Negozio da ricollegare: eBay ha rifiutato o revocato il consenso, oppure è scaduto, e le
 * letture sono ferme. Porta a Negozi, dove si ricollega; nessun dato degli acquirenti. Il compito
 * che la invia la registra soltanto se l'invio riesce.
 */
export async function sendReconnectNotice(
  env: Env,
  input: { to: string; language: Language; storeName: string },
): Promise<void> {
  const { language, storeName } = input;
  await sendAccountEmail(env, {
    language,
    to: input.to,
    url: new URL(localizedPath(language, storesPath), env.APP_ORIGIN).toString(),
    email:
      language === "en"
        ? {
            subject: "Reconnect your eBay store to FiscalBay",
            paragraphs: [
              `The connection of ${storeName} with eBay is no longer valid: the consent expired or was revoked.`,
              "FiscalBay cannot read new orders from this store until you reconnect it from Stores. Orders already imported stay available.",
            ],
            button: "Open Stores",
          }
        : {
            subject: "Ricollega il tuo negozio eBay a FiscalBay",
            paragraphs: [
              `Il collegamento di ${storeName} con eBay non è più valido: il consenso è scaduto o è stato revocato.`,
              "FiscalBay non può leggere i nuovi ordini di questo negozio finché non lo ricolleghi da Negozi. Gli ordini già importati restano consultabili.",
            ],
            button: "Apri Negozi",
          },
  });
}

/**
 * Cancellazione dell'account completata, alla fine del lavoro: l'indirizzo arriva dalla
 * richiesta, perché l'utente non esiste più. Il pulsante porta al sito pubblico.
 */
export async function sendAccountDeletedNotice(
  env: Env,
  input: { to: string; language: Language },
): Promise<void> {
  const { language } = input;
  await sendAccountEmail(env, {
    language,
    to: input.to,
    url: new URL(localizedPath(language), env.APP_ORIGIN).toString(),
    email:
      language === "en"
        ? {
            subject: "Your FiscalBay account has been deleted",
            paragraphs: [
              "We deleted your FiscalBay account with its orders, stores and settings.",
              "Subscriptions no longer renew. We keep only: for each store, a keyed fingerprint of the eBay account that records the trial already used for two years and the unlocks already used until the end of the current Free cycle; for one year, store transfers and support operations that concerned the account; the Stripe references of lifetime seats and of customer data erasures at Stripe; the record of the request for thirty days.",
            ],
            button: "Go to FiscalBay",
            footer: `You are receiving this email because you deleted your FiscalBay account. For help, write to ${supportEmail}.`,
          }
        : {
            subject: "Il tuo account FiscalBay è stato eliminato",
            paragraphs: [
              "Abbiamo eliminato il tuo account FiscalBay con ordini, negozi e impostazioni.",
              "Gli abbonamenti non si rinnovano più. Conserviamo soltanto: per ogni negozio un’impronta dell’account eBay calcolata con una chiave segreta, che ricorda per due anni la prova già usata e fino alla fine del ciclo Free in corso gli sblocchi già usati; per un anno i trasferimenti di negozi e le operazioni dell’assistenza che riguardavano l’account; i riferimenti Stripe dei posti lifetime e delle cancellazioni dei dati dei clienti presso Stripe; la registrazione della richiesta per trenta giorni.",
            ],
            button: "Vai a FiscalBay",
            footer: `Ricevi questa email perché hai eliminato il tuo account FiscalBay. Per assistenza scrivi a ${supportEmail}.`,
          },
  });
}
