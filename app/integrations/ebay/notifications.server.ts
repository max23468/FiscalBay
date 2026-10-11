import { verify } from "node:crypto";
import { z } from "zod";
import { upstreamJson } from "../http.server";
import { ebayConfiguration, type EbayEnvironment } from "./environment.server";

const identifier = z.string().min(1).max(256);
const encodedSignature = z.string().min(1).max(2048);
const headerSchema = z.object({
  kid: identifier,
  signature: z.string().min(1).max(512),
  alg: z.enum(["ECDSA", "ecdsa"]),
  digest: z.literal("SHA1"),
});
const notificationSchema = z.object({
  metadata: z.object({ topic: z.literal("ORDER_CONFIRMATION"), schemaVersion: z.literal("1.0") }),
  notification: z.object({
    notificationId: identifier,
    eventDate: z.iso.datetime(),
    data: z.object({
      user: z.object({ userId: identifier }),
      order: z.object({ orderId: identifier }),
    }),
  }),
});

// Cache e budget limitati per isolate: un header non autenticato non può far crescere
// la memoria o provocare recuperi illimitati di chiavi. Nessun URL arriva dal payload.
const keys = new Map<string, { key: string; until: number }>();
let windowStart = 0;
let lookups = 0;

export class NotificationLimit extends Error {}

export async function verifyOrderNotification(
  body: string,
  signature: string | null,
  environment: Env,
  ebayEnvironment: EbayEnvironment,
  fetcher: typeof fetch,
  now: number,
) {
  const header = headerSchema.parse(JSON.parse(atob(encodedSignature.parse(signature))));
  const configuration = ebayConfiguration(environment, ebayEnvironment);
  const cacheId = `${configuration.clientId}:${ebayEnvironment}:${header.kid}`;
  let publicKey = keys.get(cacheId);
  if (!publicKey || publicKey.until <= now) {
    if (now - windowStart >= 60_000) {
      windowStart = now;
      lookups = 0;
    }
    if (lookups >= 10) throw new NotificationLimit();
    lookups += 1;
    const token = await upstreamJson(
      fetcher,
      configuration.tokenUrl,
      z.object({ access_token: z.string().min(1).max(8192) }),
      {
        method: "POST",
        headers: {
          authorization: `Basic ${btoa(`${configuration.clientId}:${configuration.clientSecret}`)}`,
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          scope: "https://api.ebay.com/oauth/api_scope",
        }),
      },
      { maxBytes: 16_384 },
    );
    const key = await upstreamJson(
      fetcher,
      `${configuration.apiOrigin}/commerce/notification/v1/public_key/${encodeURIComponent(header.kid)}`,
      z.object({ key: z.string().min(1).max(4096) }),
      { headers: { authorization: `Bearer ${token.access_token}` } },
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
  if (!verify("sha1", Buffer.from(body), publicKey.key, Buffer.from(header.signature, "base64")))
    throw new Error();
  return notificationSchema.parse(JSON.parse(body)).notification;
}
