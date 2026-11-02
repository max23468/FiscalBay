# Changelog

Modifiche rilevanti di FiscalBay 2.x. Le versioni `rc` sono release candidate interne del test; la Production riceve soltanto versioni pubblicate con il proprio rilascio, con il giorno scritto dalla promozione. Le parti «Novità» e «What's new» di una versione sono la pagina Novità dell'app.

## [2.0.2]

### Novità

#### Miglioramenti

- **Termini e Privacy.** Abbiamo aggiornato le informazioni su dove sono trattati i log, su Telegram, sul limite dei tentativi di accesso e sui dati che restano dopo la cancellazione dell'account.

### What's new

#### Improvements

- **Terms and Privacy.** We updated the information on where logs are processed, on Telegram, on the sign-in attempt limit and on the data kept after account deletion.

## [2.0.1] - 2026-11-01

### Novità

#### Funzionalità

- **Pagina Novità.** Raccoglie le funzionalità, i miglioramenti e le correzioni di ogni versione. Si apre dal menu del profilo e la campanella segnala ogni nuova versione.

#### Miglioramenti

- **Impostazioni dell'account.** Dati personali, email, metodi di accesso e sessioni sono riuniti nella sezione Account, che si apre dal menu del profilo.

#### Correzioni

- **Totale degli ordini.** Ordini ed Esportazione mostrano l'importo incassato, senza la tariffa di protezione acquisti che l'acquirente paga a eBay.
- **Navigazione dagli Ordini.** Dalla pagina Ordini, una voce del menu o della navigazione apre sempre la pagina scelta, senza restare sull'elenco.

### What's new

#### Features

- **What's new page.** It collects the features, improvements and fixes of each version. Open it from the profile menu; the bell announces each new version.

#### Improvements

- **Account settings.** Personal details, email, sign-in methods and sessions are together in the Account section, opened from the profile menu.

#### Fixes

- **Order total.** Orders and Export show the amount you receive, without the buyer protection fee the buyer pays to eBay.
- **Navigation from Orders.** From the Orders page, a menu or navigation item always opens the chosen page instead of staying on the list.

### Altre modifiche

- Console: gli avvisi commerciali del Control Center Telegram si aprono con il titolare dell'account (nome, ragione sociale, email e metodi di accesso) e «Account cancellato» conserva i dati del titolare salvati alla richiesta. La Privacy, nella versione `2026-11-01`, indica Telegram anche per gli avvisi interni sull'uso del servizio.
- La pagina Novità e la campanella si ricavano dalle parti «Novità» e «What's new» di questo changelog; la promozione su `main` scrive il giorno della versione.

## [2.0.0] - 2026-11-01

Prima versione di FiscalBay 2.0, applicazione web su Cloudflare che sostituisce la 1.x. Contiene la `2.0.0-rc.12` provata sul test.

### Novità

#### Funzionalità

- **Nuova FiscalBay.** Un'app web in italiano e in inglese, da usare nel browser su computer e smartphone.
- **Ordini e dati fiscali.** Gli ordini eBay arrivano con il codice fiscale o la partita IVA già controllati, con ricerca e filtri.
- **Negozi eBay.** Colleghi uno o più negozi in sola lettura: FiscalBay legge gli ordini senza modificarli e mostra i nuovi appena arrivano.
- **Messaggi all'acquirente.** Un messaggio già scritto, in italiano o in inglese, per chiedere il dato fiscale.
- **Esportazione.** Gli ordini si scaricano in CSV, Excel o ZIP.
- **Telegram.** Il bot segnala i nuovi ordini e risponde ai comandi del tuo account.
- **Accesso e piani.** Accedi con email, Google, passkey o eBay; i piani sono Free, prova gratuita e Premium.

### What's new

#### Features

- **New FiscalBay.** A web app in Italian and English, to use in the browser on computer and smartphone.
- **Orders and tax data.** eBay orders arrive with tax code or VAT number already checked, with search and filters.
- **eBay stores.** Connect one or more stores read-only: FiscalBay reads orders without changing them and shows new ones as soon as they arrive.
- **Buyer messages.** A ready-made message, in Italian or English, to ask for tax data.
- **Export.** Orders can be downloaded as CSV, Excel or ZIP.
- **Telegram.** The bot announces new orders and answers the commands of your account.
- **Sign-in and plans.** Sign in with email, Google, passkey or eBay; plans are Free, free trial and Premium.

### Contenuto

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
