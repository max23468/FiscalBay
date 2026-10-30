import { verify } from "node:crypto";
import { z } from "zod";
import { ApplicationError } from "../../errors";
import { upstreamJson } from "../http.server";
import type { EbayEnvironment } from "../../view-models";
import { applicationToken, ebayConfiguration } from "./environment.server";

const identifier = z.string().min(1).max(256);
const encodedSignature = z.string().min(1).max(2048);
// Le notifiche della Notification API firmano con SHA-256, quelle della cancellazione account
// con SHA-1, come il SDK ufficiale di eBay: vale il digest dichiarato da eBay per la chiave.
const digestSchema = z
  .enum(["SHA256", "sha256", "SHA1", "sha1"])
  .transform((value) => (value === "SHA1" || value === "sha1" ? "sha1" : "sha256"));
const headerSchema = z.object({
  kid: identifier,
  signature: z.string().min(1).max(512),
  alg: z.enum(["ECDSA", "ecdsa"]),
  digest: digestSchema,
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
// La consegna di prova può portare valori segnaposto: un identificativo vuoto vale come assente
// e una data della revoca illeggibile lascia la data dell'evento.
const authorizationRevocationSchema = z.object({
  metadata: metadata("AUTHORIZATION_REVOCATION"),
  notification: z.object({
    ...notificationFields,
    data: z.object({
      userId: identifier.optional().catch(undefined),
      revocationDate: z.iso.datetime({ offset: true }).optional().catch(undefined),
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
// Cancellazione di un account eBay (Marketplace Account Deletion), inviata per ogni utente eBay
// eliminato, venditore o acquirente: `userId` immutabile, token eIAS e username.
const marketplaceAccountDeletionSchema = z.object({
  metadata: metadata("MARKETPLACE_ACCOUNT_DELETION"),
  notification: z.object({
    ...notificationFields,
    data: z.object({
      userId: identifier,
      eiasToken: identifier.optional(),
      username: identifier.optional(),
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
  marketplaceAccountDeletionSchema.transform(byTopic),
]);

export type EbayNotification = z.infer<typeof notificationSchema>;

// Cache e budget limitati per isolate: un header non autenticato non può far crescere
// la memoria o provocare recuperi illimitati di chiavi. Nessun URL arriva dal payload.
const keys = new Map<string, { key: string; digest: "sha1" | "sha256" | null; until: number }>();
let windowStart = 0;
let lookups = 0;

export class NotificationLimit extends Error {}

/**
 * Consegna rifiutata con 412, con il solo motivo per il log: intestazione della firma, firma o
 * schema del corpo. Nessun valore della consegna entra nell'errore.
 */
export class NotificationRejected extends ApplicationError {
  constructor(readonly failure: "header" | "signature" | "schema") {
    super("INVALID_REQUEST");
  }
}

/** Consegne accettate per origine in un minuto, prima di ogni verifica. */
const originRequestsPerMinute = 600;
/** Origini seguite per isolate: oltre, la meno recente esce dal conteggio. */
const trackedOrigins = 1000;
const origins = new Map<string, { start: number; count: number }>();

/**
 * Limite di consegne per origine, con memoria limitata: oltre il limite l'ingresso risponde
 * 429 prima di leggere il corpo, ed eBay ritenta la consegna.
 */
export function admitOrigin(origin: string, now: number): void {
  let window = origins.get(origin);
  if (!window || now - window.start >= 60_000) {
    origins.delete(origin);
    if (origins.size >= trackedOrigins) origins.delete(origins.keys().next().value!);
    window = { start: now, count: 0 };
    origins.set(origin, window);
  }
  if (window.count >= originRequestsPerMinute) throw new NotificationLimit();
  window.count += 1;
}

/** Notifica eBay con firma verificata, di uno dei topic gestiti. */
export async function verifyEbayNotification(
  body: string,
  signature: string | null,
  env: Env,
  ebayEnvironment: EbayEnvironment,
  fetcher: typeof fetch,
  now: number,
): Promise<EbayNotification> {
  let header: z.infer<typeof headerSchema>;
  try {
    header = headerSchema.parse(JSON.parse(atob(encodedSignature.parse(signature))));
  } catch {
    throw new NotificationRejected("header");
  }
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
      z.object({ key: z.string().min(1).max(4096), digest: digestSchema.optional() }),
      { headers: { authorization: `Bearer ${token}` } },
      { maxBytes: 8192 },
    );
    publicKey = {
      key: key.key
        .replace("-----BEGIN PUBLIC KEY-----", "-----BEGIN PUBLIC KEY-----\n")
        .replace("-----END PUBLIC KEY-----", "\n-----END PUBLIC KEY-----"),
      digest: key.digest ?? null,
      until: now + 3_600_000,
    };
    if (keys.size >= 100) keys.delete(keys.keys().next().value!);
    keys.set(cacheId, publicKey);
  }
  // Un header che dichiara un digest diverso da quello della chiave non vale.
  if (publicKey.digest && publicKey.digest !== header.digest)
    throw new NotificationRejected("signature");
  if (
    !verify(
      header.digest,
      Buffer.from(body),
      publicKey.key,
      Buffer.from(header.signature, "base64"),
    )
  )
    throw new NotificationRejected("signature");
  try {
    return notificationSchema.parse(JSON.parse(body));
  } catch {
    throw new NotificationRejected("schema");
  }
}
