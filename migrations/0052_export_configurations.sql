-- Configurazioni dell'esportazione salvate con Premium: formato, granularità e colonne scelte
-- nel loro ordine, con un nome unico per utente. Cambiano soltanto la forma del file, non
-- ambito o diritti; si eliminano con l'account.
CREATE TABLE export_configurations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
  format TEXT NOT NULL CHECK (format IN ('csv', 'xlsx')),
  granularity TEXT NOT NULL CHECK (granularity IN ('order', 'item')),
  columns TEXT NOT NULL CHECK (length(columns) BETWEEN 1 AND 1000),
  updated_at TEXT NOT NULL CHECK (julianday(updated_at) IS NOT NULL),
  UNIQUE (user_id, name)
);
