-- Sospensione antiabuso del Free: la pausa dell'assistenza che l'esito «sospeso» mette sui
-- negozi reali dello spazio si distingue da quella manuale della console. Il riallineamento del
-- piano la aggiunge finché l'esito resta e lo spazio non ha una copertura pagata o concessa, e
-- la toglie negli altri casi; la console toglie soltanto la pausa manuale. Il venditore vede
-- entrambe come pausa dell'assistenza.
ALTER TABLE ebay_store_pauses ADD COLUMN abuse_review INTEGER NOT NULL DEFAULT 0
  CHECK (abuse_review IN (0, 1) AND (abuse_review = 0 OR reason = 'admin'));

-- Cancellazione dell'account in corso: nessuna sessione nasce per l'utente, neppure in
-- concorrenza con la conferma. La richiesta registrata, o riapplicata come marker dopo un
-- restore, chiude subito le sessioni presenti; così anche la sua riapertura.
CREATE TRIGGER session_refused_during_account_deletion BEFORE INSERT ON "session"
WHEN EXISTS (SELECT 1 FROM account_deletions WHERE user_id = NEW."userId")
BEGIN
  SELECT RAISE(ABORT, 'account_deletion_in_progress');
END;

CREATE TRIGGER account_deletion_closes_sessions AFTER INSERT ON account_deletions
BEGIN
  DELETE FROM "session" WHERE "userId" = NEW.user_id;
END;

CREATE TRIGGER account_deletion_reopening_closes_sessions
AFTER UPDATE OF completed_at ON account_deletions
WHEN NEW.completed_at IS NULL
BEGIN
  DELETE FROM "session" WHERE "userId" = NEW.user_id;
END;

-- Sblocchi di un ciclo Free arrivati con il segno di un negozio, lasciato da uno spazio
-- cancellato o da un trasferimento, per ciclo di partenza: più negozi dello stesso spazio o un
-- nuovo collegamento non li sommano due volte. Esce con il ciclo che li ha ricevuti.
CREATE TABLE free_cycle_imports (
  cycle_id TEXT NOT NULL REFERENCES free_cycles(id) ON DELETE CASCADE,
  origin_anchor_at TEXT NOT NULL CHECK (julianday(origin_anchor_at) IS NOT NULL),
  origin_starts_at TEXT NOT NULL CHECK (julianday(origin_starts_at) IS NOT NULL),
  used INTEGER NOT NULL CHECK (used > 0),
  PRIMARY KEY (cycle_id, origin_anchor_at, origin_starts_at)
) WITHOUT ROWID;

-- L'impronta dei segni dei negozi è ora un HMAC con una chiave derivata dal segreto del
-- server, della stessa lunghezza: chi conosce soltanto l'identificativo eBay non la ricalcola.
-- I segni scritti prima con l'impronta senza chiave non si riconoscono più e restano senza
-- effetto fino alla pulizia della loro scadenza.
