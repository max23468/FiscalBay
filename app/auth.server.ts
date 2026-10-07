import { passkey } from "@better-auth/passkey";
import { betterAuth, type Auth, type BetterAuthOptions } from "better-auth";
import { getAuthoritativeSessionFromCtx, getOAuthState } from "better-auth/api";
import { genericOAuth } from "better-auth/plugins";
import { z } from "zod";

import {
  notifySecurityEvent,
  sendAuthEmail,
  sendExistingAccountEmail,
} from "./account-email.server";
import { logFailure } from "./errors";
import { upstreamJson } from "./integrations/http.server";

// Con `commerce.identity.readonly` eBay restituisce l'email soltanto per gli account business.
const ebayIdentitySchema = z.object({
  userId: z.string().min(1),
  username: z.string().min(1),
  businessAccount: z
    .object({
      email: z.string().email().optional(),
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

export function createAuthOptions(environment: Env): BetterAuthOptions {
  const appOrigin = new URL(environment.APP_ORIGIN);

  return {
    appName: "FiscalBay",
    baseURL: appOrigin.origin,
    database: environment.DB,
    secret: environment.BETTER_AUTH_SECRET,
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
    },
    logger: { disabled: true },
    session: {
      ...sessionPolicy,
      // Ogni richiesta rilegge la sessione da D1: logout e revoche valgono subito.
      cookieCache: { enabled: false },
      additionalFields: {
        passkeyVerified: { type: "boolean", required: true, defaultValue: false, input: false },
      },
    },
    databaseHooks: {
      account: {
        create: {
          // Google o eBay aggiunti a un account che aveva già un accesso: il titolare ne riceve
          // avviso. La password impostata con il link ha l'avviso del reset.
          after: async (account) => {
            if (account.providerId !== "google" && account.providerId !== "ebay") return;
            const other = await environment.DB.prepare(
              `SELECT 1 FROM "account" WHERE "userId" = ?1 AND "id" <> ?2
               UNION ALL SELECT 1 FROM "passkey" WHERE "userId" = ?1 LIMIT 1`,
            )
              .bind(account.userId, account.id)
              .first();
            if (other) {
              notifySecurityEvent(environment, account.userId, {
                kind: "method-linked",
                method: account.providerId,
              });
            }
          },
        },
      },
      session: {
        create: {
          before: async (session, context) => ({
            data: {
              ...session,
              passkeyVerified: Boolean(
                context?.request && userVerifiedRequests.has(context.request),
              ),
            },
          }),
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
      // L'email si cambia con la conferma del vecchio indirizzo, se verificato, e poi del nuovo.
      changeEmail: {
        enabled: true,
        sendChangeEmailConfirmation: async ({ user, newEmail, url }) => {
          sendAuthEmail(environment, "change-email", { to: user.email, url, newEmail });
        },
      },
      validateUserInfo: async ({ user, source }, context) => {
        const provider = source.oauth?.providerId;
        if (provider === "ebay" && !user.email) return { error: "email_not_found" };
        if (source.action !== "link-account") return;
        // Lo state è già validato da Better Auth. Senza linking esplicito il collegamento avviene
        // per email: Better Auth richiede l'utente locale verificato, qui serve anche l'email
        // verificata e autorevole del provider, che eBay non fornisce.
        const state = await getOAuthState();
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
      revokeSessionsOnPasswordReset: true,
      // La registrazione non apre la sessione e risponde allo stesso modo per un indirizzo già
      // registrato: la sessione nasce dal link di conferma. Chi accede con la password senza
      // aver confermato l'email esplora, ma non collega negozi.
      requireEmailVerification: false,
      autoSignIn: false,
      onExistingUserSignUp: async ({ user }, request) => {
        await sendExistingAccountEmail(environment, user.email, request);
      },
      sendResetPassword: async ({ user, url }) => {
        sendAuthEmail(environment, "reset", { to: user.email, url });
      },
      onPasswordReset: async ({ user }) => {
        notifySecurityEvent(environment, user.id, { kind: "password-reset" });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        sendAuthEmail(environment, "verify", { to: user.email, url });
      },
    },
    socialProviders: {
      google: {
        clientId: environment.GOOGLE_CLIENT_ID,
        clientSecret: environment.GOOGLE_CLIENT_SECRET,
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
            clientId: environment.EBAY_CLIENT_ID,
            clientSecret: environment.EBAY_CLIENT_SECRET,
            redirectURI: environment.EBAY_RUNAME,
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

export function createAuth(environment: Env): Auth {
  let auth = instances.get(environment);
  if (!auth) instances.set(environment, (auth = betterAuth(createAuthOptions(environment))));
  return auth;
}
