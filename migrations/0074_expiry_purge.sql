-- La scadenza non è una cancellazione voluta: il reimport resta bloccato soltanto per quelle
-- dell'utente, di eBay e dello scollegamento. La pulizia giornaliera inserisce una riga in questa
-- tabella e la rimuove nello stesso batch: nessun'altra transazione la vede, e il trigger non
-- registra le chiavi degli ordini che quel batch elimina.
CREATE TABLE order_expiry_purges (at TEXT PRIMARY KEY);

DROP TRIGGER order_deletion_marker;
CREATE TRIGGER order_deletion_marker BEFORE DELETE ON orders
WHEN EXISTS (SELECT 1 FROM ebay_stores WHERE id = OLD.store_id)
  AND NOT EXISTS (SELECT 1 FROM order_expiry_purges)
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

-- Le chiavi si eliminano due anni dopo la cancellazione, quando eBay non restituisce più l'ordine.
CREATE INDEX deleted_order_keys_deleted_idx ON deleted_order_keys(deleted_at);

-- Blocchi già registrati dalla pulizia per scadenza: si tolgono dove l'origine è dimostrabile.
-- Negli ultimi trenta giorni le cancellazioni richieste da eBay sono ancora tutte registrate;
-- restano i blocchi nati mentre una era in corso nello stesso ambiente e quelli entro un'ora
-- dall'ultima eliminazione dei dati del negozio. I più vecchi restano.
DELETE FROM deleted_order_keys
WHERE julianday(deleted_at) >= julianday('now') - 30
  AND NOT EXISTS (SELECT 1 FROM ebay_stores s WHERE s.id = deleted_order_keys.store_id
    AND s.orders_deleted_through IS NOT NULL
    AND julianday(deleted_order_keys.deleted_at) <= julianday(s.orders_deleted_through) + 1.0 / 24)
  AND NOT EXISTS (SELECT 1 FROM ebay_account_deletions e
    JOIN ebay_stores s ON s.id = deleted_order_keys.store_id AND s.ebay_environment = e.ebay_environment
    WHERE julianday(e.requested_at) <= julianday(deleted_order_keys.deleted_at)
      AND (e.completed_at IS NULL
        OR julianday(e.completed_at) >= julianday(deleted_order_keys.deleted_at)));
