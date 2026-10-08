CREATE TABLE ebay_store_link_sessions_new (
  state TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  code_verifier TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  outcome TEXT CHECK (outcome IS NULL OR outcome IN ('collegato', 'negato', 'altro-spazio', 'negozio-diverso', 'errore')),
  ebay_environment TEXT NOT NULL DEFAULT 'production' CHECK (ebay_environment IN ('production', 'sandbox')),
  expected_store_id TEXT
);
INSERT INTO ebay_store_link_sessions_new (state, user_id, code_verifier, expires_at, consumed_at, outcome, ebay_environment)
SELECT state, user_id, code_verifier, expires_at, consumed_at, outcome, ebay_environment FROM ebay_store_link_sessions;
DROP TABLE ebay_store_link_sessions;
ALTER TABLE ebay_store_link_sessions_new RENAME TO ebay_store_link_sessions;
CREATE INDEX ebay_store_link_sessions_expires_idx ON ebay_store_link_sessions(expires_at);

CREATE TABLE account_email_changes (
  user_id TEXT PRIMARY KEY REFERENCES "user" (id) ON DELETE CASCADE,
  current_email TEXT NOT NULL,
  new_email TEXT NOT NULL,
  stage TEXT NOT NULL CHECK (stage IN ('current', 'new')),
  expires_at TEXT NOT NULL
);
CREATE INDEX account_email_changes_expiry_idx ON account_email_changes(expires_at);
