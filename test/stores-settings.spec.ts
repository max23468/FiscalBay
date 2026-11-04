import { env } from "cloudflare:workers";

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from "vitest";

import { marketingTextVersions } from "../app/domain/registration.server";

import { revokeSession } from "../app/domain/sessions.server";

import { action as storesAction } from "../app/routes/stores";

import { action as settingsAction } from "../app/routes/settings";

import { action as languageAction } from "../app/routes/language";

import { action as ordersAction } from "../app/routes/orders";

import { action as orderExportAction } from "../app/routes/order-export";

import { requestLimitRules } from "../app/request-limits";
import { fakeRateLimiters } from "./fixtures/rate-limiter";

import { action as notificationsAction } from "../app/routes/notifications";

import { appCopy, supportEmail } from "../app/app-copy";

import type { ActionResult } from "../app/view-models";

import { purgeExpiredRecords } from "../app/domain/maintenance.server";

import { supportRequestLimit } from "../app/domain/support-requests.server";

import { maxSupportMessage, supportFields } from "../app/support";

import { insertStore, insertWorkspace, now } from "./fixtures/database-fixtures";

import { verifiedSession } from "./fixtures/account-fixtures";

import { homeFor } from "./fixtures/account-route-fixtures";

import { siteverify } from "./fixtures/turnstile-fixtures";

import { turnstileField } from "../app/turnstile";

import { areaShell, callRoute, routeResponse } from "./fixtures/route-fixtures";

import {
  day,
  linkedSeller,
  count,
  origin,
  settings,
  settingsPage,
  saveSetting,
  setupScenarios,
} from "./fixtures/stores-scenarios";

setupScenarios();

it("apre le Impostazioni reali con le sole categorie che hanno un servizio", async () => {
  const seller = await verifiedSession("impostazioni@example.invalid");
  const loaded = await settingsPage(seller.cookie);
  expect(loaded.page).toMatchObject({
    section: null,
    sections: [
      "notifiche",
      "esportazione",
      "messaggio",
      "account",
      "piano",
      "privacy",
      "aspetto",
      "supporto",
    ],
    // Con chiave e prezzi Stripe configurati il piano offre acquisto e portale clienti; con il
    // bot dell'ambiente compaiono le notifiche Telegram.
    services: {
      billing: true,
      billingPortal: true,
      telegram: true,
    },
    account: { plan: "free", trialAvailable: false, quota: undefined },
    preferences: { theme: "system", timeZone: "auto", detectedTimeZone: null, marketing: false },
    // Senza negozi il riepilogo lo dice; la versione viene dal deploy.
    diagnostics: {
      version: expect.any(String),
      storeRef: null,
      syncPhase: "Nessun negozio collegato",
      errorCode: null,
      rights: "Free",
      correlationId: expect.stringMatching(/^[0-9a-f-]{36}$/u),
    },
    // L'elenco delle Novità versionato è vuoto: Supporto non collega la pagina.
    whatsNew: false,
  });
  expect(loaded.page.preferences.templates.it).toContain("{ordine}");
  const missing = await settings(seller.cookie, "/app/impostazioni/inesistente", "inesistente");
  expect(missing).toMatchObject({ init: { status: 404 }, data: { notFound: true } });
  // Senza email confermata l'area rimanda agli Ordini, che spiegano come proseguire.
  await env.DB.prepare('UPDATE "user" SET "emailVerified" = 0 WHERE id = ?')
    .bind(seller.userId)
    .run();
  expect(((await settings(seller.cookie)) as Response).headers.get("location")).toBe("/app/ordini");
});

it("la quota personale mostra il proprio ciclo e la quota diversa del ciclo seguente", async () => {
  // Primo collegamento il 13 settembre alle 20:00 UTC; la promozione finisce il 15.
  vi.setSystemTime(new Date(now));
  await env.DB.prepare(
    `INSERT INTO free_promotions (id, starts_at, ends_at, quota, created_at)
       VALUES ('lancio', '2026-09-01T00:00:00.000Z', '2026-09-15T00:00:00.000Z', 10, ?1)`,
  )
    .bind(now)
    .run();
  const seller = await linkedSeller("promozione@example.invalid");
  expect((await settingsPage(seller.cookie)).page.account.quota).toEqual({
    used: 0,
    limit: 10,
    cycleEndsAt: "2026-09-20T20:00:00.000Z",
    nextLimit: 5,
  });
  // Il ciclo seguente inizia dopo la promozione e torna alla quota base.
  vi.setSystemTime(new Date("2026-09-20T20:00:00.000Z"));
  expect((await settingsPage(seller.cookie)).page.account.quota).toEqual({
    used: 0,
    limit: 5,
    cycleEndsAt: "2026-09-27T20:00:00.000Z",
  });
  expect(appCopy.it.settings.plan.nextCycleLimit(5)).toBe("Il prossimo ciclo avrà 5 sblocchi.");
});

it("salva tema, fuso e consenso a ogni scelta e rifiuta valori non ammessi", async () => {
  const seller = await verifiedSession("scelte@example.invalid");
  const save = (name: string, value: string) =>
    saveSetting(seller.cookie, { intent: "save", name, value });
  expect(await save("theme", "dark")).toEqual({ ok: true });
  expect(await save("time-zone", "America/New_York")).toEqual({ ok: true });
  expect(await save("marketing", "true")).toEqual({ ok: true });
  for (const [name, value] of [
    ["theme", "sepia"],
    ["time-zone", "Mars/Olympus"],
    ["marketing", "forse"],
    ["language", "en"],
    ["telegram", "forse"],
  ]) {
    expect(await save(name, value)).toMatchObject({ init: { status: 400 }, data: { ok: false } });
  }
  const foreign = await saveSetting(
    seller.cookie,
    { intent: "save", name: "theme", value: "light" },
    "https://estraneo.invalid",
  );
  expect((foreign as Response).status).toBe(403);
  const loaded = await settingsPage(seller.cookie);
  expect(loaded.page.preferences).toMatchObject({
    theme: "dark",
    timeZone: "America/New_York",
    marketing: true,
  });
  // Tema e fuso valgono in tutta l'area, con le date nel fuso scelto.
  expect((await areaShell(seller.cookie)).display).toEqual({
    theme: "dark",
    timeZone: "America/New_York",
  });
  expect(await save("theme", "system")).toEqual({ ok: true });
  expect(await save("marketing", "false")).toEqual({ ok: true });
  expect(
    await env.DB.prepare("SELECT theme, time_zone FROM user_preferences WHERE user_id = ?")
      .bind(seller.userId)
      .first(),
  ).toEqual({ theme: null, time_zone: "America/New_York" });
  // Ogni scelta del consenso resta come prova; vale l'ultima.
  const { results } = await env.DB.prepare(
    "SELECT granted, text_version, language FROM marketing_consents WHERE user_id = ? ORDER BY rowid",
  )
    .bind(seller.userId)
    .all();
  expect(results).toEqual([
    { granted: 0, text_version: marketingTextVersions.registration, language: "it" },
    { granted: 1, text_version: marketingTextVersions.settings, language: "it" },
    { granted: 0, text_version: marketingTextVersions.settings, language: "it" },
  ]);
  expect((await settingsPage(seller.cookie)).page.preferences.marketing).toBe(false);
});

describe("modulo di assistenza", () => {
  const request = (cookie: string, fields: Record<string, string> = {}) =>
    saveSetting(cookie, {
      intent: "support",
      topic: "stores",
      message: "Il negozio non si aggiorna.",
      diagnostics: "true",
      ...fields,
    });
  // Un solo sostituto per il gruppo: ogni prova riparte da un elenco di invii vuoto.
  let send: MockInstance<SendEmail["send"]>;
  beforeAll(() => {
    send = vi.spyOn(env.AUTH_EMAIL, "send");
  });
  beforeEach(() => {
    send.mockReset();
    send.mockResolvedValue({ messageId: "synthetic" });
  });
  afterAll(() => send.mockRestore());
  // Anche la conferma dell'email della registrazione passa dallo stesso invio.
  const toSupport = () =>
    send.mock.calls
      .map(([message]) => message as Sent)
      .filter((message) => message.to === supportEmail);
  type Sent = { from: unknown; to: string; replyTo: string; subject: string; text: string };

  it("invia a supporto@ il messaggio con il riepilogo del solo spazio dell'utente", async () => {
    const seller = await linkedSeller("assistenza@example.invalid");
    await env.DB.batch(
      insertWorkspace({ id: "w-altro", name: "Altro", createdAt: new Date().toISOString() }),
    );
    await insertStore({ id: "negozio-altrui", workspaceId: "w-altro" }).run();
    // Senza lo storico delle ultime letture vale l'ultima riuscita, mai «in attesa».
    await env.DB.prepare("DELETE FROM sync_runs").run();
    const shown = (await settingsPage(seller.cookie)).page.diagnostics;
    expect(shown).toEqual({
      version: expect.any(String),
      storeRef: seller.storeId,
      syncPhase: expect.stringMatching(/^Aggiornamento riuscito, /u),
      errorCode: null,
      rights: expect.stringMatching(/^Free/u),
      correlationId: expect.stringMatching(/^[0-9a-f-]{36}$/u),
    });
    // Il modulo invia il riferimento che mostra: l'assistenza riceve lo stesso.
    expect(
      await request(seller.cookie, {
        message: " Riga\u0007 uno\r\nRiga due ",
        reference: shown!.correlationId,
      }),
    ).toEqual({ ok: true });
    const [sent] = toSupport();
    expect(sent!).toMatchObject({
      from: { email: expect.stringMatching(/^noreply@/u), name: "FiscalBay" },
      to: supportEmail,
      replyTo: "assistenza@example.invalid",
      subject: "Assistenza FiscalBay (localhost:5173): Collegamento negozi",
    });
    const [head, summary] = sent!.text.split("\n--\n");
    expect(head).toBe(
      [
        "Argomento: Collegamento negozi",
        `Account: ${seller.userId}`,
        "Email: assistenza@example.invalid",
        "Lingua: it",
        "",
        "Riga uno\nRiga due",
        "",
      ].join("\n"),
    );
    // Soltanto i campi allowlistati, riletti sul server: niente nomi eBay, ordini o altri spazi.
    expect(summary!.split("\n").map((line) => line.split(": ")[0])).toEqual([
      "Versione",
      "Negozio",
      "Sincronizzazione",
      "Codice errore",
      "Piano",
      "Riferimento",
    ]);
    expect(summary).toContain(`Negozio: ${seller.storeId}`);
    expect(summary).toContain(`Riferimento: ${shown!.correlationId}`);
    expect(sent!.text).not.toMatch(/negozio-altrui|venditore/u);
    expect(await count("support_requests")).toBe(1);
    // Un riferimento senza la forma di un correlation ID non entra nell'email: vale quello
    // dell'invio.
    expect(await request(seller.cookie, { reference: "riferimento<inventato>" })).toEqual({
      ok: true,
    });
    expect(toSupport()[1]!.text).toMatch(/\nRiferimento: [\da-f]{8}-[\da-f-]{27}$/u);
    expect(toSupport()[1]!.text).not.toContain("inventato");
  });

  it("il modulo allega il riepilogo dalla casella spuntata, con il riferimento mostrato", () => {
    // La casella spuntata vale «on», come la invia il browser.
    const form = (checked: boolean) => {
      const data = new FormData();
      if (checked) data.set("diagnostics", "on");
      return data;
    };
    const reference = "c0a8f3e1-5b2d-4e7a-9c11-7d2f0b6e4a90";
    const input = { topic: "orders", message: "Testo", reference };
    expect(supportFields(form(true), input)).toEqual({
      topic: "orders",
      message: "Testo",
      diagnostics: "true",
      reference,
    });
    expect(supportFields(form(false), input)).toEqual({
      topic: "orders",
      message: "Testo",
      diagnostics: "false",
    });
    // Senza riepilogo mostrato non c'è nulla da allegare.
    expect(supportFields(form(true), { ...input, reference: null })).toMatchObject({
      diagnostics: "false",
    });
  });

  it("con il riepilogo non leggibile la richiesta parte lo stesso", async () => {
    const seller = await linkedSeller("senza-riepilogo@example.invalid");
    const prepare = env.DB.prepare.bind(env.DB);
    const statement = vi.spyOn(env.DB, "prepare").mockImplementation((query: string) => {
      // La lettura dei negozi, riconosciuta da una colonna che soltanto lei calcola.
      if (query.includes("AS inactive_since")) throw new Error("synthetic");
      return prepare(query);
    });
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await settingsPage(seller.cookie)).page.diagnostics).toBeNull();
    expect(await request(seller.cookie)).toEqual({ ok: true });
    expect(toSupport()[0]!.text).toContain(
      "Riepilogo diagnostico non disponibile al momento dell'invio.",
    );
    expect(errors).toHaveBeenCalled();
    for (const spy of [errors, statement]) spy.mockRestore();
  });

  it("rifiuta richieste non valide, limita gli invii e non conta quelli non riusciti", async () => {
    const seller = await verifiedSession("limite@example.invalid");
    const t = appCopy.it.settings.support;
    expect(await request(seller.cookie, { diagnostics: "false" })).toEqual({ ok: true });
    expect(toSupport()[0]!.text).toContain("Riepilogo diagnostico non allegato.");
    // Il messaggio al limite esatto parte intero; un carattere in più no.
    const longest = "x".repeat(maxSupportMessage);
    expect(await request(seller.cookie, { message: longest })).toEqual({ ok: true });
    expect(toSupport()[1]!.text).toContain(`\n${longest}\n`);
    const invalid: Record<string, string>[] = [
      { topic: "spam" },
      { message: " \n " },
      { message: "x".repeat(4001) },
    ];
    for (const fields of invalid)
      expect(await request(seller.cookie, fields)).toMatchObject({
        init: { status: 400 },
        data: { ok: false, notice: t.invalid },
      });
    // Un rifiuto del provider resta nei log con il suo codice e non consuma il limite.
    let refused = false;
    send.mockImplementation(async (message) => {
      if (refused || (message as Sent).to !== supportEmail) return { messageId: "synthetic" };
      refused = true;
      throw Object.assign(new Error("synthetic"), { code: "E_RATE_LIMIT_EXCEEDED" });
    });
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await request(seller.cookie)).toMatchObject({
      init: { status: 503 },
      data: { ok: false, notice: t.sendFailed },
    });
    expect(errors.mock.calls.join("\n")).toContain('"failure":"E_RATE_LIMIT_EXCEEDED"');
    for (let sent = 2; sent < supportRequestLimit; sent++)
      expect(await request(seller.cookie)).toEqual({ ok: true });
    expect(await request(seller.cookie)).toMatchObject({
      init: { status: 429 },
      data: { ok: false, notice: t.limited },
    });
    expect(toSupport()).toHaveLength(supportRequestLimit + 1);
    // La manutenzione elimina gli istanti oltre le 24 ore.
    await purgeExpiredRecords(env.DB, new Date(Date.now() + day + 1000));
    expect(await count("support_requests")).toBe(0);
    errors.mockRestore();
  });

  it("chiede la verifica Turnstile prima del limite e dell'invio", async () => {
    const seller = await verifiedSession("verifica-supporto@example.invalid");
    const notices = appCopy.it.access.signInNotices;
    expect(await request(seller.cookie, { [turnstileField]: "" })).toMatchObject({
      init: { status: 400 },
      data: { ok: false, notice: notices["verifica-non-riuscita"] },
    });
    siteverify.answer = () => Response.json({ success: false, "error-codes": ["internal-error"] });
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await request(seller.cookie)).toMatchObject({
      init: { status: 503 },
      data: { ok: false, notice: notices["verifica-non-disponibile"] },
    });
    expect(errors.mock.calls.join("\n")).toContain('"operation":"turnstile"');
    errors.mockRestore();
    expect(toSupport()).toEqual([]);
    expect(await count("support_requests")).toBe(0);
  });
});

describe("filtro per IP delle azioni costose", () => {
  const deployed = "https://test.fiscalbay.it";
  let previous: Pick<
    Env,
    "APP_ORIGIN" | "REQUEST_LIMIT_ATTEMPTS" | "REQUEST_LIMIT_EMAILS" | "REQUEST_LIMIT_WORK"
  >;
  beforeAll(() => {
    const { APP_ORIGIN, REQUEST_LIMIT_ATTEMPTS, REQUEST_LIMIT_EMAILS, REQUEST_LIMIT_WORK } = env;
    previous = { APP_ORIGIN, REQUEST_LIMIT_ATTEMPTS, REQUEST_LIMIT_EMAILS, REQUEST_LIMIT_WORK };
    // La finestra del binding locale segue l'orologio e può azzerare il contatore a metà serie.
    Object.assign(env, { APP_ORIGIN: deployed, ...fakeRateLimiters() });
  });
  afterAll(() => Object.assign(env, previous));
  type Init = { status: number; headers: Record<string, string> };
  const post = (
    action: (args: never) => unknown,
    path: string,
    ip: string,
    fields: Record<string, string>,
  ) =>
    (
      callRoute(action, path, {
        origin: deployed,
        headers: { "cf-connecting-ip": ip, accept: "application/json" },
        fields,
      }) as Promise<unknown>
    ).catch((thrown: unknown) => thrown);

  it.each([
    ["assistenza", settingsAction, "/app/impostazioni", { intent: "support" }, "emails", 1],
    ["archivio", settingsAction, "/app/impostazioni", { intent: "account-export" }, "work", 2],
    ["lettura", storesAction, "/app/negozi", { intent: "store-sync", store: "s" }, "work", 3],
    ["riprova", ordersAction, "/app/ordini", { intent: "retry" }, "work", 4],
  ] as const)(
    "%s: oltre il limite risponde 429 prima della sessione",
    async (_name, action, path, fields, limit, network) => {
      const ip = `198.51.100.${network}`;
      const { limit: max, period } = requestLimitRules[limit];
      // Senza sessione HTTPS valida le richieste ammesse tornano all'accesso.
      for (let count = 0; count < max; count++)
        expect(await post(action as never, path, ip, fields)).toBeInstanceOf(Response);
      const limited = (await post(action as never, path, ip, fields)) as {
        data: ActionResult;
        init: Init;
      };
      expect(limited.data).toEqual({
        ok: false,
        notice: appCopy.it.access.signInNotices["troppi-tentativi"],
      });
      expect(limited.init).toEqual({
        status: 429,
        headers: { "retry-after": String(period), "cache-control": "no-store" },
      });
      // Un'altra rete e un'azione senza filtro restano ammesse.
      expect(await post(action as never, path, "198.51.100.250", fields)).toBeInstanceOf(Response);
      expect(await post(action as never, path, ip, { intent: "save" })).toBeInstanceOf(Response);
    },
  );

  it("file degli ordini: 429 JSON con Retry-After e no-store prima della sessione", async () => {
    const send = () =>
      post(orderExportAction as never, "/api/v1/orders/export", "198.51.100.200", {
        language: "en",
      }) as Promise<Response>;
    for (let count = 0; count < requestLimitRules.work.limit; count++)
      expect((await send()).status).toBe(401);
    const limited = await send();
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe(String(requestLimitRules.work.period));
    expect(limited.headers.get("cache-control")).toBe("no-store");
    expect(await limited.json()).toEqual({
      ok: false,
      notice: appCopy.en.access.signInNotices["troppi-tentativi"],
    });
  });
});

it("salva il modello di messaggio con Salva e lo usa negli Ordini per lingua", async () => {
  const seller = await verifiedSession("modello@example.invalid");
  const { templates } = (await settingsPage(seller.cookie)).page.preferences;
  const save = (it: string, en: string) =>
    saveSetting(seller.cookie, { intent: "template", it, en });
  expect(await save(" Ciao, mi serve il CF per {ordine}. ", templates.en)).toEqual({ ok: true });
  const home = await homeFor(seller.cookie);
  expect(!home.notFound && home.page.messageTemplates).toEqual({
    it: "Ciao, mi serve il CF per {ordine}.",
    en: templates.en,
  });
  // Il testo predefinito non si conserva: segue le sue revisioni.
  expect(
    await env.DB.prepare("SELECT template_it, template_en FROM user_preferences WHERE user_id = ?")
      .bind(seller.userId)
      .first(),
  ).toEqual({ template_it: "Ciao, mi serve il CF per {ordine}.", template_en: null });
  for (const [it, en] of [
    ["  ", templates.en],
    ["x".repeat(2001), templates.en],
    [templates.it, ""],
  ]) {
    expect(await save(it!, en!)).toMatchObject({
      init: { status: 400 },
      data: { ok: false, notice: expect.stringContaining("2.000") },
    });
  }
  expect((await settingsPage(seller.cookie)).page.preferences.templates.it).toBe(
    "Ciao, mi serve il CF per {ordine}.",
  );
});

it("ricorda la lingua scelta e riapre l'area in quella lingua anche al nuovo accesso", async () => {
  const seller = await verifiedSession("lingua@example.invalid");
  const choose = (language: string, returnTo: string, from = origin) =>
    routeResponse(languageAction, "/app/lingua", {
      cookie: seller.cookie,
      origin: from,
      fields: { language, returnTo },
    });
  const moved = await choose("en", "/app/impostazioni/aspetto?x=1");
  expect(moved.status).toBe(303);
  expect(moved.headers.get("location")).toBe("/en/app/settings/appearance?x=1");
  // Le pagine dell'area aperte in italiano, anche da un nuovo accesso, seguono la scelta.
  const home = await homeFor(seller.cookie).catch((thrown: Response) => thrown);
  expect((home as Response).headers.get("location")).toBe("/en/app/orders");
  expect(await settings(seller.cookie, "/en/app/settings")).toMatchObject({
    language: "en",
  });
  // Si torna soltanto a una pagina dell'area; altrimenti agli Ordini.
  for (const target of ["https://estraneo.invalid/app/ordini", "/accesso", "//estraneo.invalid"]) {
    expect((await choose("it", target)).headers.get("location")).toBe("/app/ordini");
  }
  expect((await choose("de", "/app/ordini")).status).toBe(400);
  expect((await choose("en", "/app/ordini", "https://estraneo.invalid")).status).toBe(403);
});

it("segue il fuso del dispositivo finché non se ne sceglie uno", async () => {
  const seller = await verifiedSession("fuso@example.invalid");
  const withZone = (cookie: string) =>
    settings(`${seller.cookie}; ${cookie}`).then((loaded) => {
      if (loaded instanceof Response || !("page" in loaded)) throw new Error("pagina attesa");
      return loaded;
    });
  const detected = await withZone("fiscalbay_fuso=Asia%2FTokyo");
  expect(detected.page.preferences).toMatchObject({
    timeZone: "auto",
    detectedTimeZone: "Asia/Tokyo",
  });
  expect((await areaShell(`${seller.cookie}; fiscalbay_fuso=Asia%2FTokyo`)).display.timeZone).toBe(
    "Asia/Tokyo",
  );
  // Un valore non riconosciuto vale Roma, senza rompere le date.
  for (const cookie of ["fiscalbay_fuso=Mars%2FOlympus", "fiscalbay_fuso=..%2Fx"]) {
    expect((await areaShell(`${seller.cookie}; ${cookie}`)).display.timeZone).toBe("Europe/Rome");
  }
  // Un fuso scelto vale più di quello del dispositivo; «auto» torna al rilevamento.
  const save = (value: string) =>
    saveSetting(seller.cookie, { intent: "save", name: "time-zone", value });
  expect(await save("Europe/London")).toEqual({ ok: true });
  expect((await areaShell(`${seller.cookie}; fiscalbay_fuso=Asia%2FTokyo`)).display.timeZone).toBe(
    "Europe/London",
  );
  expect(await save("auto")).toEqual({ ok: true });
  expect(
    await env.DB.prepare("SELECT time_zone FROM user_preferences WHERE user_id = ?")
      .bind(seller.userId)
      .first(),
  ).toEqual({ time_zone: null });
  expect((await areaShell(`${seller.cookie}; fiscalbay_fuso=Asia%2FTokyo`)).display.timeZone).toBe(
    "Asia/Tokyo",
  );
});

it("chiude dopo una passkey soltanto la sessione precedente dello stesso utente", async () => {
  const seller = await verifiedSession("precedente@example.invalid");
  const other = await verifiedSession("estraneo.precedente@example.invalid");
  const ids = async (userId: string) =>
    (
      await env.DB.prepare('SELECT id FROM "session" WHERE "userId" = ? ORDER BY "createdAt"')
        .bind(userId)
        .all<{ id: string }>()
    ).results.map((row) => row.id);
  const [foreign] = await ids(other.userId);
  expect(await revokeSession(env.DB, seller.userId, foreign!)).toBe(false);
  expect(await revokeSession(env.DB, seller.userId, "inesistente")).toBe(false);
  expect(await ids(other.userId)).toEqual([foreign]);
  const confirm = (precedente: string) =>
    callRoute(settingsAction, "/app/impostazioni/account", {
      cookie: seller.cookie,
      fields: { intent: "conferma-accesso", metodo: "passkey", precedente },
    }) as Promise<{ data: { ok: boolean } }>;
  // La sessione di un altro utente non conferma nulla e resta aperta.
  expect((await confirm(foreign!)).data.ok).toBe(false);
  expect(await ids(other.userId)).toEqual([foreign]);
  // La propria sessione si chiude.
  const [previous] = await ids(seller.userId);
  expect(await revokeSession(env.DB, seller.userId, previous!)).toBe(true);
  expect(await ids(seller.userId)).not.toContain(previous);
});

it("conferma l'identità sul posto con la password senza uscire", async () => {
  const seller = await verifiedSession("conferma@example.invalid");
  const before = await env.DB.prepare('SELECT id FROM "session" WHERE "userId" = ?')
    .bind(seller.userId)
    .all<{ id: string }>();
  const confirm = (fields: Record<string, string>) =>
    callRoute(settingsAction, "/app/impostazioni/account", {
      cookie: seller.cookie,
      fields: { intent: "conferma-accesso", ...fields },
    }) as Promise<{ data: { ok: boolean; notice?: string }; init: ResponseInit }>;
  const wrong = await confirm({ metodo: "password", password: "non-questa" });
  expect(wrong.data).toEqual({
    ok: false,
    notice: "Conferma non riuscita. Controlla la password e riprova.",
  });
  expect((wrong.init.headers as Headers).getSetCookie()).toEqual([]);
  expect((await confirm({ metodo: "altro" })).data.ok).toBe(false);
  const right = await confirm({
    metodo: "password",
    password: "Una-password-negozio-molto-lunga",
  });
  expect(right.data).toEqual({ ok: true });
  // La sessione nuova sostituisce quella in uso, che si chiude.
  expect((right.init.headers as Headers).getSetCookie().join(";")).toContain("session_token");
  const after = await env.DB.prepare('SELECT id FROM "session" WHERE "userId" = ?')
    .bind(seller.userId)
    .all<{ id: string }>();
  expect(after.results).toHaveLength(before.results.length);
  expect(after.results.map((row) => row.id)).not.toEqual(before.results.map((row) => row.id));
});

it("mostra nella campanella i collegamenti da ricollegare e ricorda le letture", async () => {
  const seller = await linkedSeller("campanella@example.invalid");
  const expired = new Date(Date.now() - 2 * day).toISOString();
  await env.DB.prepare("UPDATE ebay_store_credentials SET rejected_at = ?").bind(expired).run();
  const bell = async () => (await areaShell(seller.cookie)).notifications!;
  const [notification] = await bell();
  expect(await bell()).toEqual([
    {
      id: `store-expired:${seller.storeId}:${expired}`,
      tone: "warning",
      title: "Collegamento scaduto",
      body: "venditore: la sincronizzazione è sospesa. Ricollega il negozio.",
      at: expired,
      read: false,
      href: `negozi/${seller.storeId}`,
    },
  ]);
  const read = (ids: string, from = origin) =>
    routeResponse(notificationsAction, "/api/v1/notifications", {
      cookie: seller.cookie,
      origin: from,
      fields: { ids },
    });
  expect((await read(notification!.id)).status).toBe(200);
  expect((await read(notification!.id)).status).toBe(200);
  expect(await bell()).toEqual([{ ...notification, read: true }]);
  for (const ids of ["", "nessun-prefisso", Array(51).fill("store-x:1").join(",")]) {
    expect((await read(ids)).status).toBe(400);
  }
  expect((await read(notification!.id, "https://estraneo.invalid")).status).toBe(403);
  // Un consenso in scadenza compare con la data nel fuso scelto.
  await env.DB.prepare(
    "UPDATE ebay_store_credentials SET rejected_at = NULL, refresh_expires_at = ?",
  )
    .bind(new Date(Date.now() + 10 * day).toISOString().slice(0, 10) + "T03:00:00.000Z")
    .run();
  await saveSetting(seller.cookie, {
    intent: "save",
    name: "time-zone",
    value: "America/New_York",
  });
  const [expiring] = await bell();
  expect(expiring).toMatchObject({
    tone: "warning",
    title: "Autorizzazione in scadenza",
    read: false,
  });
  const expiry = new Date(Date.now() + 10 * day);
  const previousDay = new Date(expiry.getTime() - day);
  expect(expiring!.body).toContain(
    new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeZone: "UTC" })
      .format(previousDay)
      .replace("Sept", "Sep"),
  );
  // Una lettura, anche di una notifica non più attuale, resta finché la notifica può comparire, cioè trenta giorni.
  await purgeExpiredRecords(env.DB, new Date(Date.now() + 29 * day));
  expect(await count("notification_reads")).toBe(1);
  await purgeExpiredRecords(env.DB, new Date(Date.now() + 31 * day));
  expect(await count("notification_reads")).toBe(0);
});
