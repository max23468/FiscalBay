# Operativita'

Guida operativa rapida per l'esercizio quotidiano del servizio.

Per i dettagli completi di deploy e recovery vedere anche `docs/RUNBOOK.md`.

## Indice rapido

- check giornalieri minimi
- comandi rapidi
- sequenza standard dopo update
- percorso minimo pre-release
- rollback rapido
- backup operativi
- criteri minimi per considerare sano il servizio

Documenti collegati:

- `docs/INDEX.md`
- `docs/RUNBOOK.md`
- `docs/SECURITY.md`

## Check giornalieri minimi

- verificare che `ebaycf-bot` sia attivo
- verificare che l'healthcheck sia `ok`
- controllare se ci sono errori recenti in journal
- controllare che `last_check` non sia stale
- verificare che la retry queue non cresca in modo anomalo

## Comandi rapidi

Status servizio:

```bash
sudo systemctl status ebaycf-bot
```

Log recenti:

```bash
sudo journalctl -u ebaycf-bot -n 100 --no-pager
```

Log live:

```bash
sudo journalctl -u ebaycf-bot -f
```

Restart:

```bash
sudo systemctl restart ebaycf-bot
```

Health check:

```bash
./.venv/bin/ebay-cf-healthcheck
```

Health check JSON:

```bash
./.venv/bin/ebay-cf-healthcheck --json
```

Metriche runtime leggibili:

- `orders_read`
- `orders_with_cf`
- `notifications_sent`
- `telegram_retries`
- `consecutive_error_cycles`
- `ebay_errors`
- `telegram_errors`

Queste sono esposte oggi in due posti operativi:

- comando Telegram `/stato`
- `./.venv/bin/ebay-cf-healthcheck --json`

Alert basilari runtime:

- `deploy/alert-check.sh` esegue `ebay-cf-healthcheck` con soglie operative minime
- `ebaycf-alertcheck.timer` lancia il controllo ogni 5 minuti
- gli alert minimi oggi coprono servizio `systemd` non attivo, troppi errori consecutivi e retry queue oltre soglia
- soglie di default: `MAX_CONSECUTIVE_ERROR_CYCLES=3` e `MAX_RETRY_QUEUE_SIZE=20`
- il fallimento del check finisce nel journal del service `ebaycf-alertcheck`

Suggerimento pratico sui log:

- seguire i log cercando `cycle_id=` per correlare polling, callback, messaggi e cicli di notifica
- gli eventi principali sono ormai standardizzati per start, stop, polling, retry HTTP, retry queue, notifiche ed healthcheck

## Sequenza standard dopo update

1. eseguire `./deploy/update.sh`
2. verificare `sudo systemctl status ebaycf-bot`
3. eseguire `./deploy/smoke-check.sh`
4. se lo smoke check fallisce, leggere i log e valutare rollback

## Percorso minimo pre-release

Finche' non esiste uno staging dedicato persistente, il percorso minimo prima di considerare sano un rilascio e':

1. eseguire in locale `bash scripts/ci_verify.sh`
2. verificare gli entrypoint principali nel virtualenv
3. se il cambiamento tocca bot, deploy o storage, eseguire `./deploy/smoke-check.sh` dopo il deploy
4. osservare per alcuni minuti `journalctl -u ebaycf-bot -f`

Questo non sostituisce uno staging vero, ma e' la baseline operativa minima attuale.

## Rollback rapido

Se un deploy peggiora il servizio, seguire nell'ordine:

1. verificare `sudo systemctl status ebaycf-bot`
2. raccogliere contesto con `sudo journalctl -u ebaycf-bot -n 100 --no-pager`
3. eseguire `./.venv/bin/ebay-cf-healthcheck --json`
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
- se il controllo periodico fallisce, leggere `sudo journalctl -u ebaycf-alertcheck -n 50 --no-pager`

## Backup operativi

Backup manuale:

```bash
./deploy/backup.sh
```

Verifica timer:

```bash
sudo systemctl status ebaycf-backup.timer
sudo systemctl list-timers ebaycf-backup.timer
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
- servizio reale `ebaycf-bot`
- runtime corretto in `/opt/ebay-cf/.venv`
- dati runtime in `/opt/ebay-cf/data`
- backup operativi in `/home/ebaycf/maintenance-backups/`
