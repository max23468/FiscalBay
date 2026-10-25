/**
 * Frammenti SQL dell'ammissione, condivisi da diritti, letture e acquisti. Gli interruttori
 * vivono in `admission_settings`; senza la riga nessuna lista d'attesa e acquisti aperti.
 */

/** Lista d'attesa per i nuovi Free attiva. */
export const waitlistOnSql = "EXISTS (SELECT 1 FROM admission_settings WHERE free_waitlist = 1)";

/** Acquisti e prove aperti. */
export const purchasesOpenSql =
  "NOT EXISTS (SELECT 1 FROM admission_settings WHERE purchases_open = 0)";

/** Spazio in lista d'attesa: un suo membro non è ancora stato ammesso. */
export function waitingSql(workspace: string) {
  return `EXISTS (SELECT 1 FROM workspace_members m JOIN user_profiles p ON p.user_id = m.user_id
    WHERE m.workspace_id = ${workspace} AND p.waitlisted_at IS NOT NULL)`;
}
