-- Registro delle operazioni della console amministrativa: autore, operazione, oggetto, motivo
-- ed esito. Le righe non si modificano; la pulizia periodica le elimina dopo un anno.
CREATE TABLE admin_audit (
  id TEXT PRIMARY KEY,
  actor TEXT NOT NULL CHECK (length(actor) BETWEEN 1 AND 128),
  operation TEXT NOT NULL CHECK (length(operation) BETWEEN 1 AND 64),
  target TEXT CHECK (target IS NULL OR length(target) BETWEEN 1 AND 256),
  reason TEXT CHECK (reason IS NULL OR length(trim(reason)) BETWEEN 1 AND 500),
  outcome TEXT NOT NULL CHECK (length(outcome) BETWEEN 1 AND 64),
  at TEXT NOT NULL CHECK (strftime('%Y-%m-%dT%H:%M:%fZ', at) = at)
);
CREATE INDEX admin_audit_at_idx ON admin_audit(at);
CREATE TRIGGER admin_audit_is_immutable BEFORE UPDATE ON admin_audit
BEGIN
  SELECT RAISE(ABORT, 'immutable_audit');
END;

-- Quota base del Free decisa dalla console. Una modifica vale dai cicli che iniziano dal suo
-- istante, mai prima della sua registrazione: un ciclo già iniziato conserva la propria quota
-- anche se la sua riga si crea dopo. Senza righe vale la quota base del codice.
CREATE TABLE free_quota_changes (
  id INTEGER PRIMARY KEY,
  quota INTEGER NOT NULL CHECK (quota BETWEEN 1 AND 100),
  effective_at TEXT NOT NULL
    CHECK (strftime('%Y-%m-%dT%H:%M:%fZ', effective_at) = effective_at),
  actor TEXT NOT NULL CHECK (length(actor) BETWEEN 1 AND 128),
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 500),
  created_at TEXT NOT NULL CHECK (strftime('%Y-%m-%dT%H:%M:%fZ', created_at) = created_at),
  CHECK (julianday(effective_at) >= julianday(created_at))
);
CREATE INDEX free_quota_changes_effective_idx ON free_quota_changes(effective_at);
CREATE TRIGGER free_quota_change_is_immutable BEFORE UPDATE ON free_quota_changes
BEGIN
  SELECT RAISE(ABORT, 'immutable_quota_change');
END;

-- Comunicazioni di servizio o manutenzione per la campanella di tutti gli utenti, nelle due
-- lingue e per un periodo di validità di al massimo trenta giorni.
CREATE TABLE service_notices (
  id TEXT PRIMARY KEY,
  tone TEXT NOT NULL CHECK (tone IN ('info', 'warning')),
  title_it TEXT NOT NULL CHECK (length(trim(title_it)) BETWEEN 1 AND 120),
  body_it TEXT NOT NULL CHECK (length(trim(body_it)) BETWEEN 1 AND 1000),
  title_en TEXT NOT NULL CHECK (length(trim(title_en)) BETWEEN 1 AND 120),
  body_en TEXT NOT NULL CHECK (length(trim(body_en)) BETWEEN 1 AND 1000),
  starts_at TEXT NOT NULL CHECK (strftime('%Y-%m-%dT%H:%M:%fZ', starts_at) = starts_at),
  ends_at TEXT NOT NULL CHECK (strftime('%Y-%m-%dT%H:%M:%fZ', ends_at) = ends_at),
  created_by TEXT NOT NULL CHECK (length(created_by) BETWEEN 1 AND 128),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  withdrawn_at TEXT CHECK (withdrawn_at IS NULL OR julianday(withdrawn_at) IS NOT NULL),
  CHECK (julianday(ends_at) > julianday(starts_at)
    AND julianday(ends_at) - julianday(starts_at) <= 30)
);
CREATE INDEX service_notices_period_idx ON service_notices(ends_at);

-- Esito della revisione di una segnalazione antiabuso. La chiave identifica tipo, valore
-- condiviso e spazi coinvolti: un nuovo spazio nello stesso gruppo è una nuova segnalazione.
CREATE TABLE abuse_reviews (
  signal TEXT PRIMARY KEY CHECK (length(signal) BETWEEN 1 AND 128),
  outcome TEXT NOT NULL CHECK (outcome IN ('clear', 'suspended')),
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
  actor TEXT NOT NULL CHECK (length(actor) BETWEEN 1 AND 128),
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 500),
  reviewed_at TEXT NOT NULL CHECK (strftime('%Y-%m-%dT%H:%M:%fZ', reviewed_at) = reviewed_at),
  CHECK ((outcome = 'suspended') = (workspace_id IS NOT NULL))
);

-- Anomalie che la console apre una volta sola per giorno e per oggetto, come il consumo delle
-- quote eBay oltre la soglia: la riga resta aperta fino al rientro osservato.
CREATE TABLE admin_anomalies (
  key TEXT PRIMARY KEY CHECK (length(key) BETWEEN 1 AND 256),
  kind TEXT NOT NULL CHECK (kind IN ('ebay_quota')),
  severity TEXT NOT NULL CHECK (severity IN ('p1', 'p2', 'p3')),
  subject TEXT NOT NULL CHECK (length(subject) BETWEEN 1 AND 200),
  detail TEXT NOT NULL CHECK (json_valid(detail)),
  opened_at TEXT NOT NULL CHECK (strftime('%Y-%m-%dT%H:%M:%fZ', opened_at) = opened_at),
  seen_at TEXT NOT NULL CHECK (strftime('%Y-%m-%dT%H:%M:%fZ', seen_at) = seen_at),
  resolved_at TEXT CHECK (resolved_at IS NULL
    OR strftime('%Y-%m-%dT%H:%M:%fZ', resolved_at) = resolved_at)
);
CREATE INDEX admin_anomalies_open_idx ON admin_anomalies(kind) WHERE resolved_at IS NULL;

-- Trasferimento assistito di un negozio fra spazi: si prepara con lo stato verificato, poi si
-- conferma una sola volta prima della scadenza. Una conferma ripetuta non lo esegue di nuovo.
CREATE TABLE store_transfers (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES ebay_stores(id) ON DELETE CASCADE,
  from_workspace_id TEXT NOT NULL,
  to_workspace_id TEXT NOT NULL,
  actor TEXT NOT NULL CHECK (length(actor) BETWEEN 1 AND 128),
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 500),
  prepared_at TEXT NOT NULL CHECK (strftime('%Y-%m-%dT%H:%M:%fZ', prepared_at) = prepared_at),
  expires_at TEXT NOT NULL CHECK (julianday(expires_at) > julianday(prepared_at)),
  executed_at TEXT CHECK (executed_at IS NULL
    OR strftime('%Y-%m-%dT%H:%M:%fZ', executed_at) = executed_at),
  CHECK (from_workspace_id <> to_workspace_id)
);
CREATE INDEX store_transfers_store_idx ON store_transfers(store_id);

-- Un solo lifetime in vigore per spazio: quello revocato per rimborso o disputa resta come
-- prova e lascia concedere di nuovo il lifetime sullo stesso posto. Il pagamento resta unico
-- per la sessione di checkout.
DROP INDEX workspace_entitlements_lifetime_idx;
CREATE UNIQUE INDEX workspace_entitlements_lifetime_in_force_idx
  ON workspace_entitlements(workspace_id) WHERE source = 'lifetime' AND revoked_at IS NULL;
