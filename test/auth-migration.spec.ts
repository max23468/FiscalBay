import { env } from "cloudflare:workers";
import { getMigrations } from "better-auth/db/migration";
import { describe, expect, it } from "vitest";

import { handleAuthRequest } from "../app/auth-route.server";
import { createAuth, createAuthOptions } from "../app/auth.server";

it("mantiene lo schema D1 allineato ai quattro metodi Auth", async () => {
  const migration = await getMigrations(createAuthOptions(env));
  expect(migration.toBeCreated).toEqual([]);
  expect(migration.toBeAdded).toEqual([]);
  expect(migration.toBeAddedIndexes).toEqual([]);
  expect(migration.schemaProblems).toEqual([]);
  expect(migration.unsafeChanges).toEqual([]);
});

describe("Better Auth su Workers e D1", () => {
  it("collega la dashboard gestita solo quando è presente la chiave dedicata", () => {
    const options = createAuthOptions({
      ...env,
      BETTER_AUTH_API_KEY: "dashboard-test-key",
    });
    expect(options.plugins?.map((plugin) => plugin.id)).toContain("dash");
  });

  it("cifra i token OAuth e non li espone tramite le route HTTP", async () => {
    const options = createAuthOptions(env);
    expect(options.account?.encryptOAuthTokens).toBe(true);
    expect(options.account?.accountLinking?.allowDifferentEmails).toBe(true);
    expect(options.advanced?.ipAddress?.ipAddressHeaders).toEqual(["cf-connecting-ip"]);
    expect(options.advanced?.database?.joins).toBe(true);
    expect(options.onAPIError?.errorURL).toBe("/auth/error");

    for (const path of ["get-access-token", "refresh-token"]) {
      const response = await handleAuthRequest(
        new Request(`http://localhost:5173/api/auth/${path}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ accountId: "account-test" }),
        }),
        env,
      );
      expect(response.status).toBe(404);
    }
  });

  it("rifiuta callback eBay ambigui o privi di stato senza creare account", async () => {
    for (const query of [
      "code=synthetic",
      "code=synthetic&state=one&state=two",
      "code=synthetic&error=access_denied&state=one",
    ]) {
      const response = await handleAuthRequest(
        new Request(`http://localhost:5173/api/auth/callback/ebay?${query}`),
        env,
      );
      expect(response.status).toBe(303);
      expect(response.headers.get("location")).toBe("http://localhost:5173/auth/error");
      expect(response.headers.get("cache-control")).toBe("no-store");
    }

    const account = await env.DB.prepare(
      'SELECT COUNT(*) AS total FROM "account" WHERE "providerId" = ?',
    )
      .bind("ebay")
      .first<{ total: number }>();
    expect(account?.total).toBe(0);
  });

  it("crea un account email non verificato nel database locale", async () => {
    const response = await createAuth(env).handler(
      new Request("http://localhost:5173/api/auth/sign-up/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Utente test",
          email: "auth@example.invalid",
          password: "Una-password-auth-molto-lunga",
        }),
      }),
    );

    expect(response.status).toBe(200);
    const user = await env.DB.prepare('SELECT email, "emailVerified" FROM "user" WHERE email = ?')
      .bind("auth@example.invalid")
      .first<{ email: string; emailVerified: number }>();
    expect(user).toEqual({ email: "auth@example.invalid", emailVerified: 0 });
  });

  it("espone il percorso passkey solo a una sessione autenticata", async () => {
    const response = await createAuth(env).handler(
      new Request("http://localhost:5173/api/auth/passkey/generate-register-options"),
    );
    expect(response.status).toBe(401);
  });

  it.each([
    ["google", "accounts.google.com"],
    ["ebay", "auth.ebay.com"],
  ])("avvia il login %s sul provider previsto", async (provider, host) => {
    const response = await createAuth(env).handler(
      new Request("http://localhost:5173/api/auth/sign-in/social", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider, callbackURL: "/" }),
      }),
    );
    expect(response.status).toBe(200);
    const result = await response.json<{ url: string }>();
    const authorizationUrl = new URL(result.url);
    expect(authorizationUrl.hostname).toBe(host);

    if (provider === "ebay") {
      expect(authorizationUrl.searchParams.get("redirect_uri")).toBe("fiscalbay-test-runame");
      expect(authorizationUrl.searchParams.get("state")).toBeTruthy();
      expect(authorizationUrl.searchParams.get("code_challenge")).toBeTruthy();
      expect(authorizationUrl.searchParams.get("code_challenge_method")).toBe("S256");
      const scopes = new Set((authorizationUrl.searchParams.get("scope") ?? "").split(" "));
      expect(scopes).toEqual(
        new Set([
          "https://api.ebay.com/oauth/api_scope",
          "https://api.ebay.com/oauth/api_scope/commerce.identity.readonly",
          "https://api.ebay.com/oauth/api_scope/commerce.identity.email.readonly",
          "https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly",
        ]),
      );
    }
  });
});
