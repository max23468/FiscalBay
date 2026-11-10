# Ciclo di pubblicazione e PR

## Decisioni

| ID | Ambito | Sintesi della scelta / motivazione | Provenienza | Stato / requisito completo |
|---|---|---|---|---|
| D331 | **Ciclo di pubblicazione come il resto del codice** | Il ciclo di pubblicazione (`scripts/release/`, classificatore, workflow di CI e rilascio) non ha più un vincolo proprio: cambia con le stesse regole del resto del repository, e una modifica richiede comunque la sua qualifica. Supera D279 per il solo vincolo, che non distingueva un affinamento dal togliere duplicati o dall'aggiornare gli elenchi dei moduli dopo uno spostamento di file, e che dal 2026-11-02 non aveva fermato almeno 38 commit sul processo. Divisione fra `RELEASE.md` e `OPERATIONS.md` e `release:cycle metrics` restano. Scartata una regola sul costo, con i casi ammessi elencati. | Owner, 2026-11-09 | Confermato · [Pubblicazione](../docs/operations/RELEASE.md) |
| D332 | **Nessuna PR prima di `Pubblica`** | Prima di `Pubblica` l'agente non apre PR, neppure in bozza, e non fa il push del branch su GitHub: il lavoro resta in un unico worktree locale con i suoi commit, anche quando tocca insieme codice, documenti e ciclo di pubblicazione, e i collaudi locali si fanno lì. `Pubblica` apre una sola PR con tutto. Tre bozze aperte per un refactor, una decisione e gli script della CI moltiplicavano CI e revisioni per un lavoro unico. Prevale sull'autorizzazione generale ad aprire bozze di PR. | Owner, 2026-11-09 | Confermato · [AGENTS.md](../AGENTS.md) |
