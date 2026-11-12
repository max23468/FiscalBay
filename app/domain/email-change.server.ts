/** Stato della richiesta, distinto dall'indirizzo di accesso effettivo gestito da Auth. */
export interface PendingEmailChange {
  newEmail: string;
  /** Link da confermare: quello al vecchio indirizzo, poi quello al nuovo. */
  stage: "current" | "new";
  expiresAt: string;
}

export const emailVerificationSeconds = 3600;

const linkExpiry = () => new Date(Date.now() + emailVerificationSeconds * 1000).toISOString();

/**
 * Richiesta in corso per l'indirizzo di accesso `email`: una scaduta, o nata da un indirizzo
 * che non è più quello di accesso, non vale. Le righe scadute le elimina la manutenzione.
 */
export function pendingEmailChange(
  db: D1Database,
  userId: string,
  email: string,
  now = new Date(),
) {
  return db
    .prepare(`SELECT new_email AS newEmail, stage, expires_at AS expiresAt
      FROM account_email_changes WHERE user_id = ? AND expires_at > ? AND current_email = ?`)
    .bind(userId, now.toISOString(), email)
    .first<PendingEmailChange>();
}

/** Anche un indirizzo occupato conserva lo stesso stato, senza rivelare altri account. */
export async function recordEmailChange(
  db: D1Database,
  userId: string,
  email: string,
  newEmail: string,
) {
  await db
    .prepare(
      `INSERT INTO account_email_changes (user_id, current_email, new_email, stage, expires_at)
     VALUES (?, ?, ?, 'current', ?)
     ON CONFLICT(user_id) DO UPDATE SET current_email = excluded.current_email,
       new_email = excluded.new_email, stage = 'current', expires_at = excluded.expires_at`,
    )
    .bind(userId, email, newEmail.toLowerCase(), linkExpiry())
    .run();
}

/**
 * Il primo link è confermato: il secondo arriva al nuovo indirizzo `newEmail`, con una nuova
 * scadenza. False se l'utente non ha un cambio verso quell'indirizzo.
 */
export async function advanceEmailChange(db: D1Database, userId: string, newEmail: string) {
  const change = await db
    .prepare(
      "UPDATE account_email_changes SET stage = 'new', expires_at = ? WHERE user_id = ? AND new_email = ?",
    )
    .bind(linkExpiry(), userId, newEmail)
    .run();
  return change.meta.changes > 0;
}

/** Cambio concluso: l'indirizzo confermato è ora quello di accesso. */
export function clearEmailChange(db: D1Database, userId: string) {
  return db.prepare("DELETE FROM account_email_changes WHERE user_id = ?").bind(userId);
}
