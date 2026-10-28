-- Passaggio «negozio collegato» degli spazi che non lo hanno: la ricostruzione dei primi
-- passaggi lo leggeva dalle credenziali, già cancellate per i negozi rimossi, mentre le letture
-- di quei negozi erano ancora presenti. Il negozio conserva l'istante del primo collegamento.
-- Soltanto righe nuove: i passaggi già registrati restano come sono.
INSERT OR IGNORE INTO workspace_funnel_steps (workspace_id, step, occurred_at)
SELECT workspace_id, 'store_linked', MIN(linked_at) FROM ebay_stores GROUP BY workspace_id;
