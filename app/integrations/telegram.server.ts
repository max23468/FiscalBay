import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";

import { readBounded, retryAfterSeconds, UpstreamError } from "./http.server";

// Ogni Worker ha il proprio bot: quello del test non condivide nome, token, segreto o webhook con
// Production. Senza i tre valori il servizio non compare e l'ingresso risponde 503. Token e
// segreto sono facoltativi come quelli di Stripe; il nome è una variabile di `cloudflare.config.ts`.
export type TelegramSecrets = { TELEGRAM_BOT_TOKEN: string; TELEGRAM_WEBHOOK_SECRET: string };

declare global {
  namespace Cloudflare {
    interface Env extends Partial<TelegramSecrets> {}
  }
}

// Nome di un bot: da 5 a 32 caratteri, con il suffisso `bot` richiesto da Telegram.
const usernamePattern = /^[A-Za-z][A-Za-z0-9_]{1,28}[Bb][Oo][Tt]$/u;
// Telegram ammette nel segreto del webhook soltanto lettere, cifre, `_` e `-`, fino a 256.
const secretPattern = /^[A-Za-z0-9_-]{32,256}$/u;

/** Bot dell'ambiente configurato: nome pubblico, token e segreto del webhook. */
export function telegramConfigured(env: Env): boolean {
  return (
    usernamePattern.test(env.TELEGRAM_BOT_USERNAME ?? "") &&
    !!env.TELEGRAM_BOT_TOKEN &&
    secretPattern.test(env.TELEGRAM_WEBHOOK_SECRET ?? "")
  );
}

/** Token del deep link: 32 byte casuali, nel formato che Telegram accetta per `start`. */
export function linkToken(): string {
  return randomBytes(32).toString("base64url");
}

export const linkTokenPattern = /^[A-Za-z0-9_-]{43}$/u;

export function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Apre la chat con il bot dell'ambiente; «Avvia» invia `/start <token>`. */
export function deepLink(env: Env, token: string): string {
  return `https://t.me/${env.TELEGRAM_BOT_USERNAME}?start=${token}`;
}

function sameSecret(received: string | null, expected: string): boolean {
  if (received === null) return false;
  // Le impronte hanno la stessa lunghezza: il confronto non rivela quanto coincide.
  return timingSafeEqual(
    createHash("sha256").update(received).digest(),
    createHash("sha256").update(expected).digest(),
  );
}

const updateSchema = z.object({
  update_id: z.number().int().nonnegative(),
  message: z
    .object({
      date: z.number().int().positive(),
      chat: z.object({ id: z.number().int(), type: z.string() }),
      text: z.string().optional(),
    })
    .optional(),
});

export class TelegramSecretMismatch extends Error {}

/** Comando `/start` ricevuto in una chat privata, con l'impronta dell'eventuale token. */
export type TelegramStart = {
  updateId: number;
  chatId: string;
  eventAt: string;
  tokenHash: string | null;
};

/**
 * Aggiornamento autentico del bot: il segreto del webhook è l'unica prova dell'origine. Restituisce
 * il comando `/start` di una chat privata; null per ogni altro aggiornamento, che non ha effetti.
 * Un corpo non conforme è un errore.
 */
export function verifyTelegramUpdate(
  body: string,
  secret: string | null,
  env: Env,
): TelegramStart | null {
  if (!sameSecret(secret, env.TELEGRAM_WEBHOOK_SECRET!)) throw new TelegramSecretMismatch();
  const update = updateSchema.parse(JSON.parse(body));
  const message = update.message;
  // Stryker disable next-line ConditionalExpression: un testo assente diventa «undefined», che il comando non riconosce.
  if (message?.chat.type !== "private" || message.text === undefined) return null;
  const command = /^\/start(?:@\w+)?(?:\s+(\S+))?\s*$/u.exec(message.text);
  if (!command) return null;
  const token = command[1];
  return {
    updateId: update.update_id,
    chatId: String(message.chat.id),
    eventAt: new Date(message.date * 1000).toISOString(),
    tokenHash: token && linkTokenPattern.test(token) ? tokenHash(token) : null,
  };
}

const timeoutMs = 10_000;
const maxBytes = 65_536;

const replySchema = z.object({
  ok: z.boolean(),
  result: z.unknown().optional(),
  parameters: z.object({ retry_after: z.number().int().nonnegative().optional() }).optional(),
});

/**
 * Chiamata alla Bot API con timeout, limite dei byte e la classificazione comune dei provider:
 * 429 con l'attesa indicata da Telegram, token non valido come credenziali, altri rifiuti come
 * `rejected` con lo stato. Il token sta nell'indirizzo e non entra mai in un errore o in un log.
 */
async function botApi<Schema extends z.ZodType>(
  env: Env,
  method: string,
  params: Record<string, unknown>,
  schema: Schema,
  fetcher: typeof fetch,
): Promise<z.infer<Schema>> {
  let response: Response;
  let text: string;
  try {
    response = await fetcher(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const bytes = await readBounded(response, maxBytes);
    if (!bytes) throw new UpstreamError("invalid_response", { status: response.status });
    text = new TextDecoder().decode(bytes);
  } catch (error) {
    if (error instanceof UpstreamError) throw error;
    throw new UpstreamError("unavailable");
  }
  // Un corpo che non è JSON resta senza risposta leggibile, come uno di forma diversa.
  const reply = await new Response(text).json().then(
    (payload: unknown) => replySchema.safeParse(payload).data,
    () => undefined,
  );
  const { status } = response;
  if (status === 429) {
    const retryAfter =
      reply?.parameters?.retry_after ??
      retryAfterSeconds(response.headers.get("retry-after")) ??
      undefined;
    throw new UpstreamError("rate_limited", { status, retryAfter });
  }
  if (status >= 500) throw new UpstreamError("unavailable", { status });
  if (status === 401 || status === 404) throw new UpstreamError("credentials", { status });
  if (status >= 400) throw new UpstreamError("rejected", { status });
  if (!reply?.ok) throw new UpstreamError("invalid_response", { status });
  const result = schema.safeParse(reply.result);
  if (!result.success) throw new UpstreamError("invalid_response", { status });
  return result.data;
}

const chatSchema = z.object({
  username: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
});

/**
 * Nome con cui l'utente riconosce la chat nelle Impostazioni: `@username`, altrimenti nome e
 * cognome di Telegram; null se Telegram non ne restituisce.
 */
export async function chatLabel(
  env: Env,
  chatId: string,
  fetcher: typeof fetch = fetch,
): Promise<string | null> {
  const chat = await botApi(env, "getChat", { chat_id: chatId }, chatSchema, fetcher);
  const label = chat.username
    ? `@${chat.username}`
    : [chat.first_name, chat.last_name].join(" ").trim();
  return label ? label.slice(0, 128) : null;
}

/** Messaggio di testo semplice, senza formattazione da sottoporre a escape. */
export async function sendText(
  env: Env,
  chatId: string,
  text: string,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  await botApi(
    env,
    "sendMessage",
    { chat_id: chatId, text, link_preview_options: { is_disabled: true } },
    z.object({ message_id: z.number() }),
    fetcher,
  );
}
