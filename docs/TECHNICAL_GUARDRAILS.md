# Guardrail tecnici

Questi guardrail sono intenzionalmente soft: non bloccano da soli una release, ma
quando vengono superati richiedono un piano di refactor incrementale o una nota in
roadmap.

## Moduli

- sopra `1.000` righe: evitare nuove responsabilità nel modulo
- sopra `2.000` righe: ogni feature nuova deve preferire estrazioni piccole e
  testabili
- sopra `3.000` righe: il modulo è in zona legacy critica; aggiungere solo wiring,
  spostando logica nuova altrove

## Funzioni

- sopra `80` righe: valutare estrazione di helper nominati
- sopra `150` righe: modifiche funzionali dovrebbero includere almeno un test
  mirato sul comportamento toccato

## Applicazione corrente

- `src/fiscalbay/bot.py` contiene solo wiring; il dispatch resta in
  `bot_dispatch.py` e la logica va nel modulo di dominio pertinente
- `src/fiscalbay/storage/` espone funzioni semplici divise per dominio; non
  aggiungere facade o repository wrapper senza un consumatore reale
- metriche admin, healthcheck e review tenant devono preferire snapshot
  periodici o dati già materializzati dalla reconciliation
