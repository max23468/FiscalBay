# Roadmap

## Stato corrente

La roadmap necessaria per la prima release stabile e' completata.

FiscalBay `1.0.0` stabilizza il perimetro `approved_public_small`: bot Telegram
pubblico con accesso approvato, singolo admin globale, onboarding OAuth su VPS,
token tenant cifrati, audit/retention/recovery minimi, metriche admin e deploy
locale/VPS senza GitHub Actions.

Non ci sono fasi aperte bloccanti per `1.0.0`.

## Storico fasi completate

- Fase 1 - Servizio Pubblico con Accesso Approvato
- Fase 2 - Guardrail e Strumenti Admin
- Fase 3 - Lifecycle Dati e Retention
- Fase 4 - Ottimizzazione Applicativa e Storage
- Fase 5 - Robustezza VPS e Recovery
- Fase 6 - Consolidamento del Servizio Pubblico
- Fase 7 - Rate Limiting Minimo
- Fase 8 - Metriche Prodotto Admin
- Fase 9 - Readiness 1.0.0

## Dopo 1.0.0

Le prossime evoluzioni non sono prerequisiti della prima release stabile.

- Postgres o database gestito prima di un'apertura pubblica multiutente piu'
  ampia
- secret manager dedicato se il perimetro operativo cresce
- cancellazione self-service da Telegram
- ruoli admin multipli o delega operativa
- alert prodotto persistenti con storico dedicato
- revoca remota eBay garantita come parte del flusso di disconnect
