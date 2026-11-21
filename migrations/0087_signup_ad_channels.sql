-- Provenienza degli iscritti: le categorie ammettono gli annunci a pagamento di Google e di Meta,
-- riconosciuti dall'etichetta nei link degli annunci. SQLite non modifica un vincolo CHECK: la
-- tabella si ricrea con gli stessi dati. Nessuna altra tabella, trigger o indice la legge.
CREATE TABLE signup_sources_new (
  user_id TEXT PRIMARY KEY REFERENCES "user"("id") ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN (
    'google', 'bing', 'other_search', 'ai_assistant', 'ebay_community', 'ebay_other', 'github',
    'youtube', 'reddit', 'telegram', 'email', 'google_ads', 'meta_ads', 'other_site', 'direct',
    'unknown'
  )),
  first_page TEXT CHECK (first_page IS NULL OR length(first_page) BETWEEN 1 AND 120),
  recorded_at TEXT NOT NULL,
  CHECK (channel <> 'unknown' OR first_page IS NULL)
) STRICT;
INSERT INTO signup_sources_new (user_id, channel, first_page, recorded_at)
SELECT user_id, channel, first_page, recorded_at FROM signup_sources;
DROP TABLE signup_sources;
ALTER TABLE signup_sources_new RENAME TO signup_sources;
