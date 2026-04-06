# ADR 0001 - Modularizzare runtime Telegram e parsing comandi

## Stato

Accettata

## Contesto

Il vecchio `bot.py` concentrava insieme:

- polling Telegram
- parsing comandi
- rendering messaggi
- notifiche automatiche
- stato runtime

Questo rendeva il modulo fragile da testare e difficile da estendere.

## Decisione

Separare il bot in tre blocchi principali:

- `telegram_commands.py` per parsing e rendering
- `services/telegram_runtime.py` per lifecycle e polling
- `services/notifications.py` per auto-notify e retry queue

`bot.py` resta come facciata compatibile e punto di wiring.

## Conseguenze

- responsabilita' piu' chiare
- test piu' mirati
- meno accoppiamento tra UI Telegram e logica runtime
- costo iniziale di refactor piu' alto, ma piu' sostenibile per le fasi successive
