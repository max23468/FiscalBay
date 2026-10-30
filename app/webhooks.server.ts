import { z } from "zod";
import { createHash } from "node:crypto";
import { stripeEnvironment, verifyStripeEvent } from "./integrations/stripe.server";
import {
  answerCallback,
  telegramConfigured,
  TelegramSecretMismatch,
  verifyTelegramUpdate,
} from "./integrations/telegram.server";
import {
  admitOrigin,
  NotificationLimit,
  verifyEbayNotification,
} from "./integrations/ebay/notifications.server";
import { rejectCredentials } from "./integrations/ebay/seller-credentials.server";
import { readBounded, UpstreamError } from "./integrations/http.server";
import { ebayEnvironmentAvailable } from "./integrations/ebay/environment.server";
import { applyStripeEvent } from "./domain/billing.server";
import { consumeOrderConfirmation } from "./domain/order-acquisition.server";
import { recordBulkDataThreshold } from "./domain/ebay-quotas.server";
import { consumeOwnerUpdate } from "./domain/owner-control.server";
import {
  type EbayAccountDeletion,
  recordEbayAccountDeletion,
} from "./domain/ebay-account-deletion.server";
import { consumeTelegramUpdate } from "./domain/telegram-bot.server";
import { isProduction } from "./app-links";
import { logFailure } from "./errors";
import { inSequence } from "./sequence";
import { webhookPaths } from "./webhook-paths";
import { dayMilliseconds } from "./time";
import { queueRetryDelay, stalledReceiptMilliseconds } from "./domain/work-timing";

const maxBytes = 262_144;
const retention = 7 * dayMilliseconds;
const referenceSchema = z.object({ receiptId: z.uuid() });

/** Percorsi presi in carico dall'ingresso dei webhook, prima della build dell'app. */
export const isWebhookPath = (path: string) => webhookPaths.includes(path);

/**
 * Messaggio della coda con il riferimento a una ricevuta; il consumer convalida il riferimento e
 * riprova quello malformato.
 */
export function isWebhookMessage(body: unknown): body is { receiptId: string } {
  return z.object({ receiptId: z.string() }).safeParse(body).success;
}
type Receipt = {
  id: string;
  provider: "ebay" | "stripe" | "telegram";
  environment: string;
  provider_id: string;
  topic: string;
  object_id: string;
  store_id: string | null;
  consent_granted_at: string | null;
  link_token_hash: string | null;
  command: string | null;
  callback_id: string | null;
  message_id: number | null;
  event_at: string;
  queued_at: string | null;
  completed_at: string | null;
};

class InvalidWebhook extends Error {
  constructor(readonly status: number) {
    super();
  }
}

/** Byte originali del corpo, necessari alla firma: oltre il limite 413, assente o non UTF-8 400. */
async function rawBody(request: Request): Promise<string> {
  const bytes = await readBounded(request, maxBytes);
  if (!bytes) throw new InvalidWebhook(413);
  if (!request.body) throw new InvalidWebhook(400);
  try {
    return new TextDecoder("utf-8", {
      fatal: true,
      // Stryker disable next-line BooleanLiteral: un BOM rende comunque il JSON invalido; qui preserviamo i byte per la firma.
      ignoreBOM: true,
    }).decode(bytes);
  } catch {
    throw new InvalidWebhook(400);
  }
}

type ReceiptEvent = Omit<Receipt, "id" | "queued_at" | "completed_at">;

/** Campi di un solo provider, vuoti per gli altri. */
const noProviderFields = {
  store_id: null,
  consent_granted_at: null,
  link_token_hash: null,
  command: null,
  callback_id: null,
  message_id: null,
} satisfies Partial<ReceiptEvent>;

/** Ambiente eBay del percorso: l'endpoint di prova finisce con `/sandbox`. */
const ebayEnvironmentOf = (path: string) =>
  path.endsWith("/sandbox")
    ? "sandbox"
    : // Stryker disable next-line StringLiteral: ogni valore diverso da sandbox seleziona Production.
      "production";

/** Evento Stripe firmato, dello stesso ambiente del Worker. */
async function stripeEvent(request: Request, body: string, env: Env): Promise<ReceiptEvent> {
  const secret = env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new InvalidWebhook(503);
  const signature = request.headers.get("stripe-signature");
  const stripe = await verifyStripeEvent(
    body,
    // Stryker disable next-line StringLiteral: qualsiasi stringa di fallback non firmata viene rifiutata dallo SDK.
    signature ?? "",
    secret,
  );
  if (stripe.livemode !== isProduction(env)) throw new InvalidWebhook(400);
  const object = z.object({ id: z.string().min(1).max(256) }).parse(stripe.data.object);
  return {
    ...noProviderFields,
    provider: "stripe",
    environment: stripe.livemode ? "live" : "test",
    provider_id: stripe.id,
    topic: stripe.type,
    object_id: object.id,
    event_at: new Date(stripe.created * 1000).toISOString(),
  };
}

/** Aggiornamento del bot con il segreto del webhook; null per uno senza effetti. */
function telegramEvent(request: Request, body: string, env: Env, now: Date): ReceiptEvent | null {
  if (!telegramConfigured(env)) throw new InvalidWebhook(503);
  const update = verifyTelegramUpdate(
    body,
    request.headers.get("x-telegram-bot-api-secret-token"),
    env,
    now,
  );
  // Ogni altro aggiornamento, anche di una chat non privata, non ha effetti.
  if (!update) return null;
  return {
    ...noProviderFields,
    provider: "telegram",
    environment: stripeEnvironment(env),
    provider_id: String(update.updateId),
    topic: update.kind,
    object_id: update.chatId,
    link_token_hash: update.kind === "start" ? update.tokenHash : null,
    command:
      update.kind === "command" || update.kind === "owner"
        ? update.command
        : update.kind === "callback" || update.kind === "owner_callback"
          ? update.data
          : null,
    callback_id:
      update.kind === "callback" || update.kind === "owner_callback" ? update.callbackId : null,
    message_id:
      update.kind === "callback" || update.kind === "owner_callback" ? update.messageId : null,
    event_at: update.eventAt,
  };
}

/**
 * Notifica eBay firmata; null se autentica ma senza lavoro da accodare. La soglia della Bulk Data
 * Transfer Policy riguarda l'applicazione: apre subito l'anomalia della console, senza ricevuta.
 * La cancellazione di un account eBay non passa dalle ricevute: ha una richiesta propria. Entrambe
 * si scrivono dopo la verifica, così un database guasto risponde 503 ed eBay ritenta.
 */
async function ebayEvent(
  request: Request,
  body: string,
  env: Env,
  path: string,
  fetcher: typeof fetch,
  now: Date,
): Promise<
  | ReceiptEvent
  | { deletion: EbayAccountDeletion }
  | {
      threshold: {
        environment: Parameters<typeof recordBulkDataThreshold>[1];
        data: Parameters<typeof recordBulkDataThreshold>[2];
      };
    }
  | null
> {
  const ebayEnvironment = ebayEnvironmentOf(path);
  const { topic, notification } = await verifyEbayNotification(
    body,
    request.headers.get("x-ebay-signature"),
    env,
    ebayEnvironment,
    fetcher,
    now.getTime(),
  );
  if (topic === "BULK_DATA_TRANSFER_THRESHOLD")
    return { threshold: { environment: ebayEnvironment, data: notification.data } };
  if (topic === "MARKETPLACE_ACCOUNT_DELETION") {
    const { userId, eiasToken, username } = notification.data;
    return {
      deletion: {
        environment: ebayEnvironment,
        userId,
        eiasToken: eiasToken ?? null,
        username: username ?? null,
        eventAt: new Date(notification.eventDate).toISOString(),
      },
    };
  }
  const event = {
    ...noProviderFields,
    provider: "ebay" as const,
    environment: ebayEnvironment,
    provider_id: notification.notificationId,
    topic,
  };
  if (topic === "AUTHORIZATION_REVOCATION") {
    const { userId, revocationDate } = notification.data;
    // Una consegna di prova senza venditore non ha effetti.
    if (!userId) return null;
    return {
      ...event,
      object_id: userId,
      store_id: userId,
      event_at: new Date(revocationDate ?? notification.eventDate).toISOString(),
    };
  }
  // L'acquisizione periodica resta la fonte.
  if (!notification.data.user) return null;
  return {
    ...event,
    object_id: notification.data.order.orderId,
    store_id: notification.data.user.userId,
    event_at: new Date(notification.eventDate).toISOString(),
  };
}

/** null lascia la richiesta al router; le callback OAuth non sono webhook. */
export async function receiveWebhook(
  request: Request,
  env: Env,
  fetcher = fetch,
  now = new Date(),
): Promise<Response | null> {
  const path = new URL(request.url).pathname;
  if (!isWebhookPath(path)) return null;
  // Stripe e Telegram consegnano soltanto con POST; eBay verifica l'endpoint con un GET.
  const postOnly = path === "/webhooks/stripe" || path === "/webhooks/telegram";
  if (request.method === "GET" && !postOnly) {
    const challenge = new URL(request.url).searchParams.get("challenge_code");
    const token = env.EBAY_NOTIFICATION_VERIFICATION_TOKEN;
    if (!token || !/^[a-zA-Z0-9_-]{32,80}$/u.test(token))
      return new Response(null, { status: 503 });
    if (!ebayEnvironmentAvailable(env, ebayEnvironmentOf(path)))
      return new Response(null, { status: 503 });
    if (!challenge || challenge.length > 256) return new Response(null, { status: 400 });
    return Response.json({
      challengeResponse: createHash("sha256")
        .update(challenge + token + env.APP_ORIGIN + path)
        .digest("hex"),
    });
  }
  if (request.method !== "POST")
    return new Response(null, {
      status: 405,
      headers: { allow: postOnly ? "POST" : "GET, POST" },
    });
  try {
    // Prima di leggere il corpo e di cercare la chiave pubblica: una sola origine non esaurisce
    // le risorse dell'ingresso eBay.
    if (!postOnly) admitOrigin(request.headers.get("cf-connecting-ip") ?? "", now.getTime());
    const body = await rawBody(request);
    let event: Awaited<ReturnType<typeof ebayEvent>>;
    try {
      event =
        path === "/webhooks/stripe"
          ? await stripeEvent(request, body, env)
          : path === "/webhooks/telegram"
            ? telegramEvent(request, body, env, now)
            : await ebayEvent(request, body, env, path, fetcher, now);
    } catch (error) {
      if (
        error instanceof InvalidWebhook ||
        error instanceof UpstreamError ||
        error instanceof NotificationLimit
      )
        throw error;
      if (error instanceof TelegramSecretMismatch) throw new InvalidWebhook(401);
      throw new InvalidWebhook(412);
    }
    if (!event) return new Response(null, { status: 204 });
    if ("threshold" in event) {
      await recordBulkDataThreshold(env.DB, event.threshold.environment, event.threshold.data, now);
      return new Response(null, { status: 204 });
    }
    if ("deletion" in event) {
      // Registrata e accodata prima della risposta positiva: un errore risponde 503 ed eBay ritenta.
      await recordEbayAccountDeletion(env, event.deletion, now);
      return new Response(null, { status: 204 });
    }
    if (event.provider === "ebay") {
      const store =
        await env.DB.prepare(`SELECT s.id, c.granted_at FROM ebay_stores s JOIN ebay_store_credentials c ON c.store_id = s.id
        WHERE s.ebay_account_id = ? AND s.ebay_environment = ? AND s.disconnected_at IS NULL AND c.rejected_at IS NULL`)
          .bind(event.store_id, event.environment)
          .first<{ id: string; granted_at: string }>();
      // Un evento senza negozio attivo, o precedente al consenso corrente, non ha effetti: la
      // sottoscrizione di un venditore scollegato può consegnare ancora, e un rifiuto farebbe
      // ritentare eBay. La lettura periodica resta la fonte degli ordini.
      if (!store || Date.parse(event.event_at) < Date.parse(store.granted_at))
        return new Response(null, { status: 204 });
      event.store_id = store.id;
      event.consent_granted_at = store.granted_at;
    }
    const age = now.getTime() - Date.parse(event.event_at);
    // Una revoca del consenso vale anche consegnata in ritardo: la ricevuta scade sette giorni
    // dopo l'arrivo invece che dopo l'evento.
    const late = event.topic === "AUTHORIZATION_REVOCATION" && age >= retention;
    if ((age >= retention && !late) || age < -300_000) throw new InvalidWebhook(400);
    // Una chat che scrive troppo in fretta non accoda altro lavoro: il resto si ignora. Il
    // conteggio e la ricevuta sono la stessa istruzione, così aggiornamenti simultanei non
    // superano il limite.
    const receipt = await env.DB.prepare(`INSERT INTO webhook_receipts
      (id, provider, environment, provider_id, topic, object_id, store_id, consent_granted_at,
        link_token_hash, command, callback_id, message_id, event_at, expires_at)
      SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14
      WHERE ?2 <> 'telegram' OR (SELECT count(*) FROM webhook_receipts
        WHERE provider = 'telegram' AND environment = ?3 AND object_id = ?6 AND event_at > ?15) < ?16
      ON CONFLICT(provider, environment, provider_id) DO UPDATE SET id = webhook_receipts.id
      RETURNING *`)
      .bind(
        crypto.randomUUID(),
        event.provider,
        event.environment,
        event.provider_id,
        event.topic,
        event.object_id,
        event.store_id,
        event.consent_granted_at,
        event.link_token_hash,
        event.command,
        event.callback_id,
        event.message_id,
        event.event_at,
        new Date((late ? now.getTime() : Date.parse(event.event_at)) + retention).toISOString(),
        new Date(now.getTime() - 60_000).toISOString(),
        chatUpdatesPerMinute,
      )
      .first<Receipt>();
    if (!receipt) {
      // Il tocco ignorato chiude comunque l'attesa del pulsante, senza avviso.
      if (event.callback_id)
        await answerCallback(env, event.callback_id, undefined, fetcher).catch(() => undefined);
      return new Response(null, { status: 204 });
    }
    // Un ID riusato con altro contenuto non modifica il lavoro già verificato.
    if (
      receipt.topic !== event.topic ||
      receipt.object_id !== event.object_id ||
      receipt.store_id !== event.store_id ||
      receipt.consent_granted_at !== event.consent_granted_at ||
      receipt.link_token_hash !== event.link_token_hash ||
      receipt.command !== event.command ||
      receipt.callback_id !== event.callback_id ||
      receipt.message_id !== event.message_id ||
      // Il tocco su un pulsante prende la data dalla ricezione, che un nuovo tentativo cambia.
      (!event.callback_id && receipt.event_at !== event.event_at)
    )
      throw new InvalidWebhook(409);
    if (!receipt.queued_at && !receipt.completed_at) {
      // Soltanto il bot ha aggiornamenti interattivi: gli argomenti di eBay e Stripe non sono qui.
      const answered =
        interactiveTopics.has(receipt.topic) && (await consumeNow(env, receipt.id, fetcher, now));
      if (!answered) await enqueueReceipt(env, receipt.id, now);
    }
    return new Response(null, { status: 204 });
  } catch (error) {
    const status =
      error instanceof InvalidWebhook
        ? error.status
        : error instanceof NotificationLimit
          ? 429
          : 503;
    if (status === 503) logFailure({ error, operation: "webhook_ingress" });
    return new Response(null, { status });
  }
}

/**
 * Aggiornamenti del bot a cui risponde chi scrive: la coda aggiungerebbe da pochi decimi a
 * diversi secondi prima della risposta.
 */
const interactiveTopics = new Set(["start", "command", "callback", "owner", "owner_callback"]);

/**
 * Esegue subito la ricevuta, con lo stesso lease del consumer. False se non si è completata:
 * allora la ricevuta passa alla coda come le altre, e un'interruzione la lascia al recupero.
 */
async function consumeNow(env: Env, receiptId: string, fetcher: typeof fetch, now: Date) {
  let done = false;
  const message = {
    id: receiptId,
    timestamp: now,
    body: { receiptId },
    attempts: 1,
    ack: () => {
      done = true;
    },
    // Un nuovo tentativo lascia `done` falso: la ricevuta passa alla coda.
    retry: () => {},
  } satisfies Message<unknown>;
  await consumeWebhooks({ messages: [message] }, env, fetcher, now);
  return done;
}

/** Aggiornamenti accettati per chat in un minuto: oltre, il bot non risponde. */
const chatUpdatesPerMinute = 20;

async function enqueueReceipt(env: Env, receiptId: string, now: Date) {
  await env.WORK_QUEUE.send({ receiptId });
  await env.DB.prepare("UPDATE webhook_receipts SET queued_at = ? WHERE id = ?")
    .bind(now.toISOString(), receiptId)
    .run();
}

// Una ricevuta accodata da oltre un giorno e non completata ha perso il messaggio: retry e
// attese del provider si esauriscono prima, e resta la DLQ o la scadenza della coda.
const lostMilliseconds = dayMilliseconds;

/**
 * Riprende la finestra fra claim D1 e accettazione Queue, anche senza retry provider, e le
 * ricevute accettate il cui messaggio è andato perso. La ricevuta non scaduta è il checkpoint:
 * il consumer rivalida consenso, ambiente e finestra prima di ogni effetto.
 */
export async function recoverWebhookIngress(env: Env, now = new Date()) {
  const { results } = await env.DB.prepare(`SELECT id FROM webhook_receipts
    WHERE completed_at IS NULL AND expires_at > ?1
      AND (queued_at IS NULL OR queued_at <= ?2) AND (locked_until IS NULL OR locked_until <= ?1)
    ORDER BY event_at LIMIT 25`)
    .bind(now.toISOString(), new Date(now.getTime() - lostMilliseconds).toISOString())
    .all<{ id: string }>();
  // In sequenza: se Queue non accetta, il recupero si ferma senza altri invii destinati a fallire.
  await inSequence(results, (receipt) => enqueueReceipt(env, receipt.id, now));
}

/**
 * Ripresa chiesta dalla console per le ricevute in ritardo di un provider, senza aspettare il
 * giorno del recupero automatico. Come il cron non tocca quelle prese da un consumer e riaccoda
 * al massimo 25 ricevute; restituisce quante ne ha riaccodate.
 */
export async function resumeStalledReceipts(
  env: Env,
  provider: "ebay" | "stripe" | "telegram",
  now = new Date(),
) {
  const { results } = await env.DB.prepare(`SELECT id FROM webhook_receipts
    WHERE provider = ?3 AND completed_at IS NULL AND expires_at > ?1
      AND COALESCE(queued_at, event_at) <= ?2 AND (locked_until IS NULL OR locked_until <= ?1)
    ORDER BY event_at LIMIT 25`)
    .bind(
      now.toISOString(),
      new Date(now.getTime() - stalledReceiptMilliseconds).toISOString(),
      provider,
    )
    .all<{ id: string }>();
  await inSequence(results, (receipt) => enqueueReceipt(env, receipt.id, now));
  return results.length;
}

export async function consumeWebhooks(
  batch: Pick<MessageBatch<unknown>, "messages">,
  env: Env,
  fetcher = fetch,
  now = new Date(),
) {
  for (const message of batch.messages) {
    let receiptId: string | undefined;
    const lease = crypto.randomUUID();
    try {
      receiptId = referenceSchema.parse(message.body).receiptId;
      const receipt = await env.DB.prepare(`UPDATE webhook_receipts SET lease = ?, locked_until = ?
        WHERE id = ? AND completed_at IS NULL AND expires_at > ? AND (locked_until IS NULL OR locked_until <= ?)
        RETURNING *`)
        .bind(
          lease,
          new Date(now.getTime() + 15 * 60_000).toISOString(),
          receiptId,
          now.toISOString(),
          now.toISOString(),
        )
        .first<Receipt>();
      if (!receipt) {
        const pending = await env.DB.prepare(
          "SELECT 1 FROM webhook_receipts WHERE id = ? AND completed_at IS NULL AND expires_at > ?",
        )
          .bind(receiptId, now.toISOString())
          .first();
        if (pending) message.retry({ delaySeconds: 60 });
        else message.ack();
        continue;
      }
      if (receipt.provider === "ebay" && receipt.topic === "AUTHORIZATION_REVOCATION") {
        // Come un rinnovo rifiutato: il negozio va ricollegato e i dati restano consultabili.
        await rejectCredentials(env.DB, receipt.store_id!, receipt.consent_granted_at!, now);
      } else if (receipt.provider === "ebay") {
        await consumeOrderConfirmation(
          env,
          {
            storeId: receipt.store_id!,
            grantedAt: receipt.consent_granted_at!,
            environment: receipt.environment,
            orderId: receipt.object_id,
            eventAt: receipt.event_at,
          },
          fetcher,
          now,
        );
      } else if (receipt.provider === "telegram" && receipt.topic.startsWith("owner")) {
        // I comandi dell'owner hanno un percorso proprio, separato da quello dei venditori.
        await consumeOwnerUpdate(
          env,
          {
            topic: receipt.topic,
            chatId: receipt.object_id,
            command: receipt.command,
            callbackId: receipt.callback_id,
            messageId: receipt.message_id,
          },
          fetcher,
          now,
        );
      } else if (receipt.provider === "telegram") {
        await consumeTelegramUpdate(
          env,
          {
            receiptId: receipt.id,
            topic: receipt.topic,
            chatId: receipt.object_id,
            tokenHash: receipt.link_token_hash,
            command: receipt.command,
            callbackId: receipt.callback_id,
            messageId: receipt.message_id,
            eventAt: receipt.event_at,
          },
          fetcher,
          now,
        );
      } else {
        // Il payload non è conservato: l'effetto viene dallo stato corrente riletto da Stripe.
        await applyStripeEvent(
          env,
          { topic: receipt.topic, objectId: receipt.object_id },
          fetcher,
          now,
        );
      }
      await env.DB.prepare(
        "UPDATE webhook_receipts SET completed_at = ?, lease = NULL, locked_until = NULL WHERE id = ? AND lease = ?",
      )
        .bind(now.toISOString(), receiptId, lease)
        .run();
      message.ack();
    } catch (error) {
      if (receiptId)
        await env.DB.prepare(
          "UPDATE webhook_receipts SET lease = NULL, locked_until = NULL WHERE id = ? AND lease = ?",
        )
          .bind(receiptId, lease)
          .run()
          .catch((cleanup: unknown) =>
            logFailure({ error: cleanup, operation: "webhook_consumer" }),
          );
      const delay = error instanceof UpstreamError ? error.details.retryAfter : undefined;
      message.retry({
        delaySeconds: Math.min(43_200, delay ?? queueRetryDelay(message.attempts)),
      });
      logFailure({ error, operation: "webhook_consumer" });
    }
  }
}
