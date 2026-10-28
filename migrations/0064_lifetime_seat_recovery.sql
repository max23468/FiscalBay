-- Un posto lifetime attivo rimasto senza spazio dopo la cancellazione dell'account si riassegna
-- dalla console al nuovo spazio dello stesso cliente: lo spazio passa da assente a uno nuovo,
-- una sola volta per cancellazione. Stato, posto, tipo, riferimenti della vendita e attivazione
-- restano immutabili, e lo spazio di un posto assegnato può ancora soltanto sparire.
DROP TRIGGER lifetime_allocation_is_immutable;
CREATE TRIGGER lifetime_allocation_is_immutable BEFORE UPDATE ON lifetime_allocations
WHEN OLD.status = 'active' AND (NEW.status IS NOT OLD.status OR NEW.slot IS NOT OLD.slot
  OR NEW.kind IS NOT OLD.kind OR NEW.provider_reference IS NOT OLD.provider_reference
  OR NEW.customer_id IS NOT OLD.customer_id OR NEW.activated_at IS NOT OLD.activated_at
  OR (NEW.workspace_id IS NOT OLD.workspace_id AND NEW.workspace_id IS NOT NULL
    AND OLD.workspace_id IS NOT NULL))
BEGIN
  SELECT RAISE(ABORT, 'immutable_lifetime_allocation');
END;
