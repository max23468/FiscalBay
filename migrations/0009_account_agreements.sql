-- Accettazione dei Termini: versione e lingua accettate, con la versione
-- dell'informativa privacy resa disponibile nello stesso passaggio.
CREATE TABLE terms_acceptances (
  user_id TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  terms_version TEXT NOT NULL,
  privacy_version TEXT NOT NULL,
  language TEXT NOT NULL CHECK (language IN ('it', 'en')),
  accepted_at TEXT NOT NULL,
  PRIMARY KEY (user_id, terms_version)
);

-- Consenso marketing facoltativo, distinto dai Termini: ogni scelta resta come
-- prova con versione del testo e lingua; vale l'ultima.
CREATE TABLE marketing_consents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  granted INTEGER NOT NULL CHECK (granted IN (0, 1)),
  text_version TEXT NOT NULL,
  language TEXT NOT NULL CHECK (language IN ('it', 'en')),
  recorded_at TEXT NOT NULL
);

CREATE INDEX marketing_consents_user_idx ON marketing_consents(user_id, recorded_at);
