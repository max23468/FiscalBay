# Contesto Progetto

Questo documento è un handoff rapido per nuove conversazioni tecniche. Non è un
runbook completo: i dettagli di deploy, recovery, hardening, dati, OAuth e
storico operativo vivono nei documenti specialistici indicati sotto.

Non inserire segreti, token, refresh token, password o chiavi private in questo
file.

## Stato progetto

- Fase: servizio Telegram-first pubblico con accesso approvato e VPS operativa.
- Versione/release: `../CHANGELOG.md`, tag GitHub e
  `docs/RELEASE_POLICY.md` sono la source of truth.
- Deploy corrente: VPS `fiscalbay-bot`, via script locali/VPS fuori da GitHub
  Actions.
- Runtime: Python `>=3.13` nel manifest; runtime operativo controllato su VPS
  con Python `3.13`.
- Source of truth: `AGENTS.md`, `docs/INDEX.md`, `docs/ROADMAP.md`,
  `docs/TOOLCHAIN.md`, `docs/DECISIONS.md`,
  `docs/DECISIONS_PENDING.md` e documenti operativi collegati.
- Pubblicazione proporzionata: docs-only richiede review documentale e
  `git diff --check`, senza deploy o release.

## Cos'è FiscalBay

FiscalBay legge ordini eBay tramite API ufficiali e mostra l'identificativo
fiscale solo quando eBay restituisce davvero `buyer.taxIdentifier` con tipo e
valore valorizzati.

Modalità principali:

- CLI locale per interrogazioni manuali;
- bot Telegram con accesso approvato, comandi operativi e notifiche automatiche;
- callback OAuth e worker di reconciliation su VPS.

Perimetro attuale:

- servizio pubblico raggiungibile su Telegram;
- uso in chat privata col bot;
- accesso approvato da admin;
- tenant-aware sul piano applicativo;
- un account eBay collegato per utente, senza scelta account/environment lato UX;
- singola VPS Linux come runtime operativo.

Fuori perimetro senza decisione esplicita:

- gestionale fiscale completo;
- dashboard eBay generalista;
- suite analytics o reportistica ampia;
- piattaforma web-first;
- bot per gruppi o supergruppi Telegram.

## Fonti primarie e documenti da leggere

- Regole operative: `AGENTS.md`.
- Indice documentale: `docs/INDEX.md`.
- Architettura: `docs/ARCHITECTURE.md`.
- Modello dati: `docs/DATA_MODEL.md`.
- OAuth e onboarding: `docs/OAUTH_FLOW.md`.
- Runbook VPS: `docs/RUNBOOK.md`.
- Operazioni e rollback: `docs/OPERATIONS.md`.
- Sicurezza: `docs/SECURITY_OPERATIONS.md`.
- Governance servizio: `docs/SERVICE_GOVERNANCE.md`.
- Release e versioning: `docs/RELEASE_POLICY.md`.
- Readiness stabile: `docs/RELEASE_READINESS.md`.
- Toolchain: `docs/TOOLCHAIN.md`.
- Roadmap e backlog: `docs/ROADMAP.md`, `docs/BACKLOG.md`.
- Decisioni: `docs/DECISIONS.md`, `docs/DECISIONS_PENDING.md`,
  `docs/decisions/`.

## Componenti principali

- `src/fiscalbay/cli.py`: utility CLI.
- `src/fiscalbay/bot.py`: wiring del bot Telegram.
- `src/fiscalbay/telegram_commands.py`: parsing e rendering comandi.
- `src/fiscalbay/services/orders.py`: fetch e normalizzazione ordini.
- `src/fiscalbay/services/notifications.py`: deduplica, notifiche e retry.
- `src/fiscalbay/services/telegram_runtime.py`: polling Telegram e lifecycle.
- `src/fiscalbay/clients/ebay.py`: API eBay.
- `src/fiscalbay/clients/telegram.py`: Telegram Bot API.
- `src/fiscalbay/storage/sqlite.py`: stato applicativo e migrazioni SQLite.
- `src/fiscalbay/healthcheck.py`: controlli runtime.
- `src/fiscalbay/git_utils.py`: helper git-safe locali.

## Runtime operativo

- VPS corretta: `opc@79.72.45.89`, hostname atteso `fiscalbay-bot`.
- Path progetto su VPS: `/opt/fiscalbay`.
- Virtualenv applicativo: `/opt/fiscalbay/.venv`.
- Env runtime: `/opt/fiscalbay/.env`, mai da copiare in repo o chat.
- Database runtime: `data/state.db`.
- Servizi principali: `fiscalbay-bot`, `fiscalbay-oauth`,
  `fiscalbay-reconcile.timer`, `fiscalbay-alertcheck.timer`.
- Deploy standard: `scripts/deploy_now.sh` quando il cambio richiede runtime VPS.
- Release versionata: `scripts/release_now.sh` quando la modifica è
  rilasciabile secondo policy.
- Healthcheck: `"/opt/fiscalbay/.venv/bin/fiscalbay-healthcheck" --json`.

La manutenzione VPS, backup, restore, hardening SSH, risorse macchina, Duck DNS,
nginx/HTTPS e playbook incidente sono in `docs/RUNBOOK.md`,
`docs/OPERATIONS.md` e `docs/SECURITY_OPERATIONS.md`.

## Handoff per nuova chat

Prima di procedere:

1. leggere `AGENTS.md`;
2. controllare `git status --short --branch`;
3. leggere `docs/INDEX.md`, `docs/CONTEXT.md`, `docs/ROADMAP.md`,
   `docs/BACKLOG.md`, `docs/TOOLCHAIN.md` e i documenti vicini al task;
4. se il task tocca runtime, deploy, OAuth, storage, segreti o VPS, leggere
   `docs/RUNBOOK.md`, `docs/OPERATIONS.md`, `docs/OAUTH_FLOW.md` e
   `docs/SECURITY_OPERATIONS.md`;
5. controllare Codex feedback inbox prima di PR ready, merge, publish, deploy o
   release;
6. scegliere verifiche proporzionate: docs-only di solito review documentale e
   `git diff --check`; runtime o config richiede `bash scripts/ci_verify.sh` e
   controlli operativi pertinenti.

## Rischi e blocchi aperti

- Non dedurre dati fiscali se eBay non li espone.
- Non usare VPS, host o procedure di altri progetti.
- Non trattare GitHub Actions come canale operativo di deploy FiscalBay.
- SQLite e singola VPS sono accettati solo per il perimetro pubblico piccolo con
  accesso approvato.
- Un'apertura pubblica più ampia richiede Postgres o storage equivalente,
  backup/restore più formalizzati, osservabilità più ricca e gestione segreti
  più robusta.
- Restano da monitorare cancellazione utente self-service completa, ruoli admin
  multipli, storico alert prodotto e ulteriore automazione della revoca consenso
  eBay se eBay offrirà un percorso OAuth applicabile.

## Prossimo passo

Seguire `docs/ROADMAP.md` per il lavoro residuo. Aggiornare questo file solo
quando cambiano stato progetto, runtime, host/VPS, workflow operativo, deploy,
release, rischi principali o documenti di handoff.
