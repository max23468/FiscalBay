-- Token del negozio cifrati, separati dai dati del negozio e mai restituiti al client.
-- `granted_at` identifica il consenso: un rinnovo partito prima di un nuovo consenso non lo
-- sovrascrive. `rejected_at` registra il rifiuto del refresh token da parte di eBay.
CREATE TABLE ebay_store_credentials (
  store_id TEXT PRIMARY KEY REFERENCES ebay_stores(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  access_expires_at TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  refresh_expires_at TEXT NOT NULL,
  granted_at TEXT NOT NULL,
  refreshed_at TEXT,
  rejected_at TEXT
);

CREATE INDEX ebay_store_credentials_access_idx
  ON ebay_store_credentials(access_expires_at) WHERE rejected_at IS NULL;

-- Lo state resta registrato dopo l'uso fino alla scadenza: un callback duplicato riceve lo
-- stesso esito invece di avviare un secondo scambio.
ALTER TABLE ebay_store_link_sessions ADD COLUMN consumed_at TEXT;
ALTER TABLE ebay_store_link_sessions ADD COLUMN outcome TEXT
  CHECK (outcome IS NULL OR outcome IN ('collegato', 'negato', 'altro-spazio', 'errore'));
