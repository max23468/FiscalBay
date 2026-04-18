# Roadmap

## Fase 1 - Servizio Pubblico con Accesso Approvato

Fase 1 completata.

## Fase 2 - Guardrail e Strumenti Admin

- [ ] introdurre rate limiting minimo per utente sui comandi sensibili e sul flusso `/connect`
- [ ] introdurre cooldown o throttling sulle richieste `/request_access`
- [ ] introdurre cooldown sui fallimenti OAuth ripetuti e sui tentativi di collegamento ravvicinati
- [ ] mantenere esplicitamente il modello con un solo admin globale, senza co-admin in questa fase
- [ ] aggiungere un comando admin per sospendere o riattivare rapidamente un utente gia' approvato
- [ ] aggiungere un comando admin per vedere solo richieste `pending`
- [ ] aggiungere un comando admin per vedere utenti approvati ma senza account eBay collegato
- [ ] aggiungere un piccolo cruscotto admin via Telegram con richieste `pending`, utenti approvati senza account collegato, tenant con token scaduti o revocati e code anomale
- [ ] aggiungere una vista admin compatta di salute tenant con accesso, account collegato, stato token, notifiche e ultimo errore significativo
- [ ] aggiungere un riepilogo admin periodico con utenti `pending`, tenant scollegati e code anomale
- [ ] aggiungere un messaggio o comando pubblico minimo che spieghi come funziona l'accesso approvato
- [ ] decidere se introdurre un comando `/privacy` o `/policy` che punti alla governance del servizio
- [ ] introdurre una modalita' manutenzione che blocchi nuovi collegamenti ma lasci leggibili i comandi informativi
- [ ] introdurre una modalita' incidente o degradata che distingua chiaramente tra consultazione ancora disponibile e funzioni temporaneamente sospese
- [ ] aggiungere metriche prodotto minime per admin: utenti `pending`, `approved`, utenti con account linked, utenti approvati ma inattivi, fallimenti OAuth recenti
- [ ] aggiungere alert di prodotto oltre ai soli alert runtime, ad esempio utenti `pending` fermi da giorni, tenant approvati mai collegati o token revocati da troppo tempo

## Fase 3 - Lifecycle Dati e Retention

- [ ] introdurre pruning automatico di `audit_log` secondo la retention dichiarata
- [ ] introdurre pruning automatico delle `oauth_link_sessions` vecchie o gia' concluse
- [ ] rendere osservabile dal healthcheck quando il pruning non gira o lascia arretrati anomali
- [ ] introdurre un flusso amministrativo esplicito di cancellazione utente e tenant
- [ ] definire e applicare la rimozione coordinata di token, mapping chat, subscription, stato runtime e sessioni OAuth residue
- [ ] chiarire nei doc operativi cosa resta conservato in audit log dopo la cancellazione
- [ ] estendere l'audit log agli eventi amministrativi di cancellazione, pruning e revoca remota
- [ ] aggiungere un riepilogo amministrativo minimo per verificare richieste accesso, utenti approvati e tenant scollegati
- [ ] trasformare la cancellazione amministrativa in un workflow esplicito con esito utente, audit dedicato e cleanup verificabile
- [ ] introdurre un piccolo export amministrativo dei dati di un tenant per supporto o richiesta utente
- [ ] definire un trattamento esplicito dei tenant inattivi o dormienti, separato dalla cancellazione completa
- [ ] introdurre una review curata dei tenant inattivi, con segnalazione admin prima di qualsiasi cleanup o disattivazione
- [ ] aggiungere un comando admin dedicato alla review dei tenant dormienti o inattivi da troppo tempo
- [ ] chiarire se alcuni messaggi amministrativi o conferme utente vadano resi meno ripetitivi o meno persistenti nel tempo

## Fase 4 - Ottimizzazione Applicativa e Storage

- [ ] ridurre scritture SQLite superflue per metriche e stato runtime, privilegiando aggiornamenti solo su cambiamenti significativi
- [ ] introdurre uno snapshot sintetico dell'ultimo stato utile per tenant, riusabile da UX, admin view e health path senza ricalcoli pesanti
- [ ] separare meglio i percorsi hot e cold del bot, evitando che audit, review admin o cleanup pesino sul polling ordini e sulle notifiche
- [ ] rendere healthcheck e reconciliation economici anche con piu' tenant approvati
- [ ] introdurre pruning e cleanup orientati agli access pattern reali di healthcheck, admin e bot
- [ ] introdurre indici SQLite mirati per accessi frequenti su utenti, stati, sessioni OAuth, audit log e operation queue
- [ ] spostare il calcolo di metriche admin e prodotto verso snapshot periodici o reconciliation, evitando query live inutilmente costose

## Fase 5 - Robustezza VPS e Recovery

- [ ] estendere i backup dal solo `state.db` a un backup ricostruibile del servizio: `.env`, unit `systemd`, configurazione `nginx` e componenti necessari al ripristino
- [ ] introdurre un restore drill periodico del servizio, non solo del database
- [ ] gestire meglio crescita e retention dei log di bot, oauth, reconcile e `nginx`
- [ ] aggiungere monitoraggio minimo di disco, memoria, inode e pressione risorse sulla VPS
- [ ] aggiungere un healthcheck esterno HTTPS oltre ai controlli locali
- [ ] aggiungere un controllo periodico su certificati TLS e raggiungibilita' del callback pubblico
- [ ] introdurre un inventario rapido di configurazione e stato del servizio per recovery e diagnosi
- [ ] rendere lo smoke deploy piu' completo, verificando bot, oauth, reconcile timer, healthcheck e endpoint esterno
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
