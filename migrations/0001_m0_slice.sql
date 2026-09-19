PRAGMA foreign_keys = ON;

CREATE TABLE workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE workspace_members (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin')),
  PRIMARY KEY (workspace_id, user_id)
);

CREATE TABLE ebay_stores (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  ebay_user_id TEXT NOT NULL UNIQUE,
  linked_at TEXT NOT NULL
);

CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES ebay_stores(id) ON DELETE CASCADE,
  ebay_order_id TEXT NOT NULL,
  creation_time TEXT NOT NULL,
  last_modified_time TEXT NOT NULL,
  currency TEXT NOT NULL,
  total_minor INTEGER NOT NULL CHECK (total_minor >= 0),
  UNIQUE (store_id, ebay_order_id)
);

CREATE TABLE tax_identifiers (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  identifier_type TEXT NOT NULL,
  issuing_country TEXT NOT NULL,
  value TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  UNIQUE (order_id, identifier_type, issuing_country, value)
);

CREATE TABLE free_cycles (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  quota INTEGER NOT NULL CHECK (quota > 0),
  used INTEGER NOT NULL DEFAULT 0 CHECK (used >= 0 AND used <= quota),
  UNIQUE (workspace_id, starts_at)
);

CREATE TABLE order_grants (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  cycle_id TEXT REFERENCES free_cycles(id),
  source TEXT NOT NULL CHECK (source IN ('free_cycle', 'premium', 'trial', 'lifetime', 'admin')),
  granted_at TEXT NOT NULL,
  UNIQUE (workspace_id, order_id)
);

CREATE TRIGGER order_grant_requires_ownership
BEFORE INSERT ON order_grants
WHEN NOT EXISTS (
  SELECT 1
  FROM orders o
  JOIN ebay_stores s ON s.id = o.store_id
  WHERE o.id = NEW.order_id AND s.workspace_id = NEW.workspace_id
)
BEGIN
  SELECT RAISE(ABORT, 'order_not_in_workspace');
END;

CREATE TRIGGER free_grant_requires_capacity
BEFORE INSERT ON order_grants
WHEN NEW.source = 'free_cycle' AND (
  NEW.cycle_id IS NULL OR
  NOT EXISTS (
    SELECT 1 FROM free_cycles
    WHERE id = NEW.cycle_id
      AND workspace_id = NEW.workspace_id
      AND used < quota
  )
)
BEGIN
  SELECT RAISE(ABORT, 'free_quota_exhausted');
END;

CREATE TRIGGER free_grant_consumes_once
AFTER INSERT ON order_grants
WHEN NEW.source = 'free_cycle'
BEGIN
  UPDATE free_cycles SET used = used + 1 WHERE id = NEW.cycle_id;
END;

CREATE INDEX orders_store_modified_idx
  ON orders(store_id, last_modified_time DESC);
CREATE INDEX tax_identifiers_order_idx ON tax_identifiers(order_id);
CREATE INDEX order_grants_workspace_order_idx
  ON order_grants(workspace_id, order_id);
