import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { consoleSummary } from "../app/domain/admin-directory.server";
import { listAnomalies } from "../app/domain/admin-operations.server";
import { recordBulkDataThreshold } from "../app/domain/ebay-quotas.server";
import { productMetrics } from "../app/domain/product-metrics.server";
import {
  configureOwnerCommands,
  ownerPanel,
  parseOwnerCallback,
} from "../app/domain/owner-control.server";
import { reconcileOwnerIncidents as reconcile } from "../app/domain/owner-incidents.server";
import {
  recordDisputeOpened,
  runOwnerNotifications,
} from "../app/domain/owner-notifications.server";
import { purgeExpiredRecords } from "../app/domain/maintenance.server";
import { duration, plainText, type Panel } from "../app/domain/owner-panels.server";
import { consumeTask, taskSlot } from "../app/domain/scheduled-work.server";
import { setSwitch } from "../app/domain/service-settings.server";
import { taskPeriods, type ScheduledTask } from "../app/domain/work-timing";
import { infoEmail } from "../app/app-copy";
import { ownerCommands } from "../app/bot-commands";
import {
  editRichMessage,
  ownerChatId,
  sendPreformatted,
  sendRichMessage,
  verifyTelegramUpdate,
  webhookInfo,
} from "../app/integrations/telegram.server";
import { receiveWebhook } from "../app/webhooks.server";
import { emailSender, verifiedSession } from "./fixtures/account-fixtures";
import {
  insertCredentials,
  insertEntitlement,
  insertStore,
  insertWorkspace,
  later,
  now,
  resetDatabase,
} from "./fixtures/database-fixtures";
import { fakeQueue, queueMessage, queued } from "./fixtures/queue-fixture";
import { fakeBot as bot, type BotCall } from "./fixtures/telegram-fixtures";

const owner = Number(env.TELEGRAM_OWNER_ID);
const secret = env.TELEGRAM_WEBHOOK_SECRET!;
const origin = "http://localhost:5173";
const send = vi.fn<Queue["send"]>().mockResolvedValue(queued);
const environment = { ...env, WORK_QUEUE: fakeQueue({ send }) } as Env;
const minute = 60_000;

const rejected = (description: string) =>
  Response.json({ ok: false, error_code: 400, description }, { status: 400 });

let updateId = 50_000;

function message(text: string, { chat = owner, from = owner, type = "private" } = {}) {
  return {
    update_id: ++updateId,
    message: {
      date: Math.floor(Date.parse(now) / 1000),
      chat: { id: chat, type },
      from: { id: from },
      text,
    },
  };
}

function tap(data: string, { chat = owner, from = owner, messageId = 77 } = {}) {
  return {
    update_id: ++updateId,
    callback_query: {
      id: `cb-${updateId}`,
      from: { id: from },
      data,
      message: { message_id: messageId, chat: { id: chat, type: "private" } },
    },
  };
}

function post(body: unknown, fetcher: typeof fetch, at = new Date(now)) {
  return receiveWebhook(
    new Request("https://test.fiscalbay.it/webhooks/telegram", {
      method: "POST",
      headers: { "x-telegram-bot-api-secret-token": secret },
      body: JSON.stringify(body),
    }),
    environment,
    fetcher,
    at,
  );
}

type RichParams = {
  chat_id: string;
  rich_message: { blocks: Array<Record<string, unknown>>; skip_entity_detection: boolean };
  reply_markup?: { inline_keyboard: Array<Array<{ text: string } & Record<string, string>>> };
};

const rich = (call: BotCall) => call.params as unknown as RichParams;
const heading = (call: BotCall) => String(rich(call).rich_message.blocks[0]!.text);
const buttons = (call: BotCall) => rich(call).reply_markup?.inline_keyboard.flat() ?? [];

/** Lavori periodici conclusi nel turno corrente: nessuna anomalia dei lavori. */
async function regularTasks(at = new Date(now)) {
  await env.DB.batch(
    (Object.keys(taskPeriods) as ScheduledTask[]).map((task) =>
      env.DB.prepare(
        "INSERT OR REPLACE INTO scheduled_tasks (task, slot, queued_at, done_at) VALUES (?1, ?2, ?3, ?3)",
      ).bind(task, taskSlot(task, at), at.toISOString()),
    ),
  );
}

beforeEach(async () => {
  await resetDatabase();
  await regularTasks();
  send.mockClear();
});
afterEach(() => vi.restoreAllMocks());

describe("identità dell'owner", () => {
  const parse = (body: unknown, environment: Env = env) =>
    verifyTelegramUpdate(JSON.stringify(body), secret, environment);

  it("accetta comandi e pulsanti dell'owner soltanto dalla sua chat privata e dal suo utente", () => {
    expect(parse(message("/console"))).toMatchObject({
      kind: "owner",
      command: "console",
      chatId: String(owner),
    });
    expect(parse(message("/quote@FiscalBayTestBot"))).toMatchObject({ command: "quote" });
    // Chat, utente o tipo di chat diversi: nessun effetto e nessuna risposta.
    expect(parse(message("/console", { chat: 4242, from: 4242 }))).toBeNull();
    expect(parse(message("/console", { from: 4242 }))).toBeNull();
    expect(parse(message("/console", { chat: 4242 }))).toBeNull();
    expect(parse(message("/console", { chat: -100, type: "group" }))).toBeNull();
    expect(
      parse({
        ...message("/console"),
        message: { ...message("/console").message, from: undefined },
      }),
    ).toBeNull();
    expect(parse(tap("oc1:incidenti:0"))).toMatchObject({
      kind: "owner_callback",
      data: "oc1:incidenti:0",
      messageId: 77,
    });
    expect(parse(tap("oc1:incidenti:0", { chat: 4242, from: 4242 }))).toBeNull();
    expect(parse(tap("oc1:incidenti:0", { from: 4242 }))).toBeNull();
    expect(parse(tap("oc1:incidenti:0", { chat: 4242 }))).toBeNull();
    // I comandi dei venditori restano tali anche nella chat dell'owner.
    expect(parse(message("/stato"))).toMatchObject({ kind: "command", command: "status" });
    expect(parse(tap("abcdef12:pr"))).toMatchObject({ kind: "callback" });
    // Senza l'ID configurato l'owner non esiste.
    const unset = { ...env, TELEGRAM_OWNER_ID: "" } as unknown as Env;
    expect(parse(message("/console"), unset)).toBeNull();
    expect(parse(tap("oc1:console:0"), unset)).toBeNull();
  });

  it("accetta come owner soltanto un ID Telegram di sole cifre", () => {
    const id = (value: string) => ownerChatId({ ...env, TELEGRAM_OWNER_ID: value } as Env);
    expect(id("573159993")).toBe("573159993");
    expect(id("1".repeat(20))).toBe("1".repeat(20));
    for (const value of ["", "x573159993", "573159993x", "-100573159993", "1".repeat(21)])
      expect(id(value), value).toBeNull();
  });

  it("riconosce soltanto i pulsanti nella forma attesa", () => {
    expect(parseOwnerCallback("oc1:console:0")).toEqual({ view: "console", arg: 0, copy: false });
    expect(parseOwnerCallback("oc1:metriche:90:c")).toEqual({
      view: "metriche",
      arg: 90,
      copy: true,
    });
    expect(parseOwnerCallback("oc1:negozi:16")).toEqual({ view: "negozi", arg: 16, copy: false });
    expect(parseOwnerCallback("oc1:incidenti:0:n")).toEqual({
      view: "incidenti",
      arg: 0,
      copy: false,
      fresh: true,
    });
    for (const data of [
      "oc1:metriche:15",
      "oc1:negozi:3",
      "oc1:console:1",
      "oc1:console:0:x",
      "oc1:console:0:c:1",
      "oc1:sconosciuta:0",
      "oc1:console:",
      "oc1:console:-8",
      "oc2:console:0",
    ])
      expect(parseOwnerCallback(data), data).toBeNull();
  });
});

describe("Bot API del Control Center", () => {
  /** Bot API con una risposta fissa; conserva metodo e parametri di ogni chiamata. */
  const answering = (body: string, status = 200) => {
    const calls: Array<{ method: string; params: Record<string, unknown> }> = [];
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      calls.push({
        method: String(input).split("/").at(-1)!,
        params: JSON.parse(String(init?.body)) as Record<string, unknown>,
      });
      return new Response(body, { status });
    });
    return { fetcher, calls };
  };
  const refused = (description: string) =>
    answering(JSON.stringify({ ok: false, description }), 400).fetcher;
  const panel = { blocks: [{ type: "footer" as const, text: "Test" }] };

  it("distingue i rifiuti di una modifica: invariato, non più modificabile, altro", async () => {
    const edit = (fetcher: typeof fetch) => editRichMessage(env, String(owner), 77, panel, fetcher);
    expect(await edit(refused("Bad Request: message is not modified"))).toBe("edited");
    expect(await edit(refused("Bad Request: message to edit not found"))).toBe("gone");
    expect(await edit(refused("Bad Request: MESSAGE CAN'T BE EDITED"))).toBe("gone");
    await expect(edit(refused("Bad Request: chat not found"))).rejects.toMatchObject({
      failure: "rejected",
    });
    // Un corpo che non è JSON resta un rifiuto, senza descrizione da leggere.
    await expect(edit(answering("<html>", 400).fetcher)).rejects.toMatchObject({
      failure: "rejected",
    });
    await expect(edit(answering("{}", 502).fetcher)).rejects.toMatchObject({
      failure: "unavailable",
    });
    const ok = answering(JSON.stringify({ ok: true, result: true }));
    expect(await edit(ok.fetcher)).toBe("edited");
    expect(ok.calls).toEqual([
      {
        method: "editMessageText",
        params: {
          chat_id: String(owner),
          message_id: 77,
          rich_message: { blocks: panel.blocks, skip_entity_detection: true },
        },
      },
    ]);
  });

  it("invia pannelli senza pulsanti e testo copiabile senza anteprime", async () => {
    const api = answering(JSON.stringify({ ok: true, result: { message_id: 9 } }));
    expect(await sendRichMessage(env, String(owner), panel, api.fetcher)).toBe(9);
    expect(api.calls[0]!.params).not.toHaveProperty("reply_markup");
    await sendPreformatted(env, String(owner), "riga 🙂", api.fetcher);
    expect(api.calls[1]).toEqual({
      method: "sendMessage",
      params: {
        chat_id: String(owner),
        text: "riga 🙂",
        entities: [{ type: "pre", offset: 0, length: 7 }],
        link_preview_options: { is_disabled: true },
      },
    });
  });

  it("legge lo stato del webhook e rifiuta risposte oltre il limite", async () => {
    const info = (result: object) =>
      webhookInfo(env, answering(JSON.stringify({ ok: true, result })).fetcher);
    expect(
      await info({
        url: "https://test.fiscalbay.it/webhooks/telegram",
        pending_update_count: 2,
        last_error_date: 1_793_000_000,
        allowed_updates: ["message", "callback_query"],
      }),
    ).toEqual({
      url: "https://test.fiscalbay.it/webhooks/telegram",
      pending: 2,
      lastErrorAt: new Date(1_793_000_000_000).toISOString(),
      allowedUpdates: ["message", "callback_query"],
    });
    expect(await info({ url: "", pending_update_count: 0 })).toEqual({
      url: "",
      pending: 0,
      lastErrorAt: null,
      allowedUpdates: [],
    });
    // 64 KiB al massimo, anche se la risposta è valida.
    await expect(info({ url: "x".repeat(70_000), pending_update_count: 0 })).rejects.toThrow();
  });
});

describe("comandi e pulsanti", () => {
  it("risponde al comando con un nuovo messaggio a tabelle, una volta sola per aggiornamento", async () => {
    const api = bot();
    const body = message("/console");
    expect((await post(body, api.fetcher))?.status).toBe(204);
    expect(api.methods()).toEqual(["sendRichMessage"]);
    const [sent] = api.calls;
    expect(rich(sent!).chat_id).toBe(String(owner));
    expect(rich(sent!).rich_message.skip_entity_detection).toBe(true);
    expect(heading(sent!)).toBe("🧭 FiscalBay · Test");
    expect(rich(sent!).rich_message.blocks.at(-1)).toEqual({
      type: "footer",
      text: "Test · 13 set 2026, 22:00",
    });
    expect(buttons(sent!)).toEqual(
      expect.arrayContaining([
        { text: "🚨 Incidenti", callback_data: "oc1:incidenti:0" },
        { text: "↻ Aggiorna", callback_data: "oc1:console:0" },
        { text: "📋 Copia", callback_data: "oc1:console:0:c" },
        { text: "🔗 Apri nella console", url: `${origin}/admin` },
      ]),
    );
    // Lo stesso aggiornamento ripetuto da Telegram non ha un secondo effetto.
    expect((await post(body, api.fetcher))?.status).toBe(204);
    expect(api.calls).toHaveLength(1);
    expect(send).not.toHaveBeenCalled();
  });

  it("un pannello che Telegram rifiuta per la sua forma parte come testo copiabile", async () => {
    const tooLarge = (call: BotCall) =>
      call.method === "sendRichMessage" || call.method === "editMessageText"
        ? rejected("Bad Request: message is too long")
        : undefined;
    const api = bot(tooLarge);
    await post(message("/console"), api.fetcher);
    expect(api.methods()).toEqual(["sendRichMessage", "sendMessage"]);
    const text = String(api.calls[1]!.params.text);
    expect(text.startsWith("🧭 FiscalBay · Test")).toBe(true);
    expect(text.length).toBeLessThanOrEqual(4096);
    // Anche la modifica rifiutata dal pulsante finisce nello stesso testo.
    const tapped = bot(tooLarge);
    await post(tap("oc1:console:0"), tapped.fetcher);
    expect(tapped.methods()).toEqual([
      "answerCallbackQuery",
      "editMessageText",
      "sendRichMessage",
      "sendMessage",
    ]);
  });

  it("ignora senza risposta e senza ricevuta i comandi da altre chat o da altri utenti", async () => {
    const api = bot();
    for (const body of [
      message("/console", { chat: 4242, from: 4242 }),
      message("/incidenti", { from: 4242 }),
      tap("oc1:console:0", { chat: 4242, from: 4242 }),
    ])
      expect((await post(body, api.fetcher))?.status).toBe(204);
    expect(api.calls).toEqual([]);
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM webhook_receipts").first()).toEqual({
      n: 0,
    });
  });

  it("il pulsante riscrive lo stesso messaggio; Copia invia testo copiabile; un messaggio non modificabile ne apre uno nuovo", async () => {
    const api = bot();
    await post(tap("oc1:lavori:0", { messageId: 31 }), api.fetcher);
    expect(api.methods()).toEqual(["answerCallbackQuery", "getWebhookInfo", "editMessageText"]);
    const edit = api.calls[2]!;
    expect(edit.params.message_id).toBe(31);
    expect(heading(edit)).toBe("⚙️ Lavori");
    expect(buttons(edit)).toEqual(
      expect.arrayContaining([
        { text: "‹ Console", callback_data: "oc1:console:0" },
        { text: "🔗 Apri nella console", url: `${origin}/admin/lavori` },
      ]),
    );

    const copied = bot();
    await post(tap("oc1:lavori:0:c"), copied.fetcher);
    expect(copied.methods()).toEqual(["answerCallbackQuery", "getWebhookInfo", "sendMessage"]);
    const text = String(copied.calls[2]!.params.text);
    expect(text.startsWith("⚙️ Lavori\n")).toBe(true);
    expect(text).toContain("Indirizzo: Corretto");
    expect(copied.calls[2]!.params.entities).toEqual([
      { type: "pre", offset: 0, length: text.length },
    ]);

    const old = bot((call) =>
      call.method === "editMessageText"
        ? rejected("Bad Request: message can't be edited")
        : undefined,
    );
    await post(tap("oc1:versione:0"), old.fetcher);
    expect(old.methods()).toEqual(["answerCallbackQuery", "editMessageText", "sendRichMessage"]);

    const same = bot((call) =>
      call.method === "editMessageText"
        ? rejected("Bad Request: message is not modified: specified new message content")
        : undefined,
    );
    await post(tap("oc1:versione:0"), same.fetcher);
    expect(same.methods()).toEqual(["answerCallbackQuery", "editMessageText"]);

    // Il pulsante di un avviso apre l'elenco in un nuovo messaggio, senza toccare l'avviso.
    const alert = bot();
    await post(tap("oc1:incidenti:0:n"), alert.fetcher);
    expect(alert.methods()).toEqual(["answerCallbackQuery", "sendRichMessage"]);

    // Un pulsante di forma sconosciuta chiude soltanto l'attesa.
    const unknown = bot();
    await post(tap("oc1:metriche:15"), unknown.fetcher);
    expect(unknown.methods()).toEqual(["answerCallbackQuery"]);
  });

  it("con gli invii Telegram spenti per i venditori il Control Center risponde", async () => {
    await setSwitch(env.DB, "telegram_sends", false, new Date(now));
    const api = bot();
    await post(message("/versione"), api.fetcher);
    expect(api.methods()).toEqual(["sendRichMessage"]);
    // Il comando di un venditore nella stessa chat resta senza risposta.
    const seller = bot();
    await post(message("/stato"), seller.fetcher);
    expect(seller.calls).toEqual([]);
  });

  it("configura il menu della sola chat dell'owner con i comandi del Control Center e dei venditori", async () => {
    const api = bot();
    await configureOwnerCommands(environment, api.fetcher);
    expect(api.calls).toEqual([
      {
        method: "setMyCommands",
        params: {
          scope: { type: "chat", chat_id: String(owner) },
          commands: [
            { command: "console", description: "Panoramica" },
            { command: "incidenti", description: "Anomalie aperte e rientrate" },
            { command: "lavori", description: "Lavori periodici, eventi e webhook" },
            { command: "quote", description: "Quote delle API eBay" },
            { command: "commerciale", description: "Incassi, lifetime e listino" },
            { command: "metriche", description: "Funnel e KPI" },
            { command: "negozi", description: "Negozi con problemi" },
            { command: "prestazioni", description: "Metriche tecniche" },
            { command: "versione", description: "Versione distribuita" },
            { command: "stato", description: "Piano, notifiche e negozi" },
            { command: "ultimi", description: "Ultimi ordini" },
            { command: "preferenze", description: "Notifiche e negozi" },
            { command: "aiuto", description: "Come funziona il bot" },
          ],
        },
      },
    ]);
    const unset = bot();
    await configureOwnerCommands(
      { ...environment, TELEGRAM_OWNER_ID: "" } as unknown as Env,
      unset.fetcher,
    );
    expect(unset.calls).toEqual([]);
  });
});

describe("viste", () => {
  const rows = (panel: Panel) => panel.sections.flatMap((section) => section.rows);
  const value = (panel: Panel, label: string) => rows(panel).find(([name]) => name === label)?.[1];

  async function failingStore(id: string, label: string) {
    await env.DB.batch([
      insertStore({ id, ebayUserId: label, workspaceId: "w-viste" }),
      insertCredentials({ storeId: id, accessExpiresAt: later(48 * 60).toISOString() }),
      ...[0, 1].map((index) =>
        env.DB.prepare(
          "INSERT INTO sync_runs (store_id, started_at, ok, new_orders) VALUES (?, ?, 0, 0)",
        ).bind(id, later(index - 30).toISOString()),
      ),
    ]);
  }

  it("ogni vista legge le stesse query della console, senza email né dati dei buyer", async () => {
    const { userId } = await verifiedSession("venditore.viste@example.invalid");
    await env.DB.batch([
      ...insertWorkspace({ id: "w-viste", userId }),
      insertEntitlement({
        id: "e-viste",
        workspaceId: "w-viste",
        source: "admin",
        startsAt: later(-60).toISOString(),
        endsAt: later(60 * 24 * 30).toISOString(),
      }),
    ]);
    await failingStore("s-viste", "negozio_in_errore");
    await setSwitch(env.DB, "ebay_calls", false, new Date(now));
    const at = new Date(now);
    const api = bot();
    const panels = Object.fromEntries(
      await Promise.all(
        ownerCommands.map(
          async (view) =>
            [
              view,
              await ownerPanel(environment, { view, arg: 0, copy: false }, api.fetcher, at),
            ] as const,
        ),
      ),
    ) as Record<(typeof ownerCommands)[number], Panel>;

    const summary = await consoleSummary(env.DB, at);
    expect(value(panels.console, "Account")).toBe(String(summary.users));
    expect(value(panels.console, "Concesso")).toBe(String(summary.coverage.admin));
    expect(value(panels.console, "Con problemi")).toBe(String(summary.stores.problems));
    const anomalies = await listAnomalies(env.DB, at);
    expect(panels.console.lead).toContain(
      anomalies.length === 1 ? "1 anomalia aperta" : `${anomalies.length} anomalie aperte`,
    );

    expect(rows(panels.incidenti).map(([label]) => label)).toEqual(
      expect.arrayContaining([
        "🟠 Servizi spenti dalla console",
        "🟠 Letture dei negozi non riuscite",
      ]),
    );
    expect(value(panels.incidenti, "🟠 Servizi spenti dalla console")).toContain("Chiamate eBay");

    const metrics = await productMetrics(env, 30, at);
    expect(panels.metriche.title).toBe("📈 Metriche · Ultimi 30 giorni");
    expect(value(panels.metriche, "Registrati")).toMatch(
      new RegExp(`^${metrics.funnel.steps[0]!.count}\\b`, "u"),
    );
    expect(value(panels.metriche, "Merchant operativi")).toBe(String(metrics.spaces.operative));

    expect(value(panels.negozi, "Con problemi")).toBe(String(summary.stores.problems));
    expect(value(panels.negozi, "negozio_in_errore")).toContain("Ultime letture non riuscite");

    expect(value(panels.commerciale, "Ultimi 30 giorni")).toBe("0,00\u00a0€");
    expect(value(panels.commerciale, "Mensile")).toContain("Lettura non riuscita");

    expect(value(panels.lavori, "Indirizzo")).toBe("Corretto");
    expect(value(panels.lavori, "Riconciliazione Stripe")).toMatch(/^Concluso /u);

    expect(panels.quote.sections[0]).toEqual({
      title: "📊 Production",
      rows: [["Stato", "Lettura non riuscita"]],
    });
    expect(value(panels.prestazioni, "Stato")).toContain("ANALYTICS_READ_TOKEN");
    expect(value(panels.versione, "Indirizzo")).toBe("localhost:5173");

    for (const [view, panel] of Object.entries(panels)) {
      const text = plainText(environment, panel, at);
      expect(text, view).not.toContain("@example.invalid");
      expect(text.length, view).toBeLessThanOrEqual(4096);
    }
  });

  it("le quote mostrano consumo e anomalie come la console e le metriche cambiano finestra", async () => {
    const daily = (resource: string, used: number) => ({
      name: resource,
      rates: [
        {
          count: used,
          limit: 5000,
          remaining: 5000 - used,
          reset: "2026-09-14T07:00:00.000Z",
          timeWindow: 86_400,
        },
      ],
    });
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input instanceof Request ? input.url : input));
      if (url.pathname.endsWith("/oauth2/token")) return Response.json({ access_token: "app" });
      return Response.json({
        rateLimits:
          url.searchParams.get("api_context") === "tradingapi"
            ? [
                {
                  apiContext: "tradingapi",
                  apiName: "TradingAPI",
                  resources: [daily("GetOrders", 4000)],
                },
              ]
            : [
                {
                  apiContext: "sell",
                  apiName: "fulfillment",
                  resources: [daily("sell.fulfillment.order", 10)],
                },
              ],
      });
    }) as unknown as typeof fetch;
    await recordBulkDataThreshold(env.DB, "production", {
      policyFramework: "BULK_DATA_TRANSFER_POLICY",
      region: "US",
      window: {
        aggregationWindowStart: "2026-09-01T00:00:00.000Z",
        aggregationWindowEnd: "2026-09-30T22:00:00.000Z",
      },
      metricData: [
        {
          metricDataType: "PersonalFinancialData",
          thresholdStatus: "REACHED",
          thresholdPercentage: 100,
          thresholdLimit: 1000,
          currentCount: 1000,
        },
      ],
    });
    const quotes = await ownerPanel(
      environment,
      { view: "quote", arg: 0, copy: false },
      fetcher,
      new Date(now),
    );
    expect(value(quotes, "Trading · GetOrders")).toBe(
      "4000 su 5000 · 80% · al giorno · azzera 14 set 2026, 09:00 · oltre la soglia",
    );
    expect(value(quotes, "🟠 production:Trading:GetOrders")).toBe("80% · dal 13 set 2026, 22:00");
    expect(quotes.note).toContain("Application Growth Check");
    expect(value(quotes, "🔴 production:US:PersonalFinancialData")).toBe(
      "100% · fino al 1 ott 2026, 00:00",
    );

    const week = await ownerPanel(
      environment,
      { view: "metriche", arg: 7, copy: false },
      fetcher,
      new Date(now),
    );
    expect(week.title).toBe("📈 Metriche · Ultimi 7 giorni");
    expect(week.buttons).toEqual([
      [
        { text: "● 7 giorni", callback_data: "oc1:metriche:7" },
        { text: "○ 30 giorni", callback_data: "oc1:metriche:30" },
        { text: "○ 90 giorni", callback_data: "oc1:metriche:90" },
      ],
    ]);
  });

  it("i negozi con problemi vanno a pagine di otto", async () => {
    await env.DB.batch(insertWorkspace({ id: "w-viste" }));
    for (let index = 0; index < 9; index++) await failingStore(`s-${index}`, `negozio_${index}`);
    const first = await ownerPanel(
      environment,
      { view: "negozi", arg: 0, copy: false },
      fetch,
      new Date(now),
    );
    expect(first.sections[1]!.rows).toHaveLength(8);
    expect(first.buttons).toEqual([[{ text: "›", callback_data: "oc1:negozi:8" }]]);
    const second = await ownerPanel(
      environment,
      { view: "negozi", arg: 8, copy: false },
      fetch,
      new Date(now),
    );
    expect(second.sections[1]!.rows).toHaveLength(1);
    expect(second.buttons).toEqual([[{ text: "‹", callback_data: "oc1:negozi:0" }]]);
  });

  it("le prestazioni riportano stime di Analytics Engine e tempo CPU delle pagine come la console", async () => {
    const rows = {
      invocations: [
        {
          invocation: "http",
          detail: "document",
          method: "GET",
          outcome: "2xx",
          count: "40",
          p95_ms: 190,
        },
        {
          invocation: "queue",
          detail: "sync",
          method: "",
          outcome: "ok",
          count: "90",
          p95_ms: 900,
        },
      ],
      phases: [
        {
          invocation: "queue",
          phase: "ebay",
          operation: "request",
          outcome: "ok",
          calls: "12",
          p95_ms: 410,
        },
      ],
      pages: [{ page: "orders", reports: "8", lcp_reports: "8", lcp_p75_ms: 1300 }],
    };
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const body = String(init?.body);
      if (String(input).endsWith("/workers/observability/telemetry/query")) {
        // Soltanto il documento degli Ordini ha invocazioni nella finestra.
        const measured =
          (JSON.parse(body) as { queryId: string }).queryId === "page-cpu-orders-document";
        const aggregate = (value: number) => [{ value: measured ? value : 0 }];
        return Response.json({
          success: true,
          result: {
            calculations: [
              { alias: "invocations", aggregates: aggregate(30) },
              { alias: "cpu_p50_ms", aggregates: aggregate(42) },
              { alias: "cpu_p95_ms", aggregates: aggregate(170) },
              { alias: "wall_p50_ms", aggregates: aggregate(760) },
            ],
          },
        });
      }
      const query = body.includes("'phase'")
        ? "phases"
        : body.includes("'page'")
          ? "pages"
          : "invocations";
      return Response.json({ meta: [], data: rows[query], rows: 1 });
    }) as unknown as typeof fetch;
    const panel = await ownerPanel(
      { ...environment, ANALYTICS_READ_TOKEN: "token-di-lettura" } as Env,
      { view: "prestazioni", arg: 0, copy: false },
      fetcher,
      new Date(now),
    );
    expect(panel.lead).toContain("Ultime 24 ore");
    expect(panel.sections.map((section) => section.rows)).toEqual([
      [
        ["Coda · Letture dei negozi · ok", "90 · p95 900 ms"],
        ["HTTP · Pagine · 2xx", "40 · p95 190 ms"],
      ],
      [["eBay · request", "12 · p95 410 ms"]],
      [
        ["Ordini · Documento", "30 · CPU p50 42 ms · CPU p95 170 ms · Durata p50 760 ms"],
        ["Ordini · Dati", "0 · CPU p50 n.d. · CPU p95 n.d. · Durata p50 n.d."],
        ["Negozi · Documento", "0 · CPU p50 n.d. · CPU p95 n.d. · Durata p50 n.d."],
        ["Negozi · Dati", "0 · CPU p50 n.d. · CPU p95 n.d. · Durata p50 n.d."],
      ],
      [["Ordini", "8 · LCP p75 1300 ms"]],
    ]);
  });

  it("le durate degli avvisi passano da minuti a ore e a giorni", () => {
    const from = "2026-09-13T20:00:00.000Z";
    const after = (minutes: number) => new Date(Date.parse(from) + minutes * minute).toISOString();
    expect(duration(from, after(59))).toBe("59 min");
    expect(duration(from, after(60))).toBe("1 h");
    expect(duration(from, after(135))).toBe("2 h 15 min");
    expect(duration(from, after(3 * 1440))).toBe("3 giorni");
    expect(duration(after(5), from)).toBe("0 min");
  });

  it("il testo copiato resta entro il limite di Telegram", () => {
    const long: Panel = {
      title: "Prova",
      sections: [
        {
          title: "Righe",
          rows: Array.from({ length: 300 }, (_, index) => [`riga ${index}`, "🧾".repeat(10)]),
        },
      ],
    };
    const text = plainText(environment, long, new Date(now));
    expect(text.length).toBeLessThanOrEqual(4096);
    expect(text.endsWith("\n… testo troncato")).toBe(true);
  });
});

describe("avvisi degli incidenti", () => {
  /** Controllo degli incidenti con i lavori periodici in regola a quell'istante. */
  async function reconcileOwnerIncidents(environment: Env, fetcher: typeof fetch, at: Date) {
    await regularTasks(at);
    await reconcile(environment, fetcher, at);
  }

  const incident = () =>
    env.DB.prepare("SELECT * FROM owner_incidents")
      .all<Record<string, unknown>>()
      .then((r) => r.results);

  it("avvisa una volta all'apertura e una al rientro, anche con controlli ripetuti", async () => {
    await setSwitch(env.DB, "ebay_calls", false, new Date(now));
    const api = bot();
    await reconcileOwnerIncidents(environment, api.fetcher, later(1));
    await reconcileOwnerIncidents(environment, api.fetcher, later(11));
    expect(api.methods()).toEqual(["sendRichMessage"]);
    const opened = api.calls[0]!;
    expect(heading(opened)).toBe("🟠 Aperta · Servizi spenti dalla console");
    expect(rich(opened).rich_message.blocks[1]).toEqual({
      type: "paragraph",
      text: "Restano fermi finché non li riaccendi: richieste e notifiche attendono.",
    });
    expect(buttons(opened)).toEqual([
      { text: "🔗 Apri nella console", url: `${origin}/admin/interruttori` },
      { text: "🚨 Incidenti", callback_data: "oc1:incidenti:0:n" },
    ]);

    await setSwitch(env.DB, "ebay_calls", true, later(30));
    await reconcileOwnerIncidents(environment, api.fetcher, later(31));
    await reconcileOwnerIncidents(environment, api.fetcher, later(41));
    expect(api.methods()).toEqual(["sendRichMessage", "sendRichMessage"]);
    const resolved = api.calls[1]!;
    expect(heading(resolved)).toBe("🟢 Rientrata · Servizi spenti dalla console");
    expect(JSON.stringify(resolved.params)).toContain("31 min");
    expect(await incident()).toMatchObject([{ notified: "resolved", severity: "p2" }]);

    // La stessa anomalia di nuovo aperta è una nuova apertura.
    await setSwitch(env.DB, "ebay_calls", false, later(50));
    await reconcileOwnerIncidents(environment, api.fetcher, later(51));
    expect(heading(api.calls[2]!)).toBe("🟠 Aperta · Servizi spenti dalla console");
  });

  it("segnala l'aggravamento, ignora le P3 e non comunica il rientro di un incidente mai annunciato", async () => {
    const receipt = (provider: string, id: string) =>
      env.DB.prepare(`INSERT INTO webhook_receipts (id, provider, environment, provider_id, topic,
          object_id, event_at, expires_at, queued_at)
        VALUES (?1, ?2, 'test', ?1, 'x', 'o', ?3, ?4, ?3)`)
        .bind(id, provider, later(-120).toISOString(), later(60 * 24).toISOString())
        .run();
    await receipt("telegram", "r-telegram");
    // Messaggi Telegram non consegnati: P3, soltanto nella console e in /incidenti.
    await env.DB.batch([
      ...insertWorkspace({ id: "w-p3" }),
      env.DB.prepare(`INSERT INTO telegram_deliveries (id, workspace_id, link_id, kind, event_key,
          event_at, created_at, failed_at) VALUES ('d-p3', 'w-p3', 'l-p3', 'digest', 'k', ?1, ?1, ?1)`).bind(
        later(-5).toISOString(),
      ),
    ]);
    expect((await listAnomalies(env.DB, new Date(now))).map((anomaly) => anomaly.kind)).toContain(
      "telegram_failed",
    );
    const api = bot();
    await reconcileOwnerIncidents(environment, api.fetcher, new Date(now));
    expect(api.calls.map(heading)).toEqual(["🟠 Aperta · Eventi dei provider in ritardo"]);
    await receipt("stripe", "r-stripe");
    await reconcileOwnerIncidents(environment, api.fetcher, later(10));
    expect(heading(api.calls[1]!)).toBe("🔴 Aggravata · Eventi dei provider in ritardo");
    await reconcileOwnerIncidents(environment, api.fetcher, later(20));
    expect(api.calls).toHaveLength(2);
    expect((await incident()).map((row) => row.kind)).toEqual(["receipts_stalled"]);

    // Senza owner configurato lo stato si registra, ma nessun avviso parte.
    await env.DB.prepare("DELETE FROM owner_incidents").run();
    const silent = bot();
    const unset = { ...environment, TELEGRAM_OWNER_ID: "" } as unknown as Env;
    await reconcileOwnerIncidents(unset, silent.fetcher, later(30));
    await env.DB.prepare("DELETE FROM webhook_receipts").run();
    await reconcileOwnerIncidents(unset, silent.fetcher, later(40));
    expect(silent.calls).toEqual([]);
    await reconcileOwnerIncidents(environment, silent.fetcher, later(50));
    expect(silent.calls).toEqual([]);
    expect(await incident()).toMatchObject([{ notified: "resolved" }]);
  });

  it("un rientro e una riapertura fra due avvisi non producono messaggi; un invio fallito si ritenta più tardi", async () => {
    await setSwitch(env.DB, "ebay_calls", false, new Date(now));
    const api = bot();
    await reconcileOwnerIncidents(environment, api.fetcher, later(1));
    const [{ opened_at: openedAt }] = (await incident()) as [{ opened_at: string }];

    // Il rientro non parte per un limite di Telegram, poi l'anomalia si riapre.
    await setSwitch(env.DB, "ebay_calls", true, later(5));
    const limited = bot((call) =>
      call.method === "sendRichMessage"
        ? Response.json(
            { ok: false, error_code: 429, parameters: { retry_after: 120 } },
            { status: 429 },
          )
        : undefined,
    );
    await reconcileOwnerIncidents(environment, limited.fetcher, later(6));
    expect(await incident()).toMatchObject([
      { notified: "opened", attempts: 1, retry_at: later(8).toISOString() },
    ]);
    await reconcileOwnerIncidents(environment, api.fetcher, later(7));
    expect(api.calls).toHaveLength(1);
    await setSwitch(env.DB, "ebay_calls", false, later(7));
    await reconcileOwnerIncidents(environment, api.fetcher, later(9));
    expect(api.calls).toHaveLength(1);
    expect(await incident()).toMatchObject([
      { notified: "opened", opened_at: openedAt, resolved_at: null, attempts: 0 },
    ]);
  });

  it("senza un'attesa indicata da Telegram ritenta dopo attese crescenti, fino a sei ore", async () => {
    await setSwitch(env.DB, "ebay_calls", false, new Date(now));
    const down = bot((call) =>
      call.method === "sendRichMessage" ? new Response("", { status: 502 }) : undefined,
    );
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const mail = emailSender();
    const mailed = { ...environment, AUTH_EMAIL: { send: mail } as SendEmail };
    const waits: number[] = [];
    let at = later(1);
    for (let attempt = 0; attempt < 8; attempt++) {
      await reconcileOwnerIncidents(mailed, down.fetcher, at);
      // Dal terzo tentativo fallito l'avviso parte anche per email, una volta sola.
      expect(mail).toHaveBeenCalledTimes(attempt >= 2 ? 1 : 0);
      const [row] = (await incident()) as [{ retry_at: string; attempts: number }];
      expect(row.attempts).toBe(attempt + 1);
      waits.push((Date.parse(row.retry_at) - at.getTime()) / minute);
      // Prima della scadenza dell'attesa non parte nessun tentativo.
      const calls = down.calls.length;
      await reconcileOwnerIncidents(
        environment,
        down.fetcher,
        new Date(Date.parse(row.retry_at) - minute),
      );
      expect(down.calls).toHaveLength(calls);
      at = new Date(row.retry_at);
    }
    expect(waits).toEqual([10, 20, 40, 80, 160, 320, 360, 360]);
    expect(logged).toHaveBeenCalledTimes(8);
    const [email] = mail.mock.calls[0]!;
    expect(email).toMatchObject({
      to: infoEmail,
      replyTo: infoEmail,
      subject: "FiscalBay · 🟠 Aperta · Servizi spenti dalla console",
    });
    expect(email.text).toContain(`🔗 Apri nella console: ${origin}/admin/interruttori`);
    // L'invio riuscito azzera i tentativi.
    await reconcileOwnerIncidents(environment, bot().fetcher, at);
    expect(await incident()).toMatchObject([{ notified: "opened", attempts: 0, retry_at: null }]);
  });

  it("una riapertura dopo il rientro comunicato riparte per email se Telegram è di nuovo giù", async () => {
    const down = bot((call) =>
      call.method === "sendRichMessage" ? new Response("", { status: 502 }) : undefined,
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
    const mail = emailSender();
    const mailed = { ...environment, AUTH_EMAIL: { send: mail } as SendEmail };
    const failTimes = async (from: number) => {
      for (let attempt = 0; attempt < 3; attempt++) {
        const [row] = (await incident()) as [{ retry_at: string | null }];
        await reconcileOwnerIncidents(
          mailed,
          down.fetcher,
          row?.retry_at ? new Date(row.retry_at) : later(from),
        );
      }
    };
    await setSwitch(env.DB, "ebay_calls", false, new Date(now));
    await failTimes(1);
    expect(mail).toHaveBeenCalledTimes(1);
    // Telegram torna e comunica l'apertura e poi il rientro.
    const [row] = (await incident()) as [{ retry_at: string }];
    await reconcileOwnerIncidents(environment, bot().fetcher, new Date(row.retry_at));
    await setSwitch(env.DB, "ebay_calls", true, later(600));
    await reconcileOwnerIncidents(environment, bot().fetcher, later(601));
    expect(await incident()).toMatchObject([{ notified: "resolved" }]);
    // La nuova apertura, con Telegram di nuovo giù, riparte per email.
    await setSwitch(env.DB, "ebay_calls", false, later(700));
    await failTimes(701);
    expect(mail).toHaveBeenCalledTimes(2);
  });

  it("avvisa 45 giorni prima di una scadenza del registro, la aggrava alla scadenza e la chiude al rinnovo", async () => {
    const record = (name: string, expires: string | null) =>
      env.DB.prepare(`INSERT OR REPLACE INTO credential_expiries (name, expires_on, recorded_at)
          VALUES (?, ?, ?)`)
        .bind(name, expires, now)
        .run();
    await record("EBAY_CLIENT_SECRET", "2026-11-01");
    await record("STRIPE_SECRET_KEY", null);
    // A 49 giorni dalla scadenza nessun avviso; la voce senza data resta nella console.
    const api = bot();
    await reconcileOwnerIncidents(environment, api.fetcher, later(0));
    expect(api.calls).toEqual([]);
    expect((await listAnomalies(env.DB, later(0))).map((anomaly) => anomaly.key)).toEqual([
      "credential_undated",
    ]);
    const warned = new Date("2026-09-17T00:01:00.000Z");
    await regularTasks(warned);
    await reconcile(environment, api.fetcher, warned);
    expect(api.calls.map(heading)).toEqual(["🟠 Aperta · Credenziali in scadenza"]);
    expect(JSON.stringify(api.calls[0]!.params)).toContain("EBAY_CLIENT_SECRET · 2026-11-01");
    const expired = new Date("2026-11-01T00:10:00.000Z");
    await regularTasks(expired);
    await reconcile(environment, api.fetcher, expired);
    expect(heading(api.calls[1]!)).toBe("🔴 Aggravata · Credenziali in scadenza");
    await record("EBAY_CLIENT_SECRET", "2027-11-01");
    await reconcile(environment, api.fetcher, new Date("2026-11-01T00:20:00.000Z"));
    expect(heading(api.calls[2]!)).toBe("🟢 Rientrata · Credenziali in scadenza");
    expect(api.calls).toHaveLength(3);
  });

  it("una P1 che torna P2 e poi P1 non ripete l'avviso", async () => {
    const receipt = (provider: string, id: string) =>
      env.DB.prepare(`INSERT INTO webhook_receipts (id, provider, environment, provider_id, topic,
          object_id, event_at, expires_at, queued_at)
        VALUES (?1, ?2, 'test', ?1, 'x', 'o', ?3, ?4, ?3)`)
        .bind(id, provider, later(-120).toISOString(), later(60 * 24).toISOString())
        .run();
    await receipt("telegram", "r-telegram");
    await receipt("stripe", "r-stripe");
    const api = bot();
    await reconcileOwnerIncidents(environment, api.fetcher, new Date(now));
    expect(api.calls.map(heading)).toEqual(["🔴 Aperta · Eventi dei provider in ritardo"]);
    await env.DB.prepare("DELETE FROM webhook_receipts WHERE id = 'r-stripe'").run();
    await reconcileOwnerIncidents(environment, api.fetcher, later(10));
    expect(await incident()).toMatchObject([{ severity: "p2", resolved_at: null }]);
    await receipt("stripe", "r-stripe-2");
    await reconcileOwnerIncidents(environment, api.fetcher, later(20));
    expect(await incident()).toMatchObject([{ severity: "p1", notified_severity: "p1" }]);
    expect(api.calls).toHaveLength(1);
  });

  it("un avviso che Telegram rifiuta per la sua forma parte come testo e non si ritenta", async () => {
    await setSwitch(env.DB, "ebay_calls", false, new Date(now));
    const api = bot((call) =>
      call.method === "sendRichMessage" ? rejected("Bad Request: message is too long") : undefined,
    );
    await reconcileOwnerIncidents(environment, api.fetcher, later(1));
    expect(api.methods()).toEqual(["sendRichMessage", "sendMessage"]);
    expect(String(api.calls[1]!.params.text)).toContain("Aperta · Servizi spenti dalla console");
    expect(await incident()).toMatchObject([{ notified: "opened", attempts: 0, retry_at: null }]);
  });
});

describe("avvisi commerciali", () => {
  const notifications = () =>
    env.DB.prepare("SELECT * FROM owner_notifications ORDER BY occurred_at, key")
      .all<Record<string, unknown>>()
      .then((r) => r.results);

  /** Utente registrato con profilo, come al completamento della registrazione. */
  async function register(id: string, options: { waitlisted?: boolean; admin?: boolean } = {}) {
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO "user" ("id", "name", "email", "emailVerified", "createdAt",
          "updatedAt", "admin") VALUES (?1, 'Mario Rossi', ?2, 1, ?3, ?3, ?4)`).bind(
        id,
        `${id}@example.invalid`,
        now,
        options.admin ? 1 : 0,
      ),
      env.DB.prepare(`INSERT INTO user_profiles (user_id, first_name, last_name, account_type,
          updated_at, waitlisted_at) VALUES (?1, 'Mario', 'Rossi', 'private', ?2, ?3)`).bind(
        id,
        now,
        options.waitlisted ? now : null,
      ),
    ]);
  }

  function subscription(id: string, workspaceId: string, status = "active") {
    return env.DB.prepare(`INSERT INTO stripe_subscriptions (id, workspace_id, environment,
        customer_id, offer, price_generation, status, current_period_start, current_period_end,
        cancel_at_period_end, synced_at, checked_at)
      VALUES (?1, ?2, 'test', ?3, 'monthly', 'g1', ?4, ?5, ?6, 0, ?5, ?5)`).bind(
      id,
      workspaceId,
      `cus_${id}`,
      status,
      now,
      later(60 * 24 * 30).toISOString(),
    );
  }

  const updateSubscription = (id: string, set: string) =>
    env.DB.prepare(`UPDATE stripe_subscriptions SET ${set} WHERE id = ?`).bind(id).run();

  async function deliver(api = bot(), at = later(1)) {
    await runOwnerNotifications(environment, api.fetcher, at);
    return api;
  }

  it("ogni fatto commerciale avvisa una volta, anche ripetuto o riletto, senza email né nomi", async () => {
    await register("n-u1", { waitlisted: true });
    await register("n-admin", { admin: true });
    await env.DB.batch(insertWorkspace({ id: "w-n", userId: "n-u1" }));
    await env.DB.prepare(
      "UPDATE user_profiles SET waitlisted_at = NULL WHERE user_id = 'n-u1'",
    ).run();
    await env.DB.batch([
      insertStore({ id: "s-n", workspaceId: "w-n" }),
      insertCredentials({ storeId: "s-n", accessExpiresAt: later(600).toISOString() }),
      insertEntitlement({
        id: "e-trial",
        workspaceId: "w-n",
        source: "trial",
        endsAt: later(60 * 24 * 14).toISOString(),
      }),
      subscription("sub_n", "w-n"),
    ]);
    const paid = (id: string, start: number, days: number) =>
      insertEntitlement({
        id,
        workspaceId: "w-n",
        source: "premium",
        startsAt: later(start).toISOString(),
        endsAt: later(start + days * 24 * 60).toISOString(),
        stripeInvoiceId: `in_${id}`,
        amountPaid: 499,
        currency: "eur",
        paidAt: later(start).toISOString(),
      });
    // Il primo mese, il rinnovo e il primo anno: il rinnovo non avvisa.
    await env.DB.batch([
      paid("e-m1", 0, 30),
      paid("e-m2", 60 * 24 * 30, 30),
      paid("e-y1", 60 * 24 * 60, 365),
    ]);
    await env.DB.prepare(
      "UPDATE workspace_entitlements SET amount_refunded = 100 WHERE id = 'e-m1'",
    ).run();
    // La stessa somma riletta dalla riconciliazione non avvisa di nuovo.
    await env.DB.prepare(
      "UPDATE workspace_entitlements SET amount_refunded = 100 WHERE id = 'e-m1'",
    ).run();
    await env.DB.prepare(`UPDATE workspace_entitlements SET amount_refunded = 499,
        revoked_at = ?1, revocation = 'refund' WHERE id = 'e-m1'`)
      .bind(later(5).toISOString())
      .run();
    await updateSubscription("sub_n", "cancel_at_period_end = 1");
    await updateSubscription("sub_n", "cancel_at_period_end = 1");
    await updateSubscription("sub_n", "status = 'canceled'");

    const first = await deliver();
    const second = await deliver(bot(), later(11));
    expect(first.calls.map(heading)).toEqual([
      "🆕 Nuova registrazione",
      "✅ Ammissione dalla lista d’attesa",
      "🏪 Primo negozio collegato",
      "🧪 Prova avviata",
      "💶 Primo acquisto",
      "💶 Primo acquisto",
      "↩️ Rimborso",
      "↩️ Rimborso",
      "📅 Disdetta programmata",
      "⛔ Abbonamento chiuso",
    ]);
    expect(second.calls).toEqual([]);
    const text = JSON.stringify(first.calls);
    expect(text).not.toContain("example.invalid");
    expect(text).not.toContain("Rossi");
    expect(text).not.toContain("Sintetico");
    expect(text).toContain("4,99\u00a0€");
    expect(text).toContain("Parziale, copertura conservata");
    expect(text).toContain("Totale, copertura revocata");
    expect(text).toContain("Annuale");
    expect(buttons(first.calls[0]!)).toEqual([
      { text: "🔗 Apri nella console", url: `${origin}/admin/account` },
    ]);
    expect(buttons(first.calls[2]!)).toEqual([
      { text: "🔗 Apri nella console", url: `${origin}/admin/spazi/w-n` },
    ]);
    expect(await notifications()).toHaveLength(10);
    expect((await notifications()).every((row) => row.status === "sent")).toBe(true);
  });

  it("separa la chiusura programmata di un rinnovo non pagato da una disdetta", async () => {
    await env.DB.batch([...insertWorkspace({ id: "w-p" }), subscription("sub_p", "w-p")]);
    await updateSubscription("sub_p", "status = 'past_due'");
    await updateSubscription("sub_p", "cancel_at_period_end = 1");
    await updateSubscription("sub_p", "status = 'past_due'");
    await updateSubscription("sub_p", "status = 'canceled'");
    // Un checkout mai pagato che scade non è un abbonamento chiuso.
    await env.DB.batch([subscription("sub_i", "w-p", "incomplete")]);
    await updateSubscription("sub_i", "status = 'incomplete_expired'");
    const api = await deliver();
    expect(api.calls.map(heading)).toEqual(["⚠️ Rinnovo non pagato", "⛔ Abbonamento chiuso"]);
    expect(JSON.stringify(api.calls[1]!.params)).toContain("Rinnovo non pagato");
  });

  it("avvisa della prova conclusa con o senza acquisto e della disputa aperta e persa", async () => {
    await env.DB.batch([
      ...insertWorkspace({ id: "w-t1" }),
      ...insertWorkspace({ id: "w-t2" }),
      insertEntitlement({
        id: "t1",
        workspaceId: "w-t1",
        source: "trial",
        endsAt: later(60).toISOString(),
      }),
      insertEntitlement({
        id: "t2",
        workspaceId: "w-t2",
        source: "trial",
        endsAt: later(60).toISOString(),
      }),
      env.DB.prepare(`INSERT INTO workspace_funnel_steps (workspace_id, step, occurred_at)
        VALUES ('w-t2', 'purchase', ?)`).bind(later(30).toISOString()),
      subscription("sub_t2", "w-t2"),
    ]);
    await deliver(bot(), later(1));
    // Prima della fine nessuna prova conclusa; dopo, una per prova anche a turni ripetuti.
    const ended = await deliver(bot(), later(70));
    await deliver(bot(), later(80));
    expect(ended.calls.map(heading)).toEqual(["⌛ Prova conclusa", "⌛ Prova conclusa"]);
    expect(JSON.stringify(ended.calls[0]!.params)).toContain("Senza acquisto");
    expect(JSON.stringify(ended.calls[1]!.params)).toContain("Con acquisto");

    await recordDisputeOpened(env.DB, "dp_1", { subscription: "sub_t2" }, later(90));
    await recordDisputeOpened(env.DB, "dp_1", { subscription: "sub_t2" }, later(91));
    // Un pagamento estraneo non avvisa.
    await recordDisputeOpened(env.DB, "dp_2", { subscription: "sub_altro" }, later(91));
    await recordDisputeOpened(env.DB, "dp_3", { lifetime: "cs_altro" }, later(91));
    // Senza abbonamento o lifetime, come per un cliente cancellato, nessun avviso.
    await recordDisputeOpened(env.DB, "dp_4", { erasure: "cus_t2" }, later(91));
    await recordDisputeOpened(env.DB, "dp_5", null, later(91));
    await env.DB.batch([
      insertEntitlement({
        id: "e-d",
        workspaceId: "w-t2",
        source: "premium",
        endsAt: later(60 * 24 * 30).toISOString(),
        stripeInvoiceId: "in_d",
        amountPaid: 499,
        currency: "eur",
        paidAt: now,
      }),
    ]);
    await env.DB.prepare(`UPDATE workspace_entitlements SET revoked_at = ?, revocation = 'dispute'
        WHERE id = 'e-d'`)
      .bind(later(95).toISOString())
      .run();
    const disputes = await deliver(bot(), later(100));
    expect(disputes.calls.map(heading)).toEqual([
      "⚖️ Disputa aperta",
      "💶 Primo acquisto",
      "⚖️ Disputa persa",
    ]);
  });

  it("segnala i posti lifetime a cinque, due e zero, le cancellazioni finanziarie e dell'account", async () => {
    const seats = Array.from({ length: 20 }, (_, index) => index + 1);
    await env.DB.batch(seats.flatMap((slot) => insertWorkspace({ id: `w-l${slot}` })));
    for (const slot of seats.slice(0, 19))
      await env.DB.prepare(`INSERT INTO lifetime_allocations (slot, workspace_id, status, kind,
          activated_at, created_at) VALUES (?1, ?2, 'active', 'gift', ?3, ?3)`)
        .bind(slot, `w-l${slot}`, now)
        .run();
    // L'ultimo posto passa da prenotato ad attivo, come una vendita confermata.
    await env.DB.prepare(`INSERT INTO lifetime_allocations (slot, workspace_id, status, kind,
        expires_at, created_at) VALUES (20, 'w-l20', 'reserved', 'sale', ?1, ?2)`)
      .bind(later(60).toISOString(), now)
      .run();
    await env.DB.prepare(`UPDATE lifetime_allocations SET status = 'active', activated_at = ?1,
        provider_reference = 'cs_l20', customer_id = 'cus_l20' WHERE slot = 20`)
      .bind(later(1).toISOString())
      .run();
    await env.DB.prepare(`INSERT INTO stripe_customer_erasures (customer_id, environment, source,
        received_at) VALUES ('cus_l20', 'test', 'webhook', ?)`)
      .bind(later(2).toISOString())
      .run();
    await env.DB.prepare(`INSERT INTO account_deletions (id, user_id, workspace_id, requested_at)
        VALUES ('del-1', 'n-gone', 'w-sparito', ?)`)
      .bind(later(3).toISOString())
      .run();
    const api = await deliver(bot(), later(5));
    expect(api.calls.map(heading)).toEqual([
      "🎟 Posti lifetime in esaurimento",
      "🎟 Posti lifetime in esaurimento",
      "🎟 Posti lifetime esauriti",
      "🧾 Cancellazione dei dati finanziari",
      "🗑 Account cancellato",
    ]);
    expect(JSON.stringify(api.calls[0]!.params)).toContain("5 su 20");
    expect(JSON.stringify(api.calls[3]!.params)).toContain("Richiesta tramite Link");
    expect(buttons(api.calls[0]!)).toEqual([
      { text: "🔗 Apri nella console", url: `${origin}/admin/commerciale` },
    ]);
    expect(buttons(api.calls[3]!)).toEqual([
      { text: "🔗 Apri nella console", url: `${origin}/admin/spazi/w-l20` },
    ]);
    // Lo spazio cancellato non c'è più: l'avviso resta senza collegamento allo spazio.
    expect(buttons(api.calls[4]!)).toEqual([
      { text: "🔗 Apri nella console", url: `${origin}/admin/account` },
    ]);
  });

  it("invia al più dieci avvisi per turno e ritenta con attese crescenti fino a rinunciare", async () => {
    for (let index = 0; index < 12; index += 1) await register(`n-many-${index}`);
    const first = await deliver(bot(), later(1));
    expect(first.calls).toHaveLength(10);
    const failing = bot(() => new Response("", { status: 502 }));
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const pending = () =>
      env.DB.prepare(`SELECT key, attempts, status, retry_at FROM owner_notifications
          WHERE status <> 'sent' ORDER BY rowid`)
        .all<{ key: string; attempts: number; status: string; retry_at: string | null }>()
        .then((r) => r.results);
    // Il primo invio fallito ferma il turno: l'avviso dopo non viene tentato.
    await deliver(failing, later(11));
    const [failed, next] = await pending();
    expect(failed).toMatchObject({
      attempts: 1,
      status: "pending",
      retry_at: later(21).toISOString(),
    });
    expect(next).toMatchObject({ attempts: 0, status: "pending", retry_at: null });
    await env.DB.prepare("UPDATE owner_notifications SET status = 'sent' WHERE key = ?")
      .bind(next!.key)
      .run();
    // Prima dell'attesa nessun nuovo tentativo.
    const calls = failing.calls.length;
    await deliver(failing, later(15));
    expect(failing.calls).toHaveLength(calls);
    let at = 21;
    for (const wait of [20, 40, 80]) {
      await deliver(failing, later(at));
      at += wait;
    }
    expect(await pending()).toMatchObject([
      { attempts: 4, status: "pending", retry_at: later(at).toISOString() },
    ]);
    await deliver(failing, later(at));
    expect(await pending()).toMatchObject([{ attempts: 5, status: "failed" }]);
    expect(logged).toHaveBeenCalled();
    // Un avviso non riuscito non torna nei turni successivi.
    expect((await deliver(bot(), later(at + 360))).calls).toEqual([]);
  });

  it("riprende un avviso rimasto in un turno interrotto e la pulizia lo elimina dopo trenta giorni", async () => {
    await register("n-stale");
    await env.DB.prepare(`UPDATE owner_notifications SET status = 'processing', attempts = 1,
        claim_token = 'x', claimed_at = ?`)
      .bind(later(1).toISOString())
      .run();
    expect((await deliver(bot(), later(5))).calls).toEqual([]);
    expect((await deliver(bot(), later(20))).calls.map(heading)).toEqual([
      "🆕 Nuova registrazione",
    ]);
    await purgeExpiredRecords(env.DB, later(60 * 24 * 29));
    expect(await notifications()).toHaveLength(1);
    await purgeExpiredRecords(env.DB, later(60 * 24 * 31));
    expect(await notifications()).toEqual([]);
  });

  it("con la cancellazione dell'utente escono gli avvisi con il suo identificativo", async () => {
    await register("n-del", { waitlisted: true });
    await env.DB.prepare(
      "UPDATE user_profiles SET waitlisted_at = NULL WHERE user_id = 'n-del'",
    ).run();
    expect(await notifications()).toHaveLength(2);
    await env.DB.prepare(`DELETE FROM "user" WHERE id = 'n-del'`).run();
    expect(await notifications()).toEqual([]);
  });
});

describe("compiti periodici", () => {
  /** Esegue dalla coda il turno corrente del compito, come il consumer. */
  async function run(task: ScheduledTask, fetcher: typeof fetch, at = new Date(now)) {
    const slot = taskSlot(task, at);
    await env.DB.prepare("UPDATE scheduled_tasks SET slot = ?2, done_at = NULL WHERE task = ?1")
      .bind(task, slot)
      .run();
    const message = queueMessage({ task, slot });
    await consumeTask(message, environment, fetcher, at);
    expect(message.ack).toHaveBeenCalled();
  }

  it("riallineano il menu dell'owner, rileggono le quote eBay e inviano gli avvisi", async () => {
    const api = bot();
    await run("telegram_commands", api.fetcher);
    expect(
      api.calls.filter((call) => call.method === "setMyCommands").map((call) => call.params.scope),
    ).toContainEqual({ type: "chat", chat_id: String(owner) });

    const quotas = vi.fn<typeof fetch>(async () => new Response("", { status: 503 }));
    await run("ebay_quotas", quotas);
    expect(String(quotas.mock.calls[0]![0])).toContain("oauth2/token");

    await setSwitch(env.DB, "ebay_calls", false, new Date(now));
    const alerts = bot();
    await run("owner_incidents", alerts.fetcher);
    expect(alerts.calls.map(heading)).toEqual(["🟠 Aperta · Servizi spenti dalla console"]);
  });

  it("riallineano il menu dell'owner anche quando quello dei venditori non riesce", async () => {
    const api = bot((call) =>
      call.method === "setMyCommands" &&
      (call.params.scope as { type: string }).type === "all_private_chats"
        ? new Response("", { status: 502 })
        : undefined,
    );
    const at = new Date(now);
    const slot = taskSlot("telegram_commands", at);
    await env.DB.prepare("UPDATE scheduled_tasks SET slot = ?2, done_at = NULL WHERE task = ?1")
      .bind("telegram_commands", slot)
      .run();
    const message = queueMessage({ task: "telegram_commands", slot });
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    await consumeTask(message, environment, api.fetcher, at);
    expect(
      api.calls.some(
        (call) =>
          call.method === "setMyCommands" &&
          (call.params.scope as { type: string }).type === "chat",
      ),
    ).toBe(true);
    // L'errore del menu dei venditori fa ripetere il compito.
    expect(message.retry).toHaveBeenCalled();
    expect(message.ack).not.toHaveBeenCalled();
    expect(logged).toHaveBeenCalled();
  });
});
