import { dash } from "@better-auth/infra";
import { passkey } from "@better-auth/passkey";
import { betterAuth, type Auth, type BetterAuthOptions, type BetterAuthPlugin } from "better-auth";
import {
  APIError,
  createAuthMiddleware,
  getAuthoritativeSessionFromCtx,
  getOAuthState,
} from "better-auth/api";
import { genericOAuth } from "better-auth/plugins";
import { waitUntil } from "./service-activity.server";
import { z } from "zod";

import {
  linkLanguage,
  notifySecurityEvent,
  sendAuthEmail,
  sendExistingAccountEmail,
} from "./account-email.server";
import { accountDeletionPath } from "./app-links";
import { logFailure } from "./errors";
import { localizedPath } from "./i18n";
import { maxPasswordLength, minPasswordLength } from "./limits";
import { emailVerificationSeconds } from "./domain/email-change.server";
import { upstreamJson } from "./integrations/http.server";
import { hashPassword, verifyPassword } from "./password.server";

// Chiave facoltativa del progetto su dash.better-auth.com, impostata soltanto sul Worker test:
// senza, il plugin non viene caricato. Dichiararla con `bindings.secret()` la renderebbe
// obbligatoria anche in Production.
declare global {
  namespace Cloudflare {
    interface Env {
      BETTER_AUTH_API_KEY?: string;
    }
  }
}

// La dashboard riceve gli eventi da `runInBackground`, che senza `waitUntil` Workers può
// interrompere dopo la risposta. `advanced.backgroundTasks` sposterebbe in background anche
// le email, oggi attese perché un invio fallito arrivi all'utente.
const durableBackground: BetterAuthPlugin = {
  id: "durable-background",
  init: () => ({
    context: { runInBackground: (task) => waitUntil(Promise.resolve(task).catch(() => {})) },
  }),
};

// Con `commerce.identity.readonly` eBay restituisce l'email soltanto per gli account business.
const ebayIdentitySchema = z.object({
  userId: z.string().min(1),
  username: z.string().min(1),
  businessAccount: z
    .object({
      email: z.email().optional(),
    })
    .optional(),
});

/** Dominio delle email di cui Google è autorevole oltre ai domini Workspace. */
export const gmailDomain = "gmail.com";

/**
 * Durata delle sessioni in secondi: scadenza, rinnovo con l'uso e accesso recente. Il rinnovo
 * aggiorna anche l'ultima attività mostrata in Sicurezza, quindi avviene al più una volta l'ora.
 */
export const sessionPolicy = {
  expiresIn: 7 * 86_400,
  updateAge: 3_600,
  freshAge: 86_400,
} as const;

// Richieste in cui una passkey ha superato la verifica dell'utente sul dispositivo: la
// sessione creata dalla stessa richiesta lo registra. La richiesta resta in memoria solo
// finché è in corso.
const userVerifiedRequests = new WeakSet<Request>();

function requireRegistrationApproval(env: Env, email: string) {
  if (env.REGISTRATION_MODE === "open") return;
  // Un elenco assente, vuoto o non valido chiude le nuove registrazioni.
  let emails: string[] | undefined;
  try {
    emails = z
      .array(z.string().trim().pipe(z.email()))
      .parse(JSON.parse(env.REGISTRATION_ALLOWED_EMAILS));
  } catch {
    // Non registrare il contenuto della configurazione privata.
  }
  if (!emails?.some((allowed) => allowed.toLowerCase() === email.toLowerCase())) {
    throw new APIError("FORBIDDEN", {
      code: "registration_approval_required",
      message: "Registration requires approval.",
    });
  }
}

export function createAuthOptions(env: Env): BetterAuthOptions {
  const appOrigin = new URL(env.APP_ORIGIN);

  return {
    appName: "FiscalBay",
    baseURL: appOrigin.origin,
    database: env.DB,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [appOrigin.origin],
    advanced: {
      database: {
        joins: true,
        // Lo schema è provato in CI contro le migration, applicate prima del deploy. Il
        // controllo a runtime, con l'istanza riusata, bloccherebbe l'isolate anche dopo la migration.
        validateSchema: false,
      },
      ipAddress: {
        ipAddressHeaders: ["cf-connecting-ip"],
      },
    },
    // Il limite dei tentativi si applica prima del router, in auth-route.server.ts, anche ai moduli.
    rateLimit: { enabled: false },
    onAPIError: {
      errorURL: "/auth/error",
      // Un errore imprevisto, come il database che non risponde, esce dal router invece di
      // finire intero nel suo console.error: auth-route.server.ts lo registra con il solo codice.
      throw: true,
    },
    logger: { disabled: true },
    hooks: {
      before: createAuthMiddleware(async (context) => {
        // Anche il tentativo su un account esistente riceve lo stesso rifiuto: il filtro
        // non deve rivelare se un indirizzo fuori elenco è già registrato.
        if (context.path === "/sign-up/email" && typeof context.body?.email === "string") {
          requireRegistrationApproval(env, context.body.email);
        }
      }),
    },
    session: {
      ...sessionPolicy,
      // Ogni richiesta rilegge la sessione da D1: logout e revoche valgono subito.
      cookieCache: { enabled: false },
      additionalFields: {
        passkeyVerified: { type: "boolean", required: true, defaultValue: false, input: false },
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            // Include i callback OAuth; non modifica accessi e collegamenti esistenti.
            requireRegistrationApproval(env, user.email);
          },
        },
      },
      account: {
        create: {
          // Google o eBay aggiunti a un account che aveva già un accesso: il titolare ne riceve
          // avviso. La password impostata con il link ha l'avviso del reset.
          after: async (account) => {
            if (account.providerId !== "google" && account.providerId !== "ebay") return;
            const other = await env.DB.prepare(
              `SELECT 1 FROM "account" WHERE "userId" = ?1 AND "id" <> ?2
               UNION ALL SELECT 1 FROM "passkey" WHERE "userId" = ?1 LIMIT 1`,
            )
              .bind(account.userId, account.id)
              .first();
            if (other) {
              notifySecurityEvent(env, account.userId, {
                kind: "method-linked",
                method: account.providerId,
              });
            }
          },
        },
      },
      session: {
        create: {
          before: async (session, context) => {
            // Cancellazione in corso: nessun metodo apre più una sessione, fino all'eliminazione.
            const deleting = await env.DB.prepare(
              "SELECT 1 FROM account_deletions WHERE user_id = ?",
            )
              .bind(session.userId)
              .first();
            if (deleting) {
              throw new APIError("FORBIDDEN", {
                code: "account_deletion_in_progress",
                // Stryker disable next-line StringLiteral: i client leggono il codice, non il testo.
                message: "Account deletion in progress.",
              });
            }
            return {
              data: {
                ...session,
                passkeyVerified: Boolean(
                  context?.request && userVerifiedRequests.has(context.request),
                ),
              },
            };
          },
        },
      },
    },
    account: {
      encryptOAuthTokens: true,
      accountLinking: {
        allowDifferentEmails: true,
        // La fiducia permette il linking esplicito; validateUserInfo limita quello per email.
        trustedProviders: ["ebay", "google"],
      },
    },
    user: {
      additionalFields: {
        // Si concede solo dal database: `input: false` lo esclude da registrazione e modifiche.
        admin: { type: "boolean", required: true, defaultValue: false, input: false },
      },
      // Cancellazione dell'account (§30): la richiesta dalle Impostazioni manda il link; la
      // conferma registra la richiesta, ferma accesso, letture e notifiche e torna alla pagina
      // dell'esito senza eliminare l'utente, che il lavoro FiscalBay elimina per ultimo. Il
      // token vale una volta sola e soltanto con la sessione dello stesso utente.
      deleteUser: {
        enabled: true,
        deleteTokenExpiresIn: emailVerificationSeconds,
        sendDeleteAccountVerification: async ({ user, url }) => {
          sendAuthEmail(env, "delete-account", { to: user.email, url });
        },
        beforeDelete: async (user, request) => {
          // Better Auth passa sempre la richiesta del link: «it» vale soltanto per i tipi.
          // Stryker disable next-line StringLiteral: nessun percorso chiama la cancellazione senza richiesta.
          const language = request ? linkLanguage(request.url) : "it";
          // Il lavoro porta con sé lo stop dei rinnovi: si carica soltanto alla conferma.
          const { startAccountDeletion } = await import("./domain/account-deletion.server");
          // Una registrazione non riuscita non scrive nulla: l'account resta com'era e la
          // pagina invita a chiedere un nuovo link, perché questo è già consumato.
          await startAccountDeletion(env, user, language).catch((error: unknown) => {
            logFailure({ request, error, operation: "account_deletion" });
            throw new APIError("INTERNAL_SERVER_ERROR");
          });
          throw new APIError("FOUND", undefined, {
            location: localizedPath(language, accountDeletionPath),
          });
        },
      },
      // L'email si cambia con la conferma del vecchio indirizzo, se verificato, e poi del nuovo.
      changeEmail: {
        enabled: true,
        sendChangeEmailConfirmation: async ({ user, newEmail, url }) => {
          sendAuthEmail(env, "change-email", { to: user.email, url, newEmail });
        },
      },
      validateUserInfo: async ({ user, source }, context) => {
        const provider = source.oauth?.providerId;
        // Stryker disable next-line ConditionalExpression: solo eBay può dare un profilo senza email.
        if (provider === "ebay" && !user.email) return { error: "email_not_found" };
        if (source.action !== "link-account") return;
        // Lo state è già validato da Better Auth. Senza linking esplicito il collegamento avviene
        // per email: Better Auth richiede l'utente locale verificato, qui serve anche l'email
        // verificata e autorevole del provider, che eBay non fornisce.
        const state = await getOAuthState();
        // Stryker disable next-line OptionalChaining: nel callback OAuth lo state c'è sempre.
        if (!state?.link) return user.emailVerified ? undefined : { error: "account_not_linked" };
        // Non basta essere autenticati: il linking esplicito vale solo per la stessa sessione,
        // ancora valida e verificata. Così un account creato in anticipo con l'email di un altro
        // non può conservare un metodo proprio quando il vero titolare recupera l'indirizzo.
        const session = await getAuthoritativeSessionFromCtx(context);
        if (
          !session?.user.emailVerified ||
          state.link.userId !== session.user.id ||
          user.id !== session.user.id
        ) {
          return { error: "unable_to_link_account" };
        }
      },
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength,
      maxPasswordLength,
      password: { hash: hashPassword, verify: verifyPassword },
      revokeSessionsOnPasswordReset: true,
      // Lo stesso tempo dei link di conferma, che l'email dichiara.
      resetPasswordTokenExpiresIn: emailVerificationSeconds,
      // La registrazione non apre la sessione e risponde allo stesso modo per un indirizzo già
      // registrato: la sessione nasce dal link di conferma. Chi accede con la password senza
      // aver confermato l'email esplora, ma non collega negozi.
      requireEmailVerification: false,
      autoSignIn: false,
      onExistingUserSignUp: async ({ user }, request) => {
        await sendExistingAccountEmail(env, user.email, request);
      },
      sendResetPassword: async ({ user, url }) => {
        sendAuthEmail(env, "reset", { to: user.email, url });
      },
      onPasswordReset: async ({ user }) => {
        notifySecurityEvent(env, user.id, { kind: "password-reset" });
      },
    },
    emailVerification: {
      expiresIn: emailVerificationSeconds,
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        // Il secondo link arriva al nuovo indirizzo; l'accesso resta sul precedente fino alla conferma.
        await env.DB.prepare(
          "UPDATE account_email_changes SET stage = 'new', expires_at = ? WHERE user_id = ? AND new_email = ?",
        )
          .bind(
            new Date(Date.now() + emailVerificationSeconds * 1000).toISOString(),
            user.id,
            user.email,
          )
          .run();
        sendAuthEmail(env, "verify", { to: user.email, url });
      },
      afterEmailVerification: async (user) => {
        await env.DB.prepare("DELETE FROM account_email_changes WHERE user_id = ?")
          .bind(user.id)
          .run();
      },
    },
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        // Google è autorevole solo per Gmail e per i domini Workspace (`hd`): per gli altri
        // indirizzi chiediamo la nostra conferma e non colleghiamo per email.
        mapProfileToUser: (profile) => ({
          emailVerified:
            profile.email_verified &&
            (profile.email.toLowerCase().endsWith(`@${gmailDomain}`) || Boolean(profile.hd)),
        }),
      },
    },
    plugins: [
      ...(env.BETTER_AUTH_API_KEY
        ? [dash({ apiKey: env.BETTER_AUTH_API_KEY }), durableBackground]
        : []),
      passkey({
        origin: appOrigin.origin,
        rpID: appOrigin.hostname,
        rpName: "FiscalBay",
        authentication: {
          // Il plugin accetta anche una passkey senza verifica dell'utente: qui vale come
          // un solo fattore, quindi la sessione non è marcata.
          afterVerification: ({ ctx, verification }) => {
            if (verification.authenticationInfo.userVerified && ctx.request) {
              userVerifiedRequests.add(ctx.request);
            }
          },
        },
      }),
      genericOAuth({
        config: [
          {
            providerId: "ebay",
            name: "eBay",
            authorizationUrl: "https://auth.ebay.com/oauth2/authorize",
            tokenUrl: "https://api.ebay.com/identity/v1/oauth2/token",
            clientId: env.EBAY_CLIENT_ID,
            clientSecret: env.EBAY_CLIENT_SECRET,
            redirectURI: env.EBAY_RUNAME,
            authentication: "basic",
            pkce: true,
            allowIdpInitiated: false,
            scopes: [
              "https://api.ebay.com/oauth/api_scope",
              "https://api.ebay.com/oauth/api_scope/commerce.identity.readonly",
            ],
            accountSubject: ({ profile }) => ebayIdentitySchema.shape.userId.parse(profile.userId),
            getUserInfo: async (tokens) => {
              let profile: z.infer<typeof ebayIdentitySchema>;
              try {
                profile = await upstreamJson(
                  fetch,
                  "https://apiz.ebay.com/commerce/identity/v1/user/",
                  ebayIdentitySchema,
                  { headers: { Authorization: `Bearer ${tokens.accessToken}` } },
                );
              } catch (error) {
                // Better Auth chiude il login con un errore generico; il log ne conserva il tipo.
                logFailure({ error, operation: "sign_in" });
                return null;
              }
              // Senza email Better Auth rifiuta il login con `email_not_found` e la pagina di
              // errore indirizza agli altri metodi. L'email business non è verificata da eBay:
              // FiscalBay invia la propria conferma e non la collega da sola a un utente esistente.
              return {
                id: profile.userId,
                userId: profile.userId,
                name: profile.username,
                email: profile.businessAccount?.email,
                emailVerified: false,
              };
            },
          },
        ],
      }),
    ],
  };
}

// Costruire Better Auth costa più CPU del resto della richiesta: una istanza per ambiente e isolate.
const instances = new WeakMap<Env, Auth>();

export function createAuth(env: Env): Auth {
  let auth = instances.get(env);
  if (!auth) instances.set(env, (auth = betterAuth(createAuthOptions(env))));
  return auth;
}
