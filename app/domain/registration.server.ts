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

/** Il tipo di account descrive chi si registra: non cambia piano, quote o limiti. */
export type Profile = {
  firstName: string;
  lastName: string;
  accountType: "private" | "business";
  companyName: string | null;
};

export type RegistrationStatus = { termsAccepted: boolean; profile: Profile | null };

/** Legge il profilo dal modulo; null se manca un campo obbligatorio o supera la lunghezza. */
export function parseProfile(form: FormData): Profile | null {
  const text = (name: string, max: number) => {
    const value = String(form.get(name) ?? "").trim();
    return value.length > 0 && value.length <= max ? value : null;
  };
  const type = form.get("tipo");
  const accountType = type === "azienda" ? "business" : type === "privato" ? "private" : null;
  const firstName = text("nome", 100);
  const lastName = text("cognome", 100);
  const companyName = accountType === "business" ? text("ragione_sociale", 200) : null;
  if (!accountType || !firstName || !lastName) return null;
  if (accountType === "business" && !companyName) return null;
  return { firstName, lastName, accountType, companyName };
}

export async function registrationStatus(
  db: D1Database,
  userId: string,
): Promise<RegistrationStatus> {
  const row = await db
    .prepare(
      `SELECT p.first_name, p.last_name, p.account_type, p.company_name,
              EXISTS (
                SELECT 1 FROM terms_acceptances WHERE user_id = ?1 AND terms_version = ?2
              ) AS terms_accepted
         FROM (SELECT 1)
         LEFT JOIN user_profiles p ON p.user_id = ?1`,
    )
    .bind(userId, legalVersions.terms)
    .first<{
      first_name: string | null;
      last_name: string | null;
      account_type: Profile["accountType"] | null;
      company_name: string | null;
      terms_accepted: number;
    }>();
  return {
    termsAccepted: row?.terms_accepted === 1,
    profile:
      row?.first_name && row.last_name && row.account_type
        ? {
            firstName: row.first_name,
            lastName: row.last_name,
            accountType: row.account_type,
            companyName: row.company_name,
          }
        : null,
  };
}

export function registrationComplete(status: RegistrationStatus): boolean {
  return status.termsAccepted && status.profile !== null;
}

/**
 * Salva in una transazione ciò che la registrazione ha raccolto: il profilo, e
 * l'accettazione dei Termini con la scelta marketing, tenute in tabelle distinte.
 */
export async function completeRegistration(
  db: D1Database,
  input: {
    userId: string;
    language: Language;
    now: Date;
    profile?: Profile;
    agreement?: { marketing: boolean };
  },
): Promise<void> {
  const at = input.now.toISOString();
  const statements: D1PreparedStatement[] = [];
  if (input.profile) {
    const { firstName, lastName, accountType, companyName } = input.profile;
    statements.push(
      db
        .prepare(
          `INSERT INTO user_profiles
             (user_id, first_name, last_name, account_type, company_name, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT (user_id) DO UPDATE SET
             first_name = excluded.first_name,
             last_name = excluded.last_name,
             account_type = excluded.account_type,
             company_name = excluded.company_name,
             updated_at = excluded.updated_at`,
        )
        .bind(input.userId, firstName, lastName, accountType, companyName, at),
      db
        .prepare('UPDATE "user" SET "name" = ? WHERE "id" = ?')
        .bind(`${firstName} ${lastName}`, input.userId),
    );
  }
  if (input.agreement) {
    statements.push(
      db
        .prepare(
          `INSERT INTO terms_acceptances
             (user_id, terms_version, privacy_version, language, accepted_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT (user_id, terms_version) DO NOTHING`,
        )
        .bind(input.userId, legalVersions.terms, legalVersions.privacy, input.language, at),
      db
        .prepare(
          `INSERT INTO marketing_consents
             (id, user_id, granted, text_version, language, recorded_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          crypto.randomUUID(),
          input.userId,
          input.agreement.marketing ? 1 : 0,
          legalVersions.marketing,
          input.language,
          at,
        ),
    );
  }
  if (statements.length > 0) await db.batch(statements);
}
