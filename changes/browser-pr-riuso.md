# Prove browser della PR senza ripetizioni

## Decisioni

| ID | Ambito | Sintesi della scelta / motivazione | Provenienza | Stato / requisito completo |
|---|---|---|---|---|
| D318 | **Prove browser della PR riusate** | Gli otto job browser di una PR non ripartono se l'ultima run della stessa PR che li ha conclusi è riuscita in ogni parte, con la stessa impronta dell'inventario selezionato (prove, browser e filtri) e un commit antenato di quello provato ora, e se fra i due il classificatore non chiede browser né deploy: documenti, frammenti senza Novità, strumenti e test unitari non le ripetono, mentre codice, spec e helper delle prove, configurazione di Playwright, dipendenze di build o un confronto non disponibile sì. Un fallimento recente non si copre con un successo più vecchio. Il riuso della mutation della PR (D317) confronta ora la run precedente con il commit di merge provato invece che con la testa del branch, così una base avanzata senza unione conta come cambio. | Il 2026-11-07 l'owner, dopo che la PR #685 ha ripetuto gli otto job browser per un'unione di `develop` con soli strumenti della mutation, chiede di estendere il riuso alle prove browser | Confermato · [Pubblicazione](../docs/operations/RELEASE.md#controlli-proporzionati) |
