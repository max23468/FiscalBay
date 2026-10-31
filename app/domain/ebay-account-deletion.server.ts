import { z } from "zod";

import { logFailure } from "../errors";
import { inSequence } from "../sequence";
import type { EbayEnvironment } from "../view-models";
import { deletionMarkerDays } from "./account-deletion.server";
import {
  consumeStepJob,
  deleteOrders,
  lockUntil,
  orderBudget,
  resumeBatch,
  runToEnd,
} from "./deletion-steps.server";
import { storeIdentityHash } from "./store-marks.server";

/**
 * Cancellazione richiesta da eBay (Marketplace Account Deletion, §30): eBay la invia per ogni
 * utente eBay eliminato, venditore o acquirente. L'ingresso registra soltanto quelle di un utente
 * di cui FiscalBay conserva dati; il lavoro dalla coda, ripetibile, elimina per il venditore i
 * negozi con ordini, letture, consenso, segni e accesso con eBay, e per l'acquirente i suoi
 * ordini in ogni negozio. Restano i diritti commerciali minimi dello spazio (cicli, quota usata,
 * scelta del negozio Free e trasferimenti), che non contengono l'identità eBay. La richiesta
 * conclusa resta per la finestra di Time Travel, così il compito periodico la ripete se i dati
 * ricompaiono dopo un restore.
 */

/** Identità comunicata da eBay: `userId` immutabile, token eIAS e username. */
export type EbayAccountDeletion = {
  environment: EbayEnvironment;
  userId: string;
  eiasToken: string | null;
  username: string | null;
  eventAt: string;
};

/**
 * Identità del negozio come la conserva `ebay_stores.ebay_user_id`: l'identificativo eBay in
 * Production, l'ambiente con l'identificativo per la Sandbox.
 */
const storeIdentity = (environment: EbayEnvironment, userId: string) =>
  environment === "production" ? userId : JSON.stringify([environment, userId]);

/**
 * Ordini dell'acquirente nell'ambiente: per token eIAS e, per gli ordini che non lo riportano,
 * per username. Parametri: ?1 ambiente, ?2 token eIAS, ?3 username.
 */
const buyerOrdersSql = `SELECT o.id FROM orders o JOIN ebay_stores s ON s.id = o.store_id
  WHERE s.ebay_environment = ?1 AND (o.buyer_eias_token = ?2
    OR (o.buyer_eias_token IS NULL AND json_extract(o.buyer_json, '$.username') = ?3))`;

/**
 * Dati che FiscalBay conserva sull'utente eBay: negozio con la sua identità, segno di un negozio
 * lasciato, accesso con eBay o ordini da acquirente. Parametri: ?1 ambiente, ?2 token eIAS,
 * ?3 username, ?4 identificativo, ?5 impronta del segno.
 */
const knownUserSql = `EXISTS (SELECT 1 FROM ebay_stores WHERE ebay_environment = ?1 AND ebay_account_id = ?4)
  OR EXISTS (SELECT 1 FROM store_identity_marks WHERE identity_hash = ?5)
  OR (?1 = 'production' AND EXISTS (SELECT 1 FROM "account"
    WHERE "providerId" = 'ebay' AND "accountId" = ?4))
  OR EXISTS (${buyerOrdersSql})`;

async function knownUserBindings(secret: string, input: Omit<EbayAccountDeletion, "eventAt">) {
  return [
    input.environment,
    input.eiasToken,
    input.username,
    input.userId,
    await storeIdentityHash(secret, storeIdentity(input.environment, input.userId)),
  ] as const;
}

/**
 * Registra la richiesta e la accoda, se FiscalBay conserva dati dell'utente. False senza dati:
 * la notifica non lascia traccia. Una notifica ripetuta ritrova la richiesta e la riapre se era
 * conclusa. Se la coda non accetta, l'errore passa all'ingresso, che risponde 503 perché eBay
 * ritenti, e la richiesta registrata resta al compito periodico.
 */
export async function recordEbayAccountDeletion(
  env: Pick<Env, "DB" | "WORK_QUEUE" | "BETTER_AUTH_SECRET">,
  input: EbayAccountDeletion,
  now = new Date(),
): Promise<boolean> {
  const row = await env.DB.prepare(`INSERT INTO ebay_account_deletions (id, ebay_environment,
      ebay_user_id, eias_token, username, notified_at, requested_at)
    SELECT ?6, ?1, ?4, ?2, ?3, ?7, ?8 WHERE ${knownUserSql}
    ON CONFLICT(ebay_environment, ebay_user_id) DO UPDATE SET
      eias_token = COALESCE(excluded.eias_token, eias_token),
      username = COALESCE(excluded.username, username), completed_at = NULL
    RETURNING id`)
    .bind(
      ...(await knownUserBindings(env.BETTER_AUTH_SECRET, input)),
      crypto.randomUUID(),
      input.eventAt,
      now.toISOString(),
    )
    .first<{ id: string }>();
  if (!row) return false;
  await env.WORK_QUEUE.send({ ebayAccountDeletion: row.id });
  return true;
}

/**
 * Arresto del negozio del venditore, ripetibile: senza consenso letture e notifiche già
 * accodate non scrivono più, e le ricevute con i suoi ordini si eliminano.
 */
function stopStoreStatements(db: D1Database, storeId: string, at: string) {
  return [
    db.prepare("DELETE FROM ebay_store_credentials WHERE store_id = ?").bind(storeId),
    db.prepare("DELETE FROM webhook_receipts WHERE store_id = ?").bind(storeId),
    db
      .prepare(
        "UPDATE ebay_stores SET disconnected_at = COALESCE(disconnected_at, ?2) WHERE id = ?1",
      )
      .bind(storeId, at),
  ];
}

/**
 * Dopo gli ordini: letture, pause, marker degli ordini, preferenze e consegne Telegram e
 * trasferimenti non eseguiti, poi l'identità eBay della riga. La riga resta senza identità per
 * le righe commerciali dello spazio che la citano; l'eliminazione dei dati revoca i file delle
 * esportazioni dello spazio.
 */
function eraseStoreStatements(db: D1Database, storeId: string, at: string) {
  return [
    ...[
      "DELETE FROM sync_state WHERE store_id = ?",
      "DELETE FROM sync_runs WHERE store_id = ?",
      "DELETE FROM ebay_store_pauses WHERE store_id = ?",
      "DELETE FROM deleted_order_keys WHERE store_id = ?",
      "DELETE FROM telegram_store_preferences WHERE store_id = ?",
      "DELETE FROM telegram_deliveries WHERE store_id = ?",
      "DELETE FROM store_transfers WHERE store_id = ? AND executed_at IS NULL",
    ].map((sql) => db.prepare(sql).bind(storeId)),
    db
      .prepare(`UPDATE ebay_stores SET ebay_user_id = id, ebay_account_id = NULL,
          display_name = NULL, store_name = NULL, store_logo_url = NULL, store_url = NULL,
          feedback_score = NULL, feedback_positive_percent = NULL, top_rated_seller = NULL,
          store_profile_read_at = NULL, data_deleted_at = COALESCE(data_deleted_at, ?2),
          orders_deleted_through = MAX(COALESCE(orders_deleted_through, ?2), ?2)
        WHERE id = ?1`)
      .bind(storeId, at),
  ];
}

export type EbayDeletionOutcome = "done" | "more" | "busy" | "missing";

/**
 * Un passo del lavoro, ripetibile: ogni fase rilegge lo stato corrente e una ripetizione non
 * duplica effetti. «more» quando restano ordini oltre il budget, «busy» se un altro consumer
 * ha la richiesta.
 */
export async function runEbayAccountDeletion(
  env: Pick<Env, "DB" | "BETTER_AUTH_SECRET">,
  id: string,
  now = new Date(),
  budget = orderBudget,
): Promise<EbayDeletionOutcome> {
  const at = now.toISOString();
  const db = env.DB;
  const lock = lockUntil(now);
  const job = await db
    .prepare(`UPDATE ebay_account_deletions SET locked_until = ?2
      WHERE id = ?1 AND completed_at IS NULL AND (locked_until IS NULL OR locked_until <= ?3)
      RETURNING ebay_environment, ebay_user_id, eias_token, username`)
    .bind(id, lock, at)
    .first<{
      ebay_environment: EbayEnvironment;
      ebay_user_id: string;
      eias_token: string | null;
      username: string | null;
    }>();
  if (!job) {
    const row = await db
      .prepare("SELECT completed_at FROM ebay_account_deletions WHERE id = ?")
      .bind(id)
      .first<{ completed_at: string | null }>();
    return !row ? "missing" : row.completed_at ? "done" : "busy";
  }
  // Il rilascio vale soltanto per il blocco ancora preso da questo passo.
  const release = () =>
    db
      .prepare(
        "UPDATE ebay_account_deletions SET locked_until = NULL WHERE id = ?1 AND locked_until = ?2",
      )
      .bind(id, lock)
      .run();
  try {
    const { results: stores } = await db
      .prepare("SELECT id FROM ebay_stores WHERE ebay_environment = ? AND ebay_account_id = ?")
      .bind(job.ebay_environment, job.ebay_user_id)
      .all<{ id: string }>();
    // Prima di tutto nessuna lettura riparte, poi gli ordini a lotti e infine l'identità.
    await inSequence(stores, async (store) => {
      await db.batch(stopStoreStatements(db, store.id, at));
    });
    for (const store of stores)
      if (
        !(await deleteOrders(db, "SELECT id FROM orders WHERE store_id = ?1", [store.id], budget))
      ) {
        await release();
        return "more";
      }
    // Senza token né username nessun ordine corrisponde.
    if (
      !(await deleteOrders(
        db,
        buyerOrdersSql,
        [job.ebay_environment, job.eias_token, job.username],
        budget,
      ))
    ) {
      await release();
      return "more";
    }
    await db.batch([
      ...stores.flatMap((store) => eraseStoreStatements(db, store.id, at)),
      db
        .prepare("DELETE FROM store_identity_marks WHERE identity_hash = ?")
        .bind(
          await storeIdentityHash(
            env.BETTER_AUTH_SECRET,
            storeIdentity(job.ebay_environment, job.ebay_user_id),
          ),
        ),
      // L'accesso con eBay esiste soltanto in Production; gli altri metodi dell'utente restano.
      db
        .prepare(`DELETE FROM "account" WHERE "providerId" = 'ebay' AND "accountId" = ?2
          AND ?1 = 'production'`)
        .bind(job.ebay_environment, job.ebay_user_id),
      db
        .prepare(`UPDATE ebay_account_deletions SET completed_at = ?2, locked_until = NULL
          WHERE id = ?1`)
        .bind(id, at),
    ]);
    return "done";
  } catch (error) {
    await release();
    throw error;
  }
}

const messageSchema = z.object({ ebayAccountDeletion: z.uuid() });

export function isEbayAccountDeletionMessage(body: unknown): body is z.infer<typeof messageSchema> {
  return messageSchema.safeParse(body).success;
}

/**
 * Esegue un passo dalla coda. Gli ordini oltre il budget ripartono con un nuovo messaggio; la
 * richiesta tenuta da un altro consumer resta a lui o al compito periodico. Un errore riprova
 * con backoff per poche consegne, poi passa al compito.
 */
export async function consumeEbayAccountDeletion(
  message: Message<unknown>,
  env: Env,
  now = new Date(),
): Promise<void> {
  const { ebayAccountDeletion: id } = messageSchema.parse(message.body);
  await consumeStepJob(
    message,
    () => runEbayAccountDeletion(env, id, now),
    () => env.WORK_QUEUE.send({ ebayAccountDeletion: id }),
    "ebay_account_deletion",
  );
}

/**
 * Compito periodico: riapre le richieste concluse i cui dati ricompaiono, come dopo un restore,
 * e riprende quelle non concluse (messaggio perso o errore), dalla più vecchia. Un errore su una
 * richiesta non ferma le altre.
 */
export async function resumeEbayAccountDeletions(
  env: Pick<Env, "DB" | "BETTER_AUTH_SECRET">,
  now = new Date(),
): Promise<void> {
  const at = now.toISOString();
  const { results: completed } = await env.DB.prepare(`SELECT id, ebay_environment, ebay_user_id,
      eias_token, username FROM ebay_account_deletions WHERE completed_at IS NOT NULL`).all<{
    id: string;
    ebay_environment: EbayEnvironment;
    ebay_user_id: string;
    eias_token: string | null;
    username: string | null;
  }>();
  await inSequence(completed, async (row) => {
    await env.DB.prepare(`UPDATE ebay_account_deletions SET completed_at = NULL
        WHERE id = ?6 AND (${knownUserSql})`)
      .bind(
        ...(await knownUserBindings(env.BETTER_AUTH_SECRET, {
          environment: row.ebay_environment,
          userId: row.ebay_user_id,
          eiasToken: row.eias_token,
          username: row.username,
        })),
        row.id,
      )
      .run();
  });
  const { results } = await env.DB.prepare(`SELECT id FROM ebay_account_deletions
      WHERE completed_at IS NULL AND (locked_until IS NULL OR locked_until <= ?1)
      ORDER BY requested_at LIMIT ?2`)
    .bind(at, resumeBatch)
    .all<{ id: string }>();
  await inSequence(results, async ({ id }) => {
    try {
      await runToEnd(() => runEbayAccountDeletion(env, id, now));
    } catch (error) {
      logFailure({ error, operation: "ebay_account_deletion" });
    }
  });
}

/** Pulizia: richieste concluse da oltre la finestra di Time Travel. */
export function purgeEbayDeletionMarkers(db: D1Database, now: Date) {
  return db
    .prepare(`DELETE FROM ebay_account_deletions WHERE completed_at IS NOT NULL
      AND julianday(completed_at) < julianday(?) - ?`)
    .bind(now.toISOString(), deletionMarkerDays);
}

/** Richieste da seguire nella console: non concluse da oltre un'ora. */
export async function stalledEbayDeletions(db: D1Database, now: Date) {
  const { results } = await db
    .prepare(`SELECT id, ebay_environment, requested_at FROM ebay_account_deletions
      WHERE completed_at IS NULL AND julianday(requested_at) < julianday(?) - 1.0 / 24
      ORDER BY requested_at`)
    .bind(now.toISOString())
    .all<{ id: string; ebay_environment: EbayEnvironment; requested_at: string }>();
  return results;
}
