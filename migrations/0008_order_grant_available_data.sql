DROP TRIGGER order_grant_requires_available_data;

CREATE TRIGGER order_grant_requires_available_data
BEFORE INSERT ON order_grants
WHEN NOT EXISTS (
  SELECT 1 FROM tax_identifiers WHERE order_id = NEW.order_id
)
BEGIN
  SELECT RAISE(ABORT, 'tax_data_unavailable');
END;
