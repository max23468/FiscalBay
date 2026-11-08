# Mutation della PR dopo prove soltanto aggiunte

## Decisioni

| ID | Ambito | Sintesi della scelta / motivazione | Provenienza | Stato / requisito completo |
|---|---|---|---|---|
| D325 | **Prove aggiunte senza ripetere la mutation** | Un test che importa direttamente un modulo critico e cambia soltanto con prove aggiunte non invalida le parti già concluse del modulo: nel confronto di GitHub nessuna riga tolta, la patch presente e nessuna riga aggiunta che prepari tutte le prove del file (hook `beforeEach`, `beforeAll`, `afterEach`, `afterAll`, `vi.mock`, `vi.doMock`, `vi.hoisted`, stub globali, orologio simulato, `setupScenarios`). Una prova in più può uccidere altri mutanti, mai farne sopravvivere uno già ucciso. La parte fallita che la nuova prova corregge si ripete comunque, perché il suo esito più recente è un fallimento. Completa D317 e D323. | Il 2026-11-08 la PR #688 ha ripetuto tutte le parti di `order-import.server.ts` e di `order-acquisition-details.server.ts` dopo l'aggiunta di una sola prova a `test/order-import-retention.spec.ts`, che serviva a uccidere un mutante della parte 3/3 del dettaglio; l'owner chiede la correzione | Confermato · [Pubblicazione](../docs/operations/RELEASE.md#mutation-test) |
