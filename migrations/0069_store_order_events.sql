-- Sottoscrizione `ORDER_CONFIRMATION` del consenso corrente: `order_events` è l'esito
-- dell'ultimo tentativo (sottoscritto, consenso senza lo scope delle notifiche o sottoscrizione
-- dell'altro ambiente), `order_events_checked_at` il suo istante. Un nuovo consenso li azzera.
ALTER TABLE ebay_store_credentials ADD COLUMN order_events TEXT
  CHECK (order_events IS NULL OR order_events IN ('subscribed', 'unauthorized', 'elsewhere'));
ALTER TABLE ebay_store_credentials ADD COLUMN order_events_checked_at TEXT;
