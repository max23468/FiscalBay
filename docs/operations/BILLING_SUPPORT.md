# Assistenza sui pagamenti

Procedura dell'assistenza per i casi di billing che richiedono un intervento manuale. Fa parte delle [operazioni](OPERATIONS.md); le regole commerciali sono nei [piani](../product/PLANS_AND_BILLING.md#s06), l'ingresso degli eventi Stripe nel [runbook dei webhook](WEBHOOKS.md#webhook), avvisi e severità nell'[osservabilità](OBSERVABILITY.md).

<a id="principi"></a>
## Principi

Con Managed Payments Stripe è il merchant of record: emette ricevute e note di credito, risponde all'assistenza Link, può rimborsare entro 60 giorni e gestisce le dispute. FiscalBay non emette rimborsi né crediti e non scrive importi su Stripe: rilegge pagamenti, rimborsi e dispute e ne applica l'effetto sui diritti ([S18](../reference/SOURCES.md#s18)).

Lo stato locale si corregge sempre rileggendo Stripe, mai a mano. Webhook e compito orario `billing` arrivano allo stesso codice, che rilegge l'oggetto corrente: un evento ripetuto, tardivo o fuori ordine produce lo stesso risultato. Di conseguenza:

- non modificare D1 con query manuali per creare, prolungare o revocare coperture, posti o abbonamenti;
- non usare una concessione per correggere un diritto pagato che manca: **Concedi Pro** crea una copertura gratuita, rinvia il rinnovo su Stripe e non si annulla dalla console;
- non dedurre un rimborso o un mancato pagamento da un oggetto che Stripe non restituisce più: le coperture già pagate restano.

Le azioni della console richiedono la sessione confermata con la passkey e, dove serve, il motivo; autore, motivo ed esito finiscono nel **Registro**. I riferimenti Stripe (cliente, sessione, abbonamento) si leggono nella scheda dello spazio e si cercano nella Dashboard dell'ambiente: sandbox per il test, account live per Production. Nei messaggi, nelle PR e nei log non si copiano email, importi o riferimenti.

<a id="dove"></a>
## Dove si controlla

| Fonte | Cosa mostra |
|---|---|
| Console, scheda dello spazio | **Diritti e incassi** (origine, periodo, pagato, rimborsato, revoca), **Abbonamenti** (stato, rinnovo, disdetta, indisponibile), posto lifetime, **Clienti Stripe** con l'eventuale cancellazione dei dati finanziari, lifetime pagati senza assegnazione |
| Console, **Commerciale** | Posti lifetime (venduti, omaggio, prenotati, rimborsati, riconcessi), incassi al netto dei rimborsi registrati, **Revoche, rimborsi e dispute**, **Cancellazioni finanziarie**, listino confrontato con Stripe |
| Console, **Panoramica** e **Lavori** | Anomalie «Lifetime pagato senza assegnazione», «Lavori periodici fermi», «Eventi dei provider in ritardo», con il comando che le affronta |
| Bot dell'ambiente, chat dell'owner | Avvisi di rinnovo non pagato, chiusura dell'abbonamento, rimborso parziale o totale, disputa aperta o persa, cancellazione finanziaria, posti lifetime ([avvisi commerciali](OBSERVABILITY.md)) |
| Dashboard Stripe | Pagamenti, rimborsi, dispute, clienti, abbonamenti, consegne del webhook, richieste dell'assistenza Link, commissioni e payout |
| `node scripts/commercial.mjs verify --since <ISO> [--mode live]` | Confronto in sola lettura fra vendite Stripe e D1, con soli esiti e conteggi |

<a id="riconciliazione"></a>
## Riconciliazione ordinaria

Il compito `billing` gira ogni ora e rilegge: le sessioni completate degli ultimi due giorni senza abbonamento o posto locale, le prenotazioni dei posti, gli abbonamenti con rinnovo scaduto o tutela del prezzo finita, quelli in attesa di attivazione da oltre un'ora e, una volta al giorno, ogni abbonamento aperto o cancellato con il periodo ancora in corso e ogni lifetime venduto non revocato. Un rimborso o una disputa persa senza webhook arrivano quindi al più entro un giorno.

Controllo periodico, e dopo un incidente che tocca i pagamenti:

1. In **Commerciale**, confrontare incassi e revoche con pagamenti e rimborsi della Dashboard per lo stesso periodo. Commissioni, imposte trattenute e payout si leggono soltanto su Stripe: la console mostra gli incassi registrati, non l'utile.
2. Eseguire `commercial.mjs verify` dalla data dell'ultimo controllo. Ogni fattura pagata e ogni lifetime pagato devono avere il proprio diritto; ogni abbonamento deve coincidere con Stripe per stato, periodicità, fine del periodo, disdetta e generazione del listino.
3. Uno scostamento si tratta come [diritto non allineato](#non-allineato). Se la causa non si chiarisce, resta un incidente aperto: non si chiude deducendo lo stato.

<a id="non-allineato"></a>
## Diritto non allineato a Stripe

Sintomi: un cliente ha pagato e non vede Pro, vede Pro dopo una disdetta conclusa, oppure `verify` segnala uno scostamento.

Controllare:

1. Nella scheda dello spazio, l'abbonamento: un abbonamento «indisponibile» non è più restituito da Stripe e non riceve nuove coperture.
2. Nella Dashboard, abbonamento e fatture del cliente: stato, periodo, fattura pagata. Un rinnovo `past_due` o `unpaid` porta lo spazio al Free subito, come previsto; Stripe ritenta l'incasso e FiscalBay chiude l'abbonamento alla fine dei sette giorni di tutela del prezzo.
3. In **Panoramica** e **Lavori**, se `billing` è fermo o se ci sono eventi Stripe in ritardo; nella Dashboard, le consegne non riuscite dell'endpoint `/webhooks/stripe`.

Fare:

- con eventi Stripe in ritardo, **Riprendi** riaccoda le ricevute non completate; con `billing` fermo, **Riaccoda**. Il comando non riparte se il lavoro è in esecuzione o già concluso nel turno;
- con una consegna fallita, si può ripetere l'evento dalla Dashboard: il consumer rilegge comunque lo stato corrente e una ricevuta già completata non produce effetti;
- altrimenti attendere il turno orario seguente, che rilegge gli abbonamenti dovuti.

Non fare: concessioni per coprire il periodo pagato, modifiche manuali dell'abbonamento su Stripe che il codice non prevede, query su D1.

Esito: la scheda mostra la copertura con la fattura che l'ha pagata e l'abbonamento coerente con la Dashboard; `verify` ripetuto non segnala scostamenti.

<a id="rimborso"></a>
## Richiesta di rimborso

I rimborsi obbligatori e quelli decisi da Stripe si accettano; gli altri si valutano caso per caso, senza garanzia volontaria generalizzata ([§6.4](../product/PLANS_AND_BILLING.md#s06)).

Controllare:

1. Nella Dashboard, il pagamento: importo, data, rimborsi già fatti da Stripe o dall'assistenza Link, dispute aperte. Un rimborso già emesso o una disputa aperta sullo stesso pagamento escludono un nuovo rimborso, per non restituire due volte.
2. Nella scheda dello spazio, quale copertura ha pagato quel pagamento: un rinnovo mensile o annuale, o il lifetime.

Fare: il rimborso si emette soltanto dalla Dashboard Stripe, sul pagamento. Gli effetti:

- **totale**: revoca soltanto la copertura di quel pagamento. Gli ordini sbloccati solo da quella copertura tornano bloccati e il downgrade parte dalla revoca; prova, concessioni, altre coperture e sblocchi del ciclo Free restano. Un lifetime rimborsato mantiene il posto occupato e non torna in vendita allo spazio, che può comprare mensile o annuale;
- **parziale**: si registra l'importo rimborsato, senza revoca e senza diventare giorni; riduce il credito di un futuro passaggio al lifetime. L'owner riceve l'avviso del rimborso parziale.

Il rimborso non chiude l'abbonamento: se il cliente non vuole il rinnovo successivo, la disdetta si fa dal portale clienti o dall'abbonamento in Dashboard, con fine a fine periodo.

Non fare: rimborsi o crediti fuori da Stripe, revoche manuali, compensazioni con giorni di Pro al posto di un rimborso parziale.

Esito: in **Diritti e incassi** la copertura mostra l'importo rimborsato e, se totale, «Revocato» con «rimborso»; la stessa voce compare in **Revoche, rimborsi e dispute**; l'owner riceve l'avviso.

<a id="link"></a>
### Richieste dell'assistenza Link

Le richieste di Stripe e Link arrivano a `supporto@fiscalbay.it` e hanno la precedenza su ogni altro lavoro: senza risposta entro 48 ore Stripe può rimborsare senza approvazione. Si risponde dalla Dashboard o dall'email entro il termine indicato. Un rimborso emesso da Stripe produce in FiscalBay lo stesso effetto di uno emesso dall'assistenza.

<a id="disputa"></a>
## Disputa

Stripe gestisce le dispute dei pagamenti Managed Payments: decide se contestarle, presenta le prove e può accettarle. L'owner riceve l'avviso della disputa aperta.

Controllare: nella Dashboard, stato e motivo della disputa e la scadenza di eventuali richieste. Nella scheda dello spazio, la copertura del pagamento contestato.

Fare: nulla sui diritti finché la disputa è aperta, perché non revoca Pro. Aggiungere prove dalla Dashboard soltanto se Stripe le chiede o se servono a un caso chiaro; contestare in proprio comporta una commissione. Un sospetto di frode grave si tratta come intervento separato, con l'owner.

Non fare: rimborsare un pagamento con una disputa aperta, revocare o concedere a mano.

Esito: una disputa vinta non cambia nulla; una disputa persa revoca la copertura come un rimborso totale e la scheda mostra «Revocato» con «disputa persa». L'owner riceve l'avviso della disputa persa.

<a id="cancellazione-finanziaria"></a>
## Cancellazione dei dati finanziari

Un cliente può chiedere a Stripe, tramite Link, di cancellare i propri dati finanziari: Stripe chiude i suoi abbonamenti e cancella il cliente. Con il webhook `customer.deleted` FiscalBay registra la cancellazione da sola. Lo spazio resta, con le coperture già attribuite; FiscalBay smette di usare quel cliente, non conta più i suoi rimborsi e chiude le sue segnalazioni. La perdita dell'oggetto non significa né «mai acquistato» né «rimborsato» ([§6.6](../product/PLANS_AND_BILLING.md#s06)).

Quando Stripe o l'assistenza Link segnalano la cancellazione fuori dal webhook:

1. Verificare nella Dashboard che il cliente risulti cancellato.
2. Nella scheda dello spazio, in **Clienti Stripe**, usare **Registra cancellazione tramite Link** con il cliente e il motivo. Vale soltanto per un cliente di quello spazio e soltanto se Stripe lo conferma ancora cancellato; poi rilegge gli abbonamenti aperti.

Esiti: «Cancellazione registrata e abbonamenti riletti»; «già registrata» se il webhook è arrivato prima; «Stripe non conferma il cliente cancellato: nulla registrato»; «Stripe non risponde: nulla registrato», da ripetere più tardi.

Non fare: cancellare l'account o lo spazio FiscalBay per questa richiesta, che è distinta dalla cancellazione dell'account; registrare un cliente che Stripe non conferma cancellato.

Esito: **Clienti Stripe** mostra «Dati finanziari cancellati» con l'origine, la voce compare in **Cancellazioni finanziarie** e l'owner riceve l'avviso.

<a id="concessioni"></a>
## Concessioni e posti lifetime

Le concessioni si danno dalla scheda dello spazio, con motivo obbligatorio; non figurano come incasso e non toccano quota, prova o ciclo. Non esiste un comando per revocarle: si verifica spazio e durata prima di confermare.

- **Concedi Pro**, da 1 a 366 giorni: parte dalla fine dell'ultima copertura in corso, così non consuma il periodo pagato, e concessioni successive si sommano. Con un abbonamento che si rinnova ne rinvia su Stripe il rinnovo, o il primo addebito scelto durante la prova, senza conguaglio; un rinnovo disdetto non si riattiva. Rifiutata con il lifetime in vigore; con Stripe irraggiungibile non registra nulla.
- **Concedi lifetime**: consuma uno dei venti posti e chiude subito l'abbonamento dello spazio, senza conguaglio né rimborso. Uno spazio con il lifetime revocato per rimborso o disputa lo riceve di nuovo sullo stesso posto. Con **Posto da riprendere** il cliente che torna dopo la cancellazione dell'account riprende il posto lasciato, senza ordini né prova; non vale se quella vendita è stata rimborsata o persa in disputa. Rifiutata con un acquisto lifetime in corso o a posti esauriti.
- **Estendi lo storico**, da 13 a 24 mesi, dopo l'accordo con l'assistenza; questa sì si revoca con **Revoca**.

Esito: la scheda mostra la copertura «Concesso» con autore e motivo, o il posto «omaggio»; il **Registro** riporta l'operazione.

<a id="lifetime-non-assegnato"></a>
## Lifetime pagato senza assegnazione

Un pagamento lifetime confermato quando nessun posto è libero non attribuisce il diritto e apre la P1 «Lifetime pagato senza assegnazione» sullo spazio. Il tetto dei posti non cambia.

Controllare: nella scheda dello spazio la sessione e il cliente da verificare; nella Dashboard il pagamento. Se un posto si libera nei due giorni successivi, il turno orario lo assegna da solo.

Fare: altrimenti si rimborsa per intero il pagamento dalla Dashboard e si informa il cliente. Il rimborso chiude la segnalazione alla rilettura dell'evento o, al più tardi, a quella giornaliera.

Non fare: **Concedi lifetime** per sistemare il caso, perché non è legato al pagamento e lascia aperta la segnalazione; superare il tetto dei posti.

Esito: la segnalazione sparisce da **Panoramica** e dalla scheda.

<a id="contenimento"></a>
## Contenimento

Un incasso errato o una revoca inattesa sono P1. Se il difetto può ripetersi su nuovi acquisti, l'interruttore **Acquisti e prove** ferma nuovi checkout e prove mentre webhook e riconciliazione continuano. Si riapre dopo la correzione e un `verify` senza scostamenti.
