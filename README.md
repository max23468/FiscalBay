# eBay CF Tool

CLI e bot Telegram per leggere gli ordini eBay e mostrare l'identificativo fiscale restituito dalle API ufficiali eBay, inclusi i casi in cui il tipo è `CODICE_FISCALE`.

Il progetto nasce per un caso pratico molto preciso: interrogare gli ordini recenti, leggere il dettaglio completo di ogni ordine e rendere consultabile da terminale o da Telegram il contenuto di `buyer.taxIdentifier`.

## Panoramica

Il repository contiene due entry point:

- `ebay-cf`: utility CLI per leggere ordini e stampare i risultati in tabella, JSON o CSV
- `ebay-telegram-bot`: bot Telegram con comandi interattivi e notifiche automatiche dei nuovi ordini

Funzionalità principali:

- autenticazione OAuth eBay tramite `refresh_token`
- cache in memoria del token per ridurre chiamate a `/identity/v1/oauth2/token`
- recupero ordini con `getOrders` e dettaglio con `getOrder`
- estrazione del campo `buyer.taxIdentifier.taxpayerId`
- indicazione del tipo di identificativo fiscale, ad esempio `CODICE_FISCALE`
- output CLI in `table`, `json` o `csv`
- retry con backoff esponenziale per errori transitori eBay e Telegram
- polling continuo dei nuovi ordini con notifiche Telegram automatiche
- persistenza locale dello stato del bot in SQLite

## Limite Importante

Il progetto mostra solo ciò che eBay restituisce davvero. Se `buyer.taxIdentifier` non è presente nella risposta dell'ordine, il tool non può ricostruire o dedurre il codice fiscale in altro modo.

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
ebay-cf --only-found
```

### 4. Avvia il bot

```bash
ebay-telegram-bot
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
| `LOG_LEVEL` | No | `WARNING` per CLI, `INFO` per bot se impostato così | Livello log |

### Variabili Telegram

| Variabile | Obbligatoria | Default | Descrizione |
| --- | --- | --- | --- |
| `TELEGRAM_BOT_TOKEN` | Sì per il bot | - | Token del bot Telegram |
| `TELEGRAM_ALLOWED_CHAT_IDS` | Consigliata | vuoto | Chat autorizzate, separate da virgola |
| `TELEGRAM_NOTIFY_CHAT_IDS` | Consigliata | stessi valori di `TELEGRAM_ALLOWED_CHAT_IDS` | Chat che ricevono notifiche automatiche |
| `TELEGRAM_POLL_TIMEOUT` | No | `30` | Timeout long polling Telegram |
| `TELEGRAM_BOT_LOCK_PATH` | No | `data/telegram_bot.lock` | File lock del processo |
| `EBAY_ORDER_POLL_INTERVAL` | No | `120` | Intervallo polling nuovi ordini |
| `EBAY_ORDER_STATE_PATH` | No | `data/state.db` | File SQLite per stato e metriche |
| `EBAY_NOTIFY_RETRY_PATH` | No | `data/state.db` | File SQLite per coda retry; di default coincide con lo state DB |
| `TELEGRAM_HTTP_MAX_RETRIES` | No | `5` | Numero massimo retry per Telegram |
| `TELEGRAM_HTTP_RETRY_BASE_DELAY` | No | `0.5` | Delay base del backoff Telegram |

## Utilizzo CLI

### Ordini recenti

```bash
ebay-cf
```

Equivale a leggere gli ordini degli ultimi 7 giorni.

### Solo ordini con identificativo fiscale presente

```bash
ebay-cf --only-found
```

### Ordine specifico

```bash
ebay-cf --order-id "12-34567-89012"
```

Puoi ripetere `--order-id` più volte.

### Finestra temporale esplicita

```bash
ebay-cf \
  --created-after "2026-04-01T00:00:00Z" \
  --created-before "2026-04-03T23:59:59Z"
```

### Esportazione CSV

```bash
ebay-cf --format csv --output risultati.csv
```

### Esportazione JSON

```bash
ebay-cf --format json --output risultati.json
```

### Esecuzione senza installazione

```bash
python3 src/ebay_cf_tool.py --help
python3 src/telegram_bot.py
```

### Utility operativa Git

Se Git resta bloccato da un `index.lock` rimasto sporco, puoi usare:

```bash
ebay-cf-fix-git-lock
```

Il comando rimuove il lock solo se non risulta piu' detenuto da un processo attivo.

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

### Notifiche automatiche

Se il bot resta in esecuzione:

- ogni `EBAY_ORDER_POLL_INTERVAL` secondi legge gli ordini più recenti
- confronta gli ordini con quelli già notificati
- invia un messaggio solo quando trova davvero `taxIdentifierType=CODICE_FISCALE` e un `taxpayerId` valorizzato
- salva sia `orderId` sia un hash del contenuto dell'ordine per deduplicare meglio
- se l'invio Telegram fallisce, accoda il messaggio e ritenta nei cicli successivi

Nota operativa importante:

- al primo avvio il bot inizializza lo stato locale e non invia in massa lo storico già esistente
- le notifiche partono dai controlli successivi, così eviti un flood iniziale

### Stato Locale e Persistenza

Per default il bot usa un database SQLite in [data/state.db](/Users/Matteo/Documents/eBay CF/data/state.db).

Nello stato locale salva:

- ordini già notificati
- hash dei record notificati
- coda dei retry Telegram
- ultimo check eseguito
- ultimo errore osservato
- metriche minime come ordini letti e notifiche inviate

Se cambi `EBAY_ORDER_STATE_PATH` o `EBAY_NOTIFY_RETRY_PATH`, assicurati che la directory esista o sia scrivibile.

### Lock del Processo

Su Unix e macOS il bot usa un lock esclusivo su `TELEGRAM_BOT_LOCK_PATH` tramite `fcntl`. Questo evita di eseguire due processi con lo stesso token Telegram e due loop concorrenti su `getUpdates`.

Su Windows il lock non è disponibile: il bot continua a funzionare ma segnala un warning nei log.

## Docker

### Build

```bash
docker compose build
```

### Avvio

```bash
docker compose up -d
```

Il file [docker-compose.yml](/Users/Matteo/Documents/eBay CF/docker-compose.yml) monta `./data` dentro `/app/data`, quindi il database SQLite e il lock file restano persistenti tra i riavvii del container.

Prima dell'avvio conviene fornire le variabili ambiente tramite:

- un file `.env` nella root del progetto
- variabili esportate nella shell
- oppure una sezione `env_file` in `docker-compose.yml`

## Test

Esegui i test con:

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

### Nessun codice fiscale trovato

Non è necessariamente un bug. Significa che eBay non ha restituito `buyer.taxIdentifier` per quegli ordini oppure che il tipo restituito non è `CODICE_FISCALE`.

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
- eBay sta davvero restituendo `CODICE_FISCALE` e `taxpayerId`
- il file SQLite in `data/` è scrivibile

### Telegram risponde ma alcuni messaggi falliscono

Il bot effettua retry automatici con backoff. Se l'invio continua a fallire, i messaggi vengono messi in coda nel database SQLite e ritentati nei cicli successivi.

## Privacy e Sicurezza

I messaggi possono contenere dati personali e fiscali. In particolare:

- limita sempre l'accesso con `TELEGRAM_ALLOWED_CHAT_IDS`
- ricorda che Telegram può conservare cronologia chat e backup
- proteggi la directory `data/`, che contiene stato operativo e messaggi in retry
- usa ambienti e dispositivi controllati per consultare questi dati

Il lock file del bot viene creato con permessi restrittivi quando possibile.

## Riferimenti Ufficiali eBay

- Fulfillment API `getOrders`: https://developer.ebay.com/api-docs/sell/fulfillment/resources/order/methods/getOrders
- Fulfillment API `getOrder`: https://developer.ebay.com/api-docs/sell/fulfillment/resources/order/methods/getOrder
- OAuth refresh token flow: https://developer.ebay.com/api-docs/static/oauth-refresh-token-request.html
- Troubleshooting e throttling REST: https://developer.ebay.com/api-docs/static/rest-troubleshooting.html
