-- Esportazioni grandi preparate dalla coda. La riga conserva revisione di accesso dello spazio
-- letta alla richiesta, nome del file, istante e stato; ambito e opzioni restano cifrati
-- soltanto finché il lavoro non si conclude. Il file pronto è una riga di `export_files`: la
-- sua validità resta decisa dal download. La pulizia oraria elimina la riga dopo 24 ore.
CREATE TABLE export_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  access_revision INTEGER NOT NULL,
  request_sealed TEXT,
  file_name TEXT NOT NULL CHECK (length(file_name) BETWEEN 1 AND 100),
  requested_at TEXT NOT NULL CHECK (julianday(requested_at) IS NOT NULL),
  state TEXT NOT NULL DEFAULT 'queued' CHECK (state IN ('queued', 'ready', 'failed')),
  file_id TEXT REFERENCES export_files(id) ON DELETE SET NULL,
  locked_until TEXT,
  finished_at TEXT,
  CHECK ((state = 'queued') = (finished_at IS NULL)),
  CHECK (state = 'queued' OR request_sealed IS NULL)
);

CREATE INDEX export_jobs_user_idx ON export_jobs(user_id, requested_at);
CREATE INDEX export_jobs_requested_idx ON export_jobs(requested_at);
CREATE INDEX export_jobs_file_idx ON export_jobs(file_id);

-- Altre riduzioni dell'accesso che invalidano i file dello spazio, oltre a quelle di
-- `0054_export_files.sql`: estensione dello storico revocata, valore fiscale rimosso o
-- sostituito dalla fonte e ordine eliminato prima del suo termine di conservazione. La pulizia
-- ordinaria elimina soltanto ordini già scaduti, che nessun file valido contiene; gli sblocchi
-- non si revocano e la loro scadenza limita già la validità del file.
CREATE TRIGGER extension_revocation_revokes_export_files
AFTER UPDATE OF revoked_at ON history_extensions
WHEN OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL
BEGIN
  UPDATE workspaces SET access_revision = access_revision + 1 WHERE id = NEW.workspace_id;
END;

CREATE TRIGGER tax_removal_revokes_export_files
AFTER UPDATE OF removed_at ON tax_identifiers
WHEN OLD.removed_at IS NULL AND NEW.removed_at IS NOT NULL
BEGIN
  UPDATE workspaces SET access_revision = access_revision + 1
   WHERE id = (SELECT s.workspace_id FROM orders o JOIN ebay_stores s ON s.id = o.store_id
                WHERE o.id = NEW.order_id);
END;

CREATE TRIGGER order_deletion_revokes_export_files
AFTER DELETE ON orders
WHEN julianday(OLD.retention_until) > julianday('now')
BEGIN
  UPDATE workspaces SET access_revision = access_revision + 1
   WHERE id = (SELECT workspace_id FROM ebay_stores WHERE id = OLD.store_id);
END;
