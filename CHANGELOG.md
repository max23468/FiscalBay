# Changelog

Modifiche rilevanti di FiscalBay 2.x. Le versioni `rc` sono release candidate interne del test; la Production riceve soltanto versioni pubblicate con il proprio rilascio.

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
