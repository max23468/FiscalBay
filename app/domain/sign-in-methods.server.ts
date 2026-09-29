/** Metodi di accesso con un account Better Auth; le passkey stanno nella loro tabella. */
export const accountMethods = { password: "credential", google: "google", ebay: "ebay" } as const;

export type AccountMethod = keyof typeof accountMethods;

export type SignInMethods = {
  accounts: Record<AccountMethod, boolean>;
  passkeys: Array<{ id: string; name: string | null; createdAt: string | null }>;
};

// Un account vale come accesso se è OAuth o se la password non è vuota.
const validAccount = `("providerId" IN ('google', 'ebay') OR ("providerId" = 'credential' AND LENGTH("password") > 0))`;

export async function listSignInMethods(db: D1Database, userId: string): Promise<SignInMethods> {
  const [accounts, passkeys] = await db.batch([
    db
      .prepare(`SELECT DISTINCT "providerId" FROM "account" WHERE "userId" = ? AND ${validAccount}`)
      .bind(userId),
    db
      .prepare(
        'SELECT "id", "name", "createdAt" FROM "passkey" WHERE "userId" = ? ORDER BY "createdAt" DESC',
      )
      .bind(userId),
  ]);
  const providers = new Set(
    (accounts!.results as Array<{ providerId: string }>).map((row) => row.providerId),
  );
  return {
    accounts: {
      password: providers.has(accountMethods.password),
      google: providers.has(accountMethods.google),
      ebay: providers.has(accountMethods.ebay),
    },
    passkeys: passkeys!.results as SignInMethods["passkeys"],
  };
}

/**
 * Rimuove un metodo solo se ne resta un altro valido, in una sola istruzione: due rimozioni
 * concorrenti non possono lasciare l'utente senza accesso. Restituisce false se non rimosso.
 */
export async function removeAccountMethod(
  db: D1Database,
  userId: string,
  method: AccountMethod,
): Promise<boolean> {
  const removed = await db
    .prepare(
      `DELETE FROM "account" WHERE "userId" = ?1 AND "providerId" = ?2
       AND (EXISTS (SELECT 1 FROM "account" WHERE "userId" = ?1 AND "providerId" <> ?2 AND ${validAccount})
         OR EXISTS (SELECT 1 FROM "passkey" WHERE "userId" = ?1))
       RETURNING "id"`,
    )
    .bind(userId, accountMethods[method])
    .all();
  return removed.results.length > 0;
}

/** Come removeAccountMethod, per una passkey dell'utente. */
export async function removePasskey(db: D1Database, userId: string, id: string): Promise<boolean> {
  const removed = await db
    .prepare(
      `DELETE FROM "passkey" WHERE "id" = ?1 AND "userId" = ?2
       AND (EXISTS (SELECT 1 FROM "account" WHERE "userId" = ?2 AND ${validAccount})
         OR (SELECT COUNT(*) FROM "passkey" WHERE "userId" = ?2) > 1)
       RETURNING "id"`,
    )
    .bind(id, userId)
    .first<{ id: string }>();
  return removed !== null;
}
