# Proposte di code cleanup

Questo documento raccoglie una proposta pragmatica per ripulire il progetto `eBayCF` in modo incrementale, senza interrompere le funzionalità operative (CLI, bot Telegram, OAuth server, reconcile worker).

## 1) Priorità alta (quick wins)

### 1.1 Ridurre la superficie del modulo `bot.py`

- Oggi `src/ebay_cf/bot.py` è un modulo molto esteso e con responsabilità eterogenee (wiring, autorizzazioni, messaging, lock, OAuth linking, notifiche).
- Primo step consigliato: estrarre in moduli dedicati i blocchi più isolabili:
  - `bot_authz.py` per capability/status gating;
  - `bot_messaging.py` per `send_message`, chunking e fallback API 400;
  - `bot_oauth.py` per sessioni `/connect` e funzioni correlate;
  - `bot_locking.py` per lock di processo.
- Mantenere in `bot.py` solo l'orchestrazione e i re-export temporanei per compatibilità.

### 1.2 Ridurre la complessità di `storage/sqlite.py`

- `src/ebay_cf/storage/sqlite.py` è un “god module” (schema, migrazioni, repository runtime, account, retry queue, audit log).
- Split suggerito:
  - `storage/schema.py` (create/migrate/version);
  - `storage/runtime_repo.py` (state + metrics + retry);
  - `storage/access_repo.py` (users/chats/capability);
  - `storage/oauth_repo.py` (sessioni/account/token tenant);
  - `storage/audit_repo.py`.
- Mantenere una facciata `storage/sqlite.py` con import compatibili durante transizione.

### 1.3 Consolidare parser/config env

- In `config.py` c'è parsing diretto di env e cast `int(...)` sparsi.
- Introdurre helper riusabili (`read_int_env`, `read_csv_int_set`, `read_required_env`) per:
  - errori più chiari;
  - test più semplici;
  - minore duplicazione.

## 2) Priorità media (stabilizzazione)

### 2.1 Snellire il wrapper legacy `src/telegram_bot.py`

- Il wrapper importa moltissimi simboli con `# ruff: noqa` per retrocompatibilità.
- Piano:
  - deprecare gradualmente i re-export non necessari;
  - mantenere solo il minimo entrypoint (`run_bot`) + alias strettamente necessari;
  - documentare deadline di rimozione nel changelog.

### 2.2 Rafforzare la rete safety net (typing + coverage)

- `mypy` in strict è limitato a un sottoinsieme file.
- Coverage gate è al 64%, basso per un progetto con molte branching di business.
- Strategia consigliata:
  - allargare `mypy.files` a nuovi moduli ad ogni PR di refactor;
  - portare gradualmente `fail_under` (es. 64 -> 70 -> 75).

### 2.3 Ridurre aliasing/import noise nel bot

- In `bot.py` ci sono molti import alias `_qualcosa` solo per re-export.
- Spostare i re-export in un modulo `bot_api.py` e lasciare `bot.py` focalizzato sul runtime.

## 3) Priorità bassa (igiene strutturale)

### 3.1 Definire target di dimensione modulo/funzione

- Inserire regole soft nel contributing:
  - warning sopra ~400 linee modulo;
  - warning sopra ~60 linee funzione;
  - obbligo di ADR/refactor plan quando si supera la soglia.

### 3.2 Formalizzare una roadmap di decomposizione

- Collegare queste attività ai documenti ADR esistenti e a milestone incrementali.
- L'obiettivo è evitare refactor “big bang” e mantenere deploy frequenti.

## 4) Piano operativo in 3 sprint

1. **Sprint 1**: estrazione `bot_messaging.py` + helper env in `config.py`, senza cambi di comportamento.
2. **Sprint 2**: estrazione `storage/schema.py` e `runtime_repo.py`, con test di regressione.
3. **Sprint 3**: riduzione wrapper legacy e incremento gate quality (`mypy` + coverage).

## 5) Criteri di accettazione del cleanup

- Nessuna regressione su CLI, bot, OAuth e reconcile.
- Diff piccoli e reversibili.
- Ogni estrazione mantiene API pubblica esistente (o deprecazione esplicita).
- Miglioramento misurabile su: dimensione moduli, complessità, copertura e warning statici.
