# Architettura

Panoramica rapida dell'architettura corrente del progetto.

## Indice rapido

- scopo del progetto
- moduli principali
- flussi principali
- decisioni architetturali attuali
- limiti da tenere presenti
- compatibilita' mantenuta durante il refactor

Documenti collegati:

- `docs/INDEX.md`
- `docs/CONTEXT.md`
- `docs/DATA_MODEL.md`
- `docs/adr/`

## Scopo

Il progetto ha oggi due facce:

- CLI locale per interrogazioni manuali sugli ordini
- bot Telegram con comandi e notifiche automatiche

Entrambe condividono lo stesso package Python interno `src/ebay_cf/`.

## Moduli principali

### Entry point

- `src/ebay_cf/cli.py`
  - esegue il flusso CLI
- `src/ebay_cf/bot.py`
  - espone la facciata compatibile del bot e collega i servizi

### Config e modelli

- `src/ebay_cf/config.py`
  - carica configurazione ambiente
- `src/ebay_cf/models.py`
  - definisce configurazione, opzioni fetch, stato runtime e record ordine
- `src/ebay_cf/errors.py`
  - gerarchia errori applicativi
- `src/ebay_cf/retry.py`
  - retry/backoff condiviso

### Client esterni

- `src/ebay_cf/clients/ebay.py`
  - OAuth eBay, `getOrders`, `getOrder`
- `src/ebay_cf/clients/telegram.py`
  - Telegram Bot API, long polling, deleteWebhook

### Servizi applicativi

- `src/ebay_cf/services/orders.py`
  - fetch e normalizzazione ordini
- `src/ebay_cf/services/notifications.py`
  - stato bot, retry queue, deduplica, auto-notify
- `src/ebay_cf/services/telegram_runtime.py`
  - polling updates, callback, shutdown lifecycle
- `src/ebay_cf/telegram_commands.py`
  - parsing comandi e rendering risposte Telegram

### Persistenza

- `src/ebay_cf/storage/sqlite.py`
  - stato runtime, retry queue, migrazioni SQLite e compatibilita' legacy JSON

### Operativita'

- `src/ebay_cf/healthcheck.py`
  - controlli runtime
- `deploy/`
  - setup VPS, update, smoke check, backup e restore

## Flussi principali

### Flusso CLI

1. `cli.py` legge argomenti e configurazione.
2. `services/orders.py` risolve finestra temporale e opzioni.
3. `clients/ebay.py` ottiene access token e richiama le API eBay.
4. i dettagli ordine vengono normalizzati.
5. il risultato viene renderizzato in table, JSON o CSV.

### Flusso bot Telegram

1. `bot.py` carica configurazione e acquisisce il lock di processo.
2. `clients/telegram.py` forza `deleteWebhook` e prepara il long polling.
3. `services/telegram_runtime.py` legge gli update da Telegram.
4. `telegram_commands.py` interpreta i comandi utente.
5. se serve, `services/orders.py` interroga eBay.
6. `telegram_commands.py` formatta la risposta.
7. `clients/telegram.py` invia i messaggi.

### Flusso notifiche automatiche

1. `services/notifications.py` legge lo stato runtime da SQLite.
2. calcola la finestra temporale da controllare.
3. interroga eBay tramite `services/orders.py`.
4. deduplica per `orderId` e fingerprint.
5. invia notifiche Telegram solo per ordini con `CODICE_FISCALE`.
6. salva metriche, `last_check`, errori e retry queue.

## Decisioni architetturali attuali

- il progetto e' ancora single-tenant
- lo storage attuale e' SQLite locale
- il deploy reale e' su VPS Linux con `systemd`
- i wrapper storici restano compatibili per non rompere entrypoint e test
- il refactor corrente ha separato parsing comandi, runtime Telegram e notifiche automatiche
- i client esterni usano retry condiviso invece di logiche duplicate
- stato runtime e retry queue hanno modelli tipizzati dedicati
- lo storage espone adattatori tipizzati mantenendo compatibilita' con le API storiche piu' usate nei test

## Limiti da tenere presenti

- le credenziali eBay sono ancora globali
- il dominio ordini non e' ancora completamente tipizzato end-to-end
- la multiutenza richiedera' un modello dati nuovo e un nuovo flusso OAuth

## Compatibilita' mantenuta durante il refactor

- `src/ebay_cf_tool.py` e `src/telegram_bot.py` restano wrapper compatibili
- i nomi storici delle API interne piu' patchati nei test restano disponibili come alias
- il formato persistito in SQLite resta compatibile con il runbook operativo attuale
