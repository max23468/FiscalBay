import { passkey } from "@better-auth/passkey";
import { dash } from "@better-auth/infra";
import { betterAuth, type Auth, type BetterAuthOptions } from "better-auth";
import { genericOAuth } from "better-auth/plugins";
import { waitUntil } from "cloudflare:workers";
import { z } from "zod";

const ebayIdentitySchema = z.object({
  userId: z.string().min(1),
  username: z.string().min(1),
  individualAccount: z
    .object({
      email: z.string().email().optional(),
    })
    .optional(),
  businessAccount: z
    .object({
      email: z.string().email().optional(),
    })
    .optional(),
});

const authEmailFrom = "accesso@auth.fiscalbay.it";

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
    to: email,
    subject,
    text: `${message}\n\n${url}`,
    html: `<p>${message}</p><p><a href="${safeUrl}">Continua su FiscalBay</a></p>`,
  });
}

/**
 * Contatori del limite dei tentativi su D1 con una sola istruzione atomica: apre la finestra
 * o incrementa il conteggio. Lo storage "database" di Better Auth usa più passaggi e, su D1
 * remoto, ripeteva all'infinito l'apertura di una finestra scaduta.
 */
function rateLimitStorage(
  db: D1Database,
): NonNullable<BetterAuthOptions["rateLimit"]>["customStorage"] {
  return {
    async consume(key, { window, max }) {
      const now = Date.now();
      const windowMs = window * 1000;
      const row = await db
        .prepare(
          `INSERT INTO "rateLimit" ("id", "key", "count", "lastRequest") VALUES (?1, ?2, 1, ?3)
           ON CONFLICT ("key") DO UPDATE SET
             "count" = CASE WHEN ?3 - "lastRequest" >= ?4 THEN 1 ELSE "count" + 1 END,
             "lastRequest" = CASE WHEN ?3 - "lastRequest" >= ?4 THEN ?3 ELSE "lastRequest" END
           RETURNING "count", "lastRequest"`,
        )
        .bind(crypto.randomUUID(), key, now, windowMs)
        .first<{ count: number; lastRequest: number }>();
      // Pulizia occasionale delle finestre chiuse da oltre un'ora, fuori dal percorso della risposta.
      if (Math.random() < 0.02) {
        waitUntil(
          db
            .prepare('DELETE FROM "rateLimit" WHERE "lastRequest" < ?')
            .bind(now - 3_600_000)
            .run(),
        );
      }
      if (!row || row.count <= max) return { allowed: true, retryAfter: null };
      return {
        allowed: false,
        retryAfter: Math.max(1, Math.ceil((row.lastRequest + windowMs - now) / 1000)),
      };
    },
  };
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
    // Limite dei tentativi su D1, condiviso fra gli isolate. Attivo sui domini distribuiti;
    // sviluppo locale e test, in HTTP, non hanno un IP client affidabile da cui contare.
    rateLimit: {
      enabled: appOrigin.protocol === "https:",
      // La lettura della sessione non ha effetti: contarla scriverebbe su D1 a ogni pagina.
      customRules: { "/get-session": false },
      customStorage: rateLimitStorage(environment.DB),
    },
    onAPIError: {
      errorURL: "/auth/error",
    },
    logger: { disabled: true },
    account: {
      encryptOAuthTokens: true,
      accountLinking: {
        allowDifferentEmails: true,
      },
    },
    emailAndPassword: {
      enabled: true,
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
            "Conferma il tuo indirizzo email per accedere a FiscalBay.",
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
              "https://api.ebay.com/oauth/api_scope/commerce.identity.email.readonly",
              "https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly",
            ],
            accountSubject: ({ profile }) => ebayIdentitySchema.shape.userId.parse(profile.userId),
            getUserInfo: async (tokens) => {
              const response = await fetch("https://apiz.ebay.com/commerce/identity/v1/user/", {
                headers: { Authorization: `Bearer ${tokens.accessToken}` },
              });
              if (!response.ok) return null;

              const profile = ebayIdentitySchema.parse(await response.json());
              const email = profile.individualAccount?.email ?? profile.businessAccount?.email;
              if (!email) return null;

              return {
                id: profile.userId,
                userId: profile.userId,
                name: profile.username,
                email,
                emailVerified: false,
              };
            },
          },
        ],
      }),
      ...(environment.BETTER_AUTH_API_KEY
        ? [dash({ apiKey: environment.BETTER_AUTH_API_KEY })]
        : []),
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
