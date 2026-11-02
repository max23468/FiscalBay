import { inSequence } from "../sequence";
import { dayMilliseconds } from "../time";
import { stalledReceiptMilliseconds } from "./work-timing";

export type Receipt = {
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

export function eventStore(db: D1Database, externalId: string | null, environment: string) {
  return db
    .prepare(`SELECT s.id, c.granted_at FROM ebay_stores s JOIN ebay_store_credentials c ON c.store_id = s.id
    WHERE s.ebay_account_id = ? AND s.ebay_environment = ? AND s.disconnected_at IS NULL AND c.rejected_at IS NULL`)
    .bind(externalId, environment)
    .first<{ id: string; granted_at: string }>();
}

/** Deduplica e limite della chat sono verificati dalla stessa istruzione. */
export function recordReceipt(
  db: D1Database,
  event: Omit<Receipt, "id" | "queued_at" | "completed_at">,
  now: Date,
  expiresAt: string,
  chatLimit: number,
) {
  return db
    .prepare(`INSERT INTO webhook_receipts
    (id, provider, environment, provider_id, topic, object_id, store_id, consent_granted_at,
      link_token_hash, command, callback_id, message_id, event_at, expires_at)
    SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14
    WHERE ?2 <> 'telegram' OR (SELECT count(*) FROM webhook_receipts
      WHERE provider = 'telegram' AND environment = ?3 AND object_id = ?6 AND event_at > ?15) < ?16
    ON CONFLICT(provider, environment, provider_id) DO UPDATE SET id = webhook_receipts.id RETURNING *`)
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
      expiresAt,
      new Date(now.getTime() - 60_000).toISOString(),
      chatLimit,
    )
    .first<Receipt>();
}

export function claimReceipt(db: D1Database, id: string, lease: string, now: Date) {
  return db
    .prepare(`UPDATE webhook_receipts SET lease = ?, locked_until = ?
    WHERE id = ? AND completed_at IS NULL AND expires_at > ? AND (locked_until IS NULL OR locked_until <= ?)
    RETURNING *`)
    .bind(
      lease,
      new Date(now.getTime() + 15 * 60_000).toISOString(),
      id,
      now.toISOString(),
      now.toISOString(),
    )
    .first<Receipt>();
}

export function receiptPending(db: D1Database, id: string, now: Date) {
  return db
    .prepare(
      "SELECT 1 FROM webhook_receipts WHERE id = ? AND completed_at IS NULL AND expires_at > ?",
    )
    .bind(id, now.toISOString())
    .first();
}

export function completeReceipt(db: D1Database, id: string, lease: string, now: Date) {
  return db
    .prepare(
      "UPDATE webhook_receipts SET completed_at = ?, lease = NULL, locked_until = NULL WHERE id = ? AND lease = ?",
    )
    .bind(now.toISOString(), id, lease)
    .run();
}

export function releaseReceipt(db: D1Database, id: string, lease: string) {
  return db
    .prepare(
      "UPDATE webhook_receipts SET lease = NULL, locked_until = NULL WHERE id = ? AND lease = ?",
    )
    .bind(id, lease)
    .run();
}

export async function enqueueReceipt(env: Env, receiptId: string, now: Date) {
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
