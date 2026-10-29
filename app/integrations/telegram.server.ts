import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";

import { botCommands, ownerCommands, type BotCommand, type OwnerCommand } from "../bot-commands";
import { readUpstream, retryAfterSeconds, UpstreamError } from "./http.server";

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
  // Un valore assente diventa «undefined», che nessuno dei due formati ammette.
  return (
    usernamePattern.test(String(env.TELEGRAM_BOT_USERNAME)) &&
    !!env.TELEGRAM_BOT_TOKEN &&
    secretPattern.test(String(env.TELEGRAM_WEBHOOK_SECRET))
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

const chatSchema = z.object({ id: z.number().int(), type: z.string() });
const senderSchema = z.object({ id: z.number().int() }).optional();

const updateSchema = z.object({
  update_id: z.number().int().nonnegative(),
  message: z
    .object({
      date: z.number().int().positive(),
      chat: chatSchema,
      from: senderSchema,
      text: z.string().optional(),
    })
    .optional(),
  callback_query: z
    .object({
      id: z.string().min(1).max(256),
      from: senderSchema,
      data: z.string().optional(),
      message: z.object({ message_id: z.number().int().positive(), chat: chatSchema }).optional(),
    })
    .optional(),
});

export class TelegramSecretMismatch extends Error {}

/** Comando del menu con quel nome, in una delle due lingue. */
function commandNamed(name: string) {
  return (Object.keys(botCommands) as BotCommand[]).find(
    (command) => botCommands[command].it === name || botCommands[command].en === name,
  );
}

/** Prefisso dei pulsanti dell'owner: quelli dei venditori iniziano con una generazione esadecimale. */
export const ownerCallbackPrefix = "oc1:";

/** Dati di un pulsante del bot: soltanto identificativi brevi, entro il limite di Telegram. */
export const callbackDataPattern = /^[A-Za-z0-9:_-]{1,64}$/u;

/** ID Telegram dell'owner, lo stesso per la chat privata e per l'utente. */
export function ownerChatId(env: Env): string | null {
  const id = String(env.TELEGRAM_OWNER_ID);
  return /^\d{1,20}$/u.test(id) ? id : null;
}

/**
 * Chat dell'owner, con l'owner come mittente: altrimenti l'owner non è riconosciuto. Chi chiama
 * ammette soltanto chat private; senza un ID configurato nessuna chat coincide.
 */
function fromOwner(env: Env, chat: z.infer<typeof chatSchema>, sender?: { id: number }) {
  const owner = ownerChatId(env);
  return String(chat.id) === owner && String(sender?.id) === owner;
}

type UpdateBase = { updateId: number; chatId: string; eventAt: string };

/** Comando `/start` ricevuto in una chat privata, con l'impronta dell'eventuale token. */
export type TelegramStart = UpdateBase & { kind: "start"; tokenHash: string | null };

/** Aggiornamento del bot che ha un effetto: avvio, comando del menu o tocco su un pulsante. */
export type TelegramUpdate =
  | TelegramStart
  | (UpdateBase & { kind: "command"; command: BotCommand })
  | (UpdateBase & { kind: "callback"; callbackId: string; messageId: number; data: string })
  | (UpdateBase & { kind: "owner"; command: OwnerCommand })
  | (UpdateBase & { kind: "owner_callback"; callbackId: string; messageId: number; data: string });

/**
 * Aggiornamento autentico del bot: il segreto del webhook è l'unica prova dell'origine. Restituisce
 * `/start`, un comando del menu o il tocco su un pulsante di una chat privata, e i comandi e i
 * pulsanti dell'owner dalla sua chat; null per ogni altro aggiornamento, che non ha effetti, anche
 * un comando dell'owner da un'altra chat o da un altro utente. Un corpo non conforme è un errore.
 * Il tocco non ha una data propria: vale l'istante di ricezione.
 */
export function verifyTelegramUpdate(
  body: string,
  secret: string | null,
  env: Env,
  now = new Date(),
): TelegramUpdate | null {
  if (!sameSecret(secret, env.TELEGRAM_WEBHOOK_SECRET!)) throw new TelegramSecretMismatch();
  const update = updateSchema.parse(JSON.parse(body));
  const callback = update.callback_query;
  if (callback) {
    const message = callback.message;
    // Stryker disable next-line StringLiteral: il valore sostitutivo serve solo a non ammettere un dato assente; ogni testo fuori dal formato è rifiutato allo stesso modo.
    const data = callback.data ?? "";
    if (message?.chat.type !== "private" || !callbackDataPattern.test(data)) return null;
    if (data.startsWith(ownerCallbackPrefix)) {
      if (!fromOwner(env, message.chat, callback.from)) return null;
      return {
        kind: "owner_callback",
        updateId: update.update_id,
        chatId: String(message.chat.id),
        eventAt: now.toISOString(),
        callbackId: callback.id,
        messageId: message.message_id,
        data,
      };
    }
    return {
      kind: "callback",
      updateId: update.update_id,
      chatId: String(message.chat.id),
      eventAt: now.toISOString(),
      callbackId: callback.id,
      messageId: message.message_id,
      data,
    };
  }
  const message = update.message;
  // Stryker disable next-line ConditionalExpression: un testo assente diventa «undefined», che il comando non riconosce.
  if (message?.chat.type !== "private" || message.text === undefined) return null;
  const base = {
    updateId: update.update_id,
    chatId: String(message.chat.id),
    eventAt: new Date(message.date * 1000).toISOString(),
  };
  const start = /^\/start(?:@\w+)?(?:\s+(\S+))?\s*$/u.exec(message.text);
  if (start) {
    const token = start[1];
    return {
      kind: "start",
      ...base,
      tokenHash: token && linkTokenPattern.test(token) ? tokenHash(token) : null,
    };
  }
  const name = /^\/([a-z]+)(?:@\w+)?\s*$/u.exec(message.text)?.[1];
  const owner = ownerCommands.find((command) => command === name);
  if (owner)
    return fromOwner(env, message.chat, message.from)
      ? { kind: "owner", ...base, command: owner }
      : null;
  const command = name ? commandNamed(name) : undefined;
  return command ? { kind: "command", ...base, command } : null;
}

const timeoutMs = 10_000;
const maxBytes = 65_536;

const replySchema = z.object({
  ok: z.boolean(),
  result: z.unknown().optional(),
  description: z.string().optional(),
  parameters: z.object({ retry_after: z.number().int().nonnegative().optional() }).optional(),
});

/**
 * Rifiuti di una modifica che hanno un effetto diverso: lo stesso contenuto già presente non è un
 * errore, un messaggio non più modificabile si sostituisce con uno nuovo.
 */
function rejection(description: string | undefined) {
  const text = description?.toLowerCase();
  if (text?.includes("message is not modified")) return "not_modified";
  if (text?.includes("message to edit not found") || text?.includes("message can't be edited"))
    return "not_editable";
  return undefined;
}

/** Risposta della Bot API; un corpo che non è JSON resta senza risposta, come uno di forma diversa. */
function botReply(text: string) {
  try {
    return replySchema.safeParse(JSON.parse(text)).data;
  } catch {
    // Corpo che non è JSON: nessuna risposta da leggere.
  }
  return undefined;
}

/**
 * Stati della Bot API: 429 con l'attesa indicata da Telegram, token non valido (401 o 404) come
 * credenziali, altri rifiuti come `rejected` con lo stato. Sotto 400 decide il corpo.
 */
function botStatus(response: Response, text: string, now?: number): UpstreamError | null {
  const { status } = response;
  if (status < 400) return null;
  const reply = botReply(text);
  if (status === 429) {
    const retryAfter =
      reply?.parameters?.retry_after ??
      retryAfterSeconds(response.headers.get("retry-after"), now) ??
      undefined;
    return new UpstreamError("rate_limited", { status, retryAfter });
  }
  if (status >= 500) return new UpstreamError("unavailable", { status });
  if (status === 401 || status === 404) return new UpstreamError("credentials", { status });
  return new UpstreamError("rejected", { status, providerCode: rejection(reply?.description) });
}

/**
 * Chiamata alla Bot API con timeout, limite dei byte e la classificazione comune dei provider.
 * Il token sta nell'indirizzo e non entra mai in un errore o in un log.
 */
async function botApi<Schema extends z.ZodType>(
  env: Env,
  method: string,
  params: Record<string, unknown>,
  schema: Schema,
  fetcher: typeof fetch,
): Promise<z.infer<Schema>> {
  const { status, text } = await readUpstream(
    fetcher,
    `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(params),
    },
    { timeoutMs, maxBytes },
    botStatus,
  );
  const reply = botReply(text);
  if (!reply?.ok) throw new UpstreamError("invalid_response", { status });
  const result = schema.safeParse(reply.result);
  if (!result.success) throw new UpstreamError("invalid_response", { status });
  return result.data;
}

const chatInfoSchema = z.object({
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
  const chat = await botApi(env, "getChat", { chat_id: chatId }, chatInfoSchema, fetcher);
  const label = chat.username
    ? `@${chat.username}`
    : [chat.first_name, chat.last_name].join(" ").trim();
  return label ? label.slice(0, 128) : null;
}

/** Pulsante sotto un messaggio: un indirizzo, un'azione del bot o un testo da copiare. */
export type BotButton =
  | { text: string; url: string }
  | { text: string; callback_data: string }
  | { text: string; copy_text: { text: string } };

/**
 * Messaggio del bot in HTML, con il testo già sottoposto a escape e i pulsanti per riga.
 * `preview`: immagine mostrata in piccolo sotto il testo, senza comparire nel testo.
 */
export type BotMessage = { html: string; buttons?: BotButton[][]; preview?: string };

const sentSchema = z.object({ message_id: z.number() });

function messageParams(message: BotMessage) {
  return {
    text: message.html,
    parse_mode: "HTML",
    link_preview_options: message.preview
      ? { url: message.preview, prefer_small_media: true, show_above_text: false }
      : { is_disabled: true },
    ...(message.buttons?.length ? { reply_markup: { inline_keyboard: message.buttons } } : {}),
  };
}

/** Invia un messaggio e restituisce il suo identificativo nella chat. */
export async function sendMessage(
  env: Env,
  chatId: string,
  message: BotMessage,
  fetcher: typeof fetch = fetch,
): Promise<number> {
  const sent = await botApi(
    env,
    "sendMessage",
    { chat_id: chatId, ...messageParams(message) },
    sentSchema,
    fetcher,
  );
  return sent.message_id;
}

/**
 * Sostituisce testo e pulsanti di un messaggio del bot, come fanno i menu. Un rifiuto, come lo
 * stesso contenuto già presente o un messaggio non più modificabile, lascia il messaggio com'è.
 */
export async function editMessage(
  env: Env,
  chatId: string,
  messageId: number,
  message: BotMessage,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  await botApi(
    env,
    "editMessageText",
    { chat_id: chatId, message_id: messageId, ...messageParams(message) },
    z.unknown(),
    fetcher,
  ).catch((error: unknown) => {
    if (error instanceof UpstreamError && error.failure === "rejected") return;
    throw error;
  });
}

/** Chiude l'attesa del pulsante toccato, con un breve avviso facoltativo. */
export async function answerCallback(
  env: Env,
  callbackId: string,
  text: string | undefined,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  await botApi(
    env,
    "answerCallbackQuery",
    { callback_query_id: callbackId, ...(text ? { text } : {}) },
    z.literal(true),
    fetcher,
  );
}

/**
 * Menu dei comandi nelle sole chat private: in italiano per chi usa Telegram in italiano, in
 * inglese per gli altri. I comandi dell'ambito predefinito, come quelli impostati da BotFather,
 * si eliminano: da BotFather resta soltanto la descrizione. Ripeterlo non cambia nulla.
 */
export async function setBotCommands(
  env: Env,
  descriptions: Record<"it" | "en", Record<BotCommand, string>>,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  await Promise.all([
    botApi(env, "deleteMyCommands", { scope: { type: "default" } }, z.literal(true), fetcher),
    ...(["it", "en"] as const).map((language) =>
      botApi(
        env,
        "setMyCommands",
        {
          commands: (Object.keys(botCommands) as BotCommand[]).map((command) => ({
            command: botCommands[command][language],
            description: descriptions[language][command],
          })),
          scope: { type: "all_private_chats" },
          ...(language === "it" ? { language_code: "it" } : {}),
        },
        z.literal(true),
        fetcher,
      ),
    ),
  ]);
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

/** Testo di una cella: semplice o in grassetto. */
export type RichText = string | { type: "bold"; text: string };

/** Blocchi dei messaggi a tabelle della Bot API (`sendRichMessage`), usati dal Control Center. */
export type RichBlock =
  | { type: "heading"; text: string; size: 2 }
  | { type: "paragraph"; text: string }
  | { type: "divider" }
  | {
      type: "table";
      caption: string;
      cells: Array<Array<{ text: RichText; is_header?: true; colspan?: number }>>;
      is_bordered: true;
      is_striped: true;
      is_compact: true;
    }
  | { type: "footer"; text: string };

/** Messaggio a tabelle con i pulsanti per riga. Il testo non diventa link o menzione. */
export type RichMessage = { blocks: RichBlock[]; buttons?: BotButton[][] };

function richParams(message: RichMessage) {
  return {
    rich_message: { blocks: message.blocks, skip_entity_detection: true },
    ...(message.buttons?.length ? { reply_markup: { inline_keyboard: message.buttons } } : {}),
  };
}

/** Invia un messaggio a tabelle e restituisce il suo identificativo nella chat. */
export async function sendRichMessage(
  env: Env,
  chatId: string,
  message: RichMessage,
  fetcher: typeof fetch = fetch,
): Promise<number> {
  const sent = await botApi(
    env,
    "sendRichMessage",
    { chat_id: chatId, ...richParams(message) },
    sentSchema,
    fetcher,
  );
  return sent.message_id;
}

/**
 * Sostituisce un messaggio a tabelle. Lo stesso contenuto già presente lascia il messaggio
 * com'è; un messaggio non più modificabile, per esempio troppo vecchio, restituisce `gone`.
 */
export async function editRichMessage(
  env: Env,
  chatId: string,
  messageId: number,
  message: RichMessage,
  fetcher: typeof fetch = fetch,
): Promise<"edited" | "gone"> {
  try {
    await botApi(
      env,
      "editMessageText",
      { chat_id: chatId, message_id: messageId, ...richParams(message) },
      z.unknown(),
      fetcher,
    );
  } catch (error) {
    // Stryker disable next-line ConditionalExpression,LogicalOperator: la Bot API solleva soltanto UpstreamError e solo i rifiuti portano il codice letto sotto, quindi ogni altro errore arriva comunque all'ultimo throw.
    if (!(error instanceof UpstreamError) || error.failure !== "rejected") throw error;
    if (error.details.providerCode === "not_modified") return "edited";
    if (error.details.providerCode === "not_editable") return "gone";
    throw error;
  }
  return "edited";
}

/** Testo tutto in un blocco preformattato, che Telegram copia con un tocco. */
export async function sendPreformatted(
  env: Env,
  chatId: string,
  text: string,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  await botApi(
    env,
    "sendMessage",
    {
      chat_id: chatId,
      text,
      // La lunghezza dell'entità è in unità UTF-16, come `length`.
      entities: [{ type: "pre", offset: 0, length: text.length }],
      link_preview_options: { is_disabled: true },
    },
    sentSchema,
    fetcher,
  );
}

/**
 * Menu dei comandi della sola chat dell'owner: l'ambito della chat prevale su quello delle chat
 * private, quindi il menu elenca anche i comandi dei venditori. Ripeterlo non cambia nulla.
 */
export async function setOwnerCommands(
  env: Env,
  chatId: string,
  commands: Array<{ command: string; description: string }>,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  await botApi(
    env,
    "setMyCommands",
    { commands, scope: { type: "chat", chat_id: chatId } },
    z.literal(true),
    fetcher,
  );
}

const webhookInfoSchema = z.object({
  url: z.string(),
  pending_update_count: z.number().int().nonnegative(),
  last_error_date: z.number().int().optional(),
  allowed_updates: z.array(z.string()).optional(),
});

/** Stato del webhook registrato presso Telegram, senza il segreto. */
export async function webhookInfo(env: Env, fetcher: typeof fetch = fetch) {
  const info = await botApi(env, "getWebhookInfo", {}, webhookInfoSchema, fetcher);
  return {
    url: info.url,
    pending: info.pending_update_count,
    lastErrorAt: info.last_error_date ? new Date(info.last_error_date * 1000).toISOString() : null,
    allowedUpdates: info.allowed_updates ?? [],
  };
}
