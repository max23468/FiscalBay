-- Motivi di uscita: una riga per disdetta dal portale e per cancellazione dell'account. Nei
-- primi 30 giorni porta la chiave dell'avviso all'owner, lo spazio, il commento facoltativo e
-- l'istante; poi la pulizia li toglie e resta l'istantanea anonima con motivo, piano, fascia
-- di anzianità e mese, eliminata dopo 24 mesi.
CREATE TABLE exit_feedback (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('cancellation', 'account_deletion')),
  reason TEXT CHECK (reason IS NULL OR reason IN (
    'too_expensive', 'unused', 'switched_service', 'missing_features', 'low_quality',
    'closing_business', 'other'
  )),
  plan TEXT NOT NULL CHECK (plan IN (
    'free', 'trial', 'monthly', 'annual', 'lifetime', 'granted'
  )),
  tenure TEXT NOT NULL CHECK (tenure IN ('under_1', '1_3', '3_6', '6_12', 'over_12')),
  month TEXT NOT NULL CHECK (month GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'),
  source_key TEXT UNIQUE,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE SET NULL,
  comment TEXT CHECK (comment IS NULL OR length(comment) BETWEEN 1 AND 500),
  recorded_at TEXT,
  CHECK (recorded_at IS NOT NULL
    OR (source_key IS NULL AND workspace_id IS NULL AND comment IS NULL))
) STRICT;

CREATE INDEX exit_feedback_month ON exit_feedback (month);
CREATE INDEX exit_feedback_recent ON exit_feedback (recorded_at) WHERE recorded_at IS NOT NULL;
CREATE INDEX exit_feedback_workspace ON exit_feedback (workspace_id)
  WHERE workspace_id IS NOT NULL;

-- Motivo scelto nella richiesta di cancellazione dell'account, in attesa della conferma dal
-- link email: la conferma lo porta in `exit_feedback`, la pulizia lo elimina dopo un giorno.
CREATE TABLE account_deletion_feedback (
  user_id TEXT PRIMARY KEY REFERENCES "user"("id") ON DELETE CASCADE,
  reason TEXT CHECK (reason IS NULL OR reason IN (
    'too_expensive', 'unused', 'switched_service', 'missing_features', 'low_quality',
    'closing_business', 'other'
  )),
  comment TEXT CHECK (comment IS NULL OR length(comment) BETWEEN 1 AND 500),
  recorded_at TEXT NOT NULL,
  CHECK (reason IS NOT NULL OR comment IS NOT NULL)
) STRICT;
