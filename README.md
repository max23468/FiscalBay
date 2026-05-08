# FiscalBay

FiscalBay è un tool operativo con CLI e bot Telegram per leggere gli ordini eBay e mostrare l'identificativo fiscale restituito dalle API ufficiali eBay, inclusi casi come `CODICE_FISCALE` e `VAT_NUMBER`.

Payoff: `Assistente fiscale ordini per venditori eBay`.

Linee guida brand e asset pronti all'uso: [`docs/BRAND_GUIDELINES.md`](docs/BRAND_GUIDELINES.md), `assets/branding/*`.
Set definitivo approvato: logo orizzontale, mark e avatar Telegram nel concept `Seller Card`.
Export operativi pronti: `assets/branding/exports/fiscalbay-avatar-telegram-512.png`, `fiscalbay-mark-512.png`, `fiscalbay-logo-light-2048.png`, `fiscalbay-logo-dark-2048.png`.
Il server OAuth pubblico espone lo stesso mark anche come `favicon.svg`, `favicon.png` e `apple-touch-icon.png`, così il sito resta riconoscibile anche su Safari e Mac.

Il progetto nasce per un caso pratico molto preciso: interrogare gli ordini recenti, leggere il dettaglio completo di ogni ordine e rendere consultabile da terminale o da Telegram l'identificativo fiscale che eBay espone nelle API ufficiali. Il percorso principale legge `buyer.taxIdentifier` dalla Sell Fulfillment API; quando quel campo manca ma l'ordine è noto, FiscalBay tenta anche il container ufficiale `BuyerTaxIdentifier` della Trading API per lo stesso `orderId`.

Il perimetro stabile `1.0.0` è il servizio pubblico piccolo con accesso
approvato: bot Telegram first, singolo admin globale, onboarding OAuth su VPS,
token tenant cifrati, SQLite entro soglie dichiarate e operatività best effort.
Il dettaglio dei criteri e dei limiti è in [`docs/RELEASE_READINESS.md`](docs/RELEASE_READINESS.md).

## Panoramica

Il repository contiene più entry point operativi:

- `fiscalbay`: utility CLI per leggere ordini e stampare i risultati in tabella, JSON o CSV
- `fiscalbay-bot`: bot Telegram con comandi interattivi e notifiche automatiche dei nuovi ordini
- `fiscalbay-oauth-server`: callback server minimale per l'onboarding self-service Telegram + eBay OAuth
- `fiscalbay-reconcile`: worker one-shot per reconciliation periodica e coda operativa
- `fiscalbay-fiscal-export`: export fiscale venditore con stato dati disponibili/mancanti
- `fiscalbay-support-snapshot`: riepilogo supporto leggibile per singolo tenant Telegram

Funzionalità principali:

- autenticazione OAuth eBay tramite `refresh_token`
- cache in memoria del token per ridurre chiamate a `/identity/v1/oauth2/token`
- recupero ordini con Sell Fulfillment `getOrders` e dettaglio con `getOrder`
- estrazione di `buyer.taxIdentifier.taxpayerId`, con fallback su Trading API `BuyerTaxIdentifier`
- indicazione del tipo di identificativo fiscale, ad esempio `CODICE_FISCALE` o `VAT_NUMBER`
- output CLI in `table`, `json` o `csv`
- retry con backoff esponenziale per errori transitori eBay e Telegram
- polling continuo dei nuovi ordini con notifiche Telegram automatiche
- persistenza locale dello stato del bot in SQLite

## Limite Importante

Il progetto mostra solo ciò che eBay restituisce davvero. Se né Sell Fulfillment `buyer.taxIdentifier` né Trading API `BuyerTaxIdentifier` sono presenti per l'ordine, il tool non può ricostruire o dedurre l'identificativo fiscale in altro modo.

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

- workflow GitHub Actions allowlist `.github/workflows/ci.yml` per CI leggera su PR verso `main` e avvio manuale
- controlli GitHub Actions conservativi per titolo PR, Dependency Review, actionlint, build package mirato e inbox commenti Codex
- deploy esplicito con `scripts/deploy_now.sh`
- release versionata esplicita con `scripts/release_now.sh`
- CI locale con `bash scripts/ci_verify.sh`, richiamata anche dal workflow leggero e dalla pipeline locale
- `scripts/local_automate.sh` e `scripts/local_deploy_vps.sh` restano utility legacy/fallback
- aggiornamenti dipendenze automatici via `.github/dependabot.yml`, con schedule settimanale e limite basso di PR aperte
- template per Pull Request (`.github/PULL_REQUEST_TEMPLATE.md`)
- issue forms per bug e task operativi (`.github/ISSUE_TEMPLATE/*`)
- `CODEOWNERS` per ownership esplicita (`.github/CODEOWNERS`)
- security policy riconosciuta dalla Security tab (`SECURITY.md`)
- guida operativa GitHub per le impostazioni da completare nella UI (`docs/GITHUB_MAINTENANCE.md`)

Passi consigliati dopo il clone/fork:

1. verifica branch protection su `main` (almeno: linear history; non rendere ancora obbligatorio il check Actions)
2. abilita secret scanning e Dependabot alerts dal tab Security; gli update automatici sono limitati da `.github/dependabot.yml`
3. usa PR anche da branch personali per lasciare audit trail e checklist standard
4. usa titoli PR di squash in formato Conventional Commit per tenere coerenti versioni e changelog
5. in GitHub abilita `Squash merge` e valuta di disabilitare `Merge commit` e `Rebase merge` per rendere il flusso più coerente

Per usare Codex su `chatgpt.com` come postazione di lavoro senza deploy/release via Actions, vedi [`docs/CODEX_CLOUD_DEPLOY.md`](docs/CODEX_CLOUD_DEPLOY.md).

Il flusso consigliato da remoto e:

- Codex o GitHub preparano il codice fino a `main`
- la pipeline operativa resta locale/VPS, non GitHub Actions
- GitHub Actions esegue solo controlli GitHub conservativi; non esegue deploy, release o merge
- ogni attività operativa viene eseguita da script locali o dalla VPS FiscalBay

In pratica, da Codex web/mobile ti basta:

- aprire il repository GitHub `max23468/FiscalBay`
- lavorare su branch o su `main`
- fermarti al codice e alla verifica locale; il deploy resta manuale sulla VPS FiscalBay

## Versioni e changelog

Il repository usa Semantic Versioning con tag GitHub nel formato `vX.Y.Z`.

Regola operativa minima:

- il deploy normale non crea versioni, changelog o tag
- una release versionata si lancia esplicitamente con `scripts/release_now.sh`
- lo script calcola il bump dai Conventional Commit (`feat`, `fix`, `perf`, `!`) dall'ultimo tag `v*`

- `PATCH` per bugfix compatibili, ad esempio `v0.1.1`
- `MINOR` per nuove funzionalità compatibili, ad esempio `v0.2.0`
- `MAJOR` per breaking change, ad esempio `v1.0.0`

Il primo salto stabile a `v1.0.0` può essere eseguito con override esplicito
quando la readiness documentata è completa:

```bash
scripts/release_now.sh --version 1.0.0 --bump major
```

Il flusso operativo resta automatizzato fuori da GitHub Actions:

- deploy operativo: `scripts/deploy_now.sh`
- release versionata: `scripts/release_now.sh`
- GitHub Release creata da `gh` o API GitHub, senza GitHub Actions
- CI locale: `bash scripts/ci_verify.sh`
- CI GitHub leggera: `.github/workflows/ci.yml`, solo PR verso `main` e avvio manuale
- controlli PR: titolo Conventional Commit, Dependency Review e actionlint mirato
- build package GitHub: `.github/workflows/package-build.yml`, su PR packaging e avvio manuale
- build locale quando serve: `python -m build`

Per creare GitHub Release senza `gh` locale puoi usare un token GitHub con permessi
minimi sul repository, esportato solo nell'ambiente locale:

```bash
export GITHUB_TOKEN=ghp_...
scripts/release_now.sh
```

Per il deploy remoto del repository privato, la VPS usa un token GitHub letto da
`/etc/fiscalbay/deploy.env`.

Per i dettagli operativi e le policy di naming/bump vedere `docs/RELEASE_POLICY.md`.

Comandi principali fuori da Actions:

```bash
scripts/deploy_now.sh
scripts/release_now.sh
```

`scripts/local_automate.sh --all` resta disponibile come utility legacy, ma non è
il percorso raccomandato per chiudere una release.

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
| `EBAY_TRADING_SITE_ID` | No | `101` | Site ID Trading API usato per il fallback `BuyerTaxIdentifier`; `101` corrisponde a eBay Italia |
| `EBAY_HTTP_MAX_RETRIES` | No | `5` | Numero massimo retry per chiamate eBay |
| `EBAY_HTTP_RETRY_BASE_DELAY` | No | `0.5` | Delay base del backoff eBay |
| `EBAY_TOKEN_SKEW_SECONDS` | No | `60` | Margine di sicurezza sulla scadenza token |
| `EBAY_ORDER_DETAIL_DELAY_SECONDS` | No | `0` | Pausa tra chiamate `getOrder` |
| `EBAY_OAUTH_RUNAME` | Consigliata per OAuth production | vuoto | RuName eBay usato come `redirect_uri` nel flusso OAuth production |
| `EBAY_OAUTH_RUNAME_SANDBOX` | No | fallback a `EBAY_OAUTH_RUNAME` | RuName eBay dedicato al sandbox, se diverso dalla production |
| `EBAY_OAUTH_CONNECT_BASE_URL` | No | vuoto | URL pubblico usato da `/account collega` per aprire il flusso OAuth |
| `EBAY_OAUTH_CALLBACK_URL` | No | derivato da `EBAY_OAUTH_CONNECT_BASE_URL` | URL pubblico di callback esposto dal progetto; deve coincidere con l'Accept URL configurato nel RuName eBay |
| `EBAY_OAUTH_SERVER_HOST` | No | `127.0.0.1` | Host di bind del callback server |
| `EBAY_OAUTH_SERVER_PORT` | No | `8787` | Porta locale del callback server |
| `EBAY_TENANT_TOKEN_KEY` | Consigliata per OAuth multiutente | vuoto | Chiave Fernet usata per cifrare i refresh token tenant a riposo |
| `EBAY_ENABLE_PLAINTEXT_TENANT_TOKENS` | No | vuoto | Opt-in solo dev o recovery controllato per salvare il refresh token tenant in formato `plain:` |
| `LOG_LEVEL` | No | `WARNING` per CLI, `INFO` per bot se impostato così | Livello log |

Nota OAuth eBay:

- il parametro `redirect_uri` inviato a eBay non è un URL libero, ma il `RuName` registrato nel portale developer eBay
- `EBAY_OAUTH_CALLBACK_URL` serve invece al progetto per esporre il callback pubblico che deve essere associato a quel `RuName`
- sulla VPS, per avere `/account collega` davvero usabile, vanno quindi configurati sia il `RuName` corretto sia l'URL pubblico raggiungibile del callback server
- lo stesso server OAuth espone anche `/` come mini sito vetrina, `/privacy` come Privacy Policy URL e `/about` come About URL nel branding OAuth del portale eBay
- il flusso `/account collega` avviato da Telegram aggiunge al consenso anche lo scope pubblico `commerce.identity.readonly`, usato per leggere un identificativo account eBay reale invece del placeholder locale
- `EBAY_SCOPES` deve restare coerente con gli scope concessi al refresh token globale; non aggiungere scope non presenti nel token già emesso

### Variabili Telegram

| Variabile | Obbligatoria | Default | Descrizione |
| --- | --- | --- | --- |
| `TELEGRAM_BOT_TOKEN` | Sì per il bot | - | Token del bot Telegram |
| `TELEGRAM_PUBLIC_BOT_URL` | No | `https://t.me/fiscalbay_bot` | URL pubblico usato dalle CTA del sito vetrina e dalle pagine OAuth per tornare al bot |
| `TELEGRAM_ADMIN_USER_ID` | Consigliata | vuoto | Se valorizzata, questo utente Telegram diventa admin globale e approva l'accesso degli altri utenti |
| `TELEGRAM_ALLOWED_CHAT_IDS` | **Sì** | vuoto (deny-all) | Chat autorizzate, separate da virgola. Usa `*` (o `all`) per accettare tutte le chat e demandare il filtro al workflow di approvazione admin |
| `TELEGRAM_NOTIFY_CHAT_IDS` | Consigliata | stessi valori di `TELEGRAM_ALLOWED_CHAT_IDS` | Chat che ricevono notifiche automatiche |
| `TELEGRAM_POLL_TIMEOUT` | No | `30` | Timeout long polling Telegram |
| `TELEGRAM_SYNC_BRANDING` | No | `1` | Se attiva, sincronizza nome, descrizione e menu comandi Telegram quando il profilo cambia; in caso di rate limit applica un backoff automatico |
| `TELEGRAM_BOT_LOCK_PATH` | No | `data/telegram_bot.lock` | File lock del processo |
| `EBAY_ORDER_POLL_INTERVAL` | No | `120` | Intervallo polling nuovi ordini |
| `EBAY_ORDER_STATE_PATH` | No | `data/state.db` | File SQLite per stato e metriche |
| `EBAY_NOTIFY_RETRY_PATH` | No | `data/state.db` | File SQLite per coda retry; di default coincide con lo state DB |
| `FISCALBAY_MISSING_TAX_ALERT_ENABLED` | No | `1` | Abilita alert automatico quando una finestra di polling contiene molti ordini senza dato fiscale |
| `FISCALBAY_MISSING_TAX_ALERT_MIN_MISSING` | No | `3` | Numero minimo di ordini senza dato fiscale richiesto per inviare l'alert |
| `FISCALBAY_MISSING_TAX_ALERT_MIN_PERCENT` | No | `60` | Percentuale minima di ordini senza dato fiscale nella finestra per inviare l'alert |
| `FISCALBAY_MISSING_TAX_ALERT_COOLDOWN_SECONDS` | No | `21600` | Cooldown tra alert spike senza dato fiscale |
| `TELEGRAM_HTTP_MAX_RETRIES` | No | `5` | Numero massimo retry per Telegram |
| `TELEGRAM_HTTP_RETRY_BASE_DELAY` | No | `0.5` | Delay base del backoff Telegram |

### Variabili operative VPS

| Variabile | Default | Descrizione |
| --- | --- | --- |
| `FISCALBAY_PUBLIC_SERVICE_MODEL` | `approved_public_small` | Modello operativo dichiarato: servizio pubblico piccolo con accesso approvato |
| `FISCALBAY_WEB_ROLE` | `onboarding_callback_support` | Ruolo della parte web: supporto onboarding/callback, non entrypoint principale |
| `FISCALBAY_ONBOARDING_HOSTING` | `vps_oauth_callback` | Decisione hosting attuale per onboarding e callback OAuth |
| `FISCALBAY_PUBLIC_MAX_APPROVED_USERS` | `25` | Soglia oltre cui rivalutare servizio pubblico, VPS e processo admin |
| `FISCALBAY_PUBLIC_MAX_LINKED_ACCOUNTS` | `25` | Soglia account eBay collegati oltre cui rivalutare storage e operatività |
| `FISCALBAY_PUBLIC_MAX_ACTIVE_TOKEN_SETS` | `25` | Soglia token tenant attivi oltre cui preparare migrazione database |
| `FISCALBAY_SQLITE_MAX_DB_BYTES` | `52428800` | Soglia dimensione `state.db` oltre cui il passaggio oltre SQLite diventa raccomandato |
| `FISCALBAY_RATE_LIMIT_ENABLED` | `1` | Abilita i cooldown per utente sui comandi sensibili |
| `FISCALBAY_RATE_LIMIT_REQUEST_ACCESS_SECONDS` | `60` | Cooldown per utente su `/request_access` |
| `FISCALBAY_RATE_LIMIT_CONNECT_SECONDS` | `10` | Cooldown per utente su `/account collega`, salvo riuso sessione OAuth valida |
| `FISCALBAY_RATE_LIMIT_DISCONNECT_SECONDS` | `5` | Cooldown per utente su `/account scollega` |
| `FISCALBAY_RATE_LIMIT_LEAVE_BOT_SECONDS` | `5` | Cooldown per utente su `/settings lascia` |
| `FISCALBAY_RATE_LIMIT_SERVICE_MODE_SECONDS` | `2` | Cooldown admin su cambio modalità servizio |
| `FISCALBAY_RATE_LIMIT_ADMIN_MUTATION_SECONDS` | `2` | Cooldown admin su cambi stato utente non idempotenti |
| `FISCALBAY_PUBLIC_HEALTH_URL` | derivata da `EBAY_OAUTH_CALLBACK_URL` se possibile | URL HTTPS pubblico da controllare con l'healthcheck esterno, di norma `/healthz` |
| `MAX_DISK_USED_PERCENT` | `85` | Soglia alert per spazio disco usato sul path applicativo |
| `MAX_INODE_USED_PERCENT` | `85` | Soglia alert per inode usati sul path applicativo |
| `MIN_MEMORY_AVAILABLE_MB` | `128` | Soglia minima di memoria disponibile |
| `TLS_MIN_DAYS_VALID` | `14` | Giorni minimi residui accettati per il certificato TLS pubblico |
| `JOURNAL_VACUUM_TIME` | `14d` | Retention temporale journal applicata dalla manutenzione log |
| `JOURNAL_VACUUM_SIZE` | `200M` | Retention dimensionale journal applicata dalla manutenzione log |
| `NGINX_LOG_RETENTION_DAYS` | `30` | Retention dei log nginx FiscalBay già ruotati |
| `FISCALBAY_BOT_MEMORY_MAX` | `512M` | Limite `systemd` memoria per `fiscalbay-bot` |
| `FISCALBAY_BOT_CPU_QUOTA` | `60%` | Quota CPU `systemd` per `fiscalbay-bot` |
| `FISCALBAY_BOT_TASKS_MAX` | `128` | Limite task/processi per `fiscalbay-bot` |
| `FISCALBAY_OAUTH_MEMORY_MAX` | `256M` | Limite memoria per `fiscalbay-oauth` |
| `FISCALBAY_OAUTH_CPU_QUOTA` | `40%` | Quota CPU per `fiscalbay-oauth` |
| `FISCALBAY_OAUTH_TASKS_MAX` | `64` | Limite task/processi per `fiscalbay-oauth` |
| `FISCALBAY_ONESHOT_MEMORY_MAX` | `256M` | Limite memoria per job periodici one-shot |
| `FISCALBAY_ONESHOT_CPU_QUOTA` | `50%` | Quota CPU per job periodici one-shot |
| `FISCALBAY_ONESHOT_TASKS_MAX` | `64` | Limite task/processi per job periodici one-shot |

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

### Export fiscale venditore

```bash
fiscalbay-fiscal-export --days 30 --max-results 200 --output export-fiscale.csv
```

L'export aggiunge periodo, stato del dato fiscale (`available`/`missing`) e campi fiscali mancanti. Per un tenant specifico già collegato via Telegram:

```bash
fiscalbay-fiscal-export --telegram-user-id 123456789 --state-path data/state.db --output export-fiscale.csv
```

### Support snapshot tenant

```bash
fiscalbay-support-snapshot 123456789 --state-path data/state.db
```

Lo snapshot raccoglie stato utente, account eBay collegato, stato token, ultimo
sync, ordini recenti tracciati, coda retry, audit recente e azioni consigliate.
Per integrazioni o diagnosi automatizzate:

```bash
fiscalbay-support-snapshot 123456789 --state-path data/state.db --json
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

Il comando rimuove il lock solo se non risulta più detenuto da un processo attivo.

Per rendere più robusti i comandi Git locali del progetto puoi anche usare:

```bash
fiscalbay-git-safe -- commit -m "messaggio"
fiscalbay-git-safe -- push origin main
```

Questo wrapper:

- aspetta per pochi secondi se il lock è davvero detenuto da un processo attivo
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

### Security Operations Check

Per verificare controlli ricorrenti di sicurezza senza esporre segreti:

```bash
fiscalbay-security-check
```

Il report controlla permessi `.env` e `state.db`, presenza delle env operative
richieste, fallback plaintext dei token tenant, profilo `approved_public_small`,
ultimo backup e ultimo restore drill. In Telegram l'admin può leggere la stessa
sintesi con `/admin sicurezza`.

### Scale Readiness Check

Per capire se SQLite resta adeguato senza avviare migrazioni automatiche:

```bash
fiscalbay-scale-check
```

Il report classifica lo stato in `within_policy`, `watch`,
`migration_recommended` o `migration_required` usando soglie pubbliche, dimensione
SQLite, queue e snapshot tenant. In Telegram l'admin può leggere la sintesi con
`/admin scala`.

L'healthcheck verifica almeno:

- presenza del lock del bot
- freschezza di `last_check`
- dimensione della retry queue
- eventuale ultimo errore registrato
- metadati release/deploy (`release.*`): versione package, branch, commit, tag
  corrente, ultimo tag e stato Git pulito/sporco

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
- `buyerEmail`
- `taxpayerId`
- `taxIdentifierType`
- `issuingCountry`
- `found`
- `items`
- `orderQuantity`
- `productDescription`
- `total`
- `transactionStatus`
- `shippingAddress`

`found` vale `yes` quando `taxpayerId` è presente, sia dal dettaglio Sell Fulfillment sia dal fallback Trading API sullo stesso ordine; altrimenti vale `no`.

## Bot Telegram

### Comandi disponibili

`/help` resta volutamente breve: mostra solo i comandi principali e, se lo usa
l'admin, aggiunge il blocco admin. Il menu comandi Telegram espone al massimo
quattro voci: `/stato`, `/account`, `/ordini` e `/altre_azioni`. Le guide
dettagliate vivono nei rispettivi centri comando (`/ordini`, `/settings`,
`/admin help`), mentre `/altre_azioni` raccoglie guida, preferenze e richiesta
accesso.

Comandi principali per tutti:

- `/start`
- `/help`
- `/onboarding`
- `/stato`
- `/support`
- `/account`
- `/ordini`
- `/altre_azioni`
- `/settings`
- `/request_access`

Dettagli account, ordini e impostazioni:

- `/account collega`
- `/account reconnect`
- `/account scollega`
- `/ordini fiscali 7 20`
- `/ordini tutti 7 20`
- `/ordini cerca 12-34567-89012`
- `/ordini cerca mario 30 100`
- `/ordini controlla 7 20`
- `/ordini report 7 20`
- `/ordini priorita 7 20`
- `/ordini export 7 50`
- `/ordini spiega 12-34567-89012`
- `/settings notifiche on`
- `/settings notifiche off`
- `/settings filtro all|cf|vat`
- `/settings policy`
- `/settings dati`
- `/settings dati export`
- `/settings dati cancellazione`
- `/settings lascia`

Comandi admin:

- `/admin help` (admin)
- `/admin` (admin)
- `/ping` (admin, diagnostica rapida)
- `/admin invite [telegram_user_id]` (admin)
- `/admin manutenzione` (admin)
- `/admin scala` (admin)
- `/admin sicurezza` (admin)
- `/admin support <telegram_user_id>` (admin)
- `/admin storico [telegram_user_id] [limit]` (admin)
- `/admin_users all|pending|unlinked|reconnect|inactive` (admin)
- `/tenant_health [telegram_user_id]` (admin)
- `/approve_user <telegram_user_id>` e `/reject_user <telegram_user_id>` (admin)
- `/suspend_user <telegram_user_id>` e `/reactivate_user <telegram_user_id>` (admin)
- `/service_mode normal|maintenance|degraded` (admin)

Regole input:

- giorni ammessi: da `1` a `365`
- massimo ordini: da `1` a `500`
- se i parametri sono omessi, il bot usa `7` giorni e `20` risultati

Comportamento:

- `/onboarding` mostra il percorso selettivo in base allo stato reale: invitato/nuovo, richiesta pending, approvato senza account, reconnect o operativo
- `/ordini fiscali` mostra solo ordini con identificativo fiscale presente
- `/ordini tutti` mostra anche ordini senza dato fiscale
- `/ordini cerca` interroga un ordine specifico quando il valore sembra un orderId eBay; altrimenti cerca negli ordini recenti per buyer username, nome, email o identificativo fiscale già restituito da eBay
- `/ordini export` genera un export CSV inline con periodo, stato fiscale e campi mancanti per ogni ordine incluso
- i messaggi ordine con identificativo fiscale valorizzato includono un pulsante inline per copiare direttamente il valore fiscale, ad esempio CF o P.IVA
- `/stato` mostra ultimo check, contatori e dimensione della coda retry; `/stato servizio` mostra lo stato servizio sintetico
- `/support` mostra uno snapshot supporto del proprio tenant con account, token, ultimi sync, ordini recenti, retry, audit e azioni consigliate
- `/account` riassume lo stato eBay; `collega`, `reconnect` e `scollega` gestiscono le azioni account e indicano chiaramente se il consenso eBay va rimosso manualmente dalle impostazioni eBay
- `/settings` riassume preferenze chat e tenant; `notifiche`, `filtro`,
  `policy`, `dati` e `lascia` gestiscono le azioni correlate
- `/settings dati` spiega privacy, dati conservati e retention; `export` e
  `cancellazione` inviano all'admin una richiesta assistita senza cancellare
  dati automaticamente
- la tastiera inline varia per contesto: `/account` privilegia collegamento e stato account, `/ordini` mostra azioni ordini/report, `/settings` mostra notifiche e preferenze, `/altre_azioni` raccoglie guida/accesso/preferenze, `/admin` mostra scorciatoie admin; `/start` e `/help` restano il menu generale
- se `TELEGRAM_ADMIN_USER_ID` è configurata, gli utenti non ancora approvati possono solo richiedere accesso con `/request_access` (anche quando `TELEGRAM_ALLOWED_CHAT_IDS=*`)
- quando un nuovo utente viene visto per la prima volta dal runtime, l'admin riceve una notifica proattiva con user id/chat id per gestire subito approvazione o rifiuto
- l'admin può approvare o rifiutare richieste dal messaggio inline o con `/approve_user <telegram_user_id>` e `/reject_user <telegram_user_id>`
- `/admin invite [telegram_user_id]` genera un testo di invito e una checklist admin per guidare un venditore selezionato verso `/start`, `/request_access`, approvazione e `/account collega`, senza creare registrazione libera
- `/admin_users` mostra all'admin lo stato degli utenti registrati (`new`, `pending`, `approved`, `blocked`, `admin`) e accorpa i filtri prima esposti come comandi separati
- `/admin scala` mostra se il profilo SQLite resta dentro policy, se serve solo
  monitorare o se è opportuno preparare o richiedere una migrazione verso
  Postgres/equivalente; non esegue migrazioni automatiche
- `/admin sicurezza` mostra il report security operations senza stampare valori
  segreti: permessi `.env`, stato `state.db`, inventario env, backup e restore
  drill
- `/admin storico` mostra gli ultimi eventi audit operativi e può filtrare per
  tenant, così supporto e diagnosi restano dentro Telegram
- `/admin support <telegram_user_id>` mostra lo stesso snapshot supporto per un
  tenant specifico, utile prima di chiedere screenshot o log all'utente
- gli alias granulari precedenti (`/connect`, `/disconnect`, `/reconnect_status`, `/notifications`, `/leave_bot`, `/ultimi`, `/tutti`, `/ordine`, `/review_orders`, `/report_summary`, `/priority_orders`, `/why_not_notified`, `/service_status`, `/policy`, `/users`, `/pending_users`, `/unlinked_users`, `/reconnect_users`, `/inactive_users`, `/admin_dashboard`, `/maintenance_overview`) sono stati accorpati e ora rimandano ai comandi canonici

### Notifiche automatiche

Se il bot resta in esecuzione:

- ogni `EBAY_ORDER_POLL_INTERVAL` secondi legge gli ordini più recenti
- confronta gli ordini con quelli già notificati
- invia un messaggio solo quando trova davvero un `taxIdentifierType` valorizzato e un `taxpayerId` presente
- invia un alert separato se una finestra di polling contiene uno spike di ordini senza dato fiscale, secondo le soglie `FISCALBAY_MISSING_TAX_ALERT_*`
- nel messaggio include i dati ordine restituiti da eBay, tra cui nome, email, indirizzo, quantità, importo, data, stato transazione e descrizione prodotto quando disponibili
- aggiunge un pulsante inline per copiare il `taxpayerId` senza selezionare il testo del messaggio
- salva sia `orderId` sia un hash del contenuto dell'ordine per deduplicare meglio
- se l'invio Telegram fallisce, accoda il messaggio e ritenta nei cicli successivi

Nota operativa importante:

- al primo avvio il bot inizializza lo stato locale e non invia in massa lo storico già esistente
- le notifiche partono dai controlli successivi, così eviti un flood iniziale

### Stato Locale e Persistenza

Per default il bot usa un database SQLite in `data/state.db`.

SQLite resta la scelta operativa per il servizio pubblico piccolo e approvato.
Quando `fiscalbay-healthcheck` segnala `sqlite_migration_recommended` o una delle
soglie `FISCALBAY_PUBLIC_*` viene superata, prima di ampliare gli utenti approvati
va pianificato il passaggio a un database più robusto.
Il comando `fiscalbay-scale-check` e `/admin scala` rendono esplicito il livello
decisionale senza cambiare storage: `watch`, `migration_recommended` e
`migration_required` sono segnali operativi, non automazioni di migrazione.

Nello stato locale salva:

- ordini già notificati
- hash dei record notificati
- coda dei retry Telegram
- ultimo check eseguito
- ultimo errore osservato
- metriche minime come ordini letti e notifiche inviate

Se cambi `EBAY_ORDER_STATE_PATH` o `EBAY_NOTIFY_RETRY_PATH`, assicurati che la directory esista o sia scrivibile.

Il comando admin `/admin` espone stabilmente anche un blocco di metriche prodotto
minime: ordini letti, ordini con dato fiscale, notifiche inviate, tenant noti,
token attivi e rapporto tra utenti approvati e account collegati. Sono metriche
operative per governare un servizio piccolo e curato, non analytics commerciali.
Lo stesso pannello, insieme a `/admin manutenzione`, mostra anche versione
deployata, tag, commit breve e stato release, così l'admin può confrontare
subito ciò che gira in produzione con l'ultimo tag pubblicato.

Se su un ambiente esistente trovi ancora i vecchi file JSON `data/notified_orders.json` o `data/failed_notifications.json`, il bot li migra automaticamente a SQLite al primo avvio e conserva una copia `.legacy-json.bak`.

### Lock del Processo

Su Unix e macOS il bot usa un lock esclusivo su `TELEGRAM_BOT_LOCK_PATH` tramite `fcntl`. Questo evita di eseguire due processi con lo stesso token Telegram e due loop concorrenti su `getUpdates`.

Su Windows il lock non è disponibile: il bot continua a funzionare ma segnala un warning nei log.

## Deploy VPS

Per il deploy standard su VPS Linux con `systemd`, vedi:

- `docs/RUNBOOK.md`
- `docs/DEPLOY_LINUX.md`

Da Mac locale puoi automatizzare il deploy quotidiano fuori da GitHub Actions con:

```bash
scripts/deploy_now.sh
```

`scripts/local_deploy_vps.sh` resta un fallback operativo quando serve caricare
un archivio locale direttamente sulla VPS.

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

- `scripts/local_automate.sh`
- `scripts/deploy_now.sh`
- `scripts/release_now.sh`
- `scripts/local_deploy_vps.sh`
- `deploy/linux-setup.sh`
- `deploy/update.sh`
- `deploy/smoke-check.sh`
- `deploy/nginx-fiscalbay-oauth-site.conf`
- `deploy/duckdns-update.sh`
- `deploy/fiscalbay-alertcheck.service`
- `deploy/fiscalbay-reconcile.service`
- `deploy/fiscalbay-duckdns.service`
- `deploy/fiscalbay-bot.service`
- `.env.example`

Per esporre il callback OAuth senza usare l'indirizzo IP della VPS, usa un
dominio HTTPS davanti a nginx. La guida operativa è in `docs/PUBLIC_ACCESS.md`.

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
