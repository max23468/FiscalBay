# Board Milestone Minima

Board minima locale per tenere visibili priorità e dipendenze finché non viene aperta una board GitHub dedicata.

Nota: questo file conserva lo storico di pianificazione precedente alla
readiness `1.0.0`. La roadmap corrente e il perimetro stabile sono in
`docs/ROADMAP.md` e `docs/RELEASE_READINESS.md`.

## Milestone attive

### M0 - Baseline e sicurezza immediata

Obiettivo:

- rendere il progetto operabile senza ambiguità su deploy, rollback, segreti e criterio minimo di rilascio

Dipendenze:

- nessuna

Deliverable minimi:

- baseline operativa minima assorbita in `docs/OPERATIONS.md` e `docs/SECURITY_OPERATIONS.md`
- `docs/RUNBOOK.md` aggiornato
- `docs/ROADMAP.md` allineata allo stato reale

### M1 - Hardening VPS e recovery

Obiettivo:

- passare da assetto "funziona" a assetto "regge incidenti semplici"

Stato corrente:

- baseline VPS live con backup, alertcheck, reconciliation e smoke deploy remoto;
  i follow-up aperti sono ora tracciati nella Fase 5 di `docs/ROADMAP.md`

Dipendenze:

- M0 chiusa

Deliverable principali:

- backup automatico di `state.db`
- backup e verifica permessi di `.env`
- retention minima dei backup
- test di restore separato
- decisione su Docker Compose

### M2 - Rifondazione strutturale del codice

Obiettivo:

- completare la separazione di responsabilità senza regressioni funzionali

Dipendenze:

- M0 chiusa

Deliverable principali:

- refactor residuo su modelli, retry, errori e stato locale
- riduzione accoppiamento tra CLI, bot e moduli applicativi
- decisioni architetturali consolidate in `docs/ARCHITECTURE.md`

### M3 - Operatività e osservabilità

Obiettivo:

- rendere leggibile lo stato del servizio e i failure mode principali

Dipendenze:

- M1 parzialmente chiusa
- M2 abbastanza stabile da non cambiare continuamente gli eventi runtime

Deliverable principali:

- standard eventi log
- metriche basilari
- alert minimi
- troubleshooting guidato

Stato corrente:

- healthcheck, alertcheck timer, reconciliation timer e log strutturati sono
  operativi; resta aperto il monitoraggio esterno HTTPS e risorse VPS

### M4 - Progettazione multiutente

Obiettivo:

- disegnare il passaggio da utility privata a servizio multiutente

Dipendenze:

- M1 e M3 a livello almeno minimo

Deliverable principali:

- modello dati tenant-aware
- strategia token utente
- decisione SQLite vs Postgres
- milestone di servizio pubblico controllato

Milestone tecnica proposta:

- `M4.1`
  - schema dati multiutente documentato e chiavi di isolamento fissate
- `M4.2`
  - decisione database: SQLite per servizio piccolo approvato, Postgres prima di
    un'apertura pubblica più ampia
- `M4.3`
  - strategia token eBay per utente, con refresh token cifrato e revoca prevista
- `M4.4`
  - flusso OAuth definito end-to-end tra Telegram, web app e callback
- `M4.5`
  - piano di migrazione da stato globale a stato per tenant

Vincoli del servizio pubblico piccolo:

- un solo account eBay attivo per utente e per environment
- SQLite ancora ammesso solo per accesso approvato e bassa scala
- Postgres prima dell'apertura pubblica più ampia
- audit log e rate limiting minimi richiesti prima di onboarding self-service

Milestone di servizio controllato:

- `M4.B1`
  - schema tenant-aware e token storage definiti
- `M4.B2`
  - lifecycle token e audit log minimi definiti
- `M4.B3`
  - validazione che VPS e operatività attuale reggano il servizio approvato
- `M4.B4`
  - via libera a stabilizzare il percorso `approved_public_small`

### M5 - Onboarding self-service

Obiettivo:

- collegamento account eBay per utente via Telegram + OAuth

Dipendenze:

- M4 definita

Deliverable principali:

- flow `/account collega`
- callback OAuth
- storage sicuro token
- comandi `/account` e `/account scollega`

Stato corrente:

- `/account` e `/account collega` esistono già nel bot
- `/account scollega` scollega localmente account e token e mantiene distinta l'uscita completa dal bot; la revoca remota eBay resta fuori dal flusso automatico
- `/settings notifiche on|off` e `/settings` esistono già come gestione self-service minima lato chat
- `/account collega` salva una sessione preliminare in `oauth_link_sessions`
- il callback OAuth minimale esiste già come servizio separato `fiscalbay-oauth`
- il token storage tenant usa già cifratura a riposo con chiave Fernet da env
- `/account reconnect`, `/ordini spiega` e il riepilogo explain su `/ordini cerca` sono già disponibili
- `/settings lascia` copre ora l'uscita completa dell'utente con disattivazione notifiche e nuova approvazione richiesta
- resta aperto soprattutto l'affinamento del polling e della riduzione `getOrder`

### M6 - Governance del prodotto

Obiettivo:

- fissare regole minime di esercizio del servizio pubblico con accesso approvato

Dipendenze:

- M4 e M5 abbastanza stabili da sapere quali dati e flussi esistono davvero

Deliverable principali:

- dati trattati definiti
- retention minima esplicita
- policy di cancellazione utente chiarita
- limiti del servizio dichiarati

Stato corrente:

- assorbita in `docs/SERVICE_GOVERNANCE.md`
- la pianificazione aperta ora vive in `docs/ROADMAP.md`

## Priorità correnti

Le prossime milestone operative sono ora:

- consolidamento del servizio pubblico con accesso approvato
- ottimizzazione del polling ordini e riduzione dei dettagli `getOrder` non necessari
- guardrail e strumenti admin per un bot pubblico controllato
- lifecycle dati e automazioni amministrative
- consolidamento dei limiti del servizio pubblico

Per il dettaglio operativo vedere:

- `docs/ROADMAP.md`
- `docs/DECISIONS_PENDING.md`
