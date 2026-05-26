# Governance del Servizio

Regole minime di esercizio del bot come servizio pubblico con accesso approvato.

## Scopo

Questo documento fissa:

- perimetro del servizio
- dati trattati
- retention minima
- policy di cancellazione utente
- limiti operativi dichiarati

Il documento descrive il servizio reale oggi in esecuzione su VPS, non un assetto teorico futuro.

## Modello di servizio

Il bot è oggi da considerare:

- servizio pubblico raggiungibile su Telegram
- servizio `Telegram first`
- utilizzabile solo in chat private con il bot
- accesso operativo governato da un admin globale Telegram
- onboarding utente soggetto ad approvazione esplicita
- servizio ospitato su una singola VPS Linux
- un solo account eBay attivo per utente e per environment

Regole operative di base:

- solo l'admin può approvare o bloccare utenti
- il modello amministrativo corrente prevede un solo admin globale e nessun co-admin
- solo utenti `approved` o `admin` possono usare i comandi operativi e collegare un account eBay
- per gli utenti approvati le notifiche sono attive di default, salvo disattivazione esplicita
- lato UX l'utente opera sempre sul proprio account eBay già collegato, senza dover scegliere tra account o environment multipli
- il runtime del bot, quando `TELEGRAM_ADMIN_USER_ID` è configurato, usa token tenant e non refresh token eBay globali condivisi per i tenant collegati
- il servizio è `best effort` e non ha SLA formale
- il bot espone `/stato servizio` e `/settings policy` come comandi pubblici minimi di orientamento sul servizio
- l'admin può usare `/service_mode normal|maintenance|degraded` per sospendere nuovi collegamenti o limitare temporaneamente le sole azioni operative

## Contratto stabile 1.0.0

FiscalBay `1.0.0` dichiara stabile il modello `approved_public_small`.

Nel contratto stabile iniziale rientrano:

- bot Telegram pubblico con accesso approvato manualmente
- singolo admin globale configurato con `TELEGRAM_ADMIN_USER_ID`
- onboarding e reconnect eBay OAuth gestiti dalla VPS FiscalBay
- token tenant cifrati a riposo nel percorso operativo normale
- SQLite locale entro soglie dichiarate
- audit log, retention, operation queue, backup, restore drill e alert minimi
- metriche prodotto admin visibili in `/admin`
- UX utente centrata su collegamento account, stato, impostazioni e notifiche

Non rientrano nel contratto `1.0.0`:

- apertura pubblica libera senza approvazione
- ruoli admin multipli
- multi-account eBay per utente nello stesso environment
- dashboard web come entrypoint operativo primario
- SLA formale, alta disponibilità o multiworker distribuiti
- cancellazione utente self-service completa senza conferma admin

## Perimetro del prodotto

Il prodotto è:

- un tool verticale su ordini e identificativi fiscali eBay
- un servizio `Telegram first`
- un bot pubblico con accesso approvato, piccolo e curato
- un servizio operativo focalizzato su consultazione, collegamento account e notifiche utili
- un tool con memoria operativa minima leggibile, ma non con storico completo del dominio

Il prodotto non è:

- una dashboard eBay generalista
- un gestionale ordini completo
- un CRM o una suite di analytics
- una piattaforma multi-team con ruoli complessi
- un prodotto web-first
- un bot pensato per gruppi o supergruppi Telegram

## Criteri di inclusione delle funzionalità

Una funzionalità nuova entra nel perimetro se migliora almeno uno di questi assi:

- flusso core `accesso -> collegamento -> lettura ordini -> notifica -> stato`
- controllo amministrativo del servizio pubblico con accesso approvato
- affidabilità, sicurezza o operatività reale su VPS
- lifecycle dati, audit, retention o cancellazione già necessari al servizio

Una funzionalità va invece evitata o messa in coda se:

- apre un dominio di prodotto nuovo non necessario allo scopo fiscale del tool
- sposta il baricentro del prodotto da Telegram verso una UI web più ampia
- richiede di supportare gruppi, supergruppi o modelli di amministrazione più complessi senza un bisogno diretto del flusso core
- aumenta molto complessità operativa o di manutenzione senza migliorare il flusso core
- avvicina il progetto a un gestionale eBay generalista invece che a un tool operativo verticale

## Dati trattati

### Dati Telegram

Il servizio tratta e può conservare in `state.db`:

- `telegram_user_id`
- `telegram_chat_id`
- `username`
- `display_name`
- stato accesso utente: `new`, `pending`, `approved`, `blocked`, `admin`
- metadati minimi di chat e preferenze notifiche

Uso:

- identificazione tenant
- gating accessi
- notifiche e routing dei comandi

### Dati account eBay

Il servizio tratta e può conservare:

- `ebay_user_id`
- `environment`
- scope OAuth concessi
- timestamp di collegamento
- stato account: `linked`, `disconnected`, `revoked`

Uso:

- associare il tenant Telegram al relativo account eBay
- risolvere il contesto di fetch corretto

### Token OAuth eBay

Il servizio tratta:

- refresh token tenant cifrato a riposo
- eventuale access token locale di lavoro
- metadati stato/scadenza del token

Regole:

- il refresh token tenant va considerato dato altamente sensibile
- il percorso normale è cifratura Fernet con `EBAY_TENANT_TOKEN_KEY`
- il fallback plaintext è solo opt-in per dev o recovery controllato e non configurazione normale di produzione

### Dati ordine eBay

Il servizio può leggere da eBay:

- `orderId`
- data ordine
- username acquirente
- nome acquirente
- `taxpayerId`
- tipo identificativo fiscale
- paese di emissione
- riepilogo articoli
- totale
- indirizzo di spedizione

Regola importante:

- il bot non mantiene un archivio storico completo degli ordini nel database locale
- nel database locale conserva solo stato operativo minimo, ad esempio `notified_order_ids`, fingerprint/hash e metriche runtime
- i dettagli ordine sono quindi trattati soprattutto in memoria e in output utente, non come storico locale completo
- una minima memoria operativa leggibile per utente o tenant è invece ammessa quando serve a spiegare stato collegamento, ultimo errore o ultimo esito utile

### Dati operativi e di audit

Il servizio conserva anche:

- runtime state per tenant
- retry queue
- sessioni OAuth
- audit log append-only
- log runtime `systemd/journal`

L'audit log minimo oggi copre:

- `request_access`
- `approve`
- `reject`
- `connect`
- `disconnect`
- `oauth_success`
- `oauth_failure`
- `data_request`
- `tenant_export`
- `tenant_delete`
- `retention_prune`

L'admin può consultare uno storico operativo leggero con
`/admin storico [telegram_user_id] [limit]`; il comando legge l'audit esistente
e non introduce una dashboard web o uno storico prodotto completo.

## Retention minima

Le retention sotto sono il riferimento operativo corrente.

### Anagrafica Telegram e mapping tenant

Comprende:

- `telegram_users`
- `telegram_chats`
- `notification_subscriptions`

Retention:

- tenere mentre l'utente è attivo, approvato o in attesa
- utenti `blocked` o `rejected` possono essere mantenuti fino a `180 giorni` per audit minimo e prevenzione abusi

### Account eBay collegati

Comprende:

- `ebay_accounts`

Retention:

- tenere mentre il collegamento è attivo o serve al recupero operativo
- record `disconnected` o `revoked` possono restare come metadato leggero fino a `180 giorni`, salvo richiesta di cancellazione

### Token eBay

Comprende:

- `ebay_tokens`

Retention:

- refresh token cifrato: tenere solo mentre l'account è `linked` e il servizio è attivo per quell'utente
- su `/account scollega` o revoca, il segreto viene eliminato subito dal payload locale
- eventuale metadato di stato del token può restare come traccia tecnica minima finché necessario al recovery

### Sessioni OAuth

Comprende:

- `oauth_link_sessions`

Retention:

- sessioni `pending` vanno fatte decadere rapidamente
- sessioni `completed`, `failed`, `expired`, `cancelled` possono essere mantenute fino a `30 giorni`
- il worker `fiscalbay-reconcile` marca come `expired` le sessioni pending scadute e pota le sessioni concluse oltre retention
- le sessioni pending molto vecchie sono considerate residue e vengono potate con soglia dedicata

### Snapshot tenant

Comprende:

- `tenant_status_snapshots`

Retention:

- è una cache sintetica derivata dai dati tenant, ricostruita dalla reconciliation
- viene eliminata insieme al tenant su cancellazione amministrativa
- non contiene token in chiaro e non sostituisce audit log o dati sorgente

Uso operativo:

- admin dashboard, review tenant e healthcheck leggono questo snapshot quando disponibile
- lo snapshot riduce query ripetute su account, token, subscription, audit e runtime state

### Audit log

Comprende:

- `audit_log`

Retention:

- `180 giorni` come baseline minima corrente
- oltre tale finestra, il log viene potato automaticamente dalla reconciliation periodica
- la retention è configurabile con `FISCALBAY_AUDIT_RETENTION_DAYS`

### Operation queue

Comprende:

- `operation_queue`

Retention:

- operazioni `pending`, `running` e `failed` restano finché servono a recovery o review operativa
- operazioni `completed` e `cancelled` vengono potate automaticamente oltre `FISCALBAY_OPERATION_QUEUE_RETENTION_DAYS`, default `30 giorni`

### Log runtime

Comprende:

- `journalctl` per `fiscalbay-bot`
- `fiscalbay-oauth`
- timer e worker operativi

Retention:

- target operativo `30 giorni`, o inferiore se imposto dalla rotazione del journal sulla VPS

### Stato runtime e dati ordini operativi

Comprende:

- `tenant_runtime_state`
- retry queue
- `notified_order_ids`
- `notified_hashes`

Retention:

- rolling state operativo, non archivio storico
- tenere solo finché utile a evitare duplicati, retry e diagnostica

## Policy di cancellazione utente

Stato attuale:

- cancellazione amministrativa assistita, avviabile dall'utente da Telegram
- l'uscita utente dal servizio va trattata in modo distinto tra scollegamento account eBay e disattivazione dell'accesso al bot
- l'utente può usare `/settings dati` per leggere dati conservati e retention
- l'utente può usare `/settings dati export` o `/settings dati cancellazione`
  per notificare l'admin senza cancellazioni automatiche
- l'admin può usare `/admin export <telegram_user_id>` per produrre un export operativo senza segreti
- l'admin può usare `/admin delete_tenant <telegram_user_id> confirm` per eliminare i dati operativi locali del tenant

Richiesta minima:

- l'utente può chiedere all'admin la rimozione del proprio accesso e dei dati locali associati direttamente dal bot

Obiettivo operativo:

- evasione entro `7 giorni`, salvo incidenti o verifiche tecniche necessarie

Rimozioni attese:

- token eBay locali
- account eBay collegato
- subscription notifiche
- mapping chat e tenant
- stato runtime tenant
- sessioni OAuth residue non più necessarie

Eccezioni minime:

- audit log già scritto può essere mantenuto fino alla sua retention per sicurezza e tracciabilità
- log runtime di sistema restano soggetti alla retention del journal VPS

Tenant inattivi:

- un tenant approvato e operativo senza attività recente è considerato dormiente, non cancellato
- `/admin dormant [ore]` e `/admin_users inactive` sono viste di review: non disattivano, non scollegano e non cancellano dati
- qualsiasi cleanup o cancellazione resta una decisione admin esplicita con comando dedicato e audit

## Limiti del servizio

Limiti dichiarati oggi:

- servizio pubblico piccolo e curato con accesso comunque approvato manualmente
- prodotto `Telegram first`: la parte web resta supporto onboarding/callback e
  non diventa entrypoint operativo principale
- onboarding e callback restano sulla VPS FiscalBay attuale finché il servizio
  resta dentro le soglie pubbliche dichiarate
- numero utenti da mantenere basso, curato e controllato
- traffico atteso non bursty
- una sola VPS
- nessuna promessa di alta disponibilità
- nessun supporto a carichi elevati o multiworker distribuiti

Soglie operative configurabili:

- `FISCALBAY_PUBLIC_MAX_APPROVED_USERS=25`
- `FISCALBAY_PUBLIC_MAX_LINKED_ACCOUNTS=25`
- `FISCALBAY_PUBLIC_MAX_ACTIVE_TOKEN_SETS=25`
- `FISCALBAY_SQLITE_MAX_DB_BYTES=52428800`

Queste soglie non sono un obiettivo commerciale da raggiungere: sono il punto in
cui fermare l'allargamento, rivedere la VPS e preparare uno storage più robusto.
Il report `fiscalbay-healthcheck` espone `public_service.*` e segnala
`sqlite_migration_recommended` quando il servizio esce dal profilo previsto.
Il report `fiscalbay-scale-check` e il comando Telegram `/admin scala`
trasformano quelle soglie in una decisione operativa read-only:
`within_policy`, `watch`, `migration_recommended` o `migration_required`.

Limiti funzionali:

- un account eBay per utente e per environment
- onboarding e supporto ancora orientati a servizio pubblico controllato, non a larga scala
- revoca remota eBay e automatismi di data lifecycle ancora minimali

Soglia oltre cui rivalutare l'assetto:

- superamento di una soglia `FISCALBAY_PUBLIC_*`
- uso giornaliero intenso o picchi frequenti
- richiesta di SLA o affidabilità superiore al best effort
- bisogno di retention automatica e cancellazione self-service
- necessità di più processi bot, più VPS o concorrenza database sostenuta

SQLite resta accettabile solo dentro il profilo `approved_public_small`: pochi
tenant approvati, traffico non bursty, un solo processo principale e backup/restore
verificati. Prima di aprire davvero il numero di utenti approvati, il target
diventa Postgres o un database equivalente gestito in modo più robusto.
La migrazione effettiva richiede comunque una fase dedicata: freeze operativo,
backup verificato, import su copia offline, smoke check e rollback documentato.

## Governance applicativa minima

Decisioni valide oggi:

- admin globale unico identificato da `TELEGRAM_ADMIN_USER_ID`
- approvazione esplicita prima dell'uso operativo del bot
- audit log minimo obbligatorio per eventi sensibili
- rate limiting minimo per utente sui comandi sensibili, configurabile con
  `FISCALBAY_RATE_LIMIT_*`
- metriche prodotto minime visibili stabilmente in `/admin`: ordini letti,
  ordini con dato fiscale, notifiche inviate, tenant noti, token attivi e
  rapporto account collegati / utenti approvati
- token tenant cifrati a riposo
- isolamento dati per utente/chat/account come default del runtime

## Documenti collegati

- `docs/SECURITY_OPERATIONS.md`
- `docs/OPERATIONS.md`
- `docs/RUNBOOK.md`
- `docs/DATA_MODEL.md`
