-- Incassi lifetime senza assegnazione: riferimenti minimi per l'assistenza, mai dati del buyer.
CREATE TABLE billing_incidents (
  session_id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  customer_id TEXT,
  environment TEXT NOT NULL CHECK (environment IN ('test', 'live')),
  opened_at TEXT NOT NULL,
  checked_at TEXT NOT NULL,
  resolved_at TEXT
) STRICT;
CREATE INDEX billing_incidents_due_idx ON billing_incidents(environment, resolved_at, checked_at);

CREATE TRIGGER erase_billing_incidents AFTER INSERT ON stripe_customer_erasures
BEGIN
  DELETE FROM billing_incidents WHERE customer_id = NEW.customer_id;
END;
