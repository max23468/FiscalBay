# Deploy su Oracle VPS

Questa guida prepara `eBay CF` per una VPS Oracle con Ubuntu usando `systemd`.

## Configurazione consigliata

- Ubuntu 24.04 LTS
- accesso SSH con chiave
- 1 vCPU
- 1-2 GB RAM se disponibili
- storage persistente standard

## Flusso consigliato

1. entra in SSH
2. clona la repository
3. esegui `deploy/oracle-setup.sh`
4. compila `/etc/ebay-cf/ebay-cf.env`
5. abilita il servizio `ebay-cf`
6. esegui smoke test e health check

## Setup iniziale

```bash
sudo apt update
sudo apt install -y git
git clone https://github.com/max23468/eBayCF.git
cd eBayCF
chmod +x deploy/oracle-setup.sh
./deploy/oracle-setup.sh
```

## Variabili da configurare

File:

```bash
sudo nano /etc/ebay-cf/ebay-cf.env
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
EBAY_ORDER_STATE_PATH=/opt/ebay-cf/data/runtime/state.db
EBAY_NOTIFY_RETRY_PATH=/opt/ebay-cf/data/runtime/state.db
TELEGRAM_BOT_LOCK_PATH=/opt/ebay-cf/data/runtime/telegram_bot.lock
```

## Avvio servizio

```bash
sudo systemctl enable --now ebay-cf
sudo systemctl status ebay-cf
```

## Log e salute runtime

```bash
sudo journalctl -u ebay-cf -f
/opt/ebay-cf/venv/bin/ebay-cf-healthcheck
```

## Aggiornamento dopo un push

```bash
cd /opt/ebay-cf/app
./deploy/update.sh
./deploy/smoke-check.sh
```

## Note operative

- usiamo polling, quindi non serve webhook pubblico
- SQLite e lock file restano fuori dal clone Git
- `systemd` e' lo standard operativo raccomandato per questo progetto
