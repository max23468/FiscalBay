# Checklist

Questo documento unisce tre cose:

- audit tecnico dello stato attuale
- piano strutturale di miglioramento
- checklist operativa per progetto e VPS

L'obiettivo non e' solo "ripulire il codice", ma trasformare il tool in un servizio piu' affidabile, manutenibile e pronto a evolvere verso un bot Telegram multiutente, dove ogni utente puo' collegare il proprio account venditore eBay.

## Obiettivi

### Obiettivi immediati

- ridurre fragilita' e duplicazioni
- migliorare affidabilita' del deploy sulla VPS
- separare meglio responsabilita' applicative e operative
- documentare un percorso di refactor senza bloccare l'uso attuale

### Obiettivi futuri

- supporto multiutente reale
- onboarding self-service da Telegram
- collegamento del proprio account eBay con OAuth per singolo utente
- isolamento dati tra utenti
- osservabilita' e sicurezza adatte a un servizio pubblico

## Audit Tecnico

### Findings principali

- [ ] `Alta` Le responsabilita' sono molto accorpate in pochi file monolitici.
  Evidenza: [src/ebay_cf_tool.py](/Users/Matteo/Documents/eBay%20CF/src/ebay_cf_tool.py#L154) contiene parsing CLI, config, HTTP client eBay, logica dominio, serializzazione output. [src/telegram_bot.py](/Users/Matteo/Documents/eBay%20CF/src/telegram_bot.py#L106) contiene config, client Telegram, command handling, persistence SQLite, scheduler polling e notifica.

- [ ] `Alta` La logica applicativa e' condivisa tramite import diretti fra entrypoint, invece che tramite un layer di servizio dedicato.
  Evidenza: [src/telegram_bot.py](/Users/Matteo/Documents/eBay%20CF/src/telegram_bot.py#L29) importa direttamente `FetchOptions`, `fetch_records`, `load_config` dal modulo CLI.

- [ ] `Alta` Il modello dati e' implicito e basato quasi ovunque su `Dict[str, str]`, con rischio di errori silenziosi e forte accoppiamento su chiavi stringa.
  Evidenza: [src/ebay_cf_tool.py](/Users/Matteo/Documents/eBay%20CF/src/ebay_cf_tool.py#L397), [src/telegram_bot.py](/Users/Matteo/Documents/eBay%20CF/src/telegram_bot.py#L262), [src/telegram_bot.py](/Users/Matteo/Documents/eBay%20CF/src/telegram_bot.py#L670).

- [ ] `Alta` La persistenza SQLite e' molto primitiva: niente migration, nessun vincolo, salvataggi distruttivi completi e schema non versionato.
  Evidenza: [src/telegram_bot.py](/Users/Matteo/Documents/eBay%20CF/src/telegram_bot.py#L484), [src/telegram_bot.py](/Users/Matteo/Documents/eBay%20CF/src/telegram_bot.py#L512), [src/telegram_bot.py](/Users/Matteo/Documents/eBay%20CF/src/telegram_bot.py#L544).

- [ ] `Alta` Il design attuale e' single-tenant per definizione: una sola configurazione eBay, una sola configurazione Telegram, stato globale condiviso.
  Evidenza: [src/ebay_cf_tool.py](/Users/Matteo/Documents/eBay%20CF/src/ebay_cf_tool.py#L217), [src/telegram_bot.py](/Users/Matteo/Documents/eBay%20CF/src/telegram_bot.py#L106), [src/telegram_bot.py](/Users/Matteo/Documents/eBay%20CF/src/telegram_bot.py#L695).

- [ ] `Alta` La futura evoluzione multiutente non puo' basarsi sulle variabili ambiente attuali: servira' un vero datastore per utenti, credenziali e autorizzazioni.

- [ ] `Media` Retry, backoff ed error handling sono duplicati tra eBay e Telegram con implementazioni simili ma separate.
  Evidenza: [src/ebay_cf_tool.py](/Users/Matteo/Documents/eBay%20CF/src/ebay_cf_tool.py#L79), [src/ebay_cf_tool.py](/Users/Matteo/Documents/eBay%20CF/src/ebay_cf_tool.py#L126), [src/telegram_bot.py](/Users/Matteo/Documents/eBay%20CF/src/telegram_bot.py#L79), [src/telegram_bot.py](/Users/Matteo/Documents/eBay%20CF/src/telegram_bot.py#L179), [src/telegram_bot.py](/Users/Matteo/Documents/eBay%20CF/src/telegram_bot.py#L226).

- [ ] `Media` La logica di polling e notifica usa thread e stato globale locale, sufficiente oggi ma poco robusta per crescita, deploy multipli o piu' worker.
  Evidenza: [src/telegram_bot.py](/Users/Matteo/Documents/eBay%20CF/src/telegram_bot.py#L56), [src/telegram_bot.py](/Users/Matteo/Documents/eBay%20CF/src/telegram_bot.py#L729).

- [ ] `Media` Manca un package Python piu' strutturato; oggi il progetto e' composto da due moduli top-level con responsabilita' trasversali.
  Evidenza: [pyproject.toml](/Users/Matteo/Documents/eBay%20CF/pyproject.toml#L21) e [pyproject.toml](/Users/Matteo/Documents/eBay%20CF/pyproject.toml#L24).

- [ ] `Media` I test coprono bene alcune utility ma non coprono flussi integrati, schema storage, bootstrap del bot, deploy e recovery.

- [ ] `Media` Docker e compose sono minimali: manca healthcheck, non c'e' gestione esplicita dei secret, manca utente non-root, manca strategia di aggiornamento.
  Evidenza: [Dockerfile](/Users/Matteo/Documents/eBay%20CF/Dockerfile#L1), [Dockerfile](/Users/Matteo/Documents/eBay%20CF/Dockerfile#L25), [docker-compose.yml](/Users/Matteo/Documents/eBay%20CF/docker-compose.yml#L3).

- [ ] `Bassa` Ci sono dettagli di naming che aumentano confusione.
  Esempio: `mint_user_access_token()` richiama `get_access_token()` invece di essere il primitivo effettivo, creando un naming fuorviante. Evidenza: [src/ebay_cf_tool.py](/Users/Matteo/Documents/eBay%20CF/src/ebay_cf_tool.py#L292).

### Conclusione audit

Il progetto oggi e' funzionante ma fragile per crescita. La criticita' maggiore non e' il singolo bug: e' il fatto che codice operativo, integrazione API, persistenza, command handling e comportamento di runtime sono troppo mescolati. Se continuiamo ad aggiungere feature senza refactor, il costo di ogni modifica salira' rapidamente.

## Strategia Complessiva

Ordine consigliato:

1. stabilizzazione minima
2. hardening VPS
3. refactor architetturale senza cambiare comportamento
4. osservabilita' e deploy piu' sicuri
5. progettazione multiutente
6. implementazione onboarding utenti eBay

## Checklist Esecutiva

## Fase 0 - Baseline e Sicurezza Immediata

- [ ] creare un branch dedicato al refactor strutturale
- [ ] fotografare la configurazione attuale della VPS
- [ ] esportare backup di:
  - file env
  - database SQLite
  - unita' `systemd` o configurazione Docker attuale
- [ ] definire una checklist di rollback
- [ ] verificare dove stanno girando oggi bot, env file, dati runtime e log
- [ ] censire segreti attuali e programmare rotazione di quelli piu' esposti

## Fase 1 - Hardening e Aggiornamenti VPS

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

### Esecuzione servizio

- [ ] decidere standard operativo unico:
  - `systemd` nativo
  - oppure Docker Compose
- [ ] evitare doppie modalita' di deploy non allineate
- [ ] definire restart policy chiara
- [ ] definire directory runtime dedicate
- [ ] impostare log standardizzati
- [ ] documentare avvio, stop, restart e status

### Backup e recovery

- [ ] backup automatico giornaliero del database
- [ ] backup dell'env file
- [ ] retention minima dei backup
- [ ] prova di restore su file separato
- [ ] mini runbook di recovery

## Fase 2 - Rifondazione Strutturale del Codice

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

- [ ] creare modelli tipizzati per:
  - ordine eBay normalizzato
  - stato notifica
  - utente Telegram
  - account eBay collegato
- [ ] sostituire in modo sistematico i `Dict[str, str]` residui con dataclass o modelli equivalenti
- [ ] centralizzare retry, backoff e classificazione errori
- [ ] definire eccezioni applicative piu' chiare
- [ ] separare rendering output da raccolta dati

## Fase 4 - Operativita' e Osservabilita'

- [ ] definire log strutturati coerenti
- [ ] aggiungere correlation id o almeno contesto operazione nei log
- [ ] misurare:
  - ordini letti
  - ordini con CF
  - notifiche inviate
  - retry Telegram
  - errori eBay
  - errori Telegram
- [ ] creare comando o endpoint di health check
- [ ] introdurre alert basilari su processo fermo e su troppi errori consecutivi
- [ ] documentare metriche e troubleshooting operativo

## Fase 5 - Progettazione Multiutente

Questa e' la svolta piu' importante per il futuro del progetto.

### Requisiti target

- [ ] ogni utente Telegram deve poter collegare il proprio account eBay
- [ ] ogni utente deve vedere solo i propri ordini e le proprie notifiche
- [ ] piu' utenti devono poter convivere sullo stesso bot
- [ ] le credenziali eBay non devono stare in env globali condivise
- [ ] l'onboarding deve essere il piu' possibile self-service

### Implicazioni architetturali

- [ ] passare da single-tenant a multi-tenant
- [ ] introdurre tabella utenti
- [ ] introdurre tabella account eBay collegati
- [ ] introdurre tabella token eBay per utente
- [ ] introdurre tabella subscription/notifiche
- [ ] introdurre isolamento dati e scoping per `telegram_chat_id`
- [ ] introdurre scheduler che processa per tenant

### Scelte tecniche consigliate

- [ ] valutare migrazione da SQLite a Postgres prima della multiutenza pubblica
- [ ] cifrare a riposo refresh token eBay
- [ ] gestire revoca, refresh e scadenza token per utente
- [ ] introdurre rate limiting per utente
- [ ] introdurre audit log minimo per collegamento/disconnessione account

## Fase 6 - Onboarding Self-Service Telegram + eBay OAuth

### Flusso ideale

- [ ] utente apre il bot e fa `/start`
- [ ] il bot presenta un pulsante "Collega account eBay"
- [ ] il pulsante apre una pagina web sicura con OAuth eBay
- [ ] l'utente autorizza il proprio account venditore
- [ ] il backend salva token e associazione con l'utente Telegram
- [ ] il bot conferma collegamento riuscito
- [ ] l'utente puo' configurare notifiche e comandi personali

### Componenti necessari

- [ ] mini web app o callback server per OAuth
- [ ] gestione `state` anti-CSRF
- [ ] storage sicuro dei token
- [ ] mapping sicuro tra sessione OAuth e utente Telegram
- [ ] pagina di successo/fallimento leggibile
- [ ] comando `/disconnect` per scollegare l'account
- [ ] comando `/whoami` o `/account` per vedere stato collegamento

### Nuovi comandi consigliati

- [ ] `/connect`
- [ ] `/disconnect`
- [ ] `/account`
- [ ] `/notifications on`
- [ ] `/notifications off`
- [ ] `/settings`

## Fase 7 - Governance del Prodotto

- [ ] definire quali dati personali vengono trattati
- [ ] scrivere informativa minima d'uso e retention
- [ ] definire retention dei log
- [ ] definire retention dei token e dati ordini
- [ ] chiarire policy di cancellazione utente
- [ ] definire limiti del servizio e carichi supportati

## Suggerimenti Extra

Oltre al refactor e alla VPS, suggerisco di aggiungere anche questi elementi:

- [ ] `ADR` leggere per le decisioni importanti
- [ ] `RUNBOOK.md` per avvio, deploy, debug e rollback
- [ ] `CHANGELOG.md`
- [ ] ambiente staging o almeno preview di test
- [ ] smoke test post-deploy
- [ ] rotazione periodica segreti
- [ ] issue board con priorita' per milestone

## Priorita' Consigliata

### Sprint 1

- [ ] backup e audit VPS
- [ ] hardening base VPS
- [ ] standardizzare il modo di eseguire il servizio

### Sprint 2

- [ ] rifare storage e schema
- [ ] migliorare test e CI
- [ ] aggiungere logging e health check
- [ ] documentare deploy e recovery

### Sprint 3

- [ ] progettazione dettagliata multiutente
- [ ] scelta database definitiva
- [ ] disegno flusso OAuth Telegram -> web -> eBay
- [ ] security review dei token utente

### Sprint 4

- [ ] implementazione onboarding self-service
- [ ] isolamento tenant
- [ ] notifiche per account collegato
- [ ] beta privata con pochi utenti reali

## Note Operative Importanti

- Il bot pubblico multiutente cambia la natura del progetto: da utility personale a servizio con responsabilita' di sicurezza, privacy e affidabilita'.
- Prima di aprirlo a terzi, conviene trattare credenziali, persistence e osservabilita' come componenti di prodotto, non come dettagli accessori.
- Se la VPS attuale e' piccola ma stabile, puo' bastare per le prime fasi. Per multiutenza pubblica e' probabile che servano almeno:
  - database gestito o ben amministrato
  - backup seri
  - alerting
  - processo di deploy piu' sicuro
