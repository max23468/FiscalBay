/** Incrementa il limite per indirizzo nella stessa istruzione che apre la sua finestra. */
export async function countAuthAttempt(
  db: D1Database,
  key: string,
  rule: { window: number; max: number },
  now: number,
): Promise<number | null> {
  const windowMs = rule.window * 1000;
  const row = await db
    .prepare(`INSERT INTO "rateLimit" ("id", "key", "count", "lastRequest") VALUES (?1, ?2, 1, ?3)
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN ?3 - "lastRequest" >= ?4 THEN 1 ELSE "count" + 1 END,
      "lastRequest" = CASE WHEN ?3 - "lastRequest" >= ?4 THEN ?3 ELSE "lastRequest" END
    RETURNING "count", "lastRequest"`)
    .bind(crypto.randomUUID(), key, now, windowMs)
    .first<{ count: number; lastRequest: number }>();
  if (!row || row.count <= rule.max) return null;
  return Math.max(1, Math.ceil((row.lastRequest + windowMs - now) / 1000));
}

/** Secondi di attesa di una finestra già oltre il limite, senza contare un nuovo tentativo. */
export async function authAttemptWait(
  db: D1Database,
  key: string,
  rule: { window: number; max: number },
  now: number,
): Promise<number | null> {
  const windowMs = rule.window * 1000;
  const row = await db
    .prepare(
      `SELECT "count", "lastRequest" FROM "rateLimit" WHERE "key" = ?1 AND ?2 - "lastRequest" < ?3`,
    )
    .bind(key, now, windowMs)
    .first<{ count: number; lastRequest: number }>();
  if (!row || row.count < rule.max) return null;
  return Math.max(1, Math.ceil((row.lastRequest + windowMs - now) / 1000));
}

/** Finestra più lunga dei limiti per indirizzo, in secondi: oltre, un tentativo non conta più. */
export const longestAttemptWindow = 3600;

/** Tentativi le cui finestre sono chiuse, dalla pulizia giornaliera. */
export function purgeAuthAttempts(db: D1Database, now: number) {
  return db
    .prepare('DELETE FROM "rateLimit" WHERE "lastRequest" < ?')
    .bind(now - longestAttemptWindow * 1000);
}
