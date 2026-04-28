# Runbook Operativo

Questa guida standardizza l'esercizio del bot sulla VPS Linux attuale con `systemd`.

## Standard operativo scelto

- distribuzione verificata: Oracle Linux 9.7
- esecuzione principale: `systemd` nativo
- utente servizio in produzione: `fiscalbay`
- codice applicativo in produzione: `/opt/fiscalbay`
- Docker Compose: supporto locale o legacy, non standard di esercizio in produzione
- virtualenv: `${APP_DIR}/.venv`
- dati runtime: `${APP_DIR}/data`
- env file: `${APP_DIR}/.env`
- servizio: `fiscalbay-bot`
- callback OAuth: `fiscalbay-oauth`
- host operativo FiscalBay: `opc@79.72.45.89` (`fiscalbay-bot`)

Regola di sicurezza operativa:

- usare solo la VPS FiscalBay per deploy, diagnostica, sync file, restart e log
- non usare mai la VPS di altri progetti per operazioni FiscalBay
- se `hostname`, IP o contesto SSH non corrispondono a FiscalBay, fermarsi prima
  di eseguire comandi remoti

Accesso SSH locale:

```bash
ssh opc@79.72.45.89
```

Comando one-shot consigliato da Codex locale:

```bash
ssh -tt -o BatchMode=yes -o ConnectTimeout=10 opc@79.72.45.89 'hostname'
```

Il comando deve restituire `fiscalbay-bot`. Solo dopo questa verifica eseguire
deploy, diagnostica, restart o lettura log. Evitare di usare host o alias SSH non
riconducibili esplicitamente a FiscalBay.

## Primo setup su VPS Linux

Lo script di setup supporta in automatico:

- `apt-get`
- `dnf`
- `yum`
- `apk`

```bash
git clone https://github.com/max23468/FiscalBay.git fiscalbay
cd fiscalbay
chmod +x deploy/linux-setup.sh
APP_USER=fiscalbay APP_GROUP=fiscalbay ./deploy/linux-setup.sh
```

Poi:

```bash
nano "./.env"
sudo systemctl enable --now fiscalbay-bot
sudo systemctl enable --now fiscalbay-oauth
sudo systemctl status fiscalbay-bot
```

## Comandi operativi

Status:

```bash
sudo systemctl status fiscalbay-bot
sudo systemctl status fiscalbay-oauth
```

Restart:

```bash
sudo systemctl restart fiscalbay-bot
sudo systemctl restart fiscalbay-oauth
```

Stop:

```bash
sudo systemctl stop fiscalbay-bot
```

Log live:

```bash
sudo journalctl -u fiscalbay-bot -f
sudo journalctl -u fiscalbay-oauth -f
```

Per seguire un singolo ciclo operativo, filtrare o cercare `cycle_id=` nei log recenti.

Gli eventi principali sono standardizzati per:

- start e stop del bot
- polling Telegram
- callback e messaggi
- retry HTTP verso Telegram ed eBay
- retry queue e cicli notifica
- esecuzione healthcheck
- start, redirect e callback OAuth

Variabili aggiuntive per onboarding OAuth:

- `EBAY_OAUTH_RUNAME`
- `EBAY_OAUTH_RUNAME_SANDBOX`
- `EBAY_OAUTH_CONNECT_BASE_URL`
- `EBAY_OAUTH_CALLBACK_URL`
- `EBAY_OAUTH_SERVER_HOST`
- `EBAY_OAUTH_SERVER_PORT`
- `EBAY_TENANT_TOKEN_KEY`
- `EBAY_ENABLE_PLAINTEXT_TENANT_TOKENS`

Nota importante:

- il callback server puo' girare anche senza URL pubblico, ma in quel caso `/account collega` non restituisce un link usabile dall'utente
- l'URL pubblico consigliato e' un dominio HTTPS davanti a nginx, anche se la VPS resta raggiungibile via IP per SSH e deploy; vedi `docs/PUBLIC_ACCESS.md`
- il percorso operativo corretto e' configurare `EBAY_TENANT_TOKEN_KEY` sulla VPS prima di usare davvero il callback OAuth
- per eBay il `redirect_uri` non e' una URL arbitraria: va configurato il `RuName` corretto e l'`Accept URL` del portale eBay deve puntare al callback pubblico del progetto
- per il branding OAuth eBay, nginx deve inoltrare anche `/`, `/privacy` e `/about` verso `fiscalbay-oauth`; la configurazione di riferimento e' `deploy/nginx-fiscalbay-oauth.conf`
- e' possibile usare il fallback `EBAY_ENABLE_PLAINTEXT_TENANT_TOKENS=1` solo per dev o recovery controllato, ma non sostituisce la cifratura reale a riposo e non va lasciato attivo come default

Health check:

```bash
"$(pwd)/.venv/bin/fiscalbay-healthcheck"
```

Health check JSON:

```bash
"$(pwd)/.venv/bin/fiscalbay-healthcheck" --json
```

Nota storage:

- le nuove migrazioni SQLite possono aggiungere tabelle tenant-aware nello stesso `state.db`
- questo non attiva da solo la multiutenza: finche' il DB non contiene tenant/account/subscription, il bot continua a comportarsi come oggi
- su VPS, prima di deploy che toccano lo storage, verificare di avere un backup fresco di `data/state.db`
- dal momento in cui il bot registra utenti/chat dal traffico Telegram reale, `state.db` diventa anche la base iniziale della futura migrazione multiutente
- se il DB contiene gia' la mappatura tra chat Telegram e tenant utente, i comandi del bot leggono gia' lo stato tenant-aware; in assenza di mappatura resta il fallback globale

Il report JSON include anche metriche runtime aggregate:

- `orders_read`
- `orders_with_fiscal_identifier`
- `notifications_sent`
- `telegram_retries`
- `consecutive_error_cycles`
- `ebay_errors`
- `telegram_errors`

Include anche readiness multiutente:

- `multi_tenant.tenant_users`
- `multi_tenant.tenant_chats`
- `multi_tenant.linked_accounts`
- `multi_tenant.active_token_sets`
- `multi_tenant.notification_subscriptions`
- `multi_tenant.tenant_runtime_states`
- `multi_tenant.tenant_credentials_ready`

Include anche stato queue operativa:

- `operation_queue.pending`
- `operation_queue.running`
- `operation_queue.failed`

Include anche pressione risorse VPS:

- `resources.disk_used_percent`
- `resources.inode_used_percent`
- `resources.memory_available_mb`
- `resources.memory_available_percent`

Include anche policy e soglie del servizio pubblico:

- `public_service.service_model`
- `public_service.web_role`
- `public_service.onboarding_hosting`
- `public_service.approved_users` e relativo limite
- `public_service.linked_accounts` e relativo limite
- `public_service.active_token_sets` e relativo limite
- `public_service.sqlite_db_bytes` e relativo limite
- `public_service.sqlite_migration_recommended`
- `public_service.scale_within_policy`

Metriche prodotto lato admin:

- `/admin` mostra il set stabile minimo per governare il servizio piccolo:
  ordini letti, ordini con dato fiscale, notifiche inviate, tenant noti, token
  attivi e rapporto tra utenti approvati e account collegati
- queste metriche vanno lette come segnale operativo di qualita' e carico, non
  come analytics commerciali
- se il rapporto linked/approved resta basso, usare `/admin_users unlinked` e
  `/tenant_health` prima di allargare altri utenti

Alert check periodico:

```bash
./deploy/alert-check.sh
sudo systemctl status fiscalbay-alertcheck.timer
sudo systemctl list-timers fiscalbay-alertcheck.timer
```

Soglie minime attuali:

- servizio `fiscalbay-bot` attivo
- `consecutive_error_cycles <= 3`
- `retry_queue_size <= 20`
- disco usato sotto `MAX_DISK_USED_PERCENT` sul path applicativo
- inode usati sotto `MAX_INODE_USED_PERCENT` sul path applicativo
- memoria disponibile sopra `MIN_MEMORY_AVAILABLE_MB`
- utenti approvati, account collegati, token attivi e dimensione SQLite sotto le
  soglie `FISCALBAY_PUBLIC_*`

Override possibili via env:

- `MAX_CONSECUTIVE_ERROR_CYCLES`
- `MAX_RETRY_QUEUE_SIZE`
- `MAX_DISK_USED_PERCENT`
- `MAX_INODE_USED_PERCENT`
- `MIN_MEMORY_AVAILABLE_MB`
- `RESOURCE_PATH`
- `FISCALBAY_PUBLIC_MAX_APPROVED_USERS`
- `FISCALBAY_PUBLIC_MAX_LINKED_ACCOUNTS`
- `FISCALBAY_PUBLIC_MAX_ACTIVE_TOKEN_SETS`
- `FISCALBAY_SQLITE_MAX_DB_BYTES`

Se compare `sqlite_migration_recommended`, non allargare il numero di utenti
approvati prima di avere un piano di migrazione verso Postgres o equivalente.

Healthcheck esterno HTTPS:

```bash
./deploy/external-healthcheck.sh
sudo systemctl status fiscalbay-external-healthcheck.timer
sudo systemctl list-timers fiscalbay-external-healthcheck.timer
```

Il check usa `FISCALBAY_PUBLIC_HEALTH_URL`, oppure deriva `/healthz` da
`EBAY_OAUTH_CALLBACK_URL` quando possibile. Controlla anche che il certificato TLS
non scada entro `TLS_MIN_DAYS_VALID` giorni.

Inventario rapido:

```bash
./deploy/service-inventory.sh
```

L'inventario stampa commit, branch, stato unit/timer `fiscalbay-*`, chiavi env
presenti senza valori e pressione disco/memoria. Viene incluso anche nei backup
quando lo script e' disponibile.

Manutenzione log:

```bash
./deploy/log-maintenance.sh
sudo systemctl status fiscalbay-log-maintenance.timer
```

Il timer applica vacuum del journal con `JOURNAL_VACUUM_TIME` e
`JOURNAL_VACUUM_SIZE`; per nginx rimuove solo log FiscalBay gia' ruotati oltre
`NGINX_LOG_RETENTION_DAYS`.

Reconciliation periodica:

```bash
./deploy/reconcile.sh
sudo systemctl status fiscalbay-reconcile.timer
sudo systemctl list-timers fiscalbay-reconcile.timer
```

La reconciliation:

- processa la `operation_queue`
- riallinea accessi utente, chat e subscription
- marca come `expired` le sessioni OAuth pendenti ma scadute
- revoca localmente eventuali token ancora `active` su account non piu' `linked`

## Aggiornamento del bot

Da Mac locale, percorso standard automatizzato senza GitHub Actions:

```bash
scripts/deploy_now.sh
```

Release versionata esplicita:

```bash
scripts/release_now.sh
```

Fallback deploy via archivio locale verso la VPS FiscalBay:

```bash
scripts/local_deploy_vps.sh
```

Da shell aperta direttamente sulla VPS, percorso operativo locale:

```bash
cd /percorso/del/progetto
chmod +x deploy/update.sh
./deploy/update.sh
```

## Smoke test post-deploy

```bash
cd /percorso/del/progetto
chmod +x deploy/smoke-check.sh
./deploy/smoke-check.sh
```

Lo smoke test verifica:

- servizio `systemd` attivo
- health check del bot senza errori bloccanti di avvio
- `last_check_missing` e `last_check_stale` non bloccano lo smoke deploy, per non confondere problemi upstream eBay temporanei con deploy falliti
- se `fiscalbay-oauth` e' abilitato, verifica anche che il servizio OAuth risulti attivo
- se i timer sono abilitati, avvia `fiscalbay-alertcheck.service` e `fiscalbay-reconcile.service`
- se `/etc/fiscalbay/duckdns.env` esiste, verifica che `fiscalbay-duckdns.timer` sia abilitato e attivo
- fallisce se restano unit FiscalBay in stato failed

## Backup e restore

Asset minimi da proteggere:

- `${APP_DIR}/.env`
- `${APP_DIR}/data/state.db`
- eventuali file `.legacy-json.bak` creati durante la migrazione automatica
- unit `systemd` `fiscalbay-*`
- configurazione `nginx` FiscalBay, se presente
- file env operativi in `/etc/fiscalbay`, se leggibili dal job di backup
- inventario rapido di servizio per recovery e diagnosi

Backup operativo:

```bash
cd /percorso/del/progetto
chmod +x deploy/backup.sh
./deploy/backup.sh
```

Comportamento:

- crea backup in `~/maintenance-backups/`
- include `.env`, `data/state.db`, gli eventuali `.legacy-json.bak`, unit
  `systemd`, configurazione `nginx` FiscalBay, env operativi leggibili in
  `/etc/fiscalbay` e `SERVICE_INVENTORY.txt`
- applica retention minima di 7 backup, modificabile con `RETENTION_COUNT`
- i nuovi setup abilitano anche il timer `systemd` `fiscalbay-backup.timer` con esecuzione giornaliera persistente

Nel setup produttivo attuale dell'utente `fiscalbay`, i backup finiscono in `/home/fiscalbay/maintenance-backups/`.

Verifica schedulazione:

```bash
sudo systemctl status fiscalbay-backup.timer
sudo systemctl list-timers fiscalbay-backup.timer
```

Restore di prova su file separato:

```bash
cd /percorso/del/progetto
chmod +x deploy/restore.sh
./deploy/restore.sh /home/fiscalbay/maintenance-backups/<backup-dir>
```

Restore drill periodico:

```bash
./deploy/restore-drill.sh
sudo systemctl status fiscalbay-restore-drill.timer
sudo systemctl list-timers fiscalbay-restore-drill.timer
```

Il drill prende l'ultimo backup disponibile, ripristina gli asset in
`data/restore-check/<backup-dir>/` e verifica che il manifest e almeno un asset
runtime siano presenti. Non modifica il servizio in produzione.

Restore in-place solo quando serve davvero:

```bash
cd /percorso/del/progetto
./deploy/restore.sh /home/fiscalbay/maintenance-backups/<backup-dir> --in-place
```

Il restore in-place ripristina solo `.env` e `data/state.db`. Le configurazioni
`systemd` e `nginx` vengono conservate nel backup per diagnosi o ricostruzione,
ma non vengono sovrascritte automaticamente.

Backup manuale di manutenzione gia' eseguito:

- `/home/fiscalbay/maintenance-backups/`
- `/home/opc/maintenance-backups/2026-04-06-legacy-install-home-opc/fiscalbay-legacy`
- eventuali override di servizio o note locali operative

## Verifica permessi segreti

Controllo rapido:

```bash
cd /percorso/del/progetto
chmod +x deploy/check-secrets-perms.sh
./deploy/check-secrets-perms.sh
```

Atteso:

- `.env` con permessi `600`
- `data/state.db` con permessi `600` o `660`

## Problemi operativi comuni

Servizio non parte:

- controlla `sudo systemctl status fiscalbay-bot`
- controlla `sudo journalctl -u fiscalbay-bot -n 100 --no-pager`
- verifica il file `${APP_DIR}/.env`
- controlla che non esista una seconda istanza manuale di `fiscalbay-bot`

Health check fallisce:

- controlla se manca il lock del bot
- controlla se `last_check` e' troppo vecchio
- controlla se la retry queue non si svuota
- controlla `last_error` nello state DB
- se trovi vecchi file `data/notified_orders.json` o `data/failed_notifications.json`, il bot ora li converte da solo a SQLite al primo avvio

### Playbook incidente: token eBay

Sintomi tipici: errori OAuth/eBay nel journal, `consecutive_error_cycles` in
crescita, utenti in stato `reconnect_required`.

1. leggere `./.venv/bin/fiscalbay-healthcheck --json`
2. controllare `tenant_snapshots.reconnect_required` e `metrics.ebay_errors`
3. verificare che `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`, `EBAY_OAUTH_RUNAME` e
   `EBAY_TENANT_TOKEN_KEY` siano presenti senza stamparne i valori
4. eseguire `./.venv/bin/fiscalbay-security-check` o leggere `/admin sicurezza`
5. per un tenant specifico, usare `/account` o `/tenant_health`
6. se serve, mettere il servizio in `/service_mode degraded` finche' i tenant non
   ricollegano l'account

### Playbook incidente: callback OAuth

Sintomi tipici: `/account collega` restituisce link non usabile, callback non
raggiungibile, errori TLS o nginx.

1. eseguire `./deploy/external-healthcheck.sh`
2. controllare `sudo systemctl status fiscalbay-oauth`
3. controllare `sudo nginx -t`
4. verificare che l'`Accept URL` eBay coincida con `EBAY_OAUTH_CALLBACK_URL`
5. controllare `sudo journalctl -u fiscalbay-oauth -n 100 --no-pager`

### Playbook incidente: `state.db`

Sintomi tipici: bot avviato ma stato incoerente, errori SQLite, retry queue o
tenant mancanti.

1. fermare il bot se il DB sembra corrotto: `sudo systemctl stop fiscalbay-bot`
2. creare un backup fresco della situazione corrente con `./deploy/backup.sh`
3. eseguire un restore drill sull'ultimo backup sano con `./deploy/restore-drill.sh`
4. ripristinare in-place solo se necessario con `./deploy/restore.sh <backup> --in-place`
5. riavviare bot e reconciliation, poi controllare healthcheck e journal

### Playbook incidente: `nginx` e TLS

Sintomi tipici: sito OAuth non raggiungibile, certificato in scadenza, callback
pubblico non risponde.

1. eseguire `./deploy/external-healthcheck.sh`
2. validare nginx con `sudo nginx -t`
3. leggere i log recenti nginx e `fiscalbay-oauth`
4. verificare che la configurazione attiva corrisponda al backup in
   `maintenance-backups/<backup>/nginx/`
5. rinnovare il certificato con il percorso Certbot configurato sulla VPS

### Playbook incidente: notifiche ferme

Sintomi tipici: ordini letti ma nessun messaggio Telegram, retry queue in crescita,
`telegram_errors` nel report.

1. controllare `retry_queue_size` e `metrics.telegram_errors`
2. leggere `sudo journalctl -u fiscalbay-bot -n 100 --no-pager`
3. verificare `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ALLOWED_CHAT_IDS` e subscription con
   `/settings` o `/tenant_health`
4. eseguire `./deploy/reconcile.sh`
5. se il problema e' esterno a Telegram o eBay, usare `/service_mode degraded`
   finche' la coda non torna stabile

## Hardening attivo

- SSH accetta login solo con chiave
- `PermitRootLogin` e' impostato a `no`
- firewall espone solo il servizio `ssh`
- `fail2ban` protegge il jail `sshd`
- lo script di setup supporta un utente di servizio dedicato tramite `APP_USER` e `APP_GROUP`
- lo script di setup installa e abilita il timer `fiscalbay-backup.timer`
- lo script di setup installa e abilita anche `fiscalbay-alertcheck.timer` per gli alert runtime minimi
- lo script di setup installa `fiscalbay-duckdns.timer` e lo abilita solo quando esiste `/etc/fiscalbay/duckdns.env`

Deploy riuscito ma bot non sano:

- esegui `./deploy/smoke-check.sh`
- se fallisce, fai rollback alla revisione precedente e riavvia il servizio

## Baseline operativa e sicurezza

I requisiti minimi di baseline e sicurezza immediata sono ora assorbiti in:

- `docs/OPERATIONS.md`
- `docs/SECURITY.md`
