# Registro Modifiche

## Indice rapido

- `In lavorazione`
  - modifiche non ancora pubblicate o consolidate

Documenti collegati:

- `docs/INDEX.md`
- `docs/ARCHITECTURE.md`
- `docs/ROADMAP.md`

## In lavorazione

- roadmap riallineata rimuovendo dalla checklist gli item gia' completati (chat private, account singolo per utente, workflow accesso approvato, mono-admin, viste `pending` e messaggistica accesso)
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
- aggiunti `reconcile.py` e una `operation_queue` SQLite minima per il recovery dei workflow sensibili; il deploy VPS prevede ora anche `ebaycf-reconcile.timer`

### Added

- `src/ebay_cf/telegram_commands.py` per parsing, menu e rendering Telegram.
- `src/ebay_cf/services/notifications.py` per stato runtime, retry queue e notifiche automatiche.
- `src/ebay_cf/services/telegram_runtime.py` per polling Telegram, callback e lifecycle del runtime.
- `src/ebay_cf/retry.py` per retry/backoff condiviso tra client e runtime.
- `src/ebay_cf/application.py` come facciata condivisa per il fetch ordini usato da CLI e bot.
- modelli tipizzati in `src/ebay_cf/models.py` per stato bot, metriche, retry queue e ordini normalizzati.
- modelli tipizzati `TelegramUser` e `LinkedEbayAccount` in `src/ebay_cf/models.py` per preparare la fase multiutente.
- API storage tipizzate in `src/ebay_cf/storage/sqlite.py` per stato runtime e retry queue.
- ADR leggere in `docs/adr/` per documentare le decisioni principali del refactor fase 2.

### Changed

- la roadmap entra nella nuova fase 3 con una progettazione multiutente piu' concreta: schema dati iniziale, milestone tecnica e direzione database sono ora fissati nei documenti stabili.
- `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, `docs/OAUTH_FLOW.md` e `docs/MILESTONE_BOARD.md` descrivono ora il target tenant-aware minimo, la separazione tra utente e chat, la strategia token per utente e la scelta SQLite ora / Postgres prima dell'apertura pubblica.
- `docs/CONTEXT.md` e `docs/SECURITY.md` trattano ora esplicitamente la multiutenza come cambio di natura del progetto e collegano la roadmap ai finding audit su segreti globali, stato condiviso e assenza di audit/rate limiting per tenant.
- la prima beta privata multiutente e' ora vincolata a `1 account eBay attivo per utente per environment`, refresh token cifrato a riposo, lifecycle token esplicito, audit log minimo e rate limiting per utente.
- `src/ebay_cf/storage/sqlite.py`, `src/ebay_cf/models.py` e `src/ebay_cf/bot.py` iniziano ora a introdurre la base tecnica tenant-aware: tabelle SQLite per utenti/chat/account/token/subscription, stato runtime per tenant e scheduler notifiche con fallback single-tenant compatibile.
- `src/ebay_cf/services/telegram_runtime.py` e `src/ebay_cf/bot.py` iniziano anche a registrare utenti/chat/subscription dal traffico Telegram reale, cosi' la migrazione multiutente puo' partire senza fermare il bot in VPS.
- `src/ebay_cf/storage/sqlite.py`, `src/ebay_cf/services/telegram_runtime.py` e `src/ebay_cf/bot.py` risolvono ora il tenant dai dati runtime Telegram e fanno leggere ai comandi del bot lo stato tenant-aware per chat/utente, mantenendo fallback globale sul DB VPS quando la mappatura non esiste ancora.
- `src/ebay_cf/application.py`, `src/ebay_cf/storage/sqlite.py` e `src/ebay_cf/bot.py` centralizzano ora anche la risoluzione dell'account eBay collegato e dell'environment per tenant, cosi' notifiche e comandi usano un'unica facciata tenant-aware pur restando in fallback su `.env` globale fino alla fase OAuth.
- `src/ebay_cf/application.py` espone ora un contesto di fetch risolto esplicitamente, che distingue tra sorgente credenziali `tenant_store` e `global_env`; oggi il deploy VPS resta in fallback su `.env`, ma il punto di ingresso per token per tenant e' pronto.
- `src/ebay_cf/tenant_credentials.py`, `src/ebay_cf/config.py` e `src/ebay_cf/storage/sqlite.py` introducono il primo adapter reale per refresh token tenant, con default sicuro: sulla VPS il fallback resta globale finche' non viene attivata una decifratura reale dei token utente.
- `src/ebay_cf/healthcheck.py` e `src/ebay_cf/storage/sqlite.py` espongono ora anche la readiness multi-tenant del DB nel report operativo, utile su VPS per capire se utenti, account, token e subscription stanno davvero convergendo verso il multiutente reale.
- `src/ebay_cf/bot.py` e `src/ebay_cf/telegram_commands.py` fanno ora emergere anche in `/stato` lo scope runtime e la sorgente credenziali, cosi' il fallback globale residuo e' visibile direttamente dalla chat e non solo dal healthcheck.
- `src/ebay_cf/bot.py`, `src/ebay_cf/telegram_commands.py` e `src/ebay_cf/storage/sqlite.py` introducono `/account`, che mostra in modo tenant-aware lo stato del collegamento eBay gia' registrato nel DB e prepara il terreno per `/connect` e `/disconnect`.
- `src/ebay_cf/bot.py`, `src/ebay_cf/telegram_commands.py`, `src/ebay_cf/models.py` e `src/ebay_cf/storage/sqlite.py` introducono ora anche `/connect` come entrypoint reale: il bot crea una `oauth_link_sessions` preliminare, la salva nel `state.db` della VPS e restituisce un link pubblico quando e' configurata `EBAY_OAUTH_CONNECT_BASE_URL`.
- `src/ebay_cf/bot.py`, `src/ebay_cf/telegram_commands.py` e `src/ebay_cf/storage/sqlite.py` introducono anche `/disconnect`, che scollega localmente l'account tenant, revoca il token nel DB e pulisce i segreti dal runtime persistito sulla VPS.
- `src/ebay_cf/bot.py`, `src/ebay_cf/telegram_commands.py` e `src/ebay_cf/storage/sqlite.py` introducono anche `/notifications on|off` e `/settings`, cosi' la singola chat puo' gestire in autonomia le notifiche e vedere il proprio riepilogo tenant-aware.
- `src/ebay_cf/oauth_server.py`, `src/ebay_cf/clients/ebay.py`, `src/ebay_cf/storage/sqlite.py` e `src/ebay_cf/tenant_credentials.py` introducono il callback server OAuth minimale: `/oauth/start` valida `state`, `/oauth/callback` scambia il `code`, salva account/token tenant e conferma il collegamento via Telegram.
- `src/ebay_cf/oauth_server.py`, `tests/test_oauth_server.py`, `.env.example` e i documenti operativi chiariscono ora il vincolo eBay sul `RuName`: verso eBay il `redirect_uri` usa `EBAY_OAUTH_RUNAME` o `EBAY_OAUTH_RUNAME_SANDBOX`, mentre la callback pubblica del progetto resta separata e deve coincidere con l'Accept URL registrata nel portale developer.
- `src/ebay_cf/oauth_server.py` e `src/ebay_cf/clients/ebay.py` arricchiscono ora il consenso OAuth con `commerce.identity.readonly` e tentano `GET /commerce/identity/v1/user/`, cosi' i nuovi collegamenti salvano un identificativo account eBay reale invece del placeholder locale.
- `src/ebay_cf/config.py`, `src/ebay_cf/bot.py` e `src/ebay_cf/services/telegram_runtime.py` introducono `TELEGRAM_ADMIN_USER_ID`: il bot puo' ora restare mono-admin in modo esplicito, bloccando comandi, callback e persistenza runtime degli altri utenti Telegram.
- `src/ebay_cf/bot.py`, `src/ebay_cf/telegram_commands.py`, `src/ebay_cf/storage/sqlite.py` e `src/ebay_cf/services/telegram_runtime.py` aggiungono ora il workflow di approvazione: utenti `new/pending/approved/blocked`, `/request_access`, notifiche admin con pulsanti inline e comandi `/users`, `/approve_user`, `/reject_user`.
- `src/ebay_cf/storage/sqlite.py`, `src/ebay_cf/bot.py` e `src/ebay_cf/oauth_server.py` introducono un audit log minimo append-only nel `state.db` per `request_access`, `approve`, `reject`, `connect`, `disconnect`, `oauth_success` e `oauth_failure`.
- `src/ebay_cf/tenant_credentials.py` passa ora a cifratura Fernet per i refresh token tenant con chiave `EBAY_TENANT_TOKEN_KEY`; il fallback plaintext resta solo esplicito per beta privata/dev.
- `src/ebay_cf/models.py`, `src/ebay_cf/bot.py`, `src/ebay_cf/telegram_commands.py` e `src/ebay_cf/storage/sqlite.py` centralizzano ora stati workflow e capability, rendendo espliciti `new/pending/approved/blocked/admin`, i permessi associati e gli alias legacy.
- `src/ebay_cf/bot.py`, `src/ebay_cf/application.py` e `src/ebay_cf/reconcile.py` rendono idempotenti i processi sensibili di accesso e collegamento: approvazioni/rifiuti ripetuti non duplicano effetti e `/connect` riusa la sessione OAuth ancora valida.
- `src/ebay_cf/storage/sqlite.py` e `src/ebay_cf/reconcile.py` introducono `operation_queue` e un worker periodico di reconciliation per riallineare accessi, chat, subscription, sessioni OAuth stale e token incoerenti.
- `deploy/reconcile.sh`, `deploy/ebaycf-reconcile.service`, `deploy/ebaycf-reconcile.timer` e `deploy/linux-setup.sh` estendono il deploy VPS con una reconciliation periodica via `systemd`.
- `deploy/ebaycf-reconcile.service` carica ora anche virtualenv e `.env`, evitando che il worker periodico parta senza configurazione Telegram/eBay sulla VPS.
- `src/ebay_cf/application.py` e `src/ebay_cf/bot.py` chiudono ora il residuo di fase 3 nel runtime multiutente: con `TELEGRAM_ADMIN_USER_ID` configurato il bot usa credenziali tenant per i tenant collegati e non ricade piu' su `EBAY_REFRESH_TOKEN` condiviso.
- `docs/SERVICE_GOVERNANCE.md` fissa ora in modo stabile governance del servizio, dati trattati, retention, cancellazione utente e limiti dichiarati della beta privata.
- l'assetto di pianificazione e' stato poi riassorbito in `docs/ROADMAP.md`, mentre le decisioni residue restano in `docs/DECISIONS_PENDING.md`.
- `deploy/ebaycf-oauth.service`, `deploy/linux-setup.sh`, `deploy/update.sh` e `deploy/smoke-check.sh` estendono il deploy VPS con il servizio `systemd` separato `ebaycf-oauth`.
- la fase di onboarding self-service e' stata considerata sostanzialmente chiusa, lasciando aperti in roadmap solo i target multiutente residui e la governance prodotto.
- `src/ebay_cf/services/telegram_runtime.py` e `src/ebay_cf/services/notifications.py` emettono ora log piu' correlabili con `cycle_id` per polling, callback, messaggi e cicli notifica.
- `src/ebay_cf/healthcheck.py` espone anche metriche runtime aggregate leggibili in output testuale e JSON.
- `src/ebay_cf/models.py` e `src/ebay_cf/storage/sqlite.py` tracciano ora anche `orders_with_cf`, `telegram_retries` e `consecutive_error_cycles` dentro le metriche runtime.
- `src/ebay_cf/clients/ebay.py`, `src/ebay_cf/clients/telegram.py`, `src/ebay_cf/services/telegram_runtime.py`, `src/ebay_cf/services/notifications.py` e `src/ebay_cf/healthcheck.py` usano ora eventi di log piu' coerenti per retry, errori, polling, start/stop e health check.
- `deploy/linux-setup.sh` installa ora anche `deploy/alert-check.sh`, `ebaycf-alertcheck.service` ed `ebaycf-alertcheck.timer` per gli alert runtime minimi su servizio fermo, retry queue fuori soglia ed errori consecutivi.
- la rifondazione strutturale della fase 2 puo' considerarsi chiusa: dominio core tipizzato, retry condiviso, runtime/comandi/notifiche separati e percorso di release minimo esplicito in docs e CI.
- `src/ebay_cf/bot.py` ora funge soprattutto da facciata compatibile e punto di wiring.
- `src/ebay_cf/bot.py` concentra anche gli adattatori di compatibilita' per test e payload legacy, lasciando i servizi core piu' tipizzati.
- `src/ebay_cf/clients/ebay.py` e `src/ebay_cf/clients/telegram.py` usano retry centralizzato e mantengono alias compatibili per i nomi storici.
- `src/ebay_cf/errors.py` espone una gerarchia di errori applicativi piu' esplicita.
- `src/ebay_cf/healthcheck.py` e i servizi principali leggono lo stato tramite modelli tipizzati invece di dipendere da payload SQLite raw.
- i moduli introdotti nel refactor fase 2 sono stati riallineati al quality gate CI, con export espliciti in `bot.py` e pulizia degli import inutilizzati.
- `src/ebay_cf/models.py` usa conversioni tipizzate piu' esplicite per restare compatibile con `mypy` anche nel workflow CI su GitHub.
- `src/ebay_cf/services/orders.py` ora restituisce `OrderRecord` tipizzati invece di righe `dict` raw nei flussi principali.
- `src/ebay_cf/services/notifications.py` e `src/ebay_cf/telegram_commands.py` lavorano ora con modelli tipizzati sul percorso principale, delegando a `bot.py` le conversioni compatibili residue.
- il rendering CLI e Telegram e' stato riallineato a `OrderRecord`; i pochi payload legacy rimasti vengono adattati in `src/ebay_cf/bot.py` invece di propagarsi nei servizi.
- gli adattatori legacy del bot sono stati consolidati in helper espliciti, riducendo duplicazioni locali nel layer di compatibilita'.
