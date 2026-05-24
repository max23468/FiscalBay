# Contesto Progetto

Questo documento serve come contesto persistente per nuove conversazioni con un'IA o con nuovi collaboratori tecnici.

## Indice rapido

- `docs/INDEX.md`
  - indice centrale della documentazione
- `docs/ARCHITECTURE.md`
  - struttura del codice e flussi principali
- `docs/OPERATIONS.md`
  - esercizio operativo, rollback e criteri di salute
- `docs/ROADMAP.md`
  - lavoro ancora aperto e ordine delle prossime fasi
- `docs/BACKLOG.md`
  - idee, debiti e attività condizionate non ancora promosse
- `docs/TOOLCHAIN.md`
  - runtime, comandi, tool esterni e guardrail di versione
- `docs/decisions/`
  - ADR leggere per nuove decisioni strutturali o migrazioni progressive

Obiettivo:

- evitare di dover rispiegare ogni volta cos'è il progetto
- chiarire lo stato reale del codice, del bot e della VPS
- documentare il setup operativo attuale
- distinguere chiaramente tra stato corrente, convenzioni operative e lavori ancora aperti

Nota importante:

- questo file non deve contenere segreti
- non inserire token, password, refresh token o chiavi private
- può contenere host, path, utenti di servizio e workflow operativi, ma non credenziali sensibili

## Cos'è il progetto

`FiscalBay` è un progetto Python che legge gli ordini eBay tramite API ufficiali e mostra l'identificativo fiscale disponibile nei dati ordine, in particolare i casi in cui eBay restituisce `buyer.taxIdentifier` con tipo e valore valorizzati.

Il progetto oggi ha due modalità principali:

- CLI locale per interrogazioni manuali
- bot Telegram con comandi e notifiche automatiche

Il progetto oggi è da considerare:

- servizio pubblico raggiungibile su Telegram
- utilizzabile solo in chat privata col bot
- accesso operativo governato da approvazione admin
- multiutente tenant-aware sul piano applicativo
- ospitato su una singola VPS Linux
- pensato per un solo account eBay già collegato per utente, senza scelte account/environment lato UX

## Scopo funzionale attuale

Il tool serve a:

- interrogare ordini eBay recenti o specifici
- recuperare il dettaglio ordine
- estrarre `buyer.taxIdentifier.taxpayerId`
- mostrare se il dato fiscale è presente o assente
- notificare automaticamente via Telegram i nuovi ordini che contengono davvero un identificativo fiscale
- mantenere una minima memoria operativa leggibile sullo stato del collegamento e sugli errori recenti utili

Limite strutturale fondamentale:

- il progetto mostra solo ciò che eBay restituisce davvero
- se eBay non espone `buyer.taxIdentifier`, il tool non può dedurre l'identificativo fiscale

## Perimetro da rispettare

Per evitare bloat, il progetto va trattato come:

- tool operativo verticale sugli ordini eBay e sui dati fiscali realmente restituiti
- servizio `Telegram first`
- bot pubblico con accesso approvato, ma volutamente piccolo e curato
- bot con un solo admin globale, almeno nell'assetto attuale

Non va trattato come:

- dashboard eBay generalista
- gestionale ordini completo
- suite analytics o reportistica ampia
- piattaforma web-first
- bot per gruppi o supergruppi Telegram

## Componenti del repository

### Entry point

- `fiscalbay`
  - utility CLI
- `fiscalbay-bot`
  - bot Telegram

Gli entrypoint `fiscalbay` e `fiscalbay-bot` puntano direttamente al package interno
(`src/fiscalbay/cli.py` e `src/fiscalbay/bot.py`).

Nota di stato:

- la rifondazione strutturale, l'osservabilità minima e la base multiutente sono considerate chiuse
- i prossimi lavori aperti sono descritti in `docs/ROADMAP.md`

### Struttura codice corrente

Package principale:

- `src/fiscalbay/cli.py`
- `src/fiscalbay/bot.py`
- `src/fiscalbay/config.py`
- `src/fiscalbay/models.py`
- `src/fiscalbay/errors.py`
- `src/fiscalbay/logging_utils.py`
- `src/fiscalbay/healthcheck.py`
- `src/fiscalbay/git_utils.py`
- `src/fiscalbay/retry.py`
- `src/fiscalbay/telegram_commands.py`

Client esterni:

- `src/fiscalbay/clients/ebay.py`
- `src/fiscalbay/clients/telegram.py`

Service layer:

- `src/fiscalbay/services/orders.py`
- `src/fiscalbay/services/notifications.py`
- `src/fiscalbay/services/telegram_runtime.py`

Storage:

- `src/fiscalbay/storage/sqlite.py`

### Ruolo delle componenti

`config.py`

- carica configurazione da environment
- centralizza i default principali

`models.py`

- modelli e tipi di configurazione/opzioni
- modelli tipizzati per stato bot, metriche, retry queue e ordine normalizzato

`clients/ebay.py`

- autenticazione eBay
- richieste API a `getOrders` e `getOrder`
- gestione retry per chiamate eBay

`clients/telegram.py`

- richieste Telegram Bot API
- long polling
- deleteWebhook e gestione base trasporto
- retry condiviso con policy centralizzata

`services/orders.py`

- orchestration del fetch ordini
- normalizzazione dei record restituiti

`services/notifications.py`

- stato runtime del bot
- retry queue Telegram
- deduplica ordini e invio notifiche automatiche

`services/telegram_runtime.py`

- polling Telegram
- callback query
- lifecycle runtime e shutdown

`bot.py`

- facciata compatibile del bot Telegram
- wiring tra runtime, notifiche, storage e comandi
- gestione lock processo

`telegram_commands.py`

- parsing comandi
- validazione input utente
- rendering menu e testi Telegram

`retry.py`

- retry/backoff condiviso tra client esterni e runtime

`storage/sqlite.py`

- persistenza dello stato del bot
- persistenza retry queue
- migrazione schema SQLite
- migrazione automatica da vecchi file JSON legacy a SQLite

`healthcheck.py`

- controllo rapido sullo stato runtime
- verifica lock, `last_check`, retry queue e ultimo errore

`git_utils.py`

- utility operative per sbloccare `index.lock` Git in modo sicuro
- wrapper per eseguire comandi Git locali con preflight automatico sul lock

## Funzionamento del bot

### Flusso generale

1. carica configurazione ambiente
2. acquisisce lock file del processo
3. forza long polling Telegram
4. avvia thread di auto-notify ordini eBay
5. gestisce i comandi ricevuti in chat
6. salva stato locale in SQLite

### Comandi Telegram attuali

`/help` espone solo la guida rapida e distingue il blocco admin quando lo usa
l'admin; il menu comandi Telegram resta limitato a `/stato`, `/account`,
`/ordini` e `/altre_azioni`. I dettagli operativi sono concentrati in
`/ordini`, `/settings`, `/altre_azioni` e `/admin help`.

- `/start`
- `/help`
- `/stato`
- `/account`
- `/altre_azioni`
- `/account collega`
- `/account reconnect`
- `/account scollega`
- `/request_access`
- `/settings`
- `/settings notifiche on|off`
- `/admin`
- `/admin help`
- `/ping` (diagnostica rapida admin)
- `/admin_users all|pending|unlinked|reconnect|inactive`
- `/ordini fiscali`
- `/ordini tutti`
- `/ordini cerca`

Nota onboarding:

- `/account` mostra già il collegamento eBay noto per il tenant della chat
- `/account collega` prepara già una sessione OAuth nel DB e può restituire un link pubblico se la VPS espone `EBAY_OAUTH_CONNECT_BASE_URL`
- `/account scollega` scollega localmente account e token del tenant corrente
  dal DB sulla VPS e guida l'utente alla revoca manuale del consenso nelle
  impostazioni eBay quando il refresh token OAuth non è revocabile dal servizio
- `/settings notifiche on|off` consente già alla singola chat di attivare o spegnere le notifiche personali
- `/settings` mostra già un riepilogo leggero delle preferenze utente/chat
- la tastiera inline sotto i messaggi è contestuale: menu generale su
  `/start`/`/help`, azioni account su `/account`, azioni ordini su `/ordini`,
  notifiche/preferenze su `/settings`, azioni secondarie su `/altre_azioni` e
  scorciatoie operative admin su `/admin`
- se `TELEGRAM_ADMIN_USER_ID` è configurata, gli utenti non admin entrano in stati `new/pending/approved/blocked` e possono sbloccare il bot solo dopo approvazione admin
- l'admin può gestire gli accessi con callback inline o con `/admin_users`, `/approve_user` e `/reject_user`
- il runtime normalizza ora centralmente gli stati workflow e applica capability esplicite per i comandi sensibili, invece di affidarsi a semplici check sparsi su stringhe di stato
- il workflow accessi non si ferma più al solo cambio di stato: approvazione e blocco riallineano anche le permission applicate su chat e subscription già esistenti
- il comando `/account collega` è ora idempotente rispetto alla sessione OAuth pendente: se la sessione valida esiste già, viene riusata
- una `operation_queue` minima in SQLite tiene le applicazioni differibili o recuperabili dei workflow sensibili, e la reconciliation periodica la processa sul server
- esiste ora anche un callback server minimale separato, che chiude il flusso `/account collega` quando la VPS espone URL pubblici corretti e usa il `RuName` eBay corretto verso il developer portal
- i passaggi sensibili di accesso e collegamento account lasciano ora anche un audit log minimo append-only nel `state.db`
- i refresh token tenant usano ora cifratura Fernet a riposo con chiave da env sulla VPS
- restano ancora aperti hardening finale e automazioni future attorno al consenso
  eBay, ma il disconnect locale ora espone un esito `manual_required` invece di
  nascondere la revoca come step indefinito

### Notifiche automatiche

Il bot:

- esegue polling ordini ogni `EBAY_ORDER_POLL_INTERVAL`
- confronta con lo stato già notificato
- invia notifiche solo se il record contiene davvero `taxIdentifierType` e `taxpayerId`
- usa sia `orderId` sia fingerprint hash per deduplicare meglio
- usa una retry queue per i messaggi Telegram falliti

Bootstrap iniziale:

- al primo avvio non invia lo storico
- salva lo stato e poi notifica solo i nuovi ordini successivi

### Stato locale

Default runtime:

- `data/state.db`
- `data/telegram_bot.lock`

Lo stato SQLite contiene:

- ordini già notificati
- hash già notificati
- `last_check`
- `last_error`
- metriche minime
- retry queue Telegram

Compatibilità legacy:

- se trova `data/notified_orders.json` o `data/failed_notifications.json`, il progetto oggi li migra automaticamente a SQLite
- conserva una copia backup durante la migrazione

## Qualità e tooling

Il progetto oggi include:

- test automatici `unittest`
- `ruff`
- `mypy` graduale
- `coverage`
- CI locale con `bash scripts/ci_verify.sh`

Comando di verifica locale principale:

```bash
bash scripts/ci_verify.sh
```

## Stato architetturale attuale

### Miglioramenti già fatti

- package interno introdotto
- separazione più chiara tra config, clients, services e storage
- separazione tra parsing comandi, runtime Telegram e notifiche automatiche
- storage SQLite strutturato
- migrazioni storage introdotte
- retry queue resa più robusta
- retry/backoff centralizzato
- lock file del bot migliorato
- modelli tipizzati per stato runtime e ordine normalizzato
- test integrazione su bot, storage e fetch ordini
- logging più coerente
- healthcheck operativo disponibile
- CI e quality gate locali presenti
- percorso di refactor documentato nei documenti stabili e nelle ADR

### Limiti attuali ancora veri per 1.0.0

- accesso approvato manualmente, non apertura libera
- cancellazione utente amministrativa assistita, con richiesta utente avviabile
  da `/settings dati`
- revoca consenso eBay classificata come manuale quando non è disponibile una
  revoca OAuth remota documentata; disconnect locale comunque sicuro
- SQLite accettato solo nel perimetro `approved_public_small`

Aggiornamento di stato:

- il bot usa ora utenti/chat/account/token tenant-aware come percorso operativo normale su VPS
- i comandi del bot risolvono il tenant dai dati runtime Telegram e leggono stato e retry queue del tenant invece del solo stato globale
- il layer applicativo che sceglie l'environment eBay passa dal tenant e dall'account collegato quando il DB lo consente
- la sorgente credenziali per il fetch non è più sparsa nei caller: il bot multiutente con admin configurato usa solo token tenant; il fallback `.env` resta confinato ai percorsi legacy adminless o CLI
- il comando `/stato` mostra esplicitamente se la chat sta lavorando in contesto tenant, se il token tenant è pronto o se manca ancora il collegamento
- è disponibile anche `/account`, che mostra lo stato del collegamento eBay
  registrato per il tenant della chat ed è parte del percorso onboarding stabile

## Multiutenza oltre il perimetro approved_public_small

Il servizio `1.0.0` supporta già tenant approvati e token per utente nel modello
piccolo e controllato.

Una multiutenza pubblica più ampia richiede invece:

- Postgres o database equivalente gestito
- revisione dedicata di concorrenza, backup e restore dati
- supporto operativo più formalizzato
- osservabilità più ricca
- eventuale gestione segreti più robusta

Questo passaggio va trattato come cambio di natura del progetto:

- da servizio piccolo con accesso approvato
- a servizio con requisiti più seri di sicurezza, privacy, backup e osservabilità

Finding che restano driver per il cambio di scala:

- SQLite locale come persistence principale
- singolo admin globale
- secret key tenant ancora gestita in `.env` su VPS
- alert prodotto non persistenti come storico dedicato
- cancellazione self-service completa senza conferma admin non ancora presente

Questi finding sono la base esplicita delle scelte già fissate in `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md` e `docs/OAUTH_FLOW.md`.

## VPS attuale

### Host e accesso

Host attuale:

- `79.72.45.89`
- hostname atteso: `fiscalbay-bot`
- contesto operativo esclusivo: FiscalBay; non usare la VPS di altri progetti
  per comandi, deploy o diagnostica FiscalBay

Utente SSH operativo:

- `opc`

Metodo di accesso:

- `ssh opc@79.72.45.89`
- da Codex locale, per comandi one-shot, usare TTY esplicita:
  `ssh -tt -o BatchMode=yes -o ConnectTimeout=10 opc@79.72.45.89 'hostname'`
- output atteso per la verifica preliminare: `fiscalbay-bot`

Politica SSH attuale:

- login con chiave attivo
- `PasswordAuthentication no`
- `PermitRootLogin no`
- `PubkeyAuthentication yes`

Il warning SSH post-quantum che compariva in passato è stato risolto:

- `sshd` ora pubblica anche un KEX ibrido compatibile
- una connessione SSH semplice non mostra più il warning relativo al server

### Caratteristiche VPS

Sistema operativo:

- Oracle Linux Server 9.7

Kernel attivo dopo aggiornamento:

- `6.12.0-200.74.27.1.el9uek.x86_64`

Risorse rilevate durante l'audit:

- disco root circa `30 GB`
- spazio libero circa `21-22 GB`
- RAM circa `503 MiB`
- swap circa `2.5 GiB`

Nota importante:

- la RAM è limitata
- il server è sufficiente per la fase privata attuale
- va osservato bene prima di aumentare carico o complessità

### Hardening attuale VPS

- firewall attivo
- servizio esposto di fatto: `ssh`
- `fail2ban` installato
- jail `sshd` attiva
- OpenSSH aggiornato al pacchetto più recente disponibile nei repository Oracle Linux

### Tool presenti sulla VPS

Presenti e utili:

- `git`
- `curl`
- `jq`
- `rsync`
- `tmux`
- `sqlite3`
- `htop`
- `fail2ban-client`
- `python3.13`

### Runtime applicativo sulla VPS

Path progetto:

- `/opt/fiscalbay`

Virtualenv attivo del progetto:

- `/opt/fiscalbay/.venv`

Runtime applicativo stabile:

- Python `3.13`

Python di sistema:

- Python `3.9.x`

Scelta operativa corretta:

- il progetto gira nel proprio `.venv` su Python `3.13`
- non affidarsi al Python di sistema per il runtime del bot
- gli upgrade del runtime Python vanno fatti in modo esplicito con
  `FISCALBAY_PYTHON_BIN` e, quando cambia la minor version del `.venv`,
  `FISCALBAY_RECREATE_VENV=1`

### Servizio bot sulla VPS

Servizio `systemd` attuale:

- `fiscalbay-bot`

Comandi principali:

```bash
sudo systemctl status fiscalbay-bot
sudo systemctl restart fiscalbay-bot
sudo journalctl -u fiscalbay-bot -f
```

Healthcheck:

```bash
"/opt/fiscalbay/.venv/bin/fiscalbay-healthcheck" --json
```

Il report include anche `release.*` con versione package, branch, commit breve,
tag corrente, ultimo tag e stato release. Gli stessi dati compaiono in forma
compatta su `/admin` e `/admin manutenzione`.

### Stato manutenzione VPS già eseguito

Già fatto:

- aggiornamento sistema
- aggiornamento OpenSSH
- hardening SSH
- installazione Python 3.11 e successiva migrazione controllata a Python 3.13
- ricreazione virtualenv applicativo
- attivazione `fail2ban`
- installazione strumenti base operativi
- riavvio completo VPS dopo kernel update

### Backup e residui archiviati

Backup di manutenzione creato:

- `~/maintenance-backups/2026-04-06-vps-cleanup`
- `/home/opc/maintenance-backups/2026-04-06-legacy-install-home-opc/fiscalbay-legacy`

Lì sono stati archiviati:

- backup `.env`
- backup `state.db`
- backup unit file servizio
- vecchio `.venv` Python 3.9
- vecchi file `.env.save`
- vecchio `run-fiscalbay-bot.sh`
- vecchi file JSON runtime legacy

Questo significa:

- il percorso operativo è pulito
- ma esiste ancora una rete di sicurezza se serve recuperare qualcosa

## Login methods rilevanti

### Login alla VPS

Metodo standard:

```bash
ssh opc@79.72.45.89
```

Assunzioni attuali:

- autenticazione a chiave
- niente password
- niente login root diretto

### Login applicativo

Il bot non usa login interattivi.

Dipende da:

- environment file locale sulla VPS
- token Telegram
- credenziali OAuth eBay tramite refresh token

Queste credenziali stanno in:

- `/opt/fiscalbay/.env`

Non devono essere riportate in questo file.

## Workflow operativo attuale

Quando viene fatta una modifica significativa:

1. modifica locale nel repository
2. verifica locale con test/tooling
3. commit e push su `main`
4. release versionata quando il cambio è osservabile
5. deploy sulla VPS
6. restart servizio bot se il runtime cambia
7. verifica finale con log/status/healthcheck

Convenzione importante:

- per modifiche solo documentali o checklist non serve riavviare il bot

## Piattaforma di deploy

Il bot non usa piattaforme di deploy web collegate al repository.

Situazione attuale:

- il progetto va trattato come servizio Python deployato su VPS Linux
- il deploy reale vive sulla VPS Linux
- il repository non ha più integrazioni GitHub Actions da considerare
- deploy, release, CI e diagnostica VPS sono attività manuali locali o via SSH
  sulla VPS FiscalBay

## File operativi importanti

Documentazione:

- `docs/INDEX.md`
- `README.md`
- `docs/RUNBOOK.md`
- `docs/ROADMAP.md`
- `docs/DEPLOY_LINUX.md`

Script deploy:

- `deploy/linux-setup.sh`
- `deploy/update.sh`
- `deploy/smoke-check.sh`
- `deploy/fiscalbay-bot.service`

Verifica qualità:

- `scripts/ci_verify.sh`

## Priorità dopo 1.0.0

La prima release stabile copre il servizio pubblico piccolo con accesso approvato.

Le cose principali ancora aperte non sono bloccanti per `1.0.0`, ma guidano
l'evoluzione successiva:

- Postgres o database gestito prima di un'apertura pubblica multiutente più
  ampia
- secret manager dedicato se il perimetro operativo cresce
- cancellazione utente completamente self-service da Telegram senza conferma admin
- ruoli admin multipli o delega operativa
- alert prodotto persistenti con storico dedicato
- eventuale automazione ulteriore della revoca consenso eBay se eBay esporrà un
  percorso OAuth moderno applicabile ai refresh token del progetto

## Cose che un'IA nuova deve sapere subito

- il progetto oggi funziona, è live ed è pronto per il perimetro stabile
  `approved_public_small`
- il bot è pubblico su Telegram ma con accesso approvato dall'admin
- il deploy vero è su VPS Linux
- la VPS usa Oracle Linux 9.7
- l'accesso standard è `ssh opc@79.72.45.89`
- SSH è key-only, root login disabilitato
- il bot gira come `systemd` service `fiscalbay-bot`
- il callback OAuth gira come `systemd` service `fiscalbay-oauth`
- la reconciliation periodica gira via `fiscalbay-reconcile.timer`
- `fiscalbay-alertcheck.timer` e `fiscalbay-reconcile.timer` vengono verificati
  dallo smoke deploy con avvio esplicito delle rispettive unit oneshot
- `fiscalbay-duckdns.timer` viene installato ma abilitato solo se esiste
  `/etc/fiscalbay/duckdns.env`
- il runtime corrente del progetto è Python `3.13` nel `.venv`; eventuali
  migrazioni runtime devono usare la procedura esplicita con
  `FISCALBAY_PYTHON_BIN` e ricreazione controllata del `.venv`
- il bot usa SQLite locale in `data/state.db`
- la roadmap da seguire per il lavoro residuo è `docs/ROADMAP.md`
- la readiness stabile è descritta in `docs/RELEASE_READINESS.md`

## Come mantenere aggiornato questo file

Aggiornare questo documento quando cambia almeno uno di questi punti:

- struttura del codice
- modalità di deploy
- host o utente della VPS
- policy di login SSH
- runtime Python
- servizio `systemd`
- strategia storage
- stato single-tenant vs multi-tenant
- workflow operativo o convenzioni di rilascio
