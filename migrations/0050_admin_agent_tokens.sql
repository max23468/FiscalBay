-- Accesso tecnico alla console in sola lettura, per l'agente che assiste l'owner quando la
-- passkey non è disponibile. Si conserva soltanto l'impronta SHA-256 del token, che vive nel
-- Portachiavi dell'owner; la revoca vale dalla richiesta successiva.
CREATE TABLE admin_agent_tokens (
  token_hash TEXT PRIMARY KEY CHECK (length(token_hash) = 64),
  label TEXT NOT NULL CHECK (length(trim(label)) BETWEEN 1 AND 100),
  created_at TEXT NOT NULL CHECK (julianday(created_at) IS NOT NULL),
  revoked_at TEXT CHECK (revoked_at IS NULL OR julianday(revoked_at) IS NOT NULL),
  used_at TEXT CHECK (used_at IS NULL OR julianday(used_at) IS NOT NULL)
);
