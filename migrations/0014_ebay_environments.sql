ALTER TABLE ebay_stores ADD COLUMN ebay_environment TEXT NOT NULL DEFAULT 'production'
  CHECK (ebay_environment IN ('production', 'sandbox'));
ALTER TABLE ebay_stores ADD COLUMN ebay_account_id TEXT;
UPDATE ebay_stores SET ebay_account_id = ebay_user_id;
CREATE UNIQUE INDEX ebay_stores_environment_account_idx
  ON ebay_stores(ebay_environment, ebay_account_id);

-- Il vecchio identificativo univoco rimane compatibile con i negozi Production.
-- Per Sandbox contiene una chiave con namespace; ebay_account_id conserva l'ID eBay reale.
ALTER TABLE ebay_store_link_sessions ADD COLUMN ebay_environment TEXT NOT NULL DEFAULT 'production'
  CHECK (ebay_environment IN ('production', 'sandbox'));
