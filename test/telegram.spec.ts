import { env } from "cloudflare:workers";
import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { purgeExpiredRecords } from "../app/domain/maintenance.server";
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
  sendText,
  telegramConfigured,
  linkToken as randomLinkToken,
  verifyTelegramUpdate,
} from "../app/integrations/telegram.server";
import { consumeWebhooks, receiveWebhook } from "../app/integrations/webhooks.server";
import { action as settingsAction, loader as settingsLoader } from "../app/routes/settings";
import { loader as storesLoader } from "../app/routes/stores";
import { verifiedSession } from "./fixtures/account-fixtures";
import { insertStore, now, resetDatabase } from "./fixtures/database-fixtures";
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

/** Aggiornamento ricevuto dall'ingresso e consumato dalla coda, come in esercizio. */
async function deliver(text: string, chat = 501, fetcher = bot().fetcher, at = new Date(now)) {
  send.mockClear();
  const body = update(text, chat, "private", Math.floor(at.getTime() / 1000));
  const response = await receiveWebhook(webhook(body), environment, fetch, at);
  expect(response?.status).toBe(204);
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

  it("conserva chat e impronta del token, mai il testo, e accoda una volta sola", async () => {
    const token = "A".repeat(43);
    const body = update(`/start ${token}`, 777);
    expect((await receiveWebhook(webhook(body), environment))?.status).toBe(204);
    expect((await receiveWebhook(webhook(body), environment))?.status).toBe(204);
    expect(send).toHaveBeenCalledOnce();
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
    expect(send.mock.calls[0]![0]).toEqual({ receiptId: receipt!.id });
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
    expect(message.ack).toHaveBeenCalledOnce();
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
    await receiveWebhook(
      webhook(update(`/start ${token}`, 601)),
      environment,
      fetch,
      new Date(now),
    );
    const body = send.mock.calls[0]![0];
    // Telegram non risponde alla conferma: il messaggio torna in coda con l'attesa indicata.
    const limited = bot((call) =>
      call.method === "sendMessage"
        ? Response.json(
            { ok: false, error_code: 429, parameters: { retry_after: 7 } },
            { status: 429 },
          )
        : undefined,
    );
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
    expect(message.ack).toHaveBeenCalledOnce();
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
    expect(message.ack).toHaveBeenCalledOnce();
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
    expect(message.retry).toHaveBeenCalledOnce();
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
