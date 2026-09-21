CREATE TABLE tax_identifiers_v2 (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  identifier_type TEXT NOT NULL,
  issuing_country TEXT,
  value TEXT NOT NULL,
  source TEXT NOT NULL CHECK (
    source IN ('ebay_trading_get_orders', 'ebay_fulfillment', 'synthetic_fixture')
  ),
  observed_at TEXT NOT NULL
);

INSERT INTO tax_identifiers_v2 (
  id,
  order_id,
  identifier_type,
  issuing_country,
  value,
  source,
  observed_at
)
SELECT
  id,
  order_id,
  identifier_type,
  issuing_country,
  value,
  'synthetic_fixture',
  observed_at
FROM tax_identifiers;

DROP TABLE tax_identifiers;
ALTER TABLE tax_identifiers_v2 RENAME TO tax_identifiers;

CREATE UNIQUE INDEX tax_identifiers_observation_idx
  ON tax_identifiers(
    order_id,
    identifier_type,
    COALESCE(issuing_country, ''),
    value,
    source
  );
CREATE INDEX tax_identifiers_order_idx ON tax_identifiers(order_id);
