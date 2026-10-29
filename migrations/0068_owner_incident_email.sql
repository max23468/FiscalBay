-- Copia email di un avviso che Telegram non consegna dopo tre tentativi (§31: Telegram primario,
-- email alternativa). `emailed` conserva l'ultimo avviso già copiato, come stato e gravità: ogni
-- avviso si copia una volta sola, anche se Telegram continua a non riuscire.
ALTER TABLE owner_incidents ADD COLUMN emailed TEXT;
