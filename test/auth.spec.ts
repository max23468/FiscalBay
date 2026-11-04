import { passwordSession } from "./fixtures/account-fixtures";
import { env } from "cloudflare:workers";

import { hashPassword as originalHash } from "better-auth/crypto";

import { getMigrations } from "better-auth/db/migration";

import { afterEach, describe, expect, it, vi } from "vitest";

const background = vi.hoisted(() => {
  vi.resetModules();
  return { tasks: [] as Promise<unknown>[] };
});

vi.mock("cloudflare:workers", async (original) => ({
  ...(await original<typeof import("cloudflare:workers")>()),
  waitUntil: (task: Promise<unknown>) => background.tasks.push(task),
}));

async function drainBackground() {
  while (background.tasks.length) await Promise.all(background.tasks.splice(0));
}

afterEach(drainBackground);

import { handleAuthRequest } from "../app/auth-route.server";
import { countAuthAttempt, purgeAuthAttempts } from "../app/domain/auth-attempts.server";

import { createAuth, createAuthOptions } from "../app/auth.server";

import { withinOneLimitWindow } from "./fixtures/rate-limiter";

import { completeRegistration } from "../app/domain/registration.server";

import { action as securityRouteAction } from "../app/routes/settings";

import { action as signInAction, loader as signInLoader } from "../app/routes/sign-in";

import { action as storeLinkAction, loader as storeLinkLoader } from "../app/routes/store-link";

import { action as passwordCheckAction } from "../app/routes/password-check";

import { hashPassword, verifyPassword } from "../app/password.server";

import { emailSender, mailEnv, sessionCookie, verifiedSession } from "./fixtures/account-fixtures";

import { routeData, routeResponse, pagePath } from "./fixtures/route-fixtures";

it("i tentativi di accesso rispettano soglia, secondi di attesa e riapertura della finestra", async () => {
  const at = Date.parse("2026-09-01T12:00:00.000Z");
  const key = `limit-${crypto.randomUUID()}`;
  const rule = { window: 60, max: 2 };
  expect(await countAuthAttempt(env.DB, key, rule, at)).toBeNull();
  expect(await countAuthAttempt(env.DB, key, rule, at + 1)).toBeNull();
  expect(await countAuthAttempt(env.DB, key, rule, at + 1_001)).toBe(59);
  expect(await countAuthAttempt(env.DB, key, rule, at + 59_999)).toBe(1);
  expect(await countAuthAttempt(env.DB, key, rule, at + 60_000)).toBeNull();
  expect(await countAuthAttempt(env.DB, key, rule, at + 60_001)).toBeNull();
  expect(await countAuthAttempt(env.DB, key, rule, at + 60_002)).toBe(60);
  expect(await countAuthAttempt(env.DB, `${key}-deny`, { window: 0, max: 0 }, at)).toBe(1);
});

it("la pulizia dei tentativi conserva il confine esatto di un'ora", async () => {
  const at = Date.parse("2026-09-01T12:00:00.000Z");
  const prefix = `purge-${crypto.randomUUID()}`;
  for (const offset of [-1, 0, 1])
    await countAuthAttempt(
      env.DB,
      `${prefix}-${offset}`,
      { window: 60, max: 2 },
      at - 3_600_000 + offset,
    );
  await purgeAuthAttempts(env.DB, at);
  const { results } = await env.DB.prepare(
    'SELECT "key" FROM "rateLimit" WHERE "key" LIKE ? ORDER BY "key"',
  )
    .bind(`${prefix}%`)
    .all<{ key: string }>();
  expect(results.map(({ key }) => key)).toEqual([`${prefix}-0`, `${prefix}-1`]);
});

it("salva le password con il costo ridotto e rifiuta il formato predefinito di Better Auth", async () => {
  const hash = await hashPassword("password-di-prova-lunga");
  expect(hash).toMatch(/^v2:[0-9a-f]{32}:[0-9a-f]{128}$/u);
  expect(await verifyPassword({ hash, password: "password-di-prova-lunga" })).toBe(true);
  expect(await verifyPassword({ hash, password: "password-errata-lunga" })).toBe(false);
  for (const malformed of ["", "v2:00", "v3:00:00", "00:00:00:00"]) {
    expect(await verifyPassword({ hash: malformed, password: "password-di-prova-lunga" })).toBe(
      false,
    );
  }

  const email = "costo-password@example.invalid";
  const signup = await createAuth(env).handler(
    new Request("http://localhost:5173/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Utente password", email, password: "password-di-prova-lunga" }),
    }),
  );
  expect(signup.status).toBe(200);
  const stored = () =>
    env.DB.prepare(
      `SELECT a."password" FROM "account" a JOIN "user" u ON u."id" = a."userId"
        WHERE u."email" = ? AND a."providerId" = 'credential'`,
    )
      .bind(email)
      .first<{ password: string }>();
  expect((await stored())?.password).toMatch(/^v2:/u);

  // Un hash nel formato predefinito di Better Auth, `sale:chiave` con r=16, non apre l'accesso.
  await env.DB.prepare(
    `UPDATE "account" SET "password" = ?
      WHERE "providerId" = 'credential' AND "userId" = (SELECT "id" FROM "user" WHERE "email" = ?)`,
  )
    .bind(await originalHash("password-di-prova-lunga"), email)
    .run();
  expect(await passwordSession(env, email, "password-di-prova-lunga")).not.toContain(
    "session_token",
  );
});

it("non segue redirect esterni nei GET di accesso e collegamento", async () => {
  for (const base of ["", "/en"]) {
    const query = "?token=synthetic&redirectTo=https://example.invalid";
    // L'accesso mostra il modulo per la nuova password, senza seguire il redirect richiesto.
    const access = await routeData(signInLoader, `${pagePath(base, "/accesso")}${query}`);
    expect(access).toMatchObject({ authenticated: false, resetToken: "synthetic" });
    const response = await routeResponse(
      storeLinkLoader,
      `${pagePath(base, "/app/negozi/collega")}${query}`,
    );
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(pagePath(base, "/accesso"));
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.getSetCookie()).toEqual([]);
  }
});

it("conserva il rifiuto POST da origine estranea e del collegamento senza sessione in entrambe le lingue", async () => {
  for (const base of ["", "/en"]) {
    for (const origin of ["https://example.invalid", null]) {
      const foreign = { origin, fields: {} };
      expect((await routeResponse(signInAction, pagePath(base, "/accesso"), foreign)).status).toBe(
        403,
      );
      expect(
        (await routeResponse(storeLinkAction, pagePath(base, "/app/negozi/collega"), foreign))
          .status,
      ).toBe(403);
    }
    const response = await routeResponse(storeLinkAction, pagePath(base, "/app/negozi/collega"), {
      fields: {},
    });
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      `${pagePath(base, "/app/ordini")}?negozio=accesso`,
    );
  }
});

it("riporta come trapelate le sole password segnalate dall'edge, senza leggere il corpo", async () => {
  const check = async (signal?: string, origin?: string | null) =>
    routeResponse(passwordCheckAction, "/api/v1/password-check", {
      body: JSON.stringify({ username: "fiscalbay", password: "password-di-prova" }),
      headers: signal ? { "exposed-credential-check": signal } : {},
      origin,
    });
  for (const [signal, leaked] of [
    ["1", true],
    ["4", true],
    ["2", false],
    ["3", false],
    [undefined, false],
  ] as const) {
    const response = await check(signal);
    expect(response.headers.get("cache-control"), signal).toBe("no-store");
    expect(await response.json(), signal).toEqual({ leaked });
  }
  expect((await check("4", "https://example.invalid")).status).toBe(403);
  expect((await check("4", null)).status).toBe(403);
});

it("mantiene lo schema D1 allineato ai quattro metodi Auth", async () => {
  const options = createAuthOptions(env);
  expect(options.appName).toBe("FiscalBay");
  const migration = await getMigrations(options);
  expect(migration.toBeCreated).toEqual([]);
  expect(migration.toBeAdded).toEqual([]);
  expect(migration.toBeAddedIndexes).toEqual([]);
  expect(migration.schemaProblems).toEqual([]);
  expect(migration.unsafeChanges).toEqual([]);
});

it.each([undefined, "[]", "", "non-json", "{}", '["non-email"]', '["ok@example.invalid", 1]'])(
  "rifiuta nuove registrazioni con elenco vuoto o non valido: %s",
  async (list) => {
    const email = `rifiuto-${crypto.randomUUID()}@example.invalid`;
    const send = emailSender();
    const environment = mailEnv(send, {
      REGISTRATION_MODE: "approval",
      REGISTRATION_ALLOWED_EMAILS: list,
    });
    const response = await createAuth(environment).handler(
      new Request("http://localhost:5173/api/auth/sign-up/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, name: "Sintetico", password: "Password-sintetica-123!" }),
      }),
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      code: "registration_approval_required",
      message: "Registration requires approval.",
    });
    expect(response.headers.getSetCookie()).toEqual([]);
    expect(
      await env.DB.prepare('SELECT id FROM "user" WHERE email = ?').bind(email).first(),
    ).toBeNull();
    expect(send).not.toHaveBeenCalled();
  },
);

it("autorizza solo email esatte, conserva il login e non rivela gli account fuori elenco", async () => {
  const email = "approvato@example.invalid";
  const environment = mailEnv(emailSender(), {
    REGISTRATION_MODE: "approval",
    REGISTRATION_ALLOWED_EMAILS: '[" Approvato@Example.Invalid "]',
  });
  const signup = (target: Env, address: string) =>
    createAuth(target).handler(
      new Request("http://localhost:5173/api/auth/sign-up/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: address,
          name: "Approvato",
          password: "Password-sintetica-123!",
        }),
      }),
    );
  expect((await signup(environment, email.toUpperCase())).status).toBe(200);
  const closed = { ...environment, REGISTRATION_ALLOWED_EMAILS: "[]" };
  for (const address of [email, "approvato+alias@example.invalid", "altro@example.invalid"]) {
    const denied = await signup(closed, address);
    expect(denied.status).toBe(403);
    expect(await denied.json()).toMatchObject({ code: "registration_approval_required" });
  }
  expect(await passwordSession(closed, email, "Password-sintetica-123!")).toContain(
    "session_token",
  );
  // Nemmeno un alias dello stesso indirizzo o un altro utente sul dominio sono autorizzati.
  for (const address of ["approvato+alias@example.invalid", "altro@example.invalid"]) {
    expect((await signup(environment, address)).status).toBe(403);
  }
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

  it("con il database non disponibile l'accesso risponde 503 e i log hanno il solo codice", async () => {
    const { cookie } = await verifiedSession("auth-guasto@example.invalid");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const prepare = vi.spyOn(env.DB, "prepare").mockImplementation(() => {
      throw new Error("D1_ERROR: unavailable SELECT * FROM session");
    });
    try {
      const post = (path: string, body: Record<string, string>) =>
        new Request(`http://localhost:5173/api/auth${path}`, {
          method: "POST",
          headers: { "content-type": "application/json", origin: "http://localhost:5173", cookie },
          body: JSON.stringify(body),
        });
      // La registrazione con password passa soltanto dal modulo, provato con la pagina di accesso.
      const response = await handleAuthRequest(
        post("/sign-in/email", {
          email: "auth-guasto@example.invalid",
          password: "Una-password-negozio-molto-lunga",
        }),
        env,
      );
      expect([response.status, response.headers.get("retry-after")]).toEqual([503, "60"]);
      // La sessione letta da Better Auth fallisce con il suo errore 500, già classificato.
      const session = await handleAuthRequest(
        new Request("http://localhost:5173/api/auth/get-session", { headers: { cookie } }),
        env,
      );
      expect(session.status).toBe(500);
      expect(log.mock.calls.map(([line]) => JSON.parse(String(line)))).toEqual([
        expect.objectContaining({ code: "UPSTREAM_UNAVAILABLE", operation: "route" }),
        expect.objectContaining({ code: "INTERNAL_ERROR", operation: "route" }),
      ]);
      // Né l'errore del database né la query raggiungono i log.
      expect(JSON.stringify(log.mock.calls)).not.toContain("D1_ERROR");
    } finally {
      prepare.mockRestore();
      log.mockRestore();
    }
  });

  it("riusa l'istanza Better Auth per lo stesso ambiente", () => {
    expect(createAuth(env)).toBe(createAuth(env));
    expect(createAuth({ ...env } as Env)).not.toBe(createAuth(env));
  });

  it("collega la dashboard gestita solo con la chiave del progetto", () => {
    const ids = (options: ReturnType<typeof createAuthOptions>) =>
      options.plugins?.map((plugin) => plugin.id);
    expect(ids(createAuthOptions(env))).not.toEqual(expect.arrayContaining(["dash"]));
    const options = createAuthOptions({ ...env, BETTER_AUTH_API_KEY: "chiave-di-prova" });
    expect(ids(options)).toEqual(expect.arrayContaining(["dash", "durable-background"]));
    // La chiave arriva dall'ambiente del Worker, non da una variabile globale del processo.
    const dash = options.plugins?.find((plugin) => plugin.id === "dash") as
      | { options?: { apiKey?: string } }
      | undefined;
    expect(dash?.options?.apiKey).toBe("chiave-di-prova");
  });

  it("usa mittente e Reply-To previsti per verifica e reset", async () => {
    const send = emailSender();
    const options = createAuthOptions(mailEnv(send));
    const user = { id: "auth-email-fixture", email: "auth@example.invalid" };
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
      routeResponse(securityRouteAction, "/app/impostazioni/account", {
        cookie,
        fields: { intent: "passkey-remove", id: passkeyId },
      });
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
      routeResponse(signInAction, "/accesso", {
        cookie,
        fields: {
          intent: "reimposta-password",
          token: "synthetic-recovery-token",
          password: "password-recuperata-lunga",
        },
      });
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
    const deployed = { ...env, APP_ORIGIN: origin as typeof env.APP_ORIGIN };
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
    await withinOneLimitWindow();
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
      const cookie = sessionCookie(start);
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

  it.each([true, false])(
    "applica l'autorizzazione alla registrazione eBay business: %s",
    async (allowed) => {
      const email = allowed ? "business@example.invalid" : "business-negato@example.invalid";
      const accountId = allowed ? "ebay-business-sintetico" : "ebay-business-negato";
      const send = emailSender();
      const environment = mailEnv(send, {
        REGISTRATION_MODE: "approval",
        REGISTRATION_ALLOWED_EMAILS: allowed ? '["business@example.invalid"]' : "[]",
      });
      const start = await createAuth(environment).handler(
        new Request("http://localhost:5173/api/auth/sign-in/social", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ provider: "ebay", callbackURL: "/" }),
        }),
      );
      const state = new URL((await start.json<{ url: string }>()).url).searchParams.get("state");
      const cookie = sessionCookie(start);
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
          userId: accountId,
          username: "venditore-business",
          businessAccount: { email },
        });
      });

      const response = await handleAuthRequest(
        new Request(`http://localhost:5173/api/auth/callback/ebay?code=synthetic&state=${state}`, {
          headers: { cookie },
        }),
        environment,
      );
      // Il profilo si legge da Identity con il token di accesso appena ottenuto.
      expect(fetchMock).toHaveBeenCalledWith(
        "https://apiz.ebay.com/commerce/identity/v1/user/",
        expect.objectContaining({ headers: { Authorization: "Bearer sintetico" } }),
      );
      fetchMock.mockRestore();

      expect(response.status).toBe(302);
      if (!allowed) {
        expect(response.headers.get("location")).toContain("registration_approval_required");
        expect(response.headers.getSetCookie().join(";")).not.toContain("session_token");
        expect(
          await env.DB.prepare('SELECT id FROM "user" WHERE email = ?').bind(email).first(),
        ).toBeNull();
        expect(
          await env.DB.prepare('SELECT id FROM "account" WHERE "accountId" = ?')
            .bind(accountId)
            .first(),
        ).toBeNull();
        expect(send).not.toHaveBeenCalled();
        return;
      }
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
            cookie: sessionCookie(response),
          },
          body: JSON.stringify({ accountId: account!.id }),
        }),
      );
      expect(removal.status).toBe(400);
      expect(await removal.json()).toMatchObject({ code: "FAILED_TO_UNLINK_LAST_ACCOUNT" });
    },
  );

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
      const cookie = sessionCookie(start);
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
      const environment = mailEnv();
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
      const signedUpCookie = await passwordSession(env, email, "Password-sintetica-123!");
      if (scenario !== "non-verificata") {
        await env.DB.prepare('UPDATE "user" SET "emailVerified" = 1 WHERE id = ?')
          .bind(user.id)
          .run();
      }
      const start = await post(
        "link-social",
        { provider: "ebay", callbackURL: "/?accesso=ebay-collegato" },
        signedUpCookie,
      );
      expect(start.status).toBe(200);
      const url = new URL((await start.json<{ url: string }>()).url);
      expect(url.searchParams.get("code_challenge_method")).toBe("S256");
      let callbackSession = signedUpCookie;
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
              { headers: { cookie: `${callbackSession}; ${sessionCookie(start)}` } },
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
        await post("sign-out", {}, signedUpCookie);
        const login = await post("sign-in/social", { provider: "ebay", callbackURL: "/" });
        const loginUrl = new URL((await login.json<{ url: string }>()).url);
        const signedIn = await handleAuthRequest(
          new Request(
            `http://localhost:5173/api/auth/callback/ebay?code=synthetic&state=${loginUrl.searchParams.get("state")}`,
            { headers: { cookie: sessionCookie(login) } },
          ),
          environment,
        );
        const current = await auth.api.getSession({
          headers: new Headers({ cookie: sessionCookie(signedIn) }),
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
          headers: new Headers({ cookie: sessionCookie(signedIn) }),
        });
        expect(refreshed.accessToken).toBe("access-token-sintetico");
        const renewed = await env.DB.prepare(
          'SELECT "accessTokenExpiresAt" AS expiry FROM "account" WHERE id = ?',
        )
          .bind(account!.id)
          .first<{ expiry: string }>();
        expect(new Date(renewed!.expiry).getTime()).toBeGreaterThan(Date.now());
        const unlink = await post(
          "unlink-account",
          { accountId: account!.id },
          sessionCookie(signedIn),
        );
        expect(unlink.status).toBe(200);
        expect(
          await env.DB.prepare('SELECT id FROM "account" WHERE id = ?').bind(account!.id).first(),
        ).toBeNull();
        await post("revoke-sessions", {}, sessionCookie(signedIn));
        expect(
          await auth.api.getSession({ headers: new Headers({ cookie: sessionCookie(signedIn) }) }),
        ).toBeNull();
      } finally {
        fetchMock.mockRestore();
      }
    },
  );
});
