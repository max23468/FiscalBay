# Modello Dati

Panoramica dei modelli attuali e dei modelli futuri piu' probabili.

## Modelli attuali

### `Config`

Definisce:

- `client_id`
- `client_secret`
- `refresh_token`
- `environment`
- `scopes`

Uso:

- configurazione eBay globale single-tenant

### `FetchOptions`

Definisce:

- finestra temporale
- limiti
- eventuali `order_ids`
- filtro `only_found`

Uso:

- CLI
- comandi Telegram
- notifiche automatiche

### `TelegramConfig`

Definisce:

- token bot
- chat autorizzate
- chat da notificare
- path stato, retry queue e lock
- timing di polling

### `TelegramUser`

Definisce:

- `telegram_user_id`
- `telegram_chat_id`
- `username`
- `display_name`
- `created_at`
- `status`

Uso:

- modello tipizzato preparatorio per la futura multiutenza

### `LinkedEbayAccount`

Definisce:

- `id`
- `telegram_user_id`
- `ebay_user_id`
- `environment`
- `scopes`
- `linked_at`
- `status`

Uso:

- modello tipizzato preparatorio per l'associazione tra utente Telegram e account eBay

### `OrderRecord`

Rappresenta l'ordine eBay normalizzato usato dal dominio applicativo.

Campi principali:

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

Nota:

- oggi e' il modello tipizzato piu' importante per ridurre i `dict` legacy
- i servizi `orders`, `notifications` e il fetch condiviso CLI/bot lavorano ormai principalmente su questo modello
- anche il rendering testuale e le notifiche Telegram passano principalmente da questo modello; le conversioni legacy rimaste sono concentrate nei wrapper compatibili

### `BotMetrics`

Contiene:

- `orders_read`
- `orders_with_cf`
- `notifications_sent`
- `telegram_retries`
- `consecutive_error_cycles`
- `errors_by_type`

### `BotRuntimeState`

Contiene:

- `notified_order_ids`
- `notified_hashes`
- `last_check`
- `last_error`
- `metrics`

Uso:

- stato runtime tipizzato per notifiche automatiche, healthcheck e stato del bot
- le conversioni da payload SQLite legacy restano ai bordi del sistema

### `RetryQueueEntry`

Contiene:

- `id`
- `chat_id`
- `text`
- `attempts`

Uso:

- entry tipizzato della coda retry Telegram
- usato direttamente dai servizi applicativi e dallo storage adattatore

## Persistenza attuale

Lo stato runtime vive in `data/state.db` e comprende:

- stato notifiche
- metriche
- retry queue

Compatibilita' mantenuta:

- i vecchi file JSON vengono migrati automaticamente a SQLite

## Modelli futuri da introdurre

### `EbayTokenSet`

Possibili campi:

- `account_id`
- `access_token`
- `refresh_token_encrypted`
- `expires_at`
- `updated_at`

### `NotificationSubscription`

Possibili campi:

- `telegram_user_id`
- `chat_id`
- `enabled`
- `filters`
- `created_at`

## Vincoli futuri

- nessuna credenziale eBay deve restare globale quando iniziera' la multiutenza
- i token utente dovranno essere cifrati a riposo
- il modello dati dovra' introdurre isolamento per tenant e audit minimo
