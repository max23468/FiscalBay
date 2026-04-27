# FiscalBay

FiscalBay e' un tool operativo con CLI e bot Telegram per leggere gli ordini eBay e mostrare l'identificativo fiscale restituito dalle API ufficiali eBay, inclusi casi come `CODICE_FISCALE` e `VAT_NUMBER`.

Payoff: `Assistente fiscale ordini per venditori eBay`.

Linee guida brand e asset pronti all'uso: [`docs/BRAND_GUIDELINES.md`](docs/BRAND_GUIDELINES.md), `assets/branding/*`.
Set definitivo approvato: logo orizzontale, mark e avatar Telegram nel concept `Seller Card`.
Export operativi pronti: `assets/branding/exports/fiscalbay-avatar-telegram-512.png`, `fiscalbay-mark-512.png`, `fiscalbay-logo-light-2048.png`, `fiscalbay-logo-dark-2048.png`.

Il progetto nasce per un caso pratico molto preciso: interrogare gli ordini recenti, leggere il dettaglio completo di ogni ordine e rendere consultabile da terminale o da Telegram il contenuto di `buyer.taxIdentifier`.

## Panoramica

Il repository contiene due entry point:

- `fiscalbay`: utility CLI per leggere ordini e stampare i risultati in tabella, JSON o CSV
- `fiscalbay-bot`: bot Telegram con comandi interattivi e notifiche automatiche dei nuovi ordini
- `fiscalbay-oauth-server`: callback server minimale per l'onboarding self-service Telegram + eBay OAuth
- `fiscalbay-reconcile`: worker one-shot per reconciliation periodica e coda operativa

Funzionalità principali:

- autenticazione OAuth eBay tramite `refresh_token`
- cache in memoria del token per ridurre chiamate a `/identity/v1/oauth2/token`
- recupero ordini con `getOrders` e dettaglio con `getOrder`
- estrazione del campo `buyer.taxIdentifier.taxpayerId`
- indicazione del tipo di identificativo fiscale, ad esempio `CODICE_FISCALE` o `VAT_NUMBER`
- output CLI in `table`, `json` o `csv`
- retry con backoff esponenziale per errori transitori eBay e Telegram
- polling continuo dei nuovi ordini con notifiche Telegram automatiche
- persistenza locale dello stato del bot in SQLite

## Limite Importante

Il progetto mostra solo ciò che eBay restituisce davvero. Se `buyer.taxIdentifier` non è presente nella risposta dell'ordine, il tool non può ricostruire o dedurre l'identificativo fiscale in altro modo.

In pratica:

- se eBay espone il dato, il tool lo mostra
- se eBay non espone il dato, il tool segnala che non è disponibile

## Requisiti

- Python 3.10 o superiore
- credenziali eBay valide:
  - `EBAY_CLIENT_ID`
  - `EBAY_CLIENT_SECRET`
  - `EBAY_REFRESH_TOKEN`
- per il bot: un token Telegram Bot API

## Integrazione GitHub (solo maintainer)

Per mantenere il repository allineato alle best practice GitHub anche in contesto single-maintainer, il progetto include:

- workflow CI manuale (`.github/workflows/ci.yml`) per contenere il consumo GitHub Actions
- deploy verso VPS via GitHub Actions solo manuale e solo su richiesta esplicita del maintainer (`.github/workflows/deploy-vps.yml`)
- release PR con `release-please`, automatiche solo per cambi rilevanti al runtime/package e sempre avviabili manualmente (`.github/workflows/release-please.yml`)
- build e upload automatico degli artefatti nella GitHub Release creata da `release-please`
- rebuild manuale degli artefatti per un tag esistente (`.github/workflows/release.yml`)
- aggiornamenti automatici dipendenze con Dependabot (`.github/dependabot.yml`)
- template per Pull Request (`.github/PULL_REQUEST_TEMPLATE.md`)
- issue forms per bug e task operativi (`.github/ISSUE_TEMPLATE/*`)
- `CODEOWNERS` per ownership esplicita (`.github/CODEOWNERS`)
- security policy riconosciuta dalla Security tab (`SECURITY.md`)
- guida operativa GitHub per le impostazioni da completare nella UI (`docs/GITHUB_MAINTENANCE.md`)

Passi consigliati dopo il clone/fork:

1. verifica branch protection su `main` (almeno: linear history; CI come gate manuale quando serve contenere i minuti Actions)
2. abilita secret scanning e Dependabot alerts dal tab Security
3. usa PR anche da branch personali per lasciare audit trail e checklist standard
4. usa titoli PR di squash in formato Conventional Commit per tenere coerenti versioni e changelog
5. in GitHub abilita `Squash merge` e valuta di disabilitare `Merge commit` e `Rebase merge` per rendere il flusso piu' coerente

Per usare Codex su `chatgpt.com` come postazione di lavoro e, solo quando richiesto esplicitamente, come ponte di deploy GitHub Actions, vedi [`docs/CODEX_CLOUD_DEPLOY.md`](docs/CODEX_CLOUD_DEPLOY.md).

Il flusso consigliato da remoto e:

- Codex o GitHub preparano il codice fino a `main`
- il deploy resta manuale sulla VPS tramite SSH e script versionati
- GitHub Actions non esegue deploy automatici su push
- il workflow `Deploy VPS` va lanciato solo quando il maintainer chiede esplicitamente di fare il deploy con GitHub Actions

In pratica, da Codex web/mobile ti basta:

- aprire il repository GitHub `max23468/FiscalBay`
- lavorare su branch o su `main`
- fermarti al codice e alla verifica, salvo richiesta esplicita di deploy via GitHub Actions

## Versioni e changelog

Il repository usa Semantic Versioning con tag GitHub nel formato `vX.Y.Z`.

Regola operativa minima:

- su `main` non fare bump manuali di versione, tag manuali o release manuali nel flusso normale; il bump lo decide sempre `release-please` a partire dal tipo di commit (`feat`, `fix`, `perf`, `!`)

- `PATCH` per bugfix compatibili, ad esempio `v0.1.1`
- `MINOR` per nuove funzionalita' compatibili, ad esempio `v0.2.0`
- `MAJOR` per breaking change, ad esempio `v1.0.0`

Il flusso e' allineato a GitHub:

- i merge su `main` aggiornano automaticamente una Release PR solo quando toccano file rilevanti per runtime/package; negli altri casi `Release Please` resta avviabile manualmente
- `PR Title` gira automaticamente sulla Release PR; `CI` e' manuale per ridurre il consumo Actions
- il workflow `Auto Merge Release PR` la chiude automaticamente solo dopo una `CI` manuale riuscita sulla branch `release-please--*` e con `PR Title` verde
- per evitare il limite `Resource not accessible by integration` sulla pubblicazione finale, configura il secret repository `RELEASE_PLEASE_TOKEN`; senza secret i workflow ripiegano su `GITHUB_TOKEN`, ma la creazione della GitHub Release puo' fallire
- la Release PR aggiorna `CHANGELOG.md` e la versione in `pyproject.toml`
- il merge della Release PR crea tag, GitHub Release e allega automaticamente gli artefatti buildati
- se serve, il workflow `Release Assets` permette di rigenerare manualmente gli artefatti per un tag esistente

Per i dettagli operativi e le policy di naming/bump vedere `docs/RELEASE_POLICY.md`.

## Setup Rapido

### 1. Installa il progetto

```bash
python3 -m pip install .
```

Per sviluppo locale puoi anche usare:

```bash
python3 -m pip install -e .[dev]
```

### 2. Esporta le variabili minime

```bash
export EBAY_CLIENT_ID="..."
export EBAY_CLIENT_SECRET="..."
export EBAY_REFRESH_TOKEN="..."
export EBAY_ENVIRONMENT="production"
export EBAY_SCOPES="https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly"
```

Per il bot Telegram aggiungi:

```bash
export TELEGRAM_BOT_TOKEN="..."
export TELEGRAM_ALLOWED_CHAT_IDS="123456789"
export TELEGRAM_NOTIFY_CHAT_IDS="123456789"
```

### 3. Prova la CLI

```bash
fiscalbay --only-found
```

### 4. Avvia il bot

```bash
fiscalbay-bot
```

## Architettura

### Flusso CLI

1. carica la configurazione da variabili ambiente
2. ottiene un access token eBay dal `refresh_token`
3. legge gli ordini recenti con `getOrders`
4. recupera il dettaglio completo di ogni ordine con `getOrder`
5. estrae i campi fiscali e i principali metadati dell'ordine
6. stampa il risultato o lo salva su file

### Flusso Bot Telegram

1. valida la configurazione
2. abilita il long polling Telegram
3. prende un lock locale per evitare due istanze concorrenti sullo stesso token
4. avvia un thread che controlla periodicamente i nuovi ordini
5. risponde ai comandi ricevuti in chat
6. salva lo stato locale in SQLite per evitare duplicati e ritentare eventuali invii falliti

## Configurazione

### Variabili eBay

| Variabile | Obbligatoria | Default | Descrizione |
| --- | --- | --- | --- |
| `EBAY_CLIENT_ID` | Sì | - | Client ID dell'app eBay |
| `EBAY_CLIENT_SECRET` | Sì | - | Client secret dell'app eBay |
| `EBAY_REFRESH_TOKEN` | Sì | - | Refresh token OAuth eBay |
| `EBAY_ENVIRONMENT` | No | `production` | Ambiente eBay: `production` o `sandbox` |
| `EBAY_SCOPES` | No | `sell.fulfillment.readonly` | Scope OAuth richiesto |
| `EBAY_HTTP_MAX_RETRIES` | No | `5` | Numero massimo retry per chiamate eBay |
| `EBAY_HTTP_RETRY_BASE_DELAY` | No | `0.5` | Delay base del backoff eBay |
| `EBAY_TOKEN_SKEW_SECONDS` | No | `60` | Margine di sicurezza sulla scadenza token |
| `EBAY_ORDER_DETAIL_DELAY_SECONDS` | No | `0` | Pausa tra chiamate `getOrder` |
| `EBAY_OAUTH_RUNAME` | Consigliata per OAuth production | vuoto | RuName eBay usato come `redirect_uri` nel flusso OAuth production |
| `EBAY_OAUTH_RUNAME_SANDBOX` | No | fallback a `EBAY_OAUTH_RUNAME` | RuName eBay dedicato al sandbox, se diverso dalla production |
| `EBAY_OAUTH_CONNECT_BASE_URL` | No | vuoto | URL pubblico usato da `/connect` per aprire il flusso OAuth |
| `EBAY_OAUTH_CALLBACK_URL` | No | derivato da `EBAY_OAUTH_CONNECT_BASE_URL` | URL pubblico di callback esposto dal progetto; deve coincidere con l'Accept URL configurato nel RuName eBay |
| `EBAY_OAUTH_SERVER_HOST` | No | `127.0.0.1` | Host di bind del callback server |
| `EBAY_OAUTH_SERVER_PORT` | No | `8787` | Porta locale del callback server |
| `EBAY_TENANT_TOKEN_KEY` | Consigliata per OAuth multiutente | vuoto | Chiave Fernet usata per cifrare i refresh token tenant a riposo |
| `EBAY_ENABLE_PLAINTEXT_TENANT_TOKENS` | No | vuoto | Opt-in solo dev o recovery controllato per salvare il refresh token tenant in formato `plain:` |
| `LOG_LEVEL` | No | `WARNING` per CLI, `INFO` per bot se impostato così | Livello log |

Nota OAuth eBay:

- il parametro `redirect_uri` inviato a eBay non e' una URL libera, ma il `RuName` registrato nel portale developer eBay
- `EBAY_OAUTH_CALLBACK_URL` serve invece al progetto per esporre il callback pubblico che deve essere associato a quel `RuName`
- sulla VPS, per avere `/connect` davvero usabile, vanno quindi configurati sia il `RuName` corretto sia l'URL pubblico raggiungibile del callback server
- lo stesso server OAuth espone anche `/` come mini sito vetrina, `/privacy` come Privacy Policy URL e `/about` come About URL nel branding OAuth del portale eBay
- il flusso `/connect` avviato da Telegram aggiunge al consenso anche lo scope pubblico `commerce.identity.readonly`, usato per leggere un identificativo account eBay reale invece del placeholder locale
- `EBAY_SCOPES` deve restare coerente con gli scope concessi al refresh token globale; non aggiungere scope non presenti nel token gia' emesso

### Variabili Telegram

| Variabile | Obbligatoria | Default | Descrizione |
| --- | --- | --- | --- |
| `TELEGRAM_BOT_TOKEN` | Sì per il bot | - | Token del bot Telegram |
| `TELEGRAM_ADMIN_USER_ID` | Consigliata | vuoto | Se valorizzata, questo utente Telegram diventa admin globale e approva l'accesso degli altri utenti |
| `TELEGRAM_ALLOWED_CHAT_IDS` | **Sì** | vuoto (deny-all) | Chat autorizzate, separate da virgola. Usa `*` (o `all`) per accettare tutte le chat e demandare il filtro al workflow di approvazione admin |
| `TELEGRAM_NOTIFY_CHAT_IDS` | Consigliata | stessi valori di `TELEGRAM_ALLOWED_CHAT_IDS` | Chat che ricevono notifiche automatiche |
| `TELEGRAM_POLL_TIMEOUT` | No | `30` | Timeout long polling Telegram |
| `TELEGRAM_SYNC_BRANDING` | No | `1` | Se attiva, sincronizza nome, descrizione e menu comandi Telegram quando il profilo cambia; in caso di rate limit applica un backoff automatico |
| `TELEGRAM_BOT_LOCK_PATH` | No | `data/telegram_bot.lock` | File lock del processo |
| `EBAY_ORDER_POLL_INTERVAL` | No | `120` | Intervallo polling nuovi ordini |
| `EBAY_ORDER_STATE_PATH` | No | `data/state.db` | File SQLite per stato e metriche |
| `EBAY_NOTIFY_RETRY_PATH` | No | `data/state.db` | File SQLite per coda retry; di default coincide con lo state DB |
| `TELEGRAM_HTTP_MAX_RETRIES` | No | `5` | Numero massimo retry per Telegram |
| `TELEGRAM_HTTP_RETRY_BASE_DELAY` | No | `0.5` | Delay base del backoff Telegram |

## Utilizzo CLI

### Ordini recenti

```bash
fiscalbay
```

Equivale a leggere gli ordini degli ultimi 7 giorni.

### Solo ordini con identificativo fiscale presente

```bash
fiscalbay --only-found
```

### Ordine specifico

```bash
fiscalbay --order-id "12-34567-89012"
```

Puoi ripetere `--order-id` più volte.

### Finestra temporale esplicita

```bash
fiscalbay \
  --created-after "2026-04-01T00:00:00Z" \
  --created-before "2026-04-03T23:59:59Z"
```

### Esportazione CSV

```bash
fiscalbay --format csv --output risultati.csv
```

### Esportazione JSON

```bash
fiscalbay --format json --output risultati.json
```

### Esecuzione senza installazione

```bash
PYTHONPATH=src python3 -m fiscalbay.cli --help
PYTHONPATH=src python3 -m fiscalbay.bot
```

### Utility operativa Git

Se Git resta bloccato da un `index.lock` rimasto sporco, puoi usare:

```bash
fiscalbay-fix-git-lock
```

Il comando rimuove il lock solo se non risulta piu' detenuto da un processo attivo.

Per rendere piu' robusti i comandi Git locali del progetto puoi anche usare:

```bash
fiscalbay-git-safe -- commit -m "messaggio"
fiscalbay-git-safe -- push origin main
```

Questo wrapper:

- aspetta per pochi secondi se il lock e' davvero detenuto da un processo attivo
- rimuove automaticamente solo i lock stale
- poi esegue il comando Git richiesto

### Health Check

Per verificare rapidamente se il bot sembra sano lato runtime puoi usare:

```bash
fiscalbay-healthcheck
```

Oppure in JSON:

```bash
fiscalbay-healthcheck --json
```

Il controllo verifica almeno:

- presenza del lock del bot
- freschezza di `last_check`
- dimensione della retry queue
- eventuale ultimo errore registrato

Per riallineare periodicamente accessi, sessioni OAuth stale e queue operativa puoi usare:

```bash
fiscalbay-reconcile
```

Oppure in JSON:

```bash
fiscalbay-reconcile --json
```

## Campi Restituiti

I record prodotti dalla CLI includono:

- `orderId`
- `creationDate`
- `buyerUsername`
- `buyerName`
- `taxpayerId`
- `taxIdentifierType`
- `issuingCountry`
- `found`
- `items`
- `total`
- `shippingAddress`

`found` vale `yes` quando `taxpayerId` è presente, altrimenti `no`.

## Bot Telegram

### Comandi disponibili

- `/start`
- `/help`
- `/ping`
- `/stato`
- `/account`
- `/connect`
- `/disconnect`
- `/request_access`
- `/notifications on`
- `/notifications off`
- `/settings`
- `/users`
- `/ultimi 7 20`
- `/tutti 7 20`
- `/ordine 12-34567-89012`

Regole input:

- giorni ammessi: da `1` a `365`
- massimo ordini: da `1` a `500`
- se i parametri sono omessi, il bot usa `7` giorni e `20` risultati

Comportamento:

- `/ultimi` mostra solo ordini con identificativo fiscale presente
- `/tutti` mostra anche ordini senza dato fiscale
- `/ordine` interroga un ordine specifico
- `/stato` mostra ultimo check, contatori e dimensione della coda retry
- `/start` e `/help` mostrano anche una tastiera inline con scorciatoie
- se `TELEGRAM_ADMIN_USER_ID` e' configurata, gli utenti non ancora approvati possono solo richiedere accesso con `/request_access` (anche quando `TELEGRAM_ALLOWED_CHAT_IDS=*`)
- quando un nuovo utente viene visto per la prima volta dal runtime, l'admin riceve una notifica proattiva con user id/chat id per gestire subito approvazione o rifiuto
- l'admin puo' approvare o rifiutare richieste dal messaggio inline o con `/approve_user <telegram_user_id>` e `/reject_user <telegram_user_id>`
- `/users` mostra all'admin lo stato degli utenti registrati (`new`, `pending`, `approved`, `blocked`, `admin`)

### Notifiche automatiche

Se il bot resta in esecuzione:

- ogni `EBAY_ORDER_POLL_INTERVAL` secondi legge gli ordini più recenti
- confronta gli ordini con quelli già notificati
- invia un messaggio solo quando trova davvero un `taxIdentifierType` valorizzato e un `taxpayerId` presente
- salva sia `orderId` sia un hash del contenuto dell'ordine per deduplicare meglio
- se l'invio Telegram fallisce, accoda il messaggio e ritenta nei cicli successivi

Nota operativa importante:

- al primo avvio il bot inizializza lo stato locale e non invia in massa lo storico già esistente
- le notifiche partono dai controlli successivi, così eviti un flood iniziale

### Stato Locale e Persistenza

Per default il bot usa un database SQLite in `data/state.db`.

Nello stato locale salva:

- ordini già notificati
- hash dei record notificati
- coda dei retry Telegram
- ultimo check eseguito
- ultimo errore osservato
- metriche minime come ordini letti e notifiche inviate

Se cambi `EBAY_ORDER_STATE_PATH` o `EBAY_NOTIFY_RETRY_PATH`, assicurati che la directory esista o sia scrivibile.

Se su un ambiente esistente trovi ancora i vecchi file JSON `data/notified_orders.json` o `data/failed_notifications.json`, il bot li migra automaticamente a SQLite al primo avvio e conserva una copia `.legacy-json.bak`.

### Lock del Processo

Su Unix e macOS il bot usa un lock esclusivo su `TELEGRAM_BOT_LOCK_PATH` tramite `fcntl`. Questo evita di eseguire due processi con lo stesso token Telegram e due loop concorrenti su `getUpdates`.

Su Windows il lock non è disponibile: il bot continua a funzionare ma segnala un warning nei log.

## Deploy VPS

Per il deploy standard su VPS Linux con `systemd`, vedi:

- `docs/RUNBOOK.md`
- `docs/DEPLOY_LINUX.md`

## Documentazione

Indice centrale:

- `docs/INDEX.md`

Documenti principali:

- `docs/ROADMAP.md`
- `docs/CONTEXT.md`
- `docs/ARCHITECTURE.md`
- `docs/OPERATIONS.md`
- `docs/DATA_MODEL.md`
- `docs/SECURITY.md`
- `docs/SERVICE_GOVERNANCE.md`
- `docs/DECISIONS_PENDING.md`
- `docs/OAUTH_FLOW.md`
- `docs/CHANGELOG.md`

Asset disponibili nel repository, allineati al setup VPS attuale (`fiscalbay`, `/opt/fiscalbay`, servizio `fiscalbay-bot`):

- `deploy/linux-setup.sh`
- `deploy/update.sh`
- `deploy/smoke-check.sh`
- `deploy/nginx-fiscalbay-oauth-site.conf`
- `deploy/duckdns-update.sh`
- `deploy/fiscalbay-bot.service`
- `.env.example`

Per esporre il callback OAuth senza usare l'indirizzo IP della VPS, usa un
dominio HTTPS davanti a nginx. La guida operativa e' in `docs/PUBLIC_ACCESS.md`.

## Test

Prima di aprire una PR o fare release, esegui il gate locale completo:

```bash
bash scripts/ci_verify.sh
```

Il gate non modifica i file: se fallisce sulla formattazione, applicala con
`ruff format src tests` e rilancialo.

Per eseguire solo i test:

```bash
python3 -m unittest discover -s tests -v
```

## Troubleshooting

### Errore su variabili ambiente mancanti

Controlla di aver impostato almeno:

- `EBAY_CLIENT_ID`
- `EBAY_CLIENT_SECRET`
- `EBAY_REFRESH_TOKEN`

Per il bot serve anche:

- `TELEGRAM_BOT_TOKEN`

### Nessun identificativo fiscale trovato

Non è necessariamente un bug. Significa che eBay non ha restituito `buyer.taxIdentifier` per quegli ordini oppure che il blocco fiscale non contiene sia tipo sia valore.

### Troppe richieste o rallentamenti eBay

Se vuoi ridurre il carico tra una `getOrder` e la successiva:

```bash
export EBAY_ORDER_DETAIL_DELAY_SECONDS="0.15"
```

eBay applica throttling lato API; una piccola pausa è utile quando processi molti ordini in sequenza.

### Il bot non invia notifiche automatiche

Verifica questi punti:

- `TELEGRAM_NOTIFY_CHAT_IDS` è valorizzato
- il bot è ancora in esecuzione
- il primo avvio ha solo bootstrapato lo stato
- eBay sta davvero restituendo `taxIdentifierType` e `taxpayerId`
- il file SQLite in `data/` è scrivibile

### Telegram risponde ma alcuni messaggi falliscono

Il bot effettua retry automatici con backoff. Se l'invio continua a fallire, i messaggi vengono messi in coda nel database SQLite e ritentati nei cicli successivi.

## Privacy e Sicurezza

I messaggi possono contenere dati personali e fiscali. In particolare:

- limita sempre l'accesso con `TELEGRAM_ALLOWED_CHAT_IDS`
- se usi onboarding approvato, imposta anche `TELEGRAM_ADMIN_USER_ID`
- ricorda che Telegram può conservare cronologia chat e backup
- proteggi la directory `data/`, che contiene stato operativo e messaggi in retry
- usa ambienti e dispositivi controllati per consultare questi dati

Il lock file del bot viene creato con permessi restrittivi quando possibile.

## Riferimenti Ufficiali eBay

- Fulfillment API `getOrders`: https://developer.ebay.com/api-docs/sell/fulfillment/resources/order/methods/getOrders
- Fulfillment API `getOrder`: https://developer.ebay.com/api-docs/sell/fulfillment/resources/order/methods/getOrder
- OAuth refresh token flow: https://developer.ebay.com/api-docs/static/oauth-refresh-token-request.html
- Troubleshooting e throttling REST: https://developer.ebay.com/api-docs/static/rest-troubleshooting.html
