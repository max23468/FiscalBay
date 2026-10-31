# Changelog

Modifiche rilevanti di FiscalBay 2.x. Le versioni `rc` sono release candidate interne del test; la Production riceve soltanto versioni pubblicate con il proprio rilascio.

## [2.0.1]

### Novità

- **Totale degli ordini letti da eBay Trading.** Il totale non comprende più la tariffa di protezione acquisti che l'acquirente paga a eBay, attiva in Italia per gli acquisti da venditori privati: prima Ordini ed Esportazione potevano mostrare un importo che non incassi.

### What's new

- **Totals of orders read from eBay Trading.** The total no longer includes the buyer protection fee the buyer pays to eBay, active in Italy for purchases from private sellers: Orders and Export could previously show an amount you do not receive.

### Altre modifiche

- Console: gli avvisi commerciali del Control Center Telegram si aprono con il titolare dell'account (nome, ragione sociale, email e metodi di accesso) e «Account cancellato» conserva i dati del titolare salvati alla richiesta. La Privacy indica Telegram anche per gli avvisi interni sull'uso del servizio.
- La pagina Novità e la campanella si ricavano dalle parti «Novità» e «What's new» di questo changelog; la promozione su `main` scrive il giorno della versione.

## [2.0.0]

Prima versione di FiscalBay 2.0, applicazione web su Cloudflare che sostituisce la 1.x. Contiene la `2.0.0-rc.12` provata sul test.

- Account con email e password, Google, passkey e accesso con eBay; sessioni revocabili, verifica dell'email e MFA per l'amministrazione.
- Collegamento dei negozi eBay in sola lettura, con pausa, ricollegamento e scollegamento; i nuovi ordini arrivano con l'avviso di eBay.
- Ordini importati da eBay con controllo dell'identificativo fiscale, ricerca, filtri, dettaglio e sblocco per ordine entro la quota del piano.
- Messaggi all'acquirente in italiano e inglese da copiare, con suggerimenti.
- Esportazione CSV, XLSX e ZIP con file privati a scadenza.
- Bot Telegram per avvisi e comandi del proprio account, con la notifica di un nuovo ordine appena eBay lo segnala.
- Piano Free, con la promozione di lancio attiva fino alla sua chiusura, prova e abbonamento Premium con Stripe Managed Payments, lifetime, concessioni e lista d'attesa.
- Sito pubblico in italiano e inglese, Termini e Privacy, assistenza e cancellazione self-service dell'account.
- Email leggibili anche nei client in tema scuro.
- Console di amministrazione con indicatori, metriche tecniche e quote eBay.
- Protezioni dei moduli, limiti delle richieste, protezioni della zona, log conservati in UE e ripristino dei dati con servizio sospeso.

## [2.0.0-rc.12]

- Le email di FiscalBay restano leggibili nei client in tema scuro, come Mail di Apple: prima il titolo e il testo principale diventavano scuri su sfondo scuro.
- Su desktop, «Passa a Premium» dalla sezione Telegram delle Impostazioni porta al piano: prima cambiava l'indirizzo senza scorrere.

## [2.0.0-rc.11]

- La notifica Telegram di un nuovo ordine arrivato con l'avviso eBay parte subito, insieme alla lettura dell'ordine, invece che con il controllo successivo dei dieci minuti.
- Sito: le pagine pubbliche contano visite e tempi di caricamento con Cloudflare Web Analytics, senza cookie, quando l'ambiente ha il suo token; accesso, app e console restano fuori. La Privacy descrive le statistiche e i cookie tecnici che ricordano una scelta.
- Sul solo ambiente di test l'accesso invia i suoi eventi alla dashboard di Better Auth; la Production resta senza.

## [2.0.0-rc.10]

- Registrazione: «Registrati come» al posto di «Ti registri come» e consenso a novità e offerte senza ripetizioni («Ricevi novità e offerte via email»). Il testo del consenso cambia, quindi cambia la versione registrata con la scelta.

## [2.0.0-rc.9]

- Nessuna modifica di comportamento: la periodicità degli abbonamenti torna fra le regole provate dal mutation test, in un modulo proprio.

## [2.0.0-rc.8]

- Promozione Free senza data di fine: dalla console si crea lasciando vuota la fine e resta attiva finché non si termina o non riceve una data. Senza fine home e Prezzi la annunciano per un periodo limitato; con la fine programmata mostrano la data.

## [2.0.0-rc.7]

- Nessuna modifica di comportamento: le prove dell'ingresso eBay controllano il motivo dei rifiuti, e la cifratura dei token del negozio e lo schema del rinnovo si calcolano a ogni uso, così il mutation test li prova con le sole prove che li coprono.

## [2.0.0-rc.6]

- Dalla console un posto lifetime rimasto senza spazio non si riprende più se la sua vendita è stata rimborsata per intero o persa in disputa: FiscalBay la rilegge su Stripe prima di concedere il diritto.
- Sito: su smartphone selettore della lingua alto come «Accedi» e riga delle pagine allineata al logo; nella home Mensile e Annuale affiancati, con l'annuale in evidenza e i mesi gratuiti.

## [2.0.0-rc.5]

- La revoca del consenso inviata da eBay con valori segnaposto non viene più rifiutata, e il log del Worker indica se un avviso eBay è stato rifiutato per la firma o per lo schema.

## [2.0.0-rc.4]

- I negozi collegati ricevono da eBay l'avviso dei nuovi ordini: il collegamento chiede anche lo scope delle notifiche, FiscalBay sottoscrive il negozio dopo la prima lettura e toglie la sottoscrizione allo scollegamento. I negozi già collegati la ricevono dopo un nuovo collegamento.
- Un avviso eBay di un venditore senza negozio attivo non viene più rifiutato.

## [2.0.0-rc.3]

- Nessuna modifica di comportamento: nuove prove per l'escape del testo HTML e XML, la chat con il bot Telegram e l'elenco Ordini in arrivo, stati di pagamento provati in testa alla suite degli ordini ed esclusione del separatore delle query degli stati ripristinata.

## [2.0.0-rc.2]

- L'avviso all'owner per una disputa aperta parte soltanto dall'evento di apertura su un abbonamento o un lifetime; nuove prove per la disputa e per le prime righe dell'Esportazione.

## [2.0.0-rc.1]

Prima release candidate di FiscalBay 2.0, applicazione web su Cloudflare che sostituisce la 1.x.

- Account con email e password, Google, passkey e accesso con eBay; sessioni revocabili, verifica dell'email e MFA per l'amministrazione.
- Collegamento dei negozi eBay in sola lettura, con pausa, ricollegamento e scollegamento.
- Ordini importati da eBay con controllo dell'identificativo fiscale, ricerca, filtri, dettaglio e sblocco per ordine entro la quota del piano.
- Messaggi all'acquirente in italiano e inglese da copiare, con suggerimenti.
- Esportazione CSV, XLSX e ZIP con file privati a scadenza.
- Bot Telegram per avvisi e comandi del proprio account.
- Piano Free, prova e abbonamento Premium con Stripe Managed Payments, lifetime, concessioni e lista d'attesa.
- Sito pubblico in italiano e inglese, Termini e Privacy, Novità, assistenza e cancellazione self-service dell'account.
- Console di amministrazione con indicatori, metriche tecniche e quote eBay.
- Protezioni dei moduli, limiti delle richieste, protezioni della zona, log conservati in UE e ripristino dei dati con servizio sospeso.
