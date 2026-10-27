-- Primi passaggi di ogni spazio per i KPI della console: una riga per spazio e passaggio, con
-- l'istante del primo. La chiave primaria rende ogni scrittura idempotente, quindi retry, schede
-- concorrenti, ricollegamenti e letture ripetute non producono doppioni. Le righe nascono dai
-- trigger sulle tabelle che registrano già il fatto, mai dalle pagine, e non toccano l'attività
-- umana dello spazio. Escono con lo spazio; nessun dato fiscale, buyer o identificativo eBay.
CREATE TABLE workspace_funnel_steps (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  step TEXT NOT NULL CHECK (step IN (
    'store_linked', 'first_sync', 'first_order', 'first_tax_id', 'first_unlock', 'trial', 'purchase'
  )),
  occurred_at TEXT NOT NULL CHECK (julianday(occurred_at) IS NOT NULL),
  PRIMARY KEY (workspace_id, step)
) WITHOUT ROWID;

CREATE INDEX workspace_funnel_steps_occurred_idx ON workspace_funnel_steps(step, occurred_at);

-- Letture dei recenti aggregate per giorno UTC, di tutti i negozi: tentativi e falliti. Le
-- ultime letture di ogni negozio restano in `sync_runs`; qui nessun negozio. La pulizia
-- giornaliera elimina i giorni oltre i novanta.
CREATE TABLE sync_daily (
  day TEXT PRIMARY KEY CHECK (date(day) = day),
  attempts INTEGER NOT NULL CHECK (attempts > 0),
  failures INTEGER NOT NULL CHECK (failures BETWEEN 0 AND attempts)
);

-- Report del browser già ricevuti, per accettarne uno solo per biglietto. Il biglietto scade
-- dopo quindici minuti e la pulizia giornaliera elimina le righe scadute.
CREATE TABLE page_timing_reports (
  nonce TEXT PRIMARY KEY CHECK (length(nonce) BETWEEN 16 AND 64),
  expires_at TEXT NOT NULL CHECK (julianday(expires_at) IS NOT NULL)
) WITHOUT ROWID;

CREATE INDEX page_timing_reports_expires_idx ON page_timing_reports(expires_at);

-- Dentro un trigger l'istruzione esterna impone la propria risoluzione dei conflitti, e un
-- upsert esterno renderebbe un `INSERT OR IGNORE` un errore: ogni scrittura controlla quindi
-- la riga esistente.
CREATE TRIGGER store_link_funnel_step
AFTER INSERT ON ebay_store_credentials
BEGIN
  INSERT INTO workspace_funnel_steps (workspace_id, step, occurred_at)
  SELECT s.workspace_id, 'store_linked', NEW.granted_at FROM ebay_stores s
  WHERE s.id = NEW.store_id AND NOT EXISTS (SELECT 1 FROM workspace_funnel_steps m
    WHERE m.workspace_id = s.workspace_id AND m.step = 'store_linked');
END;

CREATE TRIGGER store_relink_funnel_step
AFTER UPDATE OF granted_at ON ebay_store_credentials
BEGIN
  INSERT INTO workspace_funnel_steps (workspace_id, step, occurred_at)
  SELECT s.workspace_id, 'store_linked', NEW.granted_at FROM ebay_stores s
  WHERE s.id = NEW.store_id AND NOT EXISTS (SELECT 1 FROM workspace_funnel_steps m
    WHERE m.workspace_id = s.workspace_id AND m.step = 'store_linked');
END;

CREATE TRIGGER sync_run_metrics
AFTER INSERT ON sync_runs
BEGIN
  UPDATE sync_daily SET attempts = attempts + 1, failures = failures + (NEW.ok = 0)
  WHERE day = date(NEW.started_at);
  INSERT INTO sync_daily (day, attempts, failures)
  SELECT date(NEW.started_at), 1, NEW.ok = 0
  WHERE NOT EXISTS (SELECT 1 FROM sync_daily WHERE day = date(NEW.started_at));
  INSERT INTO workspace_funnel_steps (workspace_id, step, occurred_at)
  SELECT s.workspace_id, 'first_sync', NEW.started_at FROM ebay_stores s
  WHERE s.id = NEW.store_id AND NEW.ok = 1 AND NOT EXISTS (SELECT 1 FROM workspace_funnel_steps m
    WHERE m.workspace_id = s.workspace_id AND m.step = 'first_sync');
END;

-- L'istante è l'ingresso negli elenchi, scritto con l'orologio del Worker all'inserimento.
CREATE TRIGGER order_funnel_step
AFTER INSERT ON orders
BEGIN
  INSERT INTO workspace_funnel_steps (workspace_id, step, occurred_at)
  SELECT s.workspace_id, 'first_order',
    COALESCE(NEW.listed_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  FROM ebay_stores s WHERE s.id = NEW.store_id AND NOT EXISTS (SELECT 1 FROM workspace_funnel_steps m
    WHERE m.workspace_id = s.workspace_id AND m.step = 'first_order');
END;

CREATE TRIGGER tax_id_funnel_step
AFTER INSERT ON tax_identifiers
WHEN NEW.identifier_type = 'CODICE_FISCALE'
BEGIN
  INSERT INTO workspace_funnel_steps (workspace_id, step, occurred_at)
  SELECT s.workspace_id, 'first_tax_id', NEW.observed_at
  FROM orders o JOIN ebay_stores s ON s.id = o.store_id
  WHERE o.id = NEW.order_id AND NOT EXISTS (SELECT 1 FROM workspace_funnel_steps m
    WHERE m.workspace_id = s.workspace_id AND m.step = 'first_tax_id');
END;

CREATE TRIGGER unlock_funnel_step
AFTER INSERT ON order_grants
WHEN NOT EXISTS (SELECT 1 FROM workspace_funnel_steps
  WHERE workspace_id = NEW.workspace_id AND step = 'first_unlock')
BEGIN
  INSERT INTO workspace_funnel_steps (workspace_id, step, occurred_at)
  VALUES (NEW.workspace_id, 'first_unlock', NEW.granted_at);
END;

-- Prova e primo acquisto pagato (Premium o lifetime); le coperture concesse non contano.
CREATE TRIGGER coverage_funnel_step
AFTER INSERT ON workspace_entitlements
WHEN (NEW.source = 'trial' OR (NEW.source IN ('premium', 'lifetime') AND NEW.amount_paid > 0))
  AND NOT EXISTS (SELECT 1 FROM workspace_funnel_steps WHERE workspace_id = NEW.workspace_id
    AND step = CASE NEW.source WHEN 'trial' THEN 'trial' ELSE 'purchase' END)
BEGIN
  INSERT INTO workspace_funnel_steps (workspace_id, step, occurred_at)
  VALUES (NEW.workspace_id, CASE NEW.source WHEN 'trial' THEN 'trial' ELSE 'purchase' END,
    CASE NEW.source WHEN 'trial' THEN NEW.starts_at ELSE COALESCE(NEW.paid_at, NEW.starts_at) END);
END;

-- Passaggi già avvenuti, ricostruiti dallo stato conservato: gli ordini e le letture già
-- eliminati non tornano, quindi gli istanti sono i più vecchi ancora presenti.
INSERT OR IGNORE INTO workspace_funnel_steps (workspace_id, step, occurred_at)
SELECT s.workspace_id, 'store_linked', MIN(c.granted_at)
FROM ebay_store_credentials c JOIN ebay_stores s ON s.id = c.store_id GROUP BY s.workspace_id;

INSERT OR IGNORE INTO workspace_funnel_steps (workspace_id, step, occurred_at)
SELECT workspace_id, 'first_sync', MIN(at) FROM (
  SELECT s.workspace_id, r.started_at AS at FROM sync_runs r JOIN ebay_stores s ON s.id = r.store_id
  WHERE r.ok = 1
  UNION ALL
  SELECT s.workspace_id, t.last_success_at FROM sync_state t JOIN ebay_stores s ON s.id = t.store_id
  WHERE t.last_success_at IS NOT NULL
) GROUP BY workspace_id;

INSERT OR IGNORE INTO workspace_funnel_steps (workspace_id, step, occurred_at)
SELECT s.workspace_id, 'first_order', MIN(COALESCE(o.listed_at, o.creation_time))
FROM orders o JOIN ebay_stores s ON s.id = o.store_id GROUP BY s.workspace_id;

INSERT OR IGNORE INTO workspace_funnel_steps (workspace_id, step, occurred_at)
SELECT s.workspace_id, 'first_tax_id', MIN(t.observed_at)
FROM tax_identifiers t JOIN orders o ON o.id = t.order_id JOIN ebay_stores s ON s.id = o.store_id
WHERE t.identifier_type = 'CODICE_FISCALE' GROUP BY s.workspace_id;

INSERT OR IGNORE INTO workspace_funnel_steps (workspace_id, step, occurred_at)
SELECT workspace_id, 'first_unlock', MIN(granted_at) FROM order_grants GROUP BY workspace_id;

INSERT OR IGNORE INTO workspace_funnel_steps (workspace_id, step, occurred_at)
SELECT workspace_id, 'trial', MIN(starts_at) FROM workspace_entitlements
WHERE source = 'trial' GROUP BY workspace_id;

INSERT OR IGNORE INTO workspace_funnel_steps (workspace_id, step, occurred_at)
SELECT workspace_id, 'purchase', MIN(COALESCE(paid_at, starts_at)) FROM workspace_entitlements
WHERE source IN ('premium', 'lifetime') AND amount_paid > 0 GROUP BY workspace_id;

INSERT INTO sync_daily (day, attempts, failures)
SELECT date(started_at), COUNT(*), SUM(ok = 0) FROM sync_runs GROUP BY date(started_at);
