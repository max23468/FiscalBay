# Decisioni Aperte

Decisioni ancora aperte che influenzano le prossime fasi.

## Onboarding residuo

- decidere dove ospitare la parte web di onboarding
- decidere se esporre un comando pubblico minimo di policy/privacy per il bot
- verificare se lo stato `error` vada davvero esposto stabilmente in UX oppure tenuto come failure mode interno
- decidere quanto rendere persistente e visibile all'utente la memoria dell'ultimo failure reason OAuth/reconnect

## Evoluzione futura

- decidere se introdurre pruning automatico per `audit_log` e sessioni OAuth vecchie
- decidere se portare la cancellazione utente da procedura amministrativa a flusso self-service
- decidere il livello minimo di rate limiting per un bot pubblico con accesso approvato
- definire come formalizzare i limiti del servizio pubblico con accesso approvato
- definire il set minimo di strumenti admin permanenti per governare un servizio piccolo e curato
- decidere quali metriche prodotto minime debbano essere visibili all'admin in modo stabile
- decidere come trattare tenant inattivi o dormienti senza introdurre complessita' inutile
- decidere quali alert di prodotto meritino davvero di diventare persistenti per l'admin
- decidere quando SQLite smette di essere accettabile per il numero reale di utenti approvati
- decidere se il componente web di onboarding debba restare sulla VPS attuale o essere separato
