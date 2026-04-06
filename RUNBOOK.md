# Runbook

Questa guida standardizza l'esercizio del bot su VPS con `systemd`.

## Standard operativo scelto

- esecuzione principale: `systemd` nativo
- codice applicativo: `/opt/ebay-cf/app`
- virtualenv: `/opt/ebay-cf/venv`
- dati runtime: `/opt/ebay-cf/data/runtime`
- env file: `/etc/ebay-cf/ebay-cf.env`
- servizio: `ebay-cf`

## Primo setup su VPS Ubuntu

```bash
sudo apt update
sudo apt install -y git
git clone https://github.com/max23468/eBayCF.git
cd eBayCF
chmod +x deploy/oracle-setup.sh
./deploy/oracle-setup.sh
```

Poi:

```bash
sudo nano /etc/ebay-cf/ebay-cf.env
sudo systemctl enable --now ebay-cf
sudo systemctl status ebay-cf
```

## Comandi operativi

Status:

```bash
sudo systemctl status ebay-cf
```

Restart:

```bash
sudo systemctl restart ebay-cf
```

Stop:

```bash
sudo systemctl stop ebay-cf
```

Log live:

```bash
sudo journalctl -u ebay-cf -f
```

Health check:

```bash
/opt/ebay-cf/venv/bin/ebay-cf-healthcheck
```

Health check JSON:

```bash
/opt/ebay-cf/venv/bin/ebay-cf-healthcheck --json
```

## Aggiornamento del bot

```bash
cd /opt/ebay-cf/app
chmod +x deploy/update.sh
./deploy/update.sh
```

## Smoke test post-deploy

```bash
cd /opt/ebay-cf/app
chmod +x deploy/smoke-check.sh
./deploy/smoke-check.sh
```

Lo smoke test verifica:

- servizio `systemd` attivo
- health check del bot in stato `ok`

## Backup minimi da prevedere

- `/etc/ebay-cf/ebay-cf.env`
- `/opt/ebay-cf/data/runtime/state.db`
- eventuali override di servizio o note locali operative

## Problemi operativi comuni

Servizio non parte:

- controlla `sudo systemctl status ebay-cf`
- controlla `sudo journalctl -u ebay-cf -n 100 --no-pager`
- verifica il file `/etc/ebay-cf/ebay-cf.env`

Health check fallisce:

- controlla se manca il lock del bot
- controlla se `last_check` e' troppo vecchio
- controlla se la retry queue non si svuota
- controlla `last_error` nello state DB

Deploy riuscito ma bot non sano:

- esegui `./deploy/smoke-check.sh`
- se fallisce, fai rollback alla revisione precedente e riavvia il servizio
