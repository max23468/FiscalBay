# AGENTS.md

## Scopo
Questo file definisce le linee guida operative per agenti (es. Codex) e collaboratori che lavorano su questo repository.
Obiettivo: mantenere modifiche coerenti, sicure, testate e facilmente revisionabili.

## Priorità delle istruzioni
1. Istruzioni di sistema/developer ricevute nella sessione corrente.
2. Questo file `AGENTS.md`.
3. Documentazione progetto (`README.md`, `docs/*`).
4. Assunzioni dell'agente.

In caso di conflitto, seguire sempre il livello più alto.

## Principi generali
- Effettua cambi minimi e mirati al task richiesto.
- Non introdurre refactor non richiesti nello stesso intervento.
- Preferisci chiarezza e leggibilità a soluzioni "furbe".
- Non inserire segreti o credenziali nel codice o nei log.

## Convenzioni di modifica codice
- Segui lo stile già presente nel file toccato.
- Evita rinominazioni massive non necessarie.
- Aggiorna documentazione e commenti se il comportamento cambia.
- Se aggiungi configurazioni/env var, documentale in `README.md` o `docs/`.

## Testing e verifica
Prima di finalizzare:
1. Esegui almeno i test/controlli strettamente rilevanti alla modifica.
2. Se non puoi eseguirli (limiti ambiente/tempo), dichiaralo esplicitamente.

## Commit e PR
- Crea commit atomici con messaggio chiaro.
- Struttura consigliata commit message:
  - `feat: ...` per nuove funzionalità
  - `fix: ...` per correzioni
  - `docs: ...` per sola documentazione
  - `refactor: ...` per ristrutturazioni senza cambi funzionali
  - `test: ...` per test
  - `chore: ...` per attività operative
- Nella PR includi:
  - sintesi cambi
  - impatto
  - test eseguiti
  - eventuali limitazioni note

## Policy per agenti
- Non inventare risultati di test/comandi non eseguiti.
- Se un'informazione è incerta, dichiarare assunzioni e limiti.
- Se una richiesta è ambigua, fare la scelta più conservativa e spiegarla.

## Suggerimento operativo
Per regole specifiche di sotto-moduli, aggiungere `AGENTS.md` nelle relative sottocartelle.
Le istruzioni più profonde prevalgono sui livelli superiori.
