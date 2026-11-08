-- Autorizzazione eBay data durante la registrazione: attende la conferma dell'email e il profilo
-- completo, poi diventa il collegamento del negozio. Token cifrati; dura al massimo 24 ore.
CREATE TABLE ebay_signup_grants (
  ebay_user_id TEXT PRIMARY KEY CHECK (length(ebay_user_id) BETWEEN 1 AND 256),
  username TEXT CHECK (username IS NULL OR length(username) BETWEEN 1 AND 256),
  language TEXT NOT NULL CHECK (language IN ('it', 'en')),
  access_token TEXT NOT NULL,
  access_expires_at TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  refresh_expires_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX ebay_signup_grants_expiry ON ebay_signup_grants (expires_at);
