-- Profilo pubblico del negozio eBay: nome, logo e indirizzo da Trading `GetStore`, vuoti per chi
-- non ha un negozio eBay; feedback e stato Top Rated del venditore da Trading `GetUser`. La data
-- dell'ultima lettura distanzia gli aggiornamenti.
ALTER TABLE ebay_stores ADD COLUMN store_name TEXT CHECK (length(store_name) BETWEEN 1 AND 200);
ALTER TABLE ebay_stores ADD COLUMN store_logo_url TEXT CHECK (length(store_logo_url) BETWEEN 1 AND 2048);
ALTER TABLE ebay_stores ADD COLUMN store_url TEXT CHECK (length(store_url) BETWEEN 1 AND 2048);
ALTER TABLE ebay_stores ADD COLUMN feedback_score INTEGER;
ALTER TABLE ebay_stores ADD COLUMN feedback_positive_percent REAL
  CHECK (feedback_positive_percent BETWEEN 0 AND 100);
ALTER TABLE ebay_stores ADD COLUMN top_rated_seller INTEGER CHECK (top_rated_seller IN (0, 1));
ALTER TABLE ebay_stores ADD COLUMN store_profile_read_at TEXT;
