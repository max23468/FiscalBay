-- Istante in cui l'ordine entra negli elenchi: la prima lettura, oppure il pagamento di un
-- acquisto provvisorio. L'elenco aperto non mostra fra quelli già letti gli ordini arrivati
-- dopo e li segnala in cima. Un ordine letto prima di questa colonna vale come già presente.
ALTER TABLE orders ADD COLUMN listed_at TEXT;
