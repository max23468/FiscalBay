-- Stato degli abbonamenti riletto da Stripe: riferimenti, periodo e listino protetto, nessun
-- dato di pagamento. `synced_at` è l'istante della rilettura: una rilettura più vecchia,
-- conclusa dopo una più recente, non la sovrascrive.
CREATE TABLE stripe_subscriptions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  environment TEXT NOT NULL CHECK (environment IN ('test', 'live')),
  customer_id TEXT NOT NULL,
  offer TEXT NOT NULL CHECK (offer IN ('monthly', 'annual')),
  price_generation TEXT NOT NULL,
  status TEXT NOT NULL,
  current_period_start TEXT NOT NULL,
  current_period_end TEXT NOT NULL,
  cancel_at_period_end INTEGER NOT NULL CHECK (cancel_at_period_end IN (0, 1)),
  synced_at TEXT NOT NULL,
  checked_at TEXT NOT NULL,
  unavailable_at TEXT,
  CHECK (julianday(current_period_end) > julianday(current_period_start))
);
CREATE INDEX stripe_subscriptions_workspace_idx ON stripe_subscriptions(workspace_id);
CREATE INDEX stripe_subscriptions_check_idx ON stripe_subscriptions(checked_at);
CREATE TRIGGER stripe_subscription_owner_is_immutable BEFORE UPDATE ON stripe_subscriptions
WHEN NEW.workspace_id IS NOT OLD.workspace_id OR NEW.environment IS NOT OLD.environment
  OR NEW.customer_id IS NOT OLD.customer_id
BEGIN
  SELECT RAISE(ABORT, 'immutable_subscription');
END;

-- Prova autorevole di una copertura pagata: la fattura Stripe, l'importo incassato e l'istante
-- del pagamento. Una fattura attribuisce al più una copertura.
ALTER TABLE workspace_entitlements ADD COLUMN stripe_invoice_id TEXT;
ALTER TABLE workspace_entitlements ADD COLUMN amount_paid INTEGER;
ALTER TABLE workspace_entitlements ADD COLUMN currency TEXT;
ALTER TABLE workspace_entitlements ADD COLUMN paid_at TEXT;
CREATE UNIQUE INDEX workspace_entitlements_invoice_idx ON workspace_entitlements(stripe_invoice_id)
  WHERE stripe_invoice_id IS NOT NULL;
CREATE TRIGGER entitlement_proof_is_immutable BEFORE UPDATE ON workspace_entitlements
WHEN NEW.stripe_invoice_id IS NOT OLD.stripe_invoice_id OR NEW.amount_paid IS NOT OLD.amount_paid
  OR NEW.currency IS NOT OLD.currency OR NEW.paid_at IS NOT OLD.paid_at
BEGIN
  SELECT RAISE(ABORT, 'immutable_entitlement');
END;
