-- Letture consecutive con le credenziali rifiutate da eBay per il consenso corrente: alla terza
-- il negozio va ricollegato. Una lettura riuscita o un nuovo consenso le azzerano.
ALTER TABLE ebay_store_credentials ADD COLUMN credential_failures INTEGER NOT NULL DEFAULT 0;
