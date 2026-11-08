-- Notifiche della campanella eliminate dall'utente: restano nascoste finché la riga vive.
ALTER TABLE notification_reads ADD COLUMN dismissed_at TEXT;
