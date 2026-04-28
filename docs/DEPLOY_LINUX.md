# Deploy su VPS Linux

Questa guida prepara `FiscalBay` per la VPS Linux attuale con `systemd`.

## Configurazione consigliata

- Oracle Linux 9.7 con `systemd`
- accesso SSH con chiave
- utente di servizio dedicato, per esempio `fiscalbay`
- `systemd` come unico standard di esercizio in produzione
- 1 vCPU
- 1-2 GB RAM se disponibili
- storage persistente standard

## Flusso consigliato

1. entra in SSH
2. clona la repository
3. esegui `deploy/linux-setup.sh`
4. compila `/opt/fiscalbay/.env`
5. abilita il servizio `fiscalbay-bot`
6. esegui smoke test e health check

Se il flusso OAuth deve essere usabile da Telegram, configura anche un dominio
pubblico HTTPS davanti al servizio `fiscalbay-oauth`; vedi
`docs/PUBLIC_ACCESS.md`.

## Setup iniziale

```bash
git clone https://github.com/max23468/FiscalBay.git fiscalbay
cd fiscalbay
chmod +x deploy/linux-setup.sh
APP_USER=fiscalbay APP_GROUP=fiscalbay ./deploy/linux-setup.sh
```

Note:

- se `APP_USER` o `APP_GROUP` non esistono, lo script li crea come account di servizio
- il servizio `systemd` viene generato con i path reali del clone corrente
- il file `.env` viene protetto con permessi `600`
- viene installato e abilitato anche il timer `fiscalbay-backup.timer` per il backup giornaliero
- vengono installati e abilitati anche i timer `fiscalbay-alertcheck.timer`,
  `fiscalbay-reconcile.timer`, `fiscalbay-restore-drill.timer`,
  `fiscalbay-external-healthcheck.timer` e `fiscalbay-log-maintenance.timer`
- per il setup produttivo corrente il percorso operativo finale atteso e' `/opt/fiscalbay`

## Variabili da configurare

File:

```bash
nano "/opt/fiscalbay/.env"
```

Minimo indispensabile:

- `EBAY_CLIENT_ID`
- `EBAY_CLIENT_SECRET`
- `EBAY_REFRESH_TOKEN`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_ALLOWED_CHAT_IDS`
- `TELEGRAM_NOTIFY_CHAT_IDS`

Percorsi consigliati:

```env
EBAY_ORDER_STATE_PATH=data/state.db
EBAY_NOTIFY_RETRY_PATH=data/state.db
TELEGRAM_BOT_LOCK_PATH=data/telegram_bot.lock
```

Soglie servizio pubblico consigliate:

```env
FISCALBAY_PUBLIC_SERVICE_MODEL=approved_public_small
FISCALBAY_WEB_ROLE=onboarding_callback_support
FISCALBAY_ONBOARDING_HOSTING=vps_oauth_callback
FISCALBAY_PUBLIC_MAX_APPROVED_USERS=25
FISCALBAY_PUBLIC_MAX_LINKED_ACCOUNTS=25
FISCALBAY_PUBLIC_MAX_ACTIVE_TOKEN_SETS=25
FISCALBAY_SQLITE_MAX_DB_BYTES=52428800
```

Rate limiting minimo per utente consigliato:

```env
FISCALBAY_RATE_LIMIT_ENABLED=1
FISCALBAY_RATE_LIMIT_REQUEST_ACCESS_SECONDS=60
FISCALBAY_RATE_LIMIT_CONNECT_SECONDS=10
FISCALBAY_RATE_LIMIT_DISCONNECT_SECONDS=5
FISCALBAY_RATE_LIMIT_LEAVE_BOT_SECONDS=5
FISCALBAY_RATE_LIMIT_SERVICE_MODE_SECONDS=2
FISCALBAY_RATE_LIMIT_ADMIN_MUTATION_SECONDS=2
```

Limiti `systemd` applicati dal setup, modificabili prima di lanciare
`deploy/linux-setup.sh`:

```env
FISCALBAY_BOT_MEMORY_MAX=512M
FISCALBAY_BOT_CPU_QUOTA=60%
FISCALBAY_OAUTH_MEMORY_MAX=256M
FISCALBAY_OAUTH_CPU_QUOTA=40%
FISCALBAY_ONESHOT_MEMORY_MAX=256M
FISCALBAY_ONESHOT_CPU_QUOTA=50%
```

## Avvio servizio

```bash
sudo systemctl enable --now fiscalbay-bot
sudo systemctl status fiscalbay-bot
```

## Accesso pubblico OAuth

Il bot usa polling Telegram, quindi non richiede webhook pubblico. Il dominio
HTTPS serve invece al flusso `/account collega` per completare l'OAuth eBay.

Setup consigliato:

- Duck DNS aggiorna l'IP pubblico della VPS
- un sottodominio personalizzato, per esempio `connect.tuodominio.it`, punta al
  record Duck DNS con `CNAME`
- nginx espone solo `/`, `/oauth/*`, `/privacy`, `/about`, `/healthz` e gli
  asset favicon pubblici
- Certbot gestisce il certificato HTTPS

Guida completa:

```bash
less docs/PUBLIC_ACCESS.md
```

## Log e salute runtime

```bash
sudo journalctl -u fiscalbay-bot -f
./.venv/bin/fiscalbay-healthcheck
```

Controlli operativi aggiuntivi:

```bash
./deploy/external-healthcheck.sh
./deploy/service-inventory.sh
sudo systemctl list-timers 'fiscalbay-*'
```

## Aggiornamento dopo un push

```bash
cd "/opt/fiscalbay"
./deploy/update.sh
./deploy/smoke-check.sh
```

## Backup, restore e permessi segreti

Backup:

```bash
./deploy/backup.sh
```

Restore di prova:

```bash
./deploy/restore.sh /home/fiscalbay/maintenance-backups/<backup-dir>
```

Restore drill:

```bash
./deploy/restore-drill.sh
sudo systemctl status fiscalbay-restore-drill.timer
```

Restore in-place:

```bash
./deploy/restore.sh /home/fiscalbay/maintenance-backups/<backup-dir> --in-place
```

Verifica permessi:

```bash
./deploy/check-secrets-perms.sh
```

Verifica security operations senza stampare segreti:

```bash
./.venv/bin/fiscalbay-security-check
```

Verifica timer giornaliero:

```bash
sudo systemctl status fiscalbay-backup.timer
sudo systemctl list-timers fiscalbay-backup.timer
```

Manutenzione log:

```bash
./deploy/log-maintenance.sh
sudo systemctl status fiscalbay-log-maintenance.timer
```

## Note operative

- usiamo polling, quindi non serve webhook pubblico
- FiscalBay resta `Telegram first`: web solo onboarding, callback OAuth e pagine
  minime di supporto
- onboarding e callback restano sulla VPS attuale finche' le soglie pubbliche
  restano rispettate
- SQLite e lock file restano nella directory `data/` del progetto
- SQLite e' accettabile solo per servizio piccolo ad accesso approvato; se
  `fiscalbay-healthcheck` segnala `sqlite_migration_recommended`, fermare
  l'allargamento utenti prima della migrazione database
- il servizio reale della VPS si chiama `fiscalbay-bot`
- Docker Compose non e' mantenuto come opzione reale di esercizio sulla VPS attuale
- lo script di setup supporta `apt-get`, `dnf`, `yum` e `apk`
- il setup puo' creare e usare un utente di servizio dedicato
- se sulla VPS esistono ancora `data/notified_orders.json` o `data/failed_notifications.json`, il bot li migra automaticamente a SQLite al primo avvio utile
