-- Turno della lettura periodica. `polled_at` è l'inizio dell'ultima lettura dei recenti, anche
-- non riuscita: decide cadenza ed equità fra i negozi. `requested_at` è la richiesta manuale non
-- ancora servita: le richieste ripetute confluiscono nella stessa e il cron la riprende se la
-- coda non l'ha accettata o il messaggio è andato perso.
ALTER TABLE sync_state ADD COLUMN polled_at TEXT;
ALTER TABLE sync_state ADD COLUMN requested_at TEXT;

-- Ultime letture dei recenti di ogni negozio, mostrate nella schermata Negozi: solo inizio,
-- esito e numero di ordini nuovi. Ne restano tre per negozio.
CREATE TABLE sync_runs (
  id INTEGER PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES ebay_stores(id) ON DELETE CASCADE,
  started_at TEXT NOT NULL,
  ok INTEGER NOT NULL CHECK (ok IN (0, 1)),
  new_orders INTEGER NOT NULL CHECK (new_orders >= 0)
);
CREATE INDEX sync_runs_store_idx ON sync_runs(store_id, started_at);

-- Attesa chiesta da eBay con un limite di frequenza: le quote appartengono al keyset
-- dell'ambiente, quindi l'attesa vale per tutti i negozi che usano la stessa origine API.
CREATE TABLE ebay_rate_limits (
  api_origin TEXT PRIMARY KEY,
  until TEXT NOT NULL
);
