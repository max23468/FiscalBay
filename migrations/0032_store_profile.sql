-- Nome e logo del negozio eBay, letti con Trading `GetStore`: restano vuoti per chi non ha un
-- negozio eBay. La data dell'ultima lettura distanzia gli aggiornamenti.
ALTER TABLE ebay_stores ADD COLUMN store_name TEXT CHECK (length(store_name) BETWEEN 1 AND 200);
ALTER TABLE ebay_stores ADD COLUMN store_logo_url TEXT CHECK (length(store_logo_url) BETWEEN 1 AND 2048);
ALTER TABLE ebay_stores ADD COLUMN store_profile_read_at TEXT;
