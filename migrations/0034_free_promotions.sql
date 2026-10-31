-- Promozione globale del Free: un ciclo che inizia nell'intervallo riceve la sua quota e la
-- conserva fino alla propria fine, anche oltre la chiusura della promozione.
CREATE TABLE free_promotions (
  id TEXT PRIMARY KEY,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  quota INTEGER NOT NULL CHECK (quota > 0),
  created_at TEXT NOT NULL,
  CHECK (julianday(starts_at) IS NOT NULL),
  CHECK (julianday(ends_at) IS NOT NULL AND julianday(ends_at) > julianday(starts_at))
);

-- Un solo valore per istante: due promozioni non si sovrappongono.
CREATE TRIGGER free_promotion_no_overlap BEFORE INSERT ON free_promotions
WHEN EXISTS (
  SELECT 1 FROM free_promotions
   WHERE julianday(starts_at) < julianday(NEW.ends_at)
     AND julianday(NEW.starts_at) < julianday(ends_at)
)
BEGIN
  SELECT RAISE(ABORT, 'overlapping_promotion');
END;

CREATE TRIGGER free_promotion_no_overlap_on_update BEFORE UPDATE ON free_promotions
WHEN EXISTS (
  SELECT 1 FROM free_promotions
   WHERE id <> OLD.id
     AND julianday(starts_at) < julianday(NEW.ends_at)
     AND julianday(NEW.starts_at) < julianday(ends_at)
)
BEGIN
  SELECT RAISE(ABORT, 'overlapping_promotion');
END;

-- Finestra e quota restano quelle fissate alla creazione; l'utilizzo non torna indietro.
CREATE TRIGGER free_cycle_is_fixed BEFORE UPDATE ON free_cycles
WHEN NEW.id IS NOT OLD.id OR NEW.workspace_id IS NOT OLD.workspace_id
  OR NEW.starts_at IS NOT OLD.starts_at OR NEW.ends_at IS NOT OLD.ends_at
  OR NEW.quota IS NOT OLD.quota OR NEW.used < OLD.used
BEGIN
  SELECT RAISE(ABORT, 'immutable_cycle');
END;

-- L'ancoraggio del primo collegamento non si sposta né si azzera.
CREATE TRIGGER workspace_cycle_anchor_is_fixed BEFORE UPDATE OF free_cycle_anchor_at ON workspaces
WHEN OLD.free_cycle_anchor_at IS NOT NULL
  AND NEW.free_cycle_anchor_at IS NOT OLD.free_cycle_anchor_at
BEGIN
  SELECT RAISE(ABORT, 'immutable_cycle_anchor');
END;
