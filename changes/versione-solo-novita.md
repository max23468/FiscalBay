# Versione solo con Novità

## Changelog

### Altre modifiche

- Una versione nuova nasce soltanto da Novità per gli utenti dell'app: i cambi del sito pubblico, della console o interni vanno in Production con la versione già pubblicata, senza tag né release. La 2.0.6, pubblicata senza Novità, è ritirata: le sue voci passano nella 2.0.5, release e tag `v2.0.6` sono eliminati e la prossima versione con Novità sarà la 2.0.6. La 2.0.7, aperta per la sola barra del sito, è richiusa.

## Decisioni

| ID | Ambito | Sintesi della scelta / motivazione | Provenienza | Stato / requisito completo |
|---|---|---|---|---|
| D302 | **Versione solo con Novità** | Una PR apre la versione successiva soltanto con voci nelle parti «Novità» e «What's new» del proprio frammento, cioè con cambi per gli utenti dell'app. Le sole «Altre modifiche», come sito pubblico, console e lavoro interno, viaggiano con la versione già pubblicata come i lotti di D252: il Worker prende `<versione>+<commit>`, non si crea tag né release e il giorno aggiunge quelle voci alla versione pubblicata nel changelog. Una PR può richiudere una versione aperta e ancora vuota. Per eccezione dell'owner la 2.0.6, pubblicata senza Novità, è ritirata con release e tag, così la prossima versione con Novità riusa il numero. Estende D252 e la regola della prima modifica visibile di D248. | Richiesta owner del 2026-11-05: la 2.0.6 è uscita senza Novità per gli utenti, per i soli cambi del sito pubblico | Confermato · [Versioni](../docs/operations/RELEASE.md#versioni-dopo-la-2-0-0) |
