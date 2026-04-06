# Deploy su VPS Linux

Questa guida prepara `eBay CF` per la VPS Linux attuale con `systemd`.

## Configurazione consigliata

- Oracle Linux 9.7 con `systemd`
- accesso SSH con chiave
- 1 vCPU
- 1-2 GB RAM se disponibili
- storage persistente standard

## Flusso consigliato

1. entra in SSH
2. clona la repository
3. esegui `deploy/linux-setup.sh`
4. compila `/home/opc/eBay CF/.env`
5. abilita il servizio `ebaycf-bot`
6. esegui smoke test e health check

## Setup iniziale

```bash
git clone https://github.com/max23468/eBayCF.git "eBay CF"
cd "eBay CF"
chmod +x deploy/linux-setup.sh
./deploy/linux-setup.sh
```

## Variabili da configurare

File:

```bash
nano "/home/opc/eBay CF/.env"
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
sudo systemctl enable --now ebaycf-bot
sudo systemctl status ebaycf-bot
```

## Log e salute runtime

```bash
sudo journalctl -u ebaycf-bot -f
"/home/opc/eBay CF/.venv/bin/ebay-cf-healthcheck"
```

## Aggiornamento dopo un push

```bash
cd "/home/opc/eBay CF"
./deploy/update.sh
./deploy/smoke-check.sh
```

## Note operative

- usiamo polling, quindi non serve webhook pubblico
- SQLite e lock file restano nella directory `data/` del progetto
- il servizio reale della VPS si chiama `ebaycf-bot`
- lo script di setup supporta `apt-get`, `dnf`, `yum` e `apk`
- se sulla VPS esistono ancora `data/notified_orders.json` o `data/failed_notifications.json`, il bot li migra automaticamente a SQLite al primo avvio utile
