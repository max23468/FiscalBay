CREATE TABLE order_tax_checks (
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('ebay_trading_get_orders', 'ebay_fulfillment')),
  last_modified_time TEXT,
  observed_at TEXT NOT NULL,
  verification TEXT NOT NULL DEFAULT 'completed' CHECK (verification IN ('completed', 'error')),
  availability TEXT NOT NULL CHECK (availability IN ('present', 'absent', 'not_included', 'masked', 'removed')),
  PRIMARY KEY (order_id, source)
);
