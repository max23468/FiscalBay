-- Ordini con chiavi di riga Trading: l'abbinamento di un import scorre soltanto questi.
CREATE INDEX orders_trading_keys_idx ON orders(store_id) WHERE trading_line_keys IS NOT NULL;
