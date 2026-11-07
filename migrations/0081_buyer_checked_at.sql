-- Ultima lettura dello username dell'acquirente. Gli ordini senza token eIAS si abbinano a una
-- cancellazione richiesta da eBay soltanto per username: una rilettura settimanale lo aggiorna.
ALTER TABLE orders ADD COLUMN buyer_checked_at TEXT;

CREATE INDEX orders_buyer_check ON orders (store_id, buyer_checked_at)
  WHERE buyer_eias_token IS NULL AND is_provisional = 0 AND merged_into IS NULL;
