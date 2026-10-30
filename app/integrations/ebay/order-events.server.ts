import { z } from "zod";

import { isProduction } from "../../app-links";
import { measure } from "../../observability.server";
import type { EbayEnvironment } from "../../view-models";
import { readUpstream, UpstreamError, type StatusClassifier } from "../http.server";
import { applicationToken, type EbayAccess, type EbayConfiguration } from "./environment.server";

/**
 * Sottoscrizione `ORDER_CONFIRMATION` del venditore (D235). Il topic è dell'utente: si crea con
 * il suo token, che deve portare `commerce.notification.subscription` oltre alla lettura degli
 * ordini, verso la destinazione dell'applicazione registrata sull'ingresso dell'ambiente.
 * eBay ammette una sola sottoscrizione per venditore e topic, anche fra test e Production che
 * condividono il keyset: soltanto la Production la sposta su di sé.
 */
const topicId = "ORDER_CONFIRMATION";
// L'ingresso legge la versione 1.0 dello schema.
const schemaVersion = "1.0";

export type OrderEventsOutcome = "subscribed" | "unauthorized" | "elsewhere";

const destinationsSchema = z.object({
  destinations: z
    .array(
      z.looseObject({
        destinationId: z.string().min(1).max(256),
        status: z.string().max(32).optional(),
        deliveryConfig: z.looseObject({ endpoint: z.string().max(2048).optional() }).optional(),
      }),
    )
    .max(100)
    .optional(),
});
const subscriptionsSchema = z.object({
  subscriptions: z
    .array(
      z.looseObject({
        subscriptionId: z.string().min(1).max(256),
        topicId: z.string().max(128),
        status: z.string().max(32).optional(),
        destinationId: z.string().max(256).optional(),
      }),
    )
    .max(100)
    .optional(),
});

type Subscription = NonNullable<z.infer<typeof subscriptionsSchema>["subscriptions"]>[number];

/** Ingresso eBay dell'ambiente servito: la Sandbox ha il proprio percorso. */
export function orderEventsEndpoint(env: { APP_ORIGIN: string }, environment: EbayEnvironment) {
  return `${new URL(env.APP_ORIGIN).origin}/webhooks/ebay${environment === "sandbox" ? "/sandbox" : ""}`;
}

/** Chiamata alla Notification API, misurata come le altre richieste a eBay. */
function notificationCall(
  fetcher: typeof fetch,
  configuration: EbayConfiguration,
  token: string,
  method: string,
  resource: string,
  body?: unknown,
  classify?: StatusClassifier,
) {
  return measure("ebay", "request", () =>
    readUpstream(
      fetcher,
      `${configuration.apiOrigin}/commerce/notification/v1/${resource}`,
      {
        method,
        headers: {
          authorization: `Bearer ${token}`,
          ...(body ? { "content-type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      },
      { maxBytes: 65_536 },
      classify,
    ),
  );
}

function parse<Schema extends z.ZodType>(schema: Schema, text: string): z.infer<Schema> {
  try {
    return schema.parse(JSON.parse(text));
  } catch {
    throw new UpstreamError("invalid_response");
  }
}

/**
 * Destinazione dell'applicazione sull'ingresso dell'ambiente, letta con il token
 * dell'applicazione; null se non è registrata o non è abilitata.
 */
export async function orderEventsDestination(
  env: { APP_ORIGIN: string },
  environment: EbayEnvironment,
  configuration: EbayConfiguration,
  fetcher: typeof fetch,
): Promise<string | null> {
  const token = await applicationToken(configuration, fetcher);
  const { text } = await notificationCall(
    fetcher,
    configuration,
    token,
    "GET",
    "destination?limit=100",
  );
  const endpoint = orderEventsEndpoint(env, environment);
  const destination = parse(destinationsSchema, text).destinations?.find(
    (item) => item.deliveryConfig?.endpoint === endpoint && item.status === "ENABLED",
  );
  return destination?.destinationId ?? null;
}

/** Sottoscrizione `ORDER_CONFIRMATION` del venditore, letta con il suo token. */
async function sellerSubscription(access: EbayAccess): Promise<Subscription | null> {
  const { text } = await notificationCall(
    access.fetcher,
    access.configuration,
    access.accessToken,
    "GET",
    "subscription?limit=100",
  );
  return (
    parse(subscriptionsSchema, text).subscriptions?.find((item) => item.topicId === topicId) ?? null
  );
}

// Sottoscrizione già esistente (409) o consenso senza lo scope delle notifiche (403): esiti
// attesi, distinti dagli errori del provider.
const expectedRefusals: StatusClassifier = (response) =>
  response.status === 409 || response.status === 403 || response.ok
    ? null
    : new UpstreamError(
        response.status === 401
          ? "credentials"
          : response.status === 429
            ? "rate_limited"
            : response.status >= 500
              ? "unavailable"
              : "rejected",
        { status: response.status },
      );

/**
 * Sottoscrive il venditore all'ingresso dell'ambiente. Una sottoscrizione già esistente si
 * rilegge: spenta si riaccende, su un'altra destinazione si sposta soltanto in Production.
 * Un consenso senza lo scope delle notifiche, precedente a D235, dà `unauthorized`.
 */
export async function subscribeOrderEvents(
  env: { APP_ORIGIN: string },
  access: EbayAccess,
  destinationId: string,
): Promise<OrderEventsOutcome> {
  const payload = { format: "JSON", schemaVersion, deliveryProtocol: "HTTPS" };
  const created = await notificationCall(
    access.fetcher,
    access.configuration,
    access.accessToken,
    "POST",
    "subscription",
    { topicId, destinationId, payload, status: "ENABLED" },
    expectedRefusals,
  );
  if (created.status === 403) return "unauthorized";
  if (created.status !== 409) return "subscribed";
  const existing = await sellerSubscription(access);
  if (!existing) throw new UpstreamError("invalid_response");
  const id = encodeURIComponent(existing.subscriptionId);
  if (existing.destinationId === destinationId) {
    if (existing.status !== "ENABLED")
      await notificationCall(
        access.fetcher,
        access.configuration,
        access.accessToken,
        "POST",
        `subscription/${id}/enable`,
      );
    return "subscribed";
  }
  if (!isProduction(env)) return "elsewhere";
  await notificationCall(
    access.fetcher,
    access.configuration,
    access.accessToken,
    "PUT",
    `subscription/${id}`,
    { destinationId, payload, status: "ENABLED" },
  );
  return "subscribed";
}

/**
 * Elimina la sottoscrizione del venditore quando punta all'ingresso dell'ambiente: una
 * sottoscrizione spostata altrove appartiene all'altro ambiente e resta.
 */
export async function unsubscribeOrderEvents(
  access: EbayAccess,
  destinationId: string,
): Promise<boolean> {
  const existing = await sellerSubscription(access);
  if (!existing || existing.destinationId !== destinationId) return false;
  await notificationCall(
    access.fetcher,
    access.configuration,
    access.accessToken,
    "DELETE",
    `subscription/${encodeURIComponent(existing.subscriptionId)}`,
  );
  return true;
}
