-- Operazioni in corso, prive di dati personali. Il blocco in service_settings e l'ingresso
-- sono serializzati dalla stessa D1: dopo la chiusura nessun nuovo lavoro può iniziare.
-- Una riga senza esito non scade: il ripristino deve fermarsi finché non è riconciliata.
CREATE TABLE service_activity (
  id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL
);
