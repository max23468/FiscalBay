-- Identificativo WebAuthn dell'utente (user handle), uguale per tutte le sue nuove passkey: il
-- browser e i gestori di password lo usano per aggiornare nome ed elenco delle passkey valide.
-- Casuale e senza dati personali; le passkey registrate prima conservano il proprio.
CREATE TABLE passkey_user_handles (
  user_id TEXT PRIMARY KEY REFERENCES "user"("id") ON DELETE CASCADE,
  handle TEXT NOT NULL UNIQUE CHECK (length(handle) BETWEEN 1 AND 86)
);
