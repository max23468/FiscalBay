import { env } from "cloudflare:workers";
import { getMigrations } from "better-auth/db/migration";
import { describe, expect, it, vi } from "vitest";

import { handleAuthRequest } from "../app/auth-route.server";
import { createAuth, createAuthOptions } from "../app/auth.server";
import { completeRegistration } from "../app/domain/registration.server";
import { action as signInAction } from "../app/routes/sign-in";

it("mantiene lo schema D1 allineato ai quattro metodi Auth", async () => {
  const migration = await getMigrations(createAuthOptions(env));
  expect(migration.toBeCreated).toEqual([]);
  expect(migration.toBeAdded).toEqual([]);
  expect(migration.toBeAddedIndexes).toEqual([]);
  expect(migration.schemaProblems).toEqual([]);
  expect(migration.unsafeChanges).toEqual([]);
});

describe("Better Auth su Workers e D1", () => {
  it("usa mittente e Reply-To previsti per verifica e reset", async () => {
    const send = vi.fn(async () => ({ messageId: "synthetic" }));
    const options = createAuthOptions({ ...env, AUTH_EMAIL: { send } } as Env);
    const user = { email: "auth@example.invalid" };
    const url = "https://test.fiscalbay.it/verifica";

    await options.emailVerification?.sendVerificationEmail?.(
      { user, url } as never,
      new Request(url),
    );
    await options.emailAndPassword?.sendResetPassword?.({ user, url } as never, new Request(url));

    expect(send).toHaveBeenCalledTimes(2);
    for (const [message] of send.mock.calls) {
      expect(message).toMatchObject({
        from: {
          email: ["noreply", "fiscalbay.it"].join("@"),
          name: "FiscalBay",
        },
        replyTo: ["supporto", "fiscalbay.it"].join("@"),
        to: user.email,
      });
    }
  });

  it("cifra i token OAuth e non li espone tramite le route HTTP", async () => {
    const options = createAuthOptions(env);
    expect(options.account?.encryptOAuthTokens).toBe(true);
    expect(options.account?.accountLinking?.allowDifferentEmails).toBe(true);
    expect(options.advanced?.ipAddress?.ipAddressHeaders).toEqual(["cf-connecting-ip"]);
    expect(options.advanced?.database?.joins).toBe(true);
    expect(options.advanced?.database?.validateSchema).toBe(false);
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

  it("registra passkey solo dopo verifica e protegge l'ultimo accesso", async () => {
    const origin = "http://localhost:5173";
    const signup = await createAuth(env).handler(
      new Request(`${origin}/api/auth/sign-up/email`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Utente passkey",
          email: "passkey@example.invalid",
          password: "password-di-prova-lunga",
        }),
      }),
    );
    expect(signup.status).toBe(200);
    const cookie = signup.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
    const user = await env.DB.prepare('SELECT "id" FROM "user" WHERE "email" = ?')
      .bind("passkey@example.invalid")
      .first<{ id: string }>();
    expect(user).not.toBeNull();
    const id = user!.id;
    const options = () =>
      handleAuthRequest(
        new Request(`${origin}/api/auth/passkey/generate-register-options`, {
          headers: { cookie },
        }),
        env,
      );
    expect((await options()).status).toBe(403);
    const trailing = await handleAuthRequest(
      new Request(`${origin}/api/auth/passkey/generate-register-options/`, {
        headers: { cookie },
      }),
      env,
    );
    expect(trailing.status).toBe(404);
    await completeRegistration(env.DB, {
      userId: id,
      language: "it",
      now: new Date(),
      profile: {
        firstName: "Utente",
        lastName: "Passkey",
        accountType: "private",
        companyName: null,
      },
      agreement: { marketing: false },
    });
    expect((await options()).status).toBe(403);
    await env.DB.prepare('UPDATE "user" SET "emailVerified" = 1 WHERE "id" = ?').bind(id).run();
    const response = await options();
    expect(response.status).toBe(200);
    expect((await response.json<{ rp: { id: string } }>()).rp.id).toBe("localhost");

    await env.DB.prepare('DELETE FROM "account" WHERE "userId" = ?').bind(id).run();
    for (const passkeyId of ["first", "second"]) {
      await env.DB.prepare(
        `INSERT INTO "passkey" ("id", "publicKey", "userId", "credentialID", "counter", "deviceType", "backedUp")
         VALUES (?, 'synthetic', ?, ?, 0, 'singleDevice', 0)`,
      )
        .bind(passkeyId, id, passkeyId)
        .run();
    }
    const remove = (passkeyId: string) =>
      signInAction({
        request: new Request(`${origin}/accesso`, {
          method: "POST",
          headers: { cookie, origin, "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ intent: "passkey-remove", id: passkeyId }),
        }),
      } as never);
    expect((await remove("first")).headers.get("location")).toContain("passkey-rimossa");
    expect((await remove("second")).headers.get("location")).toContain("ultimo-accesso");
    await env.DB.prepare(
      `INSERT INTO "account" ("id", "accountId", "providerId", "userId", "password", "createdAt", "updatedAt")
       VALUES ('empty-credential', ?, 'credential', ?, '', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    )
      .bind(id, id)
      .run();
    expect((await remove("second")).headers.get("location")).toContain("ultimo-accesso");
    expect((await remove("foreign-passkey")).headers.get("location")).toContain("ultimo-accesso");
    const remaining = await env.DB.prepare('SELECT "id" FROM "passkey" WHERE "userId" = ?')
      .bind(id)
      .all<{ id: string }>();
    expect(remaining.results.map((row) => row.id)).toEqual(["second"]);
    await env.DB.prepare(
      `INSERT INTO "account" ("id", "accountId", "providerId", "userId", "createdAt", "updatedAt")
       VALUES ('linked-ebay-access', 'synthetic-business-subject', 'ebay', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    )
      .bind(id)
      .run();
    expect((await remove("second")).headers.get("location")).toContain("passkey-rimossa");
    expect(
      await env.DB.prepare('SELECT COUNT(*) AS count FROM "passkey" WHERE "userId" = ?')
        .bind(id)
        .first(),
    ).toEqual({ count: 0 });
    expect(
      (
        await handleAuthRequest(
          new Request(`${origin}/api/auth/passkey/delete-passkey`, { method: "POST" }),
          env,
        )
      ).status,
    ).toBe(404);
  });

  it("recupera l'accesso con una password nuova e revoca le sessioni precedenti", async () => {
    const origin = "http://localhost:5173";
    const auth = createAuth(env);
    const signup = await auth.handler(
      new Request(`${origin}/api/auth/sign-up/email`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Utente recupero",
          email: "recovery@example.invalid",
          password: "password-precedente-lunga",
        }),
      }),
    );
    expect(signup.ok).toBe(true);
    const { user } = await signup.json<{ user: { id: string } }>();
    const cookie = signup.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
    const context = await auth.$context;
    await context.internalAdapter.createVerificationValue({
      identifier: "reset-password:synthetic-recovery-token",
      value: user.id,
      expiresAt: new Date(Date.now() + 60_000),
    });
    const reset = () =>
      signInAction({
        request: new Request(`${origin}/accesso`, {
          method: "POST",
          headers: { cookie, origin, "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            intent: "reimposta-password",
            token: "synthetic-recovery-token",
            password: "password-recuperata-lunga",
          }),
        }),
      } as never);
    expect((await reset()).headers.get("location")).toContain("password-reimpostata");
    expect(await auth.api.getSession({ headers: new Headers({ cookie }) })).toBeNull();
    expect((await reset()).headers.get("location")).toContain("recupero-scaduto");
    const signIn = (password: string) =>
      auth.handler(
        new Request(`${origin}/api/auth/sign-in/email`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: "recovery@example.invalid", password }),
        }),
      );
    expect((await signIn("password-precedente-lunga")).status).toBe(401);
    expect((await signIn("password-recuperata-lunga")).ok).toBe(true);
  });

  it("limita le verifiche WebAuthn e rifiuta origini estranee senza creare identità", async () => {
    const before = await env.DB.prepare('SELECT COUNT(*) AS count FROM "passkey"').first();
    const origin = "https://test.fiscalbay.it";
    const deployed = { ...env, APP_ORIGIN: origin };
    const attempt = (requestOrigin: string) =>
      handleAuthRequest(
        new Request(`${origin}/api/auth/passkey/verify-authentication`, {
          method: "POST",
          headers: {
            origin: requestOrigin,
            "content-type": "application/json",
            "cf-connecting-ip": "203.0.113.45",
            cookie: "origin-probe=synthetic",
          },
          body: JSON.stringify({ response: {} }),
        }),
        deployed,
      );
    expect((await attempt("https://foreign.invalid")).status).toBe(403);
    expect((await attempt(origin)).ok).toBe(false);
    expect((await attempt(origin)).ok).toBe(false);
    const limited = await attempt(origin);
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toMatch(/^\d+$/u);
    expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM "passkey"').first()).toEqual(before);
    const options = await handleAuthRequest(
      new Request(`${origin}/api/auth/passkey/generate-authenticate-options`),
      deployed,
    );
    expect((await options.json<{ rpId: string }>()).rpId).toBe("test.fiscalbay.it");
    const production = await handleAuthRequest(
      new Request("https://fiscalbay.it/api/auth/passkey/generate-authenticate-options"),
      { ...env, APP_ORIGIN: "https://fiscalbay.it" },
    );
    expect((await production.json<{ rpId: string }>()).rpId).toBe("fiscalbay.it");
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
        ]),
      );
    }
  });

  it.each([
    ["individuale", {}, "email_not_found"],
    [
      "business con l'email di un utente esistente",
      { businessAccount: { email: "esistente@example.invalid" } },
      "account_not_linked",
    ],
  ])(
    "rifiuta il login eBay di un account %s senza creare o collegare account",
    async (_account, identity, error) => {
      await env.DB.prepare(
        'INSERT OR IGNORE INTO "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt") VALUES (?, ?, ?, 1, ?, ?)',
      )
        .bind(
          "utente-esistente",
          "Utente esistente",
          "esistente@example.invalid",
          Date.now(),
          Date.now(),
        )
        .run();
      const start = await createAuth(env).handler(
        new Request("http://localhost:5173/api/auth/sign-in/social", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            provider: "ebay",
            callbackURL: "/",
            additionalData: {
              link: { userId: "utente-esistente", email: "esistente@example.invalid" },
            },
          }),
        }),
      );
      const state = new URL((await start.json<{ url: string }>()).url).searchParams.get("state");
      const cookie = start.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .join("; ");
      const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
        const url = input instanceof Request ? input.url : String(input);
        if (url.endsWith("/identity/v1/oauth2/token")) {
          return Response.json({
            access_token: "sintetico",
            token_type: "Bearer",
            expires_in: 7200,
          });
        }
        return Response.json({
          userId: "ebay-utente-sintetico",
          username: "venditore",
          ...identity,
        });
      });

      const response = await handleAuthRequest(
        new Request(`http://localhost:5173/api/auth/callback/ebay?code=synthetic&state=${state}`, {
          headers: { cookie },
        }),
        env,
      );
      fetchMock.mockRestore();

      expect(response.status).toBe(302);
      expect(
        new URL(response.headers.get("location")!, "http://localhost:5173").searchParams.get(
          "error",
        ),
      ).toBe(error);
      const accounts = await env.DB.prepare(
        'SELECT COUNT(*) AS total FROM "account" WHERE "providerId" = ?',
      )
        .bind("ebay")
        .first<{ total: number }>();
      expect(accounts?.total).toBe(0);
      const created = await env.DB.prepare('SELECT COUNT(*) AS total FROM "user" WHERE "name" = ?')
        .bind("venditore")
        .first<{ total: number }>();
      expect(created?.total).toBe(0);
    },
  );

  it("registra un account eBay business nuovo con email non verificata e invia la conferma", async () => {
    const send = vi.fn(async () => ({ messageId: "synthetic" }));
    const environment = { ...env, AUTH_EMAIL: { send } } as Env;
    const start = await createAuth(environment).handler(
      new Request("http://localhost:5173/api/auth/sign-in/social", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider: "ebay", callbackURL: "/" }),
      }),
    );
    const state = new URL((await start.json<{ url: string }>()).url).searchParams.get("state");
    const cookie = start.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.endsWith("/identity/v1/oauth2/token")) {
        return Response.json({ access_token: "sintetico", token_type: "Bearer", expires_in: 7200 });
      }
      return Response.json({
        userId: "ebay-business-sintetico",
        username: "venditore-business",
        businessAccount: { email: "business@example.invalid" },
      });
    });

    const response = await handleAuthRequest(
      new Request(`http://localhost:5173/api/auth/callback/ebay?code=synthetic&state=${state}`, {
        headers: { cookie },
      }),
      environment,
    );
    fetchMock.mockRestore();

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/");
    const user = await env.DB.prepare(
      'SELECT u.email, u."emailVerified", a."accountId" FROM "user" u JOIN "account" a ON a."userId" = u.id WHERE a."providerId" = ?',
    )
      .bind("ebay")
      .first<{ email: string; emailVerified: number; accountId: string }>();
    expect(user).toEqual({
      email: "business@example.invalid",
      emailVerified: 0,
      accountId: "ebay-business-sintetico",
    });
    await vi.waitFor(() => expect(send).toHaveBeenCalledOnce());
    expect(send.mock.calls[0]?.[0]).toMatchObject({ to: "business@example.invalid" });
    const account = await env.DB.prepare('SELECT id FROM "account" WHERE "accountId" = ?')
      .bind("ebay-business-sintetico")
      .first<{ id: string }>();
    const removal = await createAuth(environment).handler(
      new Request("http://localhost:5173/api/auth/unlink-account", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:5173",
          cookie: response.headers
            .getSetCookie()
            .map((value) => value.split(";")[0])
            .join("; "),
        },
        body: JSON.stringify({ accountId: account!.id }),
      }),
    );
    expect(removal.status).toBe(400);
    expect(await removal.json()).toMatchObject({ code: "FAILED_TO_UNLINK_LAST_ACCOUNT" });
  });

  it.each([
    "verificata",
    "non-verificata",
    "revocata",
    "assente",
    "altra",
    "individuale",
    "occupato",
  ])(
    "collega eBay soltanto alla sessione verificata che ha iniziato il consenso: %s",
    async (scenario) => {
      const environment = { ...env, AUTH_EMAIL: { send: vi.fn(async () => ({})) } } as Env;
      const auth = createAuth(environment);
      const post = (path: string, body: Record<string, unknown>, cookie = "") =>
        auth.handler(
          new Request(`http://localhost:5173/api/auth/${path}`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              origin: "http://localhost:5173",
              cookie,
            },
            body: JSON.stringify(body),
          }),
        );
      const cookies = (response: Response) =>
        response.headers
          .getSetCookie()
          .map((value) => value.split(";")[0])
          .join("; ");
      const email = `collegamento-${scenario}@example.invalid`;
      const ebayId = `identita-ebay-${scenario}`;
      if (scenario === "occupato") {
        await env.DB.prepare(
          'INSERT INTO "account" (id, "accountId", "providerId", "userId", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?)',
        )
          .bind("account-occupato", ebayId, "ebay", "utente-esistente", Date.now(), Date.now())
          .run();
      }
      const signup = await post("sign-up/email", {
        name: "Collegamento sintetico",
        email,
        password: "Password-sintetica-123!",
      });
      const { user } = await signup.clone().json<{ user: { id: string } }>();
      const sessionCookie = cookies(signup);
      if (scenario !== "non-verificata") {
        await env.DB.prepare('UPDATE "user" SET "emailVerified" = 1 WHERE id = ?')
          .bind(user.id)
          .run();
      }
      const start = await post(
        "link-social",
        { provider: "ebay", callbackURL: "/?accesso=ebay-collegato" },
        sessionCookie,
      );
      expect(start.status).toBe(200);
      const url = new URL((await start.json<{ url: string }>()).url);
      expect(url.searchParams.get("code_challenge_method")).toBe("S256");
      let callbackSession = sessionCookie;
      if (scenario === "revocata")
        await env.DB.prepare('DELETE FROM "session" WHERE "userId" = ?').bind(user.id).run();
      if (scenario === "assente") callbackSession = "";
      if (scenario === "altra") {
        const other = await post("sign-up/email", {
          name: "Altro",
          email: "altro@example.invalid",
          password: "Password-sintetica-123!",
        });
        callbackSession = cookies(other);
        await env.DB.prepare('UPDATE "user" SET "emailVerified" = 1 WHERE email = ?')
          .bind("altro@example.invalid")
          .run();
      }
      const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
        const target = input instanceof Request ? input.url : String(input);
        if (target.endsWith("/identity/v1/oauth2/token"))
          return Response.json({
            access_token: "access-token-sintetico",
            refresh_token: "refresh-token-sintetico",
            token_type: "Bearer",
            expires_in: 7200,
          });
        return Response.json({
          userId: ebayId,
          username: "venditore",
          ...(scenario === "individuale"
            ? {}
            : { businessAccount: { email: "diversa@example.invalid" } }),
        });
      });
      try {
        const callback = () =>
          handleAuthRequest(
            new Request(
              `http://localhost:5173/api/auth/callback/ebay?code=synthetic&state=${url.searchParams.get("state")}`,
              { headers: { cookie: `${callbackSession}; ${cookies(start)}` } },
            ),
            environment,
          );
        const result = await callback();
        const account = await env.DB.prepare(
          'SELECT * FROM "account" WHERE "providerId" = ? AND "accountId" = ?',
        )
          .bind("ebay", ebayId)
          .first<{
            id: string;
            userId: string;
            accountId: string;
            accessToken: string;
            refreshToken: string;
          }>();
        if (scenario !== "verificata") {
          if (scenario === "occupato") {
            expect(account?.userId).toBe("utente-esistente");
            expect(result.headers.get("location")).toContain(
              "account_already_linked_to_different_user",
            );
            return;
          }
          expect(account).toBeNull();
          expect(result.headers.get("location")).toContain(
            scenario === "individuale" ? "email_not_found" : "unable_to_link_account",
          );
          return;
        }
        expect(result.headers.get("location")).toBe("/?accesso=ebay-collegato");
        expect(account).toMatchObject({ userId: user.id, accountId: ebayId });
        expect(account?.accessToken).not.toBe("access-token-sintetico");
        expect(account?.refreshToken).not.toBe("refresh-token-sintetico");
        const localUser = await env.DB.prepare(
          'SELECT email, "emailVerified" FROM "user" WHERE id = ?',
        )
          .bind(user.id)
          .first();
        expect(localUser).toEqual({ email, emailVerified: 1 });
        expect((await callback()).headers.get("location")).toContain("error=");
        await post("sign-out", {}, sessionCookie);
        const login = await post("sign-in/social", { provider: "ebay", callbackURL: "/" });
        const loginUrl = new URL((await login.json<{ url: string }>()).url);
        const signedIn = await handleAuthRequest(
          new Request(
            `http://localhost:5173/api/auth/callback/ebay?code=synthetic&state=${loginUrl.searchParams.get("state")}`,
            { headers: { cookie: cookies(login) } },
          ),
          environment,
        );
        const current = await auth.api.getSession({
          headers: new Headers({ cookie: cookies(signedIn) }),
        });
        expect(current?.user.id).toBe(user.id);
        expect(await env.DB.prepare("SELECT COUNT(*) AS total FROM ebay_stores").first()).toEqual({
          total: 0,
        });
        await env.DB.prepare('UPDATE "account" SET "accessTokenExpiresAt" = ? WHERE id = ?')
          .bind(Date.now() - 60_000, account!.id)
          .run();
        const refreshed = await auth.api.getAccessToken({
          body: { accountId: account!.id },
          headers: new Headers({ cookie: cookies(signedIn) }),
        });
        expect(refreshed.accessToken).toBe("access-token-sintetico");
        const renewed = await env.DB.prepare(
          'SELECT "accessTokenExpiresAt" AS expiry FROM "account" WHERE id = ?',
        )
          .bind(account!.id)
          .first<{ expiry: string }>();
        expect(new Date(renewed!.expiry).getTime()).toBeGreaterThan(Date.now());
        const unlink = await post("unlink-account", { accountId: account!.id }, cookies(signedIn));
        expect(unlink.status).toBe(200);
        expect(
          await env.DB.prepare('SELECT id FROM "account" WHERE id = ?').bind(account!.id).first(),
        ).toBeNull();
        await post("revoke-sessions", {}, cookies(signedIn));
        expect(
          await auth.api.getSession({ headers: new Headers({ cookie: cookies(signedIn) }) }),
        ).toBeNull();
      } finally {
        fetchMock.mockRestore();
      }
    },
  );
});
