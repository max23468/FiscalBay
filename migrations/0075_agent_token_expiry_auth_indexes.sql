-- Il token tecnico della console (D213) apre le stesse letture e operazioni della sessione admin
-- con passkey, non la sola lettura descritta in 0050. Ora scade: dopo `expires_at` non apre più
-- la console e la rotazione ne registra uno nuovo. I token già presenti valgono 90 giorni dalla
-- creazione.
ALTER TABLE admin_agent_tokens
  ADD COLUMN expires_at TEXT CHECK (expires_at IS NULL OR julianday(expires_at) IS NOT NULL);
UPDATE admin_agent_tokens
  SET expires_at = strftime('%Y-%m-%dT%H:%M:%fZ', created_at, '+90 days')
  WHERE expires_at IS NULL;

-- La pulizia giornaliera delle tabelle di Auth legge soltanto le righe scadute.
CREATE INDEX session_expiresAt_idx ON "session" ("expiresAt");
CREATE INDEX verification_expiresAt_idx ON "verification" ("expiresAt");
CREATE INDEX rateLimit_lastRequest_idx ON "rateLimit" ("lastRequest");
