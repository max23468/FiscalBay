import { randomBytes } from "node:crypto";

/** Dati che il browser mostra e sincronizza per le passkey dell'utente (Signal API). */
export type PasskeySignals = {
  /** User handle WebAuthn in base64url, lo stesso delle passkey registrate da FiscalBay. */
  userId: string;
  credentialIds: string[];
  /** Email dell'account, che il selettore delle passkey mostra come nome utente. */
  name: string;
  displayName: string;
};

/**
 * User handle stabile dell'utente, creato alla prima registrazione di una passkey: 32 byte casuali
 * in base64url, entro i 64 byte ammessi da WebAuthn. Due richieste concorrenti ricevono lo stesso
 * valore.
 */
export async function passkeyUserHandle(db: D1Database, userId: string): Promise<string> {
  const row = await db
    .prepare(
      `INSERT INTO passkey_user_handles (user_id, handle) VALUES (?1, ?2)
       ON CONFLICT (user_id) DO UPDATE SET handle = passkey_user_handles.handle
       RETURNING handle`,
    )
    .bind(userId, randomBytes(32).toString("base64url"))
    .first<{ handle: string }>();
  return row!.handle;
}

/**
 * Utente WebAuthn delle opzioni di registrazione: il plugin userebbe un identificativo nuovo a ogni
 * passkey e il nome della passkey come nome utente. Qui valgono il user handle stabile, l'email
 * come nome utente e il nome dell'account come nome visualizzato.
 */
export function withPasskeyUser(
  options: Record<string, unknown>,
  user: { handle: string; email: string; name: string },
): Record<string, unknown> {
  return {
    ...options,
    user: { id: user.handle, name: user.email, displayName: user.name.trim() || user.email },
  };
}

/**
 * Stato da segnalare al browser nelle Impostazioni: null finché l'utente non ha registrato una
 * passkey con il user handle stabile, perché le precedenti ne hanno uno diverso.
 */
export async function passkeySignals(
  db: D1Database,
  user: { id: string; email: string; name: string },
): Promise<PasskeySignals | null> {
  const [handle, passkeys] = await db.batch([
    db.prepare("SELECT handle FROM passkey_user_handles WHERE user_id = ?").bind(user.id),
    db.prepare('SELECT "credentialID" FROM "passkey" WHERE "userId" = ?').bind(user.id),
  ]);
  const userId = (handle!.results as Array<{ handle: string }>)[0]?.handle;
  if (!userId) return null;
  return {
    userId,
    credentialIds: (passkeys!.results as Array<{ credentialID: string }>).map(
      (row) => row.credentialID,
    ),
    name: user.email,
    displayName: user.name.trim() || user.email,
  };
}
