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

### 1.1.0 - Stabilizzazione operativa post-1.0

Obiettivo:

- rendere immediato capire cosa gira in produzione e se la release e' sana

Direzione:

- esporre meglio versione deployata, tag Git, stato release e salute servizio nei
  punti admin e healthcheck
- rifinire checklist post-release, controlli giornalieri e runbook breve
- rendere piu' chiaro il confronto tra versione locale, tag GitHub e versione
  installata sulla VPS

### 1.2.0 - Disconnect e reconnect piu' robusti

Obiettivo:

- rendere piu' leggibile e affidabile il ciclo scollegamento, token revocati e
  riconnessione

Direzione:

- migliorare UX utente e admin per token scaduti, revocati o da riconnettere
- consolidare messaggi e stati attorno a `/account scollega`, `/account collega`
  e `/account reconnect`
- valutare revoca remota eBay come operazione best effort esplicita, mantenendo
  fallback locale sicuro

### 1.3.0 - Self-service assistito utente

Obiettivo:

- permettere all'utente di avviare richieste sensibili senza rendere distruttivi
  i comandi lato utente

Direzione:

- introdurre un flusso utente per chiedere uscita dal servizio o cancellazione
  dati locali
- mantenere conferma finale admin per export e delete tenant
- rendere piu' leggibili da bot privacy, dati conservati, retention e prossimi
  passi operativi

### 1.4.0 - Admin comfort e osservabilita' leggera

Obiettivo:

- ridurre il lavoro manuale dell'admin nel servizio quotidiano

Direzione:

- migliorare viste admin per pending, reconnect, inattivi, alert prodotto e stato
  tenant
- aggiungere storico operativo leggero solo dove aiuta supporto e diagnosi
- mantenere Telegram come centro operativo, senza introdurre dashboard web
  generalista

### 1.5.0 - Security operations

Obiettivo:

- rendere piu' pratiche le operazioni di sicurezza ricorrenti

Direzione:

- rafforzare procedure per rotazione segreti, verifica permessi e controlli
  `.env`
- migliorare recovery, restore drill e prove di rollback
- documentare controlli periodici per confermare che il profilo
  `approved_public_small` resti adeguato

### 1.6.0 - Scale readiness senza migrazione automatica

Obiettivo:

- preparare una decisione tecnica chiara per il giorno in cui SQLite non basta
  piu'

Direzione:

- produrre un piano pronto per Postgres o database equivalente gestito
- definire trigger concreti per uscire da SQLite
- evitare migrazioni premature finche' healthcheck, soglie pubbliche e carico
  reale restano dentro il profilo approvato
