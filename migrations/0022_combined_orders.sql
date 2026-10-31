-- I provvisori assorbiti conservano storico e grant immutabili, con un solo ordine corrente.
ALTER TABLE orders ADD COLUMN merged_into TEXT REFERENCES orders(id) ON DELETE CASCADE;
CREATE INDEX orders_merged_into_idx ON orders(merged_into);
-- Trading conserva l'identità delle transazioni anche se Fulfillment rinomina le righe.
ALTER TABLE orders ADD COLUMN trading_line_keys TEXT
  CHECK (trading_line_keys IS NULL OR json_valid(trading_line_keys));

CREATE TRIGGER order_merge_same_store
BEFORE UPDATE OF merged_into ON orders
WHEN NEW.merged_into IS NOT NULL AND (
  NEW.id = NEW.merged_into OR NOT EXISTS (
    SELECT 1 FROM orders o WHERE o.id = NEW.merged_into
      AND o.store_id = NEW.store_id AND o.merged_into IS NULL
  ) OR EXISTS (SELECT 1 FROM orders WHERE merged_into = NEW.id)
)
BEGIN
  SELECT RAISE(ABORT, 'invalid_order_merge');
END;

-- Un diritto già acquisito su un provvisorio vale per il definitivo senza nuovo consumo.
CREATE TRIGGER order_grant_requires_current_order
BEFORE INSERT ON order_grants
WHEN EXISTS (SELECT 1 FROM orders WHERE id = NEW.order_id AND merged_into IS NOT NULL)
  OR EXISTS (
    SELECT 1 FROM order_grants g JOIN orders o ON o.id = g.order_id
    WHERE o.merged_into = NEW.order_id AND g.workspace_id = NEW.workspace_id
  )
BEGIN
  SELECT RAISE(ABORT, 'order_already_granted_or_merged');
END;

ALTER TABLE sync_state ADD COLUMN trading_cursor TEXT;
ALTER TABLE sync_state ADD COLUMN trading_end TEXT;
ALTER TABLE sync_state ADD COLUMN trading_page INTEGER;
ALTER TABLE sync_state ADD COLUMN trading_total INTEGER;
