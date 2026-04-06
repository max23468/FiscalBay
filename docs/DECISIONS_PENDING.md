# Decisioni Aperte

Decisioni ancora aperte che influenzano le prossime fasi.

## Onboarding residuo

- decidere dove ospitare la parte web di onboarding
- rifinire il flusso UX finale tra Telegram, pagina web e callback conclusivo
- decidere se esporre un comando pubblico minimo di policy/privacy per il bot
- definire meglio il lifecycle account/token da esporre nel bot: `linked`, `token_expired`, `revoked`, `reconnect_required`, `error`
- definire fino a che punto rendere `/start` adattivo allo stato utente/account senza appesantire l'esperienza Telegram
- definire il perimetro utile di comandi esplicativi come `/reconnect_status` e `/why_not_notified`

## Evoluzione futura

- decidere se introdurre pruning automatico per `audit_log` e sessioni OAuth vecchie
- decidere se portare la cancellazione utente da procedura amministrativa a flusso self-service
- decidere il livello minimo di rate limiting per un bot pubblico con accesso approvato
- definire come formalizzare i limiti del servizio pubblico con accesso approvato
- definire il set minimo di strumenti admin permanenti per governare un servizio piccolo e curato
- decidere quali metriche prodotto minime debbano essere visibili all'admin in modo stabile
- decidere come trattare tenant inattivi o dormienti senza introdurre complessita' inutile
- decidere quali alert di prodotto meritino davvero di diventare persistenti per l'admin
- chiarire il modello finale del doppio percorso di uscita: scollegare solo l'account eBay oppure disattivare anche l'accesso utente
- decidere quando SQLite smette di essere accettabile per il numero reale di utenti approvati
- decidere se il componente web di onboarding debba restare sulla VPS attuale o essere separato
