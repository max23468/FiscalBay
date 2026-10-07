import { env } from "cloudflare:workers";
import { getMigrations } from "better-auth/db/migration";
import { describe, expect, it, vi } from "vitest";

import { forwardToAuth, handleAuthRequest } from "../app/auth-route.server";
import { createAuth, createAuthOptions, gmailDomain } from "../app/auth.server";
import { completeRegistration } from "../app/domain/registration.server";
import { adminAccess, recentSignIn } from "../app/domain/sessions.server";
import { loader as adminLoader } from "../app/routes/admin";
import { action as securityRouteAction, loader as securityLoader } from "../app/routes/security";
import { action as signInAction, loader as signInLoader } from "../app/routes/sign-in";
import { action as storeLinkAction, loader as storeLinkLoader } from "../app/routes/store-link";

/** La registrazione non apre la sessione: la apre l'accesso con la password appena scelta. */
async function passwordSession(environment: Env, email: string, password: string) {
  const response = await createAuth(environment).handler(
    new Request("http://localhost:5173/api/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost:5173" },
      body: JSON.stringify({ email, password }),
    }),
  );
  return response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
}

it("non segue redirect esterni nei GET di accesso e collegamento", async () => {
  for (const base of ["", "/en"]) {
    const query = "?token=synthetic&redirectTo=https://example.invalid";
    // L'accesso mostra il modulo per la nuova password, senza seguire il redirect richiesto.
    const access = await signInLoader({
      request: new Request(`http://localhost:5173${base}/accesso${query}`),
    } as never);
    expect(access).toMatchObject({ authenticated: false, resetToken: "synthetic" });
    const response = (await storeLinkLoader({
      request: new Request(`http://localhost:5173${base}/app/negozi/collega${query}`),
    } as never)) as Response;
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(`${base}/accesso`);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.getSetCookie()).toEqual([]);
  }
});

it("conserva il rifiuto POST da origine estranea e del collegamento senza sessione in entrambe le lingue", async () => {
  for (const base of ["", "/en"]) {
    for (const [path, action] of [
      ["/accesso", signInAction],
      ["/app/negozi/collega", storeLinkAction],
    ] as const) {
      const response = await action({
        request: new Request(`http://localhost:5173${base}${path}`, {
          method: "POST",
          headers: { origin: "https://example.invalid" },
        }),
      } as never);
      expect(response.status).toBe(403);
    }
    const response = await storeLinkAction({
      request: new Request(`http://localhost:5173${base}/app/negozi/collega`, {
        method: "POST",
        headers: { origin: "http://localhost:5173" },
      }),
    } as never);
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(`${base}/app/ordini?negozio=accesso`);
  }
});

it("mantiene lo schema D1 allineato ai quattro metodi Auth", async () => {
  const migration = await getMigrations(createAuthOptions(env));
  expect(migration.toBeCreated).toEqual([]);
  expect(migration.toBeAdded).toEqual([]);
  expect(migration.toBeAddedIndexes).toEqual([]);
  expect(migration.schemaProblems).toEqual([]);
  expect(migration.unsafeChanges).toEqual([]);
});

describe("Better Auth su Workers e D1", () => {
  it("non accoda le query D1 dietro una richiesta rimasta sospesa", async () => {
    // Una richiesta annullata dal browser lascia la sua query D1 senza risposta: con l'istanza
    // condivisa dall'isolate, le richieste successive non devono restare in attesa dietro di lei.
    let stalled = false;
    const database = new Proxy(env.DB, {
      get(target, key) {
        const value = Reflect.get(target, key) as unknown;
        if (key !== "prepare") return typeof value === "function" ? value.bind(target) : value;
        return (query: string) => {
          if (stalled) return target.prepare(query);
          stalled = true;
          return { bind: () => ({ all: () => new Promise(() => {}) }) };
        };
      },
    });
    const context = await createAuth({ ...env, DB: database } as Env).$context;
    void context.internalAdapter.findUserByEmail("sospesa@example.invalid");
    const second = context.internalAdapter.findUserByEmail("successiva@example.invalid");
    const timeout = new Promise((resolve) => setTimeout(resolve, 2_000, "in attesa"));
    expect(await Promise.race([second, timeout])).toBeNull();
  });

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
    const cookie = await passwordSession(env, "passkey@example.invalid", "password-di-prova-lunga");
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
    const verify = await handleAuthRequest(
      new Request(`${origin}/api/auth/passkey/verify-registration`, {
        method: "POST",
        headers: { cookie, origin, "content-type": "application/json" },
        body: JSON.stringify({ response: {} }),
      }),
      env,
    );
    expect(verify.status).toBe(403);
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
      securityRouteAction({
        request: new Request(`${origin}/app/impostazioni/sicurezza`, {
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
    await env.DB.prepare('DELETE FROM "user" WHERE "id" = ?').bind(id).run();
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
    const cookie = await passwordSession(
      env,
      "recovery@example.invalid",
      "password-precedente-lunga",
    );
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

  it("chiude il login eBay senza account se Identity non risponde o risponde fuori schema", async () => {
    const ebayAccounts = () =>
      env.DB.prepare('SELECT COUNT(*) AS total FROM "account" WHERE "providerId" = ?')
        .bind("ebay")
        .first<{ total: number }>();
    const before = await ebayAccounts();
    for (const identity of [
      () => new Response(null, { status: 503 }),
      () => Response.json({ username: "senza-identificativo" }),
    ]) {
      const start = await createAuth(env).handler(
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
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
        const url = input instanceof Request ? input.url : String(input);
        if (url.endsWith("/identity/v1/oauth2/token")) {
          return Response.json({
            access_token: "sintetico",
            token_type: "Bearer",
            expires_in: 7200,
          });
        }
        return identity();
      });
      try {
        const response = await handleAuthRequest(
          new Request(
            `http://localhost:5173/api/auth/callback/ebay?code=synthetic&state=${state}`,
            {
              headers: { cookie },
            },
          ),
          env,
        );
        expect(new URL(response.headers.get("location")!, "http://localhost:5173").pathname).toBe(
          "/auth/error",
        );
        expect(log.mock.calls.map(([line]) => JSON.parse(String(line)))).toContainEqual(
          expect.objectContaining({ operation: "sign_in", code: "UPSTREAM_UNAVAILABLE" }),
        );
      } finally {
        fetchMock.mockRestore();
        log.mockRestore();
      }
    }
    expect(await ebayAccounts()).toEqual(before);
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
      const sessionCookie = await passwordSession(env, email, "Password-sintetica-123!");
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
        expect(other.ok).toBe(true);
        callbackSession = await passwordSession(
          env,
          "altro@example.invalid",
          "Password-sintetica-123!",
        );
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
        // eBay si aggiunge alla password: il titolare ne riceve avviso.
        await vi.waitFor(() =>
          expect(environment.AUTH_EMAIL.send).toHaveBeenCalledWith(
            expect.objectContaining({
              to: email,
              subject: "Nuovo metodo di accesso su FiscalBay",
              text: expect.stringContaining("eBay"),
            }),
          ),
        );
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

describe("Collegamento e modifica dell'identità", () => {
  const origin = "http://localhost:5173";
  const cookies = (response: Response) =>
    response.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
  const withEmail = (send = vi.fn(async () => ({}))) =>
    ({ ...env, AUTH_EMAIL: { send } }) as unknown as Env;
  const post = (environment: Env, path: string, body: Record<string, unknown>, cookie = "") =>
    createAuth(environment).handler(
      new Request(`${origin}/api/auth/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", origin, cookie },
        body: JSON.stringify(body),
      }),
    );
  const appAction = (cookie: string, fields: Record<string, string>) =>
    signInAction({
      request: new Request(`${origin}/accesso`, {
        method: "POST",
        headers: { cookie, origin, "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(fields),
      }),
    } as never);
  /** Azione della pagina Sicurezza; chi non può vederla riceve il redirect lanciato. */
  const securityAction = (cookie: string, fields: Record<string, string>) =>
    securityRouteAction({
      request: new Request(`${origin}/app/impostazioni/sicurezza`, {
        method: "POST",
        headers: { cookie, origin, "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(fields),
      }),
    } as never).catch((thrown: unknown) => {
      if (thrown instanceof Response) return thrown;
      throw thrown;
    });
  const signUp = async (environment: Env, email: string, verified: boolean) => {
    const response = await post(environment, "sign-up/email", {
      name: "Identità sintetica",
      email,
      password: "Password-sintetica-123!",
    });
    const { user } = await response.clone().json<{ user: { id: string } }>();
    if (verified) {
      await env.DB.prepare('UPDATE "user" SET "emailVerified" = 1 WHERE id = ?')
        .bind(user.id)
        .run();
      await completeRegistration(env.DB, {
        userId: user.id,
        language: "it",
        now: new Date(),
        profile: {
          firstName: "Identità",
          lastName: "Sintetica",
          accountType: "private",
          companyName: null,
        },
        agreement: { marketing: false },
      });
    }
    return {
      id: user.id,
      cookie: await passwordSession(environment, email, "Password-sintetica-123!"),
    };
  };
  const googleAccounts = (userId: string) =>
    env.DB.prepare('SELECT "accountId" FROM "account" WHERE "providerId" = ? AND "userId" = ?')
      .bind("google", userId)
      .all<{ accountId: string }>()
      .then((rows) => rows.results.map((row) => row.accountId));

  /** Completa un consenso Google con il profilo indicato, come lo firmerebbe Google. */
  async function googleCallback(
    environment: Env,
    start: Response,
    profile: { sub: string; email: string; email_verified: boolean; hd?: string },
    cookie = "",
  ) {
    const state = new URL((await start.json<{ url: string }>()).url).searchParams.get("state");
    const segment = (value: object) => btoa(JSON.stringify(value)).replace(/=+$/u, "");
    const idToken = `${segment({ alg: "none" })}.${segment({
      aud: "google-test-client",
      name: "Titolare sintetico",
      ...profile,
    })}.`;
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () =>
        Response.json({ access_token: "sintetico", id_token: idToken, token_type: "Bearer" }),
      );
    try {
      return await handleAuthRequest(
        new Request(`${origin}/api/auth/callback/google?code=synthetic&state=${state}`, {
          headers: { cookie: [cookie, cookies(start)].filter(Boolean).join("; ") },
        }),
        environment,
      );
    } finally {
      fetchMock.mockRestore();
    }
  }

  it("non lascia un metodo proprio a chi registra in anticipo l'email di un altro", async () => {
    const environment = withEmail();
    const email = `titolare.anticipato@${gmailDomain}`;
    const squatter = await signUp(environment, email, false);

    // Il titolare entra con Google: l'utente locale non verificato non viene collegato.
    const owner = await googleCallback(
      environment,
      await post(environment, "sign-in/social", { provider: "google", callbackURL: "/" }),
      { sub: "google-titolare", email, email_verified: true },
    );
    expect(owner.headers.get("location")).toContain("account_not_linked");

    // Chi ha creato l'account non può collegare un proprio Google né dall'app né dalla route.
    const fromApp = await securityAction(squatter.cookie, {
      intent: "collega-metodo",
      metodo: "google",
    });
    expect(fromApp.headers.get("location")).toBe("/app/ordini");
    const direct = await googleCallback(
      environment,
      await post(
        environment,
        "link-social",
        { provider: "google", callbackURL: "/" },
        squatter.cookie,
      ),
      { sub: "google-anticipato", email: `altro.anticipato@${gmailDomain}`, email_verified: true },
      squatter.cookie,
    );
    expect(direct.headers.get("location")).toContain("unable_to_link_account");
    // Il router chiude anche l'avvio del collegamento e il ramo con idToken, che salterebbe i
    // controlli del callback, e rifiuta un corpo non valido senza errore del server.
    const linkRoute = (cookie: string, body: string) =>
      handleAuthRequest(
        new Request(`${origin}/api/auth/link-social`, {
          method: "POST",
          headers: { "content-type": "application/json", origin, cookie },
          body,
        }),
        environment,
      );
    const idToken = JSON.stringify({ provider: "google", idToken: { token: "sintetico" } });
    expect((await linkRoute("", idToken)).status).toBe(401);
    expect((await linkRoute(squatter.cookie, idToken)).status).toBe(403);
    await env.DB.prepare('UPDATE "user" SET "emailVerified" = 1 WHERE id = ?')
      .bind(squatter.id)
      .run();
    expect((await linkRoute(squatter.cookie, idToken)).status).toBe(400);
    expect((await linkRoute(squatter.cookie, "1")).status).toBe(400);
    expect((await linkRoute(squatter.cookie, "null")).status).toBe(400);
    expect((await linkRoute(squatter.cookie, "{")).status).toBe(400);
    expect((await linkRoute(squatter.cookie, JSON.stringify({ provider: "google" }))).status).toBe(
      200,
    );
    expect(await googleAccounts(squatter.id)).toEqual([]);
    expect(
      await env.DB.prepare('SELECT COUNT(*) AS total FROM "user" WHERE email = ?')
        .bind(email)
        .first(),
    ).toEqual({ total: 1 });
  });

  it.each([
    ["Gmail", `gmail@${gmailDomain}`, true, undefined, true],
    ["Workspace", "persona@azienda.invalid", true, "azienda.invalid", true],
    ["dominio senza hd", "persona@dominio.invalid", true, undefined, false],
    ["email non verificata", `nonverificata@${gmailDomain}`, false, undefined, false],
  ] as const)(
    "collega Google per email solo se è autorevole: %s",
    async (_case, email, emailVerified, hd, linked) => {
      const environment = withEmail();
      const user = await signUp(environment, email, true);
      const result = await googleCallback(
        environment,
        await post(environment, "sign-in/social", { provider: "google", callbackURL: "/" }),
        { sub: `google-${email}`, email, email_verified: emailVerified, hd },
      );
      if (linked) {
        expect(result.headers.get("location")).toBe("/");
        expect(await googleAccounts(user.id)).toEqual([`google-${email}`]);
      } else {
        expect(result.headers.get("location")).toContain("account_not_linked");
        expect(await googleAccounts(user.id)).toEqual([]);
      }
    },
  );

  it("chiede la propria conferma a un nuovo utente Google non autorevole", async () => {
    const send = vi.fn(async () => ({}));
    const environment = withEmail(send);
    const email = "nuovo@dominio-personale.invalid";
    await googleCallback(
      environment,
      await post(environment, "sign-in/social", { provider: "google", callbackURL: "/" }),
      { sub: "google-nuovo-personale", email, email_verified: true },
    );
    expect(
      await env.DB.prepare('SELECT "emailVerified" FROM "user" WHERE email = ?')
        .bind(email)
        .first(),
    ).toEqual({ emailVerified: 0 });
    await vi.waitFor(() => expect(send).toHaveBeenCalledOnce());
    expect(send.mock.calls[0]?.[0]).toMatchObject({ to: email });
    // Il primo metodo di un nuovo utente non è un collegamento da segnalare.
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(send).toHaveBeenCalledOnce();
  });

  it("riconosce Google dal subject anche con email cambiata, senza fondere utenti", async () => {
    const send = vi.fn(async () => ({}));
    const environment = withEmail(send);
    const first = await signUp(environment, `prima.identita@${gmailDomain}`, true);
    const second = await signUp(environment, `seconda.identita@${gmailDomain}`, true);
    // Collegamento esplicito da Sicurezza, anche con un'email diversa da quella dell'account.
    const linked = await googleCallback(
      environment,
      await post(
        environment,
        "link-social",
        { provider: "google", callbackURL: "/" },
        first.cookie,
      ),
      { sub: "google-stabile", email: "google.personale@dominio.invalid", email_verified: true },
      first.cookie,
    );
    expect(linked.headers.get("location")).toBe("/");
    expect(await googleAccounts(first.id)).toEqual(["google-stabile"]);
    // Il titolare di un account che aveva già un accesso riceve avviso del nuovo metodo.
    await vi.waitFor(() =>
      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: `prima.identita@${gmailDomain}`,
          subject: "Nuovo metodo di accesso su FiscalBay",
        }),
      ),
    );

    // Su Google l'indirizzo diventa quello del secondo utente: conta il subject.
    const signedIn = await googleCallback(
      environment,
      await post(environment, "sign-in/social", { provider: "google", callbackURL: "/" }),
      { sub: "google-stabile", email: `seconda.identita@${gmailDomain}`, email_verified: true },
    );
    const session = await createAuth(environment).api.getSession({
      headers: new Headers({ cookie: cookies(signedIn) }),
    });
    expect(session?.user.id).toBe(first.id);
    expect(session?.user.email).toBe(`prima.identita@${gmailDomain}`);
    expect(await googleAccounts(second.id)).toEqual([]);

    // Lo stesso Google non si collega a un secondo utente.
    const taken = await googleCallback(
      environment,
      await post(
        environment,
        "link-social",
        { provider: "google", callbackURL: "/" },
        second.cookie,
      ),
      { sub: "google-stabile", email: `seconda.identita@${gmailDomain}`, email_verified: true },
      second.cookie,
    );
    expect(taken.headers.get("location")).toContain("account_already_linked_to_different_user");
    expect(await googleAccounts(first.id)).toEqual(["google-stabile"]);
  });

  it("rimuove un metodo solo se ne resta un altro, anche con richieste concorrenti", async () => {
    const environment = withEmail();
    const user = await signUp(environment, "metodi.concorrenti@example.invalid", true);
    const now = Date.now();
    await env.DB.batch(
      ["google", "ebay"].map((provider) =>
        env.DB.prepare(
          'INSERT INTO "account" (id, "accountId", "providerId", "userId", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?)',
        ).bind(`metodo-${provider}`, `soggetto-${provider}`, provider, user.id, now, now),
      ),
    );
    const remove = (metodo: string) =>
      securityAction(user.cookie, { intent: "rimuovi-metodo", metodo }).then((response) =>
        new URL(response.headers.get("location")!, origin).searchParams.get("accesso"),
      );
    expect(await remove("password")).toBe("metodo-rimosso");
    expect(await remove("sconosciuto")).toBe("errore");

    const outcomes = await Promise.all([remove("google"), remove("ebay")]);
    expect(outcomes.filter((outcome) => outcome === "ultimo-metodo")).toHaveLength(1);
    const remaining = await env.DB.prepare('SELECT "providerId" FROM "account" WHERE "userId" = ?')
      .bind(user.id)
      .all();
    expect(remaining.results).toHaveLength(1);

    // Una passkey è un accesso valido: dopo averla aggiunta l'ultimo account si può rimuovere.
    await env.DB.prepare(
      `INSERT INTO "passkey" ("id", "publicKey", "userId", "credentialID", "counter", "deviceType", "backedUp")
       VALUES ('passkey-metodi', 'synthetic', ?, 'passkey-metodi', 0, 'singleDevice', 0)`,
    )
      .bind(user.id)
      .run();
    const [{ providerId }] = remaining.results as Array<{ providerId: "google" | "ebay" }>;
    expect(await remove(providerId)).toBe(
      providerId === "ebay" ? "ebay-rimosso" : "metodo-rimosso",
    );
    expect(
      (
        await securityAction(user.cookie, { intent: "passkey-remove", id: "passkey-metodi" })
      ).headers.get("location"),
    ).toContain("ultimo-accesso");

    // Una sessione vecchia deve accedere di nuovo; la route diretta di Better Auth è chiusa.
    await env.DB.prepare('UPDATE "session" SET "createdAt" = ? WHERE "userId" = ?')
      .bind(now - 2 * 86_400_000, user.id)
      .run();
    expect(await remove("google")).toBe("nuovo-accesso");
    const direct = await handleAuthRequest(
      new Request(`${origin}/api/auth/unlink-account`, {
        method: "POST",
        headers: { "content-type": "application/json", origin, cookie: user.cookie },
        body: JSON.stringify({ accountId: "metodo-google" }),
      }),
      environment,
    );
    expect(direct.status).toBe(404);
  });

  it("imposta di nuovo la password con un link al proprio indirizzo", async () => {
    const send = vi.spyOn(env.AUTH_EMAIL, "send").mockResolvedValue({ messageId: "synthetic" });
    try {
      const email = "password.nuova@example.invalid";
      const user = await signUp(env, email, true);
      await vi.waitFor(() => expect(send).toHaveBeenCalledOnce());
      send.mockClear();
      await env.DB.prepare(
        `INSERT INTO "passkey" ("id", "publicKey", "userId", "credentialID", "counter", "deviceType", "backedUp")
         VALUES ('passkey-password', 'synthetic', ?, 'passkey-password', 0, 'singleDevice', 0)`,
      )
        .bind(user.id)
        .run();
      const outcome = (fields: Record<string, string>, action = appAction) =>
        action(user.cookie, fields).then((response) => response.headers.get("location"));
      expect(
        await outcome({ intent: "rimuovi-metodo", metodo: "password" }, securityAction),
      ).toContain("metodo-rimosso");
      // Il titolare riceve avviso della rimozione, con il collegamento a Sicurezza.
      await vi.waitFor(() => expect(send).toHaveBeenCalledOnce());
      expect(send.mock.calls[0]![0]).toMatchObject({
        to: email,
        subject: "Metodo di accesso rimosso da FiscalBay",
        text: expect.stringContaining("/app/impostazioni/sicurezza"),
      });
      send.mockClear();
      expect(await outcome({ intent: "password" }, securityAction)).toContain("password-link");
      await vi.waitFor(() => expect(send).toHaveBeenCalledOnce());
      const message = send.mock.calls[0]![0] as { to: string; text: string };
      expect(message.to).toBe(email);
      const token = new URL(message.text.split("\n").at(-1)!).pathname.split("/").at(-1)!;
      expect(
        await outcome({ intent: "reimposta-password", token, password: "Password-reimpostata-1" }),
      ).toContain("password-reimpostata");
      await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(2));
      expect(send.mock.calls[1]![0]).toMatchObject({
        to: email,
        subject: "La password di FiscalBay è stata reimpostata",
      });
      // La password creata dal link ha già il suo avviso, non quello di un nuovo metodo.
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(send).toHaveBeenCalledTimes(2);
      const signIn = await post(env, "sign-in/email", {
        email,
        password: "Password-reimpostata-1",
      });
      expect(signIn.ok).toBe(true);
    } finally {
      send.mockRestore();
    }
  });

  it("cambia l'email con la conferma del vecchio e del nuovo indirizzo", async () => {
    // Le azioni dell'app usano il binding email dell'ambiente del Worker.
    const send = vi.spyOn(env.AUTH_EMAIL, "send").mockResolvedValue({ messageId: "synthetic" });
    const environment = env;
    const user = await signUp(environment, "email.precedente@example.invalid", true);
    await signUp(environment, "email.occupata@example.invalid", true);
    send.mockClear();
    const request = (email: string) =>
      securityAction(user.cookie, { intent: "cambia-email", email }).then((response) =>
        response.headers.get("location"),
      );
    const link = (index: number) =>
      (send.mock.calls[index]![0] as { text: string }).text.split("\n").at(-1)!;
    const follow = (url: string) =>
      handleAuthRequest(new Request(url, { headers: { cookie: user.cookie } }), environment);
    const stored = () =>
      env.DB.prepare('SELECT email, "emailVerified" FROM "user" WHERE id = ?')
        .bind(user.id)
        .first();

    // Un indirizzo già registrato ha la stessa risposta ma nessuna email e nessun cambio.
    expect(await request("email.occupata@example.invalid")).toContain("email-richiesta");
    expect(await request("non-valida")).toContain("email-non-valida");
    expect(send).not.toHaveBeenCalled();

    expect(await request("email.nuova@example.invalid")).toContain("email-richiesta");
    await vi.waitFor(() => expect(send).toHaveBeenCalledOnce());
    expect(send.mock.calls[0]![0]).toMatchObject({ to: "email.precedente@example.invalid" });
    expect(await stored()).toEqual({ email: "email.precedente@example.invalid", emailVerified: 1 });

    expect((await follow(link(0))).headers.get("location")).toContain("email-confermata");
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(2));
    expect(send.mock.calls[1]![0]).toMatchObject({ to: "email.nuova@example.invalid" });
    expect(await stored()).toEqual({ email: "email.precedente@example.invalid", emailVerified: 1 });

    await follow(link(1));
    // Stesso utente, quindi stessi spazi, negozi e piani: cambia soltanto l'indirizzo.
    expect(await stored()).toEqual({ email: "email.nuova@example.invalid", emailVerified: 1 });
    send.mockRestore();
  });
});

describe("Sessioni, revoche e area admin", () => {
  it("considera recente un accesso sotto le 24 ore e la conferma admin sotto le 12", () => {
    const at = new Date("2026-10-01T12:00:00.000Z");
    const session = (hours: number) => ({
      session: {
        id: "s",
        createdAt: new Date(at.getTime() - hours * 3_600_000),
        passkeyVerified: true,
      },
      user: { id: "u", admin: true },
    });
    const justUnder = (hours: number) => session(hours - 1 / 3_600_000);
    expect(recentSignIn(justUnder(24), at)).toBe(true);
    expect(recentSignIn(session(24), at)).toBe(false);
    expect(adminAccess(justUnder(12), at)).toBe("granted");
    expect(adminAccess(session(12), at)).toBe("verify");
  });

  const origin = "http://localhost:5173";
  const cookies = (response: Response) =>
    response.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
  const jsonRequest = (path: string, cookie: string, body?: unknown) =>
    handleAuthRequest(
      new Request(`${origin}/api/auth/${path}`, {
        method: body === undefined ? "GET" : "POST",
        headers: { "content-type": "application/json", origin, cookie, "user-agent": userAgent },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
      env,
    );
  const userAgent =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Safari/605.1.15";
  const form = (path: string, cookie: string, fields: Record<string, string>) =>
    new Request(`${origin}${path}`, {
      method: "POST",
      headers: { cookie, origin, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(fields),
    });
  const securityAction = (cookie: string, fields: Record<string, string>) =>
    securityRouteAction({ request: form("/app/impostazioni/sicurezza", cookie, fields) } as never)
      .catch((thrown: unknown) => {
        if (thrown instanceof Response) return thrown;
        throw thrown;
      })
      .then((response) => response.headers.get("location"));
  const home = (cookie: string) =>
    signInLoader({ request: new Request(`${origin}/accesso`, { headers: { cookie } }) } as never);
  /** Pagina Sicurezza; chi non può vederla torna all'accesso con l'esito ricevuto. */
  const security = async (cookie: string, path = "/app/impostazioni/sicurezza") => {
    try {
      return await securityLoader({
        request: new Request(`${origin}${path}`, { headers: { cookie } }),
      } as never);
    } catch (thrown) {
      if (thrown instanceof Response) return thrown.headers.get("location");
      throw thrown;
    }
  };
  /** Esito del loader admin: 404 per chi non è admin, altrimenti il livello di accesso. */
  const admin = async (cookie: string) => {
    try {
      const result = await adminLoader({
        request: new Request(`${origin}/admin`, { headers: { cookie } }),
      } as never);
      return result.access;
    } catch (error) {
      return (error as { init?: { status?: number } }).init?.status;
    }
  };
  const signIn = async (email: string) =>
    cookies(await jsonRequest("sign-in/email", "", { email, password: "Password-sintetica-123!" }));
  const createUser = async (email: string) => {
    const response = await jsonRequest("sign-up/email", "", {
      name: "Sessioni sintetiche",
      email,
      password: "Password-sintetica-123!",
    });
    const { user } = await response.json<{ user: { id: string } }>();
    await env.DB.prepare('UPDATE "user" SET "emailVerified" = 1 WHERE id = ?').bind(user.id).run();
    await completeRegistration(env.DB, {
      userId: user.id,
      language: "it",
      now: new Date(),
      profile: {
        firstName: "Utente",
        lastName: "Sessioni",
        accountType: "private",
        companyName: null,
      },
      agreement: { marketing: false },
    });
    return { id: user.id, cookie: await signIn(email) };
  };
  const sessionId = async (cookie: string) =>
    (
      await jsonRequest("get-session", cookie).then((response) =>
        response.json<{ session: { id: string } } | null>(),
      )
    )?.session.id;
  /** Sposta indietro la creazione della sessione, come se l'accesso fosse più vecchio. */
  const age = async (cookie: string, hours: number) => {
    const id = await sessionId(cookie);
    const row = await env.DB.prepare('SELECT "createdAt" FROM "session" WHERE id = ?')
      .bind(id)
      .first<{ createdAt: string | number }>();
    const past = new Date(new Date(row!.createdAt).getTime() - hours * 3_600_000);
    await env.DB.prepare('UPDATE "session" SET "createdAt" = ? WHERE id = ?')
      .bind(typeof row!.createdAt === "number" ? past.getTime() : past.toISOString(), id)
      .run();
  };

  /** Prove con un cookie già revocato: nessuna operazione protetta deve riuscire. */
  async function expectRevoked(cookie: string) {
    expect(await jsonRequest("get-session", cookie).then((response) => response.json())).toBeNull();
    expect((await home(cookie)).authenticated).toBe(false);
    expect(await security(cookie, "/en/app/impostazioni/sicurezza?accesso=sessione-chiusa")).toBe(
      "/en/accesso?accesso=sessione-chiusa",
    );
    expect(
      await securityAction(cookie, { intent: "cambia-email", email: "x@example.invalid" }),
    ).toBe("/accesso");
    expect(await securityAction(cookie, { intent: "esci-altri" })).toBe("/accesso");
    const link = await storeLinkAction({
      request: form("/app/negozi/collega", cookie, {}),
    } as never);
    expect(link.headers.get("location")).toContain("negozio=accesso");
    expect((await jsonRequest("passkey/generate-register-options", cookie)).status).toBe(401);
    expect(await admin(cookie)).toBe(404);
  }

  it("inoltra a Better Auth lo user agent dei moduli e nessun header assente", async () => {
    await createUser("inoltro@example.invalid");
    const signIn = (headers: Record<string, string>) =>
      forwardToAuth(
        env,
        new Request(`${origin}/accesso`, { method: "POST", headers }),
        "/sign-in/email",
        {
          email: "inoltro@example.invalid",
          password: "Password-sintetica-123!",
        },
      );
    const agentOf = async (response: Response) => {
      const token = decodeURIComponent(cookies(response).split("=")[1]!).split(".")[0];
      return (
        await env.DB.prepare('SELECT "userAgent" FROM "session" WHERE "token" = ?')
          .bind(token)
          .first<{ userAgent: string | null }>()
      )?.userAgent;
    };
    expect(await agentOf(await signIn({ origin, "user-agent": userAgent }))).toBe(userAgent);
    expect(await agentOf(await signIn({ origin }))).toBeFalsy();
  });

  it("elenca le sessioni senza token e chiude una sessione o tutte le altre", async () => {
    const user = await createUser("sessioni@example.invalid");
    const second = await signIn("sessioni@example.invalid");
    const third = await signIn("sessioni@example.invalid");
    const other = await createUser("sessioni.altro@example.invalid");

    const loaded = await security(user.cookie);
    if (typeof loaded === "string" || !loaded) throw new Error("sessione attesa");
    expect(loaded.sessions).toHaveLength(3);
    expect(loaded.sessions.filter((session) => session.current)).toEqual([
      expect.objectContaining({ id: await sessionId(user.cookie), device: "Safari su macOS" }),
    ]);
    expect(JSON.stringify(loaded)).not.toMatch(/token/iu);
    // L'elenco di Better Auth restituirebbe i token delle altre sessioni: non è esposto.
    expect((await jsonRequest("list-sessions", user.cookie)).status).toBe(404);
    expect(
      (await jsonRequest("update-session", user.cookie, { passkeyVerified: true })).status,
    ).toBe(404);

    // Un id di un altro utente non chiude nulla.
    expect(
      await securityAction(other.cookie, {
        intent: "esci-sessione",
        id: (await sessionId(second))!,
      }),
    ).toContain("sessione-chiusa");
    expect(await sessionId(second)).toBeDefined();

    expect(
      await securityAction(user.cookie, {
        intent: "esci-sessione",
        id: (await sessionId(second))!,
      }),
    ).toContain("sessione-chiusa");
    await expectRevoked(second);
    expect(await sessionId(third)).toBeDefined();

    // Le azioni di Sicurezza tornano alla sua pagina.
    expect(await securityAction(user.cookie, { intent: "esci-altri" })).toBe(
      "/app/impostazioni/sicurezza?accesso=sessioni-chiuse",
    );
    await expectRevoked(third);
    expect(await sessionId(user.cookie)).toBeDefined();
    expect(await sessionId(other.cookie)).toBeDefined();

    // Chiudere la sessione corrente dall'elenco equivale al logout.
    expect(
      await securityAction(user.cookie, {
        intent: "esci-sessione",
        id: (await sessionId(user.cookie))!,
      }),
    ).toBe("/");
    await expectRevoked(user.cookie);
  });

  it("chiede un accesso recente per le modifiche critiche", async () => {
    const user = await createUser("recente@example.invalid");
    await age(user.cookie, 25);
    for (const fields of [
      { intent: "cambia-email", email: "recente.nuova@example.invalid" },
      { intent: "collega-metodo", metodo: "google" },
      { intent: "rimuovi-metodo", metodo: "password" },
      { intent: "passkey-remove", id: "qualsiasi" },
    ]) {
      expect(await securityAction(user.cookie, fields)).toContain("nuovo-accesso");
    }
    expect((await jsonRequest("passkey/generate-register-options", user.cookie)).status).toBe(403);
    // Le altre route non chiedono un accesso recente.
    expect((await jsonRequest("get-session", user.cookie)).status).toBe(200);
    expect(await security(user.cookie)).toMatchObject({
      recent: false,
      passkeyRestriction: "nuovo-accesso",
      passkeyBlock: "nuovo-accesso",
    });
    // Le stesse modifiche chiamate direttamente sulle route Auth seguono la stessa regola.
    expect(
      (
        await jsonRequest("change-email", user.cookie, {
          newEmail: "recente.diretta@example.invalid",
        })
      ).status,
    ).toBe(403);
    expect(
      (await jsonRequest("link-social", user.cookie, { provider: "google", callbackURL: "/" }))
        .status,
    ).toBe(403);
    // Chiudere le sessioni resta possibile anche con un accesso non recente.
    expect(await securityAction(user.cookie, { intent: "esci-altri" })).toContain(
      "sessioni-chiuse",
    );
    expect(
      await env.DB.prepare('SELECT email FROM "user" WHERE id = ?').bind(user.id).first(),
    ).toEqual({ email: "recente@example.invalid" });
  });

  it("concede l'admin solo dal database e lo revoca subito", async () => {
    const user = await createUser("admin.db@example.invalid");
    expect(await admin(user.cookie)).toBe(404);
    // Il campo non si imposta da registrazione o modifica del profilo.
    await jsonRequest("update-user", user.cookie, { admin: true });
    const created = await jsonRequest("sign-up/email", "", {
      name: "Admin sintetico",
      email: "admin.registrato@example.invalid",
      password: "Password-sintetica-123!",
      admin: true,
    });
    expect(
      await env.DB.prepare('SELECT email, "admin" FROM "user" WHERE email IN (?, ?) ORDER BY email')
        .bind("admin.db@example.invalid", "admin.registrato@example.invalid")
        .all()
        .then((rows) => rows.results),
    ).toEqual(
      created.ok
        ? [
            { email: "admin.db@example.invalid", admin: 0 },
            { email: "admin.registrato@example.invalid", admin: 0 },
          ]
        : [{ email: "admin.db@example.invalid", admin: 0 }],
    );
    expect(await admin(user.cookie)).toBe(404);

    await env.DB.prepare('UPDATE "user" SET "admin" = 1 WHERE id = ?').bind(user.id).run();
    // Password, anche appena inserita, non basta: serve la conferma con passkey.
    expect(await admin(user.cookie)).toBe("verify");
    expect((await jsonRequest("passkey/generate-register-options", user.cookie)).status).toBe(403);
    // La home indica il passaggio giusto: accedere con passkey, non un accesso qualsiasi.
    expect(await security(user.cookie)).toMatchObject({
      recent: true,
      passkeyRestriction: "conferma-passkey",
      passkeyBlock: "conferma-passkey",
    });
    await env.DB.prepare('UPDATE "user" SET "admin" = 0 WHERE id = ?').bind(user.id).run();
    expect(await admin(user.cookie)).toBe(404);
  });

  /** Autenticatore sintetico P-256 che firma asserzioni WebAuthn come un dispositivo reale. */
  async function syntheticPasskey(userId: string) {
    const keys = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
      "sign",
      "verify",
    ]);
    const jwk = await crypto.subtle.exportKey("jwk", keys.publicKey);
    const fromB64url = (value: string) =>
      Uint8Array.from(atob(value.replaceAll("-", "+").replaceAll("_", "/")), (c) =>
        c.charCodeAt(0),
      );
    const b64url = (bytes: Uint8Array) =>
      btoa(String.fromCharCode(...bytes))
        .replaceAll("+", "-")
        .replaceAll("/", "_")
        .replace(/=+$/u, "");
    // Chiave COSE EC2: {1: 2, 3: -7, -1: 1, -2: x, -3: y} in CBOR.
    const cose = new Uint8Array([
      0xa5,
      0x01,
      0x02,
      0x03,
      0x26,
      0x20,
      0x01,
      0x21,
      0x58,
      0x20,
      ...fromB64url(jwk.x!),
      0x22,
      0x58,
      0x20,
      ...fromB64url(jwk.y!),
    ]);
    const credentialId = b64url(crypto.getRandomValues(new Uint8Array(16)));
    await env.DB.prepare(
      `INSERT INTO "passkey" ("id", "publicKey", "userId", "credentialID", "counter", "deviceType", "backedUp")
       VALUES (?, ?, ?, ?, 0, 'multiDevice', 1)`,
    )
      .bind(crypto.randomUUID(), btoa(String.fromCharCode(...cose)), userId, credentialId)
      .run();

    /** Accede con la passkey; `userVerified` indica se il dispositivo ha verificato l'utente. */
    return async (userVerified: boolean, cookie = "") => {
      const options = await jsonRequest("passkey/generate-authenticate-options", cookie);
      const { challenge } = await options.clone().json<{ challenge: string }>();
      const encoder = new TextEncoder();
      const clientData = encoder.encode(
        JSON.stringify({ type: "webauthn.get", challenge, origin, crossOrigin: false }),
      );
      const rpIdHash = new Uint8Array(
        await crypto.subtle.digest("SHA-256", encoder.encode("localhost")),
      );
      const authenticatorData = new Uint8Array([
        ...rpIdHash,
        userVerified ? 0x05 : 0x01,
        0,
        0,
        0,
        0,
      ]);
      const signed = new Uint8Array([
        ...authenticatorData,
        ...new Uint8Array(await crypto.subtle.digest("SHA-256", clientData)),
      ]);
      const raw = new Uint8Array(
        await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, keys.privateKey, signed),
      );
      // WebAuthn usa la firma DER, WebCrypto quella r||s.
      const integer = (bytes: Uint8Array) => {
        let start = 0;
        while (start < bytes.length - 1 && bytes[start] === 0) start++;
        const trimmed = bytes.slice(start);
        const value = trimmed[0]! & 0x80 ? [0, ...trimmed] : [...trimmed];
        return [0x02, value.length, ...value];
      };
      const body = [...integer(raw.slice(0, 32)), ...integer(raw.slice(32))];
      const signature = new Uint8Array([0x30, body.length, ...body]);
      const response = await jsonRequest(
        "passkey/verify-authentication",
        [cookie, cookies(options)].filter(Boolean).join("; "),
        {
          response: {
            id: credentialId,
            rawId: credentialId,
            type: "public-key",
            response: {
              authenticatorData: b64url(authenticatorData),
              clientDataJSON: b64url(clientData),
              signature: b64url(signature),
            },
            clientExtensionResults: {},
          },
        },
      );
      expect(response.ok).toBe(true);
      return cookies(response);
    };
  }

  it("apre l'area admin solo con passkey verificata sul dispositivo, per 12 ore", async () => {
    const user = await createUser("admin.passkey@example.invalid");
    const signInWithPasskey = await syntheticPasskey(user.id);
    const passkeyVerified = async (cookie: string) =>
      (
        await env.DB.prepare('SELECT "passkeyVerified" FROM "session" WHERE id = ?')
          .bind(await sessionId(cookie))
          .first<{ passkeyVerified: number }>()
      )?.passkeyVerified;

    // Per un utente normale la passkey è un accesso come gli altri: nessuna area admin.
    const merchant = await signInWithPasskey(true);
    expect(await passkeyVerified(merchant)).toBe(1);
    expect(await admin(merchant)).toBe(404);

    await env.DB.prepare('UPDATE "user" SET "admin" = 1 WHERE id = ?').bind(user.id).run();
    // Passkey senza verifica dell'utente: un solo fattore, la sessione non vale per l'admin.
    const presenceOnly = await signInWithPasskey(false);
    expect(await passkeyVerified(presenceOnly)).toBe(0);
    expect(await admin(presenceOnly)).toBe("verify");
    // Dopo l'accesso la pagina spiega che manca la verifica, invece di ricaricarsi uguale.
    const retried = await adminLoader({
      request: new Request(`${origin}/admin?conferma`, { headers: { cookie: presenceOnly } }),
    } as never);
    expect(retried).toMatchObject({ access: "verify", unverified: true });
    expect(await admin(user.cookie)).toBe("verify");

    // Conferma dalla sessione con password: nasce una nuova sessione verificata.
    const verified = await signInWithPasskey(true, user.cookie);
    expect(await admin(verified)).toBe("granted");
    expect((await jsonRequest("passkey/generate-register-options", verified)).status).toBe(200);
    // Le passkey dell'admin non si rimuovono da una sessione senza conferma.
    expect(
      await securityAction(user.cookie, { intent: "passkey-remove", id: "qualsiasi" }),
    ).toContain("conferma-passkey");

    await age(verified, 13);
    expect(await admin(verified)).toBe("verify");
    const renewed = await signInWithPasskey(true);
    expect(await admin(renewed)).toBe("granted");

    // Logout, revoca globale e perdita del ruolo chiudono subito l'area admin.
    await jsonRequest("sign-out", renewed, {});
    await expectRevoked(renewed);
    const again = await signInWithPasskey(true);
    expect(await securityAction(user.cookie, { intent: "esci-altri" })).toContain(
      "sessioni-chiuse",
    );
    await expectRevoked(again);
    const last = await signInWithPasskey(true);
    expect(await admin(last)).toBe("granted");
    await env.DB.prepare('UPDATE "user" SET "admin" = 0 WHERE id = ?').bind(user.id).run();
    expect(await admin(last)).toBe(404);
  });
});
