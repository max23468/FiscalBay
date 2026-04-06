# Registro Modifiche

## Indice rapido

- `In lavorazione`
  - modifiche non ancora pubblicate o consolidate

Documenti collegati:

- `docs/INDEX.md`
- `docs/ARCHITECTURE.md`
- `docs/CHECKLIST.md`

## In lavorazione

### Added

- `src/ebay_cf/telegram_commands.py` per parsing, menu e rendering Telegram.
- `src/ebay_cf/services/notifications.py` per stato runtime, retry queue e notifiche automatiche.
- `src/ebay_cf/services/telegram_runtime.py` per polling Telegram, callback e lifecycle del runtime.
- `src/ebay_cf/retry.py` per retry/backoff condiviso tra client e runtime.
- modelli tipizzati in `src/ebay_cf/models.py` per stato bot, metriche, retry queue e ordini normalizzati.
- API storage tipizzate in `src/ebay_cf/storage/sqlite.py` per stato runtime e retry queue.
- ADR leggere in `docs/adr/` per documentare le decisioni principali del refactor fase 2.

### Changed

- `src/ebay_cf/bot.py` ora funge soprattutto da facciata compatibile e punto di wiring.
- `src/ebay_cf/clients/ebay.py` e `src/ebay_cf/clients/telegram.py` usano retry centralizzato e mantengono alias compatibili per i nomi storici.
- `src/ebay_cf/errors.py` espone una gerarchia di errori applicativi piu' esplicita.
- `src/ebay_cf/healthcheck.py` e i servizi principali leggono lo stato tramite modelli tipizzati invece di dipendere da payload SQLite raw.
- i moduli introdotti nel refactor fase 2 sono stati riallineati al quality gate CI, con export espliciti in `bot.py` e pulizia degli import inutilizzati.
- `src/ebay_cf/models.py` usa conversioni tipizzate piu' esplicite per restare compatibile con `mypy` anche nel workflow CI su GitHub.
