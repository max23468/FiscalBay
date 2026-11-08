# Mutation proporzionata nella qualifica

## Changelog

### Altre modifiche

- **Qualifica più rapida.** Il candidato prova in modo incrementale i soli moduli critici modificati; i moduli che li importano restano alla campagna settimanale.

## Decisioni

| ID | Ambito | Sintesi della scelta / motivazione | Provenienza | Stato / requisito completo |
|---|---|---|---|---|
| D330 | **Mutation proporzionata nel candidato** | La qualifica prova i moduli critici modificati in modo incrementale dal riferimento di `develop`; i moduli che li importano passano alla campagna settimanale, completa, e un difetto in uno di essi può emergere fino al lunedì successivo. Una modifica a un modulo di base portava 23 moduli in 67 parti, circa tre ore, per codice già provato nella PR. Supera D173 sui consumatori critici. La qualifica non perde posti per il ciclo che la attende. | Owner, 2026-11-08 | Confermato · [Pubblicazione](../docs/operations/RELEASE.md) |
