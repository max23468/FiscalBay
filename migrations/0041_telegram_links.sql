-- Le ricevute accolgono anche il bot Telegram. Telegram non permette di rileggere un
-- aggiornamento: per il comando /start restano la chat (oggetto) e l'impronta del token di
-- collegamento, mai il testo del messaggio o il token.
CREATE TABLE webhook_receipts_new (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider IN ('ebay', 'stripe', 'telegram')),
  environment TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  object_id TEXT NOT NULL,
  store_id TEXT REFERENCES ebay_stores(id) ON DELETE CASCADE,
  consent_granted_at TEXT,
  link_token_hash TEXT CHECK (link_token_hash IS NULL OR length(link_token_hash) = 64),
  event_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  queued_at TEXT,
  completed_at TEXT,
  lease TEXT,
  locked_until TEXT,
  UNIQUE (provider, environment, provider_id)
);
INSERT INTO webhook_receipts_new (id, provider, environment, provider_id, topic, object_id,
  store_id, consent_granted_at, event_at, expires_at, queued_at, completed_at, lease, locked_until)
SELECT id, provider, environment, provider_id, topic, object_id, store_id, consent_granted_at,
  event_at, expires_at, queued_at, completed_at, lease, locked_until FROM webhook_receipts;
DROP TABLE webhook_receipts;
ALTER TABLE webhook_receipts_new RENAME TO webhook_receipts;
CREATE INDEX webhook_receipts_expiry_idx ON webhook_receipts(expires_at);

-- Richiesta di collegamento creata dalle Impostazioni. Il deep link porta il token, qui resta
-- la sua impronta: monouso, breve e legata a spazio, utente e sessione, che chiudendosi la
-- elimina. `consumed_by` è la ricevuta che l'ha usata, così un nuovo tentativo la riconosce.
CREATE TABLE telegram_link_requests (
  token_hash TEXT PRIMARY KEY CHECK (length(token_hash) = 64),
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL REFERENCES "session"(id) ON DELETE CASCADE,
  language TEXT NOT NULL CHECK (language IN ('it', 'en')),
  time_zone TEXT NOT NULL CHECK (length(time_zone) BETWEEN 1 AND 64),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  consumed_by TEXT,
  CHECK ((consumed_at IS NULL) = (consumed_by IS NULL))
);
CREATE INDEX telegram_link_requests_workspace_idx ON telegram_link_requests(workspace_id);
CREATE INDEX telegram_link_requests_expiry_idx ON telegram_link_requests(expires_at);
CREATE INDEX telegram_link_requests_session_idx ON telegram_link_requests(session_id);

-- Una sola chat privata per spazio. `id` è la generazione del collegamento: cambia con la chat,
-- così una consegna preparata per la chat precedente non trova più il suo destinatario.
CREATE TABLE telegram_links (
  workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  id TEXT NOT NULL UNIQUE,
  chat_id TEXT NOT NULL CHECK (length(chat_id) BETWEEN 1 AND 32),
  chat_label TEXT CHECK (chat_label IS NULL OR length(chat_label) BETWEEN 1 AND 128),
  language TEXT NOT NULL CHECK (language IN ('it', 'en')),
  linked_at TEXT NOT NULL
);

-- Preferenze delle notifiche dello spazio; senza riga valgono i predefiniti. `events_from` è la
-- riattivazione più recente: gli eventi precedenti non si notificano.
CREATE TABLE telegram_preferences (
  workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  filter TEXT NOT NULL DEFAULT 'fiscal' CHECK (filter IN ('fiscal', 'all')),
  mode TEXT NOT NULL DEFAULT 'each' CHECK (mode IN ('each', 'digest')),
  digest_time TEXT NOT NULL DEFAULT '18:00' CHECK (digest_time GLOB '[0-2][0-9]:[0-5][0-9]'),
  time_zone TEXT NOT NULL DEFAULT 'Europe/Rome' CHECK (length(time_zone) BETWEEN 1 AND 64),
  events_from TEXT,
  updated_at TEXT NOT NULL
);

-- Scelta per negozio; senza riga il negozio è incluso.
CREATE TABLE telegram_store_preferences (
  store_id TEXT PRIMARY KEY REFERENCES ebay_stores(id) ON DELETE CASCADE,
  enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
  events_from TEXT,
  updated_at TEXT NOT NULL
);
