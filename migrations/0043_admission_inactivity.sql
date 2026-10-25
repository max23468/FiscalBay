-- Ultima attività umana verificata dello spazio, cioè una pagina dell'area aperta con una
-- sessione, e preavviso di inattività del Free. Uno spazio senza valore riceve il primo dal
-- compito dell'inattività, così il conteggio dei trenta giorni non parte mai nel passato.
ALTER TABLE workspaces ADD COLUMN active_at TEXT;
ALTER TABLE workspaces ADD COLUMN inactivity_notice_at TEXT;

-- Registrazione completata con la lista d'attesa attiva e non ancora ammessa: l'ammissione
-- toglie il valore. Gli account registrati prima restano ammessi.
ALTER TABLE user_profiles ADD COLUMN waitlisted_at TEXT;

-- Interruttori dell'ammissione, una sola riga. Senza la riga nessuna lista d'attesa e acquisti
-- aperti: è il comportamento precedente.
CREATE TABLE admission_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  free_waitlist INTEGER NOT NULL CHECK (free_waitlist IN (0, 1)),
  purchases_open INTEGER NOT NULL CHECK (purchases_open IN (0, 1)),
  updated_at TEXT NOT NULL
);
