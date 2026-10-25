-- Posti lifetime: vendita con prenotazione oppure omaggio. Un posto prenotato scade con la sua
-- sessione Checkout e si libera soltanto quando Stripe conferma che la sessione non può più
-- incassare; `completed_at` segna una sessione completata con il pagamento ancora da
-- confermare, che tiene il posto. Un posto attivo non torna disponibile: dopo la
-- cancellazione dell'account resta occupato, con il riferimento all'acquisto e al cliente.
ALTER TABLE lifetime_allocations ADD COLUMN kind TEXT NOT NULL DEFAULT 'sale'
  CHECK (kind IN ('sale', 'gift'));
ALTER TABLE lifetime_allocations ADD COLUMN expires_at TEXT;
ALTER TABLE lifetime_allocations ADD COLUMN completed_at TEXT;
ALTER TABLE lifetime_allocations ADD COLUMN customer_id TEXT;
ALTER TABLE lifetime_allocations ADD COLUMN activated_at TEXT;

CREATE TRIGGER lifetime_reservation_requires_expiry BEFORE INSERT ON lifetime_allocations
WHEN (NEW.status = 'reserved' AND (NEW.kind <> 'sale' OR julianday(NEW.expires_at) IS NULL))
  OR (NEW.status = 'active' AND julianday(NEW.activated_at) IS NULL)
BEGIN
  SELECT RAISE(ABORT, 'invalid_lifetime_allocation');
END;

CREATE TRIGGER lifetime_allocation_is_kept BEFORE DELETE ON lifetime_allocations
WHEN OLD.status = 'active'
BEGIN
  SELECT RAISE(ABORT, 'immutable_lifetime_allocation');
END;

-- Lo spazio di un posto attivo può soltanto sparire con la cancellazione dell'account.
CREATE TRIGGER lifetime_allocation_is_immutable BEFORE UPDATE ON lifetime_allocations
WHEN OLD.status = 'active' AND (NEW.status IS NOT OLD.status OR NEW.slot IS NOT OLD.slot
  OR NEW.kind IS NOT OLD.kind OR NEW.provider_reference IS NOT OLD.provider_reference
  OR NEW.customer_id IS NOT OLD.customer_id OR NEW.activated_at IS NOT OLD.activated_at
  OR (NEW.workspace_id IS NOT OLD.workspace_id AND NEW.workspace_id IS NOT NULL))
BEGIN
  SELECT RAISE(ABORT, 'immutable_lifetime_allocation');
END;

-- Prova del lifetime venduto: la sessione Checkout pagata. Una concessione registra invece
-- autore e motivo. Un solo lifetime per spazio, soltanto con un posto attivo dello spazio.
ALTER TABLE workspace_entitlements ADD COLUMN stripe_checkout_session_id TEXT;
ALTER TABLE workspace_entitlements ADD COLUMN granted_by TEXT;
ALTER TABLE workspace_entitlements ADD COLUMN grant_reason TEXT;
CREATE UNIQUE INDEX workspace_entitlements_checkout_idx
  ON workspace_entitlements(stripe_checkout_session_id) WHERE stripe_checkout_session_id IS NOT NULL;
CREATE UNIQUE INDEX workspace_entitlements_lifetime_idx ON workspace_entitlements(workspace_id)
  WHERE source = 'lifetime';
CREATE TRIGGER entitlement_grant_is_immutable BEFORE UPDATE ON workspace_entitlements
WHEN NEW.stripe_checkout_session_id IS NOT OLD.stripe_checkout_session_id
  OR NEW.granted_by IS NOT OLD.granted_by OR NEW.grant_reason IS NOT OLD.grant_reason
BEGIN
  SELECT RAISE(ABORT, 'immutable_entitlement');
END;
CREATE TRIGGER lifetime_requires_allocation BEFORE INSERT ON workspace_entitlements
WHEN NEW.source = 'lifetime' AND NOT EXISTS (SELECT 1 FROM lifetime_allocations a
  WHERE a.workspace_id = NEW.workspace_id AND a.status = 'active')
BEGIN
  SELECT RAISE(ABORT, 'lifetime_not_allocated');
END;
