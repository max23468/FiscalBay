-- Preferenze dell'account, una riga per utente: un valore assente vale il predefinito
-- (lingua dell'indirizzo, tema del sistema, fuso di Roma, modello di messaggio dei testi).
CREATE TABLE user_preferences (
  user_id TEXT PRIMARY KEY REFERENCES "user"("id") ON DELETE CASCADE,
  language TEXT CHECK (language IN ('it', 'en')),
  theme TEXT CHECK (theme IN ('light', 'dark')),
  time_zone TEXT CHECK (length(time_zone) BETWEEN 1 AND 64),
  template_it TEXT CHECK (length(template_it) BETWEEN 1 AND 2000),
  template_en TEXT CHECK (length(template_en) BETWEEN 1 AND 2000),
  updated_at TEXT NOT NULL
);

-- Notifiche della campanella già lette. Le notifiche nascono dallo stato corrente e restano
-- visibili al massimo 30 giorni: una lettura più vecchia non serve più.
CREATE TABLE notification_reads (
  user_id TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  notification_id TEXT NOT NULL CHECK (length(notification_id) BETWEEN 1 AND 200),
  read_at TEXT NOT NULL,
  PRIMARY KEY (user_id, notification_id)
);

CREATE INDEX notification_reads_read_at_idx ON notification_reads(read_at);
