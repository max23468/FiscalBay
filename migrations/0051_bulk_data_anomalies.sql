-- Le anomalie della console comprendono le soglie della Bulk Data Transfer Policy notificate da
-- eBay. SQLite non modifica un vincolo CHECK: la tabella si ricrea con gli stessi dati.
CREATE TABLE admin_anomalies_new (
  key TEXT PRIMARY KEY CHECK (length(key) BETWEEN 1 AND 256),
  kind TEXT NOT NULL CHECK (kind IN ('ebay_quota', 'ebay_bulk_data')),
  severity TEXT NOT NULL CHECK (severity IN ('p1', 'p2', 'p3')),
  subject TEXT NOT NULL CHECK (length(subject) BETWEEN 1 AND 200),
  detail TEXT NOT NULL CHECK (json_valid(detail)),
  opened_at TEXT NOT NULL CHECK (strftime('%Y-%m-%dT%H:%M:%fZ', opened_at) = opened_at),
  seen_at TEXT NOT NULL CHECK (strftime('%Y-%m-%dT%H:%M:%fZ', seen_at) = seen_at),
  resolved_at TEXT CHECK (resolved_at IS NULL
    OR strftime('%Y-%m-%dT%H:%M:%fZ', resolved_at) = resolved_at)
);
INSERT INTO admin_anomalies_new (key, kind, severity, subject, detail, opened_at, seen_at,
  resolved_at)
SELECT key, kind, severity, subject, detail, opened_at, seen_at, resolved_at FROM admin_anomalies;
DROP TABLE admin_anomalies;
ALTER TABLE admin_anomalies_new RENAME TO admin_anomalies;
CREATE INDEX admin_anomalies_open_idx ON admin_anomalies(kind) WHERE resolved_at IS NULL;
