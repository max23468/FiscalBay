ALTER TABLE workspaces ADD COLUMN free_cycle_anchor_at TEXT;
UPDATE workspaces SET free_cycle_anchor_at = (
  SELECT MIN(linked_at) FROM ebay_stores WHERE workspace_id = workspaces.id
);
CREATE TRIGGER store_sets_cycle_anchor AFTER INSERT ON ebay_stores
BEGIN
  UPDATE workspaces SET free_cycle_anchor_at = COALESCE(free_cycle_anchor_at, NEW.linked_at)
   WHERE id = NEW.workspace_id;
END;

CREATE TABLE unlock_preferences (
  user_id TEXT PRIMARY KEY REFERENCES workspace_members(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
  confirm_unlock INTEGER NOT NULL DEFAULT 1 CHECK (confirm_unlock IN (0, 1))
);

-- Coperture autorevoli locali: provider e calendario commerciale le alimentano separatamente.
CREATE TABLE workspace_entitlements (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('premium', 'trial', 'lifetime', 'admin')),
  starts_at TEXT NOT NULL,
  ends_at TEXT,
  revoked_at TEXT,
  CHECK ((source = 'lifetime') = (ends_at IS NULL)),
  CHECK (julianday(starts_at) IS NOT NULL),
  CHECK (ends_at IS NULL OR (julianday(ends_at) IS NOT NULL AND julianday(ends_at) > julianday(starts_at)))
);
CREATE INDEX workspace_entitlements_workspace_idx ON workspace_entitlements(workspace_id);
CREATE TRIGGER entitlement_is_immutable BEFORE UPDATE ON workspace_entitlements
WHEN NEW.id IS NOT OLD.id OR NEW.workspace_id IS NOT OLD.workspace_id
  OR NEW.source IS NOT OLD.source OR NEW.starts_at IS NOT OLD.starts_at
  OR NEW.ends_at IS NOT OLD.ends_at
  OR (OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS NOT OLD.revoked_at)
BEGIN
  SELECT RAISE(ABORT, 'immutable_entitlement');
END;

-- La storia fiscale conserva gli intervalli di disponibilità. La loro sovrapposizione
-- con una copertura non revocata prova il diritto acquisito, senza duplicare il registro.

CREATE TRIGGER free_grant_requires_consultable_order BEFORE INSERT ON order_grants
WHEN NEW.source = 'free_cycle' AND NOT EXISTS (
  SELECT 1 FROM orders o JOIN ebay_stores s ON s.id = o.store_id
   WHERE o.id = NEW.order_id AND o.is_provisional = 0 AND o.merged_into IS NULL
     AND s.data_deleted_at IS NULL AND o.retention_until > NEW.granted_at
     AND NOT EXISTS (SELECT 1 FROM ebay_store_pauses p WHERE p.store_id = s.id AND p.reason = 'plan')
)
BEGIN
  SELECT RAISE(ABORT, 'order_not_available');
END;
