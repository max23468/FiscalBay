# Changelog

Modifiche rilevanti di FiscalBay 2.x. Le versioni `rc` sono release candidate interne del test; la Production riceve soltanto versioni pubblicate con il proprio rilascio, con il giorno scritto dalla promozione. Le parti «Novità» e «What's new» di una versione sono la pagina Novità dell'app.

## [2.0.6]

## [2.0.5] - 2026-11-05

### Novità

#### Miglioramenti

- **Offerta scelta in evidenza.** Se scegli un'offerta Premium prima di registrarti, la pagina Piano te la mostra in evidenza.
- **Indirizzi in inglese.** In inglese anche le pagine dell'app hanno indirizzi in inglese; i vecchi indirizzi portano a quelli nuovi.

#### Correzioni

- **Negozi su schermi stretti.** L'ultima sincronizzazione di un negozio va a capo invece di uscire dalla pagina.

### What's new

#### Improvements

- **Chosen offer highlighted.** If you choose a Premium offer before signing up, the Plan page highlights it.
- **English addresses.** In English, app pages have English addresses too; old addresses lead to the new ones.

#### Fixes

- **Stores on narrow screens.** A store's last sync wraps instead of running off the page.

### Altre modifiche

- Sito pubblico: Guide per i venditori eBay, «Inizia gratis» nella barra accanto ad «Accedi», un pulsante per ogni offerta Premium e domande sui pagamenti in Prezzi, «Vai al contenuto principale» e listino di riserva per Home e Prezzi durante un disservizio.
- La barra del sito porta le pagine nella seconda riga fino a 1024 px e mostra «Accedi» da 440 px, così «Inizia gratis» non esce dallo schermo a nessuna larghezza.
- Le prove delle pagine misurano lo scorrimento orizzontale a ogni bordo dei breakpoint, da 320 a 1280 px, già nelle PR: prima le larghezze fra 390 e 1280 px si provavano soltanto nella qualifica del candidato.
- Home e Prezzi arrivano da una copia di un minuto nella cache di Cloudflare a chi non ha cookie, con il listino di riserva senza database; i vecchi indirizzi inglesi rispondono 301, o 308 ai moduli.
- Titoli con la parola chiave davanti, offerte e articoli nei dati strutturati, un'immagine social per pagina, `lastmod` nella sitemap, manifest con icone e colore del tema, immagine principale in AVIF a più larghezze e trenta giorni di cache per le immagini del sito; `security.txt` pubblicato.
- Il testo inglese segue la regola del 27 settembre: «Codice Fiscale» in titoli ed etichette, «tax code» nelle frasi.
- Un hook degli agenti ferma reset, stash, push forzati, Wrangler fuori dai casi ammessi, modifiche di migration applicate ed em dash; `verify:repo` controlla anche gli indirizzi degli account delle verifiche live e la scadenza di `security.txt`.
- Le decisioni superate per intero passano in un archivio e le operazioni sono divise in runbook.
- La mutation divide un modulo in parti di al più 150 mutanti anche quando i tagli fra le funzioni le sbilanciano: una parte troppo grande superava il limite di 60 minuti del job.
- Console su smartphone: email, identificativi ed etichette di stato vanno a capo nelle schede invece di uscire, e i campi data delle promozioni non allargano più il pannello. Le prove delle pagine misurano i bordi dei breakpoint con i pannelli richiudibili aperti.
- Sito pubblico: Guide riscritte, con un riquadro su come FiscalBay risolve il problema, la schermata della funzione e il menu di tutte le guide; titoli brevi per i risultati di ricerca e dati strutturati del percorso. Le Guide passano dal footer alla barra.
- La barra del sito mostra «Accedi» a ogni larghezza: sotto i 1024 px la lingua mostra soltanto il codice dell'altra e sotto i 360 px passa nel footer.
- Le Novità dell'app contengono soltanto i cambi dell'area dell'app: le voci sul sito pubblico passano nelle altre modifiche.
- Sotto i 640 px le pagine della seconda riga della barra del sito si distribuiscono con spazi uguali, anche ai lati, invece di restare raccolte a sinistra.
- Una versione nuova nasce soltanto da Novità per gli utenti dell'app: i cambi del sito pubblico, della console o interni vanno in Production con la versione già pubblicata, senza tag né release. La 2.0.6, pubblicata senza Novità, è ritirata: le sue voci passano nella 2.0.5, release e tag `v2.0.6` sono eliminati e la prossima versione con Novità sarà la 2.0.6. La 2.0.7, aperta per la sola barra del sito, è richiusa.
- Un cambio del changelog o dei frammenti distribuisce soltanto se cambia ciò che la pagina Novità mostra: le altre modifiche restano documentazione, senza deploy test né qualifica, e la loro PR si unisce in pochi minuti.

## [2.0.4] - 2026-11-05

### Novità

#### Miglioramenti

- **Ultimo metodo di accesso.** La pagina di accesso segna Google, eBay o la passkey quando li hai usati per l'ultimo accesso da questo browser.
- **Password violate rifiutate sempre.** Una nuova password che compare in violazioni di dati note viene rifiutata anche quando il controllo nel browser non può partire.
- **Accesso più protetto.** Dopo alcuni tentativi non riusciti, l'accesso con password chiede una breve verifica di sicurezza.

### What's new

#### Improvements

- **Last sign-in method.** The sign-in page marks Google, eBay or your passkey when you used it for your last sign-in on this browser.
- **Breached passwords always refused.** A new password that appears in known data breaches is refused even when the check in your browser cannot run.
- **Better protected sign-in.** After a few failed attempts, signing in with a password asks for a short security check.

### Altre modifiche

- La preparazione dell'accesso con passkey ha il limite per IP e la pulizia delle tabelle di Auth usa indici sulla scadenza.
- La regola di zona contro le raffiche copre anche le pagine di accesso e assistenza.
- Il token tecnico della console scade dopo 90 giorni e dieci token rifiutati dallo stesso IP bloccano i tentativi per 15 minuti.
- I token dei negozi eBay si cifrano con un segreto proprio, separato da quello di Auth; quelli cifrati con la chiave precedente si ricifrano al rinnovo.
- Stripe usa una versione dell'API fissata, un timeout di 8 secondi nelle richieste dell'utente e chiavi di idempotenza su sessioni di pagamento e coupon.

## [2.0.3] - 2026-11-04

### Novità

#### Miglioramenti

- **Storico dopo il passaggio a Premium.** Gli ordini eliminati alla scadenza della finestra Free tornano quando attivi Premium e l'importazione arriva al loro periodo.
- **Indirizzo nell'export.** Se eBay non fornisce l'indirizzo di fatturazione, il file riporta quello di spedizione.

#### Correzioni

- **Lettura degli ordini.** La lettura si conclude anche quando molti ordini cambiano mentre FiscalBay li legge, e dopo una pausa recupera tutti gli ordini modificati nel frattempo.
- **Negozio da ricollegare.** Se eBay rifiuta più volte le credenziali, la pagina Negozi chiede di ricollegare il negozio.

### What's new

#### Improvements

- **History after upgrading to Premium.** Orders deleted when the Free window ended come back when you activate Premium and the import reaches their period.
- **Address in the export.** If eBay does not provide the billing address, the file shows the shipping address.

#### Fixes

- **Order reading.** Reading completes even when many orders change while FiscalBay reads them, and after a pause it recovers every order modified in the meantime.
- **Store to reconnect.** If eBay rejects the credentials several times, the Stores page asks you to reconnect the store.

### Altre modifiche

- Gli ordini si leggono per tratti di tempo da 200 ordini e Trading per finestre di trenta giorni concatenate; nessuna ricerca fiscale su Trading oltre i novanta giorni e l'immagine di un'inserzione si legge una volta.
- La sottoscrizione agli ordini di eBay si ricontrolla ogni settimana; i webhook di eBay, Stripe e Telegram hanno una coda propria e un messaggio perso si riprende dopo due ore.
- Le richieste HTTP non scrivono più nel registro delle attività; la CPU per invocazione è limitata a 30 secondi e l'ID Telegram dell'owner è un segreto.
- Le chiamate alla Bot API passano da un Worker separato con il token del bot, e le tracce del Worker principale sono accese.
- La pulizia degli ordini scaduti procede a blocchi e le chiavi anti-reimport si eliminano dopo due anni.

## [2.0.2] - 2026-11-03

### Novità

#### Miglioramenti

- **Password più sicure.** Se scegli una password che compare in violazioni di dati note, FiscalBay ti chiede di sceglierne un'altra. Se accedi con una password trapelata, un avviso ti invita a cambiarla da Impostazioni › Account.
- **Pagine più rapide.** Alle visite successive il browser riusa i file già scaricati, così le pagine si aprono prima.

### What's new

#### Improvements

- **Safer passwords.** If you choose a password that appears in known data breaches, FiscalBay asks you to pick another one. If you sign in with a leaked password, a notice invites you to change it from Settings › Account.
- **Faster pages.** On later visits your browser reuses the files it already downloaded, so pages open sooner.

### Altre modifiche

- Il robots.txt della Production ammette ricerca, risposte degli assistenti AI e addestramento con i Content Signals, e `/llms.txt` descrive il servizio con le pagine pubbliche.
- I Monitor di Cloudflare avvisano l'owner per email di cron fermo, eccezioni, messaggi nella coda dei falliti, spazio D1 ed email non consegnate; le protezioni della zona attivano il rilevamento delle credenziali trapelate.
- Il collaudo remoto indica le richieste ancora aperte quando l'attesa della rete non finisce.

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
