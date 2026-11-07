# Prove browser ripetute soltanto dove PR e base si incontrano

## Decisioni

| ID | Ambito | Sintesi della scelta / motivazione | Provenienza | Stato / requisito completo |
|---|---|---|---|---|
| D320 | **Prove browser dopo un'unione con codice** | Quando fra l'ultima run verde della PR e il commit provato ora arriva codice, i job browser ripetono soltanto le aree dei file che la PR cambia e che sono cambiati da allora, più le aree dei soli cambi della base che la PR tocca anche lei, con il nucleo `@smoke` e le spec cambiate; senza aree in comune resta il solo nucleo. La selezione intera torna con un modulo senza area (layout, router, stili condivisi), con dipendenze di build o il runner delle prove, o senza un confronto disponibile. L'impronta salvata resta quella della selezione intera, così la run ridotta riuscita vale per le successive. Completa D318. | Il 2026-11-08 la PR #688 ha ripetuto gli otto job browser dopo l'unione della #685, che toccava aree diverse; l'owner giudica la ripetizione superflua e chiede una correzione | Confermato · [Pubblicazione](../docs/operations/RELEASE.md#controlli-proporzionati) |
