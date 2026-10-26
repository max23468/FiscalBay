import { env } from "cloudflare:workers";
import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { purgeExpiredRecords } from "../app/domain/maintenance.server";
import { deliverTelegram, zonedInstant } from "../app/domain/telegram-deliveries.server";
import { escape, localClock, splitBlocks, when } from "../app/domain/telegram-messages.server";
import {
  consumeTelegramStart,
  parseTelegramChange,
  saveTelegramChange,
  startTelegramLink,
  storeNotifications,
  telegramRecipient,
  telegramSettings,
} from "../app/domain/telegram.server";
import {
  chatLabel,
  editMessage,
  sendMessage,
  sendText,
  telegramConfigured,
  linkToken as randomLinkToken,
  verifyTelegramUpdate,
} from "../app/integrations/telegram.server";
import { consumeWebhooks, receiveWebhook } from "../app/integrations/webhooks.server";
import { configureBotCommands } from "../app/domain/telegram-bot.server";
import { ebayOrderHref } from "../app/components/orders/labels";
import { action as settingsAction, loader as settingsLoader } from "../app/routes/settings";
import { loader as storesLoader } from "../app/routes/stores";
import { verifiedSession } from "./fixtures/account-fixtures";
import {
  insertStore,
  insertTaxIdentifiers,
  now,
  resetDatabase,
} from "./fixtures/database-fixtures";
import { queueMessage } from "./fixtures/queue-fixture";

const origin = "http://localhost:5173";
const secret = env.TELEGRAM_WEBHOOK_SECRET!;
const send = vi.fn<Queue["send"]>().mockResolvedValue(undefined);
const environment = { ...env, WORK_QUEUE: { send } } as Env;
const later = (minutes: number) => new Date(Date.parse(now) + minutes * 60_000);

type BotCall = { method: string; params: Record<string, unknown> };

/** Bot API simulata: registra le chiamate e risponde come Telegram, o con `reply`. */
function bot(reply?: (call: BotCall) => Response | undefined) {
  const calls: BotCall[] = [];
  const fetcher = vi.fn<typeof fetch>(async (input, init) => {
    const url = String(input);
    expect(url.startsWith(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/`)).toBe(true);
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("content-type")).toBe("application/json");
    const call = {
      method: url.split("/").at(-1)!,
      params: JSON.parse(String(init?.body)) as Record<string, unknown>,
    };
    calls.push(call);
    const custom = reply?.(call);
    if (custom) return custom;
    if (call.method === "getChat")
      return Response.json({ ok: true, result: { id: 1, type: "private", username: "venditore" } });
    if (["answerCallbackQuery", "setMyCommands", "deleteMyCommands"].includes(call.method))
      return Response.json({ ok: true, result: true });
    return Response.json({ ok: true, result: { message_id: calls.length } });
  });
  return { fetcher, calls, texts: () => calls.filter((c) => c.method === "sendMessage") };
}

/** Utente con spazio, negozio e, se richiesto, Premium in corso. */
async function account(name: string, premium = true) {
  const { userId, cookie } = await verifiedSession(`${name}@example.invalid`);
  const workspace = `w-${name}`;
  await env.DB.batch([
    env.DB.prepare("INSERT INTO workspaces (id, name, created_at) VALUES (?, ?, ?)").bind(
      workspace,
      name,
      now,
    ),
    env.DB.prepare("INSERT INTO workspace_members VALUES (?, ?, 'owner')").bind(workspace, userId),
    insertStore({ id: `s-${name}`, workspaceId: workspace }),
    ...(premium
      ? [
          env.DB.prepare(`INSERT INTO workspace_entitlements (id, workspace_id, source, starts_at, ends_at)
            VALUES (?, ?, 'admin', ?, ?)`).bind(
            `e-${name}`,
            workspace,
            new Date(Date.parse(now) - 86_400_000).toISOString(),
            new Date(Date.parse(now) + 30 * 86_400_000).toISOString(),
          ),
        ]
      : []),
  ]);
  return { userId, cookie, workspace, store: `s-${name}` };
}

function settingsForm(cookie: string, fields: Record<string, string>) {
  return settingsAction({
    request: new Request(`${origin}/app/impostazioni/notifiche`, {
      method: "POST",
      headers: { cookie, origin },
      body: new URLSearchParams(fields),
    }),
  } as Parameters<typeof settingsAction>[0]);
}

/** Deep link creato dalle Impostazioni; restituisce il token che Telegram rimanda al bot. */
async function linkToken(cookie: string) {
  const response = (await settingsForm(cookie, { intent: "telegram-link" })) as Response;
  expect(response.status).toBe(302);
  const location = new URL(response.headers.get("location")!);
  expect(`${location.origin}${location.pathname}`).toBe("https://t.me/FiscalBayTestBot");
  return location.searchParams.get("start")!;
}

let updateId = 1000;

function update(text: string, chat = 501, type = "private", date = Date.parse(now) / 1000) {
  return { update_id: ++updateId, message: { date, chat: { id: chat, type }, text } };
}

const endpoint = "https://test.fiscalbay.it/webhooks/telegram";

function webhook(body: unknown, header: string | null = secret) {
  return new Request(endpoint, {
    method: "POST",
    headers: header === null ? {} : { "x-telegram-bot-api-secret-token": header },
    body: JSON.stringify(body),
  });
}

/**
 * Aggiornamento ricevuto dall'ingresso, che risponde subito, come in esercizio. Se la risposta
 * non si completa la ricevuta va in coda: il consumer la riprende con la stessa Bot API e il
 * messaggio di coda è il risultato; null se ha risposto l'ingresso.
 */
async function deliver(text: string, chat = 501, fetcher = bot().fetcher, at = new Date(now)) {
  send.mockClear();
  const body = update(text, chat, "private", Math.floor(at.getTime() / 1000));
  const response = await receiveWebhook(webhook(body), environment, fetcher, at);
  expect(response?.status).toBe(204);
  if (send.mock.calls.length === 0) return null;
  const message = queueMessage(send.mock.calls[0]![0]);
  await consumeWebhooks({ messages: [message] }, environment, fetcher, at);
  return message;
}

const link = (workspace: string) =>
  env.DB.prepare(
    "SELECT id, chat_id, chat_label, language FROM telegram_links WHERE workspace_id = ?",
  )
    .bind(workspace)
    .first<{ id: string; chat_id: string; chat_label: string | null; language: string }>();

beforeEach(async () => {
  await resetDatabase();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM webhook_receipts"),
    env.DB.prepare("DELETE FROM workspace_entitlements"),
  ]);
  send.mockClear();
});

describe("ingresso del bot", () => {
  it("rifiuta metodo, segreto e corpo non validi e accoglie soltanto /start in chat privata", async () => {
    const get = await receiveWebhook(new Request(endpoint), environment);
    expect(get?.status).toBe(405);
    expect(get?.headers.get("allow")).toBe("POST");
    expect((await receiveWebhook(webhook(update("/start")), environment))?.status).toBe(204);
    send.mockClear();
    expect((await receiveWebhook(webhook(update("/start"), null), environment))?.status).toBe(401);
    expect((await receiveWebhook(webhook(update("/start"), "altro"), environment))?.status).toBe(
      401,
    );
    const garbage = new Request("https://test.fiscalbay.it/webhooks/telegram", {
      method: "POST",
      headers: { "x-telegram-bot-api-secret-token": secret },
      body: "{",
    });
    expect((await receiveWebhook(garbage, environment))?.status).toBe(412);
    const large = webhook({ update_id: 1, padding: "x".repeat(300_000) });
    expect((await receiveWebhook(large, environment))?.status).toBe(413);
    // Gruppi, altri messaggi e aggiornamenti senza messaggio non hanno effetti né ricevute.
    for (const body of [
      update("/start token", 501, "group"),
      update("ciao"),
      { update_id: ++updateId, my_chat_member: {} },
    ])
      expect((await receiveWebhook(webhook(body), environment))?.status).toBe(204);
    expect(send).not.toHaveBeenCalled();
    const receipts = await env.DB.prepare("SELECT COUNT(*) AS n FROM webhook_receipts").first<{
      n: number;
    }>();
    expect(receipts?.n).toBe(1);
  });

  it("senza il bot dell'ambiente l'ingresso non è disponibile", async () => {
    const off = { ...environment, TELEGRAM_BOT_TOKEN: undefined } as Env;
    expect(telegramConfigured(off)).toBe(false);
    expect(telegramConfigured({ ...environment, TELEGRAM_BOT_USERNAME: "" } as Env)).toBe(false);
    for (const change of [
      { TELEGRAM_BOT_USERNAME: undefined },
      { TELEGRAM_WEBHOOK_SECRET: undefined },
      { TELEGRAM_BOT_USERNAME: "@FiscalBayTestBot" },
      { TELEGRAM_BOT_USERNAME: "FiscalBayTestBot!" },
      { TELEGRAM_WEBHOOK_SECRET: `!${"a".repeat(40)}` },
      { TELEGRAM_WEBHOOK_SECRET: `${"a".repeat(40)}!` },
    ])
      expect(telegramConfigured({ ...environment, ...change } as Env)).toBe(false);
    expect(telegramConfigured({ ...environment, TELEGRAM_WEBHOOK_SECRET: "corto" } as Env)).toBe(
      false,
    );
    expect(telegramConfigured(environment)).toBe(true);
    expect((await receiveWebhook(webhook(update("/start")), off))?.status).toBe(503);
  });

  it("conserva chat e impronta del token, mai il testo, e risponde una volta sola", async () => {
    const token = "A".repeat(43);
    const body = update(`/start ${token}`, 777);
    const api = bot();
    expect((await receiveWebhook(webhook(body), environment, api.fetcher))?.status).toBe(204);
    expect((await receiveWebhook(webhook(body), environment, api.fetcher))?.status).toBe(204);
    // L'ingresso esegue subito l'aggiornamento: nessuna coda, e un nuovo tentativo non lo ripete.
    expect(send).not.toHaveBeenCalled();
    const receipt = await env.DB.prepare("SELECT * FROM webhook_receipts").first();
    expect(receipt).toMatchObject({
      provider: "telegram",
      environment: "test",
      provider_id: String(body.update_id),
      topic: "start",
      object_id: "777",
      store_id: null,
      link_token_hash: createHash("sha256").update(token).digest("hex"),
      event_at: now,
    });
    expect(JSON.stringify(receipt)).not.toContain(token);
    expect(receipt).toMatchObject({ queued_at: null, completed_at: expect.any(String) });
    // Lo stesso aggiornamento con un contenuto diverso non cambia la ricevuta.
    const changed = { ...body, message: { ...body.message, chat: { id: 778, type: "private" } } };
    expect((await receiveWebhook(webhook(changed), environment))?.status).toBe(409);
  });

  it("riconosce il comando con il nome del bot e ignora un token malformato", () => {
    const start = (text: string) => verifyTelegramUpdate(JSON.stringify(update(text)), secret, env);
    expect(start(`/start@FiscalBayTestBot ${"b".repeat(43)}`)?.tokenHash).toHaveLength(64);
    expect(start("/start corto")).toMatchObject({ tokenHash: null, chatId: "501" });
    expect(start("/start")).toMatchObject({ tokenHash: null });
    expect(start("/stop")).toBeNull();
    expect(start(`/start ${"c".repeat(43)} altro`)).toBeNull();
    // Spazi in più e in coda non cambiano il token; un testo prima del comando non è un comando.
    expect(start(`/start   ${"d".repeat(43)}  `)?.tokenHash).toHaveLength(64);
    expect(start(`ciao /start ${"d".repeat(43)}`)).toBeNull();
    // Il token ha esattamente 43 caratteri ammessi.
    expect(start(`/start ${"e".repeat(44)}`)).toMatchObject({ tokenHash: null });
    expect(start(`/start !${"e".repeat(43)}`)).toMatchObject({ tokenHash: null });
    // Un messaggio senza testo, come una foto, non è un comando.
    const photo = { update_id: ++updateId, message: { date: 1, chat: { id: 1, type: "private" } } };
    expect(verifyTelegramUpdate(JSON.stringify(photo), secret, env)).toBeNull();
  });

  it("il token del deep link ha il formato accettato da Telegram", () => {
    const token = randomLinkToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(randomLinkToken()).not.toBe(token);
  });

  it("riconosce ogni nome dei comandi e i tocchi con dati validi in chat privata", () => {
    const command = (text: string) =>
      verifyTelegramUpdate(JSON.stringify(update(text)), secret, env);
    for (const [name, expected] of [
      ["stato", "status"],
      ["status", "status"],
      ["ultimi", "latest"],
      ["latest", "latest"],
      ["preferenze", "preferences"],
      ["preferences", "preferences"],
      ["aiuto", "help"],
      ["help", "help"],
    ])
      expect(command(`/${name}`)).toMatchObject({ kind: "command", command: expected });
    // Il nome del bot e gli spazi in coda non cambiano il comando; un testo in più sì.
    expect(command("/stato@FiscalBayTestBot  ")).toMatchObject({ command: "status" });
    expect(command("/aiuto  ")).toMatchObject({ command: "help" });
    for (const text of ["x/stato", "ciao /stato", "/stato extra", "/sconosciuto"])
      expect(command(text)).toBeNull();
    const message = { message_id: 42, chat: { id: 501, type: "private" } };
    const tapped = (callback: Record<string, unknown>) =>
      verifyTelegramUpdate(
        JSON.stringify({ update_id: 1, callback_query: { id: "cb", ...callback } }),
        secret,
        env,
        new Date(now),
      );
    expect(tapped({ data: "st:a_b-1", message })).toEqual({
      kind: "callback",
      updateId: 1,
      chatId: "501",
      eventAt: now,
      callbackId: "cb",
      messageId: 42,
      data: "st:a_b-1",
    });
    expect(tapped({ data: "x".repeat(64), message })).toMatchObject({ kind: "callback" });
    // Dati assenti, troppo lunghi o con caratteri non ammessi, anche solo in testa o in coda.
    for (const data of ["x".repeat(65), "ok!", "!ok", "ok ok", "", undefined])
      expect(tapped({ data, message })).toBeNull();
    expect(tapped({ data: "st", message: { ...message, chat: { id: 501, type: "group" } } })).toBe(
      null,
    );
    expect(tapped({ data: "st" })).toBeNull();
  });

  it("in Production la ricevuta del bot appartiene all'ambiente live", async () => {
    const production = { ...environment, APP_ORIGIN: "https://fiscalbay.it" } as Env;
    const api = bot();
    expect((await receiveWebhook(webhook(update("/aiuto")), production, api.fetcher))?.status).toBe(
      204,
    );
    expect(await env.DB.prepare("SELECT environment FROM webhook_receipts").first()).toEqual({
      environment: "live",
    });
  });

  it("avvio, comandi e tocchi si eseguono subito, senza passare dalla coda", async () => {
    const api = bot();
    for (const body of [
      update(`/start ${"h".repeat(43)}`),
      update("/stato"),
      {
        update_id: ++updateId,
        callback_query: {
          id: "cb-subito",
          data: "st:x",
          message: { message_id: 42, chat: { id: 501, type: "private" } },
        },
      },
    ])
      expect((await receiveWebhook(webhook(body), environment, api.fetcher))?.status).toBe(204);
    expect(send).not.toHaveBeenCalled();
    const { results } = await env.DB.prepare(
      "SELECT topic, queued_at, completed_at FROM webhook_receipts ORDER BY topic",
    ).all();
    expect(results).toEqual(
      ["callback", "command", "start"].map((topic) => ({
        topic,
        queued_at: null,
        completed_at: expect.any(String),
      })),
    );
  });

  it("lo stesso aggiornamento con altro contenuto è un conflitto; un tocco riprovato più tardi no", async () => {
    const api = bot();
    const status = async (body: unknown, at = new Date(now)) =>
      (await receiveWebhook(webhook(body), environment, api.fetcher, at))?.status;
    const message = (text: string, date = Date.parse(now) / 1000) => ({
      update_id: ++updateId,
      message: { date, chat: { id: 501, type: "private" }, text },
    });
    const pairs: Array<[unknown, unknown]> = [];
    const start = message(`/start ${"f".repeat(43)}`);
    pairs.push([
      start,
      { ...start, message: { ...start.message, text: `/start ${"g".repeat(43)}` } },
    ]);
    const command = message("/stato");
    pairs.push([command, { ...command, message: { ...command.message, text: "/aiuto" } }]);
    const late = message("/aiuto");
    pairs.push([late, { ...late, message: { ...late.message, date: late.message.date - 60 } }]);
    const callback = (id: string, messageId: number) => ({
      id,
      data: "st:x",
      message: { message_id: messageId, chat: { id: 501, type: "private" } },
    });
    const tap = (callbackQuery: ReturnType<typeof callback>, update_id = ++updateId) => ({
      update_id,
      callback_query: callbackQuery,
    });
    const other = tap(callback("cb-uno", 42));
    pairs.push([other, tap(callback("cb-due", 42), other.update_id)]);
    const moved = tap(callback("cb-tre", 42));
    pairs.push([moved, tap(callback("cb-tre", 43), moved.update_id)]);
    for (const [first, second] of pairs) {
      expect(await status(first)).toBe(204);
      expect(await status(second)).toBe(409);
    }
    // Il tocco prende la data dalla ricezione: un nuovo tentativo più tardi è lo stesso.
    const retried = tap(callback("cb-quattro", 42));
    expect(await status(retried)).toBe(204);
    expect(await status(retried, later(1))).toBe(204);
  });
});

describe("collegamento della chat", () => {
  it("collega la chat che avvia il bot con il token dello spazio e lo conferma nella sua lingua", async () => {
    const seller = await account("collega");
    const token = await linkToken(seller.cookie);
    // Nel database resta l'impronta, legata a spazio e sessione.
    const request = await env.DB.prepare("SELECT * FROM telegram_link_requests").first();
    expect(JSON.stringify(request)).not.toContain(token);
    expect(request).toMatchObject({
      workspace_id: seller.workspace,
      user_id: seller.userId,
      language: "it",
      time_zone: "Europe/Rome",
      expires_at: later(15).toISOString(),
      consumed_at: null,
    });
    const api = bot();
    const message = await deliver(`/start ${token}`, 501, api.fetcher);
    // L'ingresso ha risposto subito, senza passare dalla coda.
    expect(message).toBeNull();
    expect(await link(seller.workspace)).toMatchObject({
      chat_id: "501",
      chat_label: "@venditore",
      language: "it",
    });
    expect(api.texts()).toEqual([
      expect.objectContaining({
        params: expect.objectContaining({
          chat_id: "501",
          text: expect.stringContaining("Chat collegata a FiscalBay"),
        }),
      }),
    ]);
    // Predefiniti: notifiche attive, soli ordini con dato fiscale, un messaggio per ordine.
    expect(await telegramSettings(env.DB, seller.userId, "Europe/Rome")).toMatchObject({
      chat: { label: "@venditore", linkedAt: now },
      enabled: true,
      filter: "fiscal",
      mode: "each",
      digestTime: "18:00",
      timeZone: "Europe/Rome",
      stores: [{ id: seller.store, enabled: true, paused: false }],
    });
    // Il token è monouso: un altro aggiornamento, anche da un'altra chat, non lo riusa.
    const replay = bot();
    await deliver(`/start ${token}`, 999, replay.fetcher);
    expect((await link(seller.workspace))?.chat_id).toBe("501");
    expect(replay.texts()[0]?.params.text).toContain("Questo link non è più valido");
    expect(replay.calls.some((call) => call.method === "getChat")).toBe(false);
  });

  it("lo stesso aggiornamento riprovato ritrova il collegamento e ripete soltanto la conferma", async () => {
    const seller = await account("riprova");
    const token = await linkToken(seller.cookie);
    send.mockClear();
    // Telegram non risponde alla conferma: la ricevuta passa alla coda, che la riprova con
    // l'attesa indicata.
    const limited = bot((call) =>
      call.method === "sendMessage"
        ? Response.json(
            { ok: false, error_code: 429, parameters: { retry_after: 7 } },
            { status: 429 },
          )
        : undefined,
    );
    await receiveWebhook(
      webhook(update(`/start ${token}`, 601)),
      environment,
      limited.fetcher,
      new Date(now),
    );
    const body = send.mock.calls[0]![0];
    const first = queueMessage(body);
    await consumeWebhooks({ messages: [first] }, environment, limited.fetcher, new Date(now));
    expect(first.retry).toHaveBeenCalledWith({ delaySeconds: 7 });
    const linked = await link(seller.workspace);
    expect(linked?.chat_id).toBe("601");
    // Il nuovo tentativo arriva dopo la scadenza del link: vale l'istante del messaggio.
    const api = bot();
    const second = queueMessage(body, 2);
    await consumeWebhooks({ messages: [second] }, environment, api.fetcher, later(30));
    expect(second.ack).toHaveBeenCalledOnce();
    expect(await link(seller.workspace)).toEqual(linked);
    expect(api.texts()[0]?.params.text).toContain("Chat collegata");
  });

  it("un vecchio /start riprovato dopo un cambio di chat non ripristina la chat precedente", async () => {
    const seller = await account("riprova-vecchia");
    const token = await linkToken(seller.cookie);
    send.mockClear();
    const limited = bot((call) =>
      call.method === "sendMessage"
        ? Response.json(
            { ok: false, error_code: 429, parameters: { retry_after: 7 } },
            { status: 429 },
          )
        : undefined,
    );
    await receiveWebhook(
      webhook(update(`/start ${token}`, 611)),
      environment,
      limited.fetcher,
      new Date(now),
    );
    const body = send.mock.calls[0]![0];
    expect((await link(seller.workspace))?.chat_id).toBe("611");
    // Un'altra chat si collega prima che la conferma della prima venga riprovata.
    await deliver(`/start ${await linkToken(seller.cookie)}`, 612, bot().fetcher, later(5));
    const current = await link(seller.workspace);
    expect(current?.chat_id).toBe("612");
    const api = bot();
    const retried = queueMessage(body, 2);
    await consumeWebhooks({ messages: [retried] }, environment, api.fetcher, later(10));
    expect(retried.ack).toHaveBeenCalledOnce();
    expect(await link(seller.workspace)).toEqual(current);
    expect(api.calls.some((call) => call.method === "getChat")).toBe(false);
    expect(api.texts()).toEqual([
      expect.objectContaining({
        params: expect.objectContaining({
          chat_id: "611",
          text: expect.stringContaining("Questo link non è più valido"),
        }),
      }),
    ]);
  });

  it("un link già usato non vale per un altro /start, anche dalla chat collegata", async () => {
    const seller = await account("link-usato");
    const token = await linkToken(seller.cookie);
    await deliver(`/start ${token}`, 621, bot().fetcher, later(1));
    const linked = await link(seller.workspace);
    expect(linked?.chat_id).toBe("621");
    // Un nuovo aggiornamento con lo stesso token è un'altra ricevuta: il link è già consumato.
    const api = bot();
    await deliver(`/start ${token}`, 621, api.fetcher, later(2));
    expect(await link(seller.workspace)).toEqual(linked);
    expect(api.texts()).toEqual([
      expect.objectContaining({
        params: expect.objectContaining({
          chat_id: "621",
          text: expect.stringContaining("http://localhost:5173/app/impostazioni/notifiche"),
        }),
      }),
    ]);
    expect(api.texts()[0]!.params.text).toContain("Questo link non è più valido");
  });

  it("il collegamento e il cambio di chat fissano il fuso dell'account anche con preferenze salvate", async () => {
    const seller = await account("fuso-collegamento");
    await saveTelegramChange(env.DB, seller.userId, { name: "mode", value: "digest" }, "UTC");
    const token = async (zone: string) => {
      const response = (await settingsAction({
        request: new Request(`${origin}/app/impostazioni/notifiche`, {
          method: "POST",
          headers: {
            cookie: `${seller.cookie}; fiscalbay_fuso=${encodeURIComponent(zone)}`,
            origin,
          },
          body: new URLSearchParams({ intent: "telegram-link" }),
        }),
      } as Parameters<typeof settingsAction>[0])) as Response;
      return new URL(response.headers.get("location")!).searchParams.get("start")!;
    };
    await deliver(`/start ${await token("America/New_York")}`, 2001);
    expect(await telegramSettings(env.DB, seller.userId, "Europe/Berlin")).toMatchObject({
      mode: "digest",
      timeZone: "America/New_York",
    });
    await deliver(`/start ${await token("Asia/Tokyo")}`, 2002, bot().fetcher, later(5));
    expect((await link(seller.workspace))?.chat_id).toBe("2002");
    expect((await telegramSettings(env.DB, seller.userId, "Europe/Berlin")).timeZone).toBe(
      "Asia/Tokyo",
    );
  });

  it("rifiuta il link scaduto, sostituito, di una sessione chiusa o di chi ha lasciato lo spazio", async () => {
    const seller = await account("rifiuti");
    const expired = await linkToken(seller.cookie);
    const late = bot();
    await deliver(`/start ${expired}`, 701, late.fetcher, later(15));
    expect(await link(seller.workspace)).toBeNull();
    expect(late.texts()[0]?.params.text).toContain("Questo link non è più valido");

    // Un nuovo link sostituisce quello non ancora usato.
    const replaced = await linkToken(seller.cookie);
    const current = await linkToken(seller.cookie);
    await deliver(`/start ${replaced}`, 701);
    expect(await link(seller.workspace)).toBeNull();

    // L'utente non è più nello spazio.
    await env.DB.prepare("DELETE FROM workspace_members WHERE user_id = ?")
      .bind(seller.userId)
      .run();
    await deliver(`/start ${current}`, 701);
    expect(await link(seller.workspace)).toBeNull();
    await env.DB.prepare("INSERT INTO workspace_members VALUES (?, ?, 'owner')")
      .bind(seller.workspace, seller.userId)
      .run();

    // Chiudere la sessione elimina il link: sul test il bot non risponde a una chat sconosciuta.
    const closed = await linkToken(seller.cookie);
    await env.DB.prepare('DELETE FROM "session" WHERE "userId" = ?').bind(seller.userId).run();
    const api = bot();
    const message = await deliver(`/start ${closed}`, 701, api.fetcher);
    // L'ingresso ha risposto subito, senza passare dalla coda.
    expect(message).toBeNull();
    expect(await link(seller.workspace)).toBeNull();
    expect(api.calls).toEqual([]);
  });

  it("sul test il bot tace con chi non arriva da un link; in Production spiega dove collegarsi", async () => {
    const silent = bot();
    await deliver("/start", 801, silent.fetcher);
    expect(silent.calls).toEqual([]);
    const production = { ...env, APP_ORIGIN: "https://fiscalbay.it" } as Env;
    const start = (tokenHash: string | null) => ({
      receiptId: crypto.randomUUID(),
      chatId: "802",
      tokenHash,
      eventAt: now,
    });
    const help = bot();
    await consumeTelegramStart(production, start(null), help.fetcher, new Date(now));
    const text = String(help.texts()[0]?.params.text);
    expect(text).toContain("collega questa chat da FiscalBay");
    expect(text).toContain("link this chat in FiscalBay");
    expect(text).toContain("https://fiscalbay.it/app/impostazioni/notifiche");
    expect(text).toContain("https://fiscalbay.it/en/app/impostazioni/notifiche");
    // Le due lingue stanno in paragrafi separati.
    expect(text).toContain("/app/impostazioni/notifiche\n\nTo receive");
    const unknown = bot();
    await consumeTelegramStart(production, start("f".repeat(64)), unknown.fetcher, new Date(now));
    const invalid = String(unknown.texts()[0]?.params.text);
    expect(invalid).toContain("Questo link non è più valido");
    expect(invalid).toContain("This link is no longer valid");
  });

  it("il cambio di chat sostituisce la precedente: le sue consegne non hanno più destinatario", async () => {
    const seller = await account("cambio");
    await deliver(`/start ${await linkToken(seller.cookie)}`, 901);
    const first = (await link(seller.workspace))!;
    const event = { storeId: seller.store, eventAt: later(1).toISOString() };
    expect(await telegramRecipient(env.DB, { ...event, linkId: first.id }, later(2))).toMatchObject(
      { chatId: "901", linkId: first.id },
    );
    // Fino all'«Avvia» della nuova chat resta la precedente.
    const token = await linkToken(seller.cookie);
    expect((await link(seller.workspace))?.chat_id).toBe("901");
    // La stessa chat che riavvia il bot resta lo stesso collegamento.
    await deliver(`/start ${await linkToken(seller.cookie)}`, 901);
    expect((await link(seller.workspace))?.id).toBe(first.id);
    await deliver(`/start ${await linkToken(seller.cookie)}`, 902, bot().fetcher, later(3));
    const second = (await link(seller.workspace))!;
    expect(second).toMatchObject({ chat_id: "902" });
    expect(second.id).not.toBe(first.id);
    expect(token).not.toBe("");
    // La consegna preparata per la chat precedente non va da nessuna parte.
    expect(await telegramRecipient(env.DB, { ...event, linkId: first.id }, later(4))).toBeNull();
    // La nuova chat riceve soltanto gli eventi successivi al proprio collegamento.
    expect(await telegramRecipient(env.DB, event, later(4))).toBeNull();
    expect(
      await telegramRecipient(
        env.DB,
        { storeId: seller.store, eventAt: later(3).toISOString() },
        later(4),
      ),
    ).toMatchObject({ chatId: "902", linkId: second.id });
  });

  it("senza Premium non si crea il link; la chat senza nome resta collegata", async () => {
    const free = await account("senza-premium", false);
    expect(await settingsForm(free.cookie, { intent: "telegram-link" })).toMatchObject({
      data: { ok: false, notice: "Le notifiche degli ordini su Telegram sono incluse in Premium." },
      init: { status: 409 },
    });
    expect(
      await env.DB.prepare("SELECT COUNT(*) AS n FROM telegram_link_requests").first(),
    ).toEqual({ n: 0 });

    const seller = await account("senza-nome");
    const api = bot((call) =>
      call.method === "getChat"
        ? Response.json({ ok: false, error_code: 400 }, { status: 400 })
        : undefined,
    );
    await deliver(`/start ${await linkToken(seller.cookie)}`, 1001, api.fetcher);
    expect(await link(seller.workspace)).toMatchObject({ chat_id: "1001", chat_label: null });
  });

  it("il bot bloccato subito dopo «Avvia» non fa riprovare il collegamento già fatto", async () => {
    const seller = await account("bloccato");
    const blocked = bot((call) =>
      call.method === "sendMessage"
        ? Response.json({ ok: false, error_code: 403 }, { status: 403 })
        : undefined,
    );
    const message = await deliver(
      `/start ${await linkToken(seller.cookie)}`,
      1101,
      blocked.fetcher,
    );
    // L'ingresso ha risposto subito, senza passare dalla coda.
    expect(message).toBeNull();
    expect((await link(seller.workspace))?.chat_id).toBe("1101");
  });

  it("collega dal consumer anche senza passare dalla coda, con la risposta in inglese", async () => {
    const seller = await account("inglese");
    const response = (await settingsAction({
      request: new Request(`${origin}/en/app/impostazioni/notifiche`, {
        method: "POST",
        headers: { cookie: seller.cookie, origin },
        body: new URLSearchParams({ intent: "telegram-link" }),
      }),
    } as Parameters<typeof settingsAction>[0])) as Response;
    const token = new URL(response.headers.get("location")!).searchParams.get("start")!;
    const api = bot();
    await consumeTelegramStart(
      env,
      {
        receiptId: crypto.randomUUID(),
        chatId: "1201",
        tokenHash: createHash("sha256").update(token).digest("hex"),
        eventAt: now,
      },
      api.fetcher,
      new Date(now),
    );
    expect(await link(seller.workspace)).toMatchObject({ chat_id: "1201", language: "en" });
    expect(api.texts()[0]?.params.text).toContain("Chat linked to FiscalBay");
  });
});

describe("preferenze e destinatario", () => {
  it("accetta soltanto le scelte previste", () => {
    expect(parseTelegramChange("telegram", "false")).toEqual({ name: "enabled", value: false });
    expect(parseTelegramChange("telegram-filter", "all")).toEqual({ name: "filter", value: "all" });
    expect(parseTelegramChange("telegram-mode", "digest")).toEqual({
      name: "mode",
      value: "digest",
    });
    expect(parseTelegramChange("telegram-digest-time", "21:00")).toEqual({
      name: "digestTime",
      value: "21:00",
    });
    expect(parseTelegramChange("store-notifications:s-1", "true")).toEqual({
      name: "store",
      storeId: "s-1",
      value: true,
    });
    for (const [name, value] of [
      ["telegram", "si"],
      ["telegram-filter", "nessuno"],
      ["telegram-mode", "settimanale"],
      ["telegram-digest-time", "09:30"],
      ["store-notifications:", "true"],
      ["store-notifications:s-1", "1"],
      ["altro", "true"],
    ])
      expect(parseTelegramChange(name!, value!)).toBeNull();
  });

  it("salva le scelte dalle Impostazioni e le rilegge all'invio", async () => {
    const seller = await account("preferenze");
    await deliver(`/start ${await linkToken(seller.cookie)}`, 1301);
    const recipient = (eventAt: Date, at: Date) =>
      telegramRecipient(env.DB, { storeId: seller.store, eventAt: eventAt.toISOString() }, at);
    expect(await recipient(later(1), later(1))).toMatchObject({
      chatId: "1301",
      filter: "fiscal",
      mode: "each",
      digestTime: "18:00",
      timeZone: "Europe/Rome",
      language: "it",
    });
    const save = (name: string, value: string, cookie = seller.cookie) =>
      settingsForm(cookie, { intent: "save", name, value });
    expect(await save("telegram-filter", "all")).toEqual({ ok: true });
    expect(await save("telegram-mode", "digest")).toEqual({ ok: true });
    expect(await save("telegram-digest-time", "08:00")).toEqual({ ok: true });
    expect(await save("telegram-digest-time", "07:00")).toMatchObject({ init: { status: 400 } });
    expect(await recipient(later(1), later(1))).toMatchObject({
      filter: "all",
      mode: "digest",
      digestTime: "08:00",
    });

    // Disattivate: nessun destinatario. Riattivate: soltanto gli eventi successivi.
    vi.setSystemTime(later(10));
    expect(await save("telegram", "false")).toEqual({ ok: true });
    expect(await recipient(later(11), later(11))).toBeNull();
    vi.setSystemTime(later(20));
    expect(await save("telegram", "true")).toEqual({ ok: true });
    expect(await recipient(later(15), later(21))).toBeNull();
    expect(await recipient(later(20), later(21))).not.toBeNull();
    // Riattivare quando sono già attive non sposta l'inizio degli eventi.
    vi.setSystemTime(later(30));
    expect(await save("telegram", "true")).toEqual({ ok: true });
    expect(await recipient(later(25), later(31))).not.toBeNull();

    // Lo stesso per il negozio.
    vi.setSystemTime(later(40));
    expect(await save(`store-notifications:${seller.store}`, "false")).toEqual({ ok: true });
    expect(await recipient(later(41), later(41))).toBeNull();
    vi.setSystemTime(later(50));
    expect(await save(`store-notifications:${seller.store}`, "true")).toEqual({ ok: true });
    expect(await recipient(later(45), later(51))).toBeNull();
    expect(await recipient(later(50), later(51))).not.toBeNull();

    // Il negozio di un altro spazio non si tocca.
    const other = await account("preferenze-altro");
    expect(await save(`store-notifications:${seller.store}`, "false", other.cookie)).toMatchObject({
      init: { status: 404 },
    });
    expect(await recipient(later(52), later(52))).not.toBeNull();

    // Senza Premium, nessun invio; la chat resta collegata per il ritorno.
    const ended = later(31 * 24 * 60);
    expect(await recipient(ended, ended)).toBeNull();
    expect((await link(seller.workspace))?.chat_id).toBe("1301");
  });

  it("frequenza e orario fissano il fuso dell'account in quel momento", async () => {
    const seller = await account("fuso");
    const save = (name: string, value: string) =>
      settingsAction({
        request: new Request(`${origin}/app/impostazioni/notifiche`, {
          method: "POST",
          headers: { cookie: `${seller.cookie}; fiscalbay_fuso=America%2FNew_York`, origin },
          body: new URLSearchParams({ intent: "save", name, value }),
        }),
      } as Parameters<typeof settingsAction>[0]);
    expect(await save("telegram-filter", "all")).toEqual({ ok: true });
    expect((await telegramSettings(env.DB, seller.userId, "Europe/Berlin")).timeZone).toBe(
      "America/New_York",
    );
    await saveTelegramChange(
      env.DB,
      seller.userId,
      { name: "digestTime", value: "21:00" },
      "Europe/London",
    );
    expect(await telegramSettings(env.DB, seller.userId, "Europe/Berlin")).toMatchObject({
      digestTime: "21:00",
      timeZone: "Europe/London",
    });
    // Il filtro non cambia il fuso del riepilogo.
    await saveTelegramChange(env.DB, seller.userId, { name: "filter", value: "fiscal" }, "UTC");
    expect((await telegramSettings(env.DB, seller.userId, "UTC")).timeZone).toBe("Europe/London");
  });

  it("nessuna chat di uno spazio riceve gli eventi dei negozi di un altro", async () => {
    const first = await account("isolamento-a");
    const second = await account("isolamento-b");
    await deliver(`/start ${await linkToken(first.cookie)}`, 1401);
    const event = (storeId: string) => ({ storeId, eventAt: later(1).toISOString() });
    expect(await telegramRecipient(env.DB, event(first.store), later(1))).toMatchObject({
      chatId: "1401",
    });
    expect(await telegramRecipient(env.DB, event(second.store), later(1))).toBeNull();
    const firstLink = (await link(first.workspace))!;
    expect(
      await telegramRecipient(env.DB, { ...event(second.store), linkId: firstLink.id }, later(1)),
    ).toBeNull();
    // Lo stesso utente Telegram può collegare la propria chat anche al secondo spazio.
    await deliver(`/start ${await linkToken(second.cookie)}`, 1401, bot().fetcher, later(2));
    expect(await telegramRecipient(env.DB, event(second.store), later(1))).toBeNull();
    expect(
      await telegramRecipient(
        env.DB,
        { storeId: second.store, eventAt: later(2).toISOString() },
        later(2),
      ),
    ).toMatchObject({ chatId: "1401" });
    expect((await link(second.workspace))?.id).not.toBe(firstLink.id);
    // Un negozio eliminato non ha destinatario.
    await env.DB.prepare("UPDATE ebay_stores SET data_deleted_at = ? WHERE id = ?")
      .bind(now, first.store)
      .run();
    expect(await telegramRecipient(env.DB, event(first.store), later(1))).toBeNull();
  });
});

describe("casi limite del collegamento e delle preferenze", () => {
  it("senza Premium il dominio non crea il link e lo dice", async () => {
    const free = await account("limite-free", false);
    const session = await env.DB.prepare('SELECT id FROM "session" WHERE "userId" = ?')
      .bind(free.userId)
      .first<{ id: string }>();
    expect(
      await startTelegramLink(env.DB, env, {
        userId: free.userId,
        sessionId: session!.id,
        language: "it",
        timeZone: "Europe/Rome",
      }),
    ).toEqual({ reason: "premium_required" });
  });

  it("un errore temporaneo nel leggere la chat fa riprovare senza collegare", async () => {
    const seller = await account("limite-getchat");
    const down = bot((call) =>
      call.method === "getChat" ? new Response("{}", { status: 503 }) : undefined,
    );
    const message = await deliver(`/start ${await linkToken(seller.cookie)}`, 1701, down.fetcher);
    expect(message!.retry).toHaveBeenCalledOnce();
    expect(await link(seller.workspace)).toBeNull();
    expect(down.texts()).toEqual([]);
  });

  it("la stessa chat che riavvia il bot aggiorna soltanto il nome mostrato", async () => {
    const seller = await account("limite-nome");
    await deliver(`/start ${await linkToken(seller.cookie)}`, 1801);
    const first = (await link(seller.workspace))!;
    const renamed = bot((call) =>
      call.method === "getChat"
        ? Response.json({ ok: true, result: { username: "nuovo_nome" } })
        : undefined,
    );
    await deliver(`/start ${await linkToken(seller.cookie)}`, 1801, renamed.fetcher, later(5));
    expect(await link(seller.workspace)).toEqual({ ...first, chat_label: "@nuovo_nome" });
  });

  it("il collegamento fissa il fuso della richiesta e lo conserva", async () => {
    const seller = await account("limite-fuso");
    const response = (await settingsAction({
      request: new Request(`${origin}/app/impostazioni/notifiche`, {
        method: "POST",
        headers: { cookie: `${seller.cookie}; fiscalbay_fuso=America%2FNew_York`, origin },
        body: new URLSearchParams({ intent: "telegram-link" }),
      }),
    } as Parameters<typeof settingsAction>[0])) as Response;
    const token = new URL(response.headers.get("location")!).searchParams.get("start")!;
    await deliver(`/start ${token}`, 1901);
    expect((await telegramSettings(env.DB, seller.userId, "Europe/Berlin")).timeZone).toBe(
      "America/New_York",
    );
    await saveTelegramChange(env.DB, seller.userId, { name: "mode", value: "digest" }, "UTC");
    expect(await telegramSettings(env.DB, seller.userId, "Europe/Berlin")).toMatchObject({
      mode: "digest",
      timeZone: "UTC",
    });
  });

  it("senza spazio valgono i predefiniti e nessuna scelta si salva", async () => {
    const { userId, cookie } = await verifiedSession("limite-senza-spazio@example.invalid");
    expect(await telegramSettings(env.DB, userId, "Europe/Rome")).toEqual({
      chat: null,
      enabled: true,
      filter: "fiscal",
      mode: "each",
      digestTime: "18:00",
      timeZone: "Europe/Rome",
      stores: [],
    });
    expect(
      await saveTelegramChange(env.DB, userId, { name: "filter", value: "all" }, "Europe/Rome"),
    ).toBe(false);
    expect(
      await settingsForm(cookie, { intent: "save", name: "telegram-filter", value: "all" }),
    ).toMatchObject({ init: { status: 404 } });
  });

  it("legge notifiche spente, scelte salvate e negozi in pausa per il piano", async () => {
    const seller = await account("limite-stato");
    // Collegata senza preferenze salvate: valgono i predefiniti. La pausa del piano si scrive
    // dopo, perché le Impostazioni di uno spazio Premium la tolgono.
    await deliver(`/start ${await linkToken(seller.cookie)}`, 2001);
    await env.DB.prepare(
      "INSERT INTO ebay_store_pauses (store_id, reason, paused_at) VALUES (?, 'plan', ?)",
    )
      .bind(seller.store, now)
      .run();
    await env.DB.prepare("DELETE FROM telegram_preferences WHERE workspace_id = ?")
      .bind(seller.workspace)
      .run();
    expect(await telegramSettings(env.DB, seller.userId, "UTC")).toMatchObject({
      enabled: true,
      stores: [{ id: seller.store, paused: true }],
    });
    await saveTelegramChange(env.DB, seller.userId, { name: "enabled", value: false }, "UTC");
    expect((await telegramSettings(env.DB, seller.userId, "UTC")).enabled).toBe(false);
  });

  it("accetta i valori predefiniti e rifiuta un negozio con un nome di troppo", () => {
    expect(parseTelegramChange("telegram-filter", "fiscal")).toEqual({
      name: "filter",
      value: "fiscal",
    });
    expect(parseTelegramChange("telegram-mode", "each")).toEqual({ name: "mode", value: "each" });
    expect(parseTelegramChange(`store-notifications:${"s".repeat(129)}`, "true")).toBeNull();
    expect(parseTelegramChange("x-store-notifications:s-1", "true")).toBeNull();
  });
});

describe("pagine", () => {
  it("le Impostazioni mostrano chat, preferenze e negozi dello spazio", async () => {
    const seller = await account("pagina");
    const page = async () => {
      const result = (await settingsLoader({
        request: new Request(`${origin}/app/impostazioni/notifiche`, {
          headers: { cookie: seller.cookie },
        }),
        params: { sezione: "notifiche" },
      } as unknown as Parameters<typeof settingsLoader>[0])) as { page: Record<string, unknown> };
      return result.page;
    };
    expect(await page()).toMatchObject({
      services: { telegram: true },
      telegram: { chat: null, enabled: true, filter: "fiscal", stores: [{ id: seller.store }] },
    });
    await deliver(`/start ${await linkToken(seller.cookie)}`, 1501);
    await settingsForm(seller.cookie, {
      intent: "save",
      name: `store-notifications:${seller.store}`,
      value: "false",
    });
    expect(await page()).toMatchObject({
      telegram: {
        chat: { label: "@venditore" },
        stores: [{ id: seller.store, enabled: false }],
      },
    });
  });

  it("i Negozi mostrano le notifiche per negozio soltanto con Premium", async () => {
    const seller = await account("negozi");
    const free = await account("negozi-free", false);
    const stores = async (cookie: string) => {
      const result = await storesLoader({
        request: new Request(`${origin}/app/negozi`, { headers: { cookie } }),
        params: {},
      } as unknown as Parameters<typeof storesLoader>[0]);
      return (result as unknown as { data: { page: Record<string, unknown> } }).data.page;
    };
    expect(await stores(free.cookie)).toMatchObject({
      account: { plan: "free" },
      notificationSettings: true,
      stores: [{ id: free.store, notifications: null }],
    });
    expect(await stores(seller.cookie)).toMatchObject({
      account: { plan: "premium" },
      stores: [{ id: seller.store, notifications: false }],
    });
    await deliver(`/start ${await linkToken(seller.cookie)}`, 1601);
    expect(await stores(seller.cookie)).toMatchObject({
      stores: [{ id: seller.store, notifications: true }],
    });
    await saveTelegramChange(env.DB, seller.userId, { name: "enabled", value: false }, "UTC");
    expect((await storeNotifications(env.DB, seller.userId))?.get(seller.store)).toBe(false);
    // Uno spazio senza negozi, o un utente senza spazio, non ha stati da mostrare.
    const { userId } = await verifiedSession("negozi-nessuno@example.invalid");
    expect(await storeNotifications(env.DB, userId)).toBeNull();
  });
});

describe("Bot API e conservazione", () => {
  it("classifica gli errori di Telegram come quelli degli altri provider", async () => {
    const answer = (response: Response | Error) =>
      vi.fn<typeof fetch>(async () => {
        if (response instanceof Error) throw response;
        return response;
      });
    const failure = (fetcher: typeof fetch) =>
      sendText(env, "1", "testo", fetcher).catch((error: unknown) => error);
    expect(await failure(answer(new TypeError("rete")))).toMatchObject({ failure: "unavailable" });
    expect(await failure(answer(new Response("{}", { status: 502 })))).toMatchObject({
      failure: "unavailable",
      details: { status: 502 },
    });
    expect(await failure(answer(new Response("{}", { status: 500 })))).toMatchObject({
      failure: "unavailable",
      details: { status: 500 },
    });
    expect(
      await failure(answer(new Response("", { status: 429, headers: { "retry-after": "3" } }))),
    ).toMatchObject({ failure: "rate_limited", details: { retryAfter: 3 } });
    // Una risposta JSON senza parametri lascia l'attesa all'intestazione.
    expect(
      await failure(
        answer(Response.json({ ok: false }, { status: 429, headers: { "retry-after": "4" } })),
      ),
    ).toMatchObject({ failure: "rate_limited", details: { retryAfter: 4 } });
    expect(await failure(answer(new Response("{}", { status: 401 })))).toMatchObject({
      failure: "credentials",
      details: { status: 401 },
    });
    expect(await failure(answer(new Response("{}", { status: 404 })))).toMatchObject({
      failure: "credentials",
    });
    expect(await failure(answer(new Response("{}", { status: 400 })))).toMatchObject({
      failure: "rejected",
      details: { status: 400 },
    });
    // Con stato 200 contano `ok` e la forma del risultato.
    expect(
      await failure(answer(Response.json({ ok: false, result: { message_id: 1 } }))),
    ).toMatchObject({ failure: "invalid_response", details: { status: 200 } });
    expect(await failure(answer(new Response("non json")))).toMatchObject({
      failure: "invalid_response",
      details: { status: 200 },
    });
    expect(await failure(answer(Response.json({ ok: true, result: {} })))).toMatchObject({
      failure: "invalid_response",
      details: { status: 200 },
    });
    expect(await failure(answer(new Response("x".repeat(70_000))))).toMatchObject({
      failure: "invalid_response",
      details: { status: 200 },
    });
    // Il messaggio parte senza anteprima dei link, verso la chat indicata.
    const sent = answer(Response.json({ ok: true, result: { message_id: 1 } }));
    await sendText(env, "77", "testo", sent);
    expect(JSON.parse(String(sent.mock.calls[0]![1]?.body))).toEqual({
      chat_id: "77",
      text: "testo",
      link_preview_options: { is_disabled: true },
    });
    const named = (result: Record<string, string>) =>
      chatLabel(env, "1", answer(Response.json({ ok: true, result })));
    expect(await named({ first_name: "Mario", last_name: "Rossi" })).toBe("Mario Rossi");
    expect(await named({ first_name: "Mario " })).toBe("Mario");
    expect(await named({ last_name: "Rossi" })).toBe("Rossi");
    expect(await named({ username: "u".repeat(140) })).toHaveLength(128);
    expect(await named({})).toBeNull();
    const asked = answer(Response.json({ ok: true, result: { username: "venditore" } }));
    await chatLabel(env, "88", asked);
    expect(JSON.parse(String(asked.mock.calls[0]![1]?.body))).toEqual({ chat_id: "88" });
  });

  it("invia e modifica i messaggi con anteprima e pulsanti soltanto se presenti", async () => {
    const api = bot();
    expect(await sendMessage(env, "77", { html: "<b>uno</b>" }, api.fetcher)).toBe(1);
    expect(await sendMessage(env, "77", { html: "due", buttons: [] }, api.fetcher)).toBe(2);
    expect(api.calls.map((call) => call.params)).toEqual(
      ["<b>uno</b>", "due"].map((text) => ({
        chat_id: "77",
        text,
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
      })),
    );
    // Un rifiuto lascia il messaggio com'è; gli altri errori restano errori.
    const edit = (status: number, body: Record<string, unknown> = { ok: false }) =>
      editMessage(
        env,
        "77",
        5,
        { html: "tre" },
        bot(() => Response.json(body, { status })).fetcher,
      );
    await expect(edit(400)).resolves.toBeUndefined();
    await expect(edit(500)).rejects.toMatchObject({ failure: "unavailable" });
    await expect(edit(429, { ok: false, parameters: { retry_after: 2 } })).rejects.toMatchObject({
      failure: "rate_limited",
      details: { retryAfter: 2 },
    });
    await expect(edit(401)).rejects.toMatchObject({ failure: "credentials" });
  });

  it("elimina le richieste un giorno dopo la scadenza", async () => {
    const seller = await account("pulizia");
    await linkToken(seller.cookie);
    await purgeExpiredRecords(env.DB, new Date(later(15).getTime() + 86_400_000 - 1));
    const count = () =>
      env.DB.prepare("SELECT COUNT(*) AS n FROM telegram_link_requests").first<{ n: number }>();
    expect((await count())?.n).toBe(1);
    await purgeExpiredRecords(env.DB, new Date(later(15).getTime() + 86_400_000));
    expect((await count())?.n).toBe(0);
  });
});

/** Spazio Premium con la chat collegata e l'importazione del negozio partita prima di `now`. */
async function linked(name: string, chat = 601) {
  const seller = await account(name);
  await deliver(`/start ${await linkToken(seller.cookie)}`, chat);
  await env.DB.prepare(
    "INSERT INTO sync_state (store_id, history_from, history_until, updated_at) VALUES (?, ?, ?, ?)",
  )
    .bind(seller.store, later(-30 * 24 * 60).toISOString(), now, now)
    .run();
  return { ...seller, chat };
}

const buyer = JSON.stringify({
  username: "compratore",
  name: "Mario Rossi",
  email: "mario@example.invalid",
  phone: "+39 333 1234567",
  billingAddress: {
    addressLine1: "Via Roma 1",
    addressLine2: null,
    city: "Roma",
    postalCode: "00100",
    stateOrProvince: "RM",
    countryCode: "IT",
  },
  shipTo: null,
});

/**
 * Ordine definitivo entrato negli elenchi dopo il collegamento. Senza `checking` la verifica è
 * conclusa, con o senza il dato; con `checking` il dettaglio è ancora da leggere.
 */
async function order(
  store: string,
  id: string,
  options: { created?: number; listed?: number; cf?: string; checking?: boolean } = {},
) {
  const { created = 1, listed = 2, cf, checking = false } = options;
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO orders (id, store_id, ebay_order_id, creation_time, last_modified_time,
        currency, total_minor, buyer_json, listed_at) VALUES (?, ?, ?, ?, ?, 'EUR', 3490, ?, ?)`).bind(
      id,
      store,
      `ebay-${id}`,
      later(created).toISOString(),
      later(created).toISOString(),
      buyer,
      later(listed).toISOString(),
    ),
    env.DB.prepare(`INSERT INTO order_items (id, order_id, line_item_id, title, quantity, total_minor, currency)
      VALUES (?, ?, 'line-1', 'Lampada <vintage> & paralume', 2, 3490, 'EUR')`).bind(`i-${id}`, id),
    checking
      ? env.DB.prepare(`INSERT INTO order_source_refs (store_id, source, external_order_id, order_id, last_modified_time)
          VALUES (?, 'fulfillment', ?, ?, ?)`).bind(
          store,
          `ebay-${id}`,
          id,
          later(created).toISOString(),
        )
      : env.DB.prepare(`INSERT INTO order_tax_checks (order_id, source, observed_at, availability)
          VALUES (?, 'ebay_trading_get_orders', ?, ?)`).bind(
          id,
          later(listed).toISOString(),
          cf ? "present" : "absent",
        ),
    ...(cf
      ? [
          insertTaxIdentifiers({
            id: `t-${id}`,
            orderId: id,
            type: "CODICE_FISCALE",
            value: cf,
            source: "ebay_trading_get_orders",
            observedAt: later(listed).toISOString(),
          }),
        ]
      : []),
  ]);
}

const run = (fetcher: typeof fetch, minutes: number) =>
  deliverTelegram(environment, fetcher, later(minutes));

const sentTexts = (api: ReturnType<typeof bot>) =>
  api.texts().map((call) => String(call.params.text));

const keyboard = (call: BotCall) =>
  (call.params.reply_markup as { inline_keyboard: Array<Array<Record<string, unknown>>> })
    .inline_keyboard;

const failure = (status: number, body: Record<string, unknown> = { ok: false }) =>
  Response.json(body, { status });

/** Bot API che a ogni invio chiede di riprovare dopo `seconds`. */
const rateLimited = (seconds: number) =>
  bot((call) =>
    call.method === "sendMessage"
      ? failure(429, { ok: false, parameters: { retry_after: seconds } })
      : undefined,
  );

/** Stato della consegna dell'ordine. */
const deliveryOf = (orderId: string) =>
  env.DB.prepare(`SELECT attempts, retry_at, uncertain_at, lease, locked_until, sent_at, failed_at
    FROM telegram_deliveries WHERE order_id = ?`)
    .bind(orderId)
    .first();

/** Errori registrati durante `action`, letti dalle righe JSON del log. */
async function logged(action: () => Promise<unknown>) {
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    await action();
    return errors.mock.calls.map(([line]) => JSON.parse(String(line)) as Record<string, unknown>);
  } finally {
    errors.mockRestore();
  }
}

describe("invii degli ordini", () => {
  it("invia il nuovo ordine con il CF normalizzato, senza contatti dell'acquirente, una volta sola", async () => {
    const seller = await linked("invio");
    await order(seller.store, "o-invio", { cf: "rss mra80a01h501u" });
    const image = "https://i.ebayimg.com/images/g/lampada/s-l500.jpg";
    await env.DB.prepare("UPDATE order_items SET image_url = ? WHERE order_id = 'o-invio'")
      .bind(image)
      .run();
    const api = bot();
    await run(api.fetcher, 10);
    const [sent] = api.texts();
    // La miniatura dell'articolo arriva dall'anteprima del link, fuori dal testo.
    expect(sent!.params).toMatchObject({
      chat_id: "601",
      parse_mode: "HTML",
      link_preview_options: { url: image, prefer_small_media: true, show_above_text: false },
    });
    const text = String(sent!.params.text);
    expect(text).toContain("<b>Nuovo ordine</b>");
    expect(text).toContain("<code>RSSMRA80A01H501U</code>");
    expect(text).toContain("Mario Rossi");
    expect(text).toContain("2 × Lampada &lt;vintage&gt; &amp; paralume");
    // Il dato fiscale in testa, i dettagli in citazione con numero e data relativa.
    expect(text).toMatch(
      /^🛒 <b>Nuovo ordine<\/b> · .+\n🧾 <code>RSSMRA80A01H501U<\/code>\n\n<blockquote>👤 Mario Rossi\n💶 <b>34,90/u,
    );
    expect(text).toContain("🕑 <i>oggi 22:01 · ebay-o-invio</i></blockquote>");
    for (const hidden of ["mario@example.invalid", "Via Roma", "333"])
      expect(text).not.toContain(hidden);
    expect(keyboard(sent!).flat()).toEqual([
      { text: "🔗 Apri in FiscalBay", url: `${origin}/app/ordini/o-invio` },
      { text: "🛍 Apri su eBay", url: ebayOrderHref("ebay-o-invio") },
      { text: "📋 Copia Codice Fiscale", copy_text: { text: "RSSMRA80A01H501U" } },
    ]);
    // Una nuova esecuzione, anche ripetuta dopo un'interruzione, non ripete l'evento.
    await run(api.fetcher, 20);
    await run(api.fetcher, 30);
    expect(api.texts()).toHaveLength(1);
    expect(
      await env.DB.prepare("SELECT last_delivery_at FROM telegram_links WHERE workspace_id = ?")
        .bind(seller.workspace)
        .first(),
    ).toEqual({ last_delivery_at: later(10).toISOString() });
  });

  it("con «solo fiscali» aspetta il dato e notifica la sua rimozione senza ripresentarlo", async () => {
    const seller = await linked("fiscali");
    await order(seller.store, "o-fiscali");
    const api = bot();
    await run(api.fetcher, 10);
    expect(api.texts()).toHaveLength(0);
    await insertTaxIdentifiers({
      id: "t-fiscali",
      orderId: "o-fiscali",
      type: "CODICE_FISCALE",
      value: "BNCLGU80A01H501Z",
      source: "ebay_trading_get_orders",
      observedAt: later(15).toISOString(),
    }).run();
    await run(api.fetcher, 20);
    expect(sentTexts(api)[0]).toContain("<code>BNCLGU80A01H501Z</code>");
    expect(sentTexts(api)[0]).toContain("Nuovo ordine");
    await env.DB.prepare("UPDATE tax_identifiers SET removed_at = ? WHERE id = 't-fiscali'")
      .bind(later(25).toISOString())
      .run();
    await run(api.fetcher, 30);
    const removed = api.texts()[1]!;
    expect(String(removed.params.text)).toContain("Dato fiscale rimosso");
    expect(String(removed.params.text)).not.toContain("BNCLGU80A01H501Z");
    expect(
      keyboard(removed)
        .flat()
        .some((button) => "copy_text" in button),
    ).toBe(false);
    await run(api.fetcher, 40);
    expect(api.texts()).toHaveLength(2);
  });

  it("con tutti gli ordini avvisa durante la verifica e poi quando il dato arriva", async () => {
    const seller = await linked("tutti");
    await saveTelegramChange(env.DB, seller.userId, { name: "filter", value: "all" }, "UTC");
    await order(seller.store, "o-tutti", { checking: true });
    const api = bot();
    await run(api.fetcher, 10);
    expect(sentTexts(api)[0]).toContain("Dato fiscale in verifica");
    await insertTaxIdentifiers({
      id: "t-tutti",
      orderId: "o-tutti",
      type: "CODICE_FISCALE",
      value: "rss mra80a01h501u",
      source: "ebay_fulfillment",
      observedAt: later(15).toISOString(),
    }).run();
    await env.DB.prepare("UPDATE order_source_refs SET detail_for = last_modified_time").run();
    await run(api.fetcher, 20);
    expect(sentTexts(api)[1]).toContain("Dato fiscale disponibile");
    expect(sentTexts(api)[1]).toContain("<code>RSSMRA80A01H501U</code>");
  });

  it("lo storico non ha messaggi singoli: un solo riepilogo per importazione", async () => {
    const seller = await linked("storico");
    await order(seller.store, "o-storico", { created: -60, cf: "RSSMRA80A01H501U" });
    const api = bot();
    await run(api.fetcher, 10);
    expect(api.texts()).toHaveLength(0);
    await env.DB.prepare("UPDATE sync_state SET history_done_at = ? WHERE store_id = ?")
      .bind(later(12).toISOString(), seller.store)
      .run();
    await run(api.fetcher, 20);
    await run(api.fetcher, 30);
    expect(sentTexts(api)).toEqual([expect.stringContaining("Importazione completata")]);
    expect(sentTexts(api)[0]).toContain("📦 Un ordine · 🧾 <b>1</b> con dato fiscale");
    expect(keyboard(api.texts()[0]!)).toEqual([
      [{ text: "🔗 Apri gli ordini", url: `${origin}/app/ordini?negozio=${seller.store}` }],
    ]);
  });

  it("una variazione scritta dopo la valutazione da una lettura partita prima non va persa", async () => {
    const seller = await linked("lettura");
    await order(seller.store, "o-lettura");
    const api = bot();
    await run(api.fetcher, 10);
    // La lettura è partita a 8 e registra quell'istante, ma scrive dopo la valutazione delle 10.
    await insertTaxIdentifiers({
      id: "t-lettura",
      orderId: "o-lettura",
      type: "CODICE_FISCALE",
      value: "BNCLGU80A01H501Z",
      source: "ebay_trading_get_orders",
      observedAt: later(8).toISOString(),
    }).run();
    await run(api.fetcher, 20);
    expect(sentTexts(api)).toEqual([expect.stringContaining("<code>BNCLGU80A01H501Z</code>")]);
    // La rivalutazione dello stesso dato non ripete l'evento.
    await run(api.fetcher, 30);
    expect(api.texts()).toHaveLength(1);
  });

  it("il riepilogo raccoglie gli eventi fino all'orario; quelli successivi vanno al giorno dopo", async () => {
    const seller = await linked("orario");
    await saveTelegramChange(env.DB, seller.userId, { name: "mode", value: "digest" }, "UTC");
    await saveTelegramChange(env.DB, seller.userId, { name: "digestTime", value: "21:00" }, "UTC");
    // Un ordine delle 20:50 valutato soltanto alle 22, dopo un'interruzione, entra nel riepilogo.
    await order(seller.store, "o-prima", { cf: "RSSMRA80A01H501U", created: 45, listed: 50 });
    const api = bot();
    await run(api.fetcher, 120);
    expect(sentTexts(api)).toEqual([expect.stringContaining("ebay-o-prima")]);
    expect(keyboard(api.texts()[0]!)).toEqual([
      [{ text: "📋 RSSMRA80A01H501U", copy_text: { text: "RSSMRA80A01H501U" } }],
      [{ text: "🔗 Apri gli ordini", url: `${origin}/app/ordini?periodo=7` }],
    ]);
    // Un ordine dopo l'orario non fa partire un secondo riepilogo, né uno tardivo.
    await order(seller.store, "o-dopo-orario", {
      cf: "BNCLGU80A01H501Z",
      created: 125,
      listed: 130,
    });
    await run(api.fetcher, 140);
    expect(api.texts()).toHaveLength(1);
    await run(api.fetcher, 24 * 60 + 65);
    expect(sentTexts(api).slice(1)).toEqual([expect.stringContaining("ebay-o-dopo-orario")]);
  });

  it("senza eventi all'orario nessun riepilogo tardivo nello stesso giorno", async () => {
    const seller = await linked("tardivo");
    await saveTelegramChange(env.DB, seller.userId, { name: "mode", value: "digest" }, "UTC");
    await saveTelegramChange(env.DB, seller.userId, { name: "digestTime", value: "21:00" }, "UTC");
    const api = bot();
    await run(api.fetcher, 65);
    await order(seller.store, "o-tardivo", { cf: "RSSMRA80A01H501U", created: 75, listed: 80 });
    await run(api.fetcher, 90);
    await run(api.fetcher, 3 * 60);
    expect(api.texts()).toHaveLength(0);
    await run(api.fetcher, 24 * 60 + 65);
    expect(sentTexts(api)).toEqual([expect.stringContaining("ebay-o-tardivo")]);
  });

  it("dopo un'interruzione riprende dalla parte successiva e aspetta il lease di chi si è fermato", async () => {
    const seller = await linked("parti");
    await saveTelegramChange(env.DB, seller.userId, { name: "mode", value: "digest" }, "UTC");
    await saveTelegramChange(env.DB, seller.userId, { name: "digestTime", value: "21:00" }, "UTC");
    const ids = Array.from(
      { length: 70 },
      (_, index) => `o-parti-${String(index).padStart(2, "0")}`,
    );
    for (const [index, id] of ids.entries())
      await order(seller.store, id, {
        cf: "RSSMRA80A01H501U",
        created: 1 + index / 10,
        listed: 2 + index / 10,
      });
    let sends = 0;
    const broken = bot((call) => {
      if (call.method === "sendMessage" && ++sends === 3) throw new TypeError("rete");
      return undefined;
    });
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await run(broken.fetcher, 70);
    } finally {
      errors.mockRestore();
    }
    expect(
      await env.DB.prepare(
        "SELECT parts_sent, attempts FROM telegram_deliveries WHERE kind = 'digest'",
      ).first(),
    ).toEqual({ parts_sent: 2, attempts: 1 });
    // Un altro esecutore ha preso la consegna e si è fermato: fino alla scadenza del lease non parte.
    await env.DB.prepare(
      "UPDATE telegram_deliveries SET lease = 'fermo', locked_until = ? WHERE kind = 'digest'",
    )
      .bind(later(80).toISOString())
      .run();
    const api = bot();
    await run(api.fetcher, 75);
    expect(api.texts()).toHaveLength(0);
    await run(api.fetcher, 85);
    await run(api.fetcher, 95);
    // Ogni ordine compare una volta sola fra la parte consegnata e quelle riprese.
    const parts = [...sentTexts(broken).slice(0, 2), ...sentTexts(api)];
    expect(parts.length).toBeGreaterThan(2);
    for (const id of ids)
      expect(parts.filter((part) => part.includes(`>ebay-${id}</a>`))).toHaveLength(1);
    expect(keyboard(api.texts().at(-1)!)).toEqual([
      [{ text: "📋 RSSMRA80A01H501U", copy_text: { text: "RSSMRA80A01H501U" } }],
      [{ text: "🔗 Apri gli ordini", url: `${origin}/app/ordini?periodo=7` }],
    ]);
  });

  it("una consegna in attesa alla fine di Premium non parte al rinnovo", async () => {
    const seller = await linked("rinnovo");
    await order(seller.store, "o-rinnovo", { cf: "RSSMRA80A01H501U" });
    const limited = bot((call) =>
      call.method === "sendMessage"
        ? failure(429, { ok: false, parameters: { retry_after: 600 } })
        : undefined,
    );
    await run(limited.fetcher, 10);
    await env.DB.prepare("UPDATE workspace_entitlements SET revoked_at = ? WHERE workspace_id = ?")
      .bind(later(12).toISOString(), seller.workspace)
      .run();
    await run(limited.fetcher, 15);
    await env.DB.prepare(`INSERT INTO workspace_entitlements (id, workspace_id, source, starts_at, ends_at)
      VALUES ('e-rinnovo-2', ?, 'admin', ?, ?)`)
      .bind(seller.workspace, later(16).toISOString(), later(30 * 24 * 60).toISOString())
      .run();
    const api = bot();
    await run(api.fetcher, 25);
    expect(api.texts()).toHaveLength(0);
    expect(await env.DB.prepare("SELECT failed_at FROM telegram_deliveries").first()).toEqual({
      failed_at: later(15).toISOString(),
    });
  });

  it("il riepilogo giornaliero parte all'orario nel fuso scelto, uno al giorno", async () => {
    const seller = await linked("riepilogo");
    await saveTelegramChange(env.DB, seller.userId, { name: "mode", value: "digest" }, "UTC");
    await saveTelegramChange(env.DB, seller.userId, { name: "digestTime", value: "21:00" }, "UTC");
    await order(seller.store, "o-uno", { cf: "RSSMRA80A01H501U" });
    await order(seller.store, "o-due", { cf: "BNCLGU80A01H501Z", created: 3, listed: 4 });
    const api = bot();
    await run(api.fetcher, 10);
    expect(api.texts()).toHaveLength(0);
    await run(api.fetcher, 70);
    expect(api.texts()).toHaveLength(1);
    const digest = sentTexts(api)[0]!;
    expect(digest).toContain("<b>Riepilogo del 13 set</b>");
    expect(digest).toContain("2 ordini");
    expect(digest).toContain("RSSMRA80A01H501U");
    expect(digest).toContain("BNCLGU80A01H501Z");
    // Ogni Codice Fiscale del riepilogo ha il suo pulsante di copia, prima di «Apri gli ordini».
    expect(keyboard(api.texts()[0]!).map((row) => row[0]!.text)).toEqual([
      "📋 RSSMRA80A01H501U",
      "📋 BNCLGU80A01H501Z",
      "🔗 Apri gli ordini",
    ]);
    // Un ordine dopo il riepilogo del giorno aspetta il giorno successivo.
    await order(seller.store, "o-tre", { cf: "VRDGPP80A01H501X", created: 75, listed: 80 });
    await run(api.fetcher, 90);
    expect(api.texts()).toHaveLength(1);
    await run(api.fetcher, 24 * 60 + 70);
    expect(api.texts()).toHaveLength(2);
    expect(sentTexts(api)[1]).toContain("Un ordine");
    expect(sentTexts(api)[1]).toContain("VRDGPP80A01H501X");
  });

  it("il bot bloccato ferma gli invii finché la chat non scrive, senza l'arretrato del blocco", async () => {
    const seller = await linked("bloccato");
    await order(seller.store, "o-bloccato", { cf: "RSSMRA80A01H501U" });
    const blocked = bot((call) =>
      call.method === "sendMessage" ? failure(403, { ok: false, error_code: 403 }) : undefined,
    );
    await run(blocked.fetcher, 10);
    expect(blocked.texts()).toHaveLength(1);
    expect((await telegramSettings(env.DB, seller.userId, "UTC")).chat).toMatchObject({
      failure: "blocked",
    });
    await order(seller.store, "o-durante", { cf: "BNCLGU80A01H501Z", created: 15, listed: 20 });
    const api = bot();
    await run(api.fetcher, 25);
    expect(api.calls).toHaveLength(0);
    // La chat scrive di nuovo: lo stato risponde e gli invii riprendono dagli eventi successivi.
    await deliver("/stato", seller.chat, api.fetcher, later(30));
    expect(sentTexts(api)[0]).toContain("Premium fino al");
    expect((await telegramSettings(env.DB, seller.userId, "UTC")).chat?.failure).toBeUndefined();
    await order(seller.store, "o-dopo", { cf: "VRDGPP80A01H501X", created: 35, listed: 40 });
    await run(api.fetcher, 45);
    expect(sentTexts(api).slice(1)).toEqual([expect.stringContaining("VRDGPP80A01H501X")]);
  });

  it("ritenta gli errori temporanei con attese crescenti, poi segnala la chat irraggiungibile", async () => {
    const seller = await linked("irraggiungibile");
    await order(seller.store, "o-ritenta", { cf: "RSSMRA80A01H501U" });
    let attempt = 0;
    const flaky = bot((call) => {
      if (call.method !== "sendMessage") return undefined;
      attempt++;
      if (attempt === 1) throw new TypeError("rete");
      return failure(502);
    });
    const retries: unknown[] = [];
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      for (const minutes of [10, 10.5, 11, 13, 17, 25, 41]) {
        await run(flaky.fetcher, minutes);
        retries.push((await deliveryOf("o-ritenta"))?.retry_at);
      }
    } finally {
      errors.mockRestore();
    }
    // Attese di 1, 2, 4 e 8 minuti: il secondo turno a 10,5 è ancora in attesa.
    expect(attempt).toBe(5);
    expect(retries).toEqual([11, 11, 13, 17, 25, 25, 25].map((at) => later(at).toISOString()));
    expect(
      await env.DB.prepare(
        "SELECT attempts, failed_at, uncertain_at FROM telegram_deliveries WHERE order_id = 'o-ritenta'",
      ).first(),
    ).toEqual({
      attempts: 5,
      failed_at: later(25).toISOString(),
      uncertain_at: later(10).toISOString(),
    });
    expect((await telegramSettings(env.DB, seller.userId, "UTC")).chat?.failure).toBe(
      "unreachable",
    );
    // Il primo invio riuscito chiude l'avviso.
    await order(seller.store, "o-riuscito", { cf: "BNCLGU80A01H501Z", created: 50, listed: 55 });
    const api = bot();
    await run(api.fetcher, 60);
    expect(api.texts()).toHaveLength(1);
    expect((await telegramSettings(env.DB, seller.userId, "UTC")).chat?.failure).toBeUndefined();
  });

  it("rispetta l'attesa di Telegram e scarta la consegna di una chat sostituita", async () => {
    const seller = await linked("sostituita");
    await order(seller.store, "o-attesa", { cf: "RSSMRA80A01H501U" });
    const limited = bot((call) =>
      call.method === "sendMessage"
        ? failure(429, { ok: false, parameters: { retry_after: 600 } })
        : undefined,
    );
    await run(limited.fetcher, 10);
    expect(
      await env.DB.prepare("SELECT retry_at, attempts FROM telegram_deliveries").first(),
    ).toEqual({ retry_at: later(20).toISOString(), attempts: 0 });
    await run(limited.fetcher, 15);
    expect(limited.texts()).toHaveLength(1);
    await deliver(`/start ${await linkToken(seller.cookie)}`, 602, bot().fetcher, later(14));
    const api = bot();
    await run(api.fetcher, 25);
    expect(api.texts()).toHaveLength(0);
    expect(await env.DB.prepare("SELECT failed_at FROM telegram_deliveries").first()).toEqual({
      failed_at: later(25).toISOString(),
    });
  });

  it("notifiche spente, negozio escluso e Premium scaduto non inviano nulla", async () => {
    const seller = await linked("spente");
    await saveTelegramChange(env.DB, seller.userId, { name: "enabled", value: false }, "UTC");
    await order(seller.store, "o-spente", { cf: "RSSMRA80A01H501U" });
    const api = bot();
    await run(api.fetcher, 10);
    // La riattivazione non porta l'arretrato del periodo spento.
    await saveTelegramChange(
      env.DB,
      seller.userId,
      { name: "enabled", value: true },
      "UTC",
      later(12),
    );
    await run(api.fetcher, 15);
    await saveTelegramChange(
      env.DB,
      seller.userId,
      { name: "store", storeId: seller.store, value: false },
      "UTC",
      later(16),
    );
    await order(seller.store, "o-escluso", { cf: "BNCLGU80A01H501Z", created: 17, listed: 18 });
    await run(api.fetcher, 20);
    expect(api.texts()).toHaveLength(0);
    await saveTelegramChange(
      env.DB,
      seller.userId,
      { name: "store", storeId: seller.store, value: true },
      "UTC",
      later(21),
    );
    await env.DB.prepare("UPDATE workspace_entitlements SET revoked_at = ? WHERE workspace_id = ?")
      .bind(later(22).toISOString(), seller.workspace)
      .run();
    await order(seller.store, "o-free", { cf: "VRDGPP80A01H501X", created: 23, listed: 24 });
    await run(api.fetcher, 30);
    expect(api.calls).toHaveLength(0);
  });

  type Seller = Awaited<ReturnType<typeof linked>>;

  /**
   * Ordine notificato e dato fiscale rimosso durante una pausa: alla ripresa la rimozione non
   * arriva, il dato arrivato dopo la ripresa sì.
   */
  async function withoutBacklog(
    name: string,
    pause: (seller: Seller) => Promise<unknown>,
    resume: (seller: Seller) => Promise<unknown>,
  ) {
    const seller = await linked(name);
    await order(seller.store, `o-${name}`, { cf: "RSSMRA80A01H501U" });
    const api = bot();
    await run(api.fetcher, 10);
    expect(sentTexts(api)).toEqual([expect.stringContaining("Nuovo ordine")]);
    await pause(seller);
    await env.DB.prepare("UPDATE tax_identifiers SET removed_at = ? WHERE id = ?")
      .bind(later(15).toISOString(), `t-o-${name}`)
      .run();
    await run(api.fetcher, 20);
    await resume(seller);
    await run(api.fetcher, 30);
    await run(api.fetcher, 40);
    expect(api.texts()).toHaveLength(1);
    await insertTaxIdentifiers({
      id: `t-${name}-dopo`,
      orderId: `o-${name}`,
      type: "CODICE_FISCALE",
      value: "BNCLGU80A01H501Z",
      source: "ebay_trading_get_orders",
      observedAt: later(45).toISOString(),
    }).run();
    await run(api.fetcher, 50);
    expect(sentTexts(api).slice(1)).toEqual([
      expect.stringContaining("<code>BNCLGU80A01H501Z</code>"),
    ]);
    expect(sentTexts(api)[1]).toContain("Dato fiscale disponibile");
  }

  it("alla riattivazione delle notifiche non arriva la variazione del periodo spento", () =>
    withoutBacklog(
      "pausa-spente",
      (seller) =>
        saveTelegramChange(
          env.DB,
          seller.userId,
          { name: "enabled", value: false },
          "UTC",
          later(12),
        ),
      (seller) =>
        saveTelegramChange(
          env.DB,
          seller.userId,
          { name: "enabled", value: true },
          "UTC",
          later(25),
        ),
    ));

  it("dopo il blocco del bot non arriva la variazione del periodo bloccato", () =>
    withoutBacklog(
      "pausa-blocco",
      async (seller) => {
        await order(seller.store, "o-pausa-blocco-403", {
          cf: "VRDGPP80A01H501X",
          created: 11,
          listed: 11,
        });
        const blocked = bot((call) =>
          call.method === "sendMessage" ? failure(403, { ok: false, error_code: 403 }) : undefined,
        );
        await run(blocked.fetcher, 12);
        expect((await telegramSettings(env.DB, seller.userId, "UTC")).chat?.failure).toBe(
          "blocked",
        );
      },
      (seller) => deliver("/stato", seller.chat, bot().fetcher, later(25)),
    ));

  it("al rinnovo di Premium non arriva la variazione del periodo senza Premium", () =>
    withoutBacklog(
      "pausa-premium",
      (seller) =>
        env.DB.prepare("UPDATE workspace_entitlements SET revoked_at = ? WHERE workspace_id = ?")
          .bind(later(12).toISOString(), seller.workspace)
          .run(),
      (seller) =>
        env.DB.prepare(`INSERT INTO workspace_entitlements (id, workspace_id, source, starts_at, ends_at)
          VALUES (?, ?, 'admin', ?, ?)`)
          .bind(
            `e-${seller.workspace}-rinnovo`,
            seller.workspace,
            later(25).toISOString(),
            later(30 * 24 * 60).toISOString(),
          )
          .run(),
    ));

  it("gli ordini in verifica oltre il limite di un'esecuzione non fermano quelli successivi", async () => {
    const seller = await linked("coda");
    for (let index = 0; index < 101; index++)
      await order(seller.store, `o-coda-${String(index).padStart(3, "0")}`, { checking: true });
    await order(seller.store, "o-coda-fiscale", { cf: "RSSMRA80A01H501U", created: 2, listed: 3 });
    const api = bot();
    await run(api.fetcher, 10);
    expect(api.texts()).toHaveLength(0);
    await run(api.fetcher, 20);
    expect(sentTexts(api)).toEqual([expect.stringContaining("ebay-o-coda-fiscale")]);
  });

  it("CF, P.IVA e identificativi esteri nella forma derivata, anche nei riepiloghi suddivisi", async () => {
    const others = (orderId: string) =>
      insertTaxIdentifiers(
        {
          id: `piva-${orderId}`,
          orderId,
          type: "PartitaIVA",
          value: "0074 3110 157",
          observedAt: later(2).toISOString(),
        },
        {
          id: `estero-${orderId}`,
          orderId,
          type: "VAT_ID",
          country: "DE",
          value: "de 123 456 789",
          observedAt: later(2).toISOString(),
        },
      ).run();
    const derived = [
      "🧾 <code>RSSMRA80A01H501U</code>",
      "🧾 P.IVA <code>00743110157</code>",
      "🧾 VAT_ID · DE <code>de 123 456 789</code>",
    ];
    const single = await linked("forma");
    await order(single.store, "o-forma", { cf: "rss mra80a01h501u" });
    await others("o-forma");
    const api = bot();
    await run(api.fetcher, 10);
    for (const value of derived) expect(sentTexts(api)[0]).toContain(value);
    expect(keyboard(api.texts()[0]!).flat()).toContainEqual({
      text: "📋 Copia Codice Fiscale",
      copy_text: { text: "RSSMRA80A01H501U" },
    });

    const digest = await linked("forma-riepilogo", 602);
    await saveTelegramChange(env.DB, digest.userId, { name: "mode", value: "digest" }, "UTC");
    await saveTelegramChange(env.DB, digest.userId, { name: "digestTime", value: "21:00" }, "UTC");
    for (let index = 0; index < 25; index++) {
      const id = `o-forma-${String(index).padStart(2, "0")}`;
      await order(digest.store, id, {
        cf: "rss mra80a01h501u",
        created: 30 + index / 10,
        listed: 31 + index / 10,
      });
      await others(id);
    }
    const summary = bot();
    await run(summary.fetcher, 70);
    const parts = sentTexts(summary);
    expect(parts.length).toBeGreaterThan(1);
    for (const part of parts) {
      for (const value of derived) expect(part).toContain(value);
      for (const original of ["rss mra80a01h501u", "0074 3110 157"])
        expect(part).not.toContain(original);
    }
    for (const call of summary.texts())
      expect(keyboard(call)[0]).toEqual([
        { text: "📋 RSSMRA80A01H501U", copy_text: { text: "RSSMRA80A01H501U" } },
      ]);
  });

  it("una correzione del dato notifica «Dato fiscale aggiornato» con il solo valore nuovo", async () => {
    const seller = await linked("corretto");
    await order(seller.store, "o-corretto", { cf: "RSSMRA80A01H501U" });
    const api = bot();
    await run(api.fetcher, 10);
    await env.DB.batch([
      env.DB.prepare("UPDATE tax_identifiers SET removed_at = ? WHERE id = 't-o-corretto'").bind(
        later(15).toISOString(),
      ),
      insertTaxIdentifiers({
        id: "t-corretto-nuovo",
        orderId: "o-corretto",
        type: "CODICE_FISCALE",
        value: "bnc lgu80a01h501z",
        source: "ebay_trading_get_orders",
        observedAt: later(15).toISOString(),
      }),
    ]);
    await run(api.fetcher, 20);
    await run(api.fetcher, 30);
    expect(api.texts()).toHaveLength(2);
    const changed = sentTexts(api)[1]!;
    expect(changed).toMatch(/^✏️ <b>Dato fiscale aggiornato<\/b>/u);
    expect(changed).toContain("<code>BNCLGU80A01H501Z</code>");
    expect(changed).not.toContain("RSSMRA80A01H501U");
  });

  it("lo stato delle notifiche conserva l'impronta del dato, mai il Codice Fiscale", async () => {
    const seller = await linked("impronta");
    await order(seller.store, "o-impronta", { cf: "RSSMRA80A01H501U" });
    const api = bot();
    await run(api.fetcher, 10);
    const stored = async () =>
      (await env.DB.prepare(
        "SELECT fiscal_key FROM telegram_order_notices WHERE order_id = 'o-impronta'",
      ).first<{ fiscal_key: string }>())!.fiscal_key;
    const key = await stored();
    expect(key).toMatch(/^"[0-9a-f]{64}"$/u);
    expect(key).not.toContain("RSSMRA");
    // Un'impronta registrata come testo dei valori vale come la sua forma cifrata: nessuna
    // variazione, e la riga passa alla forma nuova.
    await env.DB.prepare(
      "UPDATE telegram_order_notices SET fiscal_key = ?, evaluated_at = ? WHERE order_id = 'o-impronta'",
    )
      .bind(JSON.stringify([["CF", null, "RSSMRA80A01H501U"]]), later(5).toISOString())
      .run();
    await env.DB.prepare("UPDATE tax_identifiers SET observed_at = ? WHERE order_id = 'o-impronta'")
      .bind(later(15).toISOString())
      .run();
    await run(api.fetcher, 20);
    expect(api.texts()).toHaveLength(1);
    expect(await stored()).toBe(key);
  });

  it("due valutazioni contemporanee preparano un solo evento", async () => {
    const seller = await linked("contemporanee");
    await order(seller.store, "o-contemporanee", { cf: "RSSMRA80A01H501U" });
    const api = bot();
    await Promise.all([run(api.fetcher, 10), run(api.fetcher, 10.5)]);
    expect(
      await env.DB.prepare(
        "SELECT count(*) AS n FROM telegram_deliveries WHERE order_id = 'o-contemporanee'",
      ).first(),
    ).toEqual({ n: 1 });
    expect(api.texts()).toHaveLength(1);
  });

  it("senza autorizzazione il Codice Fiscale non compare: conservazione scaduta, copertura revocata, piano Free", async () => {
    const seller = await linked("autorizzato");
    await order(seller.store, "o-scaduto", { cf: "RSSMRA80A01H501U" });
    const limited = bot((call) =>
      call.method === "sendMessage"
        ? failure(429, { ok: false, parameters: { retry_after: 600 } })
        : undefined,
    );
    await run(limited.fetcher, 10);
    await env.DB.prepare("UPDATE orders SET retention_until = ? WHERE id = 'o-scaduto'")
      .bind(later(12).toISOString())
      .run();
    const api = bot();
    await run(api.fetcher, 25);
    expect(api.texts()).toHaveLength(0);
    // La consegna dell'ordine non più consultabile si chiude senza tentativi.
    expect(await deliveryOf("o-scaduto")).toMatchObject({
      attempts: 0,
      failed_at: later(25).toISOString(),
    });
    await order(seller.store, "o-revocato", { cf: "BNCLGU80A01H501Z", created: 30, listed: 31 });
    await run(limited.fetcher, 35);
    await env.DB.prepare("UPDATE workspace_entitlements SET revoked_at = ? WHERE workspace_id = ?")
      .bind(later(37).toISOString(), seller.workspace)
      .run();
    await run(api.fetcher, 50);
    expect(api.texts()).toHaveLength(0);
    // Senza Premium i comandi non mostrano ordini né dati fiscali.
    await deliver("/ultimi", seller.chat, api.fetcher, later(51));
    await deliver("/stato", seller.chat, api.fetcher, later(52));
    expect(sentTexts(api)).toEqual([
      expect.stringContaining("compresi in Premium"),
      expect.stringContaining("<b>Free</b>"),
    ]);
    for (const text of sentTexts(api)) expect(text).not.toMatch(/RSSMRA|BNCLGU/u);
  });

  it("suddivide i testi lunghi senza spezzare un blocco e fa l'escape dell'HTML", () => {
    expect(escape("<a & b>")).toBe("&lt;a &amp; b&gt;");
    expect(splitBlocks(["uno", "due"], 20)).toEqual(["uno\n\ndue"]);
    expect(splitBlocks(["a".repeat(8), "b".repeat(8)], 12)).toEqual(["a".repeat(8), "b".repeat(8)]);
    expect(splitBlocks([`${"c".repeat(6)}\n${"d".repeat(6)}`], 8)).toEqual([
      "c".repeat(6),
      "d".repeat(6),
    ]);
    expect(splitBlocks(["e".repeat(10)], 4)).toEqual(["eeee", "eeee", "ee"]);
    // Le ore legali non cambiano il giorno del riepilogo: conta la data nel fuso.
    expect(localClock("Europe/Rome", new Date("2026-10-25T00:30:00Z"))).toEqual({
      day: "2026-10-25",
      time: "02:30",
    });
    expect(localClock("Europe/Rome", new Date("2026-10-25T01:30:00Z"))).toEqual({
      day: "2026-10-25",
      time: "02:30",
    });
    // Le date si leggono come le direbbe una persona, nel fuso scelto.
    const at = new Date("2026-10-25T21:30:00Z");
    expect(when("it", "Europe/Rome", "2026-10-25T21:10:00Z", at)).toBe("oggi 22:10");
    expect(when("it", "Europe/Rome", "2026-10-24T08:00:00Z", at)).toBe("ieri 10:00");
    expect(when("en", "Europe/Rome", "2026-10-24T08:00:00Z", at)).toBe("yesterday 10:00");
    expect(when("it", "Europe/Rome", "2026-10-20T08:00:00Z", at)).toBe("20 ott 10:00");
    expect(when("en", "Europe/Rome", "2025-12-31T08:00:00Z", at)).toBe("31 Dec 2025 09:00");
    // L'orario del riepilogo nel fuso, prima e dopo i cambi di ora legale.
    for (const [zone, day, time, instant] of [
      ["Europe/Rome", "2026-10-24", "08:00", "2026-10-24T06:00:00.000Z"],
      ["Europe/Rome", "2026-10-25", "08:00", "2026-10-25T07:00:00.000Z"],
      ["Europe/Rome", "2026-03-29", "21:00", "2026-03-29T19:00:00.000Z"],
      ["America/New_York", "2026-11-01", "08:00", "2026-11-01T13:00:00.000Z"],
      ["Asia/Kolkata", "2026-10-25", "12:00", "2026-10-25T06:30:00.000Z"],
      ["UTC", "2026-10-25", "21:00", "2026-10-25T21:00:00.000Z"],
    ] as const)
      expect(zonedInstant(zone, day, time).toISOString()).toBe(instant);
  });
});

describe("esiti delle consegne", () => {
  type Seller = Awaited<ReturnType<typeof linked>>;

  /** Lo spazio viene servito per primo: il suo collegamento è il più vecchio. */
  const servedFirst = (seller: Seller) =>
    env.DB.prepare("UPDATE telegram_links SET linked_at = ? WHERE workspace_id = ?")
      .bind(later(-1).toISOString(), seller.workspace)
      .run();

  const digestMode = async (seller: Seller) => {
    await saveTelegramChange(env.DB, seller.userId, { name: "mode", value: "digest" }, "UTC");
    await saveTelegramChange(env.DB, seller.userId, { name: "digestTime", value: "21:00" }, "UTC");
  };

  const digestOf = (seller: Seller) =>
    env.DB.prepare(
      "SELECT attempts, sent_at, failed_at FROM telegram_deliveries WHERE kind = 'digest' AND workspace_id = ?",
    )
      .bind(seller.workspace)
      .first();

  const evaluatedAt = async (orderId: string) =>
    (
      await env.DB.prepare("SELECT evaluated_at FROM telegram_order_notices WHERE order_id = ?")
        .bind(orderId)
        .first<{ evaluated_at: string }>()
    )?.evaluated_at;

  /**
   * Ambiente in cui la prima istruzione che contiene `marker` riceve i parametri modificati da
   * `values`: simula una scrittura concorrente fra due letture della stessa esecuzione.
   */
  function racing(marker: string, values: (bound: unknown[]) => unknown[]) {
    let pending = true;
    const DB = new Proxy(env.DB, {
      get(target, key) {
        if (key !== "prepare") {
          const value: unknown = Reflect.get(target, key);
          return typeof value === "function" ? value.bind(target) : value;
        }
        return (sql: string) => {
          const statement = target.prepare(sql);
          if (!pending || !sql.includes(marker)) return statement;
          pending = false;
          return { bind: (...bound: unknown[]) => statement.bind(...values(bound)) };
        };
      },
    });
    return { ...environment, DB } as Env;
  }

  it("senza il bot dell'ambiente non prepara né invia consegne", async () => {
    const seller = await linked("senza-bot");
    await order(seller.store, "o-senza-bot", { cf: "RSSMRA80A01H501U" });
    const api = bot();
    const off = { ...environment, TELEGRAM_BOT_TOKEN: undefined } as Env;
    await deliverTelegram(off, api.fetcher, later(10));
    expect(api.calls).toHaveLength(0);
    expect(await env.DB.prepare("SELECT count(*) AS n FROM telegram_deliveries").first()).toEqual({
      n: 0,
    });
    await run(api.fetcher, 20);
    expect(sentTexts(api)).toEqual([expect.stringContaining("ebay-o-senza-bot")]);
  });

  it("l'esecuzione per un negozio non chiude le consegne degli altri spazi", async () => {
    const served = await linked("ambito", 611);
    const expired = await linked("ambito-scaduto", 612);
    await order(expired.store, "o-ambito-scaduto", { cf: "RSSMRA80A01H501U" });
    await run(rateLimited(600).fetcher, 10);
    await env.DB.prepare("UPDATE workspace_entitlements SET revoked_at = ? WHERE workspace_id = ?")
      .bind(later(12).toISOString(), expired.workspace)
      .run();
    await order(served.store, "o-ambito", { cf: "BNCLGU80A01H501Z", created: 12, listed: 13 });
    const api = bot();
    await deliverTelegram(environment, api.fetcher, later(15), { storeId: served.store });
    expect(sentTexts(api)).toEqual([expect.stringContaining("ebay-o-ambito")]);
    expect(await deliveryOf("o-ambito-scaduto")).toMatchObject({ failed_at: null });
    // L'esecuzione completa chiude la consegna dello spazio senza Premium.
    await run(api.fetcher, 16);
    expect(await deliveryOf("o-ambito-scaduto")).toMatchObject({
      failed_at: later(16).toISOString(),
    });
  });

  it("l'errore di uno spazio si registra e non ferma gli altri", async () => {
    const broken = await linked("fuso-errato", 621);
    const other = await linked("fuso-valido", 622);
    await servedFirst(broken);
    await digestMode(broken);
    await env.DB.prepare("UPDATE telegram_preferences SET time_zone = ? WHERE workspace_id = ?")
      .bind("Fuso/Inesistente", broken.workspace)
      .run();
    await order(other.store, "o-fuso-valido", { cf: "RSSMRA80A01H501U" });
    const api = bot();
    const logs = await logged(() => run(api.fetcher, 10));
    expect(logs).toEqual([expect.objectContaining({ operation: "telegram" })]);
    expect(sentTexts(api)).toEqual([expect.stringContaining("ebay-o-fuso-valido")]);
  });

  it("l'attesa di Telegram ferma le consegne successive della chat, non gli altri spazi", async () => {
    const waiting = await linked("attesa-chat", 631);
    const other = await linked("attesa-altro", 632);
    await servedFirst(waiting);
    const api = bot((call) =>
      call.method === "sendMessage" && call.params.chat_id === "631"
        ? failure(429, { ok: false, parameters: { retry_after: 1 } })
        : undefined,
    );
    await order(waiting.store, "o-attesa-prima", { cf: "RSSMRA80A01H501U" });
    await run(api.fetcher, 10);
    await order(waiting.store, "o-attesa-dopo", {
      cf: "BNCLGU80A01H501Z",
      created: 11,
      listed: 12,
    });
    await order(other.store, "o-attesa-altro", { cf: "VRDGPP80A01H501X", created: 11, listed: 12 });
    await run(api.fetcher, 13);
    expect(sentTexts(api)).toEqual([
      expect.stringContaining("ebay-o-attesa-prima"),
      expect.stringContaining("ebay-o-attesa-prima"),
      expect.stringContaining("ebay-o-attesa-altro"),
    ]);
    expect(await deliveryOf("o-attesa-prima")).toMatchObject({
      attempts: 0,
      retry_at: new Date(later(13).getTime() + 1000).toISOString(),
      lease: null,
    });
  });

  it("un messaggio rifiutato si chiude, si registra e lascia partire i successivi", async () => {
    const seller = await linked("rifiutato");
    await order(seller.store, "o-respinto", { cf: "RSSMRA80A01H501U" });
    await run(rateLimited(1).fetcher, 10);
    await order(seller.store, "o-accolto-1", { cf: "BNCLGU80A01H501Z", created: 11, listed: 12 });
    await order(seller.store, "o-accolto-2", { cf: "VRDGPP80A01H501X", created: 11, listed: 12 });
    const api = bot((call) =>
      call.method === "sendMessage" && String(call.params.text).includes("ebay-o-respinto")
        ? failure(400, { ok: false, error_code: 400 })
        : undefined,
    );
    const logs = await logged(() => run(api.fetcher, 13));
    expect(api.texts()).toHaveLength(3);
    expect(logs).toEqual([expect.objectContaining({ operation: "telegram", failure: "rejected" })]);
    expect(await deliveryOf("o-respinto")).toMatchObject({
      attempts: 0,
      lease: null,
      sent_at: null,
      failed_at: later(13).toISOString(),
    });
    for (const id of ["o-accolto-1", "o-accolto-2"])
      expect(await deliveryOf(id)).toMatchObject({ sent_at: later(13).toISOString() });
    expect((await telegramSettings(env.DB, seller.userId, "UTC")).chat?.failure).toBeUndefined();
  });

  it("un token del bot non più valido ferma l'esecuzione e rilascia la consegna", async () => {
    const first = await linked("token-primo", 641);
    const second = await linked("token-secondo", 642);
    await servedFirst(first);
    await order(first.store, "o-token-primo", { cf: "RSSMRA80A01H501U" });
    await order(second.store, "o-token-secondo", { cf: "BNCLGU80A01H501Z" });
    const revoked = bot((call) => (call.method === "sendMessage" ? failure(401) : undefined));
    const logs = await logged(() => run(revoked.fetcher, 10));
    expect(revoked.texts()).toHaveLength(1);
    expect(logs).toEqual([
      expect.objectContaining({ operation: "telegram", failure: "credentials" }),
    ]);
    expect(await deliveryOf("o-token-primo")).toEqual({
      attempts: 0,
      retry_at: null,
      uncertain_at: null,
      lease: null,
      locked_until: null,
      sent_at: null,
      failed_at: null,
    });
    // L'altro spazio non è stato valutato.
    expect(await deliveryOf("o-token-secondo")).toBeNull();
    const api = bot();
    await run(api.fetcher, 15);
    expect(api.texts().map((call) => call.params.chat_id)).toEqual(["641", "642"]);
  });

  it("il bot bloccato chiude anche le altre consegne in attesa della chat", async () => {
    const seller = await linked("bloccata");
    await order(seller.store, "o-bloccata-1", { cf: "RSSMRA80A01H501U" });
    await run(rateLimited(1).fetcher, 10);
    await order(seller.store, "o-bloccata-2", { cf: "BNCLGU80A01H501Z", created: 11, listed: 12 });
    const blocked = bot((call) =>
      call.method === "sendMessage" ? failure(403, { ok: false, error_code: 403 }) : undefined,
    );
    await run(blocked.fetcher, 13);
    expect(blocked.texts()).toHaveLength(1);
    for (const id of ["o-bloccata-1", "o-bloccata-2"])
      expect(await deliveryOf(id)).toMatchObject({
        attempts: 0,
        lease: null,
        failed_at: later(13).toISOString(),
      });
  });

  it("un errore nel comporre il testo si ritenta come un errore certo", async () => {
    const seller = await linked("fuso-invio");
    await saveTelegramChange(env.DB, seller.userId, { name: "filter", value: "fiscal" }, "UTC");
    await env.DB.prepare("UPDATE telegram_preferences SET time_zone = ? WHERE workspace_id = ?")
      .bind("Fuso/Inesistente", seller.workspace)
      .run();
    await order(seller.store, "o-fuso-invio", { cf: "RSSMRA80A01H501U" });
    const api = bot();
    const logs = await logged(() => run(api.fetcher, 10));
    expect(api.calls).toHaveLength(0);
    expect(logs).toEqual([expect.objectContaining({ operation: "telegram" })]);
    expect(await deliveryOf("o-fuso-invio")).toEqual({
      attempts: 1,
      retry_at: later(11).toISOString(),
      uncertain_at: null,
      lease: null,
      locked_until: null,
      sent_at: null,
      failed_at: null,
    });
  });

  it("una consegna presa da un altro esecutore non ferma le successive", async () => {
    const seller = await linked("occupata");
    await order(seller.store, "o-occupata", { cf: "RSSMRA80A01H501U" });
    await run(rateLimited(1).fetcher, 10);
    await env.DB.prepare(
      "UPDATE telegram_deliveries SET lease = 'altro', locked_until = ? WHERE order_id = 'o-occupata'",
    )
      .bind(later(30).toISOString())
      .run();
    await order(seller.store, "o-libera", { cf: "BNCLGU80A01H501Z", created: 11, listed: 12 });
    const api = bot();
    const logs = await logged(() => run(api.fetcher, 13));
    expect(logs).toEqual([]);
    expect(sentTexts(api)).toEqual([expect.stringContaining("ebay-o-libera")]);
    expect(await deliveryOf("o-occupata")).toMatchObject({ lease: "altro", sent_at: null });
  });

  it("un ordine in attesa passa al riepilogo scelto dopo la sua preparazione", async () => {
    const seller = await linked("passa-riepilogo");
    await order(seller.store, "o-passa", { cf: "RSSMRA80A01H501U" });
    await run(rateLimited(60).fetcher, 10);
    await digestMode(seller);
    const api = bot();
    await run(api.fetcher, 15);
    expect(api.calls).toHaveLength(0);
    expect(await deliveryOf("o-passa")).toMatchObject({
      attempts: 0,
      retry_at: null,
      lease: null,
      sent_at: null,
      failed_at: null,
    });
    await run(api.fetcher, 60);
    expect(sentTexts(api)).toEqual([expect.stringMatching(/Riepilogo del[\s\S]*ebay-o-passa/u)]);
    expect(await deliveryOf("o-passa")).toMatchObject({ sent_at: later(60).toISOString() });
  });

  it("il riepilogo riunisce gli eventi di un ordine e omette quelli non più consultabili", async () => {
    const seller = await linked("voci");
    await order(seller.store, "o-voci-notificato", { cf: "RSSMRA80A01H501U" });
    const api = bot();
    await run(api.fetcher, 5);
    expect(sentTexts(api)).toEqual([expect.stringContaining("ebay-o-voci-notificato")]);
    await digestMode(seller);
    await order(seller.store, "o-voci-nuovo", { cf: "BNCLGU80A01H501Z", created: 6, listed: 7 });
    await order(seller.store, "o-voci-scaduto", { cf: "VRDGPP80A01H501X", created: 6, listed: 7 });
    await run(api.fetcher, 10);
    const correct = (id: string, value: string, minutes: number) =>
      env.DB.batch([
        env.DB.prepare(
          "UPDATE tax_identifiers SET removed_at = ? WHERE order_id = 'o-voci-nuovo' AND removed_at IS NULL",
        ).bind(later(minutes).toISOString()),
        insertTaxIdentifiers({
          id,
          orderId: "o-voci-nuovo",
          type: "CODICE_FISCALE",
          value,
          source: "ebay_trading_get_orders",
          observedAt: later(minutes).toISOString(),
        }),
      ]);
    // Il nuovo ordine si corregge due volte prima del riepilogo; il dato dell'altro si rimuove.
    await correct("t-voci-1", "MRARSS80A01H501U", 15);
    await env.DB.prepare(
      "UPDATE tax_identifiers SET removed_at = ? WHERE order_id = 'o-voci-notificato'",
    )
      .bind(later(15).toISOString())
      .run();
    await run(api.fetcher, 20);
    await correct("t-voci-2", "LGUBNC80A01H501Z", 25);
    await run(api.fetcher, 30);
    await env.DB.prepare("UPDATE orders SET retention_until = ? WHERE id = 'o-voci-scaduto'")
      .bind(later(50).toISOString())
      .run();
    await run(api.fetcher, 60);
    expect(api.texts()).toHaveLength(2);
    const digest = sentTexts(api)[1]!;
    expect(digest).toContain("2 ordini");
    // Più eventi dello stesso ordine sono una voce «nuovo», con il dato corrente.
    expect(digest).toContain(">ebay-o-voci-nuovo</a>");
    expect(digest).toContain("<code>LGUBNC80A01H501Z</code>");
    expect(digest).not.toContain("Dato fiscale aggiornato");
    expect(digest).toContain("Dato fiscale rimosso");
    expect(digest).not.toContain("ebay-o-voci-scaduto");
    // Gli eventi raccolti, anche quello omesso, risultano consegnati con il riepilogo.
    expect(
      await env.DB.prepare(
        "SELECT count(*) AS n FROM telegram_deliveries WHERE digest_id IS NOT NULL AND sent_at = ?",
      )
        .bind(later(60).toISOString())
        .first(),
    ).toEqual({ n: 5 });
  });

  it("un riepilogo che non parte chiude i suoi eventi", async () => {
    const empty = await linked("riepilogo-vuoto", 651);
    const disabled = await linked("riepilogo-spento", 652);
    for (const seller of [empty, disabled]) await digestMode(seller);
    await order(empty.store, "o-riepilogo-vuoto", { cf: "RSSMRA80A01H501U" });
    await order(disabled.store, "o-riepilogo-spento", { cf: "BNCLGU80A01H501Z" });
    const api = bot((call) =>
      call.method === "sendMessage" && call.params.chat_id === "652"
        ? failure(429, { ok: false, parameters: { retry_after: 600 } })
        : undefined,
    );
    await run(api.fetcher, 10);
    // Nessun ordine del riepilogo è ancora consultabile: non parte.
    await env.DB.prepare("UPDATE orders SET retention_until = ? WHERE id = 'o-riepilogo-vuoto'")
      .bind(later(50).toISOString())
      .run();
    await run(api.fetcher, 60);
    expect(api.texts().map((call) => call.params.chat_id)).toEqual(["652"]);
    expect(await digestOf(empty)).toEqual({
      attempts: 0,
      sent_at: null,
      failed_at: later(60).toISOString(),
    });
    expect(await deliveryOf("o-riepilogo-vuoto")).toMatchObject({
      failed_at: later(60).toISOString(),
    });
    // Le notifiche spente prima dell'invio scartano il riepilogo in attesa.
    await saveTelegramChange(
      env.DB,
      disabled.userId,
      { name: "enabled", value: false },
      "UTC",
      later(62),
    );
    const after = bot();
    await run(after.fetcher, 75);
    expect(after.calls).toHaveLength(0);
    expect(await digestOf(disabled)).toEqual({
      attempts: 0,
      sent_at: null,
      failed_at: later(75).toISOString(),
    });
    expect(await deliveryOf("o-riepilogo-spento")).toMatchObject({
      failed_at: later(75).toISOString(),
    });
  });

  it("una consegna senza destinatario o senza importazione si chiude senza tentativi", async () => {
    const seller = await linked("chiusa");
    await order(seller.store, "o-chiusa", { cf: "RSSMRA80A01H501U" });
    await run(rateLimited(600).fetcher, 10);
    await saveTelegramChange(
      env.DB,
      seller.userId,
      { name: "enabled", value: false },
      "UTC",
      later(12),
    );
    const api = bot();
    await run(api.fetcher, 25);
    expect(await deliveryOf("o-chiusa")).toMatchObject({
      attempts: 0,
      lease: null,
      failed_at: later(25).toISOString(),
    });
    await saveTelegramChange(
      env.DB,
      seller.userId,
      { name: "enabled", value: true },
      "UTC",
      later(26),
    );
    await env.DB.prepare("UPDATE sync_state SET history_done_at = ? WHERE store_id = ?")
      .bind(later(27).toISOString(), seller.store)
      .run();
    await run(rateLimited(600).fetcher, 30);
    // Una nuova importazione richiesta prima dell'invio toglie il riepilogo della precedente.
    await env.DB.prepare("UPDATE sync_state SET history_done_at = NULL WHERE store_id = ?")
      .bind(seller.store)
      .run();
    await run(api.fetcher, 45);
    expect(api.calls).toHaveLength(0);
    expect(
      await env.DB.prepare(
        "SELECT attempts, sent_at, failed_at FROM telegram_deliveries WHERE kind = 'import'",
      ).first(),
    ).toEqual({ attempts: 0, sent_at: null, failed_at: later(45).toISOString() });
  });

  it("una chat sostituita durante l'invio scarta la consegna senza errori", async () => {
    const seller = await linked("corsa-chat");
    await order(seller.store, "o-corsa-chat", { cf: "RSSMRA80A01H501U" });
    const api = bot();
    const replaced = racing("SELECT chat_id FROM telegram_links", () => ["sostituito"]);
    const logs = await logged(() => deliverTelegram(replaced, api.fetcher, later(10)));
    expect(logs).toEqual([]);
    expect(api.calls).toHaveLength(0);
    expect(await deliveryOf("o-corsa-chat")).toMatchObject({
      attempts: 0,
      failed_at: later(10).toISOString(),
    });
  });

  it("un ordine non più consultabile durante la valutazione resta da valutare", async () => {
    const seller = await linked("corsa-ordine");
    await order(seller.store, "o-corsa-ordine", { cf: "RSSMRA80A01H501U" });
    const api = bot();
    const hidden = racing("WITH visible_orders", ([, ...rest]) => ["uscito", ...rest]);
    const logs = await logged(() => deliverTelegram(hidden, api.fetcher, later(10)));
    expect(logs).toEqual([]);
    expect(await evaluatedAt("o-corsa-ordine")).toBeUndefined();
    await run(api.fetcher, 20);
    expect(sentTexts(api)).toEqual([expect.stringContaining("ebay-o-corsa-ordine")]);
  });

  it("uno spazio senza membri non prepara eventi", async () => {
    const seller = await linked("senza-membri");
    await env.DB.prepare("DELETE FROM workspace_members WHERE workspace_id = ?")
      .bind(seller.workspace)
      .run();
    await env.DB.prepare("UPDATE sync_state SET history_done_at = ? WHERE store_id = ?")
      .bind(later(5).toISOString(), seller.store)
      .run();
    await order(seller.store, "o-senza-membri", { cf: "RSSMRA80A01H501U" });
    const api = bot();
    await run(api.fetcher, 10);
    expect(api.calls).toHaveLength(0);
    expect(await env.DB.prepare("SELECT count(*) AS n FROM telegram_deliveries").first()).toEqual({
      n: 0,
    });
  });

  it("con «solo fiscali» il dato arrivato a notifiche spente non arriva alla riattivazione", async () => {
    const seller = await linked("arrivo-spente");
    await order(seller.store, "o-arrivo-spente");
    const api = bot();
    await run(api.fetcher, 10);
    await saveTelegramChange(
      env.DB,
      seller.userId,
      { name: "enabled", value: false },
      "UTC",
      later(12),
    );
    await insertTaxIdentifiers({
      id: "t-arrivo-spente",
      orderId: "o-arrivo-spente",
      type: "CODICE_FISCALE",
      value: "RSSMRA80A01H501U",
      source: "ebay_trading_get_orders",
      observedAt: later(15).toISOString(),
    }).run();
    // Con le notifiche spente lo spazio non si valuta: lo stato resta quello registrato.
    await run(api.fetcher, 16);
    expect(await evaluatedAt("o-arrivo-spente")).toBe(later(10).toISOString());
    await saveTelegramChange(
      env.DB,
      seller.userId,
      { name: "enabled", value: true },
      "UTC",
      later(18),
    );
    await run(api.fetcher, 20);
    expect(api.calls).toHaveLength(0);
    // Il dato che cambia dopo la riattivazione arriva come nuovo ordine.
    await env.DB.batch([
      env.DB.prepare("UPDATE tax_identifiers SET removed_at = ? WHERE id = 't-arrivo-spente'").bind(
        later(25).toISOString(),
      ),
      insertTaxIdentifiers({
        id: "t-arrivo-dopo",
        orderId: "o-arrivo-spente",
        type: "CODICE_FISCALE",
        value: "BNCLGU80A01H501Z",
        source: "ebay_trading_get_orders",
        observedAt: later(25).toISOString(),
      }),
    ]);
    await run(api.fetcher, 30);
    expect(sentTexts(api)).toEqual([
      expect.stringMatching(/Nuovo ordine[\s\S]*<code>BNCLGU80A01H501Z<\/code>/u),
    ]);
  });

  it("una variazione conta se scritta dopo l'inizio della finestra di lettura", async () => {
    const seller = await linked("finestra");
    await order(seller.store, "o-finestra");
    const api = bot();
    await run(api.fetcher, 30);
    expect(await evaluatedAt("o-finestra")).toBe(later(30).toISOString());
    // La finestra comincia 15 minuti prima della valutazione: un dato precedente non è una
    // variazione e l'ordine non si rivaluta.
    const start = later(15).getTime();
    await insertTaxIdentifiers({
      id: "t-finestra",
      orderId: "o-finestra",
      type: "CODICE_FISCALE",
      value: "RSSMRA80A01H501U",
      source: "ebay_trading_get_orders",
      observedAt: new Date(start - 1000).toISOString(),
    }).run();
    await run(api.fetcher, 40);
    expect(await evaluatedAt("o-finestra")).toBe(later(30).toISOString());
    expect(api.calls).toHaveLength(0);
    await env.DB.prepare("UPDATE tax_identifiers SET observed_at = ? WHERE id = 't-finestra'")
      .bind(new Date(start + 1000).toISOString())
      .run();
    await run(api.fetcher, 50);
    expect(await evaluatedAt("o-finestra")).toBe(later(50).toISOString());
    expect(sentTexts(api)).toEqual([expect.stringContaining("<code>RSSMRA80A01H501U</code>")]);
  });

  it("il riepilogo parte all'orario esatto; con un messaggio per ordine non c'è riepilogo", async () => {
    const digest = await linked("orario-esatto", 661);
    const each = await linked("per-ordine", 662);
    await digestMode(digest);
    await saveTelegramChange(env.DB, each.userId, { name: "digestTime", value: "21:00" }, "UTC");
    await order(digest.store, "o-orario-esatto", { cf: "RSSMRA80A01H501U" });
    await order(each.store, "o-per-ordine", { cf: "BNCLGU80A01H501Z" });
    const api = bot();
    await run(api.fetcher, 60);
    const texts = Object.fromEntries(
      api.texts().map((call) => [call.params.chat_id, String(call.params.text)]),
    );
    expect(Object.keys(texts).sort()).toEqual(["661", "662"]);
    expect(texts["661"]).toMatch(/Riepilogo del[\s\S]*ebay-o-orario-esatto/u);
    expect(texts["662"]).toMatch(/^🛒 <b>Nuovo ordine<\/b>[\s\S]*ebay-o-per-ordine/u);
    expect(await digestOf(each)).toBeNull();
  });

  it("elimina le consegne chiuse dopo sette giorni e le altre dopo trenta", async () => {
    const seller = await account("conservazione");
    const day = 86_400_000;
    const at = Date.parse(now);
    const rows: Array<[string, number, "sent_at" | "failed_at" | null]> = [
      ["inviata-7", at - 7 * day, "sent_at"],
      ["fallita-7", at - 7 * day, "failed_at"],
      ["inviata-recente", at - 7 * day + 1, "sent_at"],
      ["aperta-30", at - 30 * day, null],
      ["aperta-recente", at - 30 * day + 1, null],
      ["aperta-8", at - 8 * day, null],
    ];
    await env.DB.batch(
      rows.map(([id, created, closed]) => {
        const iso = new Date(created).toISOString();
        return env.DB.prepare(`INSERT INTO telegram_deliveries
          (id, workspace_id, link_id, kind, store_id, event_key, event_at, created_at, sent_at, failed_at)
          VALUES (?, ?, 'collegamento', 'import', ?, ?, ?, ?, ?, ?)`).bind(
          id,
          seller.workspace,
          seller.store,
          `import:${id}`,
          iso,
          iso,
          closed === "sent_at" ? iso : null,
          closed === "failed_at" ? iso : null,
        );
      }),
    );
    await purgeExpiredRecords(env.DB, new Date(now));
    const { results } = await env.DB.prepare("SELECT id FROM telegram_deliveries ORDER BY id").all<{
      id: string;
    }>();
    expect(results.map(({ id }) => id)).toEqual(["aperta-8", "aperta-recente", "inviata-recente"]);
  });
});

let callbackId = 0;

/** Tocco su un pulsante di un messaggio del bot, dall'ingresso alla coda. */
async function tap(data: string, chat: number, fetcher: typeof fetch, at = new Date(now)) {
  send.mockClear();
  const body = {
    update_id: ++updateId,
    callback_query: {
      id: `cb-${++callbackId}`,
      data,
      message: { message_id: 42, chat: { id: chat, type: "private" } },
    },
  };
  const response = await receiveWebhook(webhook(body), environment, fetcher, at);
  expect(response?.status).toBe(204);
  if (send.mock.calls.length > 0)
    await consumeWebhooks(
      { messages: [queueMessage(send.mock.calls[0]![0])] },
      environment,
      fetcher,
      at,
    );
}

describe("comandi e pulsanti del bot", () => {
  const generation = async (workspace: string) => (await link(workspace))!.id.slice(0, 8);

  it("lo stato coincide con le Impostazioni e i pulsanti le modificano", async () => {
    const seller = await linked("comandi");
    const api = bot();
    await deliver("/stato", seller.chat, api.fetcher);
    const status = api.texts()[0]!;
    expect(String(status.params.text)).toContain("Premium fino al");
    expect(String(status.params.text)).toContain(
      "🔔 Notifiche attive · solo con dato fiscale\n📨 Un messaggio per ordine",
    );
    const gen = await generation(seller.workspace);
    expect(keyboard(status)[0]![0]).toEqual({ text: "⚙️ Preferenze", callback_data: `${gen}:pr` });

    await tap(`${gen}:fi:all`, seller.chat, api.fetcher);
    // Il tocco ha la risposta dall'ingresso, senza attendere la coda.
    expect(send).not.toHaveBeenCalled();
    // Un tocco ripetuto porta lo stesso valore: la scelta non si inverte.
    await tap(`${gen}:fi:all`, seller.chat, api.fetcher);
    expect((await telegramSettings(env.DB, seller.userId, "UTC")).filter).toBe("all");
    expect(api.calls.filter((call) => call.method === "answerCallbackQuery")).toHaveLength(2);
    const edited = api.calls.filter((call) => call.method === "editMessageText").at(-1)!;
    expect(edited.params).toMatchObject({ chat_id: "601", message_id: 42 });
    expect(keyboard(edited)[1]![1]).toEqual({
      text: "● Tutti gli ordini",
      callback_data: `${gen}:fi:all`,
    });

    await tap(`${gen}:mo:digest`, seller.chat, api.fetcher);
    await tap(`${gen}:tm:0800`, seller.chat, api.fetcher);
    await tap(`${gen}:sx:0:0:${seller.store}`, seller.chat, api.fetcher);
    await tap(`${gen}:en:0`, seller.chat, api.fetcher);
    // Il fuso del riepilogo resta quello fissato dal sito.
    expect(await telegramSettings(env.DB, seller.userId, "UTC")).toMatchObject({
      enabled: false,
      mode: "digest",
      digestTime: "08:00",
      timeZone: "Europe/Rome",
      stores: [{ id: seller.store, enabled: false }],
    });
  });

  it("un pulsante di un collegamento sostituito non ha effetto", async () => {
    const seller = await linked("sostituito");
    const old = await generation(seller.workspace);
    await deliver(`/start ${await linkToken(seller.cookie)}`, 603);
    const api = bot();
    await tap(`${old}:fi:all`, seller.chat, api.fetcher);
    expect((await telegramSettings(env.DB, seller.userId, "UTC")).filter).toBe("fiscal");
    expect(api.calls).toEqual([
      expect.objectContaining({
        method: "answerCallbackQuery",
        params: expect.objectContaining({ text: "Questo pulsante non è più valido." }),
      }),
    ]);
  });

  it("scollega la chat con due tocchi e annulla le consegne in attesa", async () => {
    const seller = await linked("scollega");
    await order(seller.store, "o-scollega", { cf: "RSSMRA80A01H501U" });
    const limited = bot((call) =>
      call.method === "sendMessage"
        ? failure(429, { ok: false, parameters: { retry_after: 600 } })
        : undefined,
    );
    await run(limited.fetcher, 10);
    const gen = await generation(seller.workspace);
    const api = bot();
    await tap(`${gen}:ul`, seller.chat, api.fetcher);
    expect(await link(seller.workspace)).not.toBeNull();
    await tap(`${gen}:ul:ok`, seller.chat, api.fetcher);
    expect(await link(seller.workspace)).toBeNull();
    expect(await env.DB.prepare("SELECT count(*) AS n FROM telegram_deliveries").first()).toEqual({
      n: 0,
    });
    // Da scollegata, sul test, la chat non vede più nulla.
    const silent = bot();
    await deliver("/stato", seller.chat, silent.fetcher);
    expect(silent.calls).toHaveLength(0);
  });

  it("gli ultimi ordini dei negozi inclusi arrivano cinque alla volta, fino a venti", async () => {
    const seller = await linked("ultimi");
    for (let index = 0; index < 7; index++)
      await order(seller.store, `o-ultimi-${index}`, {
        cf: "RSSMRA80A01H501U",
        created: index - 30,
        listed: 1,
      });
    // Un negozio escluso con ordini più recenti non toglie posto a quelli inclusi.
    await insertStore({ id: "s-ultimi-escluso", workspaceId: seller.workspace }).run();
    await saveTelegramChange(
      env.DB,
      seller.userId,
      { name: "store", storeId: "s-ultimi-escluso", value: false },
      "UTC",
    );
    for (let index = 0; index < 20; index++)
      await order("s-ultimi-escluso", `o-escluso-${index}`, { created: index - 20, listed: 1 });
    const api = bot();
    await deliver("/ultimi", seller.chat, api.fetcher);
    // Un solo messaggio con cinque ordini, dal più recente; il numero apre il dettaglio.
    const [list] = sentTexts(api);
    expect(sentTexts(api)).toHaveLength(1);
    expect(list).toContain("🛒 <b>Ultimi ordini</b> · <i>1–5 di 7</i>");
    expect(list).toContain(`<a href="${origin}/app/ordini/o-ultimi-6">ebay-o-ultimi-6</a>`);
    expect(list).not.toContain("ebay-o-ultimi-1");
    expect(list).not.toContain("o-escluso");
    const gen = await generation(seller.workspace);
    expect(keyboard(api.texts()[0]!)).toEqual([
      [{ text: "Altri 5 ›", callback_data: `${gen}:la:5` }],
      [{ text: "🔗 Apri gli ordini", url: `${origin}/app/ordini` }],
    ]);
    // Le pagine aggiornano lo stesso messaggio; un tocco ripetuto lo riscrive uguale.
    await tap(`${gen}:la:5`, seller.chat, api.fetcher);
    await tap(`${gen}:la:5`, seller.chat, api.fetcher);
    const edits = api.calls.filter((call) => call.method === "editMessageText");
    expect(api.texts()).toHaveLength(1);
    expect(edits).toHaveLength(2);
    expect(edits[0]!.params.text).toEqual(edits[1]!.params.text);
    expect(String(edits[0]!.params.text)).toContain("1–5 di 7".replace("1–5", "6–7"));
    expect(String(edits[0]!.params.text)).toContain("ebay-o-ultimi-0");
    expect(keyboard(edits[0]!)[0]).toEqual([
      { text: "‹ Precedenti", callback_data: `${gen}:la:0` },
    ]);
  });

  it("negli ultimi ordini ogni Codice Fiscale autorizzato ha il suo pulsante di copia", async () => {
    const seller = await linked("copia");
    await order(seller.store, "o-copia-uno", { cf: "rss mra80a01h501u", created: 1, listed: 2 });
    await order(seller.store, "o-copia-due", { cf: "BNCLGU80A01H501Z", created: 3, listed: 4 });
    await order(seller.store, "o-copia-senza", { created: 5, listed: 6 });
    const api = bot();
    await deliver("/ultimi", seller.chat, api.fetcher, later(10));
    expect(keyboard(api.texts()[0]!)).toEqual([
      [{ text: "📋 BNCLGU80A01H501Z", copy_text: { text: "BNCLGU80A01H501Z" } }],
      [{ text: "📋 RSSMRA80A01H501U", copy_text: { text: "RSSMRA80A01H501U" } }],
      [{ text: "🔗 Apri gli ordini", url: `${origin}/app/ordini` }],
    ]);
  });

  it("l'aiuto presenta i comandi con le loro icone, nelle due lingue", async () => {
    const seller = await linked("aiuto");
    const api = bot();
    await deliver("/aiuto", seller.chat, api.fetcher);
    expect(sentTexts(api)[0]).toBe(
      [
        "👋 <b>FiscalBay</b>\nQui arrivano le notifiche degli ordini, secondo le preferenze delle Impostazioni.",
        "⭐ /stato · piano, notifiche e negozi\n🛒 /ultimi · gli ultimi ordini\n⚙️ /preferenze · pausa, filtro, frequenza e negozi",
        "<i>Ricerca, sblocco ed esportazione restano sul sito.</i>",
      ].join("\n\n"),
    );
    await env.DB.prepare("UPDATE telegram_links SET language = 'en' WHERE workspace_id = ?")
      .bind(seller.workspace)
      .run();
    await deliver("/help", seller.chat, api.fetcher, later(1));
    expect(sentTexts(api)[1]).toContain("🛒 /latest · the latest orders");
  });

  it("senza Premium lo stato dice Free e le preferenze rimandano al piano", async () => {
    const seller = await linked("free");
    await env.DB.prepare("UPDATE workspace_entitlements SET revoked_at = ? WHERE workspace_id = ?")
      .bind(now, seller.workspace)
      .run();
    const api = bot();
    await deliver("/stato", seller.chat, api.fetcher, later(1));
    await deliver("/preferences", seller.chat, api.fetcher, later(2));
    await deliver("/aiuto", seller.chat, api.fetcher, later(3));
    expect(sentTexts(api)).toEqual([
      expect.stringContaining("Con il piano Free le notifiche sono ferme."),
      expect.stringContaining("compresi in Premium"),
      expect.stringContaining("/ultimi"),
    ]);
  });

  it("lo stato avvisa della chat irraggiungibile, che un comando non chiude", async () => {
    const seller = await linked("stato-irraggiungibile");
    await env.DB.prepare(`UPDATE telegram_links SET delivery_failure = 'unreachable',
        delivery_failed_at = ? WHERE workspace_id = ?`)
      .bind(now, seller.workspace)
      .run();
    const api = bot();
    await deliver("/stato", seller.chat, api.fetcher, later(1));
    expect(sentTexts(api)[0]).toContain(
      "⚠️ Alcuni messaggi non sono arrivati dopo diversi tentativi.",
    );
    expect((await telegramSettings(env.DB, seller.userId, "UTC")).chat?.failure).toBe(
      "unreachable",
    );
  });

  it("un pulsante con il negozio di un altro spazio non ha effetto", async () => {
    const seller = await linked("pulsante-negozio");
    const other = await account("pulsante-altro");
    const api = bot();
    await tap(
      `${await generation(seller.workspace)}:sx:0:0:${other.store}`,
      seller.chat,
      api.fetcher,
    );
    expect(
      await env.DB.prepare("SELECT count(*) AS n FROM telegram_store_preferences").first(),
    ).toEqual({ n: 0 });
    expect((await telegramSettings(env.DB, other.userId, "UTC")).stores).toEqual([
      expect.objectContaining({ id: other.store, enabled: true }),
    ]);
    const edited = api.calls.find((call) => call.method === "editMessageText")!;
    expect(JSON.stringify(edited.params)).not.toContain(other.store);
  });

  it("il limite per chat regge agli aggiornamenti simultanei e chiude l'attesa del tocco ignorato", async () => {
    const api = bot();
    await Promise.all(
      Array.from({ length: 25 }, () =>
        receiveWebhook(webhook(update("/aiuto", 778)), environment, api.fetcher, new Date(now)),
      ),
    );
    const receipts = () =>
      env.DB.prepare("SELECT count(*) AS n FROM webhook_receipts WHERE object_id = '778'").first();
    expect(await receipts()).toEqual({ n: 20 });
    await tap("abcdefgh:pr", 778, api.fetcher);
    expect(send).not.toHaveBeenCalled();
    expect(await receipts()).toEqual({ n: 20 });
    expect(api.calls).toEqual([
      { method: "answerCallbackQuery", params: { callback_query_id: `cb-${callbackId}` } },
    ]);
  });

  it("riconosce i comandi del menu, limita gli aggiornamenti per chat e configura il menu", async () => {
    const parse = (text: string) => verifyTelegramUpdate(JSON.stringify(update(text)), secret, env);
    expect(parse("/stato")).toMatchObject({ kind: "command", command: "status" });
    expect(parse("/latest@FiscalBayTestBot")).toMatchObject({ kind: "command", command: "latest" });
    expect(parse("/stato ora")).toBeNull();
    for (let index = 0; index < 20; index++)
      await receiveWebhook(webhook(update("/aiuto", 777)), environment);
    send.mockClear();
    expect((await receiveWebhook(webhook(update("/aiuto", 777)), environment))?.status).toBe(204);
    expect(send).not.toHaveBeenCalled();
    const api = bot();
    await configureBotCommands(environment, api.fetcher);
    // I comandi lasciati da BotFather nell'ambito predefinito si eliminano a ogni riallineamento.
    expect(api.calls.map((call) => call.method)).toEqual([
      "deleteMyCommands",
      "setMyCommands",
      "setMyCommands",
    ]);
    expect(api.calls.map((call) => call.params)).toEqual([
      { scope: { type: "default" } },
      expect.objectContaining({
        language_code: "it",
        scope: { type: "all_private_chats" },
        commands: expect.arrayContaining([
          { command: "stato", description: "Piano, notifiche e negozi" },
        ]),
      }),
      expect.not.objectContaining({ language_code: expect.anything() }),
    ]);
  });
});
