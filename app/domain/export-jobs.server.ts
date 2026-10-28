import { z } from "zod";

import { appCopy } from "../app-copy";
import { logFailure } from "../errors";
import type { Language } from "../i18n";
import {
  customColumns,
  standardColumns,
  type ExportColumn,
  type ExportRows,
} from "../orders/export-columns";
import type { ExportFilter } from "../orders/export-scope.server";
import { seal, unseal } from "../sealed.server";
import type { EbayEnvironment } from "../view-models";
import {
  exportFileMilliseconds,
  exportRevision,
  publishExportFile,
  revisionSql,
} from "./export-files.server";
import { orderAllowance } from "./grants.server";
import { exportCsvStream, exportOrderPages, exportXlsxStream } from "./order-export.server";
import { visibleOrderTallies, visibleOrdersTerm } from "./orders.server";
import { queueRetryDelay } from "./work-timing";
import { XlsxRowLimitError } from "./xlsx.server";

/**
 * File degli ordini, creati subito o preparati dalla coda (§12.1). Oltre `exportJobOrders`
 * ordini la richiesta registra un lavoro e risponde subito: il consumer rilegge revisione
 * dello spazio, diritti e conservazione all'avvio, crea il file e la campanella lo annuncia.
 * La revisione resta quella letta alla richiesta, così un lavoro partito prima di una revoca
 * non pubblica il file dopo di essa. Ambito e opzioni restano cifrati nella riga soltanto
 * finché il lavoro non si conclude: la ricerca può contenere dati dell'acquirente. Il compito
 * orario `export_files` riprende i lavori rimasti senza messaggio e chiude come non riusciti
 * quelli che non possono più concludersi.
 */

/** Ordini oltre i quali il file si prepara dalla coda invece che nella richiesta. */
export const exportJobOrders = 2_000;

/** Tentativi di un lavoro prima di risultare non riuscito. */
const maxAttempts = 3;

/** Lavori in preparazione per utente: un altro file si chiede quando uno è concluso. */
export const maxQueuedExports = 2;

/** Lavori riaccodati in un turno della ripresa; gli altri restano al turno successivo. */
const resumeBatch = 100;

/** Durata del blocco di un lavoro in esecuzione: un consumer interrotto lo cede allo scadere. */
const lockMilliseconds = 15 * 60_000;

/** Tipo del contenuto di ogni formato. */
export const contentTypes = {
  csv: "text/csv; charset=utf-8",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
} as const;

/** Ambito e forma del file, come li ha chiesti l'utente. */
export interface OrderFileRequest {
  environment: EbayEnvironment;
  filter: ExportFilter;
  rows: ExportRows;
  format: keyof typeof contentTypes;
  /** Colonne scelte con Premium; null per lo schema standard o per colonne uguali a esso. */
  columns: ExportColumn[] | null;
  language: Language;
  timeZone: string;
}

/** Il file chiede Premium: XLSX o colonne diverse dallo schema standard. */
const premiumOnly = (request: OrderFileRequest) =>
  request.format === "xlsx" ||
  (request.columns !== null && customColumns(request.columns, request.rows) !== null);

/**
 * Crea e pubblica il file con i dati consultabili all'istante `now`. Il file vale al più 24
 * ore, non oltre la copertura Premium che lo permette né oltre il primo termine di
 * conservazione o di sblocco degli ordini inclusi. null se una revoca è arrivata dopo la
 * lettura di `revision`. `alongside` entra nello stesso commit del file, come in
 * `publishExportFile`.
 */
export async function publishOrderFile(
  env: Pick<Env, "DB" | "EXPORT_FILES">,
  file: {
    userId: string;
    revision: number;
    request: OrderFileRequest;
    fileName: string;
    now: Date;
    coverageEndsAt: string | null;
    alongside?: (fileId: string) => D1PreparedStatement;
  },
): Promise<string | null> {
  const { userId, request, now } = file;
  const t = appCopy[request.language];
  const columns = request.columns ?? standardColumns(request.rows);
  const term = await visibleOrdersTerm(env.DB, userId, request.environment, now, request.filter);
  const { coverageEndsAt } = file;
  // Il primo dei due termini; senza copertura vale quello dei dati.
  // Stryker disable ConditionalExpression,EqualityOperator: senza copertura Date.parse dà NaN e il confronto è falso; a parità di istante i due termini coincidono.
  const expiresAt =
    coverageEndsAt !== null && (term === null || Date.parse(coverageEndsAt) < Date.parse(term))
      ? coverageEndsAt
      : term;
  // Stryker restore ConditionalExpression,EqualityOperator
  const pages = exportOrderPages(env.DB, userId, request.environment, now, request.filter);
  return publishExportFile(env, {
    userId,
    revision: file.revision,
    fileName: file.fileName,
    contentType: contentTypes[request.format],
    body:
      request.format === "xlsx"
        ? exportXlsxStream(pages, request.rows, t, request.timeZone, now, columns)
        : exportCsvStream(pages, request.rows, t, request.timeZone, columns),
    now,
    expiresAt,
    alongside: file.alongside,
  });
}

// Stryker disable next-line StringLiteral: lo scopo deriva la chiave; un altro valore, uguale per chiusura e apertura, dà lo stesso esito.
const sealPurpose = "export-job";

/**
 * Registra il lavoro e lo accoda; restituisce il suo identificativo, null se l'utente ha già
 * `maxQueuedExports` lavori in preparazione.
 */
export async function queueOrderFile(
  env: Pick<Env, "DB" | "WORK_QUEUE" | "BETTER_AUTH_SECRET">,
  job: {
    userId: string;
    revision: number;
    request: OrderFileRequest;
    fileName: string;
    now: Date;
  },
): Promise<string | null> {
  const id = crypto.randomUUID();
  const sealed = await seal(env.BETTER_AUTH_SECRET, sealPurpose, id, JSON.stringify(job.request));
  // Conteggio e inserimento nella stessa istruzione: richieste concorrenti non superano il limite.
  const row = await env.DB.prepare(
    `INSERT INTO export_jobs (id, user_id, access_revision, request_sealed, file_name, requested_at)
     SELECT ?1, ?2, ?3, ?4, ?5, ?6
      WHERE (SELECT count(*) FROM export_jobs WHERE user_id = ?2 AND state = 'queued') < ?7
     RETURNING id`,
  )
    .bind(
      id,
      job.userId,
      job.revision,
      sealed,
      job.fileName,
      job.now.toISOString(),
      maxQueuedExports,
    )
    .first();
  if (!row) return null;
  try {
    await env.WORK_QUEUE.send({ exportJob: id });
  } catch (error) {
    // Senza messaggio il lavoro non partirebbe mai: la richiesta risulta non riuscita.
    await env.DB.prepare("DELETE FROM export_jobs WHERE id = ?").bind(id).run();
    throw error;
  }
  return id;
}

const jobMessageSchema = z.object({ exportJob: z.uuid() });

export function isExportJobMessage(body: unknown): body is z.infer<typeof jobMessageSchema> {
  return jobMessageSchema.safeParse(body).success;
}

/**
 * Esegue un lavoro dalla coda. Una consegna ripetuta di un lavoro concluso non lo ripete; un
 * lavoro in corso altrove si riprova allo scadere del suo blocco, così un consumer interrotto
 * non esaurisce i tentativi del messaggio prima che il lavoro torni libero. Revoca, Premium
 * terminato, ambito ormai vuoto, XLSX oltre il limite di righe o richiesta più vecchia della
 * durata di un file lo chiudono come non riuscito, da creare di nuovo; un errore riprova con
 * backoff fino a `maxAttempts`. Il file e la conclusione del lavoro nascono nello stesso
 * commit: un errore dopo la pubblicazione non lascia un secondo file al tentativo successivo.
 */
export async function consumeExportJob(
  message: Message<unknown>,
  env: Pick<Env, "DB" | "EXPORT_FILES" | "BETTER_AUTH_SECRET">,
  now = new Date(),
): Promise<void> {
  const { exportJob: id } = jobMessageSchema.parse(message.body);
  const at = now.toISOString();
  const job = await env.DB.prepare(
    `UPDATE export_jobs SET locked_until = ?2
      WHERE id = ?1 AND state = 'queued' AND (locked_until IS NULL OR locked_until <= ?3)
      RETURNING user_id, access_revision, request_sealed, file_name, requested_at`,
  )
    .bind(id, new Date(now.getTime() + lockMilliseconds).toISOString(), at)
    .first<{
      user_id: string;
      access_revision: number;
      request_sealed: string;
      file_name: string;
      requested_at: string;
    }>();
  if (!job) {
    // Il blocco di un altro consumer: un blocco appena liberato vale come già scaduto.
    const busy = await env.DB.prepare(
      "SELECT COALESCE(locked_until, ?2) AS until FROM export_jobs WHERE id = ?1 AND state = 'queued'",
    )
      .bind(id, at)
      .first<{ until: string }>();
    if (busy)
      message.retry({
        delaySeconds: Math.max(1, Math.ceil((Date.parse(busy.until) - now.getTime()) / 1000)),
      });
    else message.ack();
    return;
  }
  // Chiude come non riuscito il lavoro ancora in coda e conferma la consegna.
  const fail = async () => {
    await env.DB.prepare(
      `UPDATE export_jobs SET state = 'failed', request_sealed = NULL, locked_until = NULL,
              finished_at = ?2
        WHERE id = ?1 AND state = 'queued'`,
    )
      .bind(id, at)
      .run();
    message.ack();
  };
  try {
    if (Date.parse(job.requested_at) + exportFileMilliseconds <= now.getTime()) return await fail();
    if ((await exportRevision(env.DB, job.user_id)) !== job.access_revision) return await fail();
    const request = JSON.parse(
      await unseal(env.BETTER_AUTH_SECRET, sealPurpose, id, job.request_sealed),
    ) as OrderFileRequest;
    const allowance = await orderAllowance(env.DB, job.user_id, now);
    const premium = !!allowance?.premium;
    if (premiumOnly(request) && !premium) return await fail();
    const [tally] = await visibleOrderTallies(
      env.DB,
      job.user_id,
      request.environment,
      now,
      request.filter,
    );
    if (!tally!.orders) return await fail();
    await publishOrderFile(env, {
      userId: job.user_id,
      revision: job.access_revision,
      request,
      fileName: job.file_name,
      now,
      // Con Premium spazio e copertura in corso esistono sempre.
      coverageEndsAt: premium ? allowance!.coverage!.endsAt : null,
      // Il lavoro diventa pronto soltanto se il file è nato.
      alongside: (fileId) =>
        env.DB.prepare(
          `UPDATE export_jobs SET state = 'ready', file_id = ?2, request_sealed = NULL,
                  locked_until = NULL, finished_at = ?3
            WHERE id = ?1 AND state = 'queued'
              AND EXISTS (SELECT 1 FROM export_files WHERE id = ?2)`,
        ).bind(id, fileId, at),
    });
    // Con il file il lavoro è già pronto e la chiusura non lo tocca; senza, una revoca è
    // arrivata durante la generazione e il lavoro non riesce.
    await fail();
  } catch (error) {
    logFailure({ error, operation: "export_files" });
    // Righe oltre il limite del foglio: un altro tentativo darebbe lo stesso esito.
    if (error instanceof XlsxRowLimitError || message.attempts >= maxAttempts) {
      await fail();
      return;
    }
    // Una pulizia non riuscita lascia scadere il blocco: il nuovo tentativo parte comunque.
    await env.DB.prepare(
      "UPDATE export_jobs SET locked_until = NULL WHERE id = ? AND state = 'queued'",
    )
      .bind(id)
      .run()
      .catch((cleanup: unknown) => logFailure({ error: cleanup, operation: "export_files" }));
    message.retry({ delaySeconds: queueRetryDelay(message.attempts) });
  }
}

/**
 * Ripresa dal compito orario `export_files`. Un lavoro in coda senza un blocco valido da oltre
 * la durata di un blocco ha perso il suo messaggio (consumer interrotto, tentativi esauriti o
 * messaggio scaduto) e si riaccoda; dopo 24 ore dalla richiesta non può più concludersi e
 * risulta non riuscito, annunciato dalla campanella. Un lavoro bloccato da un consumer in corso
 * resta a quel consumer. Restituisce quanti lavori ha riaccodato.
 */
export async function resumeExportJobs(
  env: Pick<Env, "DB" | "WORK_QUEUE">,
  now: Date,
): Promise<number> {
  const at = now.toISOString();
  const unlocked = "state = 'queued' AND (locked_until IS NULL OR locked_until <= ?1)";
  await env.DB.prepare(
    `UPDATE export_jobs SET state = 'failed', request_sealed = NULL, locked_until = NULL,
            finished_at = ?1
      WHERE ${unlocked} AND julianday(requested_at) <= julianday(?2)`,
  )
    .bind(at, new Date(now.getTime() - exportFileMilliseconds).toISOString())
    .run();
  const { results } = await env.DB.prepare(
    `SELECT id FROM export_jobs WHERE ${unlocked} AND julianday(requested_at) <= julianday(?2)
      ORDER BY requested_at LIMIT ?3`,
  )
    .bind(at, new Date(now.getTime() - lockMilliseconds).toISOString(), resumeBatch)
    .all<{ id: string }>();
  if (results.length)
    await env.WORK_QUEUE.sendBatch(results.map(({ id }) => ({ body: { exportJob: id } })));
  return results.length;
}

/** File di un'esportazione, mostrato nella sezione Esportazione. */
export interface ExportFileView {
  id: string;
  name: string;
  state: "queued" | "ready" | "failed";
  /** Istante della richiesta. */
  at: string;
  /** Scadenza del file pronto. */
  expiresAt: string | null;
}

/**
 * File dell'utente ancora utili: quelli pronti e validi all'istante `now`, i lavori in corso
 * e quelli non riusciti nelle ultime 24 ore. Un file scaduto o revocato non compare, anche se
 * i byte non sono ancora stati eliminati.
 */
export async function listExportFiles(
  db: D1Database,
  userId: string,
  now: Date,
): Promise<ExportFileView[]> {
  const at = now.toISOString();
  const since = new Date(now.getTime() - exportFileMilliseconds).toISOString();
  const { results } = await db
    .prepare(
      `SELECT id, name, state, at, expires_at FROM (
         SELECT f.id, f.file_name AS name, 'ready' AS state, f.created_at AS at, f.expires_at
           FROM export_files f
          WHERE f.user_id = ?1 AND f.expires_at > ?2
            AND f.access_revision = ${revisionSql("?1")}
         UNION ALL
         SELECT j.id, j.file_name, j.state, j.requested_at, NULL
           FROM export_jobs j
          WHERE j.user_id = ?1
            AND (j.state = 'queued' OR (j.state = 'failed' AND j.finished_at > ?3)))
        ORDER BY at DESC, id`,
    )
    .bind(userId, at, since)
    .all<{
      id: string;
      name: string;
      state: ExportFileView["state"];
      at: string;
      expires_at: string | null;
    }>();
  return results.map((row) => ({
    id: row.id,
    name: row.name,
    state: row.state,
    at: row.at,
    expiresAt: row.expires_at,
  }));
}

/**
 * Lavori conclusi da annunciare nella campanella: il file pronto finché resta scaricabile, anche
 * oltre 24 ore dalla richiesta per il tempo in coda, il lavoro non riuscito per 24 ore dalla
 * conclusione.
 */
export async function finishedExportJobs(
  db: D1Database,
  userId: string,
  now: Date,
): Promise<Array<{ id: string; name: string; ready: boolean; at: string }>> {
  const since = new Date(now.getTime() - exportFileMilliseconds).toISOString();
  const { results } = await db
    .prepare(
      `SELECT j.id, j.file_name, j.state, j.finished_at FROM export_jobs j
         LEFT JOIN export_files f ON f.id = j.file_id
        WHERE j.user_id = ?1
          AND ((j.state = 'failed' AND j.finished_at > ?3) OR (j.state = 'ready'
            AND f.expires_at > ?2 AND f.access_revision = ${revisionSql("?1")}))`,
    )
    .bind(userId, now.toISOString(), since)
    .all<{ id: string; file_name: string; state: "ready" | "failed"; finished_at: string }>();
  return results.map((row) => ({
    id: row.id,
    name: row.file_name,
    ready: row.state === "ready",
    at: row.finished_at,
  }));
}
