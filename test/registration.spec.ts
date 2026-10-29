import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { forwardToAuth } from "../app/auth-route.server";
import {
  completeRegistration,
  legalVersions,
  marketingTextVersions,
  parseProfile,
  registrationComplete,
  registrationStatus,
} from "../app/domain/registration.server";
import { createAuth } from "../app/auth.server";
import { sendExistingAccountEmail } from "../app/account-email.server";
import { handleAuthRequest } from "../app/auth-route.server";
import { loader as loadLegal } from "../app/routes/legal";
import { action as signIn, loader as loadAccess } from "../app/routes/sign-in";
import { action as startStoreLink } from "../app/routes/store-link";
import { accessNotice } from "../app/access-notice";
import { now, resetDatabase } from "./fixtures/database-fixtures";
import {
  syntheticProfile,
  verifiedSession,
  sessionCookie,
  profileOf,
  emailLink,
} from "./fixtures/account-fixtures";
import {
  accessError,
  accessFor,
  accessForm,
  securityForm,
  homeFor,
} from "./fixtures/account-route-fixtures";
import { beginStoreLink, storeLinkSessions } from "./fixtures/store-link-fixtures";
import { callRoute, routeData, routeResponse } from "./fixtures/route-fixtures";
import { siteverify, testToken } from "./fixtures/turnstile-fixtures";
import { turnstileField } from "../app/turnstile";

beforeEach(resetDatabase);
afterEach(() => vi.useRealTimers());

it("mostra l'autorizzazione preventiva in entrambe le lingue senza creare profili o inviare email", async () => {
  const person = { tipo: "privato", nome: "Mario", cognome: "Rossi" };
  const password = "Una-password-registrazione-lunga";
  const mode = env.REGISTRATION_MODE;
  const list = env.REGISTRATION_ALLOWED_EMAILS;
  const send = vi.spyOn(env.AUTH_EMAIL, "send").mockResolvedValue({ messageId: "synthetic" });
  try {
    env.REGISTRATION_MODE = "approval";
    env.REGISTRATION_ALLOWED_EMAILS = "[]";
    for (const language of ["it", "en"] as const) {
      const prefix = language === "it" ? "" : "/en";
      const page = await routeData(loadAccess, `${prefix}/accesso`);
      expect(page).toMatchObject({ registrationRestricted: true });
      const response = await accessForm(`${prefix}/accesso`, {
        intent: "registrati",
        ...person,
        email: "non-invitato@example.invalid",
        password,
        termini: "on",
      });
      expect(await accessError(response)).toMatchObject({
        status: 403,
        key: "autorizzazione",
        tab: "registrati",
      });
      expect(response.headers.getSetCookie()).toEqual([]);
      expect(accessNotice(new URLSearchParams("accesso=autorizzazione"), language)).toEqual({
        source: "accesso",
        key: "autorizzazione",
        tone: "warning",
        text:
          language === "it"
            ? "Ambiente di test riservato. La registrazione richiede un’autorizzazione preventiva."
            : "Private test environment. Registration requires prior approval.",
      });
    }
    expect(
      await env.DB.prepare('SELECT id FROM "user" WHERE email = ?')
        .bind("non-invitato@example.invalid")
        .first(),
    ).toBeNull();
    expect(send).not.toHaveBeenCalled();
  } finally {
    env.REGISTRATION_MODE = mode;
    env.REGISTRATION_ALLOWED_EMAILS = list;
    send.mockRestore();
  }
});

async function agreements(userId: string) {
  const terms = await env.DB.prepare(
    "SELECT terms_version, privacy_version, language FROM terms_acceptances WHERE user_id = ?",
  )
    .bind(userId)
    .all();
  const marketing = await env.DB.prepare(
    "SELECT granted, text_version, language FROM marketing_consents WHERE user_id = ? ORDER BY recorded_at",
  )
    .bind(userId)
    .all();
  return { terms: terms.results, marketing: marketing.results };
}

describe("registrazione e verifica del contatto", () => {
  const password = "Una-password-registrazione-lunga";
  const person = { tipo: "privato", nome: "Mario", cognome: "Rossi" };

  it("valida i limiti dei profili e richiede il consenso insieme al profilo", () => {
    const parse = (fields: Record<string, string>) => {
      const form = new FormData();
      for (const [key, value] of Object.entries(fields)) form.set(key, value);
      return parseProfile(form);
    };
    const profile = parse({ ...person, nome: " Mario ", ragione_sociale: "Ignorata" });
    expect(profile).toEqual({
      firstName: "Mario",
      lastName: "Rossi",
      accountType: "private",
      companyName: null,
    });
    expect(parse({ ...person, nome: "N".repeat(100), cognome: "C".repeat(100) })).not.toBeNull();
    expect(parse({ ...person, tipo: "azienda", ragione_sociale: "A".repeat(200) })).toMatchObject({
      accountType: "business",
      companyName: "A".repeat(200),
    });
    for (const fields of [
      { ...person, nome: "" },
      { ...person, nome: "N".repeat(101) },
      { ...person, cognome: "" },
      { ...person, cognome: "C".repeat(101) },
      { ...person, tipo: "altro" },
      { ...person, tipo: "azienda" },
      { ...person, tipo: "azienda", ragione_sociale: "A".repeat(201) },
    ])
      expect(parse(fields)).toBeNull();
    for (const termsAccepted of [false, true]) {
      expect(registrationComplete({ termsAccepted, profile: null })).toBe(false);
      expect(registrationComplete({ termsAccepted, profile })).toBe(termsAccepted);
    }
  });

  it("legge separatamente profilo e consenso e non scrive aggiornamenti vuoti", async () => {
    const { user } = await createAuth(env).api.signUpEmail({
      body: {
        name: "Utente profilo",
        email: "stato-profilo@example.invalid",
        password: "password-profilo-molto-lunga",
      },
    });
    expect(await registrationStatus(env.DB, user.id)).toEqual({
      termsAccepted: false,
      marketingChosen: false,
      profile: null,
    });
    await completeRegistration(env.DB, {
      userId: user.id,
      language: "it",
      now: new Date(now),
      profile: syntheticProfile,
    });
    expect(await registrationStatus(env.DB, user.id)).toEqual({
      termsAccepted: false,
      marketingChosen: false,
      profile: syntheticProfile,
    });
    await completeRegistration(env.DB, {
      userId: user.id,
      language: "it",
      now: new Date(now),
      agreement: { marketing: false },
    });
    expect(await registrationStatus(env.DB, user.id)).toEqual({
      termsAccepted: true,
      marketingChosen: true,
      profile: syntheticProfile,
    });
    const batch = vi.fn();
    await completeRegistration({ batch } as unknown as D1Database, {
      userId: user.id,
      language: "it",
      now: new Date(now),
    });
    expect(batch).not.toHaveBeenCalled();
  });

  it("registra senza consensi preselezionati, apre la sessione dal link e non rivela gli indirizzi già registrati", async () => {
    const email = "registrazione@example.invalid";
    const rejected = [
      [{ intent: "registrati", email, password, termini: "on" }, "dati"],
      [{ intent: "registrati", ...person, cognome: " ", email, password, termini: "on" }, "dati"],
      [{ intent: "registrati", ...person, email, password }, "termini"],
    ] as const;
    for (const [fields, outcome] of rejected) {
      const response = await accessForm("/accesso", fields);
      expect(response.headers.getSetCookie()).toEqual([]);
      // I valori tornano per ricompilare il modulo, la password mai.
      const error = await accessError(response);
      expect(error).toMatchObject({
        status: 400,
        key: outcome,
        tab: "registrati",
        values: { email },
      });
      expect(error.values).not.toHaveProperty("password");
    }
    expect(
      await env.DB.prepare('SELECT id FROM "user" WHERE email = ?').bind(email).first(),
    ).toBeNull();

    const send = vi.spyOn(env.AUTH_EMAIL, "send").mockResolvedValue({ messageId: "synthetic" });
    const register = (path: string) =>
      accessForm(path, { intent: "registrati", ...person, email, password, termini: "on" });
    const created = await register("/en/accesso");
    expect(created.status).toBe(303);
    expect(created.headers.get("location")).toBe("/en/accesso?accesso=registrato");
    expect(created.headers.getSetCookie()).toEqual([]);
    const user = await env.DB.prepare(
      'SELECT id, name, "emailVerified" FROM "user" WHERE email = ?',
    )
      .bind(email)
      .first<{ id: string; name: string; emailVerified: number }>();
    expect(user).toMatchObject({ name: "Mario Rossi", emailVerified: 0 });
    expect(await profileOf(user!.id)).toEqual({
      first_name: "Mario",
      last_name: "Rossi",
      account_type: "private",
      company_name: null,
    });
    expect(await agreements(user!.id)).toEqual({
      terms: [
        {
          terms_version: legalVersions.terms,
          privacy_version: legalVersions.privacy,
          language: "en",
        },
      ],
      marketing: [{ granted: 0, text_version: marketingTextVersions.registration, language: "en" }],
    });
    await vi.waitFor(() => expect(send).toHaveBeenCalledOnce());
    const confirmation = send.mock.calls[0]![0] as { to: string; subject: string; text: string };
    expect(confirmation).toMatchObject({
      to: email,
      subject: "Confirm your FiscalBay email address",
    });

    // Lo stesso indirizzo riceve la stessa risposta, senza sessione né nuovo account; il
    // titolare ne riceve avviso.
    const duplicate = await register("/accesso");
    expect(duplicate.headers.get("location")).toBe("/accesso?accesso=registrato");
    expect(duplicate.headers.getSetCookie()).toEqual([]);
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(2));
    expect(send.mock.calls[1]![0]).toMatchObject({
      to: email,
      subject: "Hai già un account FiscalBay",
    });
    // Dalla pagina inglese l'avviso è in inglese e porta all'accesso inglese.
    await register("/en/accesso");
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(3));
    expect(send.mock.calls[2]![0]).toMatchObject({
      to: email,
      subject: "You already have a FiscalBay account",
      text: expect.stringContaining("/en/accesso"),
    });
    expect(
      await env.DB.prepare('SELECT COUNT(*) AS total FROM "user" WHERE email = ?')
        .bind(email)
        .first(),
    ).toEqual({ total: 1 });
    expect((await agreements(user!.id)).marketing).toHaveLength(1);

    // Chi entra con la password prima della conferma esplora, ma non collega negozi.
    const cookie = sessionCookie(await accessForm("/accesso", { email, password }));
    expect(cookie).toContain("session_token");
    expect(await homeFor(cookie)).toMatchObject({
      account: { email },
      verified: false,
      page: { view: "no-store", orders: [], connectHref: null },
    });
    const link = await routeResponse(startStoreLink, "/app/negozi/collega", { cookie, fields: {} });
    expect(link.headers.get("location")).toBe("/app/ordini?negozio=accesso");
    expect(await storeLinkSessions()).toBe(0);

    // Il nuovo link passa dalla verifica Turnstile, come la registrazione.
    const unchecked = await accessForm(
      "/accesso",
      { intent: "verifica", [turnstileField]: "" },
      cookie,
    );
    expect(unchecked.headers.get("location")).toBe("/app/ordini?accesso=verifica-non-riuscita");
    const resent = await accessForm("/accesso", { intent: "verifica" }, cookie);
    expect(resent.headers.get("location")).toBe("/app/ordini?accesso=verifica-inviata");

    // Il link di conferma apre la sessione verificata.
    const verified = await handleAuthRequest(new Request(emailLink(confirmation.text)), env);
    expect(verified.headers.get("location")).toBe("/en/app/ordini");
    const verifiedCookie = sessionCookie(verified);
    expect(await homeFor(verifiedCookie)).toMatchObject({ verified: true });
    send.mockRestore();
  });

  it("risponde a un indirizzo già registrato senza attendere l'avviso, che resta nei log", async () => {
    const email = "gia-registrato@example.invalid";
    let release!: () => void;
    const delivery = new Promise<void>((resolve) => (release = resolve));
    // L'invio resta in corso finché la prova non lo rilascia, poi l'indirizzo risulta soppresso.
    const send = vi.fn<Env["AUTH_EMAIL"]["send"]>().mockImplementation(async () => {
      await delivery;
      throw Object.assign(new Error("synthetic"), { code: "E_RECIPIENT_SUPPRESSED" });
    });
    const mail = { ...env, AUTH_EMAIL: { send } } as unknown as Env;
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const logged = () => errors.mock.calls.map(([line]) => String(line)).join("\n");
    try {
      const request = new Request("http://localhost:5173/api/auth/sign-up/email", {
        method: "POST",
        body: JSON.stringify({ email, callbackURL: "/en/app/ordini" }),
      });
      // Come per un indirizzo nuovo, la risposta non aspetta il provider dell'email.
      const outcome = await Promise.race([
        sendExistingAccountEmail(mail, email, request).then(() => "risposta" as const),
        new Promise<"in attesa">((resolve) => setTimeout(() => resolve("in attesa"), 1_000)),
      ]);
      expect(outcome).toBe("risposta");
      expect(send).toHaveBeenCalledOnce();
      expect(send.mock.calls[0]![0]).toMatchObject({
        to: email,
        subject: "You already have a FiscalBay account",
      });
      expect(logged()).toBe("");
      release();
      await vi.waitFor(() => expect(logged()).toContain('"failure":"E_RECIPIENT_SUPPRESSED"'));
      expect(logged()).not.toContain(email);
    } finally {
      release();
      errors.mockRestore();
    }
  });

  it("registra un'azienda solo con la ragione sociale, senza dati fiscali", async () => {
    const email = "azienda@example.invalid";
    const business = { intent: "registrati", tipo: "azienda", nome: "Anna", cognome: "Bianchi" };
    const missing = await accessForm("/accesso", { ...business, email, password, termini: "on" });
    expect(await accessError(missing)).toMatchObject({ key: "dati", tab: "registrati" });

    const created = await accessForm("/accesso", {
      ...business,
      ragione_sociale: "  Bianchi Ricambi S.r.l. ",
      email,
      password,
      termini: "on",
    });
    expect(created.headers.get("location")).toBe("/accesso?accesso=registrato");
    const user = await env.DB.prepare('SELECT id FROM "user" WHERE email = ?')
      .bind(email)
      .first<{ id: string }>();
    expect(await profileOf(user!.id)).toEqual({
      first_name: "Anna",
      last_name: "Bianchi",
      account_type: "business",
      company_name: "Bianchi Ricambi S.r.l.",
    });

    // La ragione sociale di un privato non viene conservata.
    const privateUser = await accessForm("/accesso", {
      intent: "registrati",
      ...person,
      ragione_sociale: "Ignorata",
      email: "privato@example.invalid",
      password,
      termini: "on",
    });
    const privateId = await env.DB.prepare('SELECT id FROM "user" WHERE email = ?')
      .bind("privato@example.invalid")
      .first<{ id: string }>();
    expect(privateUser.headers.get("location")).toBe("/accesso?accesso=registrato");
    expect(await profileOf(privateId!.id)).toMatchObject({ company_name: null });
  });

  it("chiede profilo e Termini a chi entra senza averli completati prima di mostrare ordini o collegare negozi", async () => {
    const auth = createAuth(env);
    const email = "senza-termini@example.invalid";
    await auth.handler(
      new Request("http://localhost:5173/api/auth/sign-up/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Luca De Santis", email, password }),
      }),
    );
    const user = await env.DB.prepare('SELECT id FROM "user" WHERE email = ?')
      .bind(email)
      .first<{ id: string }>();
    await env.DB.prepare('UPDATE "user" SET "emailVerified" = 1 WHERE id = ?').bind(user!.id).run();
    const cookie = sessionCookie(await accessForm("/accesso", { email, password }));

    // Gli Ordini rimandano all'accesso, che chiede ciò che manca.
    await expect(homeFor(cookie)).rejects.toSatisfy(
      (response: Response) => response.headers.get("location") === "/accesso",
    );
    expect(await accessFor(cookie)).toMatchObject({
      authenticated: true,
      needsProfile: true,
      needsAgreement: true,
      needsMarketing: true,
      suggestedName: { firstName: "Luca", lastName: "De Santis" },
    });
    // Anche uno username eBay con spazi non prova nome e cognome della persona.
    await env.DB.prepare(
      'INSERT INTO "account" (id, "accountId", "providerId", "userId", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?)',
    )
      .bind("ebay-profilo", "ebay-profilo", "ebay", user!.id, now, now)
      .run();
    expect(await accessFor(cookie)).toMatchObject({
      needsProfile: true,
      suggestedName: { firstName: "", lastName: "" },
    });
    const blocked = await routeResponse(startStoreLink, "/app/negozi/collega", {
      cookie,
      fields: {},
    });
    expect(blocked.headers.get("location")).toBe("/accesso");
    expect(await storeLinkSessions()).toBe(0);

    const complete = async (fields: Record<string, string>) => {
      const response = await accessForm("/accesso", { intent: "completa", ...fields }, cookie);
      return response.headers.get("location") ?? (await accessError(response)).key;
    };
    expect(await complete({ termini: "on" })).toBe("dati");
    expect(await complete({ ...person, marketing: "on" })).toBe("termini");
    expect(await agreements(user!.id)).toEqual({ terms: [], marketing: [] });
    expect(await complete({ ...person, termini: "on", marketing: "on" })).toBe("/app/ordini");
    expect(await profileOf(user!.id)).toMatchObject({ first_name: "Mario", last_name: "Rossi" });
    expect(await agreements(user!.id)).toEqual({
      terms: [
        {
          terms_version: legalVersions.terms,
          privacy_version: legalVersions.privacy,
          language: "it",
        },
      ],
      marketing: [{ granted: 1, text_version: marketingTextVersions.registration, language: "it" }],
    });
    expect(await homeFor(cookie)).toMatchObject({
      verified: true,
      account: { name: "Mario Rossi" },
    });
    await expect(accessFor(cookie)).rejects.toSatisfy(
      (response: Response) => response.headers.get("location") === "/app/ordini",
    );
    expect((await beginStoreLink(cookie)).hostname).toBe("auth.ebay.com");

    // Le registrazioni precedenti usavano l'email come nome: non va proposta come nome.
    const legacyEmail = "nome-email@example.invalid";
    await auth.handler(
      new Request("http://localhost:5173/api/auth/sign-up/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: legacyEmail, email: legacyEmail, password }),
      }),
    );
    const legacy = sessionCookie(await accessForm("/accesso", { email: legacyEmail, password }));
    expect(await accessFor(legacy)).toMatchObject({
      needsProfile: true,
      suggestedName: { firstName: "", lastName: "" },
    });
  });

  it("chiede di nuovo i soli Termini a chi ha già scelto sul marketing, senza toccarne la scelta", async () => {
    const { cookie, userId } = await verifiedSession("nuovi-termini@example.invalid");
    await env.DB.batch([
      env.DB.prepare("DELETE FROM marketing_consents WHERE user_id = ?").bind(userId),
      env.DB.prepare(
        `INSERT INTO marketing_consents (id, user_id, granted, text_version, language, recorded_at)
         VALUES ('adesione', ?1, 1, ?2, 'it', ?3)`,
      ).bind(userId, marketingTextVersions.settings, now),
      // Una nuova versione dei Termini: quella accettata non è più la corrente.
      env.DB.prepare(
        "UPDATE terms_acceptances SET terms_version = 'bozza-precedente' WHERE user_id = ?",
      ).bind(userId),
    ]);
    expect(await accessFor(cookie)).toMatchObject({
      needsProfile: false,
      needsAgreement: true,
      needsMarketing: false,
    });
    // Anche un campo marketing inviato a mano non registra una nuova scelta.
    const response = await accessForm("/accesso", { intent: "completa", termini: "on" }, cookie);
    expect(response.headers.get("location")).toBe("/app/ordini");
    await accessForm("/accesso", { intent: "completa", termini: "on", marketing: "on" }, cookie);
    const { terms, marketing } = await agreements(userId);
    expect(terms.map((row) => row.terms_version).sort()).toEqual(
      ["bozza-precedente", legalVersions.terms].sort(),
    );
    expect(marketing).toEqual([
      { granted: 1, text_version: marketingTextVersions.settings, language: "it" },
    ]);
  });

  it("con Auth o database non disponibili l'accesso risponde 503 senza incolpare email e password", async () => {
    const email = "accesso-guasto@example.invalid";
    const password = "Una-password-negozio-molto-lunga";
    const { cookie } = await verifiedSession(email);
    const person = { tipo: "privato", nome: "Mario", cognome: "Rossi" };
    const outcome = (handler: typeof signIn, options = {}) =>
      callRoute(handler, "/accesso", options).catch((error: unknown) => error);
    const page = (options = {}) =>
      callRoute(loadAccess, "/accesso", options).catch((error: unknown) => error);
    const unavailable = {
      data: null,
      init: { status: 503, headers: { "cache-control": "no-store", "retry-after": "60" } },
    };
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const prepare = vi.spyOn(env.DB, "prepare").mockImplementation(() => {
      throw new Error("D1_ERROR: unavailable");
    });
    try {
      // Senza sessione la pagina non legge il database: il modulo resta.
      expect(await page()).toMatchObject({ authenticated: false });
      expect(await page({ cookie })).toMatchObject(unavailable);
      for (const fields of [
        { email, password },
        { intent: "registrati", ...person, email: "nuovo-guasto@example.invalid", password },
      ]) {
        expect(
          await outcome(signIn, { fields: { termini: "on", ...fields }, cookie }),
        ).toMatchObject(unavailable);
      }
      // L'uscita cancella comunque il cookie della sessione.
      const exit = (await outcome(signIn, { fields: { intent: "esci" }, cookie })) as Response;
      expect([exit.status, exit.headers.get("location")]).toEqual([303, "/"]);
      expect(exit.headers.get("set-cookie")).toContain("Max-Age=0");
      expect(new Set(log.mock.calls.map(([line]) => JSON.parse(String(line)).code))).toEqual(
        new Set(["UPSTREAM_UNAVAILABLE"]),
      );
    } finally {
      prepare.mockRestore();
      log.mockRestore();
    }
  });

  it("limita per IP i tentativi dei moduli su un ambiente distribuito, contando su D1", async () => {
    const deployed = { ...env, APP_ORIGIN: "https://test.fiscalbay.it" as const };
    const attempt = (ip: string) =>
      forwardToAuth(
        deployed,
        new Request("https://test.fiscalbay.it/accesso", {
          method: "POST",
          headers: { origin: "https://test.fiscalbay.it", "cf-connecting-ip": ip },
        }),
        "/sign-in/email",
        { email: "tentativi@example.invalid", password: "password-sbagliata-lunga" },
      ).then((response) => response.status);

    const statuses = [];
    for (let index = 0; index < 4; index += 1) statuses.push(await attempt("203.0.113.7"));
    expect(statuses).toEqual([401, 401, 401, 429]);
    expect(await attempt("203.0.113.8")).toBe(401);
    // La route diretta condivide il contatore; la lettura della sessione non ne scrive.
    const direct = await handleAuthRequest(
      new Request("https://test.fiscalbay.it/api/auth/sign-in/email", {
        method: "POST",
        headers: {
          origin: "https://test.fiscalbay.it",
          "content-type": "application/json",
          "cf-connecting-ip": "203.0.113.7",
        },
        body: JSON.stringify({ email: "tentativi@example.invalid", password: "altra-password" }),
      }),
      deployed,
    );
    expect(direct.status).toBe(429);
    expect(direct.headers.get("retry-after")).toMatch(/^\d+$/u);
    for (let index = 0; index < 3; index += 1) {
      const session = await handleAuthRequest(
        new Request("https://test.fiscalbay.it/api/auth/get-session", {
          headers: { "cf-connecting-ip": "203.0.113.7" },
        }),
        deployed,
      );
      expect(session.status).toBe(200);
    }
    // Gli indirizzi della stessa rete IPv6 /64 condividono il contatore.
    const ipv6 = [
      "2001:db8:1:2::1",
      "2001:db8:1:2:aa:bb:cc:dd",
      "2001:db8:1:2::9",
      "2001:db8:1:2::ff",
    ];
    const ipv6Statuses = [];
    for (const ip of ipv6) ipv6Statuses.push(await attempt(ip));
    expect(ipv6Statuses).toEqual([401, 401, 401, 429]);
    const counters = await env.DB.prepare('SELECT COUNT(*) AS total FROM "rateLimit"').first<{
      total: number;
    }>();
    // Due IP, una rete IPv6 e l'indirizzo email, contato solo per i tentativi ammessi per IP.
    expect(counters!.total).toBe(4);

    // Una finestra scaduta riparte da uno invece di restare bloccata.
    await env.DB.prepare('UPDATE "rateLimit" SET "lastRequest" = "lastRequest" - 60000').run();
    expect(await attempt("203.0.113.7")).toBe(401);
    const reset = await env.DB.prepare('SELECT "count" FROM "rateLimit" WHERE "key" LIKE ?')
      .bind("203.0.113.7%")
      .first<{ count: number }>();
    expect(reset!.count).toBe(1);
  });

  it("avvia l'accesso Google dal modulo con il callback dell'ambiente", async () => {
    const response = await accessForm("/accesso", { intent: "google" });
    expect(response.status).toBe(303);
    const location = new URL(response.headers.get("location")!);
    expect(location.hostname).toBe("accounts.google.com");
    expect(location.searchParams.get("redirect_uri")).toBe(
      "http://localhost:5173/api/auth/callback/google",
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("avvia eBay dal modulo e richiede una sessione verificata per collegarlo", async () => {
    const response = await accessForm("/en/accesso", { intent: "ebay" });
    expect(response.status).toBe(303);
    const location = new URL(response.headers.get("location")!);
    expect(location.hostname).toBe("auth.ebay.com");
    expect(location.searchParams.get("scope")!.split(" ")).toEqual([
      "https://api.ebay.com/oauth/api_scope",
      "https://api.ebay.com/oauth/api_scope/commerce.identity.readonly",
    ]);
    const refused = await securityForm("/en/app/impostazioni/sicurezza", {
      intent: "collega-metodo",
      metodo: "ebay",
    });
    expect(refused.headers.get("location")).toBe("/en/accesso");
    const session = await verifiedSession("link-modulo@example.invalid");
    const allowed = await securityForm(
      "/app/impostazioni/sicurezza",
      { intent: "collega-metodo", metodo: "ebay" },
      session.cookie,
    );
    expect(allowed.status).toBe(303);
    expect(new URL(allowed.headers.get("location")!).hostname).toBe("auth.ebay.com");
  });

  it("pubblica la versione dei Termini e dell'informativa accettate", async () => {
    expect(await routeData(loadLegal, "/en/privacy")).toMatchObject({
      language: "en",
      document: "privacy",
      version: legalVersions.privacy,
    });
    expect(await routeData(loadLegal, "/termini")).toMatchObject({
      language: "it",
      document: "termini",
      version: legalVersions.terms,
    });
  });

  it("conserva provider e lingua nel ritorno di un accesso OAuth rifiutato", async () => {
    for (const provider of ["google", "ebay"]) {
      const start = await accessForm("/en/accesso", { intent: provider });
      const state = new URL(start.headers.get("location")!).searchParams.get("state")!;
      const cookie = sessionCookie(start);
      const result = await handleAuthRequest(
        new Request(
          `http://localhost:5173/api/auth/callback/${provider}?error=access_denied&state=${encodeURIComponent(state)}`,
          { headers: { cookie } },
        ),
        env,
      );
      const destination = new URL(result.headers.get("location")!, "http://localhost:5173");
      expect(destination.pathname).toBe("/en/auth/error");
      expect(destination.searchParams.get("provider")).toBe(provider);
      expect(destination.searchParams.get("error")).toBe("access_denied");
    }
  });
});

describe("Turnstile sugli ingressi pubblici", () => {
  // Gli utenti restano fra le prove: ognuna usa un proprio indirizzo.
  let email: string;
  const signUp = (fields: Record<string, string> = {}) =>
    accessForm("/accesso", {
      intent: "registrati",
      tipo: "privato",
      nome: "Mario",
      cognome: "Rossi",
      email,
      password: "Una-password-registrazione-lunga",
      termini: "on",
      ...fields,
    });
  const created = () => env.DB.prepare('SELECT id FROM "user" WHERE email = ?').bind(email).first();
  let send: MockInstance<SendEmail["send"]>;
  beforeEach(() => {
    email = `turnstile-${crypto.randomUUID()}@example.invalid`;
    send = vi.spyOn(env.AUTH_EMAIL, "send").mockResolvedValue({ messageId: "synthetic" });
  });
  afterEach(() => send.mockRestore());

  it("registra con il token del modulo verificato da Siteverify con la chiave dell'ambiente", async () => {
    expect((await signUp()).headers.get("location")).toBe("/accesso?accesso=registrato");
    expect(siteverify.requests).toEqual([
      { secret: env.TURNSTILE_SECRET_KEY, response: testToken },
    ]);
    expect(await created()).not.toBeNull();
  });

  it.each([
    ["assente", { [turnstileField]: "" }, null, 400, "verifica-non-riuscita"],
    [
      "scaduto o già usato",
      {},
      { success: false, "error-codes": ["timeout-or-duplicate"] },
      400,
      "verifica-non-riuscita",
    ],
    [
      "di un altro hostname",
      {},
      { success: true, hostname: "fiscalbay.it", action: "sign-up" },
      400,
      "verifica-non-riuscita",
    ],
    ["con Siteverify indisponibile", {}, 503, 503, "verifica-non-disponibile"],
  ] as const)(
    "rifiuta la registrazione con token %s, senza account né email",
    async (_, fields, answer, status, key) => {
      if (answer !== null)
        siteverify.answer = () =>
          typeof answer === "number"
            ? new Response(null, { status: answer })
            : Response.json(answer);
      const error = await accessError(await signUp(fields));
      // I dati tornano per riprovare, senza password né token.
      expect(error).toMatchObject({ status, key, tab: "registrati", values: { email } });
      expect(error.values).not.toHaveProperty("password");
      expect(error.values).not.toHaveProperty(turnstileField);
      expect(siteverify.requests).toHaveLength(answer === null ? 0 : 1);
      expect(await created()).toBeNull();
      expect(send).not.toHaveBeenCalled();
    },
  );

  it("chiede la verifica al recupero della password, non all'accesso con Google o eBay", async () => {
    const recovery = (fields: Record<string, string> = {}) =>
      accessForm("/accesso", { intent: "recupera-password", email, ...fields });
    expect((await recovery({ [turnstileField]: "" })).headers.get("location")).toBe(
      "/accesso?accesso=verifica-non-riuscita",
    );
    siteverify.answer = () => Response.json({}, { status: 500 });
    expect((await recovery()).headers.get("location")).toBe(
      "/accesso?accesso=verifica-non-disponibile",
    );
    expect(send).not.toHaveBeenCalled();

    siteverify.requests.length = 0;
    for (const intent of ["google", "ebay"]) {
      expect((await accessForm("/accesso", { intent, [turnstileField]: "" })).status).toBe(303);
    }
    expect(siteverify.requests).toEqual([]);
  });

  it("non accetta registrazione, recupero e nuovo link chiamati direttamente su Auth", async () => {
    for (const path of ["sign-up/email", "request-password-reset", "send-verification-email"]) {
      const response = await handleAuthRequest(
        new Request(`http://localhost:5173/api/auth/${path}`, {
          method: "POST",
          headers: { "content-type": "application/json", origin: "http://localhost:5173" },
          body: JSON.stringify({ name: "Diretto", email, password: "Password-diretta-123!" }),
        }),
        env,
      );
      expect(response.status).toBe(404);
    }
    expect(await created()).toBeNull();
    expect(send).not.toHaveBeenCalled();
  });
});
