-- L'accesso cessa alla scadenza anche prima della pulizia. Il billing potrà impostare
-- scadenze esplicite (anno Premium, estensioni e grace di downgrade), senza dedurle dai grant.
ALTER TABLE orders ADD COLUMN retention_until TEXT;
ALTER TABLE orders ADD COLUMN purge_after TEXT;
UPDATE orders SET retention_until = strftime('%Y-%m-%dT%H:%M:%fZ', creation_time, '+30 days');
UPDATE orders SET purge_after = retention_until;
CREATE INDEX orders_purge_after_idx ON orders(purge_after);
ALTER TABLE ebay_stores ADD COLUMN orders_deleted_through TEXT;
UPDATE ebay_stores SET orders_deleted_through = data_deleted_at;

CREATE TRIGGER order_retention_valid BEFORE UPDATE OF retention_until, purge_after ON orders
WHEN NEW.retention_until IS NULL OR NEW.purge_after IS NULL
  OR strftime('%Y-%m-%dT%H:%M:%fZ', NEW.retention_until) IS NOT NEW.retention_until
  OR strftime('%Y-%m-%dT%H:%M:%fZ', NEW.purge_after) IS NOT NEW.purge_after
  OR NEW.purge_after < NEW.retention_until
BEGIN
  SELECT RAISE(ABORT, 'invalid_order_retention');
END;

CREATE TRIGGER order_retention_default AFTER INSERT ON orders
BEGIN
  UPDATE orders SET
    retention_until = COALESCE(NEW.retention_until, strftime('%Y-%m-%dT%H:%M:%fZ', NEW.creation_time, '+30 days')),
    purge_after = COALESCE(NEW.purge_after, NEW.retention_until, strftime('%Y-%m-%dT%H:%M:%fZ', NEW.creation_time, '+30 days'))
  WHERE id = NEW.id;
END;

-- Soli riferimenti tecnici, senza buyer, importi o valori fiscali. Restano legati
-- all'identità del negozio per impedire il ripristino dopo un nuovo consenso.
CREATE TABLE deleted_order_keys (
  store_id TEXT NOT NULL REFERENCES ebay_stores(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('order', 'line')),
  external_key TEXT NOT NULL,
  deleted_at TEXT NOT NULL,
  PRIMARY KEY (store_id, kind, external_key)
);

CREATE TRIGGER order_deletion_marker BEFORE DELETE ON orders
WHEN EXISTS (SELECT 1 FROM ebay_stores WHERE id = OLD.store_id)
BEGIN
  INSERT OR IGNORE INTO deleted_order_keys VALUES (OLD.store_id, 'order', OLD.ebay_order_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
  INSERT OR IGNORE INTO deleted_order_keys
    SELECT OLD.store_id, 'order', external_order_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      FROM order_source_refs WHERE order_id = OLD.id;
  INSERT OR IGNORE INTO deleted_order_keys
    SELECT OLD.store_id, 'line', stable_key, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      FROM order_items WHERE order_id = OLD.id AND stable_key IS NOT NULL;
  INSERT OR IGNORE INTO deleted_order_keys
    SELECT OLD.store_id, 'line', value, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      FROM json_each(OLD.trading_line_keys) WHERE value IS NOT NULL;
END;

ALTER TABLE order_grants ADD COLUMN revoked_at TEXT;
ALTER TABLE order_grants ADD COLUMN expires_at TEXT CHECK (expires_at IS NULL OR
  (strftime('%Y-%m-%dT%H:%M:%fZ', expires_at) IS NOT NULL
   AND strftime('%Y-%m-%dT%H:%M:%fZ', expires_at) = expires_at));
DROP TRIGGER order_grant_is_immutable;
CREATE TRIGGER order_grant_is_immutable BEFORE UPDATE ON order_grants
WHEN NEW.id IS NOT OLD.id OR NEW.workspace_id IS NOT OLD.workspace_id
  OR NEW.order_id IS NOT OLD.order_id OR NEW.cycle_id IS NOT OLD.cycle_id
  OR NEW.source IS NOT OLD.source OR NEW.granted_at IS NOT OLD.granted_at
  OR (OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS NOT OLD.revoked_at)
BEGIN
  SELECT RAISE(ABORT, 'immutable_grant');
END;
