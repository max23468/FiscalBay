# Sicurezza

Questa nota riassume il perimetro di sicurezza attuale e i gap aperti.

## Stato attuale

- deploy reale su VPS Linux
- accesso SSH solo con chiave
- `PermitRootLogin no`
- firewall limitato al servizio `ssh`
- `fail2ban` attivo per `sshd`
- bot eseguito come servizio `systemd`
- file `.env` con permessi stretti
- backup e restore documentati

## Segreti attuali

Segreti principali:

- `EBAY_CLIENT_ID`
- `EBAY_CLIENT_SECRET`
- `EBAY_REFRESH_TOKEN`
- `TELEGRAM_BOT_TOKEN`

Regole:

- non salvare segreti nel repository
- non inserire segreti in documentazione o commit
- limitare la lettura di `.env`
- ruotare i segreti in caso di sospetto leak o cambio manutentore
- contenitore autorizzato attuale: `/opt/ebay-cf/.env`
- permessi attesi del file `.env`: `600`
- evitare copie superflue di `.env` fuori da backup amministrativi controllati

## Rotazione segreti

Eventi che impongono rotazione:

- sospetto leak o condivisione impropria
- cambio manutentore o accesso SSH compromesso
- debug con copia accidentale di `.env`
- revoca o reset lato eBay o Telegram

Cadenza minima ricorrente:

- verifica mensile dell'inventario segreti
- rotazione trimestrale di `TELEGRAM_BOT_TOKEN` se sostenibile
- rotazione trimestrale di `EBAY_REFRESH_TOKEN` o prima se eBay forza rinnovo

Procedura minima:

1. creare un backup amministrativamente controllato dell'attuale `.env`
2. generare o ottenere il nuovo segreto lato provider
3. aggiornare `/opt/ebay-cf/.env`
4. riavviare `ebaycf-bot`
5. eseguire `deploy/smoke-check.sh`
6. invalidare il segreto precedente appena confermato il corretto funzionamento

## Rischi ancora aperti

- credenziali eBay ancora globali single-tenant
- SQLite locale come persistence principale
- metriche e alerting ancora minimi
- assenza di cifratura a riposo per futuri token utente

## Requisiti minimi prima della multiutenza pubblica

- token per utente e non globali
- refresh token cifrati a riposo
- audit log minimo su connect/disconnect
- rate limiting per utente
- migliore osservabilita' operativa
- review dedicata del flusso OAuth

## Incident response minima

In caso di problema:

1. verificare log e healthcheck
2. isolare la causa tra deploy, configurazione, eBay, Telegram o stato locale
3. ruotare i segreti se c'e' rischio di esposizione
4. usare backup e restore se il problema coinvolge stato o configurazione
5. annotare l'incidente e l'azione correttiva nel changelog o nella documentazione operativa
