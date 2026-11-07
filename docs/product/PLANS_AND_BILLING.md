# FiscalBay · Piani e pagamenti

Funzioni per piano, ciclo Free, trial, abbonamenti, lifetime e diritti.

<a id="s04"></a>
## 4. Matrice funzionalità, piani e prezzi

Un Free e **un solo livello funzionale Pro**. Mensile, annuale e lifetime sono modalità commerciali, non tre livelli. Abbonamento per spazio, non per negozio. Nessun addebito a consumo, quota periodica individuale Pro o numero commerciale fisso di negozi Pro; restano limiti tecnici e antiabuso reali.

| Capacità | Free 2.0 | Pro / trial / lifetime 2.0 |
|---|---|---|
| Negozio eBay attivo | 1, sostituibile ogni 90 giorni | Più negozi, senza tetto commerciale predeterminato |
| Storico standard | 30 giorni mobili | Un anno; oltre su richiesta valutata |
| Consultazione non fiscale, ricerca, filtri | Inclusi | Inclusi |
| Nuovi ordini con dati fiscali accessibili | 5 per ciclo; 10 durante promo globale | Senza plafond periodico commerciale |
| Dati assenti/errori | Nessun consumo | Nessun consumo |
| CSV standard, una riga per ordine/articolo | Incluso | Incluso |
| XLSX, colonne selezionabili/riordinabili, configurazioni export | Non inclusi | Inclusi |
| Suggerimenti fiscali da precedenti dello stesso spazio | No | Sì, separati dal dato corrente |
| Notifiche ordini Telegram | No | Sì, facoltative e configurabili |
| Email necessarie, supporto, sicurezza, export profilo | Inclusi | Inclusi |
| Filtri salvati / schede personalizzate / Analisi | Non nella 2.0 | Roadmap 2.x, non segnaposto nel menu 2.0 |

Listino canonico **IVA e tasse applicabili escluse**: `4,90 EUR/mese`, `49 EUR/anno`, `149 EUR/lifetime`. Annuale: 12 mesi al prezzo di 10, risparmio base 9,80 EUR. Venti lifetime complessivi tra venduti e assegnati gratuitamente. Valori approvati per la pianificazione e da qualificare economicamente prima della vendita; non modificarli senza owner.

Il sito mostra netto + IVA con evidenza appropriata del totale per il tipo di acquirente. Accettiamo la conversione valuta proposta da Stripe; non gestiamo listini locali autonomi. Il prezzo protetto è quello base EUR, non il controvalore in valuta. Il trattamento B2C e la copertura fiscale delle vendite sono gate obbligatori, non deduzioni dal logo del provider. [S01](../reference/SOURCES.md#s01) [S03](../reference/SOURCES.md#s03) [S11](../reference/SOURCES.md#s11)

<a id="s05"></a>
## 5. Ciclo Free, promozione, inattività e ammissione

Il primo collegamento eBay riuscito fissa l'ancoraggio del ciclo; non la registrazione senza negozio. Cicli consecutivi non sovrapposti, senza accumulo o azzeramento per cambio fuso, logout, riconnessione, sostituzione o nuova importazione. `free_cycles` conserva inizio, fine e quota applicabile; utilizzo dai diritti/eventi validi. Materializzare i cicli quando servono, senza creare milioni di righe vuote.

Promozione globale, non per ogni nuovo utente: 10 ordini per ciclo anziché 5, attiva dal go-live finché Matteo non la chiude ([D239](../decisions/DECISION_REGISTER.md)); configurazione admin senza deploy. Senza una fine la pagina prezzi la annuncia per un periodo limitato; quando Matteo decide la chiusura, la fine programmata compare con la sua data. Il Piano indica la quota del ciclo in corso e, se diversa, quella del ciclo seguente. Il ciclo personale iniziato prima della fine promo conserva la sua quota fino alla scadenza; quello seguente usa 5.

La quota conta solo un ordine con almeno un dato fiscale effettivamente reso accessibile, anche se formalmente incoerente. Non conta API call, tentativo fallito, assenza, refresh, copia, esportazione o apertura successiva. Dati presenti ma bloccati rimangono protetti; quota esaurita non ferma acquisizione/consultazione non fiscale.

Un beneficio Free per attività. Controlli proporzionati, IP mai unica identità né motivo unico di blocco; nessun uso dei dati buyer per profilare il venditore. Trial non ripetibile creando account nuovi per lo stesso negozio. La conservazione minima dei segnali deve rispettare il contratto privacy e non diventare archivio occulto.

Dopo 30 giorni senza attività **umana verificata**, avviso e 7 giorni di preavviso; poi pausa sync Free se non vi è conferma. La sync automatica non prova utilizzo umano. Nessuna sospensione per sola inattività dei diritti pagati/lifetime/concessioni attive. Riattivazione self-service con login e conferma, recuperando quanto ancora disponibile nella finestra senza nuova promo/trial/quota. L'attività umana verificata è l'apertura di una pagina dell'area con una sessione; letture, webhook e cron non la registrano. Il preavviso è un'email con la data limite e conta soltanto se l'invio riesce. La pausa per inattività lascia consultabili gli ordini; la ripresa vale per tutti i negozi dello spazio e chiede subito una lettura. Una copertura in corso toglie pausa e preavviso.

Waitlist attivabile manualmente dall'admin per nuovi Free. Non retroattiva per utenti attivi. Se vi è capacità per nuovi Pro, percorso circoscritto di collegamento e prima sync prima dell'acquisto; non avvia polling Free continuativo. Nessun addebito se non acquista. Trial facoltativo solo se erogabile, senza consumarlo durante attesa. Se manca capacità anche per paganti, fermare nuovi acquisti. **Q569 prevale sui percorsi antecedenti.** Chi è in attesa ottiene soltanto la prima lettura di un negozio, senza letture periodiche, rinnovi dei token né sblocchi del Free, e vede proposte prova e Pro. Con gli acquisti chiusi si fermano checkout, prova e lifetime di chi non è abbonato, e chi è in attesa non collega negozi; rinnovi, passaggio a vita degli abbonati e Free degli ammessi continuano.

<a id="s06"></a>
## 6. Trial, abbonamenti, lifetime e diritti

### 6.1 Trial e decorrenza

Prova interna FiscalBay, 14 giorni, facoltativa, senza carta, attivabile dopo prima sync riuscita. Nessuna subscription Stripe soltanto per attivare il trial. Senza acquisto, torna al Free senza addebito. Il trial scorre anche scollegando il negozio; non si rinnova tramite un altro profilo. Una sola prova per spazio, anche dopo scadenza o revoca. Ordini e Piano contano i giorni di prova rimasti come il Checkout, soltanto interi, e nell'ultimo giorno indicano «meno di un giorno rimasto».

**Q567 (D194):** se il merchant sceglie mensile o annuale durante la prova, oggi non paga: l'abbonamento parte con i giorni di prova residui e il primo addebito arriva alla scadenza originaria della prova, da cui decorrono periodo pagato e rinnovi. Sei giorni residui + annuale = nessun pagamento oggi, primo addebito fra sei giorni, rinnovo dodici mesi dopo. Un solo addebito alla fine della prova, mai prima. Il Checkout Stripe richiede almeno due giorni di prova: con meno giorni residui il primo addebito è immediato e il periodo pagato parte dall'acquisto, senza interrompere Pro. Distinguere nel modello fine della prova, primo addebito e prossima fatturazione. La regola originaria del pagamento immediato è superata: con Managed Payments il rinvio si esprime soltanto come prova gratuita e Stripe presenterebbe come gratuito anche il periodo pagato. Nessun pagamento non MoR per aggirarla.

Lifetime durante il trial: diritto immediato e nessuna futura scadenza commerciale; la prova resta sotto il lifetime fino alla sua fine e torna in vigore se il lifetime viene revocato per rimborso o disputa (D197). Acquisto richiede primo collegamento e prima sync riuscita, anche senza ordini/CF; non richiede aver usato il trial.

### 6.2 Rinnovi e listino protetto

Mensile→annuale e annuale→mensile alla fine del periodo pagato; niente conguaglio immediato. Disdetta ferma il rinnovo ma preserva il periodo pagato. Il portale chiede un motivo facoltativo fra troppo caro, non lo uso abbastanza, passo a un altro servizio, manca una funzione, non funziona come mi aspettavo e altro, con un commento; la riconciliazione dell'abbonamento li legge dai `cancellation_details` per l'owner ([D314](../decisions/DECISION_REGISTER.md)). Scollegare l'ultimo negozio non disdice: avviso chiaro e accesso alla disdetta, senza chiedere un motivo. Il cambio di periodicità parte dal Piano, si annulla fino al rinnovo e aspetta il primo periodo pagato. Un abbonamento scelto durante la prova si disdice dal Portal prima del primo addebito: alla fine della prova lo spazio torna al Free senza addebiti.

Gli abbonamenti continuativi conservano **entrambe** le periodicità del proprio listino EUR anche se cambiano modalità. Il vecchio prezzo non dà diritto a un futuro lifetime al prezzo storico. Mancato rinnovo autorevole: Free subito, vecchia tariffa recuperabile entro 7 giorni regolarizzando. Nessuna settimana Pro gratuita implicita. Le comunicazioni e i tentativi di recupero sono delegati al provider; dopo il termine non applicare silenziosamente un vecchio prezzo incoerente: riconciliare politica di retry e stato contrattuale nel gate.

Un outage, evento duplicato o ritardo webhook non prova mancato pagamento. Applicare i diritti locali nei periodi di validità documentati e riconciliare con il provider; non estendere indefinitamente un grant scaduto soltanto perché il provider è irraggiungibile.

### 6.3 Lifetime e concessioni

Disponibilità atomica in FiscalBay prima del checkout, con prenotazione temporanea, rilascio sicuro per scadenza e conferma autorevole. Prenotazioni e omaggi non superano il tetto; omaggi consumano posti. Il tetto ferma la vendita, non un incasso già avvenuto: un pagamento confermato a posti finiti riceve il lifetime su un posto oltre il ventesimo, che conta nel tetto ([D316](../decisions/DECISION_REGISTER.md)). Separare incasso, omaggio, prenotazione e diritto attivo. Non ripristinare automaticamente posti già assegnati in modo da aggirare il tetto dell'offerta.

Passaggio a lifetime: offerta corrente e residuo disponibile, detraendo il periodo ricorrente **pagato e inutilizzato** secondo il contratto qualificato, non giorni omaggio. Evitare doppio abbonamento/rinnovo residuo. Il lifetime, pagato o in omaggio, chiude subito su Stripe l'abbonamento senza conguaglio, anche quello scelto durante la prova, e la sessione di mensile o annuale ancora aperta. Con un rinnovo o un primo addebito che cade entro la durata del checkout il passaggio a vita aspetta il rinnovo. Una concessione Pro parte dalla fine dell'ultima copertura in corso, così concessioni contemporanee si sommano. Il lifetime vive in FiscalBay ed è riconciliabile con la prova dell'acquisto; include il livello equivalente nelle versioni future e nelle app native, non ogni futura funzione o risorse illimitate.

Admin può assegnare trial/grant pertinenti, Pro temporaneo e lifetime; estensioni gratuite di abbonati si aggiungono dopo copertura pagata e rinviano rinnovo, senza figurare come incasso. Se il rinnovo era già disdetto, l’estensione non lo riattiva: prolunga soltanto il diritto gratuito concesso. Cancellazione account non distrugge il diritto lifetime: archivio commerciale minimo separato, recupero solo dopo verifica della titolarità, senza ripristinare ordini cancellati.

### 6.4 Downgrade e rimborsi

Dopo Pro/trial, **tutti gli ordini con dati già acquisiti e resi disponibili mantengono lo sblocco, anche mai aperti** (Q568). Nel Free valgono ultimi 30 giorni e negozio attivo. Nessun diritto retroattivo se il primo dato arriva dopo la fine Pro. Un ordine già sbloccato non richiede pagamento per un secondo identificativo o una correzione successiva.

Scelta del negozio attivo esplicita; in mancanza il primo ancora collegato. Eccedenti in pausa, dati non consultabili né aggiornati conservati transitoriamente 30 giorni ove consentito, poi eliminati. La breve conservazione non prevale su cancellazioni obbligatorie.

Nessuna garanzia volontaria generalizzata o rimborso self-service. Supporto decide caso per caso entro diritti obbligatori/provider. Rimborso totale confermato revoca il grant corrispondente, non altri diritti indipendenti. Rimborso parziale non esposto nell'admin 2.0 e non tradotto automaticamente in giorni; se proviene da Stripe va riconciliato senza perdere integrità. Disputa aperta non revoca di per sé Pro; frode grave può richiedere intervento separato. Una disputa persa revoca il grant come un rimborso totale. Gli ordini sbloccati soltanto dalla copertura revocata tornano bloccati e il downgrade parte dalla revoca; gli sblocchi del ciclo Free restano. Il lifetime rimborsato non torna in vendita allo spazio, che può acquistare mensile e annuale. Accettare rimborsi decisi dal MoR e alertare richieste di supporto soggette a scadenza.

### 6.5 Provider, checkout, metodi e documenti

**Stripe Managed Payments è il provider primario; Paddle è soltanto l’alternativa attivabile da Matteo.** Un pagamento Stripe Payments standard, anche accompagnato da Stripe Tax, non è un fallback autorizzato. Ogni checkout deve risultare realmente configurato nel percorso Managed Payments, con prodotto/categoria e trattamento fiscale ammessi; provare anche l’errore di una sessione non MoR. Il listino EUR resta unico, con conversione nativa del provider ammessa, e prezzi netti distinti dal totale con imposte mostrato al cliente.

Hosted Checkout, raccolta di paese/indirizzo/dati fiscali nel provider e ritorno a FiscalBay con stato «Attivazione Pro in corso». Solo verifica server e riconciliazione attribuiscono il diritto. Accettare Link e Customer Portal per le funzioni supportate: disdetta e aggiornamento metodo effettuati lì hanno la stessa efficacia di quelli avviati dall’app. Conservare riferimenti e stato necessari; documenti consultabili tramite provider, non copie ordinarie nel nostro storage. Configurare brand/descriptor riconoscibile e spiegare il riferimento Link ove necessario, senza presentare FiscalBay come intestatario esclusivo di ogni transazione. Sull'estratto conto compare `LINK.COM*` seguito da «FISCALBAY». Il checkout raccoglie email, dati di pagamento, nome del titolare, paese e una partita IVA facoltativa, senza telefono né spedizione; nelle impostazioni fiscali dell'account la sede riporta soltanto il paese, per scelta dell'owner. Prima della vendita il server rilegge il prezzo su Stripe e la ferma se non è attivo, in euro, netto, della periodicità attesa e su un prodotto con codice fiscale. Uno spazio ha al più una sessione che può incassare: una nuova richiesta chiude la precedente di qualunque offerta. Finché un abbonamento può incassare, un nuovo acquisto ricorrente resta fermo e la prova non si offre.

Metodi abilitati soltanto se compatibili con ricorrenza/una tantum e costo accettabile per mensile, annuale e lifetime. Nessuna soglia percentuale universale. Apple Pay/Google Pay ammessi quando non hanno un sovrapprezzo specifico rispetto alla carta sottostante; non presumere che un brand di carta sia sempre più caro o escludibile. PayPal resta condizionale al supporto Managed Payments, senza account PayPal separato dell’owner, e non blocca la 2.0 se assente.

La configurabilità dei metodi deve essere verificata **nel prodotto Managed Payments**, non dedotta dalle opzioni di Checkout standard. Non aggirare parametri non supportati tornando a Payments ordinario; se un controllo economico richiesto non è realizzabile, registrare il limite nel gate e ottenere la decisione dell’owner. Non è previsto acquistare un dominio personalizzato per Checkout: la documentazione Managed Payments non lo supporta al momento della revisione. [S01](../reference/SOURCES.md#s01) [S18](../reference/SOURCES.md#s18)

### 6.6 Eventi esterni e cancellazione dei dati di pagamento

La riconciliazione commerciale prosegue senza browser aperto: recupera pagamenti confermati, rinnovi ed errori rimasti pendenti usando la stessa logica di grant dei webhook. Scegliere cadenza e priorità in base a scadenze, tentativi ed effettivi limiti Stripe; non copiare le cadenze Shopify. Provare chiusura del browser dopo pagamento, evento mancante/tardivo e ripresa dopo errore, senza doppio incasso o doppio diritto.

I webhook verificati alimentano lo stato locale; la riconciliazione server corregge eventi mancanti, duplicati o fuori ordine. Separare pagamento confermato, autorizzazione non ancora incassata, pagamento pendente e fallimento. Un importo, un `customer_id` o la pagina di successo forniti dal client non dimostrano un acquisto. Le comunicazioni finanziarie restano al provider; le richieste di supporto con termine arrivano al contatto configurato e agli alert prioritari. I messaggi di Stripe e Link a `supporto@fiscalbay.it` si leggono entro 48 ore, dopo le quali Stripe può rimborsare.

**Cancellazione richiesta al provider diversa dalla cancellazione dell’account FiscalBay.** Stripe documenta che una richiesta tramite Link può cancellare oggetti finanziari e annullare abbonamenti anche nell’account Stripe del fornitore. Il contratto d’integrazione deve quindi gestire la perdita autorevole di quegli oggetti e l’eventuale segnalazione fuori webhook. Non considerare automaticamente un oggetto non più reperibile come «mai acquistato», «rimborsato» o ordine di eliminare tutto lo spazio FiscalBay. [S18](../reference/SOURCES.md#s18)

Verificare provenienza e perimetro dell’evento; interrompere rinnovi e conservazione non più ammessi, applicare i diritti commerciali già approvati e la conservazione minima lecita della prova. Non ricreare anagrafiche o fatture per eludere una richiesta di cancellazione. Il diritto lifetime recuperabile dopo cancellazione resta distinto dal dato operativo e dalla disponibilità futura dell’oggetto Stripe. Caso incompleto o ambiguo: gestione circoscritta e segnalazione amministrativa, senza revoche o nuovi addebiti arbitrari. Il gate legale definisce la gestione della richiesta, non un consenso generico del merchant.

### 6.7 Casi temporali da rendere verificabili

Per ogni grant registrare origine, intervallo di copertura, importo effettivamente pagato e collegamento alla prova autorevole. Coprire passaggio di mese, fine mese, anno bisestile, cambio di periodicità e estensione amministrativa; non derivare il rinnovo aggiungendo un numero fisso di giorni. Riconciliare anche richieste commerciali concorrenti (switch, disdetta, proroga, lifetime), senza sovrascrivere una scelta successiva con un webhook tardivo.

La prenotazione di un posto lifetime non si libera mentre il relativo checkout può ancora produrre un incasso valido. Sono qualificati scadenza della sessione, pagamenti asincroni, conferme tardive e recupero dopo crash, compreso l’ultimo posto. Nessuna prenotazione infinita e nessuna vendita eccedente «da rimborsare poi» come normale strategia. Un esito ambiguo blocca la riallocazione di quel posto fino alla riconciliazione; non modifica il tetto né autorizza un rimborso automatico non previsto. Un pagamento confermato dopo la liberazione del suo posto occupa il primo posto libero e, a posti finiti, un posto oltre il ventesimo; se lo spazio ha già un altro posto si registra per l'assistenza, senza diritto né rimborso automatico.

I confini di ciclo, trial e periodo si confrontano sull'istante UTC e sul fuso del ciclo, mai sulla sola data locale ricavata da un timestamp UTC: un evento della prima notte del ciclo non deve cadere nel giorno precedente. I test coprono fusi a est e a ovest di UTC. Oltre ai webhook, un ciclo periodico riconcilia i diritti attivi con Stripe come rete di sicurezza per eventi mancati o ritardati, senza inventare diritti in caso di errore. Nel ciclo periodico ogni passo (riconciliazione, alert, notifiche, retention) registra il proprio errore senza fermare gli altri; una priorità di recupero vale una sola volta per gli elementi mai tentati e non rimette in coda ogni volta gli stessi elementi.
