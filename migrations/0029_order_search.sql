-- Testo cercabile dell'ordine senza dati fiscali, nella forma di confronto calcolata
-- dall'applicazione (minuscole e senza accenti di qualunque alfabeto). Le letture lo scrivono a
-- ogni variazione; la manutenzione calcola quello degli ordini già presenti, che fino ad allora
-- si cercano con le sole minuscole ASCII di SQLite.
ALTER TABLE orders ADD COLUMN search_text TEXT;
CREATE INDEX orders_search_pending_idx ON orders(id) WHERE search_text IS NULL;

-- L'elenco legge gli ordini dei negozi dal più recente per data ordine.
CREATE INDEX orders_store_created_idx ON orders(store_id, creation_time DESC, id DESC);
