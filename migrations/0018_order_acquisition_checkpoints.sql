-- Checkpoint dell'acquisizione ordini. `cursor` è il limite già applicato della lettura dei
-- recenti per data di modifica; la passata in corso conserva fine, link `next` e totale
-- atteso. Lo storico si legge per data di creazione nell'intervallo fissato al primo avvio.
-- `locked_until` serializza le esecuzioni dello stesso negozio.
ALTER TABLE sync_state ADD COLUMN recent_end TEXT;
ALTER TABLE sync_state ADD COLUMN recent_next TEXT;
ALTER TABLE sync_state ADD COLUMN recent_total INTEGER;
ALTER TABLE sync_state ADD COLUMN history_from TEXT;
ALTER TABLE sync_state ADD COLUMN history_until TEXT;
ALTER TABLE sync_state ADD COLUMN history_next TEXT;
ALTER TABLE sync_state ADD COLUMN history_total INTEGER;
ALTER TABLE sync_state ADD COLUMN history_done_at TEXT;
ALTER TABLE sync_state ADD COLUMN locked_until TEXT;

-- Dettaglio di ogni ordine Fulfillment (dati fiscali Trading e immagini) letto per la versione
-- indicata da `detail_for`: diversa dalla data di modifica registrata significa lavoro da fare,
-- anche quando la nuova versione non cambia i campi dell'ordine. Un errore rimanda il
-- tentativo; dopo l'ultimo la versione resta chiusa con il codice dell'errore.
ALTER TABLE order_source_refs ADD COLUMN detail_for TEXT;
ALTER TABLE order_source_refs ADD COLUMN detail_error TEXT;
ALTER TABLE order_source_refs ADD COLUMN detail_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE order_source_refs ADD COLUMN detail_retry_at TEXT;
CREATE INDEX order_source_refs_detail_idx ON order_source_refs(store_id, last_modified_time)
  WHERE source = 'fulfillment' AND detail_for IS NOT last_modified_time;
