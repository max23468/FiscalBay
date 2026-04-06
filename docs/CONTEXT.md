# Contesto Progetto

Questo documento serve come contesto persistente per nuove conversazioni con un'IA o con nuovi collaboratori tecnici.

## Indice rapido

- `docs/INDEX.md`
  - indice centrale della documentazione
- `docs/ARCHITECTURE.md`
  - struttura del codice e flussi principali
- `docs/OPERATIONS.md`
  - esercizio operativo, rollback e criteri di salute
- `docs/CHECKLIST.md`
  - lavoro ancora aperto

Obiettivo:

- evitare di dover rispiegare ogni volta cos'e' il progetto
- chiarire lo stato reale del codice, del bot e della VPS
- documentare il setup operativo attuale
- distinguere chiaramente tra stato corrente, convenzioni operative e lavori ancora aperti

Nota importante:

- questo file non deve contenere segreti
- non inserire token, password, refresh token o chiavi private
- puo' contenere host, path, utenti di servizio e workflow operativi, ma non credenziali sensibili

## Cos'e' il progetto

`eBay CF Tool` e' un progetto Python che legge gli ordini eBay tramite API ufficiali e mostra l'identificativo fiscale disponibile nei dati ordine, in particolare i casi in cui eBay restituisce `buyer.taxIdentifier` con tipo `CODICE_FISCALE`.

Il progetto oggi ha due modalita' principali:

- CLI locale per interrogazioni manuali
- bot Telegram con comandi e notifiche automatiche

Il progetto oggi e' ancora single-tenant:

- usa un solo account eBay configurato a livello globale
- invia notifiche Telegram alle chat autorizzate/configurate
- non e' ancora un servizio pubblico multiutente

## Scopo funzionale attuale

Il tool serve a:

- interrogare ordini eBay recenti o specifici
- recuperare il dettaglio ordine
- estrarre `buyer.taxIdentifier.taxpayerId`
- mostrare se il dato fiscale e' presente o assente
- notificare automaticamente via Telegram i nuovi ordini che contengono davvero il codice fiscale

Limite strutturale fondamentale:

- il progetto mostra solo cio' che eBay restituisce davvero
- se eBay non espone `buyer.taxIdentifier`, il tool non puo' dedurre il codice fiscale

## Componenti del repository

### Entry point

- `ebay-cf`
  - utility CLI
- `ebay-telegram-bot`
  - bot Telegram

Compatibilita' con i vecchi entrypoint:

- `src/ebay_cf_tool.py`
- `src/telegram_bot.py`

Questi restano come wrapper compatibili, ma la logica vera sta nel package interno.

Nota di stato:

- la rifondazione strutturale del codice e l'osservabilita' minima sono considerate chiuse
- i prossimi lavori aperti partono dalla progettazione multiutente

### Struttura codice corrente

Package principale:

- `src/ebay_cf/cli.py`
- `src/ebay_cf/bot.py`
- `src/ebay_cf/config.py`
- `src/ebay_cf/models.py`
- `src/ebay_cf/errors.py`
- `src/ebay_cf/logging_utils.py`
- `src/ebay_cf/healthcheck.py`
- `src/ebay_cf/git_utils.py`
- `src/ebay_cf/retry.py`
- `src/ebay_cf/telegram_commands.py`

Client esterni:

- `src/ebay_cf/clients/ebay.py`
- `src/ebay_cf/clients/telegram.py`

Service layer:

- `src/ebay_cf/services/orders.py`
- `src/ebay_cf/services/notifications.py`
- `src/ebay_cf/services/telegram_runtime.py`

Storage:

- `src/ebay_cf/storage/sqlite.py`

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

## Funzionamento del bot

### Flusso generale

1. carica configurazione ambiente
2. acquisisce lock file del processo
3. forza long polling Telegram
4. avvia thread di auto-notify ordini eBay
5. gestisce i comandi ricevuti in chat
6. salva stato locale in SQLite

### Comandi Telegram attuali

- `/start`
- `/help`
- `/ping`
- `/stato`
- `/account`
- `/connect`
- `/disconnect`
- `/notifications on|off`
- `/settings`
- `/ultimi`
- `/tutti`
- `/ordine`

Nota onboarding:

- `/account` mostra gia' il collegamento eBay noto per il tenant della chat
- `/connect` prepara gia' una sessione OAuth nel DB e puo' restituire un link pubblico se la VPS espone `EBAY_OAUTH_CONNECT_BASE_URL`
- `/disconnect` scollega gia' localmente account e token del tenant corrente dal DB sulla VPS
- `/notifications on|off` consente gia' alla singola chat di attivare o spegnere le notifiche personali
- `/settings` mostra gia' un riepilogo leggero delle preferenze utente/chat
- esiste ora anche un callback server minimale separato, che chiude il flusso `/connect` quando la VPS espone URL pubblici corretti e usa il `RuName` eBay corretto verso il developer portal
- i refresh token tenant usano ora cifratura Fernet a riposo con chiave da env sulla VPS
- restano ancora aperti hardening finale e revoca remota verso eBay

### Notifiche automatiche

Il bot:

- esegue polling ordini ogni `EBAY_ORDER_POLL_INTERVAL`
- confronta con lo stato gia' notificato
- invia notifiche solo se il record contiene davvero `CODICE_FISCALE` e `taxpayerId`
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

- ordini gia' notificati
- hash gia' notificati
- `last_check`
- `last_error`
- metriche minime
- retry queue Telegram

Compatibilita' legacy:

- se trova `data/notified_orders.json` o `data/failed_notifications.json`, il progetto oggi li migra automaticamente a SQLite
- conserva una copia backup durante la migrazione

## Qualita' e tooling

Il progetto oggi include:

- test automatici `unittest`
- `ruff`
- `mypy` graduale
- `coverage`
- GitHub Actions CI

Comando di verifica locale principale:

```bash
bash scripts/ci_verify.sh
```

## Stato architetturale attuale

### Miglioramenti gia' fatti

- package interno introdotto
- separazione piu' chiara tra config, clients, services e storage
- separazione tra parsing comandi, runtime Telegram e notifiche automatiche
- storage SQLite strutturato
- migrazioni storage introdotte
- retry queue resa piu' robusta
- retry/backoff centralizzato
- lock file del bot migliorato
- modelli tipizzati per stato runtime e ordine normalizzato
- test integrazione su bot, storage e fetch ordini
- logging piu' coerente
- healthcheck operativo disponibile
- CI e quality gate presenti
- percorso di refactor documentato nei documenti stabili e nelle ADR

### Limiti attuali ancora veri

- progetto ancora single-tenant
- credenziali eBay ancora globali
- niente onboarding self-service pubblico
- niente OAuth eBay per singolo utente Telegram
- parte multiutente ancora solo in progettazione

Aggiornamento di stato:

- e' iniziata la base tecnica della fase 3: SQLite e scheduler stanno ricevendo strutture tenant-aware, ma il comportamento operativo resta ancora single-tenant finche' non vengono popolati utenti/chat/account nel DB
- il bot ora puo' iniziare a popolare utenti e chat dal traffico Telegram reale, preparando la migrazione senza fermare il servizio su VPS
- i comandi del bot risolvono ora il tenant dai dati runtime Telegram e, quando trovano una mappatura nel DB, leggono stato e retry queue del tenant invece del solo stato globale
- anche il layer applicativo che sceglie l'environment eBay passa ora dal tenant e dall'account collegato quando il DB lo consente, pur mantenendo fallback sulle credenziali globali attuali
- la sorgente credenziali per il fetch non e' piu' una decisione sparsa nei caller: esiste ora una facciata unica che in futuro potra' preferire token per tenant senza cambiare ogni servizio
- esiste gia' anche un adapter storage-side per futuri token tenant, ma sul bot in VPS resta volutamente spento finche' non sara' disponibile la decifratura reale dei refresh token utente
- il comando `/stato` mostra ora esplicitamente se la chat sta lavorando in contesto tenant o ancora in fallback globale, rendendo osservabile il residuo single-tenant direttamente dal bot
- e' disponibile anche `/account`, che mostra lo stato del collegamento eBay registrato per il tenant della chat e rappresenta il primo comando davvero orientato all'onboarding fase 4

## Multiutenza futura

Direzione prevista, non ancora implementata:

- ogni utente Telegram collega il proprio account eBay
- ogni utente vede solo i propri ordini/notifiche
- token eBay per utente
- flusso Telegram -> web -> OAuth eBay
- probabile passaggio a datastore piu' adatto della semplice modalita' attuale

Questo passaggio va trattato come cambio di natura del progetto:

- da utility personale/privata
- a servizio con requisiti piu' seri di sicurezza, privacy, backup e osservabilita'

Finding audit che guidano questa fase:

- credenziali eBay ancora globali in `.env`
- stato runtime, metriche e retry queue ancora condivisi
- scoping operativo ancora troppo vicino alla chat invece che al tenant utente
- assenza di audit log per collegamento e scollegamento account
- assenza di rate limiting per utente

Questi finding sono la base esplicita delle scelte gia' fissate in `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md` e `docs/OAUTH_FLOW.md`.

## VPS attuale

### Host e accesso

Host attuale:

- `79.72.45.89`

Utente SSH operativo:

- `opc`

Metodo di accesso:

- `ssh opc@79.72.45.89`

Politica SSH attuale:

- login con chiave attivo
- `PasswordAuthentication no`
- `PermitRootLogin no`
- `PubkeyAuthentication yes`

Il warning SSH post-quantum che compariva in passato e' stato risolto:

- `sshd` ora pubblica anche un KEX ibrido compatibile
- una connessione SSH semplice non mostra piu' il warning relativo al server

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

- la RAM e' limitata
- il server e' sufficiente per la fase privata attuale
- va osservato bene prima di aumentare carico o complessita'

### Hardening attuale VPS

- firewall attivo
- servizio esposto di fatto: `ssh`
- `fail2ban` installato
- jail `sshd` attiva
- OpenSSH aggiornato al pacchetto piu' recente disponibile nei repository Oracle Linux

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
- `python3.11`

### Runtime applicativo sulla VPS

Path progetto:

- `/opt/ebay-cf`

Virtualenv attivo del progetto:

- `/opt/ebay-cf/.venv`

Runtime applicativo stabile:

- Python `3.11`

Python di sistema:

- Python `3.9.x`

Scelta operativa corretta:

- il progetto gira nel proprio `.venv` su Python `3.11`
- non affidarsi al Python di sistema per il runtime del bot

### Servizio bot sulla VPS

Servizio `systemd` attuale:

- `ebaycf-bot`

Comandi principali:

```bash
sudo systemctl status ebaycf-bot
sudo systemctl restart ebaycf-bot
sudo journalctl -u ebaycf-bot -f
```

Healthcheck:

```bash
"/opt/ebay-cf/.venv/bin/ebay-cf-healthcheck" --json
```

### Stato manutenzione VPS gia' eseguito

Gia' fatto:

- aggiornamento sistema
- aggiornamento OpenSSH
- hardening SSH
- installazione Python 3.11
- ricreazione virtualenv applicativo
- attivazione `fail2ban`
- installazione strumenti base operativi
- riavvio completo VPS dopo kernel update

### Backup e residui archiviati

Backup di manutenzione creato:

- `~/maintenance-backups/2026-04-06-vps-cleanup`
- `/home/opc/maintenance-backups/2026-04-06-legacy-install-home-opc/ebay-cf-legacy`

Lì sono stati archiviati:

- backup `.env`
- backup `state.db`
- backup unit file servizio
- vecchio `.venv` Python 3.9
- vecchi file `.env.save`
- vecchio `run-ebaycf-bot.sh`
- vecchi file JSON runtime legacy

Questo significa:

- il percorso operativo e' pulito
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

- `/opt/ebay-cf/.env`

Non devono essere riportate in questo file.

## Workflow operativo attuale

Quando viene fatta una modifica significativa:

1. modifica locale nel repository
2. verifica locale con test/tooling
3. commit e push su `main`
4. deploy sulla VPS
5. restart servizio bot se il runtime cambia
6. verifica finale con log/status/healthcheck

Convenzione importante:

- per modifiche solo documentali o checklist non serve riavviare il bot

## Piattaforma di deploy

Il bot non usa piattaforme di deploy web collegate al repository.

Situazione attuale:

- il progetto va trattato come servizio Python deployato su VPS Linux
- il deploy reale vive sulla VPS Linux
- il repository non ha piu' integrazioni di deploy automatico da considerare

## File operativi importanti

Documentazione:

- `docs/INDEX.md`
- `README.md`
- `docs/RUNBOOK.md`
- `docs/CHECKLIST.md`
- `docs/DEPLOY_LINUX.md`

Script deploy:

- `deploy/linux-setup.sh`
- `deploy/update.sh`
- `deploy/smoke-check.sh`
- `deploy/ebaycf-bot.service`

Verifica qualita':

- `scripts/ci_verify.sh`

## Priorita' aperte

Le cose principali ancora aperte non sono piu' il “mettere in piedi” il progetto, ma:

- backup automatici veri
- test di restore
- checklist di rollback
- osservabilita' runtime piu' ricca
- verifica CPU/NTP/time sync
- decisione su Docker Compose come opzione da tenere o no
- eventuale utente di servizio dedicato al posto di `opc`
- progettazione multiutente

## Refactor ancora aperto

Il refactor strutturale ha gia' assorbito la separazione principale dei moduli, ma restano aperti soprattutto:

- riduzione dei `dict` residui nel dominio ordini
- riduzione degli accoppiamenti residui tra entrypoint e servizi
- completamento dei modelli che serviranno anche per la futura multiutenza

## Cose che un'IA nuova deve sapere subito

- il progetto oggi funziona ed e' live
- il bot e' single-tenant, non multiutente
- il deploy vero e' su VPS Linux
- la VPS usa Oracle Linux 9.7
- l'accesso standard e' `ssh opc@79.72.45.89`
- SSH e' key-only, root login disabilitato
- il bot gira come `systemd` service `ebaycf-bot`
- il runtime corretto del progetto e' Python `3.11` nel `.venv`
- il bot usa SQLite locale in `data/state.db`
- la checklist da seguire per il lavoro residuo e' `docs/CHECKLIST.md`

## Come mantenere aggiornato questo file

Aggiornare questo documento quando cambia almeno uno di questi punti:

- struttura del codice
- modalita' di deploy
- host o utente della VPS
- policy di login SSH
- runtime Python
- servizio `systemd`
- strategia storage
- stato single-tenant vs multi-tenant
- workflow operativo o convenzioni di rilascio
