-- Due indici ripetevano quelli automatici dei vincoli UNIQUE: `order_grants (workspace_id,
-- order_id)` e il prefisso `order_id` di `order_items (order_id, line_item_id)`. Ogni scrittura
-- li aggiornava due volte.
DROP INDEX order_grants_workspace_order_idx;
DROP INDEX order_items_order_idx;

-- La cancellazione di un ciclo Free rilegge gli sblocchi che lo citano: senza indice scorreva
-- tutta la tabella per ogni ciclo.
CREATE INDEX order_grants_cycle_idx ON order_grants(cycle_id) WHERE cycle_id IS NOT NULL;
