CREATE TABLE ebay_store_link_sessions (
  state TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  code_verifier TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX ebay_store_link_sessions_expires_idx ON ebay_store_link_sessions(expires_at);
