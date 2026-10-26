import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forwardToAuth } from "../app/auth-route.server";
import {
  completeRegistration,
  legalVersions,
  parseProfile,
  registrationComplete,
  registrationStatus,
} from "../app/domain/registration.server";
import { createAuth } from "../app/auth.server";
import { handleAuthRequest } from "../app/auth-route.server";
import { loader as loadLegal } from "../app/routes/legal";
import { loader as loadAccess } from "../app/routes/sign-in";
import { action as startStoreLink } from "../app/routes/store-link";
import { accessNotice } from "../app/access-notice";
import { now, resetDatabase } from "./fixtures/database-fixtures";
import {
  syntheticProfile,
  verifiedSession,
  sessionCookie,
  profileOf,
} from "./fixtures/account-fixtures";
import { accessFor, accessForm, securityForm, homeFor } from "./fixtures/account-route-fixtures";
import { beginStoreLink, storeLinkSessions } from "./fixtures/store-link-fixtures";

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
      const page = await loadAccess({
        request: new Request(`http://localhost:5173${prefix}/accesso`),
      } as Parameters<typeof loadAccess>[0]);
      expect(page).toMatchObject({ registrationRestricted: true });
      const response = await accessForm(`${prefix}/accesso`, {
        intent: "registrati",
        ...person,
        email: "non-invitato@example.invalid",
        password,
        termini: "on",
      });
      expect(response.status).toBe(303);
      expect(response.headers.get("location")).toBe(`${prefix}/accesso?accesso=autorizzazione`);
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
      expect(response.headers.get("location")).toBe(`/accesso?accesso=${outcome}`);
      expect(response.headers.getSetCookie()).toEqual([]);
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
      marketing: [{ granted: 0, text_version: legalVersions.marketing, language: "en" }],
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
    const link = (await startStoreLink({
      request: new Request("http://localhost:5173/app/negozi/collega", {
        method: "POST",
        headers: { cookie, origin: "http://localhost:5173" },
      }),
    } as Parameters<typeof startStoreLink>[0])) as Response;
    expect(link.headers.get("location")).toBe("/app/ordini?negozio=accesso");
    expect(await storeLinkSessions()).toBe(0);

    const resent = await accessForm("/accesso", { intent: "verifica" }, cookie);
    expect(resent.headers.get("location")).toBe("/app/ordini?accesso=verifica-inviata");

    // Il link di conferma apre la sessione verificata.
    const verified = await handleAuthRequest(
      new Request(confirmation.text.split("\n").at(-1)!),
      env,
    );
    expect(verified.headers.get("location")).toBe("/en/app/ordini");
    const verifiedCookie = sessionCookie(verified);
    expect(await homeFor(verifiedCookie)).toMatchObject({ verified: true });
    send.mockRestore();
  });

  it("registra un'azienda solo con la ragione sociale, senza dati fiscali", async () => {
    const email = "azienda@example.invalid";
    const business = { intent: "registrati", tipo: "azienda", nome: "Anna", cognome: "Bianchi" };
    const missing = await accessForm("/accesso", { ...business, email, password, termini: "on" });
    expect(missing.headers.get("location")).toBe("/accesso?accesso=dati");

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
    const blocked = (await startStoreLink({
      request: new Request("http://localhost:5173/app/negozi/collega", {
        method: "POST",
        headers: { cookie, origin: "http://localhost:5173" },
      }),
    } as Parameters<typeof startStoreLink>[0])) as Response;
    expect(blocked.headers.get("location")).toBe("/accesso");
    expect(await storeLinkSessions()).toBe(0);

    const complete = (fields: Record<string, string>) =>
      accessForm("/accesso", { intent: "completa", ...fields }, cookie).then((response) =>
        response.headers.get("location"),
      );
    expect(await complete({ termini: "on" })).toBe("/accesso?accesso=dati");
    expect(await complete({ ...person, marketing: "on" })).toBe("/accesso?accesso=termini");
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
      marketing: [{ granted: 1, text_version: legalVersions.marketing, language: "it" }],
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

  it("limita per IP i tentativi dei moduli su un ambiente distribuito, contando su D1", async () => {
    const deployed = { ...env, APP_ORIGIN: "https://test.fiscalbay.it" };
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
    expect(
      await loadLegal({
        request: new Request("http://localhost:5173/en/privacy"),
      } as Parameters<typeof loadLegal>[0]),
    ).toEqual({ language: "en", document: "privacy", version: legalVersions.privacy });
    expect(
      await loadLegal({
        request: new Request("http://localhost:5173/termini"),
      } as Parameters<typeof loadLegal>[0]),
    ).toEqual({ language: "it", document: "termini", version: legalVersions.terms });
  });

  it("conserva provider e lingua nel ritorno di un accesso OAuth rifiutato", async () => {
    for (const provider of ["google", "ebay"]) {
      const start = await accessForm("/en/accesso", { intent: provider });
      const state = new URL(start.headers.get("location")!).searchParams.get("state")!;
      const cookie = start.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .join("; ");
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
