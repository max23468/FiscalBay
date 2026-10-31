-- Cancellazioni richieste da eBay (Marketplace Account Deletion) per un utente eBay di cui
-- FiscalBay conserva dati, venditore o acquirente. La riga porta l'identità comunicata da eBay
-- finché il lavoro non si conclude e, conclusa, per la finestra di Time Travel: il compito
-- periodico ripete la cancellazione se i dati ricompaiono dopo un restore. Le notifiche di utenti
-- sconosciuti non lasciano righe.
CREATE TABLE ebay_account_deletions (
  id TEXT PRIMARY KEY,
  ebay_environment TEXT NOT NULL CHECK (ebay_environment IN ('production', 'sandbox')),
  ebay_user_id TEXT NOT NULL CHECK (length(ebay_user_id) BETWEEN 1 AND 256),
  eias_token TEXT CHECK (eias_token IS NULL OR length(eias_token) BETWEEN 1 AND 256),
  username TEXT CHECK (username IS NULL OR length(username) BETWEEN 1 AND 256),
  notified_at TEXT NOT NULL CHECK (julianday(notified_at) IS NOT NULL),
  requested_at TEXT NOT NULL CHECK (julianday(requested_at) IS NOT NULL),
  locked_until TEXT,
  completed_at TEXT CHECK (completed_at IS NULL OR julianday(completed_at) IS NOT NULL),
  UNIQUE (ebay_environment, ebay_user_id)
);

CREATE INDEX ebay_account_deletions_pending_idx ON ebay_account_deletions(completed_at, requested_at);

-- Ordini senza token eIAS dell'acquirente, cercati per username alla cancellazione richiesta da
-- eBay: la stessa espressione della query, limitata agli ordini a cui serve.
CREATE INDEX orders_buyer_username_idx ON orders(json_extract(buyer_json, '$.username'))
  WHERE buyer_eias_token IS NULL;

-- Accesso con eBay dell'utente cancellato, cercato a ogni notifica.
CREATE INDEX account_provider_idx ON "account" ("providerId", "accountId");
