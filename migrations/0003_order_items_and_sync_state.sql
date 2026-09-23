CREATE TABLE order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  line_item_id TEXT NOT NULL,
  sku TEXT,
  title TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_minor INTEGER NOT NULL CHECK (unit_minor >= 0),
  UNIQUE (order_id, line_item_id)
);

CREATE TABLE sync_state (
  store_id TEXT PRIMARY KEY REFERENCES ebay_stores(id) ON DELETE CASCADE,
  cursor TEXT,
  last_success_at TEXT,
  updated_at TEXT NOT NULL
);

CREATE INDEX order_items_order_idx ON order_items(order_id);
