# Board Milestone Minima

Board minima locale per tenere visibili priorita' e dipendenze finche' non viene aperta una board GitHub dedicata.

## Milestone attive

### M0 - Baseline e sicurezza immediata

Obiettivo:

- rendere il progetto operabile senza ambiguita' su deploy, rollback, segreti e criterio minimo di rilascio

Dipendenze:

- nessuna

Deliverable minimi:

- baseline operativa minima assorbita in `docs/OPERATIONS.md` e `docs/SECURITY.md`
- `docs/RUNBOOK.md` aggiornato
- `docs/ROADMAP.md` allineata allo stato reale

### M1 - Hardening VPS e recovery

Obiettivo:

- passare da assetto "funziona" a assetto "regge incidenti semplici"

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

- completare la separazione di responsabilita' senza regressioni funzionali

Dipendenze:

- M0 chiusa

Deliverable principali:

- refactor residuo su modelli, retry, errori e stato locale
- riduzione accoppiamento tra CLI, bot e moduli applicativi
- decisioni architetturali consolidate in `docs/ARCHITECTURE.md`

### M3 - Operativita' e osservabilita'

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

### M4 - Progettazione multiutente

Obiettivo:

- disegnare il passaggio da utility privata a servizio multiutente

Dipendenze:

- M1 e M3 a livello almeno minimo

Deliverable principali:

- modello dati tenant-aware
- strategia token utente
- decisione SQLite vs Postgres
- milestone di beta privata

Milestone tecnica proposta:

- `M4.1`
  - schema dati multiutente documentato e chiavi di isolamento fissate
- `M4.2`
  - decisione database: SQLite per beta privata, Postgres prima dell'apertura pubblica
- `M4.3`
  - strategia token eBay per utente, con refresh token cifrato e revoca prevista
- `M4.4`
  - flusso OAuth definito end-to-end tra Telegram, web app e callback
- `M4.5`
  - piano di migrazione da stato globale a stato per tenant

Vincoli della prima beta privata:

- un solo account eBay attivo per utente e per environment
- SQLite ancora ammesso solo per beta privata controllata
- Postgres prima dell'apertura pubblica
- audit log e rate limiting minimi richiesti prima di onboarding self-service

Milestone di beta privata:

- `M4.B1`
  - schema tenant-aware e token storage definiti
- `M4.B2`
  - lifecycle token e audit log minimi definiti
- `M4.B3`
  - validazione che VPS e operativita' attuale reggano una beta privata chiusa
- `M4.B4`
  - via libera a iniziare implementazione fase 4

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

- `/account` e `/account collega` esistono gia' nel bot
- `/account scollega` scollega localmente account e token e mantiene distinta l'uscita completa dal bot; la revoca remota eBay resta fuori dal flusso automatico
- `/settings notifiche on|off` e `/settings` esistono gia' come gestione self-service minima lato chat
- `/account collega` salva una sessione preliminare in `oauth_link_sessions`
- il callback OAuth minimale esiste gia' come servizio separato `fiscalbay-oauth`
- il token storage tenant usa gia' cifratura a riposo con chiave Fernet da env
- `/account reconnect`, `/ordini spiega` e il riepilogo explain su `/ordini cerca` sono gia' disponibili
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

## Priorita' correnti

Le prossime milestone operative sono ora:

- consolidamento del servizio pubblico con accesso approvato
- ottimizzazione del polling ordini e riduzione dei dettagli `getOrder` non necessari
- guardrail e strumenti admin per un bot pubblico controllato
- lifecycle dati e automazioni amministrative
- consolidamento dei limiti del servizio pubblico

Per il dettaglio operativo vedere:

- `docs/ROADMAP.md`
- `docs/DECISIONS_PENDING.md`
