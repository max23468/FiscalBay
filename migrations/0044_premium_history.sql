-- Limite superiore della passata dello storico in corso quando non coincide con `history_until`:
-- l'estensione della finestra legge soltanto il periodo più vecchio non ancora importato.
ALTER TABLE sync_state ADD COLUMN history_through TEXT;

-- Estensioni dello storico oltre l'anno Premium, concesse su richiesta valutata con motivo e
-- autore. Valgono soltanto con una copertura in corso e mai oltre i due anni che eBay
-- restituisce; la revoca riporta la finestra a un anno.
CREATE TABLE history_extensions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  months INTEGER NOT NULL CHECK (months BETWEEN 13 AND 24),
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 500),
  actor TEXT NOT NULL CHECK (length(trim(actor)) BETWEEN 1 AND 128),
  granted_at TEXT NOT NULL CHECK (strftime('%Y-%m-%dT%H:%M:%fZ', granted_at) = granted_at),
  revoked_at TEXT CHECK (revoked_at IS NULL
    OR strftime('%Y-%m-%dT%H:%M:%fZ', revoked_at) = revoked_at)
);
CREATE INDEX history_extensions_workspace_idx ON history_extensions(workspace_id);
