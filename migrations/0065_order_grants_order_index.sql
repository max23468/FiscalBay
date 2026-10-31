-- La cancellazione di un ordine, dalla pulizia della conservazione o da un'erasure, elimina a
-- cascata i suoi sblocchi: senza un indice che inizi da `order_id` ogni ordine cancellato
-- scorreva tutta la tabella degli sblocchi.
CREATE INDEX order_grants_order_idx ON order_grants(order_id);
