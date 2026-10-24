-- Periodicità del prossimo rinnovo, riletta dal prezzo dell'abbonamento: con un cambio
-- programmato differisce da `offer`, la periodicità del periodo pagato in corso.
ALTER TABLE stripe_subscriptions ADD COLUMN renewal_offer TEXT
  CHECK (renewal_offer IS NULL OR renewal_offer IN ('monthly', 'annual'));
UPDATE stripe_subscriptions SET renewal_offer = offer;
