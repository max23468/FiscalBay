# eBay CF Tool

Tool CLI per leggere gli ordini eBay e tentare l'estrazione del codice fiscale dell'acquirente tramite le API ufficiali eBay.

Include un bot Telegram che espone questi dati via chat.

**Requisiti:** Python 3.10 o superiore.

## Cosa fa

- Usa OAuth con `refresh_token` eBay per ottenere un `User access token` (con **cache in memoria** fino a poco prima della scadenza, per ridurre chiamate a `/identity/v1/oauth2/token`)
- Recupera gli ordini recenti con `getOrders`
- Legge il dettaglio di ogni ordine con `getOrder`
- Estrae `buyer.taxIdentifier.taxpayerId`
- Evidenzia il tipo di identificativo fiscale restituito da eBay, ad esempio `CODICE_FISCALE`
- Esporta in tabella, JSON o CSV
- In caso di errori **transitori** (rete, HTTP 429, 5xx) ripete le richieste verso eBay e Telegram con **backoff esponenziale** (configurabile via variabili ambiente)

## Limite importante

Il campo fiscale **non è garantito per tutti gli ordini**. Secondo la documentazione ufficiale della Fulfillment API, l'identificativo fiscale è nel campo `buyer.taxIdentifier`, con enum che include `CODICE_FISCALE`. Se eBay non lo restituisce nell'ordine, il tool non può inventarlo o ricostruirlo.

## Limiti eBay (rate limiting)

eBay applica limiti di utilizzo alle API. Per ridurre il carico in sequenza puoi impostare una pausa (in secondi) tra una chiamata `getOrder` e la successiva:

```bash
export EBAY_ORDER_DETAIL_DELAY_SECONDS="0.15"
```

Consulta la [documentazione eBay sul throttling](https://developer.ebay.com/api-docs/static/rest-troubleshooting.html) per dettagli aggiornati.

## Privacy e Telegram

I messaggi del bot possono contenere **codici fiscali e dati dell'acquirente**. Limita l'accesso alle chat autorizzate (`TELEGRAM_ALLOWED_CHAT_IDS`), ricorda che Telegram può conservare la cronologia chat e valuta backup/dispositivi collegati. Il file di stato e, dove supportato, il file di lock del bot vengono scritti con permessi **600** (solo il tuo utente).

## Configurazione

Imposta queste variabili ambiente:

```bash
export EBAY_CLIENT_ID="..."
export EBAY_CLIENT_SECRET="..."
export EBAY_REFRESH_TOKEN="..."
export EBAY_ENVIRONMENT="production"
export EBAY_SCOPES="https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly"
```

Opzionali (resilienza e tuning):

```bash
export EBAY_HTTP_MAX_RETRIES="5"
export EBAY_HTTP_RETRY_BASE_DELAY="0.5"
export EBAY_TOKEN_SKEW_SECONDS="60"
export EBAY_ORDER_DETAIL_DELAY_SECONDS="0"
export LOG_LEVEL="WARNING"
```

Per ottenere il `refresh_token` devi usare il flusso OAuth ufficiale eBay con consenso utente almeno una volta.

## Installazione locale

Dal clone del repository:

```bash
python3 -m pip install .
```

Dopo l’installazione sono disponibili gli entry point `ebay-cf` e `ebay-telegram-bot` (definiti in `pyproject.toml`).

Per eseguire senza installare:

```bash
python3 src/ebay_cf_tool.py --help
python3 src/telegram_bot.py
```

## Utilizzo CLI

Ordini ultimi 7 giorni:

```bash
python3 src/ebay_cf_tool.py
# oppure: ebay-cf
```

Solo ordini con identificativo fiscale presente:

```bash
python3 src/ebay_cf_tool.py --only-found
```

Esporta CSV:

```bash
python3 src/ebay_cf_tool.py --format csv --output risultati.csv
```

Leggi un ordine specifico:

```bash
python3 src/ebay_cf_tool.py --order-id "12-34567-89012"
```

Finestra temporale esplicita:

```bash
python3 src/ebay_cf_tool.py \
  --created-after "2026-04-01T00:00:00Z" \
  --created-before "2026-04-03T23:59:59Z"
```

## Bot Telegram

Variabili ambiente aggiuntive:

```bash
export TELEGRAM_BOT_TOKEN="..."
export TELEGRAM_ALLOWED_CHAT_IDS="123456789"
export TELEGRAM_NOTIFY_CHAT_IDS="123456789"
export TELEGRAM_POLL_TIMEOUT="30"
export TELEGRAM_BOT_LOCK_PATH="data/telegram_bot.lock"
export EBAY_ORDER_POLL_INTERVAL="120"
export EBAY_ORDER_STATE_PATH="data/notified_orders.json"
export EBAY_NOTIFY_RETRY_PATH="data/failed_notifications.json"
export TELEGRAM_HTTP_MAX_RETRIES="5"
export TELEGRAM_HTTP_RETRY_BASE_DELAY="0.5"
```

`TELEGRAM_ALLOWED_CHAT_IDS` è opzionale ma consigliato. Puoi inserire uno o più chat id separati da virgola.

`TELEGRAM_NOTIFY_CHAT_IDS` definisce le chat che ricevono in automatico i nuovi ordini. Se non lo imposti, il bot usa gli stessi id di `TELEGRAM_ALLOWED_CHAT_IDS`.

All’avvio il bot prova a prendere un **lock esclusivo** sul file `TELEGRAM_BOT_LOCK_PATH` (tramite `fcntl`, su Unix/macOS) così non restano due processi con lo stesso token in concorrenza su `getUpdates`. Su Windows il lock non è disponibile: in quel caso compare un warning nei log.

Il processo gestisce **SIGTERM** (utile con systemd/Docker) per uscire in modo ordinato dopo il turno corrente di aggiornamenti.

Avvio bot:

```bash
python3 src/telegram_bot.py
# oppure: ebay-telegram-bot
```

Comandi supportati:

- `/help`
- `/ping`
- `/stato`
- `/ultimi 7 20`
- `/tutti 7 20`
- `/ordine 12-34567-89012`

Parametri `/ultimi` e `/tutti`: giorni tra 1 e 365, massimo ordini tra 1 e 500 (valori predefiniti 7 e 20 se omessi).

Comportamento:

- `/ultimi` mostra solo gli ordini in cui eBay restituisce un identificativo fiscale
- `/tutti` mostra anche gli ordini senza CF
- `/ordine` legge un ordine specifico
- Il bot usa long polling verso Telegram Bot API e richiama poi le API ufficiali eBay
- In parallelo controlla periodicamente gli ordini eBay e invia automaticamente un messaggio per ogni nuovo `orderId` non ancora notificato
- Le notifiche automatiche partono solo se eBay restituisce `taxIdentifierType=CODICE_FISCALE` e il relativo valore è presente
- Gli `orderId` già inviati vengono salvati nel file stato locale (`EBAY_ORDER_STATE_PATH`) per evitare duplicati dopo riavvii
- Deduplica più robusta: oltre a `orderId`, viene tracciato anche un hash del contenuto ordine già notificato
- Se l'invio Telegram fallisce, il messaggio entra in una coda locale (`EBAY_NOTIFY_RETRY_PATH`) e viene ritentato a ogni ciclo di polling
- `/stato` mostra ultimo check, metriche minime (ordini analizzati, notifiche inviate, errori), dimensione coda retry e ultimo errore

## Invio automatico nuovi ordini

Se il bot resta acceso:

- ogni `EBAY_ORDER_POLL_INTERVAL` secondi legge gli ordini più recenti
- confronta gli `orderId` con quelli già notificati
- invia in automatico solo gli ordini che hanno davvero `CODICE_FISCALE` presente nei dati restituiti da eBay

Esempio completo:

```bash
export EBAY_CLIENT_ID="..."
export EBAY_CLIENT_SECRET="..."
export EBAY_REFRESH_TOKEN="..."
export EBAY_ENVIRONMENT="production"
export TELEGRAM_BOT_TOKEN="..."
export TELEGRAM_ALLOWED_CHAT_IDS="123456789"
export TELEGRAM_NOTIFY_CHAT_IDS="123456789"
export EBAY_ORDER_POLL_INTERVAL="120"
python3 src/telegram_bot.py
```

## Output atteso

Le colonne principali sono:

- `orderId`
- `creationDate`
- `buyerUsername`
- `taxpayerId`
- `taxIdentifierType`
- `issuingCountry`
- `found`

## Test e CI

```bash
python3 -m unittest discover -s tests -v
```

Su GitHub Actions il workflow `.github/workflows/ci.yml` esegue gli stessi test su Python 3.10 e 3.12.

## Riferimenti ufficiali eBay

- Fulfillment API `getOrders`: https://developer.ebay.com/api-docs/sell/fulfillment/resources/order/methods/getOrders
- Fulfillment API `getOrder`: https://developer.ebay.com/api-docs/sell/fulfillment/resources/order/methods/getOrder
- OAuth refresh token flow: https://developer.ebay.com/api-docs/static/oauth-refresh-token-request.html
