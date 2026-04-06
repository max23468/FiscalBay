# Checklist Operativa

## Indice rapido

- `Fase 3`
  - progettazione multiutente
- `Fase 4`
  - onboarding self-service Telegram + eBay OAuth
- `Fase 5`
  - governance del prodotto

Documenti collegati:

- `docs/INDEX.md`
- `docs/MILESTONE_BOARD.md`
- `docs/DECISIONS_PENDING.md`

## Fase 3 - Progettazione Multiutente [Priorita' media]

### Target di prodotto

- [ ] raggiungere supporto multiutente reale
- [ ] ogni utente Telegram deve poter collegare il proprio account eBay
- [ ] ogni utente deve vedere solo i propri ordini e le proprie notifiche
- [ ] piu' utenti devono poter convivere sullo stesso bot
- [ ] le credenziali eBay non devono stare in env globali condivise
- [ ] l'onboarding deve essere il piu' possibile self-service

### Lavori tecnici necessari

- [ ] passare da single-tenant a multi-tenant
- [ ] introdurre tabella utenti
- [ ] introdurre tabella account eBay collegati
- [ ] introdurre tabella token eBay per utente
- [ ] introdurre tabella subscription/notifiche
- [ ] introdurre isolamento dati e scoping per `telegram_chat_id`
- [ ] introdurre scheduler che processa per tenant

## Fase 4 - Onboarding Self-Service Telegram + eBay OAuth [Priorita' media]

### Esperienza target utente

- [ ] rendere disponibile onboarding self-service da Telegram
- [ ] permettere il collegamento del proprio account eBay con OAuth per singolo utente
- [ ] utente apre il bot e fa `/start`
- [ ] il bot presenta un pulsante "Collega account eBay"
- [ ] il pulsante apre una pagina web sicura con OAuth eBay
- [ ] l'utente autorizza il proprio account venditore
- [ ] il backend salva token e associazione con l'utente Telegram
- [ ] il bot conferma collegamento riuscito
- [ ] l'utente puo' configurare notifiche e comandi personali

### Componenti implementativi

- [ ] mini web app o callback server per OAuth
- [ ] gestione `state` anti-CSRF
- [ ] storage sicuro dei token
- [ ] mapping sicuro tra sessione OAuth e utente Telegram
- [ ] pagina di successo/fallimento leggibile
- [ ] comando `/disconnect` per scollegare l'account
- [ ] comando `/whoami` o `/account` per vedere stato collegamento
- [ ] disegnare in dettaglio il flusso Telegram -> web -> eBay prima dell'implementazione

### Comandi da introdurre

- [ ] `/connect`
- [ ] `/disconnect`
- [ ] `/account`
- [ ] `/notifications on`
- [ ] `/notifications off`
- [ ] `/settings`

## Fase 5 - Governance del Prodotto [Priorita' media]

- [ ] definire governance e limiti del servizio in modo compatibile con isolamento dati tra utenti
- [ ] definire quali dati personali vengono trattati
- [ ] scrivere informativa minima d'uso e retention
- [ ] definire retention dei log
- [ ] definire retention dei token e dati ordini
- [ ] chiarire policy di cancellazione utente
- [ ] definire limiti del servizio e carichi supportati
