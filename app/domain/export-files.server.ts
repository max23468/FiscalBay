/**
 * File temporanei delle esportazioni nel bucket R2 dell'ambiente. La chiave dell'oggetto è un
 * identificativo casuale, senza dati personali; nome del file, tipo, revisione di accesso dello
 * spazio e scadenza stanno nella riga D1, che decide a ogni download se il file vale ancora.
 * Il bucket non ha accesso pubblico né URL prefirmati: i byte passano soltanto dal Worker.
 */

/** Durata massima di un file. */
export const exportFileMilliseconds = 24 * 60 * 60_000;

/**
 * Parte di un caricamento multiparte. R2 vuole parti uguali, salvo l'ultima, di almeno 5 MiB:
 * un file più piccolo di una parte si scrive in una sola richiesta.
 */
export const exportPartBytes = 8 * 1024 * 1024;

/**
 * Revisione di accesso dello spazio dell'utente; 0 se lo spazio non esiste ancora. Argomento:
 * espressione SQL dell'utente.
 */
export const revisionSql = (user: string) =>
  `COALESCE((SELECT w.access_revision FROM workspace_members m
    JOIN workspaces w ON w.id = m.workspace_id WHERE m.user_id = ${user}), 0)`;

/**
 * Revisione da leggere prima di leggere i dati del file: se cambia durante la generazione, il
 * file non diventa scaricabile.
 */
export async function exportRevision(db: D1Database, userId: string): Promise<number> {
  const row = await db
    .prepare(`SELECT ${revisionSql("?")} AS revision`)
    .bind(userId)
    .first<{ revision: number }>();
  return row!.revision;
}

function concat(chunks: Uint8Array[], size: number): Uint8Array {
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

/**
 * Scrive il flusso nell'oggetto senza tenerlo intero in memoria: oltre una parte usa il
 * caricamento multiparte, a parti di `exportPartBytes`. Un errore del flusso o di R2 annulla
 * il caricamento, così nessun oggetto parziale resta nel bucket.
 */
async function writeObject(
  bucket: R2Bucket,
  key: string,
  body: ReadableStream<Uint8Array>,
  contentType: string,
): Promise<void> {
  const reader = body.getReader();
  const options = { httpMetadata: { contentType } };
  let chunks: Uint8Array[] = [];
  let size = 0;
  let upload: R2MultipartUpload | undefined;
  const parts: R2UploadedPart[] = [];
  const send = async (bytes: Uint8Array) => {
    upload ??= await bucket.createMultipartUpload(key, options);
    parts.push(await upload.uploadPart(parts.length + 1, bytes));
  };
  try {
    // Stryker disable BlockStatement,AssignmentOperator: un corpo vuoto o una dimensione che cresce lasciano i cicli senza uscita e Stryker li conta come Timeout; la prova con un file di più parti verifica ogni parte.
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.length;
      while (size >= exportPartBytes) {
        const bytes = concat(chunks, size);
        await send(bytes.subarray(0, exportPartBytes));
        chunks = [bytes.subarray(exportPartBytes)];
        size -= exportPartBytes;
      }
    }
    // Stryker restore BlockStatement,AssignmentOperator
    if (!upload) {
      await bucket.put(key, concat(chunks, size), options);
      return;
    }
    if (size > 0) await send(concat(chunks, size));
    await upload.complete(parts);
  } catch (error) {
    await reader.cancel(error).catch(() => {});
    await upload?.abort().catch(() => {});
    throw error;
  }
}

/**
 * Salva il file e lo rende scaricabile per l'utente fino a `expiresAt`, al più 24 ore. La riga
 * nasce soltanto se la revisione dello spazio è ancora `revision`: un file generato prima di una
 * revoca non diventa scaricabile e il suo oggetto si elimina subito. Restituisce l'identificativo
 * del file, null se una revoca è arrivata durante la generazione.
 */
export async function publishExportFile(
  env: Pick<Env, "DB" | "EXPORT_FILES">,
  file: {
    userId: string;
    revision: number;
    fileName: string;
    contentType: string;
    body: ReadableStream<Uint8Array>;
    now: Date;
    expiresAt?: string | null;
  },
): Promise<string | null> {
  const id = crypto.randomUUID();
  await writeObject(env.EXPORT_FILES, id, file.body, file.contentType);
  const latest = new Date(file.now.getTime() + exportFileMilliseconds).toISOString();
  // Stryker disable EqualityOperator: a parità di istante i due termini coincidono.
  const expiresAt =
    file.expiresAt && Date.parse(file.expiresAt) < Date.parse(latest) ? file.expiresAt : latest;
  // Stryker restore EqualityOperator
  let published = false;
  try {
    const row = await env.DB.prepare(
      `INSERT INTO export_files
        (id, user_id, file_name, content_type, access_revision, created_at, expires_at)
       SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7 WHERE ${revisionSql("?2")} = ?5 AND ?7 > ?6
       RETURNING id`,
    )
      .bind(
        id,
        file.userId,
        file.fileName,
        file.contentType,
        file.revision,
        file.now.toISOString(),
        expiresAt,
      )
      .first();
    published = !!row;
  } finally {
    if (!published) await env.EXPORT_FILES.delete(id);
  }
  return published ? id : null;
}

/**
 * File dell'utente ancora valido all'istante `now`, con i byte da trasmettere: scaduto,
 * revocato, di un altro utente o già eliminato vale come assente, anche se l'oggetto esiste.
 */
export async function openExportFile(
  env: Pick<Env, "DB" | "EXPORT_FILES">,
  userId: string,
  id: string,
  now: Date,
): Promise<{ fileName: string; contentType: string; object: R2ObjectBody } | null> {
  const file = await env.DB.prepare(
    `SELECT file_name, content_type FROM export_files
      WHERE id = ?1 AND user_id = ?2 AND expires_at > ?3 AND access_revision = ${revisionSql("?2")}`,
  )
    .bind(id, userId, now.toISOString())
    .first<{ file_name: string; content_type: string }>();
  if (!file) return null;
  const object = await env.EXPORT_FILES.get(id);
  return object ? { fileName: file.file_name, contentType: file.content_type, object } : null;
}

/** Righe eliminate per giro: R2 elimina al più mille chiavi per richiesta. */
const purgeBatch = 500;

/**
 * Pulizia applicativa: elimina oggetti e righe dei file scaduti o revocati. L'oggetto si
 * elimina prima della riga, così un errore di R2 lascia la riga al turno successivo. Gli
 * oggetti rimasti senza riga, per esempio dopo la cancellazione dell'account, li elimina la
 * regola di lifecycle del bucket. Elimina poi i lavori di esportazione conclusi o mai partiti
 * dopo 24 ore dalla richiesta. Restituisce quanti file ha eliminato.
 */
export async function purgeExportFiles(
  env: Pick<Env, "DB" | "EXPORT_FILES">,
  now: Date,
): Promise<number> {
  let purged = 0;
  // Stryker disable BlockStatement,ConditionalExpression,EqualityOperator,ArrowFunction: un corpo vuoto, un'uscita mancata o identificativi persi lasciano il ciclo senza uscita e Stryker li conta come Timeout; le prove di pulizia verificano righe e oggetti eliminati.
  for (;;) {
    const { results } = await env.DB.prepare(
      `SELECT id FROM export_files
        WHERE expires_at <= ?1 OR access_revision <> ${revisionSql("export_files.user_id")}
        LIMIT ?2`,
    )
      .bind(now.toISOString(), purgeBatch)
      .run<{ id: string }>();
    if (results.length === 0) break;
    const ids = results.map(({ id }) => id);
    await env.EXPORT_FILES.delete(ids);
    await env.DB.prepare(`DELETE FROM export_files WHERE id IN (SELECT value FROM json_each(?))`)
      .bind(JSON.stringify(ids))
      .run();
    purged += ids.length;
  }
  // Stryker restore BlockStatement,ConditionalExpression,EqualityOperator,ArrowFunction
  // I lavori valgono quanto un file: dopo 24 ore dalla richiesta non servono più.
  await env.DB.prepare("DELETE FROM export_jobs WHERE julianday(requested_at) <= julianday(?)")
    .bind(new Date(now.getTime() - exportFileMilliseconds).toISOString())
    .run();
  return purged;
}
