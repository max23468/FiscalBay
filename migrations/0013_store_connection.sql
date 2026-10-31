-- Ragioni di pausa indipendenti: la pausa manuale e quella del piano possono coesistere e
-- togliere l'una non toglie l'altra. Lo stato della sincronizzazione resta in `sync_state`.
CREATE TABLE ebay_store_pauses (
  store_id TEXT NOT NULL REFERENCES ebay_stores(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN ('manual', 'plan', 'inactivity', 'admin')),
  paused_at TEXT NOT NULL,
  PRIMARY KEY (store_id, reason)
);

-- Lo scollegamento toglie i token e conserva il negozio: ricollegare ritrova la stessa riga,
-- quindi la stessa identità e lo stesso spazio. `data_deleted_at` registra l'eliminazione
-- dei dati scelta dal merchant.
ALTER TABLE ebay_stores ADD COLUMN disconnected_at TEXT;
ALTER TABLE ebay_stores ADD COLUMN data_deleted_at TEXT;
