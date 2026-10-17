-- Identità stabile ricavata dall'ordine, con la stessa conservazione dello snapshot buyer.
ALTER TABLE orders ADD COLUMN buyer_eias_token TEXT;
CREATE INDEX orders_buyer_identity_idx ON orders(buyer_eias_token, creation_time)
  WHERE buyer_eias_token IS NOT NULL;
