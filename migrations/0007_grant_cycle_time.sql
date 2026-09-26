DROP TRIGGER order_grant_requires_valid_cycle;

CREATE TRIGGER order_grant_requires_valid_cycle
BEFORE INSERT ON order_grants
WHEN (NEW.source = 'free_cycle' AND NOT EXISTS (
  SELECT 1 FROM free_cycles
   WHERE id = NEW.cycle_id
     AND workspace_id = NEW.workspace_id
     AND julianday(starts_at) <= julianday(NEW.granted_at)
     AND julianday(NEW.granted_at) < julianday(ends_at)
)) OR (NEW.source <> 'free_cycle' AND NEW.cycle_id IS NOT NULL)
BEGIN
  SELECT RAISE(ABORT, 'invalid_grant_cycle');
END;
