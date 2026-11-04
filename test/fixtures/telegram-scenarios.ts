import { env } from "cloudflare:workers";
import { expect, vi } from "vitest";

import { deliverTelegram } from "../../app/domain/telegram-deliveries.server";
import { consumeWebhooks, receiveWebhook } from "../../app/webhooks.server";
import { type TelegramReceipt } from "../../app/domain/telegram-bot.server";
import { action as settingsAction } from "../../app/routes/settings";
import { verifiedSession } from "./account-fixtures";
import {
  insertEntitlement,
  insertOrder,
  insertStore,
  insertTaxIdentifiers,
  insertWorkspace,
  later,
  now,
} from "./database-fixtures";
import { fakeQueue, queueMessage, queued } from "./queue-fixture";
import { callRoute } from "./route-fixtures";
import { fakeBot as bot, type BotCall } from "./telegram-fixtures";

export let callbackId = 0;
export const origin = "http://localhost:5173";
export const secret = env.TELEGRAM_WEBHOOK_SECRET!;
export const send = vi.fn<Queue["send"]>().mockResolvedValue(queued);
export const environment = {
  ...env,
  WORK_QUEUE: fakeQueue({ send }),
  INGRESS_QUEUE: fakeQueue({ send }),
};
/** Utente con spazio, negozio e, se richiesto, Premium in corso. */
export async function account(name: string, premium = true) {
  const { userId, cookie } = await verifiedSession(`${name}@example.invalid`);
  const workspace = `w-${name}`;
  await env.DB.batch([
    ...insertWorkspace({ id: workspace, userId, name }),
    insertStore({ id: `s-${name}`, workspaceId: workspace }),
    ...(premium
      ? [
          insertEntitlement({
            id: `e-${name}`,
            workspaceId: workspace,
            source: "admin",
            startsAt: new Date(Date.parse(now) - 86_400_000).toISOString(),
            endsAt: new Date(Date.parse(now) + 30 * 86_400_000).toISOString(),
          }),
        ]
      : []),
  ]);
  return { userId, cookie, workspace, store: `s-${name}` };
}

export function settingsForm(cookie: string, fields: Record<string, string>) {
  return callRoute(settingsAction, "/app/impostazioni/notifiche", { cookie, fields });
}

/** Deep link creato dalle Impostazioni; restituisce il token che Telegram rimanda al bot. */
export async function linkToken(cookie: string) {
  const response = (await settingsForm(cookie, { intent: "telegram-link" })) as Response;
  expect(response.status).toBe(302);
  const location = new URL(response.headers.get("location")!);
  expect(`${location.origin}${location.pathname}`).toBe("https://t.me/FiscalBayTestBot");
  return location.searchParams.get("start")!;
}

let updateId = 1000;
export const nextUpdateId = () => ++updateId;

export function update(text: string, chat = 501, type = "private", date = Date.parse(now) / 1000) {
  return { update_id: ++updateId, message: { date, chat: { id: chat, type }, text } };
}

export const endpoint = "https://test.fiscalbay.it/webhooks/telegram";

export function webhook(body: unknown, header: string | null = secret) {
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
export async function deliver(
  text: string,
  chat = 501,
  fetcher = bot().fetcher,
  at = new Date(now),
) {
  send.mockClear();
  const body = update(text, chat, "private", Math.floor(at.getTime() / 1000));
  const response = await receiveWebhook(webhook(body), environment, fetcher, at);
  expect(response?.status).toBe(204);
  if (send.mock.calls.length === 0) return null;
  const message = queueMessage(send.mock.calls[0]![0]);
  await consumeWebhooks({ messages: [message] }, environment, fetcher, at);
  return message;
}

export const link = (workspace: string) =>
  env.DB.prepare(
    "SELECT id, chat_id, chat_label, language FROM telegram_links WHERE workspace_id = ?",
  )
    .bind(workspace)
    .first<{ id: string; chat_id: string; chat_label: string | null; language: string }>();

/** Spazio Premium con la chat collegata e l'importazione del negozio partita prima di `now`. */
export async function linked(name: string, chat = 601) {
  const seller = await account(name);
  await deliver(`/start ${await linkToken(seller.cookie)}`, chat);
  await env.DB.prepare(
    "INSERT INTO sync_state (store_id, history_from, history_until, updated_at) VALUES (?, ?, ?, ?)",
  )
    .bind(seller.store, later(-30 * 24 * 60).toISOString(), now, now)
    .run();
  return { ...seller, chat };
}

export const buyer = JSON.stringify({
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
export async function order(
  store: string,
  id: string,
  options: { created?: number; listed?: number; cf?: string; checking?: boolean } = {},
) {
  const { created = 1, listed = 2, cf, checking = false } = options;
  await env.DB.batch([
    ...insertOrder(id, {
      storeId: store,
      createdAt: later(created).toISOString(),
      totalMinor: 3490,
      buyerJson: buyer,
      listedAt: later(listed).toISOString(),
      withItem: false,
      withTax: false,
    }),
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

export const run = (fetcher: typeof fetch, minutes: number) =>
  deliverTelegram(environment, fetcher, later(minutes));

export const sentTexts = (api: ReturnType<typeof bot>) =>
  api.texts().map((call) => String(call.params.text));

export const keyboard = (call: BotCall) =>
  (call.params.reply_markup as { inline_keyboard: Array<Array<Record<string, unknown>>> })
    .inline_keyboard;

export const failure = (status: number, body: Record<string, unknown> = { ok: false }) =>
  Response.json(body, { status });

/** Bot API che a ogni invio chiede di riprovare dopo `seconds`. */
export const rateLimited = (seconds: number) =>
  bot((call) =>
    call.method === "sendMessage"
      ? failure(429, { ok: false, parameters: { retry_after: seconds } })
      : undefined,
  );

/** Stato della consegna dell'ordine. */
export const deliveryOf = (orderId: string) =>
  env.DB.prepare(`SELECT attempts, retry_at, uncertain_at, lease, locked_until, sent_at, failed_at
    FROM telegram_deliveries WHERE order_id = ?`)
    .bind(orderId)
    .first();

/** Errori registrati durante `action`, letti dalle righe JSON del log. */
export async function logged(action: () => Promise<unknown>) {
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    await action();
    return errors.mock.calls.map(([line]) => JSON.parse(String(line)) as Record<string, unknown>);
  } finally {
    errors.mockRestore();
  }
}

export async function tap(data: string, chat: number, fetcher: typeof fetch, at = new Date(now)) {
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

/** Comando ricevuto dal bot, come lo consegna l'ingresso. */
export const receipt = (fields: Pick<TelegramReceipt, "chatId" | "command">): TelegramReceipt => ({
  receiptId: crypto.randomUUID(),
  topic: "command",
  tokenHash: null,
  callbackId: null,
  messageId: null,
  eventAt: now,
  ...fields,
});
