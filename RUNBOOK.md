# Runbook

Questa guida standardizza l'esercizio del bot sulla VPS Linux attuale con `systemd`.

## Standard operativo scelto

- distribuzione verificata: Oracle Linux 9.7
- esecuzione principale: `systemd` nativo
- utente servizio attuale: `opc`
- codice applicativo: `/home/opc/eBay CF`
- virtualenv: `/home/opc/eBay CF/.venv`
- dati runtime: `/home/opc/eBay CF/data`
- env file: `/home/opc/eBay CF/.env`
- servizio: `ebaycf-bot`

## Primo setup su VPS Linux

Lo script di setup supporta in automatico:

- `apt-get`
- `dnf`
- `yum`
- `apk`

```bash
git clone https://github.com/max23468/eBayCF.git "eBay CF"
cd "eBay CF"
chmod +x deploy/linux-setup.sh
./deploy/linux-setup.sh
```

Poi:

```bash
nano "/home/opc/eBay CF/.env"
sudo systemctl enable --now ebaycf-bot
sudo systemctl status ebaycf-bot
```

## Comandi operativi

Status:

```bash
sudo systemctl status ebaycf-bot
```

Restart:

```bash
sudo systemctl restart ebaycf-bot
```

Stop:

```bash
sudo systemctl stop ebaycf-bot
```

Log live:

```bash
sudo journalctl -u ebaycf-bot -f
```

Health check:

```bash
"/home/opc/eBay CF/.venv/bin/ebay-cf-healthcheck"
```

Health check JSON:

```bash
"/home/opc/eBay CF/.venv/bin/ebay-cf-healthcheck" --json
```

## Aggiornamento del bot

```bash
cd "/home/opc/eBay CF"
chmod +x deploy/update.sh
./deploy/update.sh
```

## Smoke test post-deploy

```bash
cd "/home/opc/eBay CF"
chmod +x deploy/smoke-check.sh
./deploy/smoke-check.sh
```

Lo smoke test verifica:

- servizio `systemd` attivo
- health check del bot in stato `ok`

## Backup minimi da prevedere

- `/home/opc/eBay CF/.env`
- `/home/opc/eBay CF/data/state.db`
- eventuali file `.legacy-json.bak` creati durante la migrazione automatica

Backup manuale di manutenzione gia' eseguito:

- `~/maintenance-backups/2026-04-06-vps-cleanup`
- eventuali override di servizio o note locali operative

## Problemi operativi comuni

Servizio non parte:

- controlla `sudo systemctl status ebaycf-bot`
- controlla `sudo journalctl -u ebaycf-bot -n 100 --no-pager`
- verifica il file `/home/opc/eBay CF/.env`
- controlla che non esista una seconda istanza manuale di `python src/telegram_bot.py`

Health check fallisce:

- controlla se manca il lock del bot
- controlla se `last_check` e' troppo vecchio
- controlla se la retry queue non si svuota
- controlla `last_error` nello state DB
- se trovi vecchi file `data/notified_orders.json` o `data/failed_notifications.json`, il bot ora li converte da solo a SQLite al primo avvio

## Hardening attivo

- SSH accetta login solo con chiave
- `PermitRootLogin` e' impostato a `no`
- firewall espone solo il servizio `ssh`
- `fail2ban` protegge il jail `sshd`

Deploy riuscito ma bot non sano:

- esegui `./deploy/smoke-check.sh`
- se fallisce, fai rollback alla revisione precedente e riavvia il servizio
