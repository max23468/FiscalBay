import type { Language } from "../i18n";

/**
 * Versioni dei testi presentati alla registrazione, come data del testo in vigore
 * (`copy/legal-documents.server.ts`): una nuova versione dei Termini si propone nell'area,
 * senza bloccare alcuna funzione (D232).
 */
export const legalVersions = {
  terms: "2026-11-02",
  privacy: "2026-11-02",
} as const;

/**
 * Versione del testo del consenso marketing per ogni superficie che lo mostra: registrazione,
 * proposta negli Ordini e Notifiche delle Impostazioni hanno testi diversi, quindi la prova di
 * ogni scelta dice quale testo è stato reso. Un testo modificato richiede una nuova versione.
 */
export const marketingTextVersions = {
  registration: "registrazione-2026-10-31",
  proposal: "proposta-2026-10-27",
  settings: "impostazioni-2026-09-29",
} as const;

export type MarketingSource = keyof typeof marketingTextVersions;

/** Il tipo di account descrive chi si registra: non cambia piano, quote o limiti. */
export type Profile = {
  firstName: string;
  lastName: string;
  accountType: "private" | "business";
  companyName: string | null;
};

export type RegistrationStatus = {
  /**
   * Termini accettati in una qualunque versione: completa la registrazione. Una versione nuova
   * non accettata non blocca alcuna funzione (D232).
   */
  termsAccepted: boolean;
  /** Accettata la versione corrente dei Termini; altrimenti l'area ne propone l'accettazione. */
  termsCurrent: boolean;
  /** Esiste già una scelta sul consenso marketing, di qualunque superficie. */
  marketingChosen: boolean;
  profile: Profile | null;
};

/** Legge il profilo dal modulo; null se manca un campo obbligatorio o supera la lunghezza. */
export function parseProfile(form: FormData): Profile | null {
  const text = (name: string, max: number) => {
    const value = String(form.get(name) ?? "").trim();
    return value.length <= max ? value : null;
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
  // FROM (SELECT 1) conserva una riga anche senza profilo; i suoi campi obbligatori
  // sono tutti presenti insieme, grazie ai vincoli di user_profiles.
  const row = (await db
    .prepare(
      `SELECT p.first_name, p.last_name, p.account_type, p.company_name,
              EXISTS (SELECT 1 FROM terms_acceptances WHERE user_id = ?1) AS terms_accepted,
              EXISTS (
                SELECT 1 FROM terms_acceptances WHERE user_id = ?1 AND terms_version = ?2
              ) AS terms_current,
              EXISTS (SELECT 1 FROM marketing_consents WHERE user_id = ?1) AS marketing_chosen
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
      terms_current: number;
      marketing_chosen: number;
    }>())!;
  return {
    termsAccepted: row.terms_accepted === 1,
    termsCurrent: row.terms_current === 1,
    marketingChosen: row.marketing_chosen === 1,
    profile: row.first_name
      ? {
          firstName: row.first_name,
          lastName: row.last_name!,
          accountType: row.account_type!,
          companyName: row.company_name,
        }
      : null,
  };
}

export function registrationComplete(
  status: Pick<RegistrationStatus, "termsAccepted" | "profile">,
): boolean {
  return status.termsAccepted && status.profile !== null;
}

/**
 * Salva in una transazione ciò che la registrazione ha raccolto: il profilo, e
 * l'accettazione dei Termini con la scelta marketing, tenute in tabelle distinte. La scelta
 * marketing si registra soltanto se il modulo l'ha chiesta: chi accetta una nuova versione dei
 * Termini e ha già scelto conserva la propria scelta. Il primo
 * profilo salvato con la lista d'attesa attiva mette l'account in attesa; le modifiche
 * successive non lo cambiano. Il frammento della lista d'attesa è scritto qui perché gli script
 * Node caricano questo modulo senza risolvere altri import.
 */
export async function completeRegistration(
  db: D1Database,
  input: {
    userId: string;
    language: Language;
    now: Date;
    profile?: Profile;
    /** `marketing` assente quando il modulo non ha mostrato la casella. */
    agreement?: { marketing?: boolean };
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
             (user_id, first_name, last_name, account_type, company_name, updated_at, waitlisted_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, CASE WHEN EXISTS (
             SELECT 1 FROM admission_settings WHERE free_waitlist = 1) THEN ?6 END)
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
    const { marketing } = input.agreement;
    statements.push(
      db
        .prepare(
          `INSERT INTO terms_acceptances
             (user_id, terms_version, privacy_version, language, accepted_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT (user_id, terms_version) DO NOTHING`,
        )
        .bind(input.userId, legalVersions.terms, legalVersions.privacy, input.language, at),
    );
    if (marketing !== undefined)
      statements.push(
        db
          .prepare(
            `INSERT INTO marketing_consents
               (id, user_id, granted, text_version, language, recorded_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            crypto.randomUUID(),
            input.userId,
            marketing ? 1 : 0,
            marketingTextVersions.registration,
            input.language,
            at,
          ),
      );
  }
  if (statements.length > 0) await db.batch(statements);
}
