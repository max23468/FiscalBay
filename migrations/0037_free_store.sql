-- Negozio attivo del Free: vale l'ultima riga dello spazio. `default` registra il primo negozio
-- ancora collegato quando il Free si applica, così uno scollegamento non sposta il negozio
-- attivo; `choice` è la sostituzione dell'utente, ammessa ogni 90 giorni; `assisted` è
-- l'eccezione dell'assistenza al vincolo, con motivo e autore. Le righe esplicite sono la
-- traccia di audit e non cambiano. I negozi della Sandbox eBay restano fuori dal limite.
CREATE TABLE free_store_changes (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  store_id TEXT NOT NULL REFERENCES ebay_stores(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('default', 'choice', 'assisted')),
  changed_at TEXT NOT NULL CHECK (strftime('%Y-%m-%dT%H:%M:%fZ', changed_at) = changed_at),
  reason TEXT CHECK (reason IS NULL OR length(trim(reason)) BETWEEN 1 AND 500),
  actor TEXT CHECK (actor IS NULL OR length(trim(actor)) BETWEEN 1 AND 128),
  CHECK ((kind = 'assisted') = (reason IS NOT NULL AND actor IS NOT NULL))
);
CREATE INDEX free_store_changes_workspace_idx ON free_store_changes(workspace_id, changed_at);

CREATE TRIGGER free_store_in_workspace BEFORE INSERT ON free_store_changes
WHEN NOT EXISTS (SELECT 1 FROM ebay_stores WHERE id = NEW.store_id
  AND workspace_id = NEW.workspace_id AND data_deleted_at IS NULL
  AND ebay_environment = 'production')
BEGIN
  SELECT RAISE(ABORT, 'store_not_in_workspace');
END;

CREATE TRIGGER free_store_change_is_immutable BEFORE UPDATE ON free_store_changes
BEGIN
  SELECT RAISE(ABORT, 'immutable_free_store_change');
END;
