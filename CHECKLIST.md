# Checklist

## Ordine di esecuzione consigliato

1. stabilizzazione minima e sicurezza operativa
2. hardening VPS e standard deploy
3. rifondazione strutturale del codice senza cambiare comportamento
4. osservabilita', health check e runbook operativi
5. progettazione multiutente
6. onboarding self-service Telegram + eBay OAuth

## Checklist Operativa

## Fase 0 - Baseline e Sicurezza Immediata [Priorita' alta]

### Assetto iniziale e rischio

- [ ] preservare la continuita' d'uso del tool mentre procede il refactor
- [ ] confermare che il progetto resta usabile mentre procede il refactor
- [ ] aprire issue board o milestone board minima con priorita' e dipendenze
- [ ] creare un branch dedicato al refactor strutturale
- [ ] censire segreti attuali e programmare rotazione di quelli piu' esposti
- [ ] introdurre rotazione periodica dei segreti come attivita' ricorrente

### Fotografia ambiente attuale

- [ ] fotografare la configurazione attuale della VPS
- [ ] esportare backup di:
  - file env
  - database SQLite
  - unita' `systemd` o configurazione Docker attuale
- [ ] definire una checklist di rollback
- [ ] verificare dove stanno girando oggi bot, env file, dati runtime e log
- [ ] verificare se esiste gia' un ambiente staging o almeno una preview testabile
- [ ] se staging manca, decidere un'alternativa minima per prove pre-release

## Fase 1 - Hardening e Aggiornamenti VPS [Priorita' alta]

### Sistema

- [ ] aggiornare sistema operativo e pacchetti di sicurezza
- [ ] verificare versione Python installata e coerente con il progetto
- [ ] verificare spazio disco, swap, memoria e utilizzo CPU
- [ ] verificare timezone, NTP e sincronizzazione oraria

### Sicurezza

- [ ] confermare accesso SSH solo con chiave
- [ ] disabilitare login password se non serve
- [ ] disabilitare login root diretto
- [ ] configurare firewall con sole porte necessarie
- [ ] valutare `fail2ban`
- [ ] verificare permessi dei file con segreti
- [ ] usare utente di servizio dedicato per il bot
- [ ] pianificare runbook minimo per rotazione segreti e ripristino credenziali

### Esecuzione servizio

- [ ] migliorare affidabilita' del deploy e dell'esecuzione sulla VPS
- [ ] evitare doppie modalita' di deploy non allineate
- [ ] definire restart policy chiara
- [ ] definire directory runtime dedicate
- [ ] impostare log standardizzati
- [ ] decidere se mantenere o no Docker Compose come opzione reale di esercizio

### Backup e recovery

- [ ] backup automatico giornaliero del database
- [ ] backup dell'env file
- [ ] retention minima dei backup
- [ ] prova di restore su file separato
- [ ] mini runbook di recovery

## Fase 2 - Rifondazione Strutturale del Codice [Priorita' alta]

### Nuova struttura proposta

Struttura introdotta:

- `src/ebay_cf/cli.py`
- `src/ebay_cf/bot.py`
- `src/ebay_cf/config.py`
- `src/ebay_cf/models.py`
- `src/ebay_cf/clients/ebay.py`
- `src/ebay_cf/clients/telegram.py`
- `src/ebay_cf/services/orders.py`
- `src/ebay_cf/storage/sqlite.py`

### Refactor tecnico

- [ ] separare meglio responsabilita' applicative e operative tra CLI, bot, servizi, client e storage
- [ ] ridurre fragilita' e duplicazioni ancora presenti nel codice
- [ ] ridurre l'accorpamento di responsabilita' rimasto nei flussi CLI e bot
- [ ] eliminare i punti in cui la logica applicativa dipende ancora da import diretti fra entrypoint
- [ ] creare modelli tipizzati per:
  - ordine eBay normalizzato
  - stato notifica
  - utente Telegram
  - account eBay collegato
- [ ] sostituire in modo sistematico i `Dict[str, str]` residui con dataclass o modelli equivalenti
- [ ] centralizzare retry, backoff e classificazione errori eBay/Telegram in componenti condivisi
- [ ] definire eccezioni applicative piu' chiare
- [ ] separare rendering output da raccolta dati
- [ ] ridurre l'uso di stato globale locale nel polling e nella notifica
- [ ] risolvere i dettagli di naming fuorvianti rimasti nelle API interne
- [ ] aggiungere `ADR` leggere per le decisioni architetturali importanti

### Quality gate e release

- [ ] documentare il percorso di refactor e le decisioni senza bloccare l'uso attuale del progetto
- [ ] mantenere test, CI, mypy e coverage allineati con ogni refactor
- [ ] introdurre `CHANGELOG.md` per le modifiche rilevanti
- [ ] verificare se serve un controllo packaging o release process piu' esplicito

## Fase 4 - Operativita' e Osservabilita' [Priorita' media]

### Logging e contesto operativo

- [ ] portare il progetto a un livello di osservabilita' e sicurezza adeguato a un servizio pubblico
- [ ] completare il contesto nei log con correlation id o identificativi equivalenti per operazioni, ordini e chat
- [ ] standardizzare definitivamente eventi log per start, stop, polling, retry, errori e health check

### Metriche e controlli runtime

- [ ] misurare:
  - ordini letti
  - ordini con CF
  - notifiche inviate
  - retry Telegram
  - errori eBay
  - errori Telegram
- [ ] decidere dove esporre o raccogliere queste metriche
- [ ] introdurre alert basilari su processo fermo e su troppi errori consecutivi
- [ ] documentare troubleshooting operativo per `healthcheck`, `retry_queue`, `last_check` stale e fallimenti deploy
- [ ] mantenere smoke test post-deploy come controllo obbligatorio dopo ogni rilascio significativo

## Fase 5 - Progettazione Multiutente [Priorita' media]

### Target di prodotto

- [ ] raggiungere supporto multiutente reale
- [ ] ogni utente Telegram deve poter collegare il proprio account eBay
- [ ] ogni utente deve vedere solo i propri ordini e le proprie notifiche
- [ ] piu' utenti devono poter convivere sullo stesso bot
- [ ] le credenziali eBay non devono stare in env globali condivise
- [ ] l'onboarding deve essere il piu' possibile self-service

### Lavori tecnici necessari

- [ ] passare da single-tenant a multi-tenant
- [ ] introdurre tabella utenti
- [ ] introdurre tabella account eBay collegati
- [ ] introdurre tabella token eBay per utente
- [ ] introdurre tabella subscription/notifiche
- [ ] introdurre isolamento dati e scoping per `telegram_chat_id`
- [ ] introdurre scheduler che processa per tenant

### Decisioni architetturali e vincoli

- [ ] trattare il passaggio a bot pubblico multiutente come cambio di natura del progetto: da utility personale a servizio con requisiti di sicurezza, privacy e affidabilita'
- [ ] collegare la progettazione multiutente ai finding audit su single-tenant, variabili ambiente globali e stato condiviso
- [ ] valutare migrazione da SQLite a Postgres prima della multiutenza pubblica
- [ ] cifrare a riposo refresh token eBay
- [ ] gestire revoca, refresh e scadenza token per utente
- [ ] introdurre rate limiting per utente
- [ ] introdurre audit log minimo per collegamento/disconnessione account
- [ ] prima di aprire il bot a terzi, trattare credenziali, persistence e osservabilita' come componenti di prodotto e non come dettagli accessori
- [ ] verificare se la VPS attuale resta sufficiente per la fase privata o se servono gia':
  - database gestito o ben amministrato
  - backup seri
  - alerting
  - processo di deploy piu' sicuro
- [ ] preparare una security review dedicata ai token utente
- [ ] fissare milestone di beta privata prima dell'apertura piu' ampia

## Fase 6 - Onboarding Self-Service Telegram + eBay OAuth [Priorita' media]

### Esperienza target utente

- [ ] rendere disponibile onboarding self-service da Telegram
- [ ] permettere il collegamento del proprio account eBay con OAuth per singolo utente
- [ ] utente apre il bot e fa `/start`
- [ ] il bot presenta un pulsante "Collega account eBay"
- [ ] il pulsante apre una pagina web sicura con OAuth eBay
- [ ] l'utente autorizza il proprio account venditore
- [ ] il backend salva token e associazione con l'utente Telegram
- [ ] il bot conferma collegamento riuscito
- [ ] l'utente puo' configurare notifiche e comandi personali

### Componenti implementativi

- [ ] mini web app o callback server per OAuth
- [ ] gestione `state` anti-CSRF
- [ ] storage sicuro dei token
- [ ] mapping sicuro tra sessione OAuth e utente Telegram
- [ ] pagina di successo/fallimento leggibile
- [ ] comando `/disconnect` per scollegare l'account
- [ ] comando `/whoami` o `/account` per vedere stato collegamento
- [ ] disegnare in dettaglio il flusso Telegram -> web -> eBay prima dell'implementazione

### Comandi da introdurre

- [ ] `/connect`
- [ ] `/disconnect`
- [ ] `/account`
- [ ] `/notifications on`
- [ ] `/notifications off`
- [ ] `/settings`

## Fase 7 - Governance del Prodotto [Priorita' media]

- [ ] definire governance e limiti del servizio in modo compatibile con isolamento dati tra utenti
- [ ] definire quali dati personali vengono trattati
- [ ] scrivere informativa minima d'uso e retention
- [ ] definire retention dei log
- [ ] definire retention dei token e dati ordini
- [ ] chiarire policy di cancellazione utente
- [ ] definire limiti del servizio e carichi supportati

## Prossimi Step Immediati

- [ ] completare backup, audit VPS e standard di esecuzione del servizio
- [ ] finire la rifondazione tecnica residua su modelli, retry condivisi e riduzione stato globale
- [ ] chiudere osservabilita' minima con metriche leggibili, alert basilari e runbook
- [ ] preparare milestone di progettazione multiutente con database, token e flusso OAuth definiti
