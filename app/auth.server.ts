import { passkey } from "@better-auth/passkey";
import { betterAuth, type Auth, type BetterAuthOptions } from "better-auth";
import { getAuthoritativeSessionFromCtx, getOAuthState } from "better-auth/api";
import { genericOAuth } from "better-auth/plugins";
import { waitUntil } from "cloudflare:workers";
import { z } from "zod";

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

const authEmailFrom = "noreply@fiscalbay.it";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

async function sendAuthEmail(
  environment: Env,
  email: string,
  subject: string,
  message: string,
  url: string,
): Promise<void> {
  const safeUrl = escapeHtml(url);
  await environment.AUTH_EMAIL.send({
    from: { email: authEmailFrom, name: "FiscalBay" },
    replyTo: "supporto@fiscalbay.it",
    to: email,
    subject,
    text: `${message}\n\n${url}`,
    html: `<p>${message}</p><p><a href="${safeUrl}">Continua su FiscalBay</a></p>`,
  });
}

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
    account: {
      encryptOAuthTokens: true,
      accountLinking: {
        allowDifferentEmails: true,
        // La fiducia permette il linking esplicito; validateUserInfo vieta quello per email.
        trustedProviders: ["ebay"],
      },
    },
    user: {
      validateUserInfo: async ({ user, source }, context) => {
        if (source.oauth?.providerId !== "ebay") return;
        if (!user.email) return { error: "email_not_found" };
        if (source.action !== "link-account") return;
        // Lo state è già validato da Better Auth. Non basta essere autenticati: deve
        // contenere un linking esplicito per la stessa sessione, ancora valida e verificata.
        const state = await getOAuthState();
        if (!state?.link) return { error: "account_not_linked" };
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
      // La sessione nasce subito: chi non ha verificato l'email esplora, ma non collega negozi.
      requireEmailVerification: false,
      sendResetPassword: async ({ user, url }) => {
        waitUntil(
          sendAuthEmail(
            environment,
            user.email,
            "Reimposta la password di FiscalBay",
            "Hai richiesto di reimpostare la password.",
            url,
          ),
        );
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        waitUntil(
          sendAuthEmail(
            environment,
            user.email,
            "Conferma l’indirizzo email di FiscalBay",
            "Conferma il tuo indirizzo email per collegare i tuoi negozi eBay a FiscalBay.",
            url,
          ),
        );
      },
    },
    socialProviders: {
      google: {
        clientId: environment.GOOGLE_CLIENT_ID,
        clientSecret: environment.GOOGLE_CLIENT_SECRET,
      },
    },
    plugins: [
      passkey({
        origin: appOrigin.origin,
        rpID: appOrigin.hostname,
        rpName: "FiscalBay",
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
              const response = await fetch("https://apiz.ebay.com/commerce/identity/v1/user/", {
                headers: { Authorization: `Bearer ${tokens.accessToken}` },
              });
              if (!response.ok) return null;

              const profile = ebayIdentitySchema.parse(await response.json());
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
