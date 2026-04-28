# Roadmap

## Stato corrente

La roadmap necessaria per la prima release stabile e' completata.

FiscalBay `1.0.0` stabilizza il perimetro `approved_public_small`: bot Telegram
pubblico con accesso approvato, singolo admin globale, onboarding OAuth su VPS,
token tenant cifrati, audit/retention/recovery minimi, metriche admin e deploy
locale/VPS senza GitHub Actions.

Non ci sono fasi aperte bloccanti per `1.0.0`.

## Storico fasi completate

- Fase 1 - Servizio Pubblico con Accesso Approvato
- Fase 2 - Guardrail e Strumenti Admin
- Fase 3 - Lifecycle Dati e Retention
- Fase 4 - Ottimizzazione Applicativa e Storage
- Fase 5 - Robustezza VPS e Recovery
- Fase 6 - Consolidamento del Servizio Pubblico
- Fase 7 - Rate Limiting Minimo
- Fase 8 - Metriche Prodotto Admin
- Fase 9 - Readiness 1.0.0
- Fase 1.1 - Stabilizzazione operativa post-1.0
- Fase 1.2 - Disconnect e reconnect piu' robusti
- Fase 1.3 - Self-service assistito utente
- Fase 1.4 - Admin comfort e osservabilita' leggera
- Fase 1.5 - Security operations
- Fase 1.6 - Scale readiness senza migrazione automatica

## Principi 1.x

La serie `1.x` resta centrata su operativita' curata, release piccole e servizio
`approved_public_small`.

Principi guida:

- Telegram resta il punto di ingresso principale
- ogni minor release deve avere un obiettivo operativo chiaro
- niente apertura pubblica libera nella prima serie `1.x`
- SQLite resta il default finche' healthcheck e soglie pubbliche restano sani
- Postgres, secret manager dedicato, ruoli admin multipli, SLA e multiworker
  restano backlog condizionato da crescita reale o soglie superate
- ogni fase deve chiudersi con test locali rilevanti, release versionata quando
  il cambio e' osservabile, deploy VPS e smoke check remoto

## Roadmap 1.x

Prossima fase da definire in base ai segnali reali di esercizio.
