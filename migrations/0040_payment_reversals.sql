-- Pagamento restituito al cliente: rimborso totale confermato da Stripe oppure disputa persa.
-- Revoca soltanto la copertura pagata da quel pagamento; la revoca resta anche se l'oggetto
-- Stripe sparisce. `amount_refunded` è la somma dei rimborsi riusciti, anche parziali, che non
-- si traducono in giorni.
ALTER TABLE workspace_entitlements ADD COLUMN revocation TEXT
  CHECK (revocation IS NULL OR revocation IN ('refund', 'dispute'));
ALTER TABLE workspace_entitlements ADD COLUMN amount_refunded INTEGER
  CHECK (amount_refunded IS NULL OR amount_refunded >= 0);

-- Ultima rilettura di un lifetime venduto: rimborsi e dispute arrivano anche mesi dopo.
ALTER TABLE lifetime_allocations ADD COLUMN checked_at TEXT;

CREATE TRIGGER entitlement_revocation_is_kept BEFORE UPDATE ON workspace_entitlements
WHEN (OLD.revocation IS NOT NULL AND NEW.revocation IS NOT OLD.revocation)
  OR (NEW.revocation IS NOT NULL AND NEW.revoked_at IS NULL)
BEGIN
  SELECT RAISE(ABORT, 'immutable_entitlement');
END;

-- Cliente Stripe i cui dati finanziari sono stati cancellati, su richiesta tramite Link o
-- segnalata dall'assistenza: FiscalBay non lo usa più per portale, checkout o riletture. Le
-- coperture già attribuite e lo spazio restano.
CREATE TABLE stripe_customer_erasures (
  customer_id TEXT PRIMARY KEY,
  environment TEXT NOT NULL CHECK (environment IN ('test', 'live')),
  source TEXT NOT NULL CHECK (source IN ('webhook', 'support')),
  received_at TEXT NOT NULL CHECK (julianday(received_at) IS NOT NULL),
  recorded_by TEXT,
  reason TEXT,
  CHECK ((source = 'support') = (recorded_by IS NOT NULL AND reason IS NOT NULL))
);
CREATE TRIGGER stripe_customer_erasure_is_kept BEFORE UPDATE ON stripe_customer_erasures
BEGIN
  SELECT RAISE(ABORT, 'immutable_erasure');
END;
