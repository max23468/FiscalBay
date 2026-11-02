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
  NotificationRejected,
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
import { deliverTelegram } from "./domain/telegram-deliveries.server";
import { isProduction } from "./app-links";
import { logFailure } from "./errors";
import { webhookPaths } from "./webhook-paths";
import { dayMilliseconds } from "./time";
import { queueRetryDelay } from "./domain/work-timing";
import {
  enqueueReceipt,
  eventStore,
  recordReceipt,
  claimReceipt,
  receiptPending,
  completeReceipt,
  releaseReceipt,
  type Receipt,
} from "./domain/webhook-receipts.server";

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
      // Il motivo del rifiuto resta nel log quando l'intestazione della firma è valida: una
      // consegna di eBay rifiutata va distinta dalle sonde, che non lasciano traccia.
      if (error instanceof NotificationRejected && error.failure !== "header")
        logFailure({ error, operation: "webhook_ingress", status: 412 });
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
      const store = await eventStore(env.DB, event.store_id, event.environment);
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
    const receipt = await recordReceipt(
      env.DB,
      event,
      now,
      new Date((late ? now.getTime() : Date.parse(event.event_at)) + retention).toISOString(),
      chatUpdatesPerMinute,
    );
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
      const receipt = await claimReceipt(env.DB, receiptId, lease, now);
      if (!receipt) {
        const pending = await receiptPending(env.DB, receiptId, now);
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
        // L'evento serve alla notifica immediata: come dopo una lettura, le consegne del negozio
        // partono subito con i dati fiscali appena letti.
        await deliverTelegram(env, fetcher, now, { storeId: receipt.store_id! }).catch(
          (error: unknown) => logFailure({ error, operation: "telegram" }),
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
      await completeReceipt(env.DB, receiptId, lease, now);
      message.ack();
    } catch (error) {
      if (receiptId)
        await releaseReceipt(env.DB, receiptId, lease).catch((cleanup: unknown) =>
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
