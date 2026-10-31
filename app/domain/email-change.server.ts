/** Stato della richiesta, distinto dall'indirizzo di accesso effettivo gestito da Auth. */
export interface PendingEmailChange {
  new_email: string;
  stage: "current" | "new";
  expires_at: string;
}

export const emailVerificationSeconds = 3600;

export async function pendingEmailChange(db: D1Database, userId: string, email: string) {
  await db
    .prepare(
      "DELETE FROM account_email_changes WHERE user_id = ? AND (expires_at <= ? OR current_email <> ?)",
    )
    .bind(userId, new Date().toISOString(), email)
    .run();
  return db
    .prepare("SELECT new_email, stage, expires_at FROM account_email_changes WHERE user_id = ?")
    .bind(userId)
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
    .bind(
      userId,
      email,
      newEmail.toLowerCase(),
      new Date(Date.now() + emailVerificationSeconds * 1000).toISOString(),
    )
    .run();
}
