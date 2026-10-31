-- File creati dalle esportazioni, conservati nel bucket R2 dell'ambiente con la chiave opaca
-- `id`. La riga decide la validità a ogni download: scadenza entro 24 ore e revisione di
-- accesso dello spazio letta all'inizio della generazione. Una revoca, con i trigger in fondo,
-- incrementa la revisione e invalida tutti i file dello spazio; la pulizia oraria elimina
-- oggetti e righe non più validi, la regola di lifecycle del bucket resta la rete di sicurezza.
ALTER TABLE workspaces ADD COLUMN access_revision INTEGER NOT NULL DEFAULT 0;

CREATE TABLE export_files (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  file_name TEXT NOT NULL CHECK (length(file_name) BETWEEN 1 AND 100),
  content_type TEXT NOT NULL,
  access_revision INTEGER NOT NULL,
  created_at TEXT NOT NULL CHECK (julianday(created_at) IS NOT NULL),
  expires_at TEXT NOT NULL CHECK (julianday(expires_at) > julianday(created_at))
);

CREATE INDEX export_files_user_idx ON export_files(user_id);
CREATE INDEX export_files_expiry_idx ON export_files(expires_at);

-- Revoche: dati del negozio eliminati, negozio passato a un altro spazio, negozio escluso dal
-- piano e copertura revocata. La cancellazione dell'account elimina le righe con l'utente.
CREATE TRIGGER store_removal_revokes_export_files
AFTER UPDATE OF data_deleted_at, workspace_id ON ebay_stores
WHEN NEW.workspace_id IS NOT OLD.workspace_id
  OR (OLD.data_deleted_at IS NULL AND NEW.data_deleted_at IS NOT NULL)
BEGIN
  UPDATE workspaces SET access_revision = access_revision + 1 WHERE id = OLD.workspace_id;
END;

CREATE TRIGGER plan_pause_revokes_export_files AFTER INSERT ON ebay_store_pauses
WHEN NEW.reason = 'plan'
BEGIN
  UPDATE workspaces SET access_revision = access_revision + 1
   WHERE id = (SELECT workspace_id FROM ebay_stores WHERE id = NEW.store_id);
END;

CREATE TRIGGER entitlement_revocation_revokes_export_files
AFTER UPDATE OF revoked_at ON workspace_entitlements
WHEN OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL
BEGIN
  UPDATE workspaces SET access_revision = access_revision + 1 WHERE id = NEW.workspace_id;
END;
