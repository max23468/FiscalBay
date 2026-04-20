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
- Questo repository e' privato e gestito da un solo maintainer.
- Regola operativa per gli agenti: non trattare review/commenti esterni come un passaggio atteso per chiudere il lavoro.
- Quando la PR e' pronta, i test rilevanti sono verdi e la self-review e' stata completata, il passo naturale successivo e' il merge.

## Release e versioning
- Questo repository usa `release-please` come meccanismo ufficiale di versionamento e release anche quando si lavora direttamente su `main`.
- Regola fissa per gli agenti: per cambi funzionali o osservabili nel runtime, scegli sempre un commit message `feat:`, `fix:` o `perf:` coerente con l'impatto reale. Non usare `refactor:`, `chore:` o `docs:` se il comportamento utente/operatore cambia davvero.
- Regola fissa per gli agenti: valuta sempre l'impatto release prima di creare il commit. Se il cambiamento merita release, il commit deve rifletterlo nel tipo (`feat`/`fix`/`perf` o `!` per breaking change).
- Regola fissa per gli agenti: non eseguire bump manuali di versione in `pyproject.toml`, non aggiornare manualmente `CHANGELOG.md` root, non modificare `.release-please-manifest.json`, non creare tag Git manuali e non pubblicare release GitHub manuali, salvo richiesta esplicita dell'utente per una riparazione straordinaria del flusso.
- Regola fissa per gli agenti: se l'utente chiede una release, il percorso standard e' verificare lo stato di `release-please`, pushare i commit corretti su `main` e usare la Release PR / workflow ufficiale invece di un rilascio manuale.
- Regola fissa per gli agenti: se in un turno sono stati fatti cambi funzionali ma manca un commit Conventional Commit adeguato, non considerare il lavoro chiuso finche' il commit non e' coerente con il flusso `release-please`.
- Se il flusso automatico sembra rotto, fermati e spiega il motivo prima di introdurre workaround manuali che bypassano `release-please`.

## Policy per agenti
- Non inventare risultati di test/comandi non eseguiti.
- Se un'informazione è incerta, dichiarare assunzioni e limiti.
- Se una richiesta è ambigua, fare la scelta più conservativa e spiegarla.
- Quando aggiorni `docs/ROADMAP.md`, gli item completati vanno rimossi dalla roadmap: non vanno lasciati come checkbox spuntate.

## Suggerimento operativo
Per regole specifiche di sotto-moduli, aggiungere `AGENTS.md` nelle relative sottocartelle.
Le istruzioni più profonde prevalgono sui livelli superiori.
