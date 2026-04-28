# Registro Modifiche

Nota: questo file resta come archivio narrativo storico.

Il changelog ufficiale delle release correnti e' ora `../CHANGELOG.md`, gestito
dal comando esplicito `scripts/release_now.sh`.

## Indice rapido

- `In lavorazione`
  - modifiche non ancora pubblicate o consolidate

Documenti collegati:

- `docs/INDEX.md`
- `docs/ARCHITECTURE.md`
- `docs/ROADMAP.md`

## In lavorazione

- unificata la pianificazione residua in `docs/ROADMAP.md`, che ora contiene anche la checklist operativa aperta
- il servizio viene ora descritto in modo coerente come bot pubblico con accesso approvato, non piu' come beta privata separata
- la roadmap e' stata riorganizzata in fasi piu' pratiche: onboarding pubblico controllato, guardrail admin, lifecycle dati e consolidamento del servizio
- la roadmap recepisce ora anche il posizionamento `Telegram first`, il target di servizio pubblico piccolo e curato, il lifecycle account/token esplicito e un cruscotto admin minimo via Telegram
- la roadmap integra ora anche onboarding Telegram adattivo, reconnect guidato, distinzione errore utente/servizio, tenant health admin, metriche prodotto minime, modalita' incidente e gestione tenant dormienti
- roadmap e documenti stabili fissano ora anche: solo chat privata, un solo admin globale, notifiche attive di default per utenti approvati, doppio percorso di uscita utente/account e approccio curato ai tenant inattivi
- la roadmap include ora anche comandi esplicativi come `/why_not_notified` e `/reconnect_status`, alert di prodotto e una review admin dedicata per tenant dormienti
- la roadmap recepisce ora anche un blocco di ottimizzazioni concrete: riduzione delle `getOrder` inutili, polling incrementale piu' stretto, deduplica piu' esplicita, scritture SQLite piu' contenute, percorsi hot/cold separati e indici mirati
- la roadmap include ora anche due ultime ottimizzazioni ad alto valore: snapshot sintetico dell'ultimo stato utile per tenant e separazione piu' netta tra discovery veloce ordini e percorso di explain/detail
- la roadmap integra ora anche un blocco completo di miglioramenti VPS: backup piu' ricostruibili, restore drill, monitor disco/memoria, check TLS esterni, hardening `systemd`, smoke deploy piu' ricco e playbook incidente piu' specifici
- documenti stabili e roadmap fissano ora anche due vincoli aggiuntivi: un solo account/environment gia' collegato per utente lato UX e una memoria operativa minima leggibile, ma non uno storico completo del prodotto
- la roadmap e' stata poi riorganizzata in piu' fasi semplici e leggibili, senza sottofasi: esperienza prodotto, guardrail/admin, lifecycle dati, ottimizzazione applicativa, robustezza VPS e consolidamento del servizio
- `docs/SERVICE_GOVERNANCE.md`, `docs/CONTEXT.md` e `docs/ARCHITECTURE.md` fissano ora esplicitamente il perimetro del prodotto, cosi' nuove feature possano essere valutate contro criteri di inclusione ed esclusione e non far deragliare il tool verso bloat o funzioni fuori scopo
- centralizzati gli stati workflow utente/account/sessione e il capability gating dei comandi Telegram, riducendo i check sparsi su stringhe legacy tra `bot.py` e `telegram_runtime.py`
- resi piu' idempotenti i flussi sensibili di accesso e collegamento: approvazioni ripetute non duplicano notifiche e `/connect` riusa la sessione OAuth pendente valida
- aggiunti `reconcile.py` e una `operation_queue` SQLite minima per il recovery dei workflow sensibili; il deploy VPS prevede ora anche `fiscalbay-reconcile.timer`

### Added

- `src/fiscalbay/telegram_commands.py` per parsing, menu e rendering Telegram.
- `src/fiscalbay/services/notifications.py` per stato runtime, retry queue e notifiche automatiche.
- `src/fiscalbay/services/telegram_runtime.py` per polling Telegram, callback e lifecycle del runtime.
- `src/fiscalbay/retry.py` per retry/backoff condiviso tra client e runtime.
- `src/fiscalbay/application.py` come facciata condivisa per il fetch ordini usato da CLI e bot.
- modelli tipizzati in `src/fiscalbay/models.py` per stato bot, metriche, retry queue e ordini normalizzati.
- modelli tipizzati `TelegramUser` e `LinkedEbayAccount` in `src/fiscalbay/models.py` per preparare la fase multiutente.
- API storage tipizzate in `src/fiscalbay/storage/sqlite.py` per stato runtime e retry queue.
- decisioni architetturali del refactor fase 2 consolidate in `docs/ARCHITECTURE.md` (sezione dedicata).

### Changed

- la roadmap entra nella nuova fase 3 con una progettazione multiutente piu' concreta: schema dati iniziale, milestone tecnica e direzione database sono ora fissati nei documenti stabili.
- `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, `docs/OAUTH_FLOW.md` e `docs/MILESTONE_BOARD.md` descrivono ora il target tenant-aware minimo, la separazione tra utente e chat, la strategia token per utente e la scelta SQLite ora / Postgres prima dell'apertura pubblica.
- `docs/CONTEXT.md` e `docs/SECURITY.md` trattano ora esplicitamente la multiutenza come cambio di natura del progetto e collegano la roadmap ai finding audit su segreti globali, stato condiviso e assenza di audit/rate limiting per tenant.
- la prima beta privata multiutente e' ora vincolata a `1 account eBay attivo per utente per environment`, refresh token cifrato a riposo, lifecycle token esplicito, audit log minimo e rate limiting per utente.
- `src/fiscalbay/storage/sqlite.py`, `src/fiscalbay/models.py` e `src/fiscalbay/bot.py` iniziano ora a introdurre la base tecnica tenant-aware: tabelle SQLite per utenti/chat/account/token/subscription, stato runtime per tenant e scheduler notifiche con fallback single-tenant compatibile.
- `src/fiscalbay/services/telegram_runtime.py` e `src/fiscalbay/bot.py` iniziano anche a registrare utenti/chat/subscription dal traffico Telegram reale, cosi' la migrazione multiutente puo' partire senza fermare il bot in VPS.
- `src/fiscalbay/storage/sqlite.py`, `src/fiscalbay/services/telegram_runtime.py` e `src/fiscalbay/bot.py` risolvono ora il tenant dai dati runtime Telegram e fanno leggere ai comandi del bot lo stato tenant-aware per chat/utente, mantenendo fallback globale sul DB VPS quando la mappatura non esiste ancora.
- `src/fiscalbay/application.py`, `src/fiscalbay/storage/sqlite.py` e `src/fiscalbay/bot.py` centralizzano ora anche la risoluzione dell'account eBay collegato e dell'environment per tenant, cosi' notifiche e comandi usano un'unica facciata tenant-aware pur restando in fallback su `.env` globale fino alla fase OAuth.
- `src/fiscalbay/application.py` espone ora un contesto di fetch risolto esplicitamente, che distingue tra sorgente credenziali `tenant_store` e `global_env`; oggi il deploy VPS resta in fallback su `.env`, ma il punto di ingresso per token per tenant e' pronto.
- `src/fiscalbay/tenant_credentials.py`, `src/fiscalbay/config.py` e `src/fiscalbay/storage/sqlite.py` introducono il primo adapter reale per refresh token tenant, con default sicuro: sulla VPS il fallback resta globale finche' non viene attivata una decifratura reale dei token utente.
- `src/fiscalbay/healthcheck.py` e `src/fiscalbay/storage/sqlite.py` espongono ora anche la readiness multi-tenant del DB nel report operativo, utile su VPS per capire se utenti, account, token e subscription stanno davvero convergendo verso il multiutente reale.
- `src/fiscalbay/bot.py` e `src/fiscalbay/telegram_commands.py` fanno ora emergere anche in `/stato` lo scope runtime e la sorgente credenziali, cosi' il fallback globale residuo e' visibile direttamente dalla chat e non solo dal healthcheck.
- `src/fiscalbay/bot.py`, `src/fiscalbay/telegram_commands.py` e `src/fiscalbay/storage/sqlite.py` introducono `/account`, che mostra in modo tenant-aware lo stato del collegamento eBay gia' registrato nel DB e prepara il terreno per `/connect` e `/disconnect`.
- `src/fiscalbay/bot.py`, `src/fiscalbay/telegram_commands.py`, `src/fiscalbay/models.py` e `src/fiscalbay/storage/sqlite.py` introducono ora anche `/connect` come entrypoint reale: il bot crea una `oauth_link_sessions` preliminare, la salva nel `state.db` della VPS e restituisce un link pubblico quando e' configurata `EBAY_OAUTH_CONNECT_BASE_URL`.
- `src/fiscalbay/bot.py`, `src/fiscalbay/telegram_commands.py` e `src/fiscalbay/storage/sqlite.py` introducono anche `/disconnect`, che scollega localmente l'account tenant, revoca il token nel DB e pulisce i segreti dal runtime persistito sulla VPS.
- `src/fiscalbay/bot.py`, `src/fiscalbay/telegram_commands.py` e `src/fiscalbay/storage/sqlite.py` introducono anche `/notifications on|off` e `/settings`, cosi' la singola chat puo' gestire in autonomia le notifiche e vedere il proprio riepilogo tenant-aware.
- `src/fiscalbay/oauth_server.py`, `src/fiscalbay/clients/ebay.py`, `src/fiscalbay/storage/sqlite.py` e `src/fiscalbay/tenant_credentials.py` introducono il callback server OAuth minimale: `/oauth/start` valida `state`, `/oauth/callback` scambia il `code`, salva account/token tenant e conferma il collegamento via Telegram.
- `src/fiscalbay/oauth_server.py`, `tests/test_oauth_server.py`, `.env.example` e i documenti operativi chiariscono ora il vincolo eBay sul `RuName`: verso eBay il `redirect_uri` usa `EBAY_OAUTH_RUNAME` o `EBAY_OAUTH_RUNAME_SANDBOX`, mentre la callback pubblica del progetto resta separata e deve coincidere con l'Accept URL registrata nel portale developer.
- `src/fiscalbay/oauth_server.py` e `src/fiscalbay/clients/ebay.py` arricchiscono ora il consenso OAuth con `commerce.identity.readonly` e tentano `GET /commerce/identity/v1/user/`, cosi' i nuovi collegamenti salvano un identificativo account eBay reale invece del placeholder locale.
- `src/fiscalbay/config.py`, `src/fiscalbay/bot.py` e `src/fiscalbay/services/telegram_runtime.py` introducono `TELEGRAM_ADMIN_USER_ID`: il bot puo' ora restare mono-admin in modo esplicito, bloccando comandi, callback e persistenza runtime degli altri utenti Telegram.
- `src/fiscalbay/bot.py`, `src/fiscalbay/telegram_commands.py`, `src/fiscalbay/storage/sqlite.py` e `src/fiscalbay/services/telegram_runtime.py` aggiungono ora il workflow di approvazione: utenti `new/pending/approved/blocked`, `/request_access`, notifiche admin con pulsanti inline e comandi `/users`, `/approve_user`, `/reject_user`.
- `src/fiscalbay/storage/sqlite.py`, `src/fiscalbay/bot.py` e `src/fiscalbay/oauth_server.py` introducono un audit log minimo append-only nel `state.db` per `request_access`, `approve`, `reject`, `connect`, `disconnect`, `oauth_success` e `oauth_failure`.
- `src/fiscalbay/tenant_credentials.py` passa ora a cifratura Fernet per i refresh token tenant con chiave `EBAY_TENANT_TOKEN_KEY`; il fallback plaintext resta solo esplicito per beta privata/dev.
- `src/fiscalbay/models.py`, `src/fiscalbay/bot.py`, `src/fiscalbay/telegram_commands.py` e `src/fiscalbay/storage/sqlite.py` centralizzano ora stati workflow e capability, rendendo espliciti `new/pending/approved/blocked/admin`, i permessi associati e gli alias legacy.
- `src/fiscalbay/bot.py`, `src/fiscalbay/application.py` e `src/fiscalbay/reconcile.py` rendono idempotenti i processi sensibili di accesso e collegamento: approvazioni/rifiuti ripetuti non duplicano effetti e `/connect` riusa la sessione OAuth ancora valida.
- `src/fiscalbay/storage/sqlite.py` e `src/fiscalbay/reconcile.py` introducono `operation_queue` e un worker periodico di reconciliation per riallineare accessi, chat, subscription, sessioni OAuth stale e token incoerenti.
- `deploy/reconcile.sh`, `deploy/fiscalbay-reconcile.service`, `deploy/fiscalbay-reconcile.timer` e `deploy/linux-setup.sh` estendono il deploy VPS con una reconciliation periodica via `systemd`.
- `deploy/fiscalbay-reconcile.service` carica ora anche virtualenv e `.env`, evitando che il worker periodico parta senza configurazione Telegram/eBay sulla VPS.
- `src/fiscalbay/application.py` e `src/fiscalbay/bot.py` chiudono ora il residuo di fase 3 nel runtime multiutente: con `TELEGRAM_ADMIN_USER_ID` configurato il bot usa credenziali tenant per i tenant collegati e non ricade piu' su `EBAY_REFRESH_TOKEN` condiviso.
- `docs/SERVICE_GOVERNANCE.md` fissa ora in modo stabile governance del servizio, dati trattati, retention, cancellazione utente e limiti dichiarati della beta privata.
- l'assetto di pianificazione e' stato poi riassorbito in `docs/ROADMAP.md`, mentre le decisioni residue restano in `docs/DECISIONS_PENDING.md`.
- `deploy/fiscalbay-oauth.service`, `deploy/linux-setup.sh`, `deploy/update.sh` e `deploy/smoke-check.sh` estendono il deploy VPS con il servizio `systemd` separato `fiscalbay-oauth`.
- la fase di onboarding self-service e' stata considerata sostanzialmente chiusa, lasciando aperti in roadmap solo i target multiutente residui e la governance prodotto.
- `src/fiscalbay/services/telegram_runtime.py` e `src/fiscalbay/services/notifications.py` emettono ora log piu' correlabili con `cycle_id` per polling, callback, messaggi e cicli notifica.
- `src/fiscalbay/healthcheck.py` espone anche metriche runtime aggregate leggibili in output testuale e JSON.
- `src/fiscalbay/models.py` e `src/fiscalbay/storage/sqlite.py` tracciano ora anche `orders_with_fiscal_identifier`, `telegram_retries` e `consecutive_error_cycles` dentro le metriche runtime.
- `src/fiscalbay/clients/ebay.py`, `src/fiscalbay/clients/telegram.py`, `src/fiscalbay/services/telegram_runtime.py`, `src/fiscalbay/services/notifications.py` e `src/fiscalbay/healthcheck.py` usano ora eventi di log piu' coerenti per retry, errori, polling, start/stop e health check.
- `deploy/linux-setup.sh` installa ora anche `deploy/alert-check.sh`, `fiscalbay-alertcheck.service` ed `fiscalbay-alertcheck.timer` per gli alert runtime minimi su servizio fermo, retry queue fuori soglia ed errori consecutivi.
- la rifondazione strutturale della fase 2 puo' considerarsi chiusa: dominio core tipizzato, retry condiviso, runtime/comandi/notifiche separati e percorso di release minimo esplicito in docs e CI.
- `src/fiscalbay/bot.py` ora funge soprattutto da facciata compatibile e punto di wiring.
- `src/fiscalbay/bot.py` concentra anche gli adattatori di compatibilita' per test e payload legacy, lasciando i servizi core piu' tipizzati.
- `src/fiscalbay/clients/ebay.py` e `src/fiscalbay/clients/telegram.py` usano retry centralizzato; nel client eBay i wrapper storici interni sono stati rimossi a favore dei nomi canonici.
- `src/fiscalbay/errors.py` espone una gerarchia di errori applicativi piu' esplicita.
- `src/fiscalbay/healthcheck.py` e i servizi principali leggono lo stato tramite modelli tipizzati invece di dipendere da payload SQLite raw.
- i moduli introdotti nel refactor fase 2 sono stati riallineati al quality gate CI, con export espliciti in `bot.py` e pulizia degli import inutilizzati.
- `src/fiscalbay/models.py` usa conversioni tipizzate piu' esplicite per restare compatibile con `mypy` anche nel workflow CI su GitHub.
- `src/fiscalbay/services/orders.py` ora restituisce `OrderRecord` tipizzati invece di righe `dict` raw nei flussi principali.
- `src/fiscalbay/services/notifications.py` e `src/fiscalbay/telegram_commands.py` lavorano ora con modelli tipizzati sul percorso principale, delegando a `bot.py` le conversioni compatibili residue.
- il rendering CLI e Telegram e' stato riallineato a `OrderRecord`; i pochi payload legacy rimasti vengono adattati in `src/fiscalbay/bot.py` invece di propagarsi nei servizi.
- gli adattatori legacy del bot sono stati consolidati in helper espliciti, riducendo duplicazioni locali nel layer di compatibilita'.
