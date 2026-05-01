# Operatività

Guida operativa rapida per l'esercizio quotidiano del servizio.

Per i dettagli completi di deploy e recovery vedere anche `docs/RUNBOOK.md`.

VPS operativa FiscalBay:

- host SSH: `opc@79.72.45.89`
- hostname atteso: `fiscalbay-bot`
- non usare mai la VPS di altri progetti per operazioni FiscalBay
- prima di deploy, diagnostica o restart remoti, verificare che host e contesto
  SSH siano quelli FiscalBay
- accesso locale interattivo: `ssh opc@79.72.45.89`
- per comandi one-shot da Codex locale:

```bash
ssh -tt -o BatchMode=yes -o ConnectTimeout=10 opc@79.72.45.89 'hostname'
```

## Indice rapido

- check giornalieri minimi
- comandi rapidi
- sequenza standard dopo update
- sync locale dopo release GitHub
- percorso minimo pre-release
- rollback rapido
- backup operativi
- criteri minimi per considerare sano il servizio

Documenti collegati:

- `docs/INDEX.md`
- `docs/RUNBOOK.md`
- `docs/SECURITY.md`
- `docs/SERVICE_GOVERNANCE.md`

## Check giornalieri minimi

- verificare che `fiscalbay-bot` sia attivo
- verificare che l'healthcheck sia `ok`
- controllare se ci sono errori recenti in journal
- controllare che `last_check` non sia stale
- verificare che la retry queue non cresca in modo anomalo

## Comandi rapidi

Status servizio:

```bash
sudo systemctl status fiscalbay-bot
```

Log recenti:

```bash
sudo journalctl -u fiscalbay-bot -n 100 --no-pager
```

Log live:

```bash
sudo journalctl -u fiscalbay-bot -f
```

Restart:

```bash
sudo systemctl restart fiscalbay-bot
```

Health check:

```bash
./.venv/bin/fiscalbay-healthcheck
```

Health check JSON:

```bash
./.venv/bin/fiscalbay-healthcheck --json
```

Nota deploy storage:

- il `state.db` del bot in VPS può ricevere migrazioni schema per tabelle tenant-aware
- finché non vengono caricati tenant, account e subscription reali, restano compatibili i percorsi legacy previsti per CLI o istanze non ancora migrate
- prima di rilasci che toccano `src/fiscalbay/storage/sqlite.py`, mantenere come sempre un backup aggiornato di `data/state.db`
- il runtime può ora registrare utenti/chat Telegram nel DB durante il traffico normale del bot, quindi il backup di `state.db` copre anche questa nuova base tenant-aware
- quando il DB contiene già la mappatura chat/utente, il comando `/stato` legge stato e retry queue del tenant corretto; se la mappatura manca, il fallback resta globale

Metriche runtime leggibili:

- `orders_read`
- `orders_with_fiscal_identifier`
- `notifications_sent`
- `telegram_retries`
- `consecutive_error_cycles`
- `ebay_errors`
- `telegram_errors`

Queste sono esposte oggi in due posti operativi:

- comando Telegram `/stato`
- `./.venv/bin/fiscalbay-healthcheck --json`

Il comando admin `/admin` espone inoltre il set stabile di metriche prodotto
minime per governance quotidiana:

- ordini letti e quota con dato fiscale
- notifiche inviate e rapporto sulle righe fiscali
- tenant noti, token attivi e rapporto account collegati / utenti approvati

Il comando Telegram `/stato` espone anche:

- `Scope runtime`, per vedere se la chat sta usando contesto `tenant` o `global`
- `Sorgente credenziali`, per capire se il bot è ancora su `global_env` o se usa un futuro `tenant_store`
- `Fallback credenziali`, quando il tenant esiste ma il bot è ancora costretto a ripiegare sul percorso globale

Il comando Telegram `/account` espone invece:

- stato del collegamento eBay per il tenant della chat
- utente eBay associato
- environment collegato
- stato del token
- numero di chat e subscription attive viste dal bot per quel tenant

Il comando Telegram `/account collega`:

- crea una sessione preliminare in `oauth_link_sessions`
- restituisce un link pubblico solo se sulla VPS è configurata `EBAY_OAUTH_CONNECT_BASE_URL`
- senza questa variabile, il bot prepara comunque la sessione ma avvisa che il callback OAuth non è ancora raggiungibile
- il link pubblico punta al callback server `fiscalbay-oauth`, che a sua volta redirige verso eBay e gestisce il ritorno OAuth

Il comando Telegram `/account scollega`:

- scollega localmente l'account eBay del tenant corrente
- marca il token nel DB come `revoked` e pulisce refresh/access token dal `state.db`
- valuta la revoca OAuth remota come esito esplicito: per i refresh token OAuth
  eBay il percorso stabile documentato resta manuale dalle impostazioni account
  eBay, quindi il bot mostra `manual_required` e registra il prossimo passo
- mantiene sempre il fallback locale sicuro: anche se il consenso eBay resta da
  rimuovere manualmente, il token locale non resta usabile dal runtime FiscalBay

Il comando Telegram `/settings notifiche on|off`:

- abilita o disabilita le notifiche per la chat corrente
- aggiorna sia `notification_subscriptions` sia il flag `notifications_enabled` della chat tenant-aware
- quindi l'effetto resta coerente anche dopo riavvio del bot sulla VPS

Il comando Telegram `/settings`:

- mostra un riepilogo rapido di scope runtime, ambiente, stato notifiche della chat e stato del collegamento account
- è il punto di controllo più rapido lato utente prima di usare `/account collega`, `/account scollega` o `/account`

Il comando Telegram `/onboarding`:

- mostra all'utente il percorso selettivo coerente con lo stato corrente:
  invitato/nuovo, richiesta pending, approvato senza account, reconnect o
  operativo
- resta disponibile anche prima dell'approvazione, così l'utente capisce che il
  prossimo passo è `/request_access` e poi l'attesa dell'admin
- dopo l'approvazione guida verso `/account collega`, `/account` e
  `/ordini fiscali`

Il comando Telegram `/support`:

- mostra all'utente uno snapshot leggibile del proprio tenant con stato accesso,
  account eBay, token, ultimo sync, ordini recenti tracciati, retry, audit
  recente e azioni consigliate
- non espone refresh token, access token o segreti locali
- ha lo stesso obiettivo operativo del comando CLI
  `fiscalbay-support-snapshot <telegram_user_id> --state-path data/state.db`

Controllo accessi Telegram:

- `TELEGRAM_ALLOWED_CHAT_IDS` limita le chat ammesse; con `*` (o `all`) consente tutte le chat e lascia il filtro operativo al workflow di approvazione admin
- `TELEGRAM_ADMIN_USER_ID`, quando valorizzata, identifica l'admin globale del bot
- gli altri utenti vengono registrati nel DB con stati `new`, `pending`, `approved` o `blocked`
- il runtime normalizza anche alias legacy come `active` e `rejected`, così il controllo accessi resta coerente anche su record vecchi nel `state.db`
- gli utenti non approvati possono solo usare `/start`, `/help`, `/altre_azioni` e `/request_access`
- l'admin riceve una richiesta con pulsanti inline `Approva` e `Rifiuta`
- in alternativa l'admin può usare `/admin_users all|pending|unlinked|reconnect|inactive`, `/tenant_health`, `/admin`, `/admin scala`, `/admin sicurezza`, `/admin dormant [ore]`, `/admin invite [telegram_user_id]`, `/admin support <telegram_user_id>`, `/admin export <telegram_user_id>`, `/admin delete_tenant <telegram_user_id> confirm`, `/approve_user <telegram_user_id>`, `/reject_user <telegram_user_id>`, `/suspend_user <telegram_user_id>` e `/reactivate_user <telegram_user_id>`
- per scale readiness l'admin può usare `/admin scala`, che classifica il
  profilo in `within_policy`, `watch`, `migration_recommended` o
  `migration_required` senza eseguire migrazioni automatiche
- per controlli security operations l'admin può usare `/admin sicurezza`, che
  riassume permessi `.env`, stato `state.db`, inventario env, fallback plaintext,
  backup e restore drill senza mostrare valori segreti
- per supporto e diagnosi rapida l'admin può usare
  `/admin storico [telegram_user_id] [limit]`, che legge l'audit recente senza
  introdurre una dashboard web o un nuovo archivio persistente
- per supporto su un venditore specifico l'admin può usare
  `/admin support <telegram_user_id>`, che aggrega in un solo messaggio stato
  utente, account, token, ultimo sync, coda retry, audit recente e azioni
  consigliate
- per invitare un venditore selezionato l'admin può usare
  `/admin invite [telegram_user_id]`, che genera testo da inviare, stato target
  se già noto e prossimo passo admin; non approva automaticamente e non apre
  registrazione libera
- quando un utente usa `/settings dati export` o `/settings dati cancellazione`,
  l'admin riceve una notifica con i comandi operativi suggeriti; la richiesta non
  modifica o cancella dati finché l'admin non esegue export/delete
- il gating passa ora da capability esplicite: `request_access`, `review_access`, `connect_account`, `manage_notifications`, `view_account`, `view_orders`
- solo gli utenti `approved` o l'`admin` ricevono le capability operative che sbloccano `/account collega`, `/account`, `/settings`, `/settings notifiche` e i comandi ordini
- approvare o bloccare un utente riallinea anche chat e subscription già registrate, quindi l'effetto non dipende solo dal prossimo restart o dal prossimo messaggio
- ripetere `/approve_user` o `/reject_user` sullo stesso stato non genera una nuova transizione né una nuova notifica utente, ma riallinea comunque i permessi applicati
- ripetere `/account collega` mentre esiste già una sessione OAuth pendente e valida riusa la sessione esistente invece di crearne una nuova
- i comandi sensibili lato utente hanno ora un rate limit minimo; `/request_access` e `/account collega` applicano anche cooldown dedicati su richieste ravvicinate e failure OAuth ripetuti
- il bot espone `/stato servizio` come messaggio pubblico minimo di funzionamento e `/settings policy` come riferimento sintetico alla governance del servizio
- il venditore può usare `/ordini export [giorni] [max]` per generare un export CSV inline degli ordini del periodo, con stato del dato fiscale e campi mancanti
- l'admin può passare il bot in `/service_mode normal|maintenance|degraded`: la manutenzione sospende nuovi collegamenti, il degrado lascia consultazione disponibile ma blocca azioni operative
- il loop di notifica invia anche un riepilogo admin periodico quando trova pending o alert prodotto rilevanti
- il `state.db` contiene ora anche una `operation_queue` minima per applicazioni sensibili differibili o recuperabili

Audit log minimo:

- il `state.db` contiene ora anche una tabella append-only `audit_log`
- eventi tracciati: `request_access`, `approve`, `reject`, `connect`, `disconnect`, `oauth_success`, `oauth_failure`, `data_request`, `tenant_export`, `tenant_delete`, `retention_prune`
- l'audit log integra i messaggi utente e i log runtime, non li sostituisce
- l'audit recente è consultabile da Telegram con `/admin storico`, anche
  filtrando per tenant

Servizio OAuth su VPS:

- entrypoint: `fiscalbay-oauth-server`
- servizio `systemd`: `fiscalbay-oauth`
- endpoint locali minimi: `/`, `/healthz`, `/oauth/start`, `/oauth/callback`, `/privacy`, `/about`, `/favicon.svg`, `/favicon.png`, `/favicon.ico`, `/apple-touch-icon.png`
- nginx deve inoltrare al servizio OAuth anche `/`, `/privacy`, `/about` e gli asset favicon; la configurazione di riferimento è `deploy/nginx-fiscalbay-oauth.conf`
- variabili utili: `EBAY_OAUTH_RUNAME`, `EBAY_OAUTH_RUNAME_SANDBOX`, `EBAY_OAUTH_CONNECT_BASE_URL`, `EBAY_OAUTH_CALLBACK_URL`, `EBAY_OAUTH_SERVER_HOST`, `EBAY_OAUTH_SERVER_PORT`, `EBAY_TENANT_TOKEN_KEY`
- il percorso corretto su VPS è usare `EBAY_TENANT_TOKEN_KEY` per cifrare i refresh token utente a riposo
- con `TELEGRAM_ADMIN_USER_ID` configurato, il bot in produzione usa i token tenant come percorso operativo normale e non deve più dipendere da `EBAY_REFRESH_TOKEN` per i tenant collegati
- verso eBay il parametro `redirect_uri` deve essere il `RuName` registrato nel portale eBay, non l'URL di callback pubblico
- l'URL di callback pubblico del progetto deve invece coincidere con l'`Accept URL` associato a quel `RuName`
- `EBAY_ENABLE_PLAINTEXT_TENANT_TOKENS=1` va considerato solo fallback di dev o recovery controllato e non configurazione operativa normale

Readiness multiutente nel healthcheck:

- il report healthcheck espone anche contatori `multi_tenant.*` per utenti, chat, account collegati, token attivi, subscription e stati runtime tenant
- il flag `multi_tenant.tenant_credentials_ready` indica se il DB ha già account collegati e token attivi sufficienti per operare interamente con credenziali tenant
- questo aiuta a capire sulla VPS quanto siamo vicini al multiutente reale senza interrogare SQLite manualmente
- il report healthcheck espone ora anche `tenant_snapshots.*`, alimentato dalla reconciliation, per stato operativo sintetico tenant senza ricalcoli live
- il report healthcheck espone ora anche `operation_queue.pending`, `operation_queue.running`, `operation_queue.failed`, `operation_queue.completed` e `operation_queue.cancelled`
- il report healthcheck espone anche `retention.*`, inclusi ultimo pruning, audit arretrati, sessioni OAuth arretrate e `operation_queue` terminale arretrata
- il report healthcheck espone anche `resources.*` per disco, inode e memoria disponibile della VPS
- il report healthcheck espone anche `public_service.*`: modello pubblico
  approvato, ruolo web, hosting onboarding, soglie utenti/account/token e stato
  della raccomandazione di migrazione oltre SQLite
- il report healthcheck espone anche `release.*`: versione package installata,
  sorgente versione, branch, commit breve, tag corrente, ultimo tag, distanza
  dall'ultimo tag e stato release (`tagged_clean`, `package_release`, `dirty`,
  `ahead_of_latest_tag` o `unknown`)
- `/admin` e `/admin manutenzione` riprendono gli stessi metadati release in
  formato compatto, così il confronto tra codice deployato, tag Git e versione
  installata non richiede accesso SSH o query manuali

Security operations check:

- entrypoint CLI: `fiscalbay-security-check`
- comando Telegram admin: `/admin sicurezza`
- controlla permessi `.env` attesi a `600` e `state.db` atteso a `600` o `660`
- verifica presenza delle env operative richieste senza stampare valori segreti
- segnala `EBAY_ENABLE_PLAINTEXT_TENANT_TOKENS=1` come alert operativo
- segnala `TELEGRAM_ALLOWED_CHAT_IDS=*` senza `TELEGRAM_ADMIN_USER_ID` come
  configurazione rischiosa
- controlla ultimo backup manutentivo e ultimo restore drill come warning se
  mancanti o stali

Scale readiness check:

- entrypoint CLI: `fiscalbay-scale-check`
- comando Telegram admin: `/admin scala`
- usa l'healthcheck esistente come sorgente dati e resta read-only
- trigger principali: utenti approvati, account collegati, token attivi,
  dimensione `state.db`
- livelli: `within_policy`, `watch`, `migration_recommended`,
  `migration_required`
- segnali di contesto: operation queue, snapshot tenant stale, cicli errore e
  warning pubblici healthcheck
- il report include un piano Postgres pronto da seguire quando serve, ma non
  cambia configurazione runtime e non sposta dati

Alert basilari runtime:

- `deploy/alert-check.sh` esegue `fiscalbay-healthcheck` con soglie operative minime
- `fiscalbay-alertcheck.timer` lancia il controllo ogni 5 minuti
- gli alert minimi oggi coprono servizio `systemd` non attivo, troppi errori consecutivi, retry queue oltre soglia, disco, inode, memoria disponibile e superamento soglie del servizio pubblico
- soglie di default: `MAX_CONSECUTIVE_ERROR_CYCLES=3`, `MAX_RETRY_QUEUE_SIZE=20`, `MAX_DISK_USED_PERCENT=85`, `MAX_INODE_USED_PERCENT=85`, `MIN_MEMORY_AVAILABLE_MB=128`
- soglie prodotto di default: `FISCALBAY_PUBLIC_MAX_APPROVED_USERS=25`, `FISCALBAY_PUBLIC_MAX_LINKED_ACCOUNTS=25`, `FISCALBAY_PUBLIC_MAX_ACTIVE_TOKEN_SETS=25`, `FISCALBAY_SQLITE_MAX_DB_BYTES=52428800`
- il fallimento del check finisce nel journal del service `fiscalbay-alertcheck`
- lo smoke check di deploy avvia anche `fiscalbay-alertcheck.service` quando il timer è abilitato, così un errore di permessi o runtime blocca il deploy

Policy servizio pubblico:

- FiscalBay resta `Telegram first`
- la parte web resta onboarding/callback/supporto e non sostituisce il bot
- onboarding e callback restano sulla VPS attuale finché il profilo resta piccolo
  e approvato
- le notifiche vengono attivate di default quando un utente diventa approvato,
  salvo opt-out utente o intervento admin
- i comandi sensibili hanno cooldown per utente configurabili con
  `FISCALBAY_RATE_LIMIT_*`: richiesta accesso, collegamento/scollegamento account,
  uscita dal bot, cambio modalità servizio e mutazioni admin non idempotenti
- prima di superare le soglie `FISCALBAY_PUBLIC_*`, sospendere l'allargamento e
  preparare database più robusto, sizing VPS e processo admin più formale

Healthcheck esterno e TLS:

- `deploy/external-healthcheck.sh` controlla l'URL pubblico HTTPS del callback, di norma `/healthz`
- se `FISCALBAY_PUBLIC_HEALTH_URL` non è configurata, prova a derivarla da `EBAY_OAUTH_CALLBACK_URL`
- il controllo fallisce se il certificato TLS scade entro `TLS_MIN_DAYS_VALID` giorni
- `fiscalbay-external-healthcheck.timer` esegue il controllo ogni 15 minuti
- lo smoke deploy avvia anche `fiscalbay-external-healthcheck.service` se il timer è abilitato

Recovery e log:

- `deploy/backup.sh` salva anche unit `systemd`, configurazione `nginx` FiscalBay, env operativi leggibili in `/etc/fiscalbay` e inventario servizio
- `deploy/restore-drill.sh` verifica periodicamente un restore separato in `data/restore-check/`
- `deploy/log-maintenance.sh` applica vacuum del journal e pulizia dei log nginx FiscalBay già ruotati
- i timer `fiscalbay-restore-drill.timer` e `fiscalbay-log-maintenance.timer` vengono installati dal setup Linux

Reconciliation periodica:

- entrypoint: `fiscalbay-reconcile`
- wrapper VPS: `deploy/reconcile.sh`
- timer `systemd`: `fiscalbay-reconcile.timer`
- la reconciliation processa la `operation_queue`, riallinea accessi/chat/subscription, scade sessioni OAuth pendenti troppo vecchie, revoca token attivi rimasti su account non più collegati, ricostruisce gli snapshot sintetici tenant e applica pruning retention su audit/sessioni OAuth/operazioni terminali
- lo smoke check di deploy avvia anche `fiscalbay-reconcile.service` quando il timer è abilitato

Retention e cancellazione:

- la policy di riferimento è definita in `docs/SERVICE_GOVERNANCE.md`
- stato attuale: la cancellazione utente è amministrativa assistita; l'utente
  può avviare la richiesta da `/settings dati cancellazione`, ma l'esecuzione
  resta confermata dall'admin
- `/settings dati` mostra all'utente dati conservati, retention e azioni
  disponibili per export/cancellazione assistita
- default retention: `FISCALBAY_AUDIT_RETENTION_DAYS=180`, `FISCALBAY_OAUTH_SESSION_RETENTION_DAYS=30`, `FISCALBAY_OAUTH_PENDING_RETENTION_DAYS=7`, `FISCALBAY_OPERATION_QUEUE_RETENTION_DAYS=30`
- `fiscalbay-fiscal-export` genera un export fiscale venditore da CLI usando credenziali globali o tenant (`--telegram-user-id`)
- `fiscalbay-support-snapshot <telegram_user_id>` genera da CLI lo stesso
  riepilogo supporto disponibile via `/support` e `/admin support`
- `/admin export <telegram_user_id>` produce un export tenant senza refresh/access token in chiaro
- `/admin support <telegram_user_id>` produce un riepilogo diagnostico tenant
  senza refresh/access token in chiaro
- `/admin delete_tenant <telegram_user_id> confirm` elimina token locali, account, chat, subscription, runtime state, retry tenant, sessioni OAuth e operazioni pending del tenant
- l'audit log relativo alla cancellazione resta nel DB fino alla retention audit
- `/admin dormant [ore]` e `/admin_users inactive` sono review non distruttive dei tenant dormienti
- i token tenant vanno rimossi subito quando un account viene scollegato o revocato
- audit log e log runtime seguono retention distinte e non vanno confusi con lo stato operativo del bot

Suggerimento pratico sui log:

- seguire i log cercando `cycle_id=` per correlare polling, callback, messaggi e cicli di notifica
- gli eventi principali sono ormai standardizzati per start, stop, polling, retry HTTP, retry queue, notifiche ed healthcheck

## Sequenza standard dopo update

1. da Mac locale, eseguire `scripts/deploy_now.sh`
2. verificare che lo smoke check remoto completi senza errori
3. se lo smoke check fallisce, leggere i log e valutare rollback

Lo smoke check di deploy verifica bot, healthcheck, OAuth se abilitato, timer
operativi, alertcheck, reconciliation e assenza di unit FiscalBay fallite. Non
blocca il deploy per `last_check_missing` o `last_check_stale`: questi restano
visibili nel report healthcheck e nel timer alert, ma possono dipendere da
problemi temporanei di eBay esterni al deploy.

Questo è il percorso di deploy predefinito. GitHub Actions è ammesso solo per
controlli GitHub conservativi e Dependabot: deploy, diagnostica
e configurazione VPS si automatizzano con script locali/VPS via SSH sulla VPS
FiscalBay.

Deploy operativo standard:

```bash
scripts/deploy_now.sh
```

Release versionata esplicita:

```bash
scripts/release_now.sh
```

Fallback deploy via archivio locale:

```bash
scripts/local_deploy_vps.sh
```

Da shell aperta direttamente sulla VPS, `./deploy/update.sh` resta disponibile
come manutenzione operativa locale.

## Release esplicita

La release resta automatica solo quando viene lanciata esplicitamente dal
maintainer:

```bash
scripts/release_now.sh
```

Lo script:

- legge l'ultimo tag `v*`
- calcola il bump SemVer dai Conventional Commit
- aggiorna `CHANGELOG.md` e `pyproject.toml`
- crea commit `chore: release vX.Y.Z` e tag `vX.Y.Z`
- crea la GitHub Release con `gh` o API GitHub
- deploya `main` sulla VPS tramite `scripts/deploy_now.sh`

Per creare GitHub Release senza `gh` locale, esportare un token GitHub fuori dal
repository:

```bash
export GITHUB_TOKEN=ghp_...
```

Per il deploy remoto del repository privato, la VPS legge il token GitHub da
`/etc/fiscalbay/deploy.env`.

Guardrail automatici del nuovo flusso:

- solo i workflow GitHub Actions allowlist dichiarati in
  `scripts/check_github_workflows.sh`
- working tree pulito prima di deploy/release reali
- release ufficiale solo da `main`
- deploy solo sulla VPS con hostname `fiscalbay-bot`
- smoke check remoto obbligatorio nel deploy, incluso controllo dei oneshot
  periodici e delle unit FiscalBay fallite

## Sync locale dopo release GitHub

`scripts/release_now.sh` crea il commit di release localmente prima del push, quindi
il repository locale resta già allineato. Serve un sync manuale solo se una release
viene creata da un'altra postazione.

Regola operativa:

1. eseguire in locale `git pull --ff-only origin main`
2. verificare tag GitHub e versione pacchetto

Check rapido consigliato:

```bash
git pull --ff-only origin main
git describe --tags --abbrev=0
sed -n '1,40p' CHANGELOG.md
```

Se questo passaggio viene saltato, è normale leggere in locale un changelog o una versione ancora
precedenti anche se la release GitHub è già stata pubblicata.

## Percorso minimo pre-release

Finché non esiste uno staging dedicato persistente, il percorso minimo prima di considerare sano un rilascio è:

1. eseguire in locale `bash scripts/ci_verify.sh`
2. verificare gli entrypoint principali nel virtualenv
3. se il cambiamento tocca bot, deploy o storage, eseguire `./deploy/smoke-check.sh` dopo il deploy
4. osservare per alcuni minuti `journalctl -u fiscalbay-bot -f`

Questo non sostituisce uno staging vero, ma è la baseline operativa minima attuale.

## Rollback rapido

Se un deploy peggiora il servizio, seguire nell'ordine:

1. verificare `sudo systemctl status fiscalbay-bot`
2. raccogliere contesto con `sudo journalctl -u fiscalbay-bot -n 100 --no-pager`
3. eseguire `./.venv/bin/fiscalbay-healthcheck --json`
4. annotare la revisione corrente con `git rev-parse --short HEAD`
5. individuare una revisione precedente sana con `git log --oneline -n 5`
6. tornare alla revisione scelta
7. reinstallare il package nel virtualenv se necessario
8. riavviare il servizio
9. rieseguire `./deploy/smoke-check.sh`
10. se il problema coinvolge dati o configurazione, valutare restore di `.env` e `state.db` dai backup

Condizioni di stop:

- non fare restore dati se il problema è solo applicativo
- non riutilizzare i vecchi file JSON legacy salvo emergenza documentata

## Sintomi comuni e prima risposta

### Il processo non parte

- controllare `.env`
- controllare i log `journalctl`
- verificare che il virtualenv esista
- verificare che non ci sia un lock incoerente o una seconda istanza manuale

### Git bloccato da `index.lock`

- usare `fiscalbay-fix-git-lock` se vuoi solo rimuovere in sicurezza un lock stale
- usare `fiscalbay-git-safe -- <comando git>` per operazioni locali che vuoi rendere più robuste
- il wrapper aspetta un lock realmente attivo per pochi secondi e rimuove solo quelli stale

### Il processo è attivo ma non notifica

- controllare `last_check`
- controllare `last_error`
- controllare la retry queue
- verificare che `TELEGRAM_NOTIFY_CHAT_IDS` sia valorizzato
- verificare che eBay stia davvero restituendo `taxIdentifier`

### Healthcheck non `ok`

- leggere il dettaglio JSON
- verificare se il problema è `last_check` troppo vecchio
- verificare se la retry queue è bloccata
- verificare se il servizio è partito con il path corretto a `state.db`
- controllare anche le metriche aggregate nel report JSON per capire se il problema è lato eBay, lato Telegram o backlog retry
- se il controllo periodico fallisce, leggere `sudo journalctl -u fiscalbay-alertcheck -n 50 --no-pager`

## Backup operativi

Backup manuale:

```bash
./deploy/backup.sh
```

Verifica timer:

```bash
sudo systemctl status fiscalbay-backup.timer
sudo systemctl list-timers fiscalbay-backup.timer
```

Restore di prova:

```bash
./deploy/restore.sh /percorso/del/backup
```

Asset minimi da proteggere:

- `.env`
- `data/state.db`
- eventuali file `.legacy-json.bak`

## Criteri minimi per considerare sano il servizio

- `systemd` attivo
- healthcheck `ok`
- alert check periodico senza errori recenti
- `last_check` aggiornato
- retry queue non in crescita continua
- nessuna raffica di errori eBay o Telegram nei log recenti

## Evidenze operative correnti

Baseline operativa verificata al 2026-04-06:

- VPS Oracle Linux 9.7 con `systemd`
- servizio reale `fiscalbay-bot`
- runtime corretto in `/opt/fiscalbay/.venv`
- dati runtime in `/opt/fiscalbay/data`
- backup operativi in `/home/fiscalbay/maintenance-backups/`
