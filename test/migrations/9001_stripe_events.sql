CREATE TABLE stripe_events (
  stripe_event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  object_id TEXT,
  livemode INTEGER NOT NULL CHECK (livemode IN (0, 1)),
  provider_created_at TEXT NOT NULL,
  received_at TEXT NOT NULL
);

CREATE INDEX stripe_events_type_created_idx
  ON stripe_events(event_type, provider_created_at DESC);
