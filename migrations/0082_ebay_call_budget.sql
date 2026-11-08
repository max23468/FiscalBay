-- Chiamate eBay dei negozi fatte da questo Worker, per giorno UTC, origine API e chiamata: la
-- console le confronta con il consumo dell'intero keyset, che test e Production condividono, e
-- il lavoro non urgente le usa per restare entro il proprio budget giornaliero.
CREATE TABLE ebay_call_counts (
  day TEXT NOT NULL CHECK (length(day) = 10),
  api_origin TEXT NOT NULL,
  call TEXT NOT NULL CHECK (length(call) BETWEEN 1 AND 64),
  count INTEGER NOT NULL CHECK (count >= 0),
  PRIMARY KEY (day, api_origin, call)
);

-- Ultima lettura delle quote giornaliere del keyset per chiamata, da `getRateLimits`.
CREATE TABLE ebay_quota_usage (
  api_origin TEXT NOT NULL,
  call TEXT NOT NULL CHECK (length(call) BETWEEN 1 AND 64),
  quota_limit INTEGER NOT NULL CHECK (quota_limit >= 0),
  consumed INTEGER NOT NULL CHECK (consumed >= 0),
  reset_at TEXT,
  read_at TEXT NOT NULL,
  PRIMARY KEY (api_origin, call)
);

-- Lettura fiscale Trading fatta su un ordine già pagato: le versioni successive non la ripetono.
ALTER TABLE order_tax_checks ADD COLUMN paid INTEGER NOT NULL DEFAULT 0 CHECK (paid IN (0, 1));
