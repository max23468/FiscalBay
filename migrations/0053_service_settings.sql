-- Interruttori dei servizi e soglie configurati dalla console, una riga per impostazione con il
-- valore in JSON. Senza la riga, o con un valore non valido, vale il predefinito del codice:
-- chiamate eBay e invii Telegram attivi, soglia delle quote eBay al 70%.
CREATE TABLE service_settings (
  name TEXT PRIMARY KEY CHECK (length(name) BETWEEN 1 AND 64),
  value TEXT NOT NULL CHECK (json_valid(value)),
  updated_at TEXT NOT NULL CHECK (julianday(updated_at) IS NOT NULL)
);
