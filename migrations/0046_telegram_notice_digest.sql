-- Le impronte del dato notificato registrate come testo dei valori, che iniziano con `[`,
-- conservano ancora i Codici Fiscali. Una valutazione all'epoca le rimette fra i candidati: il
-- prossimo turno le confronta con la forma cifrata, senza eventi se il dato non è cambiato, e
-- registra l'impronta al loro posto.
UPDATE telegram_order_notices SET evaluated_at = '1970-01-01T00:00:00.000Z'
WHERE fiscal_key LIKE '[%';
