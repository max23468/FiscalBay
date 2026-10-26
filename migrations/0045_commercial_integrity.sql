-- Sessione Checkout di mensile o annuale aperta dallo spazio: una sola alla volta, come per il
-- lifetime. La riga si prende prima di creare la sessione (`claim`), poi riceve la sessione
-- prima che il cliente ne abbia l'indirizzo; una nuova richiesta chiude quella precedente.
CREATE TABLE subscription_checkouts (
  workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  claim TEXT NOT NULL,
  session_id TEXT UNIQUE,
  expires_at TEXT NOT NULL CHECK (julianday(expires_at) IS NOT NULL),
  created_at TEXT NOT NULL CHECK (julianday(created_at) IS NOT NULL)
);

-- Prova del lifetime: la sessione Checkout pagata oppure autore e motivo dell'omaggio.
CREATE TRIGGER lifetime_requires_proof BEFORE INSERT ON workspace_entitlements
WHEN NEW.source = 'lifetime' AND NEW.stripe_checkout_session_id IS NULL
  AND (length(trim(COALESCE(NEW.granted_by, ''))) = 0
    OR length(trim(COALESCE(NEW.grant_reason, ''))) = 0)
BEGIN
  SELECT RAISE(ABORT, 'lifetime_without_proof');
END;

-- Versioni precedenti di una promozione modificata: un ciclo riceve la quota della promozione
-- come era configurata al suo inizio, anche se la sua riga si crea dopo la modifica.
ALTER TABLE free_promotions ADD COLUMN updated_at TEXT
  CHECK (updated_at IS NULL OR julianday(updated_at) IS NOT NULL);
CREATE TABLE free_promotion_changes (
  id INTEGER PRIMARY KEY,
  promotion_id TEXT NOT NULL REFERENCES free_promotions(id) ON DELETE CASCADE,
  previous_starts_at TEXT NOT NULL,
  previous_ends_at TEXT NOT NULL,
  previous_quota INTEGER NOT NULL,
  changed_at TEXT NOT NULL
);
CREATE INDEX free_promotion_changes_idx ON free_promotion_changes(promotion_id, changed_at);

CREATE TRIGGER free_promotion_change_is_dated BEFORE UPDATE ON free_promotions
WHEN (NEW.starts_at IS NOT OLD.starts_at OR NEW.ends_at IS NOT OLD.ends_at
    OR NEW.quota IS NOT OLD.quota)
  AND (julianday(NEW.updated_at) IS NULL
    OR julianday(NEW.updated_at) <= julianday(COALESCE(OLD.updated_at, OLD.created_at)))
BEGIN
  SELECT RAISE(ABORT, 'undated_promotion_change');
END;

CREATE TRIGGER free_promotion_change_is_kept AFTER UPDATE ON free_promotions
WHEN NEW.starts_at IS NOT OLD.starts_at OR NEW.ends_at IS NOT OLD.ends_at
  OR NEW.quota IS NOT OLD.quota
BEGIN
  INSERT INTO free_promotion_changes
    (promotion_id, previous_starts_at, previous_ends_at, previous_quota, changed_at)
  VALUES (OLD.id, OLD.starts_at, OLD.ends_at, OLD.quota, NEW.updated_at);
END;

-- Un'estensione dello storico conserva durata, motivo e autore; la revoca si registra una volta.
CREATE TRIGGER history_extension_is_kept BEFORE UPDATE ON history_extensions
WHEN NEW.id IS NOT OLD.id OR NEW.workspace_id IS NOT OLD.workspace_id
  OR NEW.months IS NOT OLD.months OR NEW.reason IS NOT OLD.reason OR NEW.actor IS NOT OLD.actor
  OR NEW.granted_at IS NOT OLD.granted_at
  OR (OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS NOT OLD.revoked_at)
BEGIN
  SELECT RAISE(ABORT, 'immutable_history_extension');
END;
