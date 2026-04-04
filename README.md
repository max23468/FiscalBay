# eBay CF Tool

Tool CLI per leggere gli ordini eBay e tentare l'estrazione del codice fiscale dell'acquirente tramite le API ufficiali eBay.

Ora include anche un bot Telegram che espone questi dati via chat.

## Cosa fa

- Usa OAuth con `refresh_token` eBay per ottenere un `User access token`
- Recupera gli ordini recenti con `getOrders`
- Legge il dettaglio di ogni ordine con `getOrder`
- Estrae `buyer.taxIdentifier.taxpayerId`
- Evidenzia il tipo di identificativo fiscale restituito da eBay, ad esempio `CODICE_FISCALE`
- Esporta in tabella, JSON o CSV

## Limite importante

Il campo fiscale **non è garantito per tutti gli ordini**. Secondo la documentazione ufficiale della Fulfillment API, l'identificativo fiscale è nel campo `buyer.taxIdentifier`, con enum che include `CODICE_FISCALE`. Se eBay non lo restituisce nell'ordine, il tool non può inventarlo o ricostruirlo.

## Configurazione

Imposta queste variabili ambiente:

```bash
export EBAY_CLIENT_ID="..."
export EBAY_CLIENT_SECRET="..."
export EBAY_REFRESH_TOKEN="..."
export EBAY_ENVIRONMENT="production"
export EBAY_SCOPES="https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly"
```

Per ottenere il `refresh_token` devi usare il flusso OAuth ufficiale eBay con consenso utente almeno una volta.

## Utilizzo

Ordini ultimi 7 giorni:

```bash
python3 src/ebay_cf_tool.py
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
export EBAY_ORDER_POLL_INTERVAL="120"
export EBAY_ORDER_STATE_PATH="data/notified_orders.json"
export EBAY_NOTIFY_RETRY_PATH="data/failed_notifications.json"
```

`TELEGRAM_ALLOWED_CHAT_IDS` è opzionale ma consigliato. Puoi inserire uno o più chat id separati da virgola.

`TELEGRAM_NOTIFY_CHAT_IDS` definisce le chat che ricevono in automatico i nuovi ordini. Se non lo imposti, il bot usa gli stessi id di `TELEGRAM_ALLOWED_CHAT_IDS`.

Avvio bot:

```bash
python3 src/telegram_bot.py
```

Comandi supportati:

- `/help`
- `/ping`
- `/stato`
- `/ultimi 7 20`
- `/tutti 7 20`
- `/ordine 12-34567-89012`

Comportamento:

- `/ultimi` mostra solo gli ordini in cui eBay restituisce un identificativo fiscale
- `/tutti` mostra anche gli ordini senza CF
- `/ordine` legge un ordine specifico
- Il bot usa long polling verso Telegram Bot API e richiama poi le API ufficiali eBay
- In parallelo controlla periodicamente gli ordini eBay e invia automaticamente un messaggio per ogni nuovo `orderId` non ancora notificato
- Le notifiche automatiche partono solo se eBay restituisce `taxIdentifierType=CODICE_FISCALE` e il relativo valore è presente
- Gli `orderId` già inviati vengono salvati nel file stato locale `data/notified_orders.json` per evitare duplicati dopo riavvii
- Deduplica più robusta: oltre a `orderId`, viene tracciato anche un hash del contenuto ordine già notificato
- Se l'invio Telegram fallisce, il messaggio entra in una coda locale (`data/failed_notifications.json`) e viene ritentato con backoff
- `/stato` mostra ultimo check, metriche minime (ordini analizzati, notifiche inviate, errori), coda retry e ultimo errore

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

## Test

```bash
python3 -m unittest discover -s tests
```

## Riferimenti ufficiali eBay

- Fulfillment API `getOrders`: https://developer.ebay.com/api-docs/sell/fulfillment/resources/order/methods/getOrders
- Fulfillment API `getOrder`: https://developer.ebay.com/api-docs/sell/fulfillment/resources/order/methods/getOrder
- OAuth refresh token flow: https://developer.ebay.com/api-docs/static/oauth-refresh-token-request.html
# eBayCF
