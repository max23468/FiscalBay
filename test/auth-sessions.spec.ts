import { env } from "cloudflare:workers";

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

import { forwardToAuth, handleAuthRequest } from "../app/auth-route.server";

import { createAuth, readSession } from "../app/auth.server";

import { completeRegistration } from "../app/domain/registration.server";

import { adminAccess, recentSignIn } from "../app/domain/sessions.server";

import { withResponseCookies } from "../app/response-cookies.server";

import { loader as adminLoader } from "../app/routes/admin";

import { loader as exportFileLoader } from "../app/routes/export-file";

import { action as notificationsAction } from "../app/routes/notifications";

import { action as unlockAction } from "../app/routes/orders";

import { action as exportAction } from "../app/routes/order-export";

import { action as searchAction } from "../app/routes/order-search";

import { action as securityRouteAction, loader as securityLoader } from "../app/routes/settings";

import { action as signInAction, loader as signInLoader } from "../app/routes/sign-in";

import { action as storeLinkAction } from "../app/routes/store-link";

import { sessionCookie } from "./fixtures/account-fixtures";

import { routeData, routeResponse, pagePath } from "./fixtures/route-fixtures";

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
  const jsonRequest = async (path: string, cookie: string, body?: unknown) =>
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
  const securityAction = (cookie: string, fields: Record<string, string>) =>
    routeResponse(securityRouteAction, "/app/impostazioni/account", { cookie, fields }).then(
      (response) => response.headers.get("location"),
    );
  const home = (cookie: string) => routeData(signInLoader, "/accesso", { cookie });
  /** Pagina Sicurezza; chi non può vederla torna all'accesso con l'esito ricevuto. */
  const security = async (cookie: string, path = "/app/impostazioni/account") => {
    try {
      return await routeData(securityLoader, path, { cookie, params: { sezione: "account" } });
    } catch (thrown) {
      if (thrown instanceof Response) return thrown.headers.get("location");
      throw thrown;
    }
  };
  it("rinomina solo passkey proprie con accesso recente, anche attraverso la route Auth", async () => {
    const user = await createUser("rinomina.passkey@example.invalid");
    const other = await createUser("rinomina.estraneo@example.invalid");
    await env.DB.prepare(`INSERT INTO passkey (id, name, publicKey, userId, credentialID, counter, deviceType, backedUp)
      VALUES ('rename-owned', 'Originale', 'synthetic', ?, 'rename-owned', 0, 'singleDevice', 0)`)
      .bind(user.id)
      .run();
    expect(
      await securityAction(user.cookie, {
        intent: "passkey-rename",
        id: "rename-owned",
        name: "  Chiave di riserva  ",
      }),
    ).toContain("passkey-rinominata");
    expect(
      await env.DB.prepare("SELECT name FROM passkey WHERE id = 'rename-owned'").first(),
    ).toEqual({ name: "Chiave di riserva" });
    expect(
      await securityAction(other.cookie, {
        intent: "passkey-rename",
        id: "rename-owned",
        name: "Estraneo",
      }),
    ).toContain("errore");
    expect(
      (
        await jsonRequest("passkey/update-passkey", other.cookie, {
          id: "rename-owned",
          name: "Estraneo",
        })
      ).ok,
    ).toBe(false);
    expect(
      await securityAction(user.cookie, {
        intent: "passkey-rename",
        id: "rename-owned",
        name: " ",
      }),
    ).toContain("passkey-nome-non-valido");
    expect(
      (
        await jsonRequest("passkey/update-passkey", user.cookie, {
          id: "rename-owned",
          name: "a".repeat(81),
        })
      ).status,
    ).toBe(400);
    await env.DB.prepare('UPDATE session SET "createdAt" = ? WHERE "userId" = ?')
      .bind(new Date(Date.now() - 2 * 86_400_000).toISOString(), user.id)
      .run();
    expect(
      await securityAction(user.cookie, {
        intent: "passkey-rename",
        id: "rename-owned",
        name: "Vecchia sessione",
      }),
    ).toContain("nuovo-accesso");
    expect(
      (
        await jsonRequest("passkey/update-passkey", user.cookie, {
          id: "rename-owned",
          name: "Vecchia sessione",
        })
      ).status,
    ).toBe(403);
    expect(
      await env.DB.prepare("SELECT name FROM passkey WHERE id = 'rename-owned'").first(),
    ).toEqual({ name: "Chiave di riserva" });
  });

  it("esce per riautenticare e torna soltanto a una sezione consentita di Sicurezza", async () => {
    for (const prefix of ["", "/en"]) {
      const user = await createUser(`ritorno${prefix.replace("/", "-")}@example.invalid`);
      const target = `${pagePath(prefix, "/app/impostazioni/account")}#security-email`;
      const area = await routeData(securityLoader, pagePath(prefix, "/app/impostazioni/account"), {
        cookie: user.cookie,
        params: { sezione: "account" },
      });
      expect(area.userId).toBe(user.id);
      const out = await routeResponse(
        securityRouteAction,
        pagePath(prefix, "/app/impostazioni/account"),
        {
          cookie: user.cookie,
          fields: { intent: "riautentica", returnTo: target },
        },
      );
      const destination = new URL(out.headers.get("location")!, origin);
      expect(destination.pathname).toBe(pagePath(prefix, "/accesso"));
      expect(destination.searchParams.get("returnTo")).toBe(target);
      expect(await security(user.cookie)).toBe("/accesso");
      for (const [returnTo, expected] of [
        [target, target],
        ["https://example.invalid", pagePath(prefix, "/app/ordini")],
        [pagePath(prefix, "/app/negozi"), pagePath(prefix, "/app/ordini")],
      ]) {
        const signedIn = await routeResponse(signInAction, pagePath(prefix, "/accesso"), {
          fields: { email: user.email, password: "Password-sintetica-123!", returnTo },
        });
        expect(signedIn.headers.get("location")).toBe(expected);
      }
      // Con la password segnalata come trapelata l'avviso arriva nella pagina di ritorno.
      const warned = await routeResponse(signInAction, pagePath(prefix, "/accesso"), {
        fields: {
          email: user.email,
          password: "Password-sintetica-123!",
          returnTo: target,
          "password-trapelata": "1",
        },
      });
      expect(warned.headers.get("location")).toBe(
        `${pagePath(prefix, "/app/impostazioni/account")}?accesso=password-trapelata#security-email`,
      );
    }
  });

  /** Esito del loader admin: 404 per chi non è admin, altrimenti il livello di accesso. */
  const admin = async (cookie: string) => {
    try {
      const result = await routeData(adminLoader, "/admin", { cookie });
      return result.access;
    } catch (error) {
      return (error as { init?: { status?: number } }).init?.status;
    }
  };
  const signIn = async (email: string) =>
    sessionCookie(
      await jsonRequest("sign-in/email", "", { email, password: "Password-sintetica-123!" }),
    );
  // La registrazione con password arriva dal modulo con Turnstile: qui direttamente ad Auth.
  const createUser = async (email: string) => {
    const response = await createAuth(env).handler(
      new Request(`${origin}/api/auth/sign-up/email`, {
        method: "POST",
        headers: { "content-type": "application/json", origin },
        body: JSON.stringify({
          name: "Sessioni sintetiche",
          email,
          password: "Password-sintetica-123!",
        }),
      }),
    );
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
    return { id: user.id, email, cookie: await signIn(email) };
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
    expect(await security(cookie, "/en/app/settings/account?accesso=sessione-chiusa")).toBe(
      "/en/sign-in?accesso=sessione-chiusa",
    );
    expect(
      await securityAction(cookie, { intent: "cambia-email", email: "x@example.invalid" }),
    ).toBe("/accesso");
    expect(await securityAction(cookie, { intent: "esci-altri" })).toBe("/accesso");
    const link = await routeResponse(storeLinkAction, "/app/negozi/collega", {
      cookie,
      fields: {},
    });
    expect(link.headers.get("location")).toContain("negozio=accesso");
    expect((await jsonRequest("passkey/generate-register-options", cookie)).status).toBe(401);
    expect(await admin(cookie)).toBe(404);
    // Le API dei dati rileggono la sessione prima di cercare, esportare, scaricare o segnare.
    const options = (fields: Record<string, string>) => ({
      cookie,
      fields,
      headers: { accept: "application/json" },
    });
    const statuses = [
      await routeResponse(
        searchAction,
        "/api/v1/orders/search",
        options({ q: "RSSMRA80A01H501U" }),
      ),
      await routeResponse(exportAction, "/api/v1/orders/export", options({ ordini: "o-a" })),
      await routeResponse(exportFileLoader, "/api/v1/exports/file", {
        ...options({}),
        fields: undefined,
        params: { file: "file" },
      }),
      await routeResponse(notificationsAction, "/api/v1/notifications", options({ ids: "a" })),
      await routeResponse(
        unlockAction,
        "/app/ordini",
        options({ intent: "unlock", ids: "o-a", skipConfirmation: "true" }),
      ),
    ].map((response) => response.status);
    expect(statuses).toEqual([401, 401, 401, 302, 302]);
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
      const token = decodeURIComponent(sessionCookie(response).split("=")[1]!).split(".")[0];
      return (
        await env.DB.prepare('SELECT "userAgent" FROM "session" WHERE "token" = ?')
          .bind(token)
          .first<{ userAgent: string | null }>()
      )?.userAgent;
    };
    expect(await agentOf(await signIn({ origin, "user-agent": userAgent }))).toBe(userAgent);
    expect(await agentOf(await signIn({ origin }))).toBeFalsy();
  });

  it("rinnova il cookie insieme alla sessione, salvo un cookie già impostato dalla risposta", async () => {
    const { cookie } = await createUser("rinnovo@example.invalid");
    const id = await sessionId(cookie);
    // Accesso di due ore fa: la sessione va rinnovata alla prossima lettura.
    const due = new Date(Date.now() + 7 * 86_400_000 - 2 * 3_600_000).toISOString();
    const setDue = () =>
      env.DB.prepare('UPDATE "session" SET "expiresAt" = ? WHERE id = ?').bind(due, id).run();
    const page = (response: Response) =>
      withResponseCookies(async () => {
        await readSession(env, new Request(`${origin}/app`, { headers: { cookie } }));
        return response;
      });

    await setDue();
    const renewed = (await page(new Response(null))).headers.getSetCookie();
    expect(renewed).toEqual([expect.stringMatching(/session_token=.*Max-Age=604800/u)]);
    const row = await env.DB.prepare('SELECT "expiresAt" FROM "session" WHERE id = ?')
      .bind(id)
      .first<{ expiresAt: string }>();
    expect(new Date(row!.expiresAt).getTime()).toBeGreaterThan(new Date(due).getTime());

    await setDue();
    const cleared = `${renewed[0]!.split("=")[0]}=; Path=/; Max-Age=0`;
    const signedOut = await page(new Response(null, { headers: { "set-cookie": cleared } }));
    expect(signedOut.headers.getSetCookie()).toEqual([cleared]);
  });

  it("elenca le sessioni senza token e chiude una sessione o tutte le altre", async () => {
    const user = await createUser("sessioni@example.invalid");
    const second = await signIn("sessioni@example.invalid");
    const third = await signIn("sessioni@example.invalid");
    const other = await createUser("sessioni.altro@example.invalid");

    const loaded = await security(user.cookie);
    if (typeof loaded === "string" || !loaded || !("page" in loaded))
      throw new Error("sessione attesa");
    const { sessions } = loaded.page.security;
    expect(sessions).toHaveLength(3);
    expect(sessions.every((session) => Number.isFinite(Date.parse(session.createdAt!)))).toBe(true);
    expect(sessions.filter((session) => session.current)).toEqual([
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
      "/app/impostazioni/account?accesso=sessioni-chiuse",
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
    ] as Record<string, string>[]) {
      expect(await securityAction(user.cookie, fields)).toContain("nuovo-accesso");
    }
    expect((await jsonRequest("passkey/generate-register-options", user.cookie)).status).toBe(403);
    // Le altre route non chiedono un accesso recente.
    expect((await jsonRequest("get-session", user.cookie)).status).toBe(200);
    expect(await security(user.cookie)).toMatchObject({
      page: {
        security: {
          recent: false,
          passkeyRestriction: "nuovo-accesso",
          passkeyBlock: "nuovo-accesso",
        },
      },
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
      page: {
        security: {
          recent: true,
          passkeyRestriction: "conferma-passkey",
          passkeyBlock: "conferma-passkey",
        },
      },
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
        [cookie, sessionCookie(options)].filter(Boolean).join("; "),
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
      return sessionCookie(response);
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
    const retried = await routeData(adminLoader, "/admin?conferma", { cookie: presenceOnly });
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
