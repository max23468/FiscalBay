-- Ultimo turno del cron Telegram per lo spazio collegato: ogni esecuzione serve prima chi
-- aspetta da più tempo, così oltre il limite di spazi per esecuzione nessuno resta escluso.
ALTER TABLE telegram_links ADD COLUMN served_at TEXT
  CHECK (served_at IS NULL OR julianday(served_at) IS NOT NULL);

-- Ultimo preavviso di inattività non riuscito: lo spazio passa dopo quelli ancora da tentare,
-- così indirizzi che rifiutano sempre l'email non fermano gli altri.
ALTER TABLE workspaces ADD COLUMN inactivity_attempt_at TEXT
  CHECK (inactivity_attempt_at IS NULL OR julianday(inactivity_attempt_at) IS NOT NULL);
