# Ciclo di pubblicazione senza vincolo dedicato

## Decisioni

| ID | Ambito | Sintesi della scelta / motivazione | Provenienza | Stato / requisito completo |
|---|---|---|---|---|
| D331 | **Ciclo di pubblicazione come il resto del codice** | Il ciclo di pubblicazione (`scripts/release/`, classificatore, workflow di CI e rilascio) non ha più un vincolo proprio: cambia con le stesse regole del resto del repository, e una modifica richiede comunque la sua qualifica. Supera D279 per il solo vincolo, che non distingueva un affinamento dal togliere duplicati o dall'aggiornare gli elenchi dei moduli dopo uno spostamento di file, e che dal 2026-11-02 non aveva fermato almeno 38 commit sul processo. Divisione fra `RELEASE.md` e `OPERATIONS.md` e `release:cycle metrics` restano. Scartata una regola sul costo, con i casi ammessi elencati. | Owner, 2026-11-09 | Confermato · [Pubblicazione](../docs/operations/RELEASE.md) |
