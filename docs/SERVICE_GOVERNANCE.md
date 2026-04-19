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

Il bot e' oggi da considerare:

- servizio pubblico raggiungibile su Telegram
- servizio `Telegram first`
- utilizzabile solo in chat private con il bot
- accesso operativo governato da un admin globale Telegram
- onboarding utente soggetto ad approvazione esplicita
- servizio ospitato su una singola VPS Linux
- un solo account eBay attivo per utente e per environment

Regole operative di base:

- solo l'admin puo' approvare o bloccare utenti
- il modello amministrativo corrente prevede un solo admin globale e nessun co-admin
- solo utenti `approved` o `admin` possono usare i comandi operativi e collegare un account eBay
- per gli utenti approvati le notifiche sono attive di default, salvo disattivazione esplicita
- lato UX l'utente opera sempre sul proprio account eBay gia' collegato, senza dover scegliere tra account o environment multipli
- il runtime del bot, quando `TELEGRAM_ADMIN_USER_ID` e' configurato, usa token tenant e non refresh token eBay globali condivisi per i tenant collegati
- il servizio e' `best effort` e non ha SLA formale
- il bot espone `/service_status` e `/policy` come comandi pubblici minimi di orientamento sul servizio
- l'admin puo' usare `/service_mode normal|maintenance|degraded` per sospendere nuovi collegamenti o limitare temporaneamente le sole azioni operative

## Perimetro del prodotto

Il prodotto e':

- un tool verticale su ordini e identificativi fiscali eBay
- un servizio `Telegram first`
- un bot pubblico con accesso approvato, piccolo e curato
- un servizio operativo focalizzato su consultazione, collegamento account e notifiche utili
- un tool con memoria operativa minima leggibile, ma non con storico completo del dominio

Il prodotto non e':

- una dashboard eBay generalista
- un gestionale ordini completo
- un CRM o una suite di analytics
- una piattaforma multi-team con ruoli complessi
- un prodotto web-first
- un bot pensato per gruppi o supergruppi Telegram

## Criteri di inclusione delle funzionalita'

Una funzionalita' nuova entra nel perimetro se migliora almeno uno di questi assi:

- flusso core `accesso -> collegamento -> lettura ordini -> notifica -> stato`
- controllo amministrativo del servizio pubblico con accesso approvato
- affidabilita', sicurezza o operativita' reale su VPS
- lifecycle dati, audit, retention o cancellazione gia' necessari al servizio

Una funzionalita' va invece evitata o messa in coda se:

- apre un dominio di prodotto nuovo non necessario allo scopo fiscale del tool
- sposta il baricentro del prodotto da Telegram verso una UI web piu' ampia
- richiede di supportare gruppi, supergruppi o modelli di amministrazione piu' complessi senza un bisogno diretto del flusso core
- aumenta molto complessita' operativa o di manutenzione senza migliorare il flusso core
- avvicina il progetto a un gestionale eBay generalista invece che a un tool operativo verticale

## Dati trattati

### Dati Telegram

Il servizio tratta e puo' conservare in `state.db`:

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

Il servizio tratta e puo' conservare:

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
- il percorso normale e' cifratura Fernet con `EBAY_TENANT_TOKEN_KEY`
- il fallback plaintext e' solo opt-in per dev o recovery controllato e non configurazione normale di produzione

### Dati ordine eBay

Il servizio puo' leggere da eBay:

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
- una minima memoria operativa leggibile per utente o tenant e' invece ammessa quando serve a spiegare stato collegamento, ultimo errore o ultimo esito utile

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

## Retention minima

Le retention sotto sono il riferimento operativo corrente.

### Anagrafica Telegram e mapping tenant

Comprende:

- `telegram_users`
- `telegram_chats`
- `notification_subscriptions`

Retention:

- tenere mentre l'utente e' attivo, approvato o in attesa
- utenti `blocked` o `rejected` possono essere mantenuti fino a `180 giorni` per audit minimo e prevenzione abusi

### Account eBay collegati

Comprende:

- `ebay_accounts`

Retention:

- tenere mentre il collegamento e' attivo o serve al recupero operativo
- record `disconnected` o `revoked` possono restare come metadato leggero fino a `180 giorni`, salvo richiesta di cancellazione

### Token eBay

Comprende:

- `ebay_tokens`

Retention:

- refresh token cifrato: tenere solo mentre l'account e' `linked` e il servizio e' attivo per quell'utente
- su `/disconnect` o revoca, il segreto viene eliminato subito dal payload locale
- eventuale metadato di stato del token puo' restare come traccia tecnica minima finche' necessario al recovery

### Sessioni OAuth

Comprende:

- `oauth_link_sessions`

Retention:

- sessioni `pending` vanno fatte decadere rapidamente
- sessioni `completed`, `failed`, `expired`, `cancelled` possono essere mantenute fino a `30 giorni`

### Audit log

Comprende:

- `audit_log`

Retention:

- `180 giorni` come baseline minima corrente
- oltre tale finestra, il log puo' essere potato in manutenzione amministrativa

### Log runtime

Comprende:

- `journalctl` per `ebaycf-bot`
- `ebaycf-oauth`
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
- tenere solo finche' utile a evitare duplicati, retry e diagnostica

## Policy di cancellazione utente

Stato attuale:

- cancellazione amministrativa assistita
- non ancora self-service da Telegram
- l'uscita utente dal servizio va trattata in modo distinto tra scollegamento account eBay e disattivazione dell'accesso al bot

Richiesta minima:

- l'utente puo' chiedere all'admin la rimozione del proprio accesso e dei dati locali associati

Obiettivo operativo:

- evasione entro `7 giorni`, salvo incidenti o verifiche tecniche necessarie

Rimozioni attese:

- token eBay locali
- account eBay collegato
- subscription notifiche
- mapping chat e tenant
- stato runtime tenant
- sessioni OAuth residue non piu' necessarie

Eccezioni minime:

- audit log gia' scritto puo' essere mantenuto fino alla sua retention per sicurezza e tracciabilita'
- log runtime di sistema restano soggetti alla retention del journal VPS

## Limiti del servizio

Limiti dichiarati oggi:

- servizio pubblico con accesso comunque approvato manualmente
- numero utenti da mantenere ancora basso, curato e controllato
- traffico atteso non bursty
- una sola VPS
- nessuna promessa di alta disponibilita'
- nessun supporto a carichi elevati o multiworker distribuiti

Limiti funzionali:

- un account eBay per utente e per environment
- onboarding e supporto ancora orientati a servizio pubblico controllato, non a larga scala
- revoca remota eBay e automatismi di data lifecycle ancora minimali

Soglia oltre cui rivalutare l'assetto:

- piu' di una manciata di tenant attivi contemporaneamente
- uso giornaliero intenso o picchi frequenti
- richiesta di SLA o affidabilita' superiore al best effort
- bisogno di retention automatica e cancellazione self-service

## Governance applicativa minima

Decisioni valide oggi:

- admin globale unico identificato da `TELEGRAM_ADMIN_USER_ID`
- approvazione esplicita prima dell'uso operativo del bot
- audit log minimo obbligatorio per eventi sensibili
- token tenant cifrati a riposo
- isolamento dati per utente/chat/account come default del runtime

## Documenti collegati

- `docs/SECURITY.md`
- `docs/OPERATIONS.md`
- `docs/RUNBOOK.md`
- `docs/DATA_MODEL.md`
