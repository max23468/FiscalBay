import type { Language } from "../i18n";

/**
 * Versioni dei testi presentati alla registrazione. Termini e informativa sono bozze finché
 * il testo definitivo non viene pubblicato: una nuova versione dei Termini richiede una nuova
 * accettazione prima di usare il servizio.
 */
export const legalVersions = {
  terms: "bozza-2026-09-28",
  privacy: "bozza-2026-09-28",
  marketing: "2026-09-28",
} as const;

export async function hasAcceptedTerms(db: D1Database, userId: string): Promise<boolean> {
  const row = await db
    .prepare("SELECT 1 FROM terms_acceptances WHERE user_id = ? AND terms_version = ?")
    .bind(userId, legalVersions.terms)
    .first();
  return row !== null;
}

/** Registra insieme l'accettazione dei Termini e la scelta marketing, tenute in tabelle distinte. */
export async function recordAgreement(
  db: D1Database,
  input: { userId: string; language: Language; marketing: boolean; now: Date },
): Promise<void> {
  const at = input.now.toISOString();
  await db.batch([
    db
      .prepare(
        `INSERT INTO terms_acceptances (user_id, terms_version, privacy_version, language, accepted_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (user_id, terms_version) DO NOTHING`,
      )
      .bind(input.userId, legalVersions.terms, legalVersions.privacy, input.language, at),
    db
      .prepare(
        `INSERT INTO marketing_consents (id, user_id, granted, text_version, language, recorded_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        input.userId,
        input.marketing ? 1 : 0,
        legalVersions.marketing,
        input.language,
        at,
      ),
  ]);
}
