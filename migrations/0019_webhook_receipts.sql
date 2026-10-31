-- Solo riferimenti verificati, mai il corpo del provider o dati buyer.
CREATE TABLE webhook_receipts (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider IN ('ebay', 'stripe')),
  environment TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  object_id TEXT NOT NULL,
  store_id TEXT REFERENCES ebay_stores(id) ON DELETE CASCADE,
  consent_granted_at TEXT,
  event_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  queued_at TEXT,
  completed_at TEXT,
  lease TEXT,
  locked_until TEXT,
  UNIQUE (provider, environment, provider_id)
);
CREATE INDEX webhook_receipts_expiry_idx ON webhook_receipts(expires_at);
