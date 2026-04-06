# Fase 0 - Baseline Operativa e Sicurezza Immediata

Questo documento chiude la baseline minima della fase 0 per il progetto attuale.

Assunzioni esplicite:

- il deploy reale resta sulla VPS Oracle Linux attuale
- non esiste un ambiente staging dedicato persistente
- il bot resta single-tenant e usa segreti globali nel file `.env` della VPS

## Stato deciso

Decisioni operative valide da ora:

- niente staging persistente finche' il progetto resta utility privata single-tenant
- ogni rilascio passa da una baseline pre-release minima e ripetibile
- rollback e gestione segreti sono trattati come procedure operative, non come memoria implicita

## Checklist di rollback

Eseguire nell'ordine seguente se un deploy peggiora il servizio:

1. verificare il problema con `sudo systemctl status ebaycf-bot`
2. raccogliere contesto rapido con `sudo journalctl -u ebaycf-bot -n 100 --no-pager`
3. eseguire `"/home/opc/eBay CF/.venv/bin/ebay-cf-healthcheck" --json`
4. annotare la revisione corrente con `git -C "/home/opc/eBay CF" rev-parse --short HEAD`
5. individuare la revisione precedente sana con `git -C "/home/opc/eBay CF" log --oneline -n 5`
6. fare checkout della revisione da ripristinare
7. reinstallare il package nel virtualenv con `"/home/opc/eBay CF/.venv/bin/pip" install -e "/home/opc/eBay CF"`
8. riavviare il servizio con `sudo systemctl restart ebaycf-bot`
9. rieseguire smoke test con `"/home/opc/eBay CF/deploy/smoke-check.sh"`
10. se il problema riguarda dati o configurazione, recuperare `.env` e `state.db` dai backup in `~/maintenance-backups/`

Condizioni di stop:

- non procedere con restore dati se il problema e' solo applicativo
- non riutilizzare file legacy JSON salvo emergenza documentata
- dopo rollback riuscito, conservare i log del deploy fallito per analisi successiva

## Alternativa minima a staging

Finche' manca uno staging dedicato, il percorso minimo obbligatorio pre-release e':

1. eseguire in locale `bash scripts/ci_verify.sh`
2. verificare manualmente gli entrypoint con `ebay-cf --help` o equivalente nel virtualenv
3. se il cambiamento tocca bot, deploy o storage, eseguire dopo il deploy `./deploy/smoke-check.sh` sulla VPS
4. controllare per alcuni minuti `journalctl -u ebaycf-bot -f`

Questa non sostituisce uno staging vero, ma definisce una preview operativa minima e testabile prima di considerare sano un rilascio.

Quando il progetto passera' a multiutenza o gestira' token utente, questa eccezione non bastera' piu' e andra' introdotto uno staging reale.

## Inventario segreti attuali

Segreti sensibili attuali:

- `EBAY_CLIENT_ID`
- `EBAY_CLIENT_SECRET`
- `EBAY_REFRESH_TOKEN`
- `TELEGRAM_BOT_TOKEN`

Contenitore autorizzato attuale:

- `/home/opc/eBay CF/.env`

Regole minime:

- permessi file attesi: `600`
- nessun segreto in `README.md`, `CONTEXT.md`, `CHECKLIST.md` o commit Git
- nessun invio di `.env` fuori da backup amministrativi controllati

## Rotazione segreti

Eventi che impongono rotazione:

- sospetto leak o condivisione impropria
- cambio manutentore o accesso SSH compromesso
- debug con copia accidentale di `.env`
- revoca o reset da provider eBay o Telegram

Cadenza minima ricorrente:

- verifica mensile della lista segreti
- rotazione trimestrale di `TELEGRAM_BOT_TOKEN` se operativamente sostenibile
- rotazione trimestrale del `EBAY_REFRESH_TOKEN` o prima se eBay forza rinnovo
- verifica ad ogni rilascio che `.env` non abbia copie superflue

Procedura minima di rotazione:

1. creare backup cifrato o comunque amministrativamente controllato dell'attuale `.env`
2. generare il nuovo segreto lato provider
3. aggiornare `/home/opc/eBay CF/.env`
4. riavviare `ebaycf-bot`
5. eseguire `deploy/smoke-check.sh`
6. invalidare il segreto precedente appena confermato il corretto funzionamento
7. annotare data, segreto ruotato e motivo in una nota operativa privata

## Evidenze gia' raccolte

Baseline operativa gia' verificata al 2026-04-06:

- VPS Oracle Linux 9.7 con `systemd`
- servizio reale `ebaycf-bot`
- runtime corretto in `/home/opc/eBay CF/.venv`
- dati runtime in `/home/opc/eBay CF/data`
- backup manuale di manutenzione in `~/maintenance-backups/2026-04-06-vps-cleanup`
