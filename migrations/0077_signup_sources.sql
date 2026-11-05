-- Provenienza degli iscritti: categoria chiusa del canale e prima pagina vista, salvate una volta
-- alla creazione dell'account e cancellate con l'utente. Nessun identificativo del visitatore.
CREATE TABLE signup_sources (
  user_id TEXT PRIMARY KEY REFERENCES "user"("id") ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN (
    'google', 'bing', 'other_search', 'ai_assistant', 'ebay_community', 'ebay_other', 'github',
    'youtube', 'reddit', 'telegram', 'email', 'other_site', 'direct', 'unknown'
  )),
  first_page TEXT CHECK (first_page IS NULL OR length(first_page) BETWEEN 1 AND 120),
  recorded_at TEXT NOT NULL,
  CHECK (channel <> 'unknown' OR first_page IS NULL)
) STRICT;
