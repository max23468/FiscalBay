-- Istante dell'ultimo cambiamento da cui dipende il piano di uno spazio, azzerato dal
-- riallineamento: una pagina dell'area riallinea soltanto se è valorizzato.
ALTER TABLE workspaces ADD COLUMN plan_changed_at TEXT;

CREATE TRIGGER workspace_plan_entitlement_added AFTER INSERT ON workspace_entitlements
BEGIN
  UPDATE workspaces SET plan_changed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = NEW.workspace_id;
END;

CREATE TRIGGER workspace_plan_entitlement_changed AFTER UPDATE ON workspace_entitlements
BEGIN
  UPDATE workspaces SET plan_changed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id IN (OLD.workspace_id, NEW.workspace_id);
END;

CREATE TRIGGER workspace_plan_entitlement_removed AFTER DELETE ON workspace_entitlements
BEGIN
  UPDATE workspaces SET plan_changed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = OLD.workspace_id;
END;

CREATE TRIGGER workspace_plan_extension_added AFTER INSERT ON history_extensions
BEGIN
  UPDATE workspaces SET plan_changed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = NEW.workspace_id;
END;

CREATE TRIGGER workspace_plan_extension_changed AFTER UPDATE ON history_extensions
BEGIN
  UPDATE workspaces SET plan_changed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id IN (OLD.workspace_id, NEW.workspace_id);
END;

-- Il negozio predefinito lo scrive il riallineamento stesso: contano le scelte esplicite.
CREATE TRIGGER workspace_plan_store_chosen AFTER INSERT ON free_store_changes
WHEN NEW.kind <> 'default'
BEGIN
  UPDATE workspaces SET plan_changed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = NEW.workspace_id;
END;

CREATE TRIGGER workspace_plan_store_added AFTER INSERT ON ebay_stores
BEGIN
  UPDATE workspaces SET plan_changed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = NEW.workspace_id;
END;

CREATE TRIGGER workspace_plan_store_changed
AFTER UPDATE OF workspace_id, disconnected_at, data_deleted_at, ebay_environment ON ebay_stores
WHEN NEW.workspace_id IS NOT OLD.workspace_id OR NEW.disconnected_at IS NOT OLD.disconnected_at
  OR NEW.data_deleted_at IS NOT OLD.data_deleted_at
  OR NEW.ebay_environment IS NOT OLD.ebay_environment
BEGIN
  UPDATE workspaces SET plan_changed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id IN (OLD.workspace_id, NEW.workspace_id);
END;

CREATE TRIGGER workspace_plan_store_removed AFTER DELETE ON ebay_stores
BEGIN
  UPDATE workspaces SET plan_changed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = OLD.workspace_id;
END;
