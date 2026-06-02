# Backlog FiscalBay

Il backlog raccoglie possibilità, debiti e attività non ancora promosse nella
roadmap. Una voce nel backlog non è scope approvato.

La roadmap corrente resta [ROADMAP.md](./ROADMAP.md). Le scelte che richiedono
una decisione esplicita restano anche in [DECISIONS_PENDING.md](./DECISIONS_PENDING.md)
finché non vengono chiuse.

## Backlog condizionato

Questi lavori non sono rilasci attivi. Vanno ripresi solo se crescita, soglie,
rischi operativi o decisioni prodotto li rendono necessari.

- Migrazione SQLite -> Postgres.
- Secret manager dedicato.
- Ruoli admin multipli.
- Multiworker o scaling runtime.
- SLA e monitoraggio più strutturato.
- `v2.0.0`: autenticazione web app.
- `v2.0.0`: dashboard web venditore.
- `v2.0.0`: onboarding web self-service.
- `v2.0.0`: billing o packaging commerciale.

## Idee prodotto

- Definire il piano MVP SaaS-first `v2.0.0` solo con decisione dedicata su
  target, autenticazione, stack, billing e rapporto tra web app e Telegram.
- Rafforzare onboarding, reconnect o assistenza utente solo se i venditori
  selezionati incontrano blocchi ricorrenti.
- Migliorare comfort operativo admin solo su attriti reali osservati.

## Backlog tecnico

- Creare ADR in `docs/decisions/` per decisioni strutturali nuove o per la
  progressiva migrazione da documenti storici.
- Preparare contratti interni riusabili dalla futura web app senza anticipare
  una migrazione `2.0` prematura.
- Intervenire su performance, storage o polling solo se metriche e healthcheck
  lo giustificano.
- Coverage Atlas verso il target 90%: dopo la slice offline su
  `services/orders.py`, `support_snapshot.py` e formatter admin Telegram resta
  un gap locale di circa `3.59` punti; prossimo incremento consigliato su
  rami offline di `bot.py` e `telegram_commands.py` legati a `/stato`,
  fallback CLI e comandi non riconosciuti.

## Operatività

- Verificare periodicamente la `Codex feedback inbox` prima di publish, merge o
  controlli bot.
- Usare `scripts/deploy_now.sh` solo quando serve davvero aggiornare la VPS.
- Usare `scripts/release_now.sh` solo per release versionate esplicite.
- Mantenere GitHub Actions nella allowlist leggera dichiarata, senza aggiungere
  workflow operativi generici.

## Bug

- Nessun bug aperto in questo documento.
- I thread Codex actionable restano tracciati nella issue GitHub
  `Codex feedback inbox`.

## Regole

- Quando una voce diventa prioritaria, promuoverla in `docs/ROADMAP.md`.
- Quando una voce diventa decisione stabile, collegarla o spostarla in
  `docs/decisions/`.
- Non usare il backlog come storico dei lavori completati.
