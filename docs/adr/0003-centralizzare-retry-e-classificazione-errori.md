# ADR 0003 - Centralizzare retry e classificazione errori

## Stato

Accettata

## Contesto

Retry HTTP e classificazione errori erano distribuiti tra runtime, client e gestione operativa, con logica parzialmente duplicata.

Questo rendeva piu' difficile mantenere un comportamento coerente e leggere i log in caso di problemi.

## Decisione

Centralizzare il retry esponendo:

- `retry.py` per la policy condivisa di backoff
- `errors.py` per una gerarchia applicativa esplicita

I client mantengono alias compatibili per i nomi storici usati nei test e nei punti di integrazione interni.

## Conseguenze

- backoff coerente tra eBay, Telegram e runtime
- log di retry piu' uniformi
- errori di configurazione, input utente e servizi esterni piu' distinguibili
- resta utile ridurre in futuro anche le differenze residue nei payload e nelle metriche
