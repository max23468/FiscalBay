-- Un pagamento lifetime confermato quando i venti posti sono occupati riceve comunque il
-- diritto, su un posto oltre il ventesimo: il tetto resta per prenotazioni e omaggi, che non
-- superano il ventesimo posto. SQLite non modifica un vincolo CHECK: la tabella si ricrea con
-- gli stessi dati e gli stessi trigger. I trigger delle altre tabelle che la leggono si tolgono
-- prima e si ricreano dopo, perché la rinomina li rilegge.
DROP TRIGGER lifetime_requires_allocation;
DROP TRIGGER erasure_owner_notification;

CREATE TABLE lifetime_allocations_new (
  slot INTEGER PRIMARY KEY CHECK (slot >= 1 AND (slot <= 20
    OR (status = 'active' AND kind = 'sale'))),
  workspace_id TEXT UNIQUE REFERENCES workspaces(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('reserved', 'active')),
  provider_reference TEXT UNIQUE,
  created_at TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'sale' CHECK (kind IN ('sale', 'gift')),
  expires_at TEXT,
  completed_at TEXT,
  customer_id TEXT,
  activated_at TEXT,
  checked_at TEXT
);
INSERT INTO lifetime_allocations_new (slot, workspace_id, status, provider_reference, created_at,
  kind, expires_at, completed_at, customer_id, activated_at, checked_at)
SELECT slot, workspace_id, status, provider_reference, created_at, kind, expires_at,
  completed_at, customer_id, activated_at, checked_at FROM lifetime_allocations;
DROP TABLE lifetime_allocations;
ALTER TABLE lifetime_allocations_new RENAME TO lifetime_allocations;

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

CREATE TRIGGER lifetime_allocation_is_immutable BEFORE UPDATE ON lifetime_allocations
WHEN OLD.status = 'active' AND (NEW.status IS NOT OLD.status OR NEW.slot IS NOT OLD.slot
  OR NEW.kind IS NOT OLD.kind OR NEW.provider_reference IS NOT OLD.provider_reference
  OR NEW.customer_id IS NOT OLD.customer_id OR NEW.activated_at IS NOT OLD.activated_at
  OR (NEW.workspace_id IS NOT OLD.workspace_id AND NEW.workspace_id IS NOT NULL
    AND OLD.workspace_id IS NOT NULL))
BEGIN
  SELECT RAISE(ABORT, 'immutable_lifetime_allocation');
END;

CREATE TRIGGER lifetime_sold_owner_notification
AFTER UPDATE OF status ON lifetime_allocations
WHEN NEW.status = 'active' AND OLD.status = 'reserved'
  AND 20 - (SELECT COUNT(*) FROM lifetime_allocations WHERE status = 'active') IN (5, 2, 0)
  AND NOT EXISTS (SELECT 1 FROM owner_notifications WHERE key = 'lifetime_seats:'
    || (20 - (SELECT COUNT(*) FROM lifetime_allocations WHERE status = 'active')))
BEGIN
  INSERT INTO owner_notifications (key, kind, workspace_id, detail, occurred_at)
  SELECT 'lifetime_seats:' || (20 - COUNT(*)), 'lifetime_seats', NULL,
    json_object('left', 20 - COUNT(*), 'total', 20), NEW.activated_at
  FROM lifetime_allocations WHERE status = 'active';
END;

CREATE TRIGGER lifetime_granted_owner_notification
AFTER INSERT ON lifetime_allocations
WHEN NEW.status = 'active'
  AND 20 - (SELECT COUNT(*) FROM lifetime_allocations WHERE status = 'active') IN (5, 2, 0)
  AND NOT EXISTS (SELECT 1 FROM owner_notifications WHERE key = 'lifetime_seats:'
    || (20 - (SELECT COUNT(*) FROM lifetime_allocations WHERE status = 'active')))
BEGIN
  INSERT INTO owner_notifications (key, kind, workspace_id, detail, occurred_at)
  SELECT 'lifetime_seats:' || (20 - COUNT(*)), 'lifetime_seats', NULL,
    json_object('left', 20 - COUNT(*), 'total', 20), NEW.activated_at
  FROM lifetime_allocations WHERE status = 'active';
END;

CREATE TRIGGER lifetime_requires_allocation BEFORE INSERT ON workspace_entitlements
WHEN NEW.source = 'lifetime' AND NOT EXISTS (SELECT 1 FROM lifetime_allocations a
  WHERE a.workspace_id = NEW.workspace_id AND a.status = 'active')
BEGIN
  SELECT RAISE(ABORT, 'lifetime_not_allocated');
END;

CREATE TRIGGER erasure_owner_notification
AFTER INSERT ON stripe_customer_erasures
WHEN NOT EXISTS (SELECT 1 FROM owner_notifications
  WHERE key = 'financial_erasure:' || NEW.customer_id)
BEGIN
  INSERT INTO owner_notifications (key, kind, workspace_id, detail, occurred_at)
  VALUES ('financial_erasure:' || NEW.customer_id, 'financial_erasure',
    COALESCE((SELECT workspace_id FROM stripe_subscriptions WHERE customer_id = NEW.customer_id
        AND environment = NEW.environment LIMIT 1),
      (SELECT workspace_id FROM lifetime_allocations WHERE customer_id = NEW.customer_id LIMIT 1)),
    json_object('origin', NEW.source), NEW.received_at);
END;
