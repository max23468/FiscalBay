# Modello Dati

Panoramica dei modelli attuali e dei modelli futuri più probabili.

## Modelli attuali

### `Config`

Definisce:

- `client_id`
- `client_secret`
- `refresh_token`
- `environment`
- `scopes`

Uso:

- configurazione eBay di base per CLI e percorsi legacy amministrativi

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

- modello tipizzato per tenant Telegram, access approval e anagrafica minima runtime

Stati attesi:

- `new`
- `pending`
- `approved`
- `blocked`
- `admin`

Nota di compatibilità:

- alias legacy come `active` e `rejected` vengono normalizzati nel dominio rispettivamente a `approved` e `blocked`
- il runtime deduce ora le capability operative a partire da questo stato canonico

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

Stati attesi:

- `linked`
- `disconnected`
- `revoked`

### `OperationQueueEntry`

Definisce:

- `id`
- `operation_type`
- `status`
- `actor_telegram_user_id`
- `target_telegram_user_id`
- `available_at`
- `payload_json`
- `result_json`
- `last_error`
- `attempts`
- `created_at`
- `updated_at`

Uso:

- coda operativa minima in SQLite per applicazioni sensibili e recovery periodico
- oggi usata soprattutto per `apply_user_access_state`

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

- oggi è il modello tipizzato più importante per ridurre i `dict` legacy
- i servizi `orders`, `notifications` e il fetch condiviso CLI/bot lavorano ormai principalmente su questo modello
- anche il rendering testuale e le notifiche Telegram passano principalmente da questo modello; le conversioni legacy rimaste sono concentrate nei wrapper compatibili

### `BotMetrics`

Contiene:

- `orders_read`
- `orders_with_fiscal_identifier`
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

Lo stesso SQLite ora può ospitare anche tabelle tenant-aware per:

- utenti Telegram
- chat Telegram
- account eBay collegati
- token eBay per account
- subscription notifiche
- stato runtime per tenant
- snapshot sintetico per tenant
- audit log append-only per eventi sensibili
- operation queue per workflow differibili

Compatibilità mantenuta:

- i vecchi file JSON vengono migrati automaticamente a SQLite
- se il database non contiene ancora tenant configurati, restano disponibili i percorsi legacy compatibili dove previsti
- quando una chat Telegram è già stata registrata nel DB, i comandi del bot possono risolvere il tenant e leggere stato runtime e retry queue del tenant invece del solo stato globale
- il fetch applicativo può ora risolvere dal DB anche l'account eBay collegato e il relativo `environment`, pur continuando a usare credenziali globali finché non esistono token utente reali
- la scelta finale tra credenziali tenant-specifiche e fallback globale passa ora da un contesto applicativo esplicito, invece di essere implicita nei singoli caller
- `tenant_status_snapshots` materializza l'ultimo stato utile del tenant per dashboard admin, healthcheck e review operative senza ricalcolare ogni volta account, token, subscription e runtime memory

## Modelli futuri da introdurre

## Schema multiutente target minimo

La progettazione attuale fissa questo assetto minimo per il servizio pubblico con accesso approvato.

### `telegram_users`

Campi minimi:

- `id`
- `telegram_user_id`
- `username`
- `display_name`
- `status`
- `created_at`
- `updated_at`

Note:

- `telegram_user_id` è la chiave logica del tenant
- lo user record resta indipendente dalle singole chat
- `status` governa il workflow di accesso approvato del servizio

### `telegram_chats`

Campi minimi:

- `id`
- `telegram_user_id`
- `telegram_chat_id`
- `chat_type`
- `is_primary`
- `notifications_enabled`
- `created_at`
- `updated_at`

Note:

- serve a non confondere utente e chat
- permette in futuro più chat per lo stesso utente
- nel runtime attuale è già usata per risolvere lo scoping dei comandi del bot insieme a `telegram_user_id`

### `ebay_accounts`

Campi minimi:

- `id`
- `telegram_user_id`
- `ebay_user_id`
- `environment`
- `status`
- `linked_at`
- `updated_at`

Note:

- per la prima beta il vincolo è un solo account attivo per utente e per environment
- lo stesso `ebay_user_id` può comparire su più utenti Telegram distinti
- il supporto multi-account per utente viene esplicitamente rinviato
- lo stato locale può passare da `linked` a `disconnected` quando l'utente usa `/account scollega`
- un nuovo OAuth completato per lo stesso utente Telegram sostituisce
  l'identità eBay precedente nello stesso environment

### `ebay_tokens`

Possibili campi:

- `id`
- `ebay_account_id`
- `access_token`
- `refresh_token_encrypted`
- `scope_set`
- `expires_at`
- `updated_at`

Note:

- il refresh token va cifrato a riposo
- l'access token può restare cache runtime o storage breve, ma il refresh token non deve stare in env globali
- il lifecycle deve supportare refresh riuscito, refresh fallito, token scaduto, token revocato e richiesta di riconnessione utente
- oggi `/account scollega` porta localmente il token in stato `revoked` e pulisce i segreti dal DB della VPS

### `notification_subscriptions`

Possibili campi:

- `id`
- `telegram_user_id`
- `telegram_chat_id`
- `enabled`
- `filters`
- `created_at`
- `updated_at`

Note:

- il modello serve anche come base per attivare o disattivare notifiche per singola chat senza rompere l'isolamento per utente

### `oauth_link_sessions`

Possibili campi:

- `id`
- `telegram_user_id`
- `telegram_chat_id`
- `provider`
- `environment`
- `oauth_state`
- `code_verifier` o equivalente
- `redirect_uri`
- `status`
- `expires_at`
- `created_at`

Stato attuale:

- il modello e la tabella esistono già nel progetto corrente
- `/account collega` salva già una sessione preliminare con `oauth_state`, `status=pending`, expiry, environment e correlazione Telegram utente/chat
- il callback OAuth usa già lo stato sessione per chiudere il collegamento e aggiornare account/token nel DB
- il campo `redirect_uri` conserva oggi l'URL di callback pubblico atteso dal progetto; verso eBay il valore usato come `redirect_uri` è invece il `RuName` configurato a parte

### `tenant_runtime_state`

Possibili campi:

- `id`
- `telegram_user_id`
- `last_check`
- `last_error`
- `metrics_json`
- `updated_at`

Note:

- nel servizio attuale può restare un payload aggregato, ma la chiave di ownership deve essere il tenant utente
- il comando Telegram `/stato` usa già questo stato tenant-aware quando il bot riesce a risolvere utente e chat dal DB

## Vincoli futuri

- nessuna credenziale eBay deve restare globale quando inizierà la multiutenza
- i token utente dovranno essere cifrati a riposo
- il modello dati dovrà introdurre isolamento per tenant e audit minimo
- nel servizio attuale il modello resta compatibile con SQLite, ma deve essere facilmente migrabile a Postgres
