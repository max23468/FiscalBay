-- Un solo spazio operativo e un solo proprietario per spazio nella 2.0.
CREATE UNIQUE INDEX workspace_members_user_idx ON workspace_members(user_id);
CREATE UNIQUE INDEX workspace_members_workspace_idx ON workspace_members(workspace_id);

-- Il ciclo appartiene allo stesso spazio; un grant Free richiede un dato effettivo.
CREATE TRIGGER order_grant_requires_available_data
BEFORE INSERT ON order_grants
WHEN NEW.source = 'free_cycle' AND NOT EXISTS (
  SELECT 1 FROM tax_identifiers WHERE order_id = NEW.order_id
)
BEGIN
  SELECT RAISE(ABORT, 'tax_data_unavailable');
END;

CREATE TRIGGER order_grant_requires_valid_cycle
BEFORE INSERT ON order_grants
WHEN (NEW.source = 'free_cycle' AND NOT EXISTS (
  SELECT 1 FROM free_cycles
   WHERE id = NEW.cycle_id
     AND workspace_id = NEW.workspace_id
     AND starts_at <= NEW.granted_at
     AND NEW.granted_at < ends_at
)) OR (NEW.source <> 'free_cycle' AND NEW.cycle_id IS NOT NULL)
BEGIN
  SELECT RAISE(ABORT, 'invalid_grant_cycle');
END;

-- Il grant originale non cambia proprietario, ordine o fonte dopo il commit.
CREATE TRIGGER order_grant_is_immutable
BEFORE UPDATE ON order_grants
BEGIN
  SELECT RAISE(ABORT, 'immutable_grant');
END;

-- Il numero di posto è il vincolo atomico del tetto di venti lifetime.
-- La prenotazione resta occupata fino a riconciliazione esplicita.
CREATE TABLE lifetime_allocations (
  slot INTEGER PRIMARY KEY CHECK (slot BETWEEN 1 AND 20),
  workspace_id TEXT UNIQUE REFERENCES workspaces(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('reserved', 'active')),
  provider_reference TEXT UNIQUE,
  created_at TEXT NOT NULL
);
