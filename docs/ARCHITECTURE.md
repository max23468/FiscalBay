# Architettura

Panoramica rapida dell'architettura corrente del progetto.

## Indice rapido

- scopo del progetto
- moduli principali
- flussi principali
- decisioni architetturali attuali
- limiti da tenere presenti
- contratti runtime correnti

Documenti collegati:

- `docs/INDEX.md`
- `docs/CONTEXT.md`
- `docs/DATA_MODEL.md`

## Scopo

Il progetto ha oggi due facce:

- CLI locale per interrogazioni manuali sugli ordini
- bot Telegram con comandi e notifiche automatiche

Entrambe condividono lo stesso package Python interno `src/fiscalbay/`.

Vincolo di prodotto:

- il baricentro resta Telegram
- l'uso supportato resta la chat privata col bot
- la parte web serve solo a supportare il flusso OAuth e non deve diventare il centro del prodotto
- il progetto resta un tool verticale su ordini e dati fiscali eBay, non un gestionale generalista
- lato UX il bot non espone scelta di account o environment: ogni utente opera sul proprio collegamento già definito

## Moduli principali

### Entry point

- `src/fiscalbay/cli.py`
  - esegue il flusso CLI
- `src/fiscalbay/bot.py`
  - collega configurazione, runtime e servizi; non contiene logica di dominio
- `src/fiscalbay/bot_dispatch.py`
  - esegue il dispatch e delega ai moduli `bot_admin`, `bot_orders`,
    `bot_account` e `bot_settings`
- `src/fiscalbay/oauth_server.py`
  - gestisce soltanto il protocollo HTTP del callback server OAuth
- `src/fiscalbay/application.py`
  - risolve il contesto tenant e coordina il fetch condiviso da CLI e bot

### Config e modelli

- `src/fiscalbay/config.py`
  - carica configurazione ambiente
- `src/fiscalbay/models.py`
  - definisce configurazione, opzioni fetch, stato runtime e record ordine
- `src/fiscalbay/errors.py`
  - gerarchia errori applicativi
- `src/fiscalbay/retry.py`
  - retry/backoff condiviso
- `src/fiscalbay/application.py`
  - coordina il fetch di record eBay a partire dall'ambiente applicativo

### Client esterni

- `src/fiscalbay/clients/ebay.py`
  - OAuth eBay, `getOrders`, `getOrder`
- `src/fiscalbay/clients/telegram.py`
  - Telegram Bot API, long polling, deleteWebhook

### Servizi applicativi

- `src/fiscalbay/services/orders.py`
  - fetch e normalizzazione ordini
- `src/fiscalbay/services/notifications.py`
  - stato bot, retry queue, deduplica, auto-notify
- `src/fiscalbay/services/telegram_runtime.py`
  - polling updates, callback, shutdown lifecycle
- `src/fiscalbay/telegram_commands.py`
  - parsing comandi, menu e callback
- `src/fiscalbay/telegram_{common,admin,orders,account,settings}.py`
  - presentazione Telegram divisa per dominio
- `src/fiscalbay/oauth_rendering.py`, `src/fiscalbay/oauth_callback.py`
  - rendering web e callback OAuth applicativo

### Persistenza

- `src/fiscalbay/storage/`
  - connessione/schema, runtime, utenti/account, OAuth, notifiche, code/audit e retention/export

### Operatività

- `src/fiscalbay/healthcheck.py`
  - controlli runtime e soglie alert minime
- `deploy/`
  - setup VPS, update, smoke check, backup, restore e timer di alert check
  - service `systemd` per bot e callback server OAuth

## Flussi principali

### Flusso CLI

1. `cli.py` legge argomenti e configurazione.
2. `application.py` costruisce le opzioni e richiama il fetch ambientato.
3. `services/orders.py` risolve finestra temporale e opzioni.
4. `clients/ebay.py` ottiene access token e richiama le API eBay.
5. il risultato viene renderizzato in table, JSON o CSV.

### Flusso bot Telegram

1. `bot.py` carica configurazione e acquisisce il lock di processo.
2. `clients/telegram.py` forza `deleteWebhook` e prepara il long polling.
3. `services/telegram_runtime.py` legge gli update da Telegram.
4. `bot.py` inoltra a `bot_dispatch.py`, che delega al modulo di dominio.
5. se serve, `application.py` coordina il fetch ordini per l'ambiente corretto.
6. il modulo `telegram_*` del dominio formatta la risposta.
7. `clients/telegram.py` invia i messaggi.

### Flusso notifiche automatiche

1. `services/notifications.py` legge lo stato runtime da SQLite.
2. calcola la finestra temporale da controllare.
3. usa `application.py` per ottenere ordini già normalizzati per ambiente.
4. deduplica per `orderId` e fingerprint.
5. invia notifiche Telegram solo per ordini con identificativo fiscale presente.
6. salva metriche, `last_check`, errori e retry queue.

## Decisioni architetturali attuali

- il progetto è tenant-aware sul piano applicativo, pur restando piccolo e controllato
- lo storage attuale è SQLite locale
- il deploy reale è su VPS Linux con `systemd`
- il modello amministrativo attuale prevede un solo admin globale
- l'uso supportato lato Telegram è la chat privata, non gruppi o supergruppi
- il prodotto conserva una minima memoria operativa leggibile, ma non uno storico completo degli ordini
- il runtime è separato per dispatch, domini bot, presentazione Telegram e notifiche
- i client esterni usano retry condiviso invece di logiche duplicate
- stato runtime e retry queue hanno modelli tipizzati dedicati
- servizi, rendering e wiring del bot condividono direttamente `OrderRecord`,
  `BotRuntimeState` e `RetryQueueEntry`, senza conversioni compatibili intermedie
- `telegram_commands.py` contiene parsing e menu; `bot_dispatch.py` è l'unico
  dispatcher e `process_message` gli inoltra soltanto gli argomenti
- i log runtime, client HTTP, notifiche e healthcheck usano eventi strutturati; `cycle_id` correla polling, callback, messaggi e cicli di notifica
- l'osservabilità minima passa da `/stato`, `fiscalbay-healthcheck` e dal timer `fiscalbay-alertcheck`, che segnala servizio fermo, backlog retry e troppi errori consecutivi
- i metadati release/deploy sono raccolti da `release_info.py` e riusati sia
  dall'healthcheck sia dai pannelli admin Telegram, evitando logiche Git duplicate
- lo storage espone funzioni tipizzate per dominio, senza wrapper o API riservate ai test

## Architettura tenant corrente

- il tenant applicativo coincide con `telegram_user_id`; `telegram_chat_id` serve al routing
- è supportato un account eBay attivo per utente e ambiente
- il bot usa credenziali tenant cifrate; con admin configurato non ripiega su credenziali condivise
- SQLite contiene utenti, chat, account/token eBay, sessioni OAuth, subscription, stato runtime, code, audit e snapshot
- il worker di reconciliation processa la coda, riallinea accessi e subscription, scade sessioni OAuth e applica retention
- l'admin globale approva o blocca gli utenti e usa viste sintetiche materializzate dalla reconciliation
- la parte web resta limitata a rendering informativo, avvio OAuth, callback e protocollo HTTP

### Confini dei moduli

- bot: `bot_dispatch.py` instrada; `bot_admin.py`, `bot_orders.py`, `bot_account.py` e `bot_settings.py` contengono la logica di dominio; `bot.py` conserva solo wiring e avvio
- presentazione Telegram: `telegram_common.py`, `telegram_admin.py`, `telegram_orders.py`, `telegram_account.py` e `telegram_settings.py`; `telegram_commands.py` conserva parsing, menu e callback
- storage: `connection.py` e `schema.py` per core; `runtime.py`, `users.py`, `oauth.py`, `notifications.py`, `queues.py` e `retention.py` per dominio
- OAuth web: `oauth_rendering.py` per HTML, `oauth_callback.py` per flusso applicativo e `oauth_server.py` per HTTP
- servizi: `services/account.py`, `services/orders.py`, `services/notifications.py`,
  `services/tenant_status.py`, `services/user_access.py` e `services/telegram_runtime.py`;
  i coordinatori compongono storage di dominio indipendenti

Le API interne sono funzioni semplici per dominio. Non esistono repository wrapper,
facade di storage, alias di comandi storici o migrazioni JSON residue.

## Decisioni consolidate del refactor (ex ADR)

Le decisioni architetturali principali del refactor, prima tracciate in `docs/adr/`, sono ora consolidate in questa sezione.

### DR-001 - Modularizzare runtime Telegram e parsing comandi

- **Stato:** accettata
- **Contesto:** il vecchio `bot.py` accentrava polling, parsing, rendering, notifiche e stato runtime, rendendo difficile test e manutenzione.
- **Decisione:** separare lifecycle, dispatch, logica bot e presentazione per
  dominio; `bot.py` mantiene soltanto wiring e avvio.
- **Conseguenze:** responsabilità più chiare, test più mirati e minore accoppiamento tra UI Telegram e logica runtime.

Authz, linking OAuth e process lock sono in moduli dedicati (`bot_authz.py`,
`bot_oauth.py`, `bot_process_lock.py`); esiste un solo router dei comandi.

I guardrail soft per dimensione moduli/funzioni e per nuove estrazioni sono
tracciati in `docs/TECHNICAL_GUARDRAILS.md`.

### DR-002 - Introdurre modelli tipizzati per stato runtime

- **Stato:** accettata
- **Contesto:** stato bot e retry queue erano modellati soprattutto come `dict`, con campi impliciti e controlli sparsi.
- **Decisione:** usare in `models.py` i modelli `OrderRecord`, `BotMetrics`,
  `BotRuntimeState` e `RetryQueueEntry`, con conversione ai soli bordi I/O.
- **Conseguenze:** contratti interni più espliciti, conversioni concentrate e minore dipendenza da payload raw di persistenza.

### DR-003 - Centralizzare retry e classificazione errori

- **Stato:** accettata
- **Contesto:** retry HTTP e classificazione errori erano distribuiti tra runtime, client e operatività, con logica duplicata.
- **Decisione:** centralizzare la policy in `retry.py` e la gerarchia errori
  applicativa in `errors.py`, con un solo nome canonico per ogni API interna.
- **Conseguenze:** backoff coerente tra eBay/Telegram/runtime, log più uniformi e errori meglio distinguibili.

## Decisione database per il servizio attuale

- breve termine: mantenere SQLite per progettazione e consolidamento tenant-aware
- vincolo: repository e servizi devono evitare SQL o shape troppo specifici di SQLite
- soglia di cambio: prima della multiutenza pubblica o di più tenant reali simultanei, migrazione prevista verso Postgres
- motivazione: SQLite va bene per il bot privato e per prototipazione locale, ma non è il target finale per concorrenza, operatività e gestione token sensibili a scala maggiore

## Vincoli operativi per il servizio attuale

- refresh token eBay sempre cifrato a riposo
- access token trattato come dato volatile o cache breve, non come configurazione globale
- gestione esplicita di revoca, refresh e scadenza per ogni account utente
- rate limiting minimo per utente prima dell'onboarding self-service
- audit log minimo per `connect`, `disconnect`, refresh fallito e revoca account
- credenziali, persistence e observability trattate come componenti di prodotto
- VPS attuale considerata sufficiente solo finché resta piccolo il numero di tenant approvati e non emerge traffico più intenso o bursty

## Limiti da tenere presenti

- le credenziali eBay sono ancora globali
- i comandi tenant-aware usano già stato e scoping per tenant, ma il fetch ordini usa ancora credenziali globali finché non arriva l'OAuth per utente
- la risoluzione dell'account collegato e dell'environment è già tenant-aware, ma la sorgente delle credenziali resta ancora `.env` globale finché non saranno attivi token utente reali
- la multiutenza richiederà un modello dati nuovo e un nuovo flusso OAuth
- il callback web OAuth esiste in forma minimale, ma restano aperti hardening finale e revoca remota verso eBay
- il gating accessi oggi è pensato per un servizio pubblico controllato: le capability sono esplicite, ma non esistono ancora ruoli multipli oltre a `admin`, utente approvato, in attesa o bloccato
- la queue operativa è ancora minimale: oggi copre soprattutto access application e recovery, non un workflow completo di revoca remota eBay
- i caller usano soltanto i nomi canonici esposti dal proprio modulo di dominio

## Contratti runtime correnti

- gli entrypoint di packaging puntano direttamente a `src/fiscalbay/cli.py` e `src/fiscalbay/bot.py`
- il fetch condiviso restituisce `OrderRecord`; bot, renderer e notifiche non
  accettano payload `dict` alternativi
- il formato persistito in SQLite resta compatibile con il runbook operativo attuale
