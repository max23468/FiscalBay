/**
 * Limite del modulo di assistenza per account: D1 conserva soltanto l'istante di ogni richiesta
 * inviata, che la manutenzione elimina dopo 24 ore. Il modulo resta senza testi
 * dell'interfaccia, così la manutenzione lo carica senza il modulo email.
 */

/** Richieste per account nelle ultime 24 ore. */
export const supportRequestLimit = 5;
export const supportWindowMilliseconds = 24 * 60 * 60_000;

/**
 * Prenota una richiesta entro il limite delle 24 ore, in un'unica istruzione: due schede che
 * inviano insieme non superano il limite. Null se il limite è raggiunto.
 */
export async function reserveSupportRequest(
  db: D1Database,
  userId: string,
  now = new Date(),
): Promise<string | null> {
  const id = crypto.randomUUID();
  const since = new Date(now.getTime() - supportWindowMilliseconds).toISOString();
  const result = await db
    .prepare(
      `INSERT INTO support_requests (id, user_id, sent_at)
       SELECT ?1, ?2, ?3 WHERE (SELECT COUNT(*) FROM support_requests
         WHERE user_id = ?2 AND sent_at > ?4) < ?5`,
    )
    .bind(id, userId, now.toISOString(), since, supportRequestLimit)
    .run();
  return result.meta.changes === 1 ? id : null;
}

/** Un invio non riuscito non consuma il limite. */
export async function releaseSupportRequest(db: D1Database, id: string): Promise<void> {
  await db.prepare("DELETE FROM support_requests WHERE id = ?").bind(id).run();
}

/** Istanti delle richieste oltre la finestra del limite: non servono più. */
export function purgeSupportRequests(db: D1Database, now = new Date()): D1PreparedStatement {
  return db
    .prepare("DELETE FROM support_requests WHERE sent_at <= ?")
    .bind(new Date(now.getTime() - supportWindowMilliseconds).toISOString());
}
