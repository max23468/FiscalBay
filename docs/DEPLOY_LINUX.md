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

## Avvio servizio

```bash
sudo systemctl enable --now fiscalbay-bot
sudo systemctl status fiscalbay-bot
```

## Log e salute runtime

```bash
sudo journalctl -u fiscalbay-bot -f
./.venv/bin/fiscalbay-healthcheck
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

Restore in-place:

```bash
./deploy/restore.sh /home/fiscalbay/maintenance-backups/<backup-dir> --in-place
```

Verifica permessi:

```bash
./deploy/check-secrets-perms.sh
```

Verifica timer giornaliero:

```bash
sudo systemctl status fiscalbay-backup.timer
sudo systemctl list-timers fiscalbay-backup.timer
```

## Note operative

- usiamo polling, quindi non serve webhook pubblico
- SQLite e lock file restano nella directory `data/` del progetto
- il servizio reale della VPS si chiama `fiscalbay-bot`
- Docker Compose non e' mantenuto come opzione reale di esercizio sulla VPS attuale
- lo script di setup supporta `apt-get`, `dnf`, `yum` e `apk`
- il setup puo' creare e usare un utente di servizio dedicato
- se sulla VPS esistono ancora `data/notified_orders.json` o `data/failed_notifications.json`, il bot li migra automaticamente a SQLite al primo avvio utile
