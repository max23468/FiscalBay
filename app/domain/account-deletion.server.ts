import { z } from "zod";

import { EmailError, sendAccountDeletedNotice } from "../account-email.server";
import { ApplicationError, logFailure } from "../errors";
import type { Language } from "../i18n";
import { derivedKey, hex, seal, unseal } from "../sealed.server";
import { inSequence } from "../sequence";
import { dayMilliseconds, elapsedMs } from "../time";
import { stopRenewals } from "./billing.server";
import { deleteExportFiles } from "./export-files.server";
import { freeCycleStatement } from "./grants.server";
import { queueRetryDelay, taskPeriods } from "./work-timing";

/**
 * Cancellazione dell'account (§30, D163). La conferma dal link email registra la richiesta e
 * nello stesso commit ferma accesso, letture e notifiche: chiude le sessioni, elimina le
 * credenziali eBay e il collegamento Telegram. Il lavoro dalla coda, ripreso dopo un crash o un
 * retry senza doppi effetti, ferma i rinnovi Stripe, scrive i segni minimi dei negozi, elimina
 * i dati operativi e per ultimo l'utente Auth, poi lo spazio con i riferimenti dei pagamenti e
 * l'email finale. Se Stripe non conferma lo stop dei rinnovi restano soltanto la richiesta, i
 * segni e lo spazio con i riferimenti necessari a completarlo: la console lo segnala e il
 * compito periodico riprova.
 */

/** Durata del blocco di una richiesta in esecuzione: un consumer interrotto la cede allo scadere. */
const lockMilliseconds = 15 * 60_000;

/** Attesa massima fra due tentativi di una richiesta ferma. */
const maxRetryMilliseconds = 6 * 3_600_000;

/**
 * Prossimo tentativo di una richiesta ferma, su Stripe, sull'email finale o per un errore:
 * l'attesa cresce con l'età della richiesta, da un periodo del compito a sei ore. Nel
 * frattempo la richiesta non è candidata e le altre avanzano.
 */
function retryAt(requestedAt: string, now: Date): string {
  const age = now.getTime() - Date.parse(requestedAt);
  return new Date(
    now.getTime() + Math.min(maxRetryMilliseconds, Math.max(taskPeriods.account_deletion, age)),
  ).toISOString();
}

/** Riautenticazione: la richiesta parte soltanto da una sessione aperta negli ultimi 10 minuti. */
export const deletionReauthMilliseconds = 10 * 60_000;

/** Una richiesta conclusa resta come marker per la finestra di Time Travel (§32.1). */
export const deletionMarkerDays = 30;

/**
 * Il segno della prova usata dura due anni, scelta dell'owner (D220); quello
 * del ciclo Free soltanto fino alla fine del ciclo.
 */
export const trialMarkDays = 730;

/** Ordini eliminati per istruzione e istruzioni per giro, poi il lavoro riparte dalla coda. */
const orderBudget = { batch: 200, batches: 25 };

/** Tentativi dell'email finale prima di concludere senza. */
const noticeAttempts = 3;

// Stryker disable next-line StringLiteral: lo scopo deriva la chiave; un altro valore, uguale per chiusura e apertura, dà lo stesso esito.
const sealPurpose = "account-deletion";

/** Segnalazione all'owner: un'etichetta fissa, senza riferimenti all'account. */
class DeletionSignal extends ApplicationError {
  constructor(readonly failure: string) {
    super("UPSTREAM_UNAVAILABLE");
  }
}

/** Sessione aperta abbastanza di recente per chiedere la cancellazione. */
export function deletionReauthenticated(createdAt: Date | string, now = new Date()): boolean {
  return elapsedMs(createdAt, now) < deletionReauthMilliseconds;
}

/**
 * Arresto immediato, ripetibile: sessioni, credenziali dei negozi (letture e rinnovi dei token
 * non trovano più il consenso e non scrivono) e collegamento Telegram.
 */
function stopStatements(db: D1Database, userId: string, workspaceId: string | null) {
  return [
    db.prepare('DELETE FROM "session" WHERE "userId" = ?').bind(userId),
    db.prepare("DELETE FROM telegram_link_requests WHERE user_id = ?").bind(userId),
    ...(workspaceId
      ? [
          db
            .prepare(`DELETE FROM ebay_store_credentials WHERE store_id IN
              (SELECT id FROM ebay_stores WHERE workspace_id = ?)`)
            .bind(workspaceId),
          db.prepare("DELETE FROM telegram_links WHERE workspace_id = ?").bind(workspaceId),
        ]
      : []),
  ];
}

/** Spazio dell'utente, se ha già collegato un negozio. */
async function userWorkspace(db: D1Database, userId: string) {
  const row = await db
    .prepare("SELECT workspace_id FROM workspace_members WHERE user_id = ?")
    .bind(userId)
    .first<{ workspace_id: string }>();
  return row?.workspace_id ?? null;
}

/**
 * Callback del link di conferma: registra la richiesta e ferma accesso, letture e notifiche in
 * un solo commit, poi accoda il lavoro. Una seconda conferma ritrova la richiesta esistente.
 * L'utente Auth resta: lo elimina il lavoro, per ultimo. Se l'invio alla coda non riesce la
 * richiesta resta registrata e la riprende il compito periodico.
 */
export async function startAccountDeletion(
  env: Pick<Env, "DB" | "WORK_QUEUE" | "BETTER_AUTH_SECRET">,
  user: { id: string; email: string },
  language: Language,
  now = new Date(),
): Promise<string> {
  const id = crypto.randomUUID();
  const [notice, workspace] = await Promise.all([
    seal(env.BETTER_AUTH_SECRET, sealPurpose, id, JSON.stringify({ email: user.email, language })),
    userWorkspace(env.DB, user.id),
  ]);
  const [created] = await env.DB.batch<{ id: string }>([
    env.DB.prepare(`INSERT INTO account_deletions (id, user_id, workspace_id, notice_sealed,
        requested_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id) DO NOTHING RETURNING id`).bind(
      id,
      user.id,
      workspace,
      notice,
      now.toISOString(),
    ),
    ...stopStatements(env.DB, user.id, workspace),
  ]);
  if (!created!.results.length) {
    const existing = await env.DB.prepare("SELECT id FROM account_deletions WHERE user_id = ?")
      .bind(user.id)
      .first<{ id: string }>();
    return existing!.id;
  }
  await env.WORK_QUEUE.send({ accountDeletion: id }).catch((error: unknown) =>
    logFailure({ error, operation: "account_deletion" }),
  );
  return id;
}

// Stryker disable next-line StringLiteral: lo scopo deriva la chiave; un altro valore, uguale per scrittura e confronto, dà lo stesso esito.
const markPurpose = "store-identity-mark";

/** Chiave HMAC dei segni, derivata dal segreto del server con uno scopo dedicato. */
const markKey = (secret: string) =>
  derivedKey(secret, markPurpose, { name: "HMAC", hash: "SHA-256", length: 256 }, ["sign"]);

/**
 * Impronta dell'identità eBay di un negozio, come la conserva `ebay_stores.ebay_user_id`: HMAC
 * con una chiave del server, quindi chi conosce soltanto l'identificativo eBay non la ricalcola.
 */
export async function storeIdentityHash(secret: string, ebayUserId: string): Promise<string> {
  return hex(
    await crypto.subtle.sign("HMAC", await markKey(secret), new TextEncoder().encode(ebayUserId)),
  );
}

/** Fine del segno della prova già usata, registrato all'istante dato. */
export function trialMarkExpiry(now: Date): string {
  return new Date(now.getTime() + trialMarkDays * dayMilliseconds).toISOString();
}

/**
 * Segno minimo di un negozio con i dati del suo spazio: prova già usata e ciclo Free in corso
 * con almeno uno sblocco. Senza nessuno dei due il negozio non lascia nulla; ripetuto, conserva
 * il valore più ampio. Argomenti: espressioni SQL dell'impronta, del negozio, dell'istante e
 * della fine del segno della prova, più una condizione che deve valere per scriverlo. Lo
 * scrivono la cancellazione dell'account e il trasferimento assistito del negozio.
 */
export function storeMarkSql(
  input: { hash: string; store: string; at: string; trialExpires: string },
  condition = "1 = 1",
) {
  const { hash, store, at, trialExpires } = input;
  return `INSERT INTO store_identity_marks (identity_hash, trial_used, cycle_anchor_at,
      cycle_starts_at, cycle_ends_at, cycle_quota, cycle_used, recorded_at, expires_at)
    SELECT ${hash}, m.trial_used, CASE WHEN m.starts_at IS NOT NULL THEN m.anchor END,
      m.starts_at, m.ends_at, m.quota, m.used, ${at},
      CASE WHEN m.trial_used THEN ${trialExpires} ELSE m.ends_at END
    FROM (SELECT w.free_cycle_anchor_at AS anchor,
        (w.trial_used_at IS NOT NULL OR EXISTS (SELECT 1 FROM workspace_entitlements e
          WHERE e.workspace_id = w.id AND e.source = 'trial')) AS trial_used,
        c.starts_at, c.ends_at, c.quota, c.used
      FROM ebay_stores s JOIN workspaces w ON w.id = s.workspace_id
      LEFT JOIN free_cycles c ON c.workspace_id = w.id AND c.used > 0
        AND julianday(c.starts_at) <= julianday(${at}) AND julianday(${at}) < julianday(c.ends_at)
      WHERE s.id = ${store}) m
    WHERE (m.trial_used OR m.starts_at IS NOT NULL) AND ${condition}
    ON CONFLICT(identity_hash) DO UPDATE SET
      trial_used = MAX(trial_used, excluded.trial_used),
      cycle_anchor_at = COALESCE(excluded.cycle_anchor_at, cycle_anchor_at),
      cycle_starts_at = COALESCE(excluded.cycle_starts_at, cycle_starts_at),
      cycle_ends_at = COALESCE(excluded.cycle_ends_at, cycle_ends_at),
      cycle_quota = COALESCE(excluded.cycle_quota, cycle_quota),
      cycle_used = CASE WHEN excluded.cycle_starts_at IS NULL THEN cycle_used
        WHEN excluded.cycle_starts_at = cycle_starts_at THEN MAX(cycle_used, excluded.cycle_used)
        ELSE excluded.cycle_used END,
      expires_at = MAX(expires_at, excluded.expires_at)`;
}

/** Segni minimi di tutti i negozi dello spazio, prima che i suoi dati si eliminino. */
async function recordStoreMarks(db: D1Database, secret: string, workspaceId: string, now: Date) {
  const { results } = await db
    .prepare("SELECT id, ebay_user_id FROM ebay_stores WHERE workspace_id = ?")
    .bind(workspaceId)
    .all<{ id: string; ebay_user_id: string }>();
  if (!results.length) return;
  const statement = storeMarkSql({ hash: "?1", store: "?2", at: "?3", trialExpires: "?4" });
  await db.batch(
    await Promise.all(
      results.map(async (store) =>
        db
          .prepare(statement)
          .bind(
            await storeIdentityHash(secret, store.ebay_user_id),
            store.id,
            now.toISOString(),
            trialMarkExpiry(now),
          ),
      ),
    ),
  );
}

/** Segno ancora valido di un negozio lasciato da uno spazio cancellato o da un trasferimento. */
export type StoreMark = {
  trialUsed: boolean;
  cycle: { anchor: string; startsAt: string; endsAt: string; quota: number; used: number } | null;
};

export async function readStoreMark(
  db: D1Database,
  secret: string,
  ebayUserId: string,
  now: Date,
): Promise<StoreMark | null> {
  const row = await db
    .prepare(`SELECT trial_used, cycle_anchor_at, cycle_starts_at, cycle_ends_at, cycle_quota,
        cycle_used FROM store_identity_marks WHERE identity_hash = ?1 AND expires_at > ?2`)
    .bind(await storeIdentityHash(secret, ebayUserId), now.toISOString())
    .first<{
      trial_used: number;
      cycle_anchor_at: string | null;
      cycle_starts_at: string | null;
      cycle_ends_at: string | null;
      cycle_quota: number | null;
      cycle_used: number | null;
    }>();
  if (!row) return null;
  return {
    trialUsed: !!row.trial_used,
    cycle:
      row.cycle_anchor_at && row.cycle_starts_at && Date.parse(row.cycle_ends_at!) > now.getTime()
        ? {
            anchor: row.cycle_anchor_at,
            startsAt: row.cycle_starts_at,
            endsAt: row.cycle_ends_at!,
            quota: row.cycle_quota!,
            used: row.cycle_used!,
          }
        : null,
  };
}

/**
 * Prima del collegamento di un negozio con un segno: uno spazio ancora senza cicli adotta
 * l'ancoraggio del ciclo in corso, così il ciclo prosegue con i suoi confini e il trigger del
 * collegamento non ne fissa uno nuovo. Non se il negozio è già di un altro spazio, perché il
 * collegamento non riuscirebbe.
 */
export function markAnchorStatement(
  db: D1Database,
  workspaceId: string,
  ebayUserId: string,
  mark: StoreMark | null,
) {
  return mark?.cycle
    ? [
        db
          .prepare(`UPDATE workspaces SET free_cycle_anchor_at = ?2
            WHERE id = ?1 AND free_cycle_anchor_at IS NULL AND NOT EXISTS (
              SELECT 1 FROM ebay_stores WHERE ebay_user_id = ?3 AND workspace_id <> ?1)`)
          .bind(workspaceId, mark.cycle.anchor, ebayUserId),
      ]
    : [];
}

/**
 * Dopo il collegamento riuscito, la stessa regola per un segno lasciato da una cancellazione o
 * da un trasferimento. Con la prova già usata lo spazio non può più averla e una prova in corso
 * termina subito: lo spazio torna al Free. Gli sblocchi del ciclo del segno si aggiungono al
 * ciclo Free in corso dello spazio, fino alla sua quota; uno spazio che ha adottato l'ancoraggio
 * del segno riprende proprio quel ciclo, con la sua quota. Gli sblocchi già arrivati dallo
 * stesso ciclo di partenza, con un altro negozio o un collegamento precedente, non si sommano di
 * nuovo: ripetuto, il collegamento non cambia nulla.
 */
export async function applyStoreMark(
  db: D1Database,
  workspaceId: string,
  mark: StoreMark,
  now: Date,
) {
  const at = now.toISOString();
  const { cycle } = mark;
  const anchor = cycle
    ? await db
        .prepare("SELECT free_cycle_anchor_at FROM workspaces WHERE id = ?")
        .bind(workspaceId)
        .first<string>("free_cycle_anchor_at")
    : null;
  const current = cycle ? freeCycleStatement(db, workspaceId, anchor, now) : null;
  // Ciclo in corso dello spazio, nelle istruzioni seguenti: ?1 spazio, ?2 istante.
  const currentCycle = `workspace_id = ?1 AND julianday(starts_at) <= julianday(?2)
    AND julianday(?2) < julianday(ends_at)`;
  await db.batch([
    ...(mark.trialUsed
      ? [
          db
            .prepare(
              "UPDATE workspaces SET trial_used_at = COALESCE(trial_used_at, ?2) WHERE id = ?1",
            )
            .bind(workspaceId, at),
          db
            .prepare(`UPDATE workspace_entitlements SET revoked_at = ?2
              WHERE workspace_id = ?1 AND source = 'trial' AND revoked_at IS NULL
                AND julianday(starts_at) <= julianday(?2) AND julianday(?2) < julianday(ends_at)`)
            .bind(workspaceId, at),
        ]
      : []),
    ...(cycle
      ? [
          db
            .prepare(`INSERT INTO free_cycles (id, workspace_id, starts_at, ends_at, quota)
              SELECT ?1, w.id, ?3, ?4, ?5 FROM workspaces w
               WHERE w.id = ?2 AND w.free_cycle_anchor_at = ?6
              ON CONFLICT(workspace_id, starts_at) DO NOTHING`)
            .bind(
              crypto.randomUUID(),
              workspaceId,
              cycle.startsAt,
              cycle.endsAt,
              cycle.quota,
              cycle.anchor,
            ),
          ...(current ? [current] : []),
          db
            .prepare(`UPDATE free_cycles SET used = MIN(quota, used + MAX(0, ?3 - COALESCE(
                (SELECT i.used FROM free_cycle_imports i WHERE i.cycle_id = free_cycles.id
                  AND i.origin_anchor_at = ?4 AND i.origin_starts_at = ?5), 0)))
              WHERE ${currentCycle}`)
            .bind(workspaceId, at, cycle.used, cycle.anchor, cycle.startsAt),
          db
            .prepare(`INSERT INTO free_cycle_imports (cycle_id, origin_anchor_at, origin_starts_at,
                used) SELECT id, ?4, ?5, ?3 FROM free_cycles WHERE ${currentCycle}
              ON CONFLICT DO UPDATE SET used = MAX(used, excluded.used)`)
            .bind(workspaceId, at, cycle.used, cycle.anchor, cycle.startsAt),
        ]
      : []),
  ]);
}

/**
 * Ordini dello spazio a lotti: le chiavi esterne eliminano articoli, identificativi, versioni,
 * verifiche, riferimenti e sblocchi. True quando non ne resta nessuno.
 */
async function deleteOrders(
  db: D1Database,
  workspaceId: string,
  budget: typeof orderBudget,
): Promise<boolean> {
  for (let batch = 0; batch < budget.batches; batch++) {
    const { meta } = await db
      .prepare(`DELETE FROM orders WHERE id IN (SELECT o.id FROM orders o
          JOIN ebay_stores s ON s.id = o.store_id WHERE s.workspace_id = ?1 LIMIT ?2)`)
      .bind(workspaceId, budget.batch)
      .run();
    if (meta.changes === 0) return true;
  }
  return false;
}

/**
 * Dati operativi dello spazio: negozi con letture, ricevute, pause, marker degli ordini e
 * consegne; cicli, coperture, estensioni, preferenze Telegram, metriche e revisioni antiabuso.
 * Restano la riga dello spazio e i riferimenti di Stripe e dei posti lifetime, che servono allo
 * stop dei rinnovi ed escono con lo spazio.
 */
function workspaceDataStatements(db: D1Database, workspaceId: string) {
  return [
    "DELETE FROM ebay_stores WHERE workspace_id = ?",
    "DELETE FROM free_store_changes WHERE workspace_id = ?",
    // Sblocchi rimasti su ordini di un negozio trasferito: tengono i cicli che li hanno contati.
    "DELETE FROM order_grants WHERE workspace_id = ?",
    "DELETE FROM free_cycles WHERE workspace_id = ?",
    "DELETE FROM history_extensions WHERE workspace_id = ?",
    "DELETE FROM workspace_entitlements WHERE workspace_id = ?",
    "DELETE FROM telegram_deliveries WHERE workspace_id = ?",
    "DELETE FROM telegram_preferences WHERE workspace_id = ?",
    "DELETE FROM workspace_funnel_steps WHERE workspace_id = ?",
    "DELETE FROM abuse_reviews WHERE workspace_id = ?",
  ].map((sql) => db.prepare(sql).bind(workspaceId));
}

/**
 * Utente Auth, per ultimo: file delle esportazioni nel bucket, poi le righe che seguono
 * l'utente (accessi, sessioni, passkey, profilo, consensi, preferenze, configurazioni, file,
 * lavori, assistenza) e quelle senza chiave esterna.
 */
async function deleteUser(
  env: Pick<Env, "DB" | "EXPORT_FILES">,
  id: string,
  userId: string,
  at: string,
) {
  // A giri entro il limite di R2: un errore lascia le righe dei file non ancora eliminati.
  await deleteExportFiles(env, (limit) =>
    env.DB.prepare("SELECT id FROM export_files WHERE user_id = ?1 LIMIT ?2").bind(userId, limit),
  );
  await env.DB.batch([
    env.DB.prepare("DELETE FROM workspace_members WHERE user_id = ?").bind(userId),
    env.DB.prepare("DELETE FROM ebay_store_link_sessions WHERE user_id = ?").bind(userId),
    // Link di Auth ancora aperti, come la nuova password, legati all'utente.
    env.DB.prepare('DELETE FROM "verification" WHERE "value" = ?').bind(userId),
    env.DB.prepare('DELETE FROM "user" WHERE "id" = ?').bind(userId),
    env.DB.prepare(
      "UPDATE account_deletions SET user_deleted_at = COALESCE(user_deleted_at, ?2) WHERE id = ?1",
    ).bind(id, at),
  ]);
}

export type DeletionOutcome = "done" | "more" | "waiting" | "busy" | "missing";

/**
 * Un passo del lavoro, ripetibile: ogni fase rilegge lo stato corrente e una ripetizione non
 * duplica effetti. «more» quando restano ordini oltre il budget, «waiting» se lo stop dei
 * rinnovi o l'email finale vanno ritentati, «busy» se un altro consumer ha la richiesta.
 */
export async function runAccountDeletion(
  env: Env,
  id: string,
  fetcher: typeof fetch = fetch,
  now = new Date(),
  budget = orderBudget,
): Promise<DeletionOutcome> {
  const at = now.toISOString();
  const job = await env.DB.prepare(
    `UPDATE account_deletions SET locked_until = ?2
      WHERE id = ?1 AND completed_at IS NULL AND (locked_until IS NULL OR locked_until <= ?3)
      RETURNING user_id, workspace_id, requested_at, notice_sealed, notice_attempts,
        renewals_stopped_at, renewals_blocked_at`,
  )
    .bind(id, new Date(now.getTime() + lockMilliseconds).toISOString(), at)
    .first<{
      user_id: string;
      workspace_id: string | null;
      requested_at: string;
      notice_sealed: string | null;
      notice_attempts: number;
      renewals_stopped_at: string | null;
      renewals_blocked_at: string | null;
    }>();
  if (!job) {
    const row = await env.DB.prepare("SELECT completed_at FROM account_deletions WHERE id = ?")
      .bind(id)
      .first<{ completed_at: string | null }>();
    return !row ? "missing" : row.completed_at ? "done" : "busy";
  }
  const release = () =>
    env.DB.prepare("UPDATE account_deletions SET locked_until = NULL WHERE id = ?").bind(id).run();
  // In attesa di Stripe o dell'email finale: il blocco resta fino al prossimo tentativo.
  const postpone = () =>
    env.DB.prepare("UPDATE account_deletions SET locked_until = ?2 WHERE id = ?1")
      .bind(id, retryAt(job.requested_at, now))
      .run();
  try {
    // Uno spazio nato mentre la richiesta si registrava appartiene comunque all'utente.
    const workspace = job.workspace_id ?? (await userWorkspace(env.DB, job.user_id));
    if (workspace && !job.workspace_id)
      await env.DB.prepare("UPDATE account_deletions SET workspace_id = ? WHERE id = ?")
        .bind(workspace, id)
        .run();
    // Anche dopo un restore: nessuna sessione, lettura o notifica riparte.
    await env.DB.batch(stopStatements(env.DB, job.user_id, workspace));
    let stopped = !!job.renewals_stopped_at;
    if (!stopped) {
      stopped = !workspace || (await stopRenewals(env, workspace, fetcher, now));
      if (stopped) {
        await env.DB.prepare("UPDATE account_deletions SET renewals_stopped_at = ? WHERE id = ?")
          .bind(at, id)
          .run();
      } else if (!job.renewals_blocked_at) {
        await env.DB.prepare("UPDATE account_deletions SET renewals_blocked_at = ? WHERE id = ?")
          .bind(at, id)
          .run();
        logFailure({
          error: new DeletionSignal("renewals_not_stopped"),
          operation: "account_deletion",
        });
      }
    }
    if (workspace) {
      await recordStoreMarks(env.DB, env.BETTER_AUTH_SECRET, workspace, now);
      if (!(await deleteOrders(env.DB, workspace, budget))) {
        await release();
        return "more";
      }
      await env.DB.batch(workspaceDataStatements(env.DB, workspace));
    }
    await deleteUser(env, id, job.user_id, at);
    if (!stopped) {
      await postpone();
      return "waiting";
    }
    // Nulla può più addebitare: lo spazio esce con abbonamenti e sessioni di acquisto, i posti
    // lifetime restano occupati senza spazio.
    if (workspace)
      await env.DB.prepare("DELETE FROM workspaces WHERE id = ?").bind(workspace).run();
    if (job.notice_sealed && !(await sendNotice(env, id, job.notice_sealed, job.notice_attempts))) {
      await postpone();
      return "waiting";
    }
    await env.DB.prepare(`UPDATE account_deletions SET completed_at = ?2, notice_sealed = NULL,
        locked_until = NULL WHERE id = ?1`)
      .bind(id, at)
      .run();
    return "done";
  } catch (error) {
    await release();
    throw error;
  }
}

/**
 * Email di cancellazione completata. False se va ritentata: un indirizzo che rifiuta le email o
 * l'ultimo tentativo concludono senza.
 */
async function sendNotice(env: Env, id: string, sealed: string, attempts: number) {
  try {
    const notice = JSON.parse(await unseal(env.BETTER_AUTH_SECRET, sealPurpose, id, sealed)) as {
      email: string;
      language: Language;
    };
    await sendAccountDeletedNotice(env, { to: notice.email, language: notice.language });
    return true;
  } catch (error) {
    logFailure({ error, operation: "account_email" });
    const last =
      attempts + 1 >= noticeAttempts || (error instanceof EmailError && error.undeliverable);
    await env.DB.prepare(
      `UPDATE account_deletions SET notice_attempts = notice_attempts + 1,
         notice_sealed = CASE WHEN ?2 THEN NULL ELSE notice_sealed END WHERE id = ?1`,
    )
      .bind(id, last ? 1 : 0)
      .run();
    return last;
  }
}

const messageSchema = z.object({ accountDeletion: z.uuid() });

export function isAccountDeletionMessage(body: unknown): body is z.infer<typeof messageSchema> {
  return messageSchema.safeParse(body).success;
}

/** Consegne riprovate dalla coda dopo un errore; poi la richiesta resta al compito periodico. */
const queueRetries = 3;

/**
 * Esegue un passo dalla coda. Gli ordini oltre il budget ripartono con un nuovo messaggio; lo
 * stop dei rinnovi non confermato, l'email da ritentare e la richiesta tenuta da un altro
 * consumer o in attesa del prossimo tentativo restano al compito periodico, così nessuna
 * richiesta finisce fra i messaggi non consegnati. Un errore riprova con backoff per poche
 * consegne, entro il limite della coda, poi passa anch'esso al compito.
 */
export async function consumeAccountDeletion(
  message: Message<unknown>,
  env: Env,
  fetcher: typeof fetch = fetch,
  now = new Date(),
): Promise<void> {
  const { accountDeletion: id } = messageSchema.parse(message.body);
  try {
    const outcome = await runAccountDeletion(env, id, fetcher, now);
    if (outcome === "more") await env.WORK_QUEUE.send({ accountDeletion: id });
    message.ack();
  } catch (error) {
    logFailure({ error, operation: "account_deletion" });
    if (message.attempts > queueRetries) message.ack();
    else message.retry({ delaySeconds: queueRetryDelay(message.attempts) });
  }
}

/** Richieste riprese per giro del compito periodico. */
const resumeBatch = 10;

/**
 * Compito periodico: riprende le richieste non concluse (messaggio perso, stop dei rinnovi o
 * email da ritentare, errore) e riapre quelle concluse il cui utente o spazio esiste di nuovo,
 * come dopo un restore con i marker riapplicati. La riapertura ripete anche lo stop dei rinnovi;
 * l'email già inviata non riparte. Le richieste dovute partono dal tentativo più vecchio e una
 * richiesta ferma attende sempre di più: le nuove non restano dietro a quelle bloccate, e un
 * errore su una richiesta non ferma le altre.
 */
export async function resumeAccountDeletions(
  env: Env,
  fetcher: typeof fetch = fetch,
  now = new Date(),
): Promise<void> {
  const at = now.toISOString();
  await env.DB.prepare(`UPDATE account_deletions SET completed_at = NULL,
      renewals_stopped_at = NULL, renewals_blocked_at = NULL, user_deleted_at = NULL
    WHERE completed_at IS NOT NULL AND (
      EXISTS (SELECT 1 FROM "user" u WHERE u."id" = account_deletions.user_id)
      OR EXISTS (SELECT 1 FROM workspaces w WHERE w.id = account_deletions.workspace_id))`).run();
  const { results } = await env.DB.prepare(`SELECT id, requested_at FROM account_deletions
      WHERE completed_at IS NULL AND (locked_until IS NULL OR locked_until <= ?1)
      ORDER BY COALESCE(locked_until, requested_at), requested_at LIMIT ?2`)
    .bind(at, resumeBatch)
    .all<{ id: string; requested_at: string }>();
  await inSequence(results, async ({ id, requested_at }) => {
    try {
      // Gli ordini oltre il budget proseguono nello stesso compito, fino a un altro esito.
      // Stryker disable next-line ConditionalExpression: «more» ripetuto senza fine è un Timeout per Stryker; le prove contano gli ordini eliminati.
      while ((await runAccountDeletion(env, id, fetcher, now)) === "more");
    } catch (error) {
      logFailure({ error, operation: "account_deletion" });
      await env.DB.prepare(`UPDATE account_deletions SET locked_until = ?2
          WHERE id = ?1 AND completed_at IS NULL`)
        .bind(id, retryAt(requested_at, now))
        .run();
    }
  });
}

/**
 * Pulizia: richieste concluse da oltre la finestra di Time Travel, segni scaduti e cicli dei
 * segni finiti. Il ciclo resta soltanto fino alla sua fine, la prova usata per due anni (D220).
 */
export function purgeDeletionMarkers(db: D1Database, now: Date) {
  return [
    db
      .prepare(`DELETE FROM account_deletions WHERE completed_at IS NOT NULL
        AND julianday(completed_at) < julianday(?) - ?`)
      .bind(now.toISOString(), deletionMarkerDays),
    db.prepare("DELETE FROM store_identity_marks WHERE expires_at <= ?").bind(now.toISOString()),
    db
      .prepare(`UPDATE store_identity_marks SET cycle_anchor_at = NULL, cycle_starts_at = NULL,
          cycle_ends_at = NULL, cycle_quota = NULL, cycle_used = NULL
        WHERE julianday(cycle_ends_at) <= julianday(?)`)
      .bind(now.toISOString()),
  ];
}

/** Cancellazioni da seguire nella console: rinnovi non fermati o lavoro fermo da oltre un'ora. */
export async function stalledDeletions(db: D1Database, now: Date) {
  const { results } = await db
    .prepare(`SELECT id, workspace_id, requested_at, renewals_blocked_at FROM account_deletions
      WHERE completed_at IS NULL AND (renewals_blocked_at IS NOT NULL
        OR julianday(requested_at) < julianday(?) - 1.0 / 24) ORDER BY requested_at`)
    .bind(now.toISOString())
    .all<{
      id: string;
      workspace_id: string | null;
      requested_at: string;
      renewals_blocked_at: string | null;
    }>();
  return results;
}
