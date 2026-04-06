# Milestone Board Minima

Board minima locale per tenere visibili priorita' e dipendenze finche' non viene aperta una board GitHub dedicata.

## Milestone attive

### M0 - Baseline e sicurezza immediata

Obiettivo:

- rendere il progetto operabile senza ambiguita' su deploy, rollback, segreti e criterio minimo di rilascio

Dipendenze:

- nessuna

Deliverable minimi:

- `docs/PHASE0_BASELINE.md`
- `RUNBOOK.md` aggiornato
- `CHECKLIST.md` allineata allo stato reale

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
- ADR leggere sulle decisioni architetturali

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

### M5 - Onboarding self-service

Obiettivo:

- collegamento account eBay per utente via Telegram + OAuth

Dipendenze:

- M4 definita

Deliverable principali:

- flow `/connect`
- callback OAuth
- storage sicuro token
- comandi `/account` e `/disconnect`

## Priorita' correnti

Ordine consigliato di lavoro:

1. M1 - Hardening VPS e recovery
2. M2 - Rifondazione strutturale del codice
3. M3 - Operativita' e osservabilita'
4. M4 - Progettazione multiutente
5. M5 - Onboarding self-service
