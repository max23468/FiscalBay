import { z } from "zod";
import { createHash } from "node:crypto";
import { verifyStripeEvent } from "./stripe.server";
import { NotificationLimit, verifyOrderNotification } from "./ebay/notifications.server";
import { readBounded, UpstreamError } from "./http.server";
import { ebayConfiguration } from "./ebay/environment.server";
import { applyStripeEvent } from "../domain/billing.server";
import { consumeOrderConfirmation } from "../domain/order-acquisition.server";
import { isProduction } from "../app-links";
import { logFailure } from "../errors";

const maxBytes = 262_144;
const retention = 7 * 86_400_000;
const referenceSchema = z.object({ receiptId: z.string().uuid() });

/**
 * Messaggio della coda con il riferimento a una ricevuta; il consumer convalida il riferimento e
 * riprova quello malformato.
 */
export function isWebhookMessage(body: unknown): body is { receiptId: string } {
  return z.object({ receiptId: z.string() }).safeParse(body).success;
}
type Receipt = {
  id: string;
  provider: "ebay" | "stripe";
  environment: string;
  provider_id: string;
  topic: string;
  object_id: string;
  store_id: string | null;
  consent_granted_at: string | null;
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

/** null lascia la richiesta al router; le callback OAuth non sono webhook. */
export async function receiveWebhook(
  request: Request,
  env: Env,
  fetcher = fetch,
  now = new Date(),
): Promise<Response | null> {
  const path = new URL(request.url).pathname;
  if (!["/webhooks/ebay", "/webhooks/ebay/sandbox", "/webhooks/stripe"].includes(path)) return null;
  if (request.method === "GET" && path !== "/webhooks/stripe") {
    const challenge = new URL(request.url).searchParams.get("challenge_code");
    const token = env.EBAY_NOTIFICATION_VERIFICATION_TOKEN;
    if (!token || !/^[a-zA-Z0-9_-]{32,80}$/u.test(token))
      return new Response(null, { status: 503 });
    try {
      const ebayEnvironment = path.endsWith("/sandbox")
        ? "sandbox"
        : // Stryker disable next-line StringLiteral: nella sola verifica di disponibilità ogni valore diverso da sandbox seleziona Production.
          "production";
      ebayConfiguration(env, ebayEnvironment);
    } catch {
      return new Response(null, { status: 503 });
    }
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
      headers: { allow: path === "/webhooks/stripe" ? "POST" : "GET, POST" },
    });
  try {
    const body = await rawBody(request);
    let event: Omit<Receipt, "id" | "queued_at" | "completed_at">;
    try {
      if (path === "/webhooks/stripe") {
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
        event = {
          provider: "stripe",
          environment: stripe.livemode ? "live" : "test",
          provider_id: stripe.id,
          topic: stripe.type,
          object_id: object.id,
          store_id: null,
          consent_granted_at: null,
          event_at: new Date(stripe.created * 1000).toISOString(),
        };
      } else {
        const ebayEnvironment = path.endsWith("/sandbox") ? "sandbox" : "production";
        const signature = request.headers.get("x-ebay-signature");
        const notification = await verifyOrderNotification(
          body,
          signature,
          env,
          ebayEnvironment,
          fetcher,
          now.getTime(),
        );
        // Autentica ma non attribuibile: nessun effetto, l'acquisizione periodica resta la fonte.
        if (!notification.data.user) return new Response(null, { status: 204 });
        event = {
          provider: "ebay",
          environment: ebayEnvironment,
          provider_id: notification.notificationId,
          topic: "ORDER_CONFIRMATION",
          object_id: notification.data.order.orderId,
          store_id: notification.data.user.userId,
          consent_granted_at: null,
          event_at: new Date(notification.eventDate).toISOString(),
        };
      }
    } catch (error) {
      if (
        error instanceof InvalidWebhook ||
        error instanceof UpstreamError ||
        error instanceof NotificationLimit
      )
        throw error;
      throw new InvalidWebhook(412);
    }
    if (event.provider === "ebay") {
      const store =
        await env.DB.prepare(`SELECT s.id, c.granted_at FROM ebay_stores s JOIN ebay_store_credentials c ON c.store_id = s.id
        WHERE s.ebay_account_id = ? AND s.ebay_environment = ? AND s.disconnected_at IS NULL AND c.rejected_at IS NULL`)
          .bind(event.store_id, event.environment)
          .first<{ id: string; granted_at: string }>();
      if (!store || Date.parse(event.event_at) < Date.parse(store.granted_at))
        throw new InvalidWebhook(409);
      event.store_id = store.id;
      event.consent_granted_at = store.granted_at;
    }
    const age = now.getTime() - Date.parse(event.event_at);
    if (age >= retention || age < -300_000) throw new InvalidWebhook(400);
    const receipt = (await env.DB.prepare(`INSERT INTO webhook_receipts
      (id, provider, environment, provider_id, topic, object_id, store_id, consent_granted_at, event_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(provider, environment, provider_id) DO UPDATE SET id = webhook_receipts.id
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
        event.event_at,
        new Date(Date.parse(event.event_at) + retention).toISOString(),
      )
      .first<Receipt>())!;
    // Un ID riusato con altro contenuto non modifica il lavoro già verificato.
    if (
      receipt.topic !== event.topic ||
      receipt.object_id !== event.object_id ||
      receipt.store_id !== event.store_id ||
      receipt.consent_granted_at !== event.consent_granted_at ||
      receipt.event_at !== event.event_at
    )
      throw new InvalidWebhook(409);
    if (!receipt.queued_at && !receipt.completed_at) {
      await enqueueReceipt(env, receipt.id, now);
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

async function enqueueReceipt(env: Env, receiptId: string, now: Date) {
  await env.WORK_QUEUE.send({ receiptId });
  await env.DB.prepare("UPDATE webhook_receipts SET queued_at = ? WHERE id = ?")
    .bind(now.toISOString(), receiptId)
    .run();
}

// Una ricevuta accodata da oltre un giorno e non completata ha perso il messaggio: retry e
// attese del provider si esauriscono prima, e resta la DLQ o la scadenza della coda.
const lostMilliseconds = 86_400_000;

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
  await results.reduce<Promise<void>>(
    (previous, receipt) => previous.then(() => enqueueReceipt(env, receipt.id, now)),
    Promise.resolve(),
  );
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
      if (receipt.provider === "ebay") {
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
        delaySeconds: Math.min(43_200, delay ?? Math.min(3600, 30 * 2 ** (message.attempts - 1))),
      });
      logFailure({ error, operation: "webhook_consumer" });
    }
  }
}
