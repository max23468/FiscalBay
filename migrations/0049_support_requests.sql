-- Istanti delle richieste del modulo di assistenza, per il limite per account nelle
-- ultime 24 ore: testo e riepilogo diagnostico vanno soltanto alla casella supporto@.
-- La manutenzione elimina le righe oltre le 24 ore.
CREATE TABLE support_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  sent_at TEXT NOT NULL
);

CREATE INDEX support_requests_user_idx ON support_requests(user_id, sent_at);
CREATE INDEX support_requests_sent_idx ON support_requests(sent_at);
