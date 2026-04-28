# Operativita'

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

- il `state.db` del bot in VPS puo' ricevere migrazioni schema per tabelle tenant-aware
- finche' non vengono caricati tenant, account e subscription reali, restano compatibili i percorsi legacy previsti per CLI o istanze non ancora migrate
- prima di rilasci che toccano `src/fiscalbay/storage/sqlite.py`, mantenere come sempre un backup aggiornato di `data/state.db`
- il runtime puo' ora registrare utenti/chat Telegram nel DB durante il traffico normale del bot, quindi il backup di `state.db` copre anche questa nuova base tenant-aware
- quando il DB contiene gia' la mappatura chat/utente, il comando `/stato` legge stato e retry queue del tenant corretto; se la mappatura manca, il fallback resta globale

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

Il comando Telegram `/stato` espone anche:

- `Scope runtime`, per vedere se la chat sta usando contesto `tenant` o `global`
- `Sorgente credenziali`, per capire se il bot e' ancora su `global_env` o se usa un futuro `tenant_store`
- `Fallback credenziali`, quando il tenant esiste ma il bot e' ancora costretto a ripiegare sul percorso globale

Il comando Telegram `/account` espone invece:

- stato del collegamento eBay per il tenant della chat
- utente eBay associato
- environment collegato
- stato del token
- numero di chat e subscription attive viste dal bot per quel tenant

Il comando Telegram `/account collega`:

- crea una sessione preliminare in `oauth_link_sessions`
- restituisce un link pubblico solo se sulla VPS e' configurata `EBAY_OAUTH_CONNECT_BASE_URL`
- senza questa variabile, il bot prepara comunque la sessione ma avvisa che il callback OAuth non e' ancora raggiungibile
- il link pubblico punta al callback server `fiscalbay-oauth`, che a sua volta redirige verso eBay e gestisce il ritorno OAuth

Il comando Telegram `/account scollega`:

- scollega localmente l'account eBay del tenant corrente
- marca il token nel DB come `revoked` e pulisce refresh/access token dal `state.db`
- non esegue ancora una revoca remota lato eBay; quella resta parte del flusso OAuth completo di fase 4

Il comando Telegram `/settings notifiche on|off`:

- abilita o disabilita le notifiche per la chat corrente
- aggiorna sia `notification_subscriptions` sia il flag `notifications_enabled` della chat tenant-aware
- quindi l'effetto resta coerente anche dopo riavvio del bot sulla VPS

Il comando Telegram `/settings`:

- mostra un riepilogo rapido di scope runtime, ambiente, stato notifiche della chat e stato del collegamento account
- e' il punto di controllo piu' rapido lato utente prima di usare `/account collega`, `/account scollega` o `/account`

Controllo accessi Telegram:

- `TELEGRAM_ALLOWED_CHAT_IDS` limita le chat ammesse; con `*` (o `all`) consente tutte le chat e lascia il filtro operativo al workflow di approvazione admin
- `TELEGRAM_ADMIN_USER_ID`, quando valorizzata, identifica l'admin globale del bot
- gli altri utenti vengono registrati nel DB con stati `new`, `pending`, `approved` o `blocked`
- il runtime normalizza anche alias legacy come `active` e `rejected`, cosi' il controllo accessi resta coerente anche su record vecchi nel `state.db`
- gli utenti non approvati possono solo usare `/start`, `/help`, `/altre_azioni` e `/request_access`
- l'admin riceve una richiesta con pulsanti inline `Approva` e `Rifiuta`
- in alternativa l'admin puo' usare `/admin_users all|pending|unlinked|reconnect|inactive`, `/tenant_health`, `/admin`, `/approve_user <telegram_user_id>`, `/reject_user <telegram_user_id>`, `/suspend_user <telegram_user_id>` e `/reactivate_user <telegram_user_id>`
- il gating passa ora da capability esplicite: `request_access`, `review_access`, `connect_account`, `manage_notifications`, `view_account`, `view_orders`
- solo gli utenti `approved` o l'`admin` ricevono le capability operative che sbloccano `/account collega`, `/account`, `/settings`, `/settings notifiche` e i comandi ordini
- approvare o bloccare un utente riallinea anche chat e subscription gia' registrate, quindi l'effetto non dipende solo dal prossimo restart o dal prossimo messaggio
- ripetere `/approve_user` o `/reject_user` sullo stesso stato non genera una nuova transizione ne' una nuova notifica utente, ma riallinea comunque i permessi applicati
- ripetere `/account collega` mentre esiste gia' una sessione OAuth pendente e valida riusa la sessione esistente invece di crearne una nuova
- i comandi sensibili lato utente hanno ora un rate limit minimo; `/request_access` e `/account collega` applicano anche cooldown dedicati su richieste ravvicinate e failure OAuth ripetuti
- il bot espone `/stato servizio` come messaggio pubblico minimo di funzionamento e `/settings policy` come riferimento sintetico alla governance del servizio
- l'admin puo' passare il bot in `/service_mode normal|maintenance|degraded`: la manutenzione sospende nuovi collegamenti, il degrado lascia consultazione disponibile ma blocca azioni operative
- il loop di notifica invia anche un riepilogo admin periodico quando trova pending o alert prodotto rilevanti
- il `state.db` contiene ora anche una `operation_queue` minima per applicazioni sensibili differibili o recuperabili

Audit log minimo:

- il `state.db` contiene ora anche una tabella append-only `audit_log`
- eventi tracciati: `request_access`, `approve`, `reject`, `connect`, `disconnect`, `oauth_success`, `oauth_failure`
- l'audit log integra i messaggi utente e i log runtime, non li sostituisce

Servizio OAuth su VPS:

- entrypoint: `fiscalbay-oauth-server`
- servizio `systemd`: `fiscalbay-oauth`
- endpoint locali minimi: `/`, `/healthz`, `/oauth/start`, `/oauth/callback`, `/privacy`, `/about`, `/favicon.svg`, `/favicon.png`, `/favicon.ico`, `/apple-touch-icon.png`
- nginx deve inoltrare al servizio OAuth anche `/`, `/privacy`, `/about` e gli asset favicon; la configurazione di riferimento e' `deploy/nginx-fiscalbay-oauth.conf`
- variabili utili: `EBAY_OAUTH_RUNAME`, `EBAY_OAUTH_RUNAME_SANDBOX`, `EBAY_OAUTH_CONNECT_BASE_URL`, `EBAY_OAUTH_CALLBACK_URL`, `EBAY_OAUTH_SERVER_HOST`, `EBAY_OAUTH_SERVER_PORT`, `EBAY_TENANT_TOKEN_KEY`
- il percorso corretto su VPS e' usare `EBAY_TENANT_TOKEN_KEY` per cifrare i refresh token utente a riposo
- con `TELEGRAM_ADMIN_USER_ID` configurato, il bot in produzione usa i token tenant come percorso operativo normale e non deve piu' dipendere da `EBAY_REFRESH_TOKEN` per i tenant collegati
- verso eBay il parametro `redirect_uri` deve essere il `RuName` registrato nel portale eBay, non la callback URL pubblica
- la callback URL pubblica del progetto deve invece coincidere con l'`Accept URL` associato a quel `RuName`
- `EBAY_ENABLE_PLAINTEXT_TENANT_TOKENS=1` va considerato solo fallback di dev o recovery controllato e non configurazione operativa normale

Readiness multiutente nel healthcheck:

- il report healthcheck espone anche contatori `multi_tenant.*` per utenti, chat, account collegati, token attivi, subscription e stati runtime tenant
- il flag `multi_tenant.tenant_credentials_ready` indica se il DB ha gia' account collegati e token attivi sufficienti per operare interamente con credenziali tenant
- questo aiuta a capire sulla VPS quanto siamo vicini al multiutente reale senza interrogare SQLite manualmente
- il report healthcheck espone ora anche `operation_queue.pending`, `operation_queue.running` e `operation_queue.failed`

Alert basilari runtime:

- `deploy/alert-check.sh` esegue `fiscalbay-healthcheck` con soglie operative minime
- `fiscalbay-alertcheck.timer` lancia il controllo ogni 5 minuti
- gli alert minimi oggi coprono servizio `systemd` non attivo, troppi errori consecutivi e retry queue oltre soglia
- soglie di default: `MAX_CONSECUTIVE_ERROR_CYCLES=3` e `MAX_RETRY_QUEUE_SIZE=20`
- il fallimento del check finisce nel journal del service `fiscalbay-alertcheck`
- lo smoke check di deploy avvia anche `fiscalbay-alertcheck.service` quando il timer e' abilitato, cosi' un errore di permessi o runtime blocca il deploy

Reconciliation periodica:

- entrypoint: `fiscalbay-reconcile`
- wrapper VPS: `deploy/reconcile.sh`
- timer `systemd`: `fiscalbay-reconcile.timer`
- la reconciliation processa la `operation_queue`, riallinea accessi/chat/subscription, scade sessioni OAuth pendenti troppo vecchie e revoca token attivi rimasti su account non piu' collegati
- lo smoke check di deploy avvia anche `fiscalbay-reconcile.service` quando il timer e' abilitato

Retention e cancellazione:

- la policy di riferimento e' definita in `docs/SERVICE_GOVERNANCE.md`
- stato attuale: la cancellazione utente e' amministrativa, non self-service
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

Questo e' il percorso di deploy predefinito. GitHub Actions non e' un canale
operativo attivo per FiscalBay: deploy, diagnostica e configurazione VPS si
automatizzano con script locali/VPS via SSH sulla VPS FiscalBay.

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

- nessun workflow GitHub Actions versionato
- working tree pulito prima di deploy/release reali
- release ufficiale solo da `main`
- deploy solo sulla VPS con hostname `fiscalbay-bot`
- smoke check remoto obbligatorio nel deploy, incluso controllo dei oneshot
  periodici e delle unit FiscalBay fallite

## Sync locale dopo release GitHub

`scripts/release_now.sh` crea il commit di release localmente prima del push, quindi
il repository locale resta gia' allineato. Serve un sync manuale solo se una release
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

Se questo passaggio viene saltato, e' normale leggere in locale un changelog o una versione ancora
precedenti anche se la release GitHub e' gia' stata pubblicata.

## Percorso minimo pre-release

Finche' non esiste uno staging dedicato persistente, il percorso minimo prima di considerare sano un rilascio e':

1. eseguire in locale `bash scripts/ci_verify.sh`
2. verificare gli entrypoint principali nel virtualenv
3. se il cambiamento tocca bot, deploy o storage, eseguire `./deploy/smoke-check.sh` dopo il deploy
4. osservare per alcuni minuti `journalctl -u fiscalbay-bot -f`

Questo non sostituisce uno staging vero, ma e' la baseline operativa minima attuale.

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

- non fare restore dati se il problema e' solo applicativo
- non riutilizzare i vecchi file JSON legacy salvo emergenza documentata

## Sintomi comuni e prima risposta

### Il processo non parte

- controllare `.env`
- controllare i log `journalctl`
- verificare che il virtualenv esista
- verificare che non ci sia un lock incoerente o una seconda istanza manuale

### Git bloccato da `index.lock`

- usare `fiscalbay-fix-git-lock` se vuoi solo rimuovere in sicurezza un lock stale
- usare `fiscalbay-git-safe -- <comando git>` per operazioni locali che vuoi rendere piu' robuste
- il wrapper aspetta un lock realmente attivo per pochi secondi e rimuove solo quelli stale

### Il processo e' attivo ma non notifica

- controllare `last_check`
- controllare `last_error`
- controllare la retry queue
- verificare che `TELEGRAM_NOTIFY_CHAT_IDS` sia valorizzato
- verificare che eBay stia davvero restituendo `taxIdentifier`

### Healthcheck non `ok`

- leggere il dettaglio JSON
- verificare se il problema e' `last_check` troppo vecchio
- verificare se la retry queue e' bloccata
- verificare se il servizio e' partito con il path corretto a `state.db`
- controllare anche le metriche aggregate nel report JSON per capire se il problema e' lato eBay, lato Telegram o backlog retry
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
