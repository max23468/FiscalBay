-- Negozi di uno spazio: elenco degli ordini, conteggi, ricerca e stato dei negozi partono da
-- qui invece di scorrere i negozi di tutti gli spazi dell'ambiente.
CREATE INDEX ebay_stores_workspace_idx ON ebay_stores(workspace_id);
