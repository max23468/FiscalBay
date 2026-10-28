-- Incidenti comunicati all'owner sul bot dell'ambiente (D198): una riga per anomalia della
-- console di gravità P1 o P2, con l'ultimo stato comunicato. L'avviso parte all'apertura,
-- all'aggravamento e al rientro; ripetere il controllo non ripete l'avviso. `detail` conserva
-- soltanto conteggio ed etichette degli oggetti, mai dati dei buyer.
CREATE TABLE owner_incidents (
  key TEXT PRIMARY KEY CHECK (length(key) BETWEEN 1 AND 256),
  kind TEXT NOT NULL CHECK (length(kind) BETWEEN 1 AND 32),
  severity TEXT NOT NULL CHECK (severity IN ('p1', 'p2')),
  detail TEXT NOT NULL CHECK (json_valid(detail)),
  opened_at TEXT NOT NULL CHECK (strftime('%Y-%m-%dT%H:%M:%fZ', opened_at) = opened_at),
  resolved_at TEXT CHECK (resolved_at IS NULL
    OR strftime('%Y-%m-%dT%H:%M:%fZ', resolved_at) = resolved_at),
  notified TEXT NOT NULL DEFAULT 'none' CHECK (notified IN ('none', 'opened', 'resolved')),
  notified_severity TEXT CHECK (notified_severity IS NULL OR notified_severity IN ('p1', 'p2')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  retry_at TEXT CHECK (retry_at IS NULL
    OR strftime('%Y-%m-%dT%H:%M:%fZ', retry_at) = retry_at)
);
