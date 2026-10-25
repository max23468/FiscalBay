-- Comandi e tocchi sui pulsanti del bot. La ricevuta conserva il nome del comando riconosciuto o
-- i dati del pulsante, che contengono soltanto identificativi brevi, mai il testo scritto.
ALTER TABLE webhook_receipts ADD COLUMN command TEXT
  CHECK (command IS NULL OR length(command) BETWEEN 1 AND 64);
ALTER TABLE webhook_receipts ADD COLUMN callback_id TEXT
  CHECK (callback_id IS NULL OR length(callback_id) BETWEEN 1 AND 256);
ALTER TABLE webhook_receipts ADD COLUMN message_id INTEGER;
CREATE INDEX webhook_receipts_chat_idx ON webhook_receipts(provider, environment, object_id, event_at);

-- Stato della consegna della chat. `delivery_failure` è il problema in corso: `blocked` ferma gli
-- invii finché la chat non scrive di nuovo al bot, `unreachable` si chiude al primo invio
-- riuscito. `resumed_at` è la ripresa dopo un blocco: gli eventi del periodo bloccato non
-- arrivano più.
ALTER TABLE telegram_links ADD COLUMN delivery_failure TEXT
  CHECK (delivery_failure IS NULL OR delivery_failure IN ('blocked', 'unreachable'));
ALTER TABLE telegram_links ADD COLUMN delivery_failed_at TEXT;
ALTER TABLE telegram_links ADD COLUMN resumed_at TEXT;
ALTER TABLE telegram_links ADD COLUMN last_delivery_at TEXT;

-- Ultimo stato fiscale valutato per ogni ordine e collegamento: l'impronta degli identificativi
-- correnti e se la chat ha già ricevuto l'ordine. Confrontarla con lo stato corrente produce
-- un solo evento per variazione, anche se la valutazione si ripete dopo un'interruzione.
CREATE TABLE telegram_order_notices (
  order_id TEXT PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
  link_id TEXT NOT NULL,
  fiscal_key TEXT NOT NULL CHECK (json_valid(fiscal_key)),
  notified INTEGER NOT NULL CHECK (notified IN (0, 1)),
  evaluated_at TEXT NOT NULL
);

-- Messaggi da consegnare, preparati nello stesso commit dello stato notificato. Un ordine
-- singolo, il riepilogo giornaliero (che raccoglie gli eventi in attesa con `digest_id`) o il
-- completamento di un'importazione. Il contenuto si compone all'invio dai dati correnti: qui
-- restano soltanto identificativi.
CREATE TABLE telegram_deliveries (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  link_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('order', 'digest', 'import')),
  order_id TEXT REFERENCES orders(id) ON DELETE CASCADE,
  store_id TEXT REFERENCES ebay_stores(id) ON DELETE CASCADE,
  change TEXT CHECK (change IN ('new', 'available', 'changed', 'removed')),
  -- Identità dell'evento: la stessa variazione o lo stesso turno non si preparano due volte.
  event_key TEXT NOT NULL,
  event_at TEXT NOT NULL,
  digest_id TEXT REFERENCES telegram_deliveries(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  -- Parti già consegnate di un messaggio suddiviso: un nuovo tentativo riprende dalla successiva.
  parts_sent INTEGER NOT NULL DEFAULT 0,
  retry_at TEXT,
  uncertain_at TEXT,
  lease TEXT,
  locked_until TEXT,
  sent_at TEXT,
  failed_at TEXT,
  CHECK ((kind = 'order') = (order_id IS NOT NULL AND change IS NOT NULL)),
  CHECK (kind <> 'import' OR store_id IS NOT NULL),
  UNIQUE (link_id, event_key)
);
CREATE INDEX telegram_deliveries_pending_idx ON telegram_deliveries(workspace_id, created_at)
  WHERE sent_at IS NULL AND failed_at IS NULL;
CREATE INDEX telegram_deliveries_digest_idx ON telegram_deliveries(digest_id)
  WHERE digest_id IS NOT NULL;
CREATE INDEX telegram_deliveries_order_idx ON telegram_deliveries(order_id);
CREATE INDEX telegram_deliveries_store_idx ON telegram_deliveries(store_id);
CREATE INDEX telegram_deliveries_closed_idx ON telegram_deliveries(created_at)
  WHERE sent_at IS NOT NULL OR failed_at IS NOT NULL;
