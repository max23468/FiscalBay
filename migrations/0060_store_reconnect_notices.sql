-- Email del negozio da ricollegare: l'istante dell'interruzione del consenso (rifiuto o revoca
-- di eBay, oppure scadenza nota) a cui è già andata l'email. Una nuova interruzione dello stesso
-- consenso, o di uno nuovo dopo il ricollegamento, ha un altro istante e riceve la sua email.
ALTER TABLE ebay_store_credentials ADD COLUMN reconnect_notice_at TEXT;
