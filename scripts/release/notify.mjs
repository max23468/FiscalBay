#!/usr/bin/env node
/**
 * Riepilogo di un ciclo all'owner, sul bot dell'ambiente. Senza token o destinatario, per esempio
 * in un environment non ancora configurato, non fa nulla: l'avviso non cambia l'esito del ciclo.
 * Uso: TELEGRAM_BOT_TOKEN=<token> TELEGRAM_OWNER_ID=<id> node scripts/release/notify.mjs <testo>
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

export async function notifyOwner(text, env = process.env, send = fetch) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_OWNER_ID) return false;
  const response = await send(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: env.TELEGRAM_OWNER_ID, text }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) console.log(`::warning::Avviso Telegram non riuscito: ${response.status}.`);
  return response.ok;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]))
  await notifyOwner(process.argv[2]);
