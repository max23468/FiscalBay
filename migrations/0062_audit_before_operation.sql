-- Conferma di un trasferimento assistito: identificativo casuale dell'esecuzione, scritto con
-- l'istante, dalla conferma che la ottiene. Le istruzioni dello stesso commit lo confrontano: così
-- una seconda conferma nello stesso istante non scrive nulla.
ALTER TABLE store_transfers ADD COLUMN execution_id TEXT;

-- Registro della console scritto prima dell'operazione: la riga nasce «in corso» con autore,
-- operazione, oggetto del modulo, motivo e istante, poi riceve una sola volta l'esito definitivo
-- e l'oggetto riletto. Ogni altra modifica resta rifiutata; la pulizia dopo un anno le elimina.
DROP TRIGGER admin_audit_is_immutable;
CREATE TRIGGER admin_audit_is_immutable BEFORE UPDATE ON admin_audit
WHEN NOT (OLD.outcome = 'in_progress' AND NEW.outcome <> 'in_progress'
  AND NEW.id IS OLD.id AND NEW.actor IS OLD.actor AND NEW.operation IS OLD.operation
  AND NEW.reason IS OLD.reason AND NEW.at IS OLD.at)
BEGIN
  SELECT RAISE(ABORT, 'immutable_audit');
END;
