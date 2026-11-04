# Ordini, eBay e piattaforma

## Changelog

### Novità

#### Miglioramenti

- **Storico dopo il passaggio a Premium.** Gli ordini eliminati alla scadenza della finestra Free tornano quando attivi Premium e l'importazione arriva al loro periodo.
- **Indirizzo nell'export.** Se eBay non fornisce l'indirizzo di fatturazione, il file riporta quello di spedizione.

#### Correzioni

- **Lettura degli ordini.** La lettura si conclude anche quando molti ordini cambiano mentre FiscalBay li legge, e dopo una pausa recupera tutti gli ordini modificati nel frattempo.
- **Negozio da ricollegare.** Se eBay rifiuta più volte le credenziali, la pagina Negozi chiede di ricollegare il negozio.

### What's new

#### Improvements

- **History after upgrading to Premium.** Orders deleted when the Free window ended come back when you activate Premium and the import reaches their period.
- **Address in the export.** If eBay does not provide the billing address, the file shows the shipping address.

#### Fixes

- **Order reading.** Reading completes even when many orders change while FiscalBay reads them, and after a pause it recovers every order modified in the meantime.
- **Store to reconnect.** If eBay rejects the credentials several times, the Stores page asks you to reconnect the store.

### Altre modifiche

- Gli ordini si leggono per tratti di tempo da 200 ordini e Trading per finestre di trenta giorni concatenate; nessuna ricerca fiscale su Trading oltre i novanta giorni e l'immagine di un'inserzione si legge una volta.
- La sottoscrizione agli ordini di eBay si ricontrolla ogni settimana; i webhook di eBay, Stripe e Telegram hanno una coda propria e un messaggio perso si riprende dopo due ore.
- Le richieste HTTP non scrivono più nel registro delle attività; la CPU per invocazione è limitata a 30 secondi e l'ID Telegram dell'owner è un segreto.
- Le chiamate alla Bot API passano da un Worker separato con il token del bot, e le tracce del Worker principale sono accese.
- La pulizia degli ordini scaduti procede a blocchi e le chiavi anti-reimport si eliminano dopo due anni.
