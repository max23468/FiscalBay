import { passwordSession } from "./fixtures/account-fixtures";
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

import { handleAuthRequest } from "../app/auth-route.server";

import { createAuth, gmailDomain } from "../app/auth.server";

import { turnstileField } from "../app/turnstile";

import { siteverify, testingKeyResult } from "./fixtures/turnstile-fixtures";

import { completeRegistration } from "../app/domain/registration.server";

import { action as securityRouteAction } from "../app/routes/settings";

import { action as signInAction } from "../app/routes/sign-in";

import { pendingEmailChange } from "../app/domain/email-change.server";

import { purgeExpiredRecords } from "../app/domain/maintenance.server";

import { accountEmailBody } from "../app/account-email.server";

import { emailVerificationSeconds } from "../app/domain/email-change.server";

import { supportEmail } from "../app/app-copy";

import { emailLink, emailSender, mailEnv, sessionCookie } from "./fixtures/account-fixtures";

import { routeResponse } from "./fixtures/route-fixtures";

describe("Collegamento e modifica dell'identità", () => {
  const origin = "http://localhost:5173";
  const withEmail = (send = emailSender()) => mailEnv(send);
  const post = (environment: Env, path: string, body: Record<string, unknown>, cookie = "") =>
    createAuth(environment).handler(
      new Request(`${origin}/api/auth/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", origin, cookie },
        body: JSON.stringify(body),
      }),
    );
  const appAction = (cookie: string, fields: Record<string, string>) =>
    routeResponse(signInAction, "/accesso", { cookie, fields });
  /** Azione della pagina Sicurezza; chi non può vederla riceve il redirect lanciato. */
  const securityAction = (cookie: string, fields: Record<string, string>) =>
    routeResponse(securityRouteAction, "/app/impostazioni/account", { cookie, fields });
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
          headers: { cookie: [cookie, sessionCookie(start)].filter(Boolean).join("; ") },
        }),
        environment,
      );
    } finally {
      fetchMock.mockRestore();
    }
  }

  it.each([true, false])("applica l'autorizzazione al callback Google: %s", async (allowed) => {
    const email = `google-approvazione-${allowed}@gmail.com`;
    const send = emailSender();
    const environment = mailEnv(send, {
      REGISTRATION_MODE: "approval",
      REGISTRATION_ALLOWED_EMAILS: allowed ? JSON.stringify([email.toUpperCase()]) : "[]",
    });
    const result = await googleCallback(
      environment,
      await post(environment, "sign-in/social", { provider: "google", callbackURL: "/" }),
      { sub: `google-approvazione-${allowed}`, email, email_verified: true },
    );
    const user = await env.DB.prepare('SELECT id FROM "user" WHERE email = ?')
      .bind(email)
      .first<{ id: string }>();
    if (allowed) {
      expect(result.headers.get("location")).toBe("/");
      expect(user).not.toBeNull();
      expect(await googleAccounts(user!.id)).toEqual([`google-approvazione-${allowed}`]);
      // La rimozione dalla lista non impedisce accessi successivi con il metodo già collegato.
      const closed = { ...environment, REGISTRATION_ALLOWED_EMAILS: "[]" };
      const again = await googleCallback(
        closed,
        await post(closed, "sign-in/social", { provider: "google", callbackURL: "/" }),
        { sub: `google-approvazione-${allowed}`, email, email_verified: true },
      );
      expect(again.headers.get("location")).toBe("/");
    } else {
      expect(result.headers.get("location")).toContain("registration_approval_required");
      expect(result.headers.getSetCookie().join(";")).not.toContain("session_token");
      expect(user).toBeNull();
      expect(
        await env.DB.prepare('SELECT id FROM "account" WHERE "accountId" = ?')
          .bind(`google-approvazione-${allowed}`)
          .first(),
      ).toBeNull();
      expect(send).not.toHaveBeenCalled();
    }
  });

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
    // Senza profilo e Termini decide la pagina di accesso, che chiede ciò che manca.
    expect(fromApp.headers.get("location")).toBe("/accesso");
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
    const send = emailSender();
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
    await drainBackground();
    expect(send).toHaveBeenCalledOnce();
  });

  it("conferma l'email di un account nato da un provider solo dalla sua sessione", async () => {
    const send = emailSender();
    const environment = withEmail(send);
    const email = "conferma.provider@dominio-personale.invalid";
    const signedIn = await googleCallback(
      environment,
      await post(environment, "sign-in/social", { provider: "google", callbackURL: "/" }),
      { sub: "google-conferma-provider", email, email_verified: true },
    );
    await vi.waitFor(() => expect(send).toHaveBeenCalledOnce());
    const link = emailLink((send.mock.calls[0]![0] as { text: string }).text);
    const open = (cookie = "") =>
      handleAuthRequest(new Request(link, { headers: { cookie } }), environment);
    const verified = () =>
      env.DB.prepare('SELECT "emailVerified" FROM "user" WHERE email = ?').bind(email).first();

    // Chi riceve il link senza la sessione dell'account non lo conferma e non vi accede.
    const outside = await open();
    expect(outside.status).toBe(302);
    expect(outside.headers.get("location")).toBe("/auth/error?error=verification_session");
    expect(outside.headers.getSetCookie()).toEqual([]);
    expect(await verified()).toEqual({ emailVerified: 0 });

    // Né riceve un link per aggiungere una password all'account.
    send.mockClear();
    expect((await post(environment, "request-password-reset", { email })).ok).toBe(true);
    await drainBackground();
    expect(send).not.toHaveBeenCalled();

    // Chi ha creato l'account, con la propria sessione, conferma l'indirizzo.
    expect((await open(sessionCookie(signedIn))).status).toBe(302);
    expect(await verified()).toEqual({ emailVerified: 1 });

    // Confermato l'indirizzo, il link per la password torna a partire.
    send.mockClear();
    expect((await post(environment, "request-password-reset", { email })).ok).toBe(true);
    await vi.waitFor(() => expect(send).toHaveBeenCalledOnce());
    expect(send.mock.calls[0]![0]).toMatchObject({ to: email });
  });

  it("riconosce Google dal subject anche con email cambiata, senza fondere utenti", async () => {
    const send = emailSender();
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
      headers: new Headers({ cookie: sessionCookie(signedIn) }),
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

  it("le email di servizio usano un solo modello in testo e HTML, con il contenuto protetto", () => {
    const body = accountEmailBody({
      language: "en",
      origin: "https://test.fiscalbay.it",
      url: 'https://test.fiscalbay.it/?a=1&b="2"',
      email: {
        subject: "Subject",
        paragraphs: ['Use <b>"this"</b> & go', "Second paragraph."],
        button: "Continue",
        note: "Valid for one hour.",
      },
    });
    expect(body.text).toBe(
      [
        'Use <b>"this"</b> & go',
        "",
        "Second paragraph.",
        "",
        'Continue: https://test.fiscalbay.it/?a=1&b="2"',
        "",
        "Valid for one hour.",
        "",
        "--",
        `You are receiving this email because you have a FiscalBay account. For help, reply to this email or write to ${supportEmail}.`,
      ].join("\n"),
    );
    expect(emailLink(body.text)).toBe('https://test.fiscalbay.it/?a=1&b="2"');
    expect(body.html).toContain('<html lang="en">');
    // I colori sono soltanto chiari: un client in tema scuro non li inverte a metà.
    expect(body.html).toContain('<meta name="color-scheme" content="light only">');
    expect(body.html).not.toContain("dark");
    // Logo dall'origine dell'ambiente e anteprima nascosta dal primo paragrafo.
    expect(body.html).toContain('<img src="https://test.fiscalbay.it/apple-touch-icon.png"');
    expect(body.html).toMatch(/display:none[^>]*>Use &lt;b&gt;/u);
    expect(body.html).toContain("Use &lt;b&gt;&quot;this&quot;&lt;/b&gt; &amp; go");
    expect(body.html).toContain("Valid for one hour.");
    expect(body.html).toContain(
      "If the button does not work, copy this address into your browser:",
    );
    expect(body.html).toContain('href="https://test.fiscalbay.it/?a=1&amp;b=&quot;2&quot;"');
    expect(body.html).not.toContain("<b>");
  });

  it("i link di Auth dichiarano la durata che Better Auth applica", async () => {
    const send = vi.spyOn(env.AUTH_EMAIL, "send").mockResolvedValue({ messageId: "synthetic" });
    try {
      const email = "durata.link@example.invalid";
      await signUp(env, email, true);
      await vi.waitFor(() => expect(send).toHaveBeenCalled());
      const verify = send.mock.calls[0]![0] as { subject: string; text: string };
      expect(verify.subject).toMatch(/^\d{6} è il tuo codice di conferma di FiscalBay$/u);
      expect(verify.text).toContain("Conferma email: ");
      expect(verify.text).toContain("Il link vale un’ora.");
      expect(emailVerificationSeconds).toBe(3600);
      expect(createAuth(env).options.emailAndPassword?.resetPasswordTokenExpiresIn).toBe(
        emailVerificationSeconds,
      );
    } finally {
      send.mockRestore();
    }
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
        from: { email: expect.stringMatching(/^noreply@/u), name: "FiscalBay" },
        replyTo: supportEmail,
        to: email,
        subject: "Metodo di accesso rimosso da FiscalBay",
        text: expect.stringContaining("/app/impostazioni/account"),
        html: expect.stringContaining('<html lang="it">'),
      });
      send.mockClear();
      // Il link per la password è una richiesta di reset: senza verifica Turnstile non parte.
      expect(await outcome({ intent: "password", [turnstileField]: "" }, securityAction)).toContain(
        "verifica-non-riuscita",
      );
      expect(send).not.toHaveBeenCalled();
      expect(await outcome({ intent: "password" }, securityAction)).toContain("password-link");
      await vi.waitFor(() => expect(send).toHaveBeenCalledOnce());
      const message = send.mock.calls[0]![0] as { to: string; text: string };
      expect(message.to).toBe(email);
      const token = new URL(emailLink(message.text)).pathname.split("/").at(-1)!;
      expect(
        await outcome({ intent: "reimposta-password", token, password: "Password-reimpostata-1" }),
      ).toContain("password-reimpostata");
      await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(2));
      expect(send.mock.calls[1]![0]).toMatchObject({
        to: email,
        subject: "La password di FiscalBay è stata reimpostata",
      });
      // La password creata dal link ha già il suo avviso, non quello di un nuovo metodo.
      await drainBackground();
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

  it("l'avviso di sicurezza usa la lingua scelta nelle preferenze, poi quella dei Termini", async () => {
    const send = vi.spyOn(env.AUTH_EMAIL, "send").mockResolvedValue({ messageId: "synthetic" });
    try {
      // Registrato in italiano, poi passato all'inglese dalle preferenze.
      const user = await signUp(env, "avviso.lingua@example.invalid", true);
      await vi.waitFor(() => expect(send).toHaveBeenCalledOnce());
      send.mockClear();
      await env.DB.batch([
        env.DB.prepare(
          `INSERT INTO "passkey" ("id", "publicKey", "userId", "credentialID", "counter", "deviceType", "backedUp")
           VALUES ('passkey-lingua', 'synthetic', ?, 'passkey-lingua', 0, 'singleDevice', 0)`,
        ).bind(user.id),
        env.DB.prepare(
          "INSERT INTO user_preferences (user_id, language, updated_at) VALUES (?, 'en', ?)",
        ).bind(user.id, new Date().toISOString()),
      ]);
      const removed = await securityAction(user.cookie, {
        intent: "rimuovi-metodo",
        metodo: "password",
      });
      expect(removed.headers.get("location")).toContain("metodo-rimosso");
      await vi.waitFor(() => expect(send).toHaveBeenCalledOnce());
      expect(send.mock.calls[0]![0]).toMatchObject({
        to: "avviso.lingua@example.invalid",
        subject: "Sign-in method removed from FiscalBay",
        html: expect.stringContaining('<html lang="en">'),
      });
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
      emailLink((send.mock.calls[index]![0] as { text: string }).text);
    const follow = (url: string) =>
      handleAuthRequest(new Request(url, { headers: { cookie: user.cookie } }), environment);
    const stored = () =>
      env.DB.prepare('SELECT email, "emailVerified" FROM "user" WHERE id = ?')
        .bind(user.id)
        .first();

    // Un indirizzo già registrato ha la stessa risposta ma nessuna email e nessun cambio.
    expect(await request("email.occupata@example.invalid")).toContain("email-richiesta");
    expect(
      await pendingEmailChange(env.DB, user.id, "email.precedente@example.invalid"),
    ).toMatchObject({ newEmail: "email.occupata@example.invalid", stage: "current" });
    expect(await request("non-valida")).toContain("email-non-valida");
    expect(send).not.toHaveBeenCalled();

    expect(await request("email.nuova@example.invalid")).toContain("email-richiesta");
    await vi.waitFor(() => expect(send).toHaveBeenCalledOnce());
    expect(send.mock.calls[0]![0]).toMatchObject({ to: "email.precedente@example.invalid" });
    expect(await stored()).toEqual({ email: "email.precedente@example.invalid", emailVerified: 1 });
    expect(
      await pendingEmailChange(env.DB, user.id, "email.precedente@example.invalid"),
    ).toMatchObject({ newEmail: "email.nuova@example.invalid", stage: "current" });

    expect((await follow(link(0))).headers.get("location")).toContain("email-confermata");
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(2));
    expect(send.mock.calls[1]![0]).toMatchObject({ to: "email.nuova@example.invalid" });
    expect(
      await pendingEmailChange(env.DB, user.id, "email.precedente@example.invalid"),
    ).toMatchObject({ stage: "new" });
    expect(await stored()).toEqual({ email: "email.precedente@example.invalid", emailVerified: 1 });

    await follow(link(1));
    // Stesso utente, quindi stessi spazi, negozi e piani: cambia soltanto l'indirizzo.
    expect(await stored()).toEqual({ email: "email.nuova@example.invalid", emailVerified: 1 });
    // La conferma elimina subito lo stato temporaneo, prima della pulizia eseguita da un loader.
    expect(
      await env.DB.prepare("SELECT 1 FROM account_email_changes WHERE user_id = ?")
        .bind(user.id)
        .first(),
    ).toBeNull();
    expect(await pendingEmailChange(env.DB, user.id, "email.nuova@example.invalid")).toBeNull();
    send.mockClear();
    expect(await request("email.destinazione@example.invalid")).toContain("email-richiesta");
    await vi.waitFor(() => expect(send).toHaveBeenCalledOnce());
    // Il nuovo invio del link passa da Turnstile; con Siteverify indisponibile non parte.
    siteverify.answer = () => new Response(null, { status: 503 });
    expect(
      (await securityAction(user.cookie, { intent: "reinvia-email" })).headers.get("location"),
    ).toContain("verifica-non-disponibile");
    siteverify.answer = () => Response.json(testingKeyResult);
    expect(send).toHaveBeenCalledOnce();
    expect(
      (
        await securityAction(user.cookie, {
          intent: "reinvia-email",
          email: "email.estranea@example.invalid",
        })
      ).headers.get("location"),
    ).toContain("email-richiesta");
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(2));
    expect(send.mock.calls[1]![0]).toMatchObject({ to: "email.nuova@example.invalid" });
    expect(await pendingEmailChange(env.DB, user.id, "email.nuova@example.invalid")).toMatchObject({
      newEmail: "email.destinazione@example.invalid",
      stage: "current",
    });
    expect(await stored()).toEqual({ email: "email.nuova@example.invalid", emailVerified: 1 });
    await purgeExpiredRecords(env.DB, new Date(Date.now() + 3_600_001));
    expect(
      await env.DB.prepare("SELECT 1 FROM account_email_changes WHERE user_id = ?")
        .bind(user.id)
        .first(),
    ).toBeNull();
    send.mockRestore();
  });
});
