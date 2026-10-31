-- Smistamento del lavoro pianificato. `dispatched_at` è l'istante in cui il cron ha accodato la
-- lettura periodica del negozio: finché il consumer non la serve, un trigger ripetuto o
-- sovrapposto non la accoda di nuovo; dopo un'ora senza esito il cron la considera persa
-- (messaggio scaduto o finito nella DLQ) e la ripropone.
ALTER TABLE sync_state ADD COLUMN dispatched_at TEXT;

-- Turno corrente di ogni compito periodico: `slot` è l'inizio del periodo servito, `queued_at`
-- l'accodamento del messaggio, `done_at` la conclusione. Un compito si accoda una volta per
-- periodo anche con trigger saltati, ripetuti o sovrapposti; un turno accodato da oltre un'ora
-- e non concluso si riaccoda.
CREATE TABLE scheduled_tasks (
  task TEXT PRIMARY KEY,
  slot TEXT NOT NULL,
  queued_at TEXT,
  done_at TEXT
);
