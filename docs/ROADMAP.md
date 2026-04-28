# Roadmap

## Fase 1 - Servizio Pubblico con Accesso Approvato

Fase 1 completata.

## Fase 2 - Guardrail e Strumenti Admin

Fase 2 completata.

## Fase 3 - Lifecycle Dati e Retention

Fase 3 completata.

## Fase 4 - Ottimizzazione Applicativa e Storage

Fase 4 completata.

## Fase 5 - Robustezza VPS e Recovery

- [ ] estendere i backup dal solo `state.db` a un backup ricostruibile del servizio: `.env`, unit `systemd`, configurazione `nginx` e componenti necessari al ripristino
- [ ] introdurre un restore drill periodico del servizio, non solo del database
- [ ] gestire meglio crescita e retention dei log di bot, oauth, reconcile e `nginx`
- [ ] aggiungere monitoraggio minimo di disco, memoria, inode e pressione risorse sulla VPS
- [ ] aggiungere un healthcheck esterno HTTPS oltre ai controlli locali
- [ ] aggiungere un controllo periodico su certificati TLS e raggiungibilita' del callback pubblico
- [ ] introdurre un inventario rapido di configurazione e stato del servizio per recovery e diagnosi
- [ ] aggiungere un healthcheck esterno HTTPS programmato oltre allo smoke deploy
- [ ] aggiungere playbook incidente piu' specifici per token eBay, callback OAuth, `state.db`, `nginx` e notifiche ferme

## Fase 6 - Consolidamento del Servizio Pubblico

- [ ] mantenere il servizio esplicitamente `Telegram first`, evitando che la parte web diventi il punto di ingresso principale del prodotto
- [ ] formalizzare il posizionamento del bot come servizio pubblico ma piccolo e curato, con crescita controllata tramite approvazione admin
- [ ] mantenere le notifiche attive di default per gli utenti approvati, salvo disattivazione esplicita dell'utente o intervento admin
- [ ] trasformare i limiti attuali del bot in policy esplicite per servizio pubblico con accesso approvato
- [ ] definire soglie operative oltre cui la VPS attuale non e' piu' sufficiente
- [ ] chiarire quando SQLite smette di essere accettabile per il servizio pubblico
- [ ] decidere dove ospitare stabilmente la parte web di onboarding
- [ ] decidere se mantenere onboarding e callback sulla VPS attuale o separare i ruoli applicativi
- [ ] preparare il passaggio a un database piu' robusto prima di allargare davvero il numero di utenti approvati
- [ ] rafforzare le unit `systemd` con hardening aggiuntivo dove compatibile
- [ ] valutare un utente di servizio ancora piu' dedicato o confinato se l'assetto attuale non basta
- [ ] valutare watchdog o meccanismi equivalenti per rilevare loop bloccati senza crash esplicito
- [ ] introdurre limiti risorse ragionevoli per i servizi principali
