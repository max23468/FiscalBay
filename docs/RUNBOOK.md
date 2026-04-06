# Runbook Operativo

Questa guida standardizza l'esercizio del bot sulla VPS Linux attuale con `systemd`.

## Standard operativo scelto

- distribuzione verificata: Oracle Linux 9.7
- esecuzione principale: `systemd` nativo
- utente servizio in produzione: `ebaycf`
- codice applicativo in produzione: `/opt/ebay-cf`
- Docker Compose: supporto locale o legacy, non standard di esercizio in produzione
- virtualenv: `${APP_DIR}/.venv`
- dati runtime: `${APP_DIR}/data`
- env file: `${APP_DIR}/.env`
- servizio: `ebaycf-bot`

## Primo setup su VPS Linux

Lo script di setup supporta in automatico:

- `apt-get`
- `dnf`
- `yum`
- `apk`

```bash
git clone https://github.com/max23468/eBayCF.git ebay-cf
cd ebay-cf
chmod +x deploy/linux-setup.sh
APP_USER=ebaycf APP_GROUP=ebaycf ./deploy/linux-setup.sh
```

Poi:

```bash
nano "./.env"
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
"$(pwd)/.venv/bin/ebay-cf-healthcheck"
```

Health check JSON:

```bash
"$(pwd)/.venv/bin/ebay-cf-healthcheck" --json
```

## Aggiornamento del bot

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
- health check del bot in stato `ok`

## Backup e restore

Asset minimi da proteggere:

- `${APP_DIR}/.env`
- `${APP_DIR}/data/state.db`
- eventuali file `.legacy-json.bak` creati durante la migrazione automatica

Backup operativo:

```bash
cd /percorso/del/progetto
chmod +x deploy/backup.sh
./deploy/backup.sh
```

Comportamento:

- crea backup in `~/maintenance-backups/`
- include `.env`, `data/state.db` e gli eventuali `.legacy-json.bak`
- applica retention minima di 7 backup, modificabile con `RETENTION_COUNT`
- i nuovi setup abilitano anche il timer `systemd` `ebaycf-backup.timer` con esecuzione giornaliera persistente

Nel setup produttivo attuale dell'utente `ebaycf`, i backup finiscono in `/home/ebaycf/maintenance-backups/`.

Verifica schedulazione:

```bash
sudo systemctl status ebaycf-backup.timer
sudo systemctl list-timers ebaycf-backup.timer
```

Restore di prova su file separato:

```bash
cd /percorso/del/progetto
chmod +x deploy/restore.sh
./deploy/restore.sh /home/ebaycf/maintenance-backups/<backup-dir>
```

Restore in-place solo quando serve davvero:

```bash
cd /percorso/del/progetto
./deploy/restore.sh /home/ebaycf/maintenance-backups/<backup-dir> --in-place
```

Backup manuale di manutenzione gia' eseguito:

- `/home/ebaycf/maintenance-backups/`
- `/home/opc/maintenance-backups/2026-04-06-legacy-install-home-opc/ebay-cf-legacy`
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

- controlla `sudo systemctl status ebaycf-bot`
- controlla `sudo journalctl -u ebaycf-bot -n 100 --no-pager`
- verifica il file `${APP_DIR}/.env`
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
- lo script di setup supporta un utente di servizio dedicato tramite `APP_USER` e `APP_GROUP`
- lo script di setup installa e abilita il timer `ebaycf-backup.timer`

Deploy riuscito ma bot non sano:

- esegui `./deploy/smoke-check.sh`
- se fallisce, fai rollback alla revisione precedente e riavvia il servizio

## Baseline operativa e sicurezza

I requisiti minimi di baseline e sicurezza immediata sono ora assorbiti in:

- `docs/OPERATIONS.md`
- `docs/SECURITY.md`
