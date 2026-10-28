#!/usr/bin/env node
/**
 * Rilegge il bot Telegram di un ambiente e lo confronta con il codice: webhook su `APP_ORIGIN`
 * più `/webhooks/telegram` con messaggi e pulsanti, menu dei venditori nelle due lingue e menu
 * della sola chat dell'owner (D198). Con `--apply` registra webhook e menu dell'owner, poi
 * rilegge; il menu dei venditori lo riallinea il compito giornaliero del Worker.
 *
 * Token e segreto del webhook arrivano dalle variabili `TELEGRAM_BOT_TOKEN` e
 * `TELEGRAM_WEBHOOK_SECRET` del processo, letti per esempio dal Portachiavi dentro il comando:
 * non entrano mai nel resoconto, che riporta soltanto l'esito di ogni controllo.
 *
 * Uso: TELEGRAM_BOT_TOKEN=… TELEGRAM_WEBHOOK_SECRET=… node scripts/telegram-bot.mjs
 *        [--mode live] [--apply]
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { botCommands, ownerCommands } from "../app/bot-commands.ts";
import { ownerTelegramCopy } from "../app/copy/owner-telegram.ts";
import { telegramBotCopy } from "../app/copy/telegram.ts";
import config from "../cloudflare.config.ts";

const allowedUpdates = ["message", "callback_query"];

/** Ambiente letto da `cloudflare.config.ts` con la stessa modalità della build. */
export function targetOf(mode) {
  const { env } = config({ mode: mode === "live" ? "live" : "development" }).worker;
  return {
    webhookUrl: `${new URL(env.APP_ORIGIN.value).origin}/webhooks/telegram`,
    ownerId: env.TELEGRAM_OWNER_ID.value,
  };
}

/** Menu dei venditori come lo imposta il Worker: italiano con `language_code`, inglese senza. */
function sellerMenu(language) {
  return Object.keys(botCommands).map((command) => ({
    command: botCommands[command][language],
    description: telegramBotCopy[language].commands[command],
  }));
}

/** Menu della chat dell'owner, composto come `ownerMenu` del Worker. */
export function ownerMenu() {
  return [
    ...ownerCommands.map((command) => ({
      command,
      description: ownerTelegramCopy.commands[command],
    })),
    ...sellerMenu("it"),
  ];
}

/** Chiamata alla Bot API; l'errore porta soltanto il metodo, mai l'indirizzo con il token. */
export function botRequest(token, fetcher = fetch) {
  return async (method, params = {}) => {
    let payload;
    try {
      const response = await fetcher(`https://api.telegram.org/bot${token}/${method}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(params),
      });
      payload = await response.json();
    } catch {
      throw new Error(`${method}: richiesta non riuscita`);
    }
    if (payload?.ok !== true) throw new Error(`${method}: rifiutata`);
    return payload.result;
  };
}

/** Registra webhook e menu dell'owner; ripeterlo non cambia nulla. */
export async function applyBot(request, target, secret) {
  await request("setWebhook", {
    url: target.webhookUrl,
    secret_token: secret,
    allowed_updates: allowedUpdates,
    drop_pending_updates: false,
  });
  await request("setMyCommands", {
    commands: ownerMenu(),
    scope: { type: "chat", chat_id: target.ownerId },
  });
}

/** Stesso menu, nell'ordine: Telegram restituisce soltanto nome e descrizione dei comandi. */
const sameMenu = (expected, actual) =>
  Array.isArray(actual) &&
  JSON.stringify(expected) ===
    JSON.stringify(actual.map(({ command, description }) => ({ command, description })));

/** Esito di ogni controllo, senza valori del bot. */
export async function checkBot(request, target) {
  const [webhook, owner, italian, english] = await Promise.all([
    request("getWebhookInfo"),
    request("getMyCommands", { scope: { type: "chat", chat_id: target.ownerId } }),
    request("getMyCommands", { scope: { type: "all_private_chats" }, language_code: "it" }),
    request("getMyCommands", { scope: { type: "all_private_chats" } }),
  ]);
  return [
    { item: "webhook: indirizzo", ok: webhook?.url === target.webhookUrl },
    {
      item: "webhook: messaggi e pulsanti",
      ok:
        JSON.stringify([...allowedUpdates].sort()) ===
        JSON.stringify([...(webhook?.allowed_updates ?? [])].sort()),
    },
    {
      item: "webhook: nessun errore recente",
      ok: !webhook?.last_error_date || Date.now() / 1000 - webhook.last_error_date > 3600,
    },
    { item: "menu dell'owner", ok: sameMenu(ownerMenu(), owner) },
    { item: "menu dei venditori in italiano", ok: sameMenu(sellerMenu("it"), italian) },
    { item: "menu dei venditori in inglese", ok: sameMenu(sellerMenu("en"), english) },
  ];
}

export function report(results) {
  return results.map(({ item, ok }) => `${ok ? "✓" : "✗"} ${item}`).join("\n");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const { values } = parseArgs({
    options: {
      mode: { type: "string", default: "test" },
      apply: { type: "boolean", default: false },
    },
  });
  if (!["test", "live"].includes(values.mode)) throw new Error("--mode accetta test o live.");
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (!token || (values.apply && !/^[A-Za-z0-9_-]{32,256}$/u.test(secret ?? "")))
    throw new Error("Servono TELEGRAM_BOT_TOKEN e, con --apply, TELEGRAM_WEBHOOK_SECRET.");
  const target = targetOf(values.mode);
  const request = botRequest(token);
  if (values.apply) await applyBot(request, target, secret);
  const results = await checkBot(request, target);
  console.log(report(results));
  if (results.some(({ ok }) => !ok)) process.exitCode = 1;
}
