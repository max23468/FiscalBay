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

-- Profilo di registrazione: nome e cognome della persona sempre obbligatori;
-- l'azienda aggiunge la ragione sociale. Il tipo non cambia piano né limiti.
CREATE TABLE user_profiles (
  user_id TEXT PRIMARY KEY REFERENCES "user"("id") ON DELETE CASCADE,
  first_name TEXT NOT NULL CHECK (length(first_name) BETWEEN 1 AND 100),
  last_name TEXT NOT NULL CHECK (length(last_name) BETWEEN 1 AND 100),
  account_type TEXT NOT NULL CHECK (account_type IN ('private', 'business')),
  company_name TEXT CHECK (length(company_name) BETWEEN 1 AND 200),
  updated_at TEXT NOT NULL,
  CHECK ((account_type = 'business') = (company_name IS NOT NULL))
);

-- Contatori del limite di tentativi di Better Auth, condivisi fra gli isolate.
CREATE TABLE "rateLimit" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "key" TEXT NOT NULL UNIQUE,
  "count" INTEGER NOT NULL,
  "lastRequest" BIGINT NOT NULL
);
