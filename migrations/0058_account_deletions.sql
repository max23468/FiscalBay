-- Cancellazione dell'account. La conferma dal link email registra la richiesta e ferma accesso,
-- letture e notifiche; il lavoro dalla coda ferma i rinnovi, scrive i segni dei negozi, elimina i
-- dati operativi e per ultimo l'utente Auth. Utente e spazio restano come identificativi senza
-- vincoli, perché sopravvivono alle righe che indicano: la richiesta è il marker da riapplicare
-- dopo un restore e si elimina trenta giorni dopo la conclusione, la finestra di Time Travel.
-- Indirizzo e lingua dell'email finale restano cifrati soltanto finché non parte.
CREATE TABLE account_deletions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  workspace_id TEXT,
  notice_sealed TEXT,
  notice_attempts INTEGER NOT NULL DEFAULT 0 CHECK (notice_attempts >= 0),
  requested_at TEXT NOT NULL CHECK (julianday(requested_at) IS NOT NULL),
  renewals_stopped_at TEXT CHECK (renewals_stopped_at IS NULL
    OR julianday(renewals_stopped_at) IS NOT NULL),
  renewals_blocked_at TEXT CHECK (renewals_blocked_at IS NULL
    OR julianday(renewals_blocked_at) IS NOT NULL),
  user_deleted_at TEXT CHECK (user_deleted_at IS NULL OR julianday(user_deleted_at) IS NOT NULL),
  completed_at TEXT CHECK (completed_at IS NULL OR julianday(completed_at) IS NOT NULL),
  locked_until TEXT,
  CHECK (completed_at IS NULL OR (renewals_stopped_at IS NOT NULL AND notice_sealed IS NULL))
);

CREATE INDEX account_deletions_pending_idx ON account_deletions(completed_at, requested_at);
CREATE INDEX account_deletions_workspace_idx ON account_deletions(workspace_id);

-- Segno minimo di un negozio reale dopo la cancellazione del suo spazio: impronta SHA-256
-- dell'identità eBay, prova già usata e ciclo del Free in corso con i suoi sblocchi. Un nuovo
-- spazio che collega lo stesso negozio non riceve una nuova prova né la quota azzerata. Nessun
-- nome, ordine o dato fiscale; la pulizia giornaliera lo elimina alla scadenza.
CREATE TABLE store_identity_marks (
  identity_hash TEXT PRIMARY KEY CHECK (length(identity_hash) = 64),
  trial_used INTEGER NOT NULL CHECK (trial_used IN (0, 1)),
  cycle_anchor_at TEXT CHECK (cycle_anchor_at IS NULL OR julianday(cycle_anchor_at) IS NOT NULL),
  cycle_starts_at TEXT,
  cycle_ends_at TEXT,
  cycle_quota INTEGER CHECK (cycle_quota IS NULL OR cycle_quota > 0),
  cycle_used INTEGER CHECK (cycle_used IS NULL OR cycle_used BETWEEN 0 AND cycle_quota),
  recorded_at TEXT NOT NULL CHECK (julianday(recorded_at) IS NOT NULL),
  expires_at TEXT NOT NULL CHECK (julianday(expires_at) > julianday(recorded_at)),
  CHECK ((cycle_starts_at IS NULL) = (cycle_ends_at IS NULL)),
  CHECK ((cycle_starts_at IS NULL) = (cycle_used IS NULL)),
  CHECK (cycle_starts_at IS NULL OR julianday(cycle_ends_at) > julianday(cycle_starts_at))
) WITHOUT ROWID;

CREATE INDEX store_identity_marks_expiry_idx ON store_identity_marks(expires_at);

-- Prova già usata con lo stesso negozio in uno spazio cancellato: la prova non si offre più.
ALTER TABLE workspaces ADD COLUMN trial_used_at TEXT
  CHECK (trial_used_at IS NULL OR julianday(trial_used_at) IS NOT NULL);
