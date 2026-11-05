import type { SignupSource } from "../signup-source";

/**
 * Salva la provenienza di un nuovo account una volta sola (D303): una seconda scrittura per lo
 * stesso utente non cambia nulla. Senza segnale la categoria è «unknown», mai indovinata. La riga
 * segue l'utente e sparisce con la sua cancellazione.
 */
export async function recordSignupSource(
  db: D1Database,
  userId: string,
  source: SignupSource | null,
  now: Date,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO signup_sources (user_id, channel, first_page, recorded_at)
       VALUES (?, ?, ?, ?) ON CONFLICT (user_id) DO NOTHING`,
    )
    .bind(userId, source?.channel ?? "unknown", source?.firstPage ?? null, now.toISOString())
    .run();
}
