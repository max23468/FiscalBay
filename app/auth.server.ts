import { passkey } from "@better-auth/passkey";
import { betterAuth, type Auth, type BetterAuthOptions } from "better-auth";
import { genericOAuth } from "better-auth/plugins";
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

export function createAuthOptions(environment: Env): BetterAuthOptions {
  const appOrigin = new URL(environment.APP_ORIGIN);

  return {
    appName: "FiscalBay",
    baseURL: appOrigin.origin,
    database: environment.DB,
    secret: environment.BETTER_AUTH_SECRET,
    trustedOrigins: [appOrigin.origin],
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
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
            scopes: [
              "https://api.ebay.com/oauth/api_scope",
              "https://api.ebay.com/oauth/api_scope/commerce.identity.readonly",
              "https://api.ebay.com/oauth/api_scope/commerce.identity.email.readonly",
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
    ],
  };
}

export function createAuth(environment: Env): Auth {
  return betterAuth(createAuthOptions(environment));
}
