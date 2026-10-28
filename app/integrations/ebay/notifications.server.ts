import { verify } from "node:crypto";
import { z } from "zod";
import { upstreamJson } from "../http.server";
import type { EbayEnvironment } from "../../view-models";
import { applicationToken, ebayConfiguration } from "./environment.server";

const identifier = z.string().min(1).max(256);
const encodedSignature = z.string().min(1).max(2048);
const headerSchema = z.object({
  kid: identifier,
  signature: z.string().min(1).max(512),
  alg: z.enum(["ECDSA", "ecdsa"]),
  digest: z.enum(["SHA256", "sha256"]),
});
const notificationFields = { notificationId: identifier, eventDate: z.iso.datetime() };
const metadata = <Topic extends string>(topic: Topic) =>
  z.object({ topic: z.literal(topic), schemaVersion: z.literal("1.0") });
const orderConfirmationSchema = z.object({
  metadata: metadata("ORDER_CONFIRMATION"),
  notification: z.object({
    ...notificationFields,
    data: z.object({
      // Le consegne di prova eBay non indicano il venditore.
      user: z.object({ userId: identifier }).optional(),
      order: z.object({ orderId: identifier }),
    }),
  }),
});
// Revoca del consenso, una sottoscrizione per l'applicazione: `userId` è lo stesso
// identificativo immutabile di `ORDER_CONFIRMATION`. Username, motivo e token legacy non servono.
const authorizationRevocationSchema = z.object({
  metadata: metadata("AUTHORIZATION_REVOCATION"),
  notification: z.object({
    ...notificationFields,
    data: z.object({
      userId: identifier.optional(),
      revocationDate: z.iso.datetime().optional(),
    }),
  }),
});
// Soglia della Bulk Data Transfer Policy raggiunta dall'applicazione: metriche aggregate per
// categoria di dati, nessun dato di negozi o acquirenti.
const bulkDataTransferThresholdSchema = z.object({
  metadata: metadata("BULK_DATA_TRANSFER_THRESHOLD"),
  notification: z.object({
    ...notificationFields,
    data: z.object({
      policyFramework: z.string().min(1).max(64),
      policyVersion: z.string().max(32).optional(),
      region: z.string().min(1).max(16),
      window: z.object({
        aggregationWindowStart: z.iso.datetime(),
        aggregationWindowEnd: z.iso.datetime(),
      }),
      metricData: z
        .array(
          z.object({
            metricDataType: z.string().min(1).max(128),
            thresholdStatus: z.enum(["WARNING", "REACHED"]),
            thresholdPercentage: z.number().nonnegative(),
            thresholdLimit: z.number().int().nonnegative(),
            currentCount: z.number().int().nonnegative(),
          }),
        )
        .min(1)
        .max(50),
    }),
  }),
});
/** Topic e notifica, distinti per tipo: il chiamante riconosce i dati dal topic. */
const byTopic = <Topic extends string, Notification>(value: {
  metadata: { topic: Topic };
  notification: Notification;
}) => ({ topic: value.metadata.topic, notification: value.notification });
const notificationSchema = z.union([
  orderConfirmationSchema.transform(byTopic),
  authorizationRevocationSchema.transform(byTopic),
  bulkDataTransferThresholdSchema.transform(byTopic),
]);

export type EbayNotification = z.infer<typeof notificationSchema>;

// Cache e budget limitati per isolate: un header non autenticato non può far crescere
// la memoria o provocare recuperi illimitati di chiavi. Nessun URL arriva dal payload.
const keys = new Map<string, { key: string; until: number }>();
let windowStart = 0;
let lookups = 0;

export class NotificationLimit extends Error {}

/** Notifica eBay con firma verificata, di uno dei topic gestiti. */
export async function verifyEbayNotification(
  body: string,
  signature: string | null,
  env: Env,
  ebayEnvironment: EbayEnvironment,
  fetcher: typeof fetch,
  now: number,
): Promise<EbayNotification> {
  const header = headerSchema.parse(JSON.parse(atob(encodedSignature.parse(signature))));
  const configuration = ebayConfiguration(env, ebayEnvironment);
  const cacheId = `${configuration.clientId}:${ebayEnvironment}:${header.kid}`;
  let publicKey = keys.get(cacheId);
  if (!publicKey || publicKey.until <= now) {
    if (now - windowStart >= 60_000) {
      windowStart = now;
      lookups = 0;
    }
    if (lookups >= 10) throw new NotificationLimit();
    lookups += 1;
    const token = await applicationToken(configuration, fetcher);
    const key = await upstreamJson(
      fetcher,
      `${configuration.apiOrigin}/commerce/notification/v1/public_key/${encodeURIComponent(header.kid)}`,
      z.object({ key: z.string().min(1).max(4096) }),
      { headers: { authorization: `Bearer ${token}` } },
      { maxBytes: 8192 },
    );
    publicKey = {
      key: key.key
        .replace("-----BEGIN PUBLIC KEY-----", "-----BEGIN PUBLIC KEY-----\n")
        .replace("-----END PUBLIC KEY-----", "\n-----END PUBLIC KEY-----"),
      until: now + 3_600_000,
    };
    if (keys.size >= 100) keys.delete(keys.keys().next().value!);
    keys.set(cacheId, publicKey);
  }
  if (!verify("sha256", Buffer.from(body), publicKey.key, Buffer.from(header.signature, "base64")))
    throw new Error();
  return notificationSchema.parse(JSON.parse(body));
}
