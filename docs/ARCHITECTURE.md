# Architettura

Panoramica rapida dell'architettura corrente del progetto.

## Indice rapido

- scopo del progetto
- moduli principali
- flussi principali
- decisioni architetturali attuali
- limiti da tenere presenti
- compatibilità mantenuta durante il refactor

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
  - espone la facciata compatibile del bot e collega i servizi
- `src/fiscalbay/oauth_server.py`
  - espone il mini callback server OAuth per l'onboarding self-service
- `src/fiscalbay/application.py`
  - facciata applicativa condivisa per il fetch ordini usato da CLI e bot

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
  - parsing comandi e rendering risposte Telegram

### Persistenza

- `src/fiscalbay/storage/sqlite.py`
  - stato runtime, retry queue, migrazioni SQLite, repository tenant-aware e compatibilità legacy JSON

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
4. `telegram_commands.py` interpreta i comandi utente.
5. se serve, `application.py` coordina il fetch ordini per l'ambiente corretto.
6. `telegram_commands.py` formatta la risposta.
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
- i wrapper storici restano compatibili per non rompere entrypoint e test
- il refactor corrente ha separato parsing comandi, runtime Telegram e notifiche automatiche
- i client esterni usano retry condiviso invece di logiche duplicate
- stato runtime e retry queue hanno modelli tipizzati dedicati
- i servizi core del bot lavorano ormai su `OrderRecord`, `BotRuntimeState` e `RetryQueueEntry`; le conversioni legacy restano ai bordi
- anche il rendering CLI/Telegram usa principalmente `OrderRecord`; i wrapper compatibili di `bot.py` assorbono i payload legacy usati dai test storici
- le conversioni compatibili sono state accentrate in adattatori espliciti dentro `bot.py`, invece di essere duplicate tra wrapper diversi
- i log runtime, client HTTP, notifiche e healthcheck usano eventi strutturati; `cycle_id` correla polling, callback, messaggi e cicli di notifica
- l'osservabilità minima passa da `/stato`, `fiscalbay-healthcheck` e dal timer `fiscalbay-alertcheck`, che segnala servizio fermo, backlog retry e troppi errori consecutivi
- i metadati release/deploy sono raccolti da `release_info.py` e riusati sia
  dall'healthcheck sia dai pannelli admin Telegram, evitando logiche Git duplicate
- lo storage espone adattatori tipizzati mantenendo compatibilità con le API storiche più usate nei test

## Direzione multiutente fissata

- il passaggio multiutente verrà costruito come estensione del package corrente, non come secondo bot separato
- il passaggio multiutente viene trattato come cambio di natura del progetto: da utility personale a servizio con requisiti di privacy, sicurezza e affidabilità
- il tenant applicativo iniziale coincide con l'utente Telegram, identificato da `telegram_user_id`
- `telegram_chat_id` resta importante per routing notifiche e UX, ma non diventa da solo la chiave di isolamento del dominio
- il tenant applicativo resta l'utente Telegram, ma l'uso prodotto supportato oggi è solo la chat privata
- il vincolo operativo resta `1 account eBay attivo per utente per environment`
- il supporto a più account per utente viene rinviato a una fase successiva
- i token eBay dovranno uscire dalle env globali ed entrare in storage dedicato per utente
- la base dati può restare SQLite finché il servizio resta piccolo e controllato, ma il modello va progettato in modo portabile verso Postgres
- prima di un'apertura pubblica vera il target architetturale diventa Postgres, non SQLite

Finding di partenza:

- credenziali eBay globali in env
- stato runtime e retry queue condivisi
- scoping ancora troppo centrato sulla chat
- assenza di audit log per eventi sensibili di collegamento account

## Schema target minimo

Blocchi dati da introdurre nella prossima tranche:

- `telegram_users`
  - identità utente, stato, metadati base e timestamp di registrazione
- `telegram_chats`
  - mappatura tra utente, chat Telegram, ruolo della chat e stato abilitazione
- `ebay_accounts`
  - account eBay collegato, environment, stato collegamento e timestamp
- `ebay_tokens`
  - token per account con refresh token cifrato, scadenze e metadati di rotazione
- `notification_subscriptions`
  - preferenze notifiche per utente o chat
- `oauth_link_sessions`
  - stato temporaneo del flusso OAuth, `state` anti-CSRF, expiry e correlazione con utente/chat
- `tenant_runtime_state`
  - ultimo check, metriche e retry queue per tenant invece che globali

Stato implementativo corrente:

- le tabelle tenant-aware e i repository base possono convivere nello stesso `state.db` del bot attuale
- se non esistono tenant reali configurati, il runtime continua a usare il percorso single-tenant compatibile
- il loop notifiche può già iterare tenant attivi quando trova subscription e account collegati nel DB
- il runtime Telegram inizia a registrare utenti, chat e subscription dal traffico reale del bot, mantenendo compatibilità con il deploy VPS esistente
- i comandi del bot risolvono ora il tenant partendo dalla coppia `telegram_chat_id` + `telegram_user_id` quando disponibile, e leggono stato runtime e retry queue per tenant invece del solo stato globale
- il layer applicativo di fetch ordini risolve ora anche l'account eBay collegato per tenant e sceglie l'environment a partire dal DB quando esiste una mappatura valida
- la scelta della sorgente credenziali di fetch passa ora da una facciata applicativa unica: sul bot multiutente con admin configurato il runtime usa solo credenziali tenant, mentre il fallback `.env` resta confinato ai percorsi legacy di manutenzione o alle istanze adminless
- esiste ora anche un adapter dedicato per credenziali tenant in storage, attivo sul deploy VPS quando il refresh token tenant è decifrabile con `EBAY_TENANT_TOKEN_KEY`
- se una chat non è ancora mappata a un tenant nel DB della VPS, il bot non usa più credenziali eBay condivise e richiede invece il collegamento esplicito dell'account
- l'healthcheck operativo espone ora anche contatori di readiness multi-tenant, così la maturità del DB tenant-aware è osservabile direttamente sul server
- anche `/stato` espone ora lo scope runtime e la sorgente credenziali, così si vede subito se una chat sta usando `tenant_store`, `tenant_required` o un percorso legacy adminless
- `/account` fornisce ora una vista tenant-aware del collegamento eBay già presente nel DB, senza richiedere ancora il flusso OAuth completo
- `/account collega` crea ora una sessione preliminare in `oauth_link_sessions` e, se la VPS espone `EBAY_OAUTH_CONNECT_BASE_URL`, restituisce anche il link pubblico di ingresso al futuro callback server
- `/account scollega` scollega localmente l'account tenant dal `state.db`, marca
  il token come revocato, cancella il segreto dal runtime locale e rende
  esplicito l'esito della revoca consenso eBay (`manual_required` quando serve
  intervento utente su eBay)
- `/settings notifiche on|off` aggiorna ora in modo coerente sia `notification_subscriptions` sia `telegram_chats.notifications_enabled`
- `/settings` espone ora un riepilogo user-facing delle preferenze tenant/chat senza dover ispezionare direttamente il DB
- `oauth_server.py` espone ora `/oauth/start`, `/oauth/callback` e `/healthz`, valida `state`, usa il `RuName` eBay corretto per lo scambio OAuth e aggiorna account/token nel DB tenant-aware
- `tenant_credentials.py` usa ora Fernet con chiave `EBAY_TENANT_TOKEN_KEY` come percorso standard di cifratura a riposo dei refresh token tenant
- `TELEGRAM_ADMIN_USER_ID` può ora definire un admin globale: gli altri utenti restano discoverable, ma passano da uno stato `new` o `pending` e possono usare il bot solo dopo approvazione esplicita
- il workflow di approvazione è interno al bot: richiesta accesso, notifica admin, approvazione o rifiuto e sblocco successivo di `/account collega` e dei comandi tenant-aware
- gli eventi sensibili principali scrivono ora anche su un audit log append-only in SQLite, separato dai soli log runtime
- gli stati utente e di sessione OAuth passano ora da normalizzazione centrale nel dominio, così alias legacy come `active` e `rejected` non restano sparsi nel runtime
- il gating dei comandi non dipende più solo da controlli ad hoc `admin / approved`, ma da capability esplicite come `request_access`, `review_access`, `connect_account`, `manage_notifications` e `view_orders`
- l'approvazione accessi passa ora da un piccolo step applicativo esplicito: oltre al cambio di stato utente, il runtime riallinea chat e subscription già note per quel tenant
- `/account collega` riusa ora l'ultima sessione OAuth ancora pendente e valida per lo stesso tenant/environment, invece di accumulare nuove sessioni inutili a ogni invocazione ripetuta
- esiste ora anche una `operation_queue` minima in SQLite per le operazioni sensibili differibili, oggi usata soprattutto per applicare in modo robusto i cambi di accesso utente
- `tenant_status_snapshots` conserva lo stato sintetico più utile per tenant e sposta dashboard admin/healthcheck su letture economiche quando la reconciliation lo ha aggiornato
- `reconcile.py` fornisce un worker periodico one-shot che processa la queue, riallinea accessi/chat/subscription, scade sessioni OAuth stale, corregge token attivi rimasti su account non più collegati, ricostruisce snapshot tenant e applica retention su dati freddi

## Decisioni consolidate del refactor (ex ADR)

Le decisioni architetturali principali del refactor, prima tracciate in `docs/adr/`, sono ora consolidate in questa sezione.

### DR-001 - Modularizzare runtime Telegram e parsing comandi

- **Stato:** accettata
- **Contesto:** il vecchio `bot.py` accentrava polling, parsing, rendering, notifiche e stato runtime, rendendo difficile test e manutenzione.
- **Decisione:** separare responsabilità in `telegram_commands.py` (parsing/rendering), `services/telegram_runtime.py` (lifecycle/polling) e `services/notifications.py` (auto-notify/retry), mantenendo `bot.py` come facciata compatibile e wiring.
- **Conseguenze:** responsabilità più chiare, test più mirati e minore accoppiamento tra UI Telegram e logica runtime.

Aggiornamento fase 4: authz, linking OAuth, process lock e lista export compatibile sono stati estratti in moduli dedicati (`bot_authz.py`, `bot_oauth.py`, `bot_process_lock.py`, `bot_compat.py`), così `bot.py` resta soprattutto wiring e orchestrazione dei comandi.

I guardrail soft per dimensione moduli/funzioni e per nuove estrazioni sono
tracciati in `docs/TECHNICAL_GUARDRAILS.md`.

### DR-002 - Introdurre modelli tipizzati per stato runtime

- **Stato:** accettata
- **Contesto:** stato bot e retry queue erano modellati soprattutto come `dict`, con campi impliciti e controlli sparsi.
- **Decisione:** introdurre in `models.py` i modelli `OrderRecord`, `BotMetrics`, `BotRuntimeState` e `RetryQueueEntry`, con adattatori tipizzati in storage mantenendo compatibilità legacy dove necessario.
- **Conseguenze:** contratti interni più espliciti, conversioni concentrate e minore dipendenza da payload raw di persistenza.

### DR-003 - Centralizzare retry e classificazione errori

- **Stato:** accettata
- **Contesto:** retry HTTP e classificazione errori erano distribuiti tra runtime, client e operatività, con logica duplicata.
- **Decisione:** centralizzare la policy in `retry.py` e la gerarchia errori applicativa in `errors.py`, mantenendo alias compatibili nei client dove utile ai test/integrazioni.
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
- resta un layer di compatibilità nel bot per i test e i wrapper storici, anche se il dominio core è ormai tipizzato
- la multiutenza richiederà un modello dati nuovo e un nuovo flusso OAuth
- il callback web OAuth esiste in forma minimale, ma restano aperti hardening finale e revoca remota verso eBay
- il gating accessi oggi è pensato per un servizio pubblico controllato: le capability sono esplicite, ma non esistono ancora ruoli multipli oltre a `admin`, utente approvato, in attesa o bloccato
- la queue operativa è ancora minimale: oggi copre soprattutto access application e recovery, non un workflow completo di revoca remota eBay
- alcuni alias storici interni sono stati rimossi dai client eBay; i caller devono usare i nomi canonici del modulo

## Compatibilità mantenuta durante il refactor

- gli entrypoint di packaging puntano direttamente a `src/fiscalbay/cli.py` e `src/fiscalbay/bot.py`
- il formato persistito in SQLite resta compatibile con il runbook operativo attuale
