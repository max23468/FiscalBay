# ADR 0002 - Introdurre modelli tipizzati per stato runtime

## Stato

Accettata

## Contesto

Lo stato del bot e la retry queue erano manipolati soprattutto come `dict` e `list[dict]`, con campi impliciti e controlli sparsi.

Questo aumentava il rischio di errori silenziosi, rendeva meno chiari i contratti interni e complicava l'evoluzione dello storage.

## Decisione

Introdurre modelli condivisi in `models.py` per:

- `OrderRecord`
- `BotMetrics`
- `BotRuntimeState`
- `RetryQueueEntry`

Lo storage SQLite espone adattatori tipizzati, mantenendo comunque API legacy compatibili dove serve.

## Conseguenze

- contratti interni piu' espliciti
- conversioni concentrate in pochi punti
- meno dipendenza dai payload raw di persistenza
- resta ancora da ridurre parte dei `dict` residui nel flusso ordini
