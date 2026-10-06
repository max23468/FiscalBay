-- Modello ordini strutturato: stato corrente dalla fonte, snapshot buyer legato all'ordine,
-- articoli con identità stabile di riga, riferimenti esterni per fonte e storico fiscale.

-- Snapshot dell'acquirente e del destinatario come forniti dall'ordine: nessuna anagrafica
-- condivisa li riscrive. Gli stati restano quelli originali della fonte.
ALTER TABLE orders ADD COLUMN is_provisional INTEGER NOT NULL DEFAULT 0
  CHECK (is_provisional IN (0, 1));
ALTER TABLE orders ADD COLUMN marketplace_id TEXT;
ALTER TABLE orders ADD COLUMN payment_status TEXT;
ALTER TABLE orders ADD COLUMN fulfillment_status TEXT;
ALTER TABLE orders ADD COLUMN cancel_status TEXT;
ALTER TABLE orders ADD COLUMN buyer_json TEXT CHECK (buyer_json IS NULL OR json_valid(buyer_json));

UPDATE orders SET
  payment_status = json_extract(summary_json, '$.orderPaymentStatus'),
  fulfillment_status = json_extract(summary_json, '$.orderFulfillmentStatus'),
  buyer_json = CASE WHEN json_extract(summary_json, '$.buyer.username') IS NOT NULL THEN
    json_object('username', json_extract(summary_json, '$.buyer.username'), 'name', NULL,
      'email', NULL, 'phone', NULL, 'billingAddress', NULL, 'shipTo', NULL)
  END
WHERE summary_json IS NOT NULL;

-- Una riga può cambiare `line_item_id` quando eBay emette l'ordine definitivo; `stable_key`
-- è l'identità comprovata dalla fonte che collega provvisorio e definitivo. L'importo è
-- quello della riga com'è fornito, senza divisioni; assente se la fonte non lo riporta.
CREATE TABLE order_items_v2 (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  line_item_id TEXT NOT NULL,
  stable_key TEXT,
  sku TEXT,
  title TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  total_minor INTEGER CHECK (total_minor IS NULL OR total_minor >= 0),
  currency TEXT,
  CHECK ((total_minor IS NULL) = (currency IS NULL)),
  UNIQUE (order_id, line_item_id)
);

INSERT INTO order_items_v2 (id, order_id, line_item_id, sku, title, quantity, total_minor, currency)
SELECT i.id, i.order_id, i.line_item_id, i.sku, i.title, i.quantity, i.unit_minor * i.quantity, o.currency
  FROM order_items i JOIN orders o ON o.id = i.order_id;

INSERT OR IGNORE INTO order_items_v2 (id, order_id, line_item_id, sku, title, quantity)
SELECT lower(hex(randomblob(16))), o.id, json_extract(li.value, '$.lineItemId'),
       json_extract(li.value, '$.sku'), json_extract(li.value, '$.title'),
       json_extract(li.value, '$.quantity')
  FROM orders o, json_each(o.summary_json, '$.lineItems') li
 WHERE o.summary_json IS NOT NULL;

DROP TABLE order_items;
ALTER TABLE order_items_v2 RENAME TO order_items;
CREATE INDEX order_items_order_idx ON order_items(order_id);
CREATE UNIQUE INDEX order_items_stable_idx ON order_items(order_id, stable_key)
  WHERE stable_key IS NOT NULL;
CREATE INDEX order_items_stable_lookup_idx ON order_items(stable_key)
  WHERE stable_key IS NOT NULL;

ALTER TABLE orders DROP COLUMN summary_json;

-- Ogni identificativo esterno osservato punta all'UUID interno, separato per fonte. La data di
-- ultima modifica applicata scarta le osservazioni tardive della stessa fonte.
CREATE TABLE order_source_refs (
  store_id TEXT NOT NULL REFERENCES ebay_stores(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('fulfillment', 'trading')),
  external_order_id TEXT NOT NULL,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  last_modified_time TEXT NOT NULL,
  PRIMARY KEY (store_id, source, external_order_id)
);
CREATE INDEX order_source_refs_order_idx ON order_source_refs(order_id);
CREATE INDEX order_source_refs_external_idx ON order_source_refs(store_id, external_order_id);

INSERT INTO order_source_refs (store_id, source, external_order_id, order_id, last_modified_time)
SELECT store_id, 'fulfillment', ebay_order_id, id, last_modified_time FROM orders;

-- Righe che non permettono di riconoscere con certezza lo stesso ordine: restano due ordini
-- distinti con l'anomalia esplicita, sempre nello stesso negozio.
CREATE TABLE order_reconciliation_issues (
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  related_order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('partial_overlap', 'missing_line_identity', 'multiple_candidates')),
  detected_at TEXT NOT NULL,
  PRIMARY KEY (order_id, related_order_id, kind)
);
CREATE INDEX order_reconciliation_issues_related_idx
  ON order_reconciliation_issues(related_order_id);

CREATE TRIGGER order_reconciliation_issue_same_store
BEFORE INSERT ON order_reconciliation_issues
WHEN (SELECT store_id FROM orders WHERE id = NEW.order_id) IS NOT
     (SELECT store_id FROM orders WHERE id = NEW.related_order_id)
BEGIN
  SELECT RAISE(ABORT, 'reconciliation_across_stores');
END;

-- Storico fiscale: ogni valore resta con la sua fonte; una rimozione autorevole chiude il
-- valore senza cancellarlo e una nuova comparsa apre una riga nuova. Il dato corrente è
-- quello senza `removed_at`.
ALTER TABLE tax_identifiers ADD COLUMN removed_at TEXT;
DROP INDEX tax_identifiers_observation_idx;
CREATE UNIQUE INDEX tax_identifiers_current_idx
  ON tax_identifiers(order_id, identifier_type, COALESCE(issuing_country, ''), value, source)
  WHERE removed_at IS NULL;

DROP TRIGGER order_grant_requires_available_data;
CREATE TRIGGER order_grant_requires_available_data
BEFORE INSERT ON order_grants
WHEN NOT EXISTS (
  SELECT 1 FROM tax_identifiers WHERE order_id = NEW.order_id AND removed_at IS NULL
)
BEGIN
  SELECT RAISE(ABORT, 'tax_data_unavailable');
END;
