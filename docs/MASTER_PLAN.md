# FiscalBay 2.0 · Master Plan

**Prodotto:** FiscalBay · **Operatore/brand:** Temisfera · **Owner:** Matteo
**Obiettivo:** prima release web completa `2.0.0` · **Repository:** `max23468/FiscalBay`

Specifica canonica del prodotto e dei criteri di accettazione. Le decisioni sono consolidate fino a Q569 e comprendono le semplificazioni tecniche/documentali approvate. Le scelte rinviate a M0 sono gate, non funzionalità già qualificate. [Avanzamento e questioni aperte](#stato) vivono nella roadmap; i via effettivi nel governo qui sotto. Codice, PR/CI e readback attestano rispettivamente implementazione, verifiche e stato remoto.

[Avvio e indice](../README.md) · [Istruzioni agente](../AGENTS.md) · [Decisioni e motivazioni](DECISION_REGISTER.md) · [Setup](engineering/AGENT_SETUP.md) · [Fonti](SOURCES.md) · [Riferimenti grafici](brand/REFERENCES.md)

## Indice

- [0. Governo del piano e fonti autorevoli](#s00)
- [1. Visione, pubblico e confini del prodotto](#s01)
- [2. Perimetro 2.0, esclusioni e futuro](#s02)
- [3. Glossario vincolante](#s03)
- [4. Matrice funzionalità, piani e prezzi](#s04)
- [5. Ciclo Free, promozione, inattività e ammissione](#s05)
- [6. Trial, abbonamenti, lifetime e diritti](#s06)
- [7. Autenticazione, identità e sessioni](#s07)
- [8. Negozi, collegamenti e stati](#s08)
- [9. Ordini e dati fiscali](#s09)
- [10. Buyer, suggerimenti e dati mancanti](#s10)
- [11. Strategia eBay, code e sincronizzazione](#s11)
- [12. Export ordini e portabilità dell'account](#s12)
- [13. Telegram](#s13)
- [14. Email, supporto e consenso marketing](#s14)
- [15. Console amministrativa](#s15)
- [16. Architettura dell'informazione e route](#s16)
- [17. Schermata Ordini e dettaglio](#s17)
- [18. Schermata Negozi eBay](#s18)
- [19. Impostazioni, Profilo e campanella](#s19)
- [20. Onboarding, stati vuoti e modalità degradate](#s20)
- [21. Brand, logo e riferimenti](#s21)
- [22. Design system, accessibilità e predisposizione Expo](#s22)
- [23. Sito pubblico, contenuti e SEO](#s23)
- [24. Dominio, DNS, TLS e posta](#s24)
- [25. Architettura e confini dei servizi](#s25)
- [26. Toolchain, dipendenze e policy latest](#s26)
- [27. Modello dati logico e invarianti](#s27)
- [28. Contratti API e gestione degli errori](#s28)
- [29. Sicurezza e segreti](#s29)
- [30. Privacy, conservazione, cancellazione e licenze](#s30)
- [31. Osservabilità, metriche e supporto operativo](#s31)
- [32. Recovery, incidenti e continuità](#s32)
- [33. Agenti, plugin, MCP, skill e strumenti](#s33)
- [34. Git, CI/CD, versioning, Pubblica e Promuovi](#s34)
- [35. Strategia di test e criteri osservabili](#s35)
- [36. Gate di qualificazione e criteri di arresto](#s36)
- [37. Milestone M0–M9](#s37)
- [38. Registro rischi operativo](#s38)
- [39. Roadmap successiva e non-promesse](#s39)
- [40. Decisioni superate e coerenza trasversale](#s40)
- [41. Definition of Done finale e checklist go-live](#s41)


<a id="s00"></a>
## 0. Governo del piano e fonti autorevoli

### 0.1 Stati e prevalenza

**Confermato** = requisito approvato; **Default tecnico** = scelta delegata e reversibile; **Gate aperto** = scelta o verifica da completare; **Rinviato** = fuori dalla versione corrente; **Superato** = da non implementare. «Confermato con gate» combina requisito deciso e fattibilità ancora da dimostrare, non indica avanzamento del codice.

Per il prodotto prevale l’ultima decisione esplicita dell’owner, da riportare nel piano. Contratti esterni e condizioni applicabili vanno verificati sulle fonti ufficiali correnti; codice/test/configurazioni attestano ciò che esiste, readback del provider ciò che è attivo. Una discordanza richiede una correzione o una decisione dell’owner, non un cambio tacito dello scope. `AGENTS.md` governa l’esecuzione, non modifica i requisiti.

### 0.2 Autonomia e checkpoint

L'agente decide i dettagli tecnici reversibili ed esegue le attività previste nel mandato, incluse operazioni Production autorizzate, senza chiedere consenso per ogni comando. Non introduce autonomamente nuovi costi/provider o cambi sostanziali di prodotto, diritti, privacy e UX. Rispetta conferme imposte dagli strumenti e non modifica risorse di altri progetti perché accessibili nello stesso account. Paddle si attiva solo su decisione di Matteo.

| Checkpoint dell’owner | Decisione |
|---|---|
| Fine M0 | Assetto, piani/costi, database e Auth qualificati |
| M1 | Logo 2.0, brand foundation e design system |
| M5 | Configurazione commerciale e Stripe live |
| M8 | Test con il merchant reale di fiducia |
| M9 | Candidato e pubblicazione commerciale `Promuovi` |

Il mandato iniziale adotta la baseline e avvia M0; non concede anticipatamente questi checkpoint. La preparazione dei documenti non avvia l’implementazione. I via effettivi sono registrati soltanto nella tabella seguente, con data e perimetro; `Pubblica` porta le modifiche soltanto sul test, resta nella PR pertinente e non anticipa la Production.

| Checkpoint | Via effettivo e perimetro |
|---|---|
| Fine M0 | 2026-09-23: Workers, una D1 UE, Queues e Better Auth, costi differiti, limiti e rinvii espliciti; avvio di M1. Nessun nuovo costo o go-live autorizzato. Adozione e avvio originari: 2026-09-13. Costo differito deciso il 2026-10-12: Workers Paid continuativo e invio email con Cloudflare Email Service (D169). |
| M1 | Logo approvato il 2026-09-26, design system il 2026-09-27, prototipo e chiusura M1 il 2026-09-28. Nessuna pubblicazione Production autorizzata. |
| M5 | In attesa: configurazione commerciale/live e confini degli effetti economici. |
| M8 | In attesa: merchant, ambiente, dati e prove reali autorizzati. |
| M9 | In attesa: candidato/manifest, date promo, checklist e comando `Promuovi`. |

### 0.3 Una fonte per responsabilità

| Fonte | Contenuto canonico |
|---|---|
| Questo piano | Requisiti, eccezioni, invarianti, gate e DoD; roadmap, avanzamento sintetico, checkpoint e questioni aperte |
| Decision Register | Sintesi della scelta, motivazione utile e collegamento al requisito; non una seconda specifica |
| PR, CI e ricevute di pubblicazione | Cambiamento e verifiche dell'intervento; commit/artefatto distribuito, migration e readback pertinenti |
| Codice, schema, configurazioni e test | Contratti eseguibili e stato tecnico; versioni nei manifest/lockfile |
| ADR / contratti / runbook pertinenti | Solo scelte costose da invertire, comportamenti condivisi non autoesplicativi o procedure reali |
| Fonti e riferimenti di brand | Documentazione esterna e immagini approvate |

Non ripetere la stessa prescrizione per esteso in più fonti. Nel piano si mantiene il requisito, nella PR la prova dell'intervento e nel registro il perché. La granularità ordinaria è la milestone o una capacità significativa; i passi tecnici restano nella PR. Aggiornare questo piano soltanto per cambi di requisito, checkpoint, avanzamento significativo o questioni aperte, nella stessa PR dell'implementazione e prima del merge. Fix ordinari, refactoring e miglioramenti dei test non richiedono una modifica documentale fittizia. Il template PR dichiara l'impatto sul piano e il motivo. I test verificano una regola, non la ridefiniscono. Documenti separati solo con contenuto sostanziale e riusato; niente catalogo di file vuoti o API descritte a mano due volte se lo schema eseguibile è già sufficiente.

Gli audit e la copertura numerica del grill in `docs/archive/` sono fotografie storiche, non letture ordinarie, specifiche correnti o vincoli di CI. Nuove sezioni, file accorpati e identificativi non consecutivi sono ammessi se i riferimenti e i requisiti restano coerenti.

### 0.4 Completezza e prove

Una funzione è completa quando comportamento, permessi, persistenza, errori, IT/EN, responsive, test e documentazione pertinenti coincidono. Una schermata o un HTTP 200 non bastano. Indicare ambito della prova (documentale, sintetico, sandbox, reale autorizzato) ed esito (non eseguito, passato, parziale, bloccato o non applicabile motivato). Non simulare come riuscito ciò che il sandbox non consente di osservare; assegnare la prova residua al gate competente.

Una prova breve, un test o il log CI pertinenti possono bastare: non serve una ricevuta documentale per ogni comando. Dati sensibili su account, quote residue, chiavi e anti-abuso restano nella custodia privata del setup; requisiti e prove sanificate possono essere pubblici. Le protezioni devono funzionare anche se il codice è visibile.

### 0.5 Avvio e continuità

Avvio e ripresa sono nel [README](../README.md#avvio); la procedura di adozione iniziale è [archiviata](archive/2026-09-adozione-2.0.md). Allineare le istruzioni 1.x e verificare i trigger legacy nell'inventario iniziale, senza alterare istruzioni globali o lavoro altrui. La roadmap conserva avanzamento, task per milestone e pendenze utili alla ripresa; Git conserva la storia. Non creare un archivio del vecchio tracker, un diario o uno stato concorrente.

Accessi, dati legali, destinatario del test e date promo si acquisiscono secondo il [catalogo input](engineering/AGENT_SETUP.md#input). Non occorre ricostruire le decisioni dalla chat; una credenziale mancante blocca soltanto il lavoro dipendente. Le [responsabilità documentali](engineering/AGENT_SETUP.md#deliverable) indicano dove mantenere le informazioni prodotte nello sviluppo, senza imporre file anticipati.

<a id="s01"></a>
## 1. Visione, pubblico e confini del prodotto

FiscalBay diventa una web app per venditori eBay: registrazione autonoma, collegamento degli account, acquisizione degli ordini, ricerca e consultazione, accesso al Codice Fiscale e agli altri dati fiscali disponibili, copie/esportazioni e notifiche Telegram. La web app è il centro; Telegram è facoltativo e non serve per accedere o usare il prodotto.

Target prioritario: piccoli e medi merchant italiani. Sono ammessi utenti esteri e venditori occasionali, senza restrizione deliberata ai soli professionisti. L'utente deve avere capacità di stipulare il contratto, con riferimento 18+ e condizioni applicabili. Non è una soluzione iniziale per agenzie multi-cliente.

La promessa principale è **«Recupera il Codice Fiscale dagli ordini eBay»**. Il dato viene ottenuto dalle API ufficiali quando disponibile; FiscalBay non lo inventa, non certifica la sua verità e non sostituisce un gestionale contabile. Il valore è eliminare passaggi ripetitivi di consultazione e organizzazione, non promettere CF presenti nel 100% degli ordini.

Principi: sola lettura dei dati eBay; nessun contatto automatico con l'acquirente; piani semplici; delega dei servizi comuni; qualità visiva e operativa; niente dipendenze speculative; nessuna falsa scarsità; stessa protezione dei dati per Free e Premium. Codice Fiscale è il termine pubblico principale; Partita IVA è secondaria, mai rinominata impropriamente CF. «Identificativi fiscali (Codice Fiscale, Partita IVA)» resta il termine ombrello dove davvero necessario.

<a id="s02"></a>
## 2. Perimetro 2.0, esclusioni e futuro

La 2.0 comprende tutte le funzioni e i percorsi definiti in questo piano, non un MVP ridotto. Un unico utilizzatore per attività/spazio; più negozi per Premium; IT/EN; sito pubblico e area riservata; amministrazione nello stesso prodotto; supporto essenziale; quattro metodi di accesso; controllo e recupero dei dati.

Esclusi dalla 2.0: modifica/completamento manuale dei dati ordine; emissione delle fatture degli ordini eBay; invii email/chat agli acquirenti; gestione inserzioni, spedizioni o rimborsi eBay; API pubblica commerciale; collaboratori; personalizzazione delle schede; filtri salvati; Analisi; pagina completa Notifiche; pagina pubblica di stato; coupon; app native e installazioni desktop. Le esclusioni non cancellano le corrispondenti voci della roadmap.

Offline escluso da **tutta la serie 2.x**. I file scaricati non sono una modalità offline dell'app. La 3.x prevede iOS/Android, con React Native/Expo come direzione approvata da qualificare allora; non include come impegno applicazioni native Windows/macOS. Condividere dominio, contratti e token, non forzare componenti React DOM dentro interfacce native. Non creare adesso package Expo vuoti.

Nessuna beta pubblica e nessuna data rigida di sviluppo. Prima della pubblicazione un solo merchant di fiducia, oltre a test automatici/sintetici. Non inventare utenti reali, recensioni, endorsement o roadmap pubblica.

<a id="s03"></a>
## 3. Glossario vincolante

| Termine | Significato |
|---|---|
| Merchant | Utilizzatore/venditore che usa FiscalBay, distinto dall'acquirente eBay |
| Spazio / workspace | Confine di attività, dati, abbonamento e autorizzazione; termine prevalentemente interno |
| Negozio eBay | Account venditore collegato; non presuppone l'acquisto di un abbonamento negozio eBay |
| Buyer | Acquirente eBay; identità collegabile soltanto se affidabile e consentita |
| Ordine | Unità di consultazione e di conteggio degli sblocchi, con articoli separati |
| Disponibile | Dato realmente ottenuto da una fonte qualificata; non necessariamente leggibile dal Free |
| Assente | Verifica completata senza dato; non sinonimo di errore, mascheramento o campo omesso dall'elenco |
| Sblocco | Diritto di accesso fiscale relativo all'ordine, non a ogni singolo valore |
| Ciclo Free | Intervallo individuale di 7 × 24 ore dall'ancoraggio al primo collegamento riuscito |
| Grant / concessione | Origine e periodo di un diritto: trial, pagamento, lifetime, estensione o intervento admin |
| Piano effettivo | Funzioni ottenute dall'insieme dei diritti validi; non una stringa aggiornata dal browser |
| Sincronizzazione | Nuova lettura della fonte; non modifica eBay e non consuma da sola uno sblocco |
| Backfill | Importazione storica riprendibile, distinta dagli aggiornamenti correnti |
| Riconciliazione | Rilettura autorevole per recuperare eventi persi e correggere divergenze |
| MoR | Ruolo transazionale assunto dal provider dei pagamenti, distinto da Temisfera operatore del prodotto |
| FB | Sigla esclusivamente interna; non sostituisce FiscalBay nel frontend |

<a id="s04"></a>
## 4. Matrice funzionalità, piani e prezzi

Un Free e **un solo livello funzionale Premium**. Mensile, annuale e lifetime sono modalità commerciali, non tre livelli. Abbonamento per spazio, non per negozio. Nessun addebito a consumo, quota periodica individuale Premium o numero commerciale fisso di negozi Premium; restano limiti tecnici e antiabuso reali.

| Capacità | Free 2.0 | Premium / trial / lifetime 2.0 |
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

Il sito mostra netto + IVA con evidenza appropriata del totale per il tipo di acquirente. Accettiamo la conversione valuta proposta da Stripe; non gestiamo listini locali autonomi. Il prezzo protetto è quello base EUR, non il controvalore in valuta. Il trattamento B2C e la copertura fiscale delle vendite sono gate obbligatori, non deduzioni dal logo del provider. [S01](SOURCES.md#s01) [S03](SOURCES.md#s03) [S11](SOURCES.md#s11)

<a id="s05"></a>
## 5. Ciclo Free, promozione, inattività e ammissione

Il primo collegamento eBay riuscito fissa l'ancoraggio del ciclo; non la registrazione senza negozio. Cicli consecutivi non sovrapposti, senza accumulo o azzeramento per cambio fuso, logout, riconnessione, sostituzione o nuova importazione. `free_cycles` conserva inizio, fine e quota applicabile; utilizzo dai diritti/eventi validi. Materializzare i cicli quando servono, senza creare milioni di righe vuote.

Promozione globale di **due mesi**, non due mesi per ogni nuovo utente: 10 ordini per ciclo anziché 5. Date effettive stabilite da Matteo in M9; configurazione admin senza deploy. La pagina prezzi mostra la promo e la data finale, con preavviso. Il ciclo personale iniziato prima della fine promo conserva la sua quota fino alla scadenza; quello seguente usa 5.

La quota conta solo un ordine con almeno un dato fiscale effettivamente reso accessibile, anche se formalmente incoerente. Non conta API call, tentativo fallito, assenza, refresh, copia, esportazione o apertura successiva. Dati presenti ma bloccati rimangono protetti; quota esaurita non ferma acquisizione/consultazione non fiscale.

Un beneficio Free per attività. Controlli proporzionati, IP mai unica identità né motivo unico di blocco; nessun uso dei dati buyer per profilare il venditore. Trial non ripetibile creando account nuovi per lo stesso negozio. La conservazione minima dei segnali deve rispettare il contratto privacy e non diventare archivio occulto.

Dopo 30 giorni senza attività **umana verificata**, avviso e 7 giorni di preavviso; poi pausa sync Free se non vi è conferma. La sync automatica non prova utilizzo umano. Nessuna sospensione per sola inattività dei diritti pagati/lifetime/concessioni attive. Riattivazione self-service con login e conferma, recuperando quanto ancora disponibile nella finestra senza nuova promo/trial/quota.

Waitlist attivabile manualmente dall'admin per nuovi Free. Non retroattiva per utenti attivi. Se vi è capacità per nuovi Premium, percorso circoscritto di collegamento e prima sync prima dell'acquisto; non avvia polling Free continuativo. Nessun addebito se non acquista. Trial facoltativo solo se erogabile, senza consumarlo durante attesa. Se manca capacità anche per paganti, fermare nuovi acquisti. **Q569 prevale sui percorsi antecedenti.**

<a id="s06"></a>
## 6. Trial, abbonamenti, lifetime e diritti

### 6.1 Trial e decorrenza

Prova interna FiscalBay, 14 giorni, facoltativa, senza carta, attivabile dopo prima sync riuscita. Nessuna subscription Stripe soltanto per attivare il trial. Senza acquisto, torna al Free senza addebito. Il trial scorre anche scollegando il negozio; non si rinnova tramite un altro profilo.

**Q567 (D194):** se il merchant sceglie mensile o annuale durante la prova, oggi non paga: l'abbonamento parte con i giorni di prova residui e il primo addebito arriva alla scadenza originaria della prova, da cui decorrono periodo pagato e rinnovi. Sei giorni residui + annuale = nessun pagamento oggi, primo addebito fra sei giorni, rinnovo dodici mesi dopo. Un solo addebito alla fine della prova, mai prima. Il Checkout Stripe richiede almeno due giorni di prova: con meno giorni residui il primo addebito è immediato e il periodo pagato parte dall'acquisto, senza interrompere Premium. Distinguere nel modello fine della prova, primo addebito e prossima fatturazione. La regola originaria del pagamento immediato è superata: con Managed Payments il rinvio si esprime soltanto come prova gratuita e Stripe presenterebbe come gratuito anche il periodo pagato. Nessun pagamento non MoR per aggirarla.

Lifetime durante il trial: diritto immediato e nessuna futura scadenza commerciale; la prova resta sotto il lifetime fino alla sua fine e torna in vigore se il lifetime viene revocato per rimborso o disputa (D197). Acquisto richiede primo collegamento e prima sync riuscita, anche senza ordini/CF; non richiede aver usato il trial.

### 6.2 Rinnovi e listino protetto

Mensile→annuale e annuale→mensile alla fine del periodo pagato; niente conguaglio immediato. Disdetta ferma il rinnovo ma preserva il periodo pagato. Scollegare l'ultimo negozio non disdice: avviso chiaro e accesso alla disdetta.

Gli abbonamenti continuativi conservano **entrambe** le periodicità del proprio listino EUR anche se cambiano modalità. Il vecchio prezzo non dà diritto a un futuro lifetime al prezzo storico. Mancato rinnovo autorevole: Free subito, vecchia tariffa recuperabile entro 7 giorni regolarizzando. Nessuna settimana Premium gratuita implicita. Le comunicazioni e i tentativi di recupero sono delegati al provider; dopo il termine non applicare silenziosamente un vecchio prezzo incoerente: riconciliare politica di retry e stato contrattuale nel gate.

Un outage, evento duplicato o ritardo webhook non prova mancato pagamento. Applicare i diritti locali nei periodi di validità documentati e riconciliare con il provider; non estendere indefinitamente un grant scaduto soltanto perché il provider è irraggiungibile.

### 6.3 Lifetime e concessioni

Disponibilità atomica in FiscalBay prima del checkout, con prenotazione temporanea, rilascio sicuro per scadenza e conferma autorevole. Nessun overselling concorrente; omaggi consumano posti. Separare incasso, omaggio, prenotazione e diritto attivo. Non ripristinare automaticamente posti già assegnati in modo da aggirare il tetto dell'offerta.

Passaggio a lifetime: offerta corrente e residuo disponibile, detraendo il periodo ricorrente **pagato e inutilizzato** secondo il contratto qualificato, non giorni omaggio. Evitare doppio abbonamento/rinnovo residuo. Il lifetime vive in FiscalBay ed è riconciliabile con la prova dell'acquisto; include il livello equivalente nelle versioni future e nelle app native, non ogni futura funzione o risorse illimitate.

Admin può assegnare trial/grant pertinenti, Premium temporaneo e lifetime; estensioni gratuite di abbonati si aggiungono dopo copertura pagata e rinviano rinnovo, senza figurare come incasso. Se il rinnovo era già disdetto, l’estensione non lo riattiva: prolunga soltanto il diritto gratuito concesso. Cancellazione account non distrugge il diritto lifetime: archivio commerciale minimo separato, recupero solo dopo verifica della titolarità, senza ripristinare ordini cancellati.

### 6.4 Downgrade e rimborsi

Dopo Premium/trial, **tutti gli ordini con dati già acquisiti e resi disponibili mantengono lo sblocco, anche mai aperti** (Q568). Nel Free valgono ultimi 30 giorni e negozio attivo. Nessun diritto retroattivo se il primo dato arriva dopo la fine Premium. Un ordine già sbloccato non richiede pagamento per un secondo identificativo o una correzione successiva.

Scelta del negozio attivo esplicita; in mancanza il primo ancora collegato. Eccedenti in pausa, dati non consultabili né aggiornati conservati transitoriamente 30 giorni ove consentito, poi eliminati. La breve conservazione non prevale su cancellazioni obbligatorie.

Nessuna garanzia volontaria generalizzata o rimborso self-service. Supporto decide caso per caso entro diritti obbligatori/provider. Rimborso totale confermato revoca il grant corrispondente, non altri diritti indipendenti. Rimborso parziale non esposto nell'admin 2.0 e non tradotto automaticamente in giorni; se proviene da Stripe va riconciliato senza perdere integrità. Disputa aperta non revoca di per sé Premium; frode grave può richiedere intervento separato. Accettare rimborsi decisi dal MoR e alertare richieste di supporto soggette a scadenza.

### 6.5 Provider, checkout, metodi e documenti

**Stripe Managed Payments è il provider primario; Paddle è soltanto l’alternativa attivabile da Matteo.** Un pagamento Stripe Payments standard, anche accompagnato da Stripe Tax, non è un fallback autorizzato. Ogni checkout deve risultare realmente configurato nel percorso Managed Payments, con prodotto/categoria e trattamento fiscale ammessi; provare anche l’errore di una sessione non MoR. Il listino EUR resta unico, con conversione nativa del provider ammessa, e prezzi netti distinti dal totale con imposte mostrato al cliente.

Hosted Checkout, raccolta di paese/indirizzo/dati fiscali nel provider e ritorno a FiscalBay con stato «Attivazione Premium in corso». Solo verifica server e riconciliazione attribuiscono il diritto. Accettare Link e Customer Portal per le funzioni supportate: disdetta e aggiornamento metodo effettuati lì hanno la stessa efficacia di quelli avviati dall’app. Conservare riferimenti e stato necessari; documenti consultabili tramite provider, non copie ordinarie nel nostro storage. Configurare brand/descriptor riconoscibile e spiegare il riferimento Link ove necessario, senza presentare FiscalBay come intestatario esclusivo di ogni transazione.

Metodi abilitati soltanto se compatibili con ricorrenza/una tantum e costo accettabile per mensile, annuale e lifetime. Nessuna soglia percentuale universale. Apple Pay/Google Pay ammessi quando non hanno un sovrapprezzo specifico rispetto alla carta sottostante; non presumere che un brand di carta sia sempre più caro o escludibile. PayPal resta condizionale al supporto Managed Payments, senza account PayPal separato dell’owner, e non blocca la 2.0 se assente.

La configurabilità dei metodi deve essere verificata **nel prodotto Managed Payments**, non dedotta dalle opzioni di Checkout standard. Non aggirare parametri non supportati tornando a Payments ordinario; se un controllo economico richiesto non è realizzabile, registrare il limite nel gate e ottenere la decisione dell’owner. Non è previsto acquistare un dominio personalizzato per Checkout: la documentazione Managed Payments non lo supporta al momento della revisione. [S01](SOURCES.md#s01) [S18](SOURCES.md#s18)

### 6.6 Eventi esterni e cancellazione dei dati di pagamento

La riconciliazione commerciale prosegue senza browser aperto: recupera pagamenti confermati, rinnovi ed errori rimasti pendenti usando la stessa logica di grant dei webhook. Scegliere cadenza e priorità in base a scadenze, tentativi ed effettivi limiti Stripe; non copiare le cadenze Shopify. Provare chiusura del browser dopo pagamento, evento mancante/tardivo e ripresa dopo errore, senza doppio incasso o doppio diritto.

I webhook verificati alimentano lo stato locale; la riconciliazione server corregge eventi mancanti, duplicati o fuori ordine. Separare pagamento confermato, autorizzazione non ancora incassata, pagamento pendente e fallimento. Un importo, un `customer_id` o la pagina di successo forniti dal client non dimostrano un acquisto. Le comunicazioni finanziarie restano al provider; le richieste di supporto con termine arrivano al contatto configurato e agli alert prioritari.

**Cancellazione richiesta al provider diversa dalla cancellazione dell’account FiscalBay.** Stripe documenta che una richiesta tramite Link può cancellare oggetti finanziari e annullare abbonamenti anche nell’account Stripe del fornitore. Il contratto d’integrazione deve quindi gestire la perdita autorevole di quegli oggetti e l’eventuale segnalazione fuori webhook. Non considerare automaticamente un oggetto non più reperibile come «mai acquistato», «rimborsato» o ordine di eliminare tutto lo spazio FiscalBay. [S18](SOURCES.md#s18)

Verificare provenienza e perimetro dell’evento; interrompere rinnovi e conservazione non più ammessi, applicare i diritti commerciali già approvati e la conservazione minima lecita della prova. Non ricreare anagrafiche o fatture per eludere una richiesta di cancellazione. Il diritto lifetime recuperabile dopo cancellazione resta distinto dal dato operativo e dalla disponibilità futura dell’oggetto Stripe. Caso incompleto o ambiguo: gestione circoscritta e segnalazione amministrativa, senza revoche o nuovi addebiti arbitrari. Il gate legale definisce la gestione della richiesta, non un consenso generico del merchant.

### 6.7 Casi temporali da rendere verificabili

Per ogni grant registrare origine, intervallo di copertura, importo effettivamente pagato e collegamento alla prova autorevole. Coprire passaggio di mese, fine mese, anno bisestile, cambio di periodicità e estensione amministrativa; non derivare il rinnovo aggiungendo un numero fisso di giorni. Riconciliare anche richieste commerciali concorrenti (switch, disdetta, proroga, lifetime), senza sovrascrivere una scelta successiva con un webhook tardivo.

La prenotazione di un posto lifetime non si libera mentre il relativo checkout può ancora produrre un incasso valido. M0/M5 devono qualificare scadenza della sessione, pagamenti asincroni, conferme tardive e recupero dopo crash, compreso l’ultimo posto. Nessuna prenotazione infinita e nessuna vendita eccedente «da rimborsare poi» come normale strategia. Un esito ambiguo blocca la riallocazione di quel posto fino alla riconciliazione; non modifica il tetto né autorizza un rimborso automatico non previsto.

I confini di ciclo, trial e periodo si confrontano sull'istante UTC e sul fuso del ciclo, mai sulla sola data locale ricavata da un timestamp UTC: un evento della prima notte del ciclo non deve cadere nel giorno precedente. I test coprono fusi a est e a ovest di UTC. Oltre ai webhook, un ciclo periodico riconcilia i diritti attivi con Stripe come rete di sicurezza per eventi mancati o ritardati, senza inventare diritti in caso di errore. Nel ciclo periodico ogni passo (riconciliazione, alert, notifiche, retention) registra il proprio errore senza fermare gli altri; una priorità di recupero vale una sola volta per gli elementi mai tentati e non rimette in coda ogni volta gli stessi elementi.

<a id="s07"></a>
## 7. Autenticazione, identità e sessioni

Quattro metodi obbligatori nella 2.0: **email/password, Google, Sign in with eBay e passkey**. Non due sistemi Auth sovrapposti. Cloudflare-only: Better Auth candidato; con Supabase valutare Auth nativa senza Better Auth. M0 qualifica inclusi recupero, collegamento identità, revoca e supporto runtime; per decisione owner del 2026-09-23 la sola qualifica di Sign in with eBay, bloccata dal diritto eBay sull'email Identity, passa a M2 secondo [§36.2](#s36), senza dichiararla collaudata; per decisione owner del 2026-10-06 le [prove reali](#prove-ebay) si eseguono in M8 sull'ambiente Production (D160). Dopo il diniego eBay di quel diritto, Sign in with eBay vale per gli account eBay che espongono un'email business; per gli altri il login si ferma su un avviso che indirizza agli altri tre metodi (D153). Un limite del provider non autorizza a togliere un login. Passkey Supabase sperimentali: rischio esplicito del gate; niente dichiarazione preventiva di stabilità. [S04](SOURCES.md#s04) [S05](SOURCES.md#s05)

Registrazione essenziale: email di contatto verificata, nome e cognome obbligatori, tipo di account privato o azienda; per l'azienda la ragione sociale è obbligatoria (D151). Nessuna P.IVA né altro dato fiscale in registrazione; il tipo di account non cambia piano, quote o limiti. Verifica prima di collegare eBay, riutilizzando la verifica affidabile del provider. La registrazione con email e password non apre la sessione e risponde allo stesso modo per un indirizzo già registrato, il cui titolare riceve un avviso: la sessione nasce dal link di conferma, così la registrazione non rivela chi usa FiscalBay. Chi accede con la password prima della conferma esplora, ma non collega negozi. Se eBay non prova un'email utilizzabile, richiedere verifica nel prodotto senza inventare l'attributo. Passkey può essere aggiunta dopo account confermato: non implica necessariamente signup passkey-first.

Nell'ambiente test le nuove registrazioni richiedono l'autorizzazione preventiva dell'owner tramite elenco privato di email, anche quando l'account nasce da Google o eBay (decisione del 2026-10-21). Elenco assente, vuoto o non valido: nessun nuovo account. Il filtro opera sul server prima della creazione dell'utente; la verifica email rimane obbligatoria secondo il metodo. Gli utenti già registrati continuano ad accedere e a gestire i metodi di accesso. Il messaggio IT/EN indica un ambiente riservato e la necessità di autorizzazione, senza nomi personali. La restrizione è separata dall'apertura pubblica Production e dall'ammissione commerciale Free.

Identità provider canonica composta da provider/issuer e subject stabile, non email modificabile. Q366A permette collegamento automatico con **stessa email verificata e attendibile**; non basta una stringa o provider non affidabile. Prevenire account pre-hijacking e merge di tenant arbitrari. Collegare/rimuovere metodi da Sicurezza, mantenendone almeno uno valido. Cambio email self-service con nuova verifica e protezione; non trasferisce da solo negozi/piani a un'altra persona.

Login eBay e autorizzazione negozio sono flussi distinti. Proporre collegamento seller dopo il login con consenso esplicito; possibile un altro account. Reconnect di un negozio non abilita automaticamente un nuovo login e viceversa.

Sicurezza consente di scegliere il nome di una passkey durante l'aggiunta e di rinominarla; resta il nome del dispositivo come default. Gli errori distinguono le sole cause riconoscibili, senza attribuire una causa certa a un annullamento o timeout ambiguo. Prima della rimozione dell'unico metodo valido la UI invita ad aggiungerne un altro; l'invariante server resta atomico. Le sessioni mostrano anche la data di apertura. La nuova autenticazione torna a Sicurezza o al gruppo interessato tramite una destinazione interna consentita, senza rieseguire l'azione sensibile. Le schede dell'area riservata rileggono lo stato server quando tornano attive.

Il cambio email mostra la richiesta pendente e il passaggio di conferma, distinguendoli dall'indirizzo di accesso attuale. Il reinvio riparte dal primo link e usa gli stessi limiti Auth; stato e risposta non rivelano se il nuovo indirizzo appartiene a un altro account. Lo stato temporaneo scade con la verifica, si elimina al cambio effettivo e rientra nella pulizia periodica.

Sessioni persistenti con scadenze/rotazione gestite dal sistema Auth; elenco sessioni, logout singolo e globale. Logout non ferma sync né billing. Il titolare riceve un'email quando la password viene reimpostata e quando si aggiungono o rimuovono metodi di accesso o passkey. I tentativi di accesso con password e gli invii di email di accesso hanno un limite per IP e uno per indirizzo, che la tabella dei limiti conserva solo come impronta. Le password si conservano con scrypt (N=2^14, r=8, p=1) e un prefisso di versione; gli hash nel formato predefinito di Better Auth restano verificabili (D167). Riautenticazione per cancellazione account e modifiche critiche. Admin autorizzato esplicitamente, MFA obbligatoria e recovery robusto: nessun percorso debole alternativo che aggiri il secondo fattore. TOTP è escluso dalla 2.0. Il secondo fattore amministrativo è l'accesso con una passkey dell'utente e verifica sul dispositivo (flag UV dell'asserzione WebAuthn), registrato sulla sessione che ne nasce: la presenza di una passkey registrata, una passkey senza verifica, password, Google, eBay o un link email non bastano. L'area admin accetta quella sessione per 12 ore; le altre modifiche critiche richiedono un accesso delle ultime 24 ore; oltre, l'utente conferma l'identità sul posto con password o passkey e la modifica prosegue, mentre con soli Google o eBay esce e rientra (D185). Il ruolo admin si concede e si revoca soltanto con l'accesso tecnico al database, protetto dalla MFA dell'account Cloudflare, e ha effetto alla richiesta successiva. Un admin aggiunge o rimuove passkey solo da una sessione già confermata con passkey, così una password o un'email compromesse non registrano un nuovo fattore. Recovery: almeno due passkey indipendenti per l'admin; se le perde tutte, l'owner revoca il ruolo dal database, l'utente registra una nuova passkey come merchant e il ruolo viene riconcesso dopo la verifica dell'identità fuori banda.

### 7.1 Sessione server, revoca e ambienti

Il server valida identità, sessione e livello di autenticazione con le primitive del sistema scelto; non si fida di dati utente letti soltanto dallo storage del browser. Con Supabase qualificare l’integrazione SSR/PKCE, compreso l’eventuale `@supabase/ssr`, senza introdurre un secondo Auth. La documentazione SSR segnala attualmente quel helper come beta: valutarlo esplicitamente nel gate, non installarlo come eccezione tacita alla policy latest stable. [S19](SOURCES.md#s19)

Il logout/revoca deve impedire le successive operazioni protette. Un JWT già emesso può restare crittograficamente valido fino alla sua scadenza: rimuovere la sessione dal client non basta. Il percorso applicativo e gli eventuali accessi diretti a Data API/RPC/Storage devono verificare revoca e autorizzazione corrente secondo il contratto qualificato. Non richiedere un sistema parallelo di sessioni: usare lo stato autorevole del provider o controlli applicativi minimi motivati. Provare il riuso di un token precedente dopo logout, revoca, cancellazione e perdita del ruolo admin. [S20](SOURCES.md#s20)

Cookie, callback e origini sono separati tra test e Production. Il test delle passkey non deve creare credenziali valide sul dominio Production né interferire con utenti reali. Definire RP ID e origini prima dell’enrollment, senza presumere che il solo diverso sottodominio isoli credenziali configurate sul dominio padre. Sessione necessaria al rendering server e refresh del client devono seguire un modello coerente: non imporre contemporaneamente cookie inaccessibili al client e un SDK che ne richieda l’accesso senza progettare il flusso. [S04](SOURCES.md#s04)

<a id="s08"></a>
## 8. Negozi, collegamenti e stati

Ogni account eBay appartiene a un solo spazio alla volta. UUID interni, identificatore stabile eBay qualificato, username/nome solo attributi. Trasferimento fra spazi assistito dopo verifica; nessun trasferimento automatico di storico, login o pagamenti. Se già collegato altrove: messaggio generico senza informazioni sull'altro account.

Connessione distinta da sync: `connecting`, `active`, `paused`, `reconnect_required`, `disconnected`, `error`; attività `idle`, `queued`, `running`, `backfilling`, `degraded`, `failed`. Ragioni di pausa separate: manuale, piano, inattività, amministrativa. Nel modello fisico possono essere dimensioni, non una enum monolitica che perde motivazione.

`Pausa` **manuale** sospende nuove letture, non nasconde i dati altrimenti accessibili né modifica il piano. Non congela il decorso dello storico o della retention. La pausa per downgrade/inattività/amministrazione segue invece i propri permessi: «pausa manuale consultabile» non autorizza a leggere negozi esclusi dal Free. Il vincolo Free di sostituzione ogni 90 giorni ammette eccezioni legittime tramite assistenza, con motivazione e audit, senza reset di quota, prova o ciclo. `Scollega` interrompe accesso eBay, preservando storico secondo retention e negozio nell'elenco. L'azione distinta `Scollega ed elimina negozio`, denominata `Elimina negozio` quando già scollegato, richiede conferma forte: cancella i dati importati senza ripensamento e rimuove il negozio dall'elenco e dal dettaglio. Conserva soltanto i riferimenti necessari a riconoscere l'identità e preservare quota, trial, vincolo Free e diritti commerciali, senza modificare il negozio su eBay o disdire l'abbonamento FiscalBay. Collegare nuovamente lo stesso account lo rende visibile senza duplicati o reset; i dati eliminati non vengono ripristinati.

Token da riautorizzare: dati ancora consultabili, CTA reconnect. Dopo esito positivo, riconciliazione recente; import totale solo se una lacuna lo richiede. Reminder non invasivi per massimo **30 giorni**, poi cessano; nessuno scollegamento automatico. In Free restano separati i controlli 30+7 di inattività.

Il reconnect conserva nello state il negozio selezionato e il suo ambiente. Prima di salvare il consenso, il callback verifica identità eBay e appartenenza corrente allo spazio; un account diverso non crea un negozio né sostituisce token o consenso. Le conferme di scollegamento ed eliminazione restano aperte durante la richiesta, impediscono invii ripetuti e mostrano lì l'eventuale errore; si chiudono dopo il successo.

Il negozio registra la scadenza nota del consenso seller (refresh token) e avvisa il merchant prima che scada, con la stessa CTA di reconnect e senza interrompere prima del tempo la sync. I token di accesso vengono rinnovati in anticipo dal lavoro in background, non nel percorso di una pagina aperta dall'utente.

Il negozio mostra ultima sync riuscita e frequenza target, non un countdown preciso della prossima esecuzione. Ogni ordine ha anche `last_synced_at`. Identità account, marketplace ordine e Paese buyer non sono intercambiabili.

<a id="s09"></a>
## 9. Ordini e dati fiscali

Acquisire ordini pagati e non pagati quando disponibili via API; mantenere annullati/rimborsati nello storico, con stati originali e normalizzati. Non rappresentare come incassato un ordine non pagato. Copertura di ogni fonte da qualificare: Fulfillment non prova da sola disponibilità di ogni acquisto incompleto. [S06](SOURCES.md#s06)

Gli acquisti non ancora pagati visti prima del checkout (provvisori) restano registrati per il consolidamento ma escono da elenco, dettaglio, conteggi e suggerimenti; uno mai pagato non torna nelle viste. Le viste mostrano soltanto ordini definitivi (D180). Un ordine definitivo senza Codice Fiscale indica l'acquirente estero quando l'indirizzo di fatturazione è fuori Italia, senza dedurre una regola di eBay.

Vocabolario normalizzato unico per area reale, anteprima, filtri ed export (D176). Pagamento: pagato, non pagato, rimborsato, rimborsato in parte. Spedizione: da spedire, spedito in parte (`IN_PROGRESS` di Fulfillment, una parte degli articoli spedita), spedito, annullato. Uno stato eBay non previsto si mostra con il codice originale in tono neutro e resta fuori dai filtri. Nessuno stato «consegnato»: le fonti eBay adottate non lo forniscono e il tracciamento della consegna resta fuori dalla 2.0.

Ordine identificato da UUID interno e unicità `(ebay_account_id, external_order_id)`. Identificativi alternativi Trading/REST separati e riconciliati solo con prova; evitare duplicare ordini multi-articolo o cambiare chiave se eBay aggiorna un ID provvisorio.

**Ordini combinati e identità della riga.** Quando l'acquirente paga insieme più acquisti, eBay può creare un ordine definitivo con un ID nuovo e, al pagamento, cambiare anche gli identificativi delle righe; gli acquisti prima del checkout compaiono soltanto in Trading. L'identità stabile di riga (`OrderLineItemID`/`lineItemId` con `legacyItemId`) collega provvisori e ordine definitivo. Il consolidamento avviene solo quando tutte le righe di ogni provvisorio appartengono allo stesso ordine definitivo; sovrapposizioni parziali, righe senza identità stabile o più candidati bloccano il consolidamento senza indovinare e compaiono come anomalia sugli ordini definitivi coinvolti; fra soli provvisori non generano avvisi (D180). Grant, quota e sblocchi seguono il consolidamento: un ordine riemesso con ID nuovo non consuma una seconda quota e non perde un diritto già acquisito sui dati fiscali delle stesse righe. Un provvisorio resta fuori dalle viste correnti, assorbito o no, senza cancellare lo storico dovuto.

La riconciliazione resta circoscritta allo stesso negozio, conserva l'UUID interno e la deduplica delle notifiche e viene provata anche con arrivo invertito delle fonti. Nessuna unione per nome, importo o sola somiglianza.

Il mapping distingue acquirente registrato, destinatario e indicazioni `c/o`; estrae i valori dai campi strutturati, incluso il telefono, senza conversioni generiche di oggetti in testo. Fixture sintetiche coprono nomi discordanti, campi assenti e forme inattese. Conservare provenienza e originale entro la retention applicabile; nessuna correzione automatica dell'intestatario fiscale o riscrittura dei dati eBay.

Dati eBay in sola lettura. Normalizzazione tecnica, formattazione e validazione derivate non alterano il valore originale. Vista corrente aggiornata dalla fonte e snapshot buyer/articoli legati all’ordine, non all’anagrafica corrente del buyer/prodotto. Una sync senza cambiamenti non crea una nuova versione. Lo storico delle variazioni fiscali resta obbligatorio; copie complete dell’intero ordine servono solo a un caso concreto di riconciliazione, non a ogni polling. Niente cronologia modifiche esposta al merchant.

Ogni identificativo registra tipo originale, Paese quando noto, fonte, valore e qualità formale. Fulfillment `getOrder` con marketplace dell'inserzione `EBAY_IT` e `fieldGroups=TAX_BREAKDOWN` è la prima lettura del CF italiano in Production; un valore presente di tipo `CODICE_FISCALE`, con Paese assente o `IT`, evita la chiamata fiscale Trading. Per assenze, campi malformati, tipi o marketplace non qualificati, Sandbox e anomalie, Trading `GetOrders` resta il fallback, disponibile entro la sua finestra di 90 giorni. Fulfillment resta primario per acquisizione, stato e dettaglio generale. Le osservazioni persistite conservano entrambe le fonti e i tipi originali; nella consultazione un CF coincidente compare una sola volta con precedenza Fulfillment, mentre valori o Paesi discordanti restano distinti. Un'assenza non rimuove dati già osservati. Distinguere identificativo dell'acquirente da quello del venditore o di eBay. Validazione CF/P.IVA italiana formale non bloccante; nessun collegamento all'Anagrafe tributaria o certificazione di esistenza. Tipi esteri sconosciuti mostrati correttamente senza falsa validazione.

**Riqualifica della lettura fiscale Fulfillment.** La prova iniziale M0 non usava l'header `X-EBAY-C-MARKETPLACE-ID`. La qualifica del 2026-10-10 sul keyset FiscalBay ha misurato presenza e coincidenza sugli stessi ordini controllati; l'owner ha approvato la revisione circoscritta di D135 nella stessa data. [Matrice, limiti e quote](engineering/EBAY_TAX_COMPARISON.md#qualifica-production-del-2026-10-10): nessuna equivalenza universale, qualifica Sandbox o rimozione autorevole dedotta dalle assenze. Il segreto Auth resta invariato; la sua custodia è stata riconciliata senza rotazione.

**Qualità formale.** Per il Codice Fiscale italiano: formato e carattere di controllo; per le persone fisiche, coerenza delle prime sei lettere con nome e cognome dell'ordine, provando entrambe le orientazioni e il nome di registrazione dell'acquirente quando disponibile. Un riferimento `c/o` nel nome di spedizione viene separato ai soli fini del confronto. L'esito (`valido`, `formato errato`, `controllo errato`, `nome non coerente`, `non verificabile`) è un'indicazione mostrata al merchant: non corregge, non sostituisce e non blocca il dato, e non cambia il consumo di quota. Omocodie e nomi composti ambigui producono `non verificabile`, non un errore.

Separare tre dimensioni: verifica (`non verificato`, `in corso`, `completato`, `errore`), disponibilità della fonte, diritto commerciale dell'ordine. Una risposta list non contenente il campo non dimostra assenza. Mascherato/non incluso/errore non equivalgono a rimozione autorevole. Matrice fonte/endpoint/campo/età/stato nella qualifica eBay.

Un ordine verificato senza ID è già consultabile: nessun pulsante di sblocco inutile. Dato arrivato successivamente rimane bloccato nel Free salvo diritto preesistente. Sblocco atomico e idempotente per ordine; nello stesso atto verificare quota, appartenenza, finestra, dato esistente e accesso. Nessun CF nel browser prima dell'autorizzazione, neppure nascosto nel DOM o restituito da ricerche/count/preview.

Dato modificato: visualizzare quello corrente, registrare versioni protette e notificare secondo preferenze. Rimozione autorevole: non mostrarlo come dato attuale, conservare lo storico interno fino a cancellazione applicabile. Nessun rimborso retroattivo quota se in precedenza il dato fu davvero fornito. Ordine non riconfermabile: ultimo stato noto con avviso, non cancellazione automatica dall'assenza di una risposta.

**Osservazioni tardive e falsi cambiamenti.** Un'osservazione con `lastModifiedDate` precedente a quella già applicata viene scartata prima di ogni scrittura e contata. Il confronto che decide se creare una versione normalizza prima i valori: campo omesso e `null` equivalgono, timestamp e importi si confrontano nello stesso formato e alla stessa precisione, i soli campi tecnici o di provenienza non producono una variazione. Una rilettura invariata non crea versioni, notifiche né consumi.

<a id="s10"></a>
## 10. Buyer, suggerimenti e dati mancanti

Snapshot buyer per ordine, collegamento opzionale a buyer canonico solo con identità stabile affidabile/consentita. Nessun matching automatico da somiglianza di nome, email o indirizzo. Nessuna ricerca o riutilizzazione fra spazi.

Premium: suggerimenti da precedenti ancora conservati, anche di altri negozi dello stesso spazio. Mostrare origine, ordine e data; il dato suggerito non sostituisce quello del nuovo ordine e non ne altera lo stato corrente. Se precedenti confliggono, proporre il più recente **con avviso evidente di incoerenza**, non occultare il conflitto. Fonte modificata o cancellata: invalidare il suggerimento e ricalcolarlo, senza conservarne una copia fiscale oltre retention.

Per dati mancanti: modello di testo **IT/EN modificabile e copiabile**, con riferimento all'ordine. Il merchant invia autonomamente attraverso i propri canali. Nessun invio automatico email/chat, messaggistica integrata o contatto del bot con buyer. Non trasformare il template in un modulo per modificare i dati eBay dentro FiscalBay.

La recenza del suggerimento è quella del precedente **ordine sorgente**, non la data in cui un backfill l’ha importato. All’interno della fonte si usa l’ultima versione autorevole disponibile. Confrontare per incoerenza soltanto identificativi omogenei (tipo, Paese e soggetto cui appartengono): CF e P.IVA diversi non sono, di per sé, un conflitto. Data/identità insufficienti o parità non risolvibile vengono rese esplicite; non spacciare un ordinamento tecnico per certezza fiscale. Nessuna consultazione extra del buyer fuori dagli ordini conservati.

<a id="s11"></a>
## 11. Strategia eBay, code e sincronizzazione

Target: **Premium 10 minuti, Free 30 minuti**, subordinato ai limiti effettivi. Non SLA pubblico. Eventi utili se disponibili e qualificati + polling di riconciliazione; non presumere l'esistenza dell'evento solo perché esiste Notification API. Elaborare eventi affidabili anche per Free senza ritardo artificiale. Priorità sotto carico non equivale a promessa di latenza garantita.

Flusso: elenco incrementale Fulfillment → ordine visibile → lettura fiscale in job separato e mirato, con precedenza delle fonti secondo [§9](#s09) e D135 → commit corrente/diritti → evento notificabile. Fallimento fiscale non rende inutilizzabile l'ordine. Primo import: recenti prima, storico dopo; progress reale quando il totale è affidabile, altrimenti fasi e conteggi senza percentuali inventate. Free 30 giorni, Premium un anno; estensioni oltre anno solo dopo verifica periodo recuperabile e consenso, eventualmente costo una tantum concordato.

Polling da timestamp/cursore qualificato con overlap limitato, paginazione, deduplica e checkpoint persistente. Non aggiornare il watermark prima che le pagine siano state applicate correttamente. Non rilegge tutto lo storico a ogni ciclo; cambiamenti recenti trattati anche se `order_date` è vecchia. Partizionamento per negozio e lavoro, limiti globali del keyset condiviso e per utente/API. La passata Trading periodica dei modificati avviene al massimo ogni due ore e il limite di una chiamata Trading non ferma Fulfillment (D177).

Priorità: refresh singolo ordine; sync corrente Premium; sync corrente Free; notifiche da eventi già acquisiti; backfill Premium; backfill Free/operazioni non urgenti. Applicare priorità ed equità con le primitive del provider e limiti semplici di concorrenza; notifiche e Free devono continuare a progredire sotto carico, senza uno scheduler generalista proprietario. Sync manuale recenti disponibile anche durante backfill; re-import completo separato e protetto. Richieste simultanee sullo stesso oggetto confluiscono in una verifica, senza cooldown commerciale artificiale. Mostrare accodamento/limite quando incide sull'utente, non fingere esecuzione immediata.

Usare la coda scelta per consegna, ritardi, tentativi e dead-letter quando supportati; non mantenere un secondo sistema equivalente nel database. Persistono soltanto checkpoint, chiavi di deduplica e stato di business necessari a riprendere il lavoro. Lease/fencing o outbox solo dove colmano un rischio dimostrato non coperto dalle primitive native. Retry limitati con backoff/jitter, rispetto Retry-After e budget. Deduplica/idempotenza restano applicative: una consegna ripetuta non deve ripetere sblocchi o effetti. Un commit che richiede un invio deve poter essere recuperato anche se la pubblicazione in coda fallisce. Ricalcolare permessi, negozio, retention e destinatari all’esecuzione; vecchi job/webhook non ricreano dati eliminati.

Client REST tipizzati generati da specifiche ufficiali dove affidabili; scegliere in M0 il generatore. API eBay complete come contratto, ma incorporare solo quanto serve. La precedenza fiscale segue D135 e §9; Trading resta circoscritto a `GetOrders`, `GetItem` per le immagini, `GetStore` e `GetUser` per il profilo pubblico del negozio e ai campi necessari, senza SDK legacy generale per abitudine. OAuth e Notification SDK opzionali; i client sono dietro adapter testabili, mai sparsi nelle route.

Le scritture da sync automatica, refresh manuale e riconnessione verificano la revisione attesa o un equivalente controllo atomico. Una risposta tardiva non sovrascrive dati, connessione o errori già aggiornati; in conflitto rilegge lo stato utile. Il controllo di concorrenza non sostituisce la precedenza e l'autorevolezza delle fonti fiscali.

Provare esplicitamente le interruzioni fra acquisizione evento, accodamento, commit ed effetto successivo. L'ACK segue la presa in carico recuperabile; un errore di accodamento non rende l'evento definitivamente completato. Consegne duplicate e riprese dopo crash non ripetono quota, grant o notifiche. Usare le primitive native e il minimo stato applicativo necessario, senza introdurre un secondo orchestratore.

**Scadenza della Queue e recupero.** Su Workers Paid (D169) la retention dei messaggi è di 4 giorni predefiniti, configurabile fino a 14: coda e DLQ di ogni ambiente usano 14 giorni e la giurisdizione UE, come D1 e R2 (D171). Anche la DLQ ha una scadenza e non è un archivio di incidenti. La ricevuta o il checkpoint D1 conserva lo stato di business necessario a riconciliare un lavoro accettato ma non completato, anche se il suo messaggio è scaduto. Il recupero rivalida consenso, diritti e retention prima di riaccodare, senza riaprire lavori terminali o dati cancellati. Alert e ripresa si basano su età del lavoro e ultimo progresso; dopo un'interruzione oltre la retention, provare recupero o chiusura motivata, senza perdita silenziosa né una seconda coda in D1. [S34](SOURCES.md#s34)

<a id="s12"></a>
## 12. Export ordini e portabilità dell'account

Export è una sottosezione operativa di **Impostazioni**, con anteprima tabellare; richiamo contestuale `Esporta` da Ordini e per ordine. Ricerca/filtri/selezione trasferiti senza perdita. Se selezione presente usa quella, altrimenti insieme filtrato; conteggio e ambito sempre espliciti. Nessun download o sblocco automatico prima della conferma.

Formati: CSV standard Free; CSV/XLSX avanzati Premium. Una riga per ordine o per articolo a scelta; colonne selezionabili/riordinabili e configurazioni salvate Premium. Nessuna formula, script, trasformazione fiscale o promessa di compatibilità universale con gestionali. Opzione tutti gli ordini vs solo quelli con dati fiscali accessibili. Campi bloccati vuoti con stato distinto da assente/verifica incompleta.

Contratto iniziale colonne: ID ordine, data/fuso, negozio, marketplace, acquirente e dati consentiti, titoli/SKU/quantità, valuta, importi correttamente etichettati, stati pagamento/fulfillment, tipo/Paese/valore fiscale accessibile, esito verifica e ultimo aggiornamento. In modalità articoli il totale ordine non va sommato una volta per riga; evitare duplicazioni introducendo colonne semantiche o totale una sola volta per gruppo. Stringhe per CF/P.IVA/SKU e codici con zeri iniziali; valuta originale, niente somme fra valute.

CSV con escaping di delimitatori, virgolette e newline; lo schema standard è stabile. Preservare i byte degli identificativi, ma documentare l’importazione come testo: il doppio clic in Excel può convertirli. Non usare formule `="valore"` per simulare un tipo testuale. Neutralizzare formula injection nei campi non attendibili senza deformare importi validi, qualificando i consumatori dichiarati. Nell’XLSX assegnare esplicitamente tipo testo a CF/P.IVA/SKU; niente macro, riferimenti esterni o hyperlink incontrollati. [S24](SOURCES.md#s24)

Più identificativi sono rappresentati deterministicamente con tipo/Paese/valore, senza prodotto cartesiano con gli articoli né moltiplicazione dei totali. Configurazioni Premium cambiano colonne e ordine, non significato o permessi. Generazione chunked/streaming dove disponibile; tempi, bundle e memoria misurati. Opzionale è la libreria, non la funzione XLSX/ZIP promessa.

### 12.1 File temporanei e invalidazione semplice

Storage privato, file con scadenza di **24 ore** e rimozione effettiva. La richiesta conserva spazio, selezione o filtri, opzioni, formato, istante di generazione e riferimento al file; nessun archivio permanente degli export.

Lo storage è un bucket R2 per ambiente, con giurisdizione UE, accessibile solo dal binding del Worker: niente dominio pubblico, `r2.dev` o URL prefirmati. La chiave dell'oggetto è un identificativo opaco senza dati personali. La pulizia applicativa elimina l'oggetto alla scadenza; una regola di lifecycle R2 a un giorno è soltanto la rete di sicurezza, perché opera a giorni e non è puntuale: la validità resta decisa dall'app a ogni download (D166). [S34](SOURCES.md#s34)

Default: invalidazione prudenziale **per workspace**, non grafo file→ordini→versioni. Cancellazioni o modifiche che revocano/riducono un accesso rilevante invalidano gli export dello spazio, anche se alcuni file non erano direttamente coinvolti. Un contatore/revisione di accesso dello spazio, o equivalente semplice, collega richieste e generazioni al contesto valido. Un nuovo ordine o un semplice aggiornamento non sensibile non invalida da solo tutti i file.

Rileggere autorizzazioni e retention quando il job parte, prima che il file diventi scaricabile e a ogni download. Un job avviato prima di una revoca non può promuovere un file dopo di essa. Per scadenze temporali note, limitare la validità effettiva del file al primo termine rilevante del formato, del diritto o dello storico incluso, anche prima delle 24 ore: non dipendere dalla puntualità del job di cancellazione. Se l’ambito non può più essere verificato, negare il vecchio file e proporre rigenerazione su dati attualmente autorizzati. La UI spiega la rigenerazione senza esporre dettagli sensibili.

Non è richiesto rintracciare ogni copia per singolo ordine. Occorre invece testare concorrenza fra generazione, revoca, scadenza e richiesta di download. Le copie già consegnate al merchant non possono essere ritirate; non promettere di annullare i byte già trasmessi. Nessun bypass di sblocchi, piano o cancellazioni per semplificare.

Un URL firmato è trasferibile fino alla scadenza e non rivalida la sessione. Usare un endpoint autenticato che trasmette il file o un equivalente qualificato e revocabile; un redirect a un URL bearer valido 24 ore non è sufficiente. Nessun dato personale nei nomi dei file. [S22](SOURCES.md#s22)

### 12.2 Portabilità dell’account

Export account distinto, a tutti i piani: ZIP con JSON strutturato e CSV leggibili di profilo, negozi, preferenze e dati pertinenti. Escludere password, token, segreti, dati di terzi e dettagli anti-abuso; nessun aggiramento degli sblocchi ordini. Download immediato se piccolo o job con notifica in-app/email. Applica gli stessi controlli di validità e scadenza. Proporlo prima della cancellazione senza obbligo.

<a id="s13"></a>
## 13. Telegram

Bot attuale riutilizzabile come identità per la 2.0; backend 1.x eliminabile prima del go-live. Bot separato per test, niente stesso webhook condiviso con Production. Un solo bot per ambiente, anche per il Control Center dell'owner (D198). Web app funzionante senza Telegram. Bot dei venditori con collegamento, notifiche, stato, preferenze e consultazione degli ultimi ordini (D199); ricerca, sblocco, esportazione e gestione dei negozi restano soltanto sul sito. Le Impostazioni sono l'unica fonte delle preferenze: il bot legge e scrive gli stessi dati con le stesse regole.

Una chat privata verificata per spazio, non gruppi né destinatari multipli. Deep-link con token monouso breve, legato a spazio e sessione, consumo atomico; codice manuale solo fallback tecnico utile. Cambio chat sostituisce la precedente dopo conferma, invalidando link e consegne pendenti pertinenti.

Notifiche ordini solo Premium/trial/lifetime. Scelta disattivate / solo ordini con dato fiscale (default) / tutti; scelta per negozio. Singole oppure riepilogo **giornaliero** a orario e fuso configurati. CF e dati autorizzati leggibili direttamente nel messaggio; non obbligare ad aprire il sito. Coprire limiti messaggio, escape, suddivisione, locale e cambi di ora legale senza doppi riepiloghi.

Tutti gli ordini: evento subito anche se verifica fiscale in corso, poi notifica quando il dato arriva. Modalità solo fiscali: non inviare messaggi di ordini ancora privi del dato. Nuovo valore/cambio/rimozione autorevoli notificabili; altri cambi ordine solo nell'app. Suggerimento storico non spacciato per dato del nuovo ordine.

Import storico: **un solo riepilogo di completamento**, con conteggi e periodo effettivamente acquisito, non notifiche individuali degli ordini storici. Non trattare ogni ripresa tecnica dello stesso import come un nuovo completamento notificabile. Nessuna valanga di notifiche per import storico. Per outage tecnico recuperare gli eventi secondo **la modalità ordinaria scelta**, senza riepilogo imposto. Throttling tecnico ammesso. Disattivazione volontaria: alla riattivazione soltanto eventi successivi, non arretrato del periodo disabilitato. Bot bloccato/irraggiungibile: retry limitati, stato `delivery_failed`, avviso e percorso di ripristino. Non promettere exactly-once end-to-end se una risposta Telegram viene persa: deduplica interna e gestione degli esiti ambigui.

**Contenuto ordinario e correzioni.** Il messaggio usa negozio, riferimento/data ordine, acquirente, articoli sintetici, totale/valuta, stato pertinente e collegamento al dettaglio autorizzato; il link eBay è secondario quando utile, oltre ai valori fiscali autorizzati. Non include normalmente indirizzo completo, email o altri contatti dell’acquirente. La riconoscibilità dell’ordine non giustifica la copia indiscriminata dell’anagrafica.

La preferenza «solo ordini con dato fiscale» filtra i **nuovi ordini privi del dato**, ma non deve sopprimere una correzione/rimozione fiscale già prevista per un ordine precedentemente notificato. Avvisare della variazione senza ripresentare il valore rimosso come corrente. Prima dell’invio verificare ancora piano, chat, preferenze e stato della cancellazione; l’abilitazione per negozio non introduce automaticamente filtri/riepiloghi diversi per ogni negozio. Gli eventi vecchi non riattivano notifiche disabilitate. La pausa manuale della sync non equivale a disattivare Telegram: i dati già acquisiti seguono le preferenze ancora valide.

<a id="s14"></a>
## 14. Email, supporto e consenso marketing

Il form di supporto include un riepilogo diagnostico minimo visibile al merchant: versione applicativa, riferimento interno del negozio interessato, fase e ultimo esito della sync, codice errore, stato dei diritti e correlation ID pertinente. Campi allowlistati, nessun token, CF, payload o anagrafica buyer, né altro spazio. La diagnostica assente o non leggibile non impedisce la richiesta; trasmissione al solo canale di supporto previsto e conservazione secondo la matrice privacy, senza un nuovo archivio di payload.

Email operative per Auth, sicurezza e problemi importanti a tutti i piani; niente digest ordini via email nella 2.0. Stripe gestisce comunicazioni di pagamento/rinnovo/carte/rimborso; evitare doppioni FiscalBay. Avviso prodotto solo se aggiunge informazione utile.

Indirizzi umani iCloud+: **info@fiscalbay.it**, **supporto@fiscalbay.it**; terzo indirizzo libero, nessuna casella privacy/sicurezza obbligatoria. **supporto@** serve soltanto all’assistenza clienti; ogni altro contatto (privacy, sicurezza, contatti sviluppatore e di provider, comunicazioni amministrative) usa **info@**. **noreply@fiscalbay.it** è un mittente transazionale separato, non SMTP iCloud per invii automatici massivi. Configurare Reply-To appropriato e gestione risposte involontarie. Provider transazionale scelto nel perimetro economico approvato; nessun nuovo abbonamento implicito.

Il trasporto di **noreply@** è Cloudflare Email Service (D169), già integrato con il binding `send_email` dietro il modulo email applicativo che Better Auth e il resto dell'app chiamano: Better Auth genera link e token e delega l'invio a questo modulo. Con Workers Paid l'invio raggiunge destinatari qualsiasi; 3.000 email al mese sono incluse per l'intero account, poi l'invio è a consumo. Email Sending è in beta, accettata dall'owner. Nessun nuovo fornitore entra nell'inventario dei trattamenti per l'invio. Le email destinate all'owner e a `supporto@` verso indirizzi verificati dell'account restano gratuite e fuori quota.

Il dominio è già predisposto per l'invio: record MX, SPF e DKIM su `cf-bounce.fiscalbay.it`, separati dagli MX iCloud+ dell'apex, e DMARC con allineamento rilassato compatibile con iCloud+. Un nuovo onboarding o la revisione DMARC di [M7-12](#m7-12) non sostituiscono la policy esistente senza verificare entrambi i mittenti. [M6-06](#m6-06) qualifica recapito verso caselle esterne, rimbalzi, lista di soppressione e consumo della quota prima di aprire la registrazione pubblica. [S34](SOURCES.md#s34)

Supporto IT/EN, pagina pubblica con FAQ/form e pannello in-app con contenuti essenziali. Nessun ticketing completo, chatbot o chat live. Form raccoglie il minimo contesto utile, account e consenso/accesso necessario; non invia PII fiscali automaticamente. No SLA pubblico, obiettivo qualitativo di risposta rapida. Richieste MoR con scadenza prioritarie su supporto e alert admin.

Opt-in **facoltativo non preselezionato** in registrazione e proposta separata dopo onboarding; gestione/revoca sempre nelle impostazioni. Un consenso «Novità e offerte FiscalBay», prova della scelta e unsubscribe efficace. Email necessarie indipendenti. La 2.0 deve raccogliere/gestire correttamente il consenso, ma non deve costruire una piattaforma campagne: eventuali invii commerciali usano un servizio idoneo prima dell'attivazione, con approvazione di costi/fornitore. Mai marketing agli acquirenti eBay.

<a id="s15"></a>
## 15. Console amministrativa

I problemi operativi mostrano gravità, causa comprensibile, conseguenza, stato osservato e azione pertinente con collegamento al contesto. Raggruppare occorrenze della stessa anomalia; rileggere stato e permessi prima dell'azione, registrare esito e rientro senza chiusure apparenti. Un errore circoscritto a un negozio non blocca quelli estranei. Nessun payload fiscale nei riepiloghi ordinari.

Stesso prodotto/dominio, area `/admin` con accesso esplicito e MFA; stessa Auth, nessuna impersonazione. Navigazione admin distinta da quella merchant. Viste di utenti/spazi, negozi, stato sync/job, quote delle API eBay, piano e diritti, trial, ricavi operativi pertinenti, lifetime venduti/omaggio/residui, promo, errori e segnalazioni antiabuso. Le quote eBay (D188) mostrano per ambiente, API e chiamata limite, consumo, residuo, azzeramento e chiamate sospese per limite superato; oltre il 70% del consumo giornaliero sono un'anomalia con l'azione di chiedere a eBay un aumento.

Azioni: retry/ripresa job, sync recente, pause operative, revisione abusi, gestione concessioni e disponibilità, cambi commerciali tipizzati con efficacia e audit. Niente lettura ordinaria di CF, indirizzi o altri dati buyer; consultazione circoscritta per assistenza necessaria e autorizzata. Accesso tecnico a dati reali tramite Codex distinto dalla UI admin ordinaria.

Configurare senza deploy quota standard/promo/date, trial e offerta ai nuovi clienti, disponibilità lifetime e flag consentiti. Non cambiare cicli già iniziati, abbonamenti protetti o diritti acquistati. I prezzi effettivi sul provider devono coincidere; salvare intenti/pending state, non mostrare un prezzo pubblicato se la configurazione remota è fallita. Nessun accesso generico alla modifica SQL come funzione admin.

Flag semplici server-side, tipizzati, con default sicuri e audit. Kill switch separati eBay, Telegram e nuovi checkout; non un motore universale di automazioni. Alert per nuove registrazioni, attivazioni/disattivazioni commerciali e problemi azionabili, deduplicati; separare canale admin da chat del merchant.

**Control Center Telegram dell'owner.** Oltre a `/admin`, un bot privato dell'owner offre comandi di sola lettura sulle stesse query aggregate della console: dashboard, stato di salute e code, errori e incidenti aperti, billing (contratti, incassi, fee e payout separati), trial, funnel, negozi e versione distribuita. Navigazione inline e aggiornamento dello stesso messaggio invece di nuovi messaggi. Il webhook in ingresso verifica secret, chat privata e identità owner, limita la dimensione del corpo e usa ricevute idempotenti con retention breve. Gli incidenti generano una notifica deduplicata all'apertura e una alla risoluzione. Nessun CF o dato buyer nei messaggi. Un'azione di scrittura è ammessa solo se prevista qui, con conferma esplicita e audit. Il Control Center usa il bot delle notifiche dell'ambiente, senza un bot owner distinto, e separa chat e comandi dell'owner da quelli dei merchant in modo verificabile (D198).

<a id="s16"></a>
## 16. Architettura dell'informazione e route

Desktop: **top navigation**, non sidebar principale. Voci **Ordini · Negozi eBay · Impostazioni**. Top bar con ricerca ordini, campanella e avatar/profilo. Mobile: bottom navigation sulle stesse tre destinazioni; top bar compatta. Analisi sarà quarta voce solo quando rilasciata nelle 2.x Premium, senza placeholder 2.0.

| Superficie | Percorso canonico indicativo |
|---|---|
| Pubblico IT / EN | `/`, `/en` e pagine localizzate |
| Accesso / registrazione / recupero | `/login`, `/registrati`, route Auth coerenti |
| Ordini e dettaglio | `/app/ordini`, `/app/ordini/:id` |
| Negozi e dettaglio | `/app/negozi`, `/app/negozi/:id` |
| Impostazioni e sottosezioni | `/app/impostazioni/:sezione` |
| Profilo | `/app/impostazioni/profilo`; `/app/profilo` reindirizza (D191) |
| Admin | `/admin` e sottosezioni autorizzate |
| Endpoint applicativi necessari | `/api/v1/...`, solo con un consumatore concreto |
| Callback / webhook | Endpoint dedicati, non confusi con pagine pubbliche |

Gli slug sono default tecnico; ID opachi e controlli server indipendenti dalla route. Deep-link protetti, refresh/back/forward funzionanti. Filtri e ricerche seguono la protezione degli URL e della cache descritta in [§23](#s23).

Un utente autenticato che visita la root viene indirizzato all'app. Dal menu avatar `Visita fiscalbay.it` deve permettere navigazione pubblica senza logout e senza loop: distinguere intenzione di visita pubblica tramite stato/cookie strettamente funzionale o parametro consumato, con canonical pulito e nessuna pagina duplicata indicizzabile.

<a id="s17"></a>
## 17. Schermata Ordini e dettaglio

Home dopo login = Ordini, non dashboard separata. Tutte le funzioni comprese nel piano sono utilizzabili anche dal browser smartphone, inclusi collegamenti, piano, impostazioni ed esportazioni: nessun obbligo di computer introdotto per comodità implementativa. Griglia a densità intermedia, **due schede per riga desktop/tablet landscape, una portrait/mobile**; con drawer e viewport insufficienti non comprimere sotto leggibilità. Nessuna personalizzazione delle schede nella 2.0.

Scheda: ID e data, negozio, buyer con indirizzo di fatturazione completo e Paese, telefono ed email quando eBay li fornisce (D144), miniatura quando fornita/utilizzabile, uno/due articoli sintetici e quantità/altri articoli, importo+valuta, stato del pagamento e della spedizione secondo il vocabolario del [§9](#s09), stato fiscale. `Sblocca` per dato presente ancora bloccato; `Copia` soltanto per dati accessibili; telefono ed email come collegamenti e contatti copiabili nel dettaglio (D181); dettaglio e menu secondario (apri ordine eBay, export singolo). Nessun pulsante Copia ingannevole su dato assente/errore, né modifica locale «Segna sbloccato».

**Presentazione e copia dei dati.** Indirizzi italiani tutti maiuscoli o minuscoli con iniziali leggibili, particelle, sigle, civici e numeri romani preservati; grafia mista ed estera conservata, spazi ripuliti e sigle provinciali italiane in maiuscolo. Via, località con CAP/provincia e Paese occupano righe separate, comuni a lettura e copia; i campi parziali restano visibili senza deduzioni geografiche. Nomi tutti maiuscoli o minuscoli con iniziali maiuscole, anche nelle particelle dei cognomi e dopo apostrofi e trattini; spazi ripuliti, grafia mista, valori mascherati, numeri e ragioni sociali con sigle riconoscibili conservati. La stessa forma compare nelle schede, nel dettaglio per acquirente e destinatario, nei suggerimenti della ricerca e nella copia dei dati di fatturazione; lo username di ripiego resta originale. La fonte non distingue persone e aziende: non dedurre questa distinzione né separare nome e cognome. Campi dichiarati mascherati da eBay distinti da quelli assenti; nessuna azione su valori mancanti, mascherati o non riconosciuti. Telefono internazionale e copia coerenti, senza dedurre prefissi per forme ambigue. Date e importi localizzati in IT/EN, raggruppamento delle migliaia e valuta riconoscibile; date e ore senza esposizione del fuso orario. Gli avvisi sul Codice Fiscale spiegano il limite osservabile con parole comuni, senza termini come «omocodico» nel testo rivolto all'utente. Testi lunghi leggibili per intero nel dettaglio anche su mobile. Ogni articolo con l'ID dell'inserzione nella sua identità stabile collega la pagina dell'inserzione su eBay (D186). «Copia dati di fatturazione» include intestatario, campi disponibili dell'indirizzo e soli identificativi fiscali già accessibili, con etichetta del tipo; omette contatti, valori vuoti, mascherati, suggerimenti e dati bloccati. Nessuna modifica agli originali, ai diritti, alla quota o alla persistenza.

Ricerca su ID, buyer, titolo, SKU, valori fiscali **autorizzati**. Top bar con suggerimenti + «Vedi tutti», stesso motore della pagina. Filtri negozi, date, stato ordine e stato fiscale, combinabili e su una sola riga da desktop; il marketplace non è un filtro (D183); ordinamento iniziale data ordine decrescente. Ricerca/filtri/scroll/selezione conservati nei passaggi dettaglio/export; nuova sessione ricorda negozio e ordinamento, non query temporanee dimenticate. Filtri salvati nelle 2.x Premium.

`Carica altri`, non paginazione numerata né infinite scroll obbligatorio. Pagination lato server, ordine stabile con spareggio ID e cursore; nessun caricamento preventivo di migliaia di ordini. Modalità `Seleziona` rivela checkbox, barra sticky con numero e sole azioni valide. Sblocco multiplo mostra conteggio/quota e conferma, ricontrollando concorrenza; nessuna selezione arbitraria dei vincitori se eccede quota.

Drawer unico con URL aggiornato su desktop, full-screen mobile; tab **Dettagli** e **Articoli**, niente Cronologia. Sezioni ordine, buyer, indirizzi pertinenti, pagamento/spedizione, dati fiscali e fonte, aggiornamento. Nuovi ordini inseriti se l'utente è in cima, altrimenti indicatore e aggiornamento volontario; non spostare ciò che sta leggendo/selezionando.

<a id="s18"></a>
## 18. Schermata Negozi eBay

Con un solo negozio, il caso più comune, la pagina lo mostra in una scheda: identità con stato e collegamento alla pagina eBay, riquadri di ordini importati, ultima lettura, storico e scadenza dell'autorizzazione, ultimi aggiornamenti accanto (sotto su mobile) e le azioni Sincronizza, Pausa/Riprendi e Dettagli; il pannello resta completo (D189). Con più negozi: lista/tabella leggera con righe spaziose, non replica delle card Ordini. Colonne: nome/account, marketplace pertinente, stato connessione, ultima sync, stato ammissione nel piano, notifiche e ordini importati. **Il piano è dello spazio**: niente account contemporaneamente «Free» e «Premium» nello stesso spazio come nei concept illustrativi.

Il negozio si presenta con nome e logo del negozio eBay e lo username sotto; senza negozio eBay, o con un logo non qualificato, restano username e iniziali. Lo stesso nome identifica il negozio negli Ordini. Il pannello aggiunge feedback, percentuale positiva e stato Top Rated del venditore e un collegamento alla pagina del negozio eBay, accettato soltanto su domini eBay. Profilo e feedback si leggono con Trading `GetStore` e `GetUser` dopo i recenti, al più una volta a settimana; eliminare i dati li cancella (D186).

Pannello laterale con URL e full-screen mobile: dettagli, sincronizzazione, notifiche; finestra storico, stato import, frequenza target e ultimi aggiornamenti. Include informazioni più ricche escluse dalla lista, non countdown prossimo aggiornamento smentibile dallo scheduler. Pulsanti collegamento, reconnect, sync recenti, re-import distinto, pausa/riprendi, scollega, elimina dati secondo autorizzazioni.

Scelta del negozio attivo mostrata soltanto nel Free, quindi dopo il downgrade: Premium non la anticipa (D155); senza scelta resta attivo il primo negozio ancora collegato. Riconnessione stesso negozio non sposta il vincolo 90 giorni. Messaggi chiari per account già associato, permessi mancanti e sorgente non verificabile. Nessun pannello «Log» tecnico rivolto al merchant.

<a id="s19"></a>
## 19. Impostazioni, Profilo e campanella

Impostazioni desktop: categorie a sinistra e contenuto a destra; navigazione locale, non sidebar globale. Mobile elenco→pagina. Le categorie stanno in tre gruppi con un'etichetta, nell'ordine della tabella: Ordini, Account, Generale (D185). Tutte le opzioni concordate, incluse notifiche per negozio, template IT/EN e configurazioni export, devono avere una sola fonte di stato; collegamenti da altre superfici sono scorciatoie, non configurazioni duplicate.

| Gruppo | Sezione | Contenuto |
|---|---|---|
| Ordini | Notifiche | Chat Telegram, stato, filtro tutti/solo fiscali, singolo/riepilogo giornaliero, orario/fuso, negozi; consenso marketing separato |
| Ordini | Export | Ambito/anteprima, CSV/XLSX secondo piano, righe/colonne, configurazioni; non archivio permanente |
| Ordini | Dati fiscali / modello messaggio | Template IT/EN copiabile, non anagrafica fiscale fittizia del merchant né modifica ordini |
| Account | Profilo | Nome, cognome, ragione sociale e tipo di account registrato, che il salvataggio non cambia (D191) |
| Account | Piano e pagamenti | Stato effettivo, trial, quote/date, upgrade, periodicità, lifetime, disdetta, concessioni, negozio attivo nel Free, storico pagamenti e documenti tramite il portale del provider, senza elenco interno (D176) |
| Account | Sicurezza | Metodi login, passkey, password, sessioni, logout globale, verifiche pertinenti |
| Account | Dati e privacy | Informative, export account, cancellazione e gestione diritti |
| Generale | Aspetto e lingua | Sistema/chiaro/scuro, IT/EN, fuso del dispositivo come predefinito o scelto (D185) |
| Generale | Supporto | FAQ/form, contatto, storico esteso, integrazioni su valutazione |

Profilo come categoria delle Impostazioni: informazioni minime personali, senza email o accessi, che restano in Sicurezza (D191). Fuso in Aspetto e lingua, dati necessari alla vendita nel checkout provider. Menu avatar: nome/email, Profilo, Sicurezza, Piano e pagamenti, Impostazioni, Visita sito, Esci; Profilo apre la sua categoria.

Il profilo abilita Salva soltanto per modifiche pendenti, espone attesa ed esito e conserva i valori in caso di errore. Uscire dalle Impostazioni, ricaricare o chiudere avvisa quando restano modifiche non salvate al profilo o al modello di messaggio; il passaggio fra categorie conserva le bozze.

Campanella: problemi e comunicazioni rilevanti di sicurezza/billing/servizio/manutenzione, non tutti gli ordini. Popover in 2.0, letture/segna tutti, ultimi **30 giorni**; pagina completa in 2.x. Niente storico di sicurezza visibile separato. Salvataggio misto: autosave controllato per toggle/scelte semplici, Salva per template/configurazioni articolate; pending/error espliciti, ripristino coerente in caso di fallimento.

<a id="s20"></a>
## 20. Onboarding, stati vuoti e modalità degradate

La pagina Ordini mostra i dati persistiti autorizzati senza attendere una nuova lettura eBay. Gli aggiornamenti remoti proseguono separatamente, con timestamp e stato locale di avanzamento; non sostituiscono l'intera vista con uno skeleton. Verificare sessione, diritti e retention lato server prima della risposta: uno stato memorizzato non autorizza da solo un'azione o l'esposizione di un dato fiscale.

Onboarding dentro Ordini, contestuale, riprendibile e non bloccante. Account creato→email verificata→negozio collegato→prima sync→ordini disponibili. Senza prerequisito la funzione dipendente non è usabile, ma Profilo/Impostazioni lo sono. Nessuna demo mescolata ai dati reali. Breve preparazione OAuth, poi eBay, ritorno in Ordini con conferma e import progressivo.

Dopo prima sync mostrare valore reale e CTA trial discreta, mai attivazione automatica. Tempo residuo trial poco invasivo, più evidente a ridosso della fine; upsell contestuale, non enorme box permanente.

| Condizione | Comportamento richiesto |
|---|---|
| Nessun negozio | Empty state reale e CTA Collega eBay |
| Collegato, zero ordini | Esito corretto, periodo interrogato, nessun errore inventato |
| Import in corso | Prime righe disponibili, conteggio/stato; percentuale solo affidabile |
| Caricamento iniziale | Skeleton aderente al layout |
| Refresh | Dati esistenti restano, indicatore locale |
| Query senza risultati | Spiegazione e pulisci filtri |
| Quota fiscale esaurita | Non fiscale consultabile, quota/prossimo ciclo e CTA pertinente |
| Errore singolo negozio | Stato locale + campanella, banner se influenza la vista |
| eBay down | Timestamp, degrado esplicito, sole azioni dipendenti disabilitate |
| Stripe down | Diritti locali validi operativi; checkout/gestioni dipendenti sospesi |
| Auth/DB indisponibile | Niente promessa di lettura dal nulla: errore/manutenzione circoscritto sicuro |
| Pagamento acquisito, evento in attesa | Attivazione Premium in corso, riconciliazione server |
| Cancellazione in corso | Accesso operativo e automazioni fermate; nessuna schermata apparentemente attiva |

Consultazione ridotta solo quando i dati e l'autorizzazione sono disponibili e sicuri; non introdurre replica/offline/cache personale per simulare disponibilità. Non mostrare semaforo globale verde permanente.

<a id="s21"></a>
## 21. Brand, logo e riferimenti

Direzione professionale, moderna e accessibile, senza tono eccessivamente rassicurante o promesse assolute. Il copy dice cosa FiscalBay fa per chi vende; limiti, esclusioni e garanzie di sicurezza compaiono solo dove servono a una decisione o spiegano un'eccezione (D154). Simbolo+wordmark FiscalBay, differenza sottile Fiscal/Bay; blu/indaco, navy e richiami ai quattro colori del mondo eBay senza riproduzione 1:1 o impressione di affiliazione.

**Logo: evoluzione del Concept 4 · Minimal Ledger Card**, file identificato in [REFERENCES](brand/REFERENCES.md). Il concept è il punto di partenza, non un vincolo: su indicazione owner (D141) forma, proporzioni, inclinazione e dettagli possono essere migliorati per chiarezza e resa piccola, mantenendo un segno autonomo che non richiami un prodotto ufficiale eBay. `Bay` resta blu come il simbolo. L'icona è generica, non una tile in stile piattaforma. Proposte e versione definitiva richiedono il via owner al checkpoint M1.

Produrre dopo approvazione vettoriali puliti, versioni orizzontale/mark, chiaro/scuro, favicon, avatar Telegram e preparazione future icone; niente condivisione di file font. Logo/claim delle tavole non sono specifiche funzionali né copy definitivo. Eliminare dagli asset finali date fittizie, testi estranei e promesse di fatturazione/vendite non previste.

Riferimenti da valutare **nella fase frontend**: beautifului.dev; beui.dev; rareui.com; transitions.dev; ui.shadcn.com; ui-skills.com; coss.com/ui; designsystemchecklist.com; reui.io/components. Catalogare componenti/guide, origine, licenza, cambi, costo e compatibilità repo pubblico. shadcn è una base, non l'unica ispirazione. Nessun acquisto Pro o copia di materiali con licenza incompatibile implicito.

<a id="s22"></a>
## 22. Design system, accessibilità e predisposizione Expo

Sistema iniziale vero ma circoscritto al prodotto: token colori/superfici/stati, typography, scale spaziature/radius, ombre moderate, focus, controlli, pulsanti, feedback, dialog/drawer, liste/tabelle, schede e responsive. Un solo sans-serif moderno, scelta e licenza qualificate in M1. Icone outline uniformi Lucide. Densità bilanciata, non mosaico di card ovunque.

Semantica stati con testo/icona oltre colore: verde successo/connesso/accessibile; blu informazione; ambra verifica/attenzione; rosso errore realmente rilevante; viola Premium/disponibile da sbloccare. L'assenza fisiologica del dato non va resa indistinguibile da un errore tecnico bloccante. Light/dark/sistema completi per sito e app, stessa qualità.

Motion sottile e funzionale nell'app; più espressivo dove utile sul pubblico. CSS prima, Motion opzionale. Illustrazioni geometriche leggere in app e scene più ricche nel sito, senza decorazioni che oscurano il lavoro.

Accessibilità baseline obbligatoria 2.0: tastiera, focus visibile/gestito, etichette semantiche, contrasto leggibile, touch target adeguati, HTML corretto, non colore solo, reduced motion, errori annunciabili. Test automatici + manuali essenziali. Target formale avanzato nelle 2.x; **nessuna certificazione AA non dimostrata**, senza rinviare obblighi legali applicabili.

Token semantici, dominio, naming e contratti condivisibili con Expo; implementazioni visuali web-specifiche ammesse. Componenti HTML/CSS non diventano nativi per il solo uso di React. Non introdurre WebView come sostituto della futura esperienza nativa né dipendenze Expo nel runtime 2.0. [S17](SOURCES.md#s17)

**Prestazioni percepite.** La build fallisce se il JavaScript iniziale di una pagina supera il budget gzip della sua classe, dichiarato nel repository e rivedibile solo con motivazione: 170 KiB per sito, documenti legali ed errori, 280 KiB per area riservata, accesso, amministrazione e anteprima (D182). Conta ciò che il browser carica all'apertura della pagina; gli import dinamici successivi al primo disegno e il totale di tutti i file restano informativi. Le pagine che dipendono da una verifica remota lenta mostrano subito l'ultimo stato salvato con un'indicazione di verifica in corso e azioni sensibili disabilitate, poi lo sostituiscono con lo stato confermato in streaming; se la verifica fallisce compaiono avviso e «Riprova». Non si attende il provider prima di inviare l'HTML e non si presenta come confermato un dato ancora in verifica. Dati sensibili bloccati restano esclusi anche dallo stato provvisorio.

<a id="s23"></a>
## 23. Sito pubblico, contenuti e SEO

Home, Funzionalità, Prezzi, Sicurezza, FAQ, Supporto. Italiano su root, inglese `/en`, URL localizzati stabili. Nessun blog/news, roadmap pubblica o pagine fittizie «prossimamente». Funzionalità in pagina unica: CF, sync, ordini, export, Telegram, multi-negozio, sicurezza. Pagina Sicurezza dedicata a due livelli ma senza eccesso tecnico.

Descriptor principale: **Recupera il Codice Fiscale dagli ordini eBay**; breve: **Codice Fiscale per ordini eBay**. Hero: **Trova e gestisci il Codice Fiscale dei tuoi ordini eBay.** Title approvato: `FiscalBay | Recupera il Codice Fiscale dagli ordini eBay`. Meta: recupero/gestione del CF disponibile con sync, export e notifiche. Keyword secondarie solo pertinenti, inclusa fattura elettronica per spiegare l'utilità, mai per affermare che FB la emetta.

CTA primaria `Inizia gratis`, secondaria `Come funziona`, accesso evidente. Tre passaggi: collega eBay; sync/individuazione CF; consulta/copia/esporta/notifiche secondo piano. Fascia fiducia: API ufficiali eBay, pagamenti sicuri gestiti da Stripe, nessuna carta per iniziare. Precisare quando necessario «quando disponibile su eBay». Letture e cose non fatte esplicite; indipendenza da eBay visibile e nei Termini.

Prezzi: Free e tre modalità Premium nello stesso confronto; annuale evidenziato senza scelta nascosta; lifetime allo stesso livello finché disponibile, residuo reale. Esaurito visibile per periodo iniziale poi rimosso secondo configurazione, senza urgenza artificiale. Trial 14 giorni senza carta evidente e volontario dopo prima sync. Promo mostra 10/7 giorni fino alla data, poi 5; la quota reale individuale può restare 10 fino a fine ciclo.

SEO tecnico: sitemap solo pagine pubbliche canoniche, robots, noindex su app/test/anteprime, canonical, hreflang, Open Graph, metadata IT/EN, structured data soltanto veri e appropriati, performance. `robots.txt` non è controllo d'accesso. Nessun dato account indicizzabile o cache cross-user. Solo strumenti strettamente necessari; evitare banner cookie quando le tecnologie effettive lo consentono, non dichiarare l'esenzione senza inventario. Social proof soltanto quando reale/autorizzata.

**Cache e navigazione autenticata.** La home può reindirizzare l’utente autenticato agli Ordini, ma quel redirect è specifico della sessione e non può essere memorizzato nella cache pubblica per tutti. Anche la scelta «Visita il sito» resta personale. Definire regole esplicite di bypass/no-store per `/app`, `/admin`, API sensibili, callback, risposte con sessione e download; il solo header `Vary` o il solo noindex non dimostra isolamento della cache del provider.

Le ricerche che contengono un CF/P.IVA non devono finire in URL condivisibili, referrer, log edge o analytics. Conservare il contesto di navigazione con stato di sessione protetto; non disabilitare la ricerca fiscale già approvata per risolvere il problema. Filtri non sensibili possono mantenere URL riproducibili. Provare visitatore anonimo, utente autenticato, ritorno al sito e due merchant distinti sullo stesso percorso.

<a id="s24"></a>
## 24. Dominio, DNS, TLS e posta

`fiscalbay.it` già acquistato. Register.it resta solo registrar/rinnovo finché tale rapporto permane; non usare hosting, DNS, posta o altri servizi Register quando evitabile. DNS autoritativi Cloudflare; nessun trasferimento registrar necessario per questo assetto. **Dynu/DuckDNS eliminati**, non percorsi alternativi di sviluppo.

Production `fiscalbay.it`; test `test.fiscalbay.it`, separato nei dati/credenziali e chiaramente riconoscibile. `www` redirect permanente verso apex, preservando path/query sicure. `/app` nello stesso sito, non `app.` come nuova architettura. URL tecnici temporanei provider non diventano il dominio pubblico canonico.

M0/M1: inventario DNS prima di modificare nameserver; trasferire record necessari, verificare DNSSEC senza DS incoerenti, TLS per apex/www/test, callback Auth/eBay e webhook esatti, CORS/origin/cookie isolati. Non cambiare record degli altri domini/progetti. Registrare proof DNS/TLS, rollback configurativo e ownership.

Posta umana su iCloud+ già pagato se configurazione verificata, mantenendo info/supporto e terzo slot libero. MX/SPF/DKIM per posta umana e mittente transazionale distinti ma compatibili; un solo record SPF per nome, allineamento DMARC verificato, return-path/subdominio tecnico quando richiesto. Non mettere proxy HTTP davanti a record posta. Provare ricezione/risposta e invii Auth reali autorizzati; nessuna assunzione che l'SMTP di test sia adatto alla produzione. [S12](SOURCES.md#s12)

**Protezioni della zona e della posta (D168).** Le nuove attività appartengono soltanto alle milestone aperte: M6-06 qualifica il trasporto email; [M7-12](#m7-12) integra e qualifica le protezioni seguenti prima della RC; M8/M9 completano le prove e il readback finali. Nessuna funzione inclusa nel piano è per questo già attiva sul provider.

| Funzione | Contratto e verifica |
|---|---|
| HSTS | Introduzione graduale dopo la verifica HTTPS sui domini interessati; `includeSubDomains` soltanto dopo inventario e collaudo di tutti i sottodomini, preload non automatico |
| Header di sicurezza | `X-Content-Type-Options`, protezione dall'inclusione in frame e Referrer Policy coerenti sulle risposte reali; header statici da Transform Rules o Worker dove qualificato, CSP applicativa compatibile con Auth, Stripe e Turnstile |
| WAF e rate limit di zona | Regole mirate per host/percorso e abusi osservati, con quote del piano della zona rilette; il filtro edge precede il binding Workers e i contatori D1, senza duplicare i loro limiti per account |
| DMARC Management | Report aggregati dei mittenti legittimi e dei fallimenti SPF/DKIM/DMARC, mantenendo MX iCloud e policy DMARC esistente; trasporto transazionale qualificato in M6-06, inventario dei trattamenti in M7-07; beta documentata e inclusa dall'owner |
| Certificate Transparency Monitoring | Alert nativi su nuove emissioni per il dominio a un destinatario owner confermato, con procedura di verifica e rientro in M7-04 |

Le regole non impongono challenge browser ai webhook e alle callback server-to-server; OAuth, passkey e download autenticati restano funzionanti. Le eventuali eccezioni sono circoscritte alla regola incompatibile e al percorso esatto, senza disabilitare in blocco le protezioni. Bot Fight Mode generalizzato non adottato, perché non supporta eccezioni WAF; nessun upgrade Pro/Business implicito. Cache e ottimizzazioni della zona rispettano sessioni e `no-store`, senza memorizzare risposte private. [S36](SOURCES.md#s36)

<a id="s25"></a>
## 25. Architettura e confini dei servizi

Un repository pnpm e **una sola applicazione TypeScript modulare**. Partire da un package applicativo con cartelle per dominio, integrazioni, job, UI e contratti; estrarre package distinti solo con riuso effettivo o necessità di build/test separati. Il monorepo è una capacità organizzativa, non un numero minimo di package. Niente package Expo, team o multi-workspace vuoti.

React Router richiama i casi d’uso server direttamente. Job e servizi riusano la stessa logica; endpoint HTTP espliciti servono soltanto ai client reali e ai webhook/callback. Una futura app Expo può riusare modelli, regole, token e contratti senza imporre oggi un’API speculare completa della UI.

```text
React Router / job / endpoint necessari
                |
       casi d’uso FiscalBay
                |
   moduli dati e integrazioni scelte
                |
       Cloudflare: Workers / D1 / Queues
```

Dominio privo di accessi provider disseminati; modulo dedicato per eBay, Stripe, Telegram, email e persistenza. Dopo M0 implementare **soltanto il candidato scelto**. Un’interfaccia serve se rende un confine testabile, non come framework universale di portabilità. Non nascondere differenze reali tra D1 e PostgreSQL dietro un repository generico; transazioni e invarianti sono qualificati sul motore effettivo.

| Famiglia ammessa in M0 | Ripartizione candidata | Verifiche decisive |
|---|---|---|
| Cloudflare senza Supabase | Workers web/job, D1, R2 se utile, Queues/Cron, Better Auth | Quattro login, atomicità, limiti runtime, export e recovery nativa |
| Cloudflare + Supabase | Workers web/core/job; Auth/Postgres Supabase e storage dove conveniente | Nessuna Auth doppia, RLS/RPC, connessioni, costi e recuperabilità |
| Supabase più centrale | Auth/Postgres/job/functions; Cloudflare per DNS/frontend se necessario | Hosting frontend reale compatibile con React Router, non Storage usato impropriamente come app host |

Valutare Free/Paid per servizio e ambiente sulla **capacità residua** degli account condivisi, non sulle sole quote nominali. Supabase non è obbligatorio. VPS, Vercel, Netlify e Appwrite sono fuori dalla selezione attiva; pagamenti, iCloud, GitHub e trasporto email non estendono questo perimetro compute.

Una sola fonte autorevole per responsabilità: niente D1+Postgres per duplicare gli stessi dati, due Auth o due code per lo stesso flusso. Con Supabase, RLS non protegge automaticamente i CF ancora bloccati: valgono anche [§29](#s29) e la revoca [§7](#s07). Service role mai nel browser.

Inventario read-only delle risorse condivise in M0; nessuna migrazione di altri prodotti o modifica di keyset comuni senza mandato. Scelta e costi al checkpoint di fine M0. Le alternative scartate restano motivazioni nel registro, non implementazioni di riserva da manutenere.

**Servizi Cloudflare previsti nell'assetto (D166).** La tabella descrive le responsabilità, non attesta che tutti i servizi siano già attivi. Workers/D1, asset statici e domini sono nelle configurazioni applicative; Queues e DLQ sono qualificate sul test in [M3-11](#m3-11). Le integrazioni residue hanno i task [M3-12](#m3-12), [M6-10](#m6-10), [M6-11](#m6-11), [M7-09](#m7-09), [M7-10](#m7-10) e [M7-11](#m7-11). Risorse e binding applicativi restano separati per test e Production.

| Servizio | Uso in FiscalBay |
|---|---|
| Workers | Web app, ingresso webhook, consumer Queue e lavoro pianificato in un solo Worker per ambiente |
| Workers Static Assets | Asset della build serviti dalla piattaforma; download privati e risposte dipendenti dalla sessione restano nel Worker |
| DNS, TLS e Custom Domains | Zona esistente e domini canonici di [§24](#s24); Register.it resta registrar, senza trasferimenti o nuovi domini richiesti |
| Protezioni e report della zona | HSTS/header, WAF/rate limit edge, DMARC Management e Certificate Transparency secondo [§24](#s24), da qualificare in [M7-12](#m7-12) |
| D1 (UE) | Unica fonte autorevole di dati applicativi, sessioni, checkpoint, ricevute, contatori per indirizzo e audit |
| Queues e DLQ (UE) | Consegna, ritardi, retry e dead-letter di eventi e lavori ([§11](#s11)) |
| Cron Triggers | Un solo trigger per ambiente che smista il lavoro periodico per `scheduledTime` ([§31](#s31)) |
| R2 (UE) | File export a 24 ore ([§12.1](#s12)) e archivio dei log a 90 giorni ([§31](#s31)) |
| Rate Limiting | Primo filtro nel Worker per IP e percorso davanti ad Auth e operazioni costose ([§29](#s29)) |
| Turnstile | Verifica anti-automazione su registrazione, richieste di link email e form di supporto ([§29](#s29)) |
| Analytics Engine | Metriche tecniche aggregate e budget di prestazione, senza dati personali ([§31](#s31)) |
| Email Service | Trasporto di `noreply@` verso destinatari qualsiasi con Workers Paid e invio gratuito agli indirizzi verificati dell'owner ([§14](#s14), D169) |
| Workers Logs e Logpush | Diagnosi recente nella dashboard ed esportazione verso R2 ([§31](#s31)) |

Non adottati: KV, perché le letture possono restare non aggiornate mentre revoche e sessioni valgono subito; Durable Objects, finché il blocco per negozio in D1 basta; Workflows, perché duplicherebbe Queue e checkpoint come secondo orchestratore; Hyperdrive, che accelera database PostgreSQL/MySQL esterni e non D1; Images, perché le immagini restano sugli host eBay ([§29](#s29)); Email Routing sull'apex, perché i suoi MX confliggono con iCloud+ ([§24](#s24)). Riaprirli richiede un rischio dimostrato che le primitive adottate non coprono. [S34](SOURCES.md#s34)

**D1 e letture distribuite.** Il percorso corrente usa il database primario. Read replication con Sessions API, attualmente in beta, si valuta soltanto se [M7-03](#m7-03) misura un collo di bottiglia nelle letture, qualificando disponibilità, localizzazione e compatibilità Auth. Una replica potenzialmente in ritardo o un bookmark del client non provano l'assenza di revoche successive: i controlli di sessione, ruolo, consenso e grant richiedono lo stato autorevole corrente; `first-primary` avvia una sessione dai dati più recenti. Nessuna replica o cache introdotta soltanto perché disponibile. [S34](SOURCES.md#s34)

**Ingresso leggero per webhook e callback.** Le route esatte dei webhook e delle callback server-to-server dei provider (Stripe, eBay `ORDER_CONFIRMATION` e cancellazione account, Telegram) sono gestite dall'entrypoint Worker prima di React Router: verificano metodo, dimensione e firma sul corpo grezzo, registrano un claim idempotente in D1 e pubblicano in coda un messaggio con soli identificativi, senza payload, sessioni o token. La risposta positiva al provider parte soltanto dopo che la coda ha accettato il messaggio; `waitUntil` da solo non basta perché non garantisce la riconsegna. Il consumer ricostruisce il contesto da D1 e usa retry e dead-letter nativi. La build React Router si carica al primo accesso applicativo insieme a React Router stesso e resta esclusa dal percorso di webhook, cron e coda; lo SDK Stripe e i testi dell'interfaccia si caricano solo dove servono (D167). La CPU si misura sul Worker entro i budget di [§31](#s31), senza dedurla dalla build o dal caricamento dei moduli. Per eventi ad alta frequenza e già confermati è ammessa una memoria di breve durata nell'isolate per evitare letture D1 ripetute, mai come fonte autorevole. Le callback OAuth aperte dal browser restano nell'applicazione e nel sistema Auth.

<a id="s26"></a>
## 26. Toolchain, dipendenze e policy latest

**Latest stable qualificata** al momento della milestone/upgrade, non preferenza automatica per LTS vecchie. Node 26 e TypeScript 7 sono le direzioni esplicitamente richieste, salvo incompatibilità dimostrata; verificare catalogo ufficiale e pacchetti reali. Node locale/CI non è la versione del runtime Workers o delle funzioni Supabase. Beta/RC/canary non baseline generica; passkey sperimentali sono un rischio specifico da qualificare/accettare, non un lasciapassare per tutto. [S08](SOURCES.md#s08) [S09](SOURCES.md#s09)

Pin esatti dei pacchetti diretti dove appropriato, lockfile unico e install riproducibile; versione pnpm nel manifest. Niente `latest` non risolto a ogni build. Aggiornamenti regolari: patch/minor accorpabili con test, major review dedicata; runtime/compiler qualification gate e rollback sicuro. Nessuna dipendenza nuova solo perché presente in uno starter.

Dal 2026-10-08, su indicazione dell'owner, nessuna attesa minima di 24 ore dalla pubblicazione dei pacchetti npm. Restano il controllo che rifiuta perdite di firme o provenance, i pin e i gate di qualifica.

| Funzione | Base approvata / default tecnico |
|---|---|
| Package manager | pnpm workspaces, unico lockfile; npm non incompatibile ma non la scelta corrente |
| Linguaggio | TypeScript strict, ESM; typecheck indipendente dalla build |
| Web | React + React Router Framework Mode + Vite |
| CSS | Tailwind; token semantici e CSS native |
| Componenti | shadcn/ui e primitive necessarie (Base UI candidato), selezione dagli altri riferimenti |
| Icone | Lucide |
| Schemi runtime | Zod, usato ai confini dati/contratti |
| Localizzazione | Dizionari IT/EN tipizzati nel codice (`app/app-copy.ts`) e formatter `Intl` nativi, senza libreria di localizzazione (D149) |
| Stripe | SDK ufficiale server-side, Hosted Checkout; niente Elements per il solo redirect |
| HTTP, UUID, crittografia | fetch, crypto.randomUUID, Web Crypto del runtime ove qualificato |
| Test | Vitest, Testing Library/user-event, Playwright, axe/Playwright |
| Qualità | Oxlint, Oxfmt, React Doctor bloccante dai warning, typecheck compiler, CI e sicurezza dipendenze |
| CLI di piattaforma | `cf` a versione esatta per Workers, D1 e risorse Cloudflare, configurazione in `cloudflare.config.ts`; Wrangler solo per `tail` e D1 locale temporaneo (D170) |

**Opzionali, non negati:** helper Auth/SSR del provider scelto (incluso `@supabase/ssr` se qualificato), Drizzle/driver SQL o Data API/RPC; React Hook Form/resolver; date-fns/timezone; Motion; TanStack Table; MSW; grammY; client OAuth/Notification eBay; generatore client OAS; libreria XLSX/ZIP; coverage; query cache; Storybook; monitoring esterno. Si aggiungono se eliminano più complessità di quanta ne introducono. XLSX e ZIP restano requisiti: opzionale è la dipendenza che li realizza. i18n e Lucide restano confermati.

Non baseline: Axios, Redux/Zustand, Prisma, Next.js/Express/Hono, Redis, GraphQL/tRPC applicativo, Expo nel runtime 2.0, grafici prima della 2.x. Non divieti religiosi: un'incompatibilità concreta va documentata; un cambio strutturale richiede owner, non un'aggiunta di nascosto.

Form ordinari con React Router Form/actions/fetcher e validazione server; libreria per form solo se articolati. UTC per istanti; **mese/anno di abbonamento sono periodi calendariali**, non 30/365 giorni arbitrari. Riepiloghi giornalieri rispettano timezone/DST: se Intl/primitive non bastano usare una libreria qualificata invece di una routine temporale fragile. Importi decimal string dalla fonte→unità minime intere/exponent currency qualificato; niente float binario o arrotondamento silenzioso, preservare precisione non rappresentabile in campi derivati.

**Compatibilità del compilatore.** Qualificare plugin/generatori che importano la sua API, non soltanto `tsc`: la disponibilità e compatibilità dell’API devono essere verificate sulla release effettiva in M0. Non introdurre automaticamente un secondo compilatore o una compatibility dependency. Un eventuale adattamento tecnico deve essere circoscritto, documentato e non far divergere il typecheck autorevole da CI/editor. [S09](SOURCES.md#s09)

<a id="s27"></a>
## 27. Modello dati logico e invarianti

Lo schema fisico dipende da M0. La tabella descrive **responsabilità logiche**, non un elenco di tabelle obbligatorie: possono coincidere nello stesso record quando non indebolisce integrità, permessi o retention. Non duplicare entità già possedute da Auth o dalla coda del provider.

| Entità | Dati/responsabilità principali |
|---|---|
| users, auth identities, sessions | Identità/persona e metodi del provider scelto; non duplicare l'Auth |
| workspaces e appartenenza | Confine tenant e unico utente operativo 2.0; evolvibile senza implementare inviti, ruoli/team o servizi multi-workspace |
| ebay_accounts, connections | ID stabile, nomi, stato/ragione, versione connessione, credenziali cifrate in sede protetta |
| orders; versioni complete solo se necessarie | Identità esterne, date, stati originali/normalizzati, importi e dati legati all’ordine; niente copie integrali per ogni polling |
| order_items | ID riga, titolo, SKU, quantità, valori/valuta, URL immagine qualificato |
| Snapshot buyer dell’ordine; buyer canonico opzionale | I dati dell’ordine non vengono riscritti dall’anagrafica corrente; collegamento affidabile solo nello spazio |
| tax_identifiers, tax_versions | Valore, tipo/Paese/fonte, qualità, provenienza e variazioni |
| order_access_grants, unlock_events | Diritto per ordine, origine, prima disponibilità, ciclo e deduplica |
| free_cycles, promotions | Ancoraggio, quota congelata, utilizzo derivato e date promo |
| commercial_catalog, price_generations | Listini base EUR e prezzi provider per ambiente |
| subscriptions, entitlement_grants | Stato locale riconciliato, validità/origine/oggetti provider |
| lifetime_allocations | Prenotazione, conferma, omaggio, vincolo capacità e diritto persistente |
| suggestions | Sorgente/destinazione/versione, criterio affidabile e invalidazione |
| Stato sync e checkpoint applicativi | Cursori, esiti e chiavi di deduplica utili; coda/tentativi nativi riusati, lease solo se necessari |
| Ricezione eventi; outbox solo se necessaria | Deduplica e recupero di azioni richieste dal commit senza duplicare il servizio di trasporto |
| telegram_links, preferences, deliveries | Chat verificata, destinatari, consensi, eventi e stato consegna |
| exports | Richiesta/ambito, revisione di accesso del workspace, formato, stato, validità e file; nessun grafo delle versioni per file |
| notices, audit_events, consents | Campanella, audit minimizzato, marketing e revoche |
| deletion_requests, deletion_markers | Stato erasure e barriera a reimport/restore illecito |

Default: UUID interni; univocità per namespace/tenant; FK o integrità equivalente; indici sulle query reali; schema migrazioni versionato. Nessun buyer globale tra merchant, nessun elenco fiscale generale ricercabile.

Invarianti bloccanti: un account eBay attivo in uno spazio; niente saldo Free negativo; un solo primo sblocco per ordine; nessun secondo addebito per tipo fiscale; lifetime allocati+prenotati non oltre disponibilità; nessun diritto dal redirect; grant rimborsato distinto da grant indipendente; job stale incapace di reinserire dato cancellato; dato non autorizzato non esposto da cache/export/search; ordine e importi non modificabili dal client.

Diritti Premium creati quando il dato è acquisito/disponibile nel periodo valido, non quando aperto (Q568). Concorrenza tra acquisizione e scadenza gestita con istante autorevole e transazione: non concedere retroattività arbitraria al completamento di un job iniziato prima.

Audit e raw separati dal modello operativo, con retention propria. Buyer senza ordini giustificanti viene eliminato quando non necessario; conservazioni commerciali minime distinte dai dati fiscali buyer. Persistono tutte le variazioni fiscali effettive fino alla cancellazione dell’ordine; non duplicare versioni identiche o l’intero ordine per un cambiamento irrilevante. Misurare il volume delle informazioni effettivamente conservate. La modifica del dato di un buyer canonico non riscrive gli snapshot storici.

Gli eventuali record di eventi, outbox e job, e le ricevute, non sono archivi integrali dei payload. Persistono ID tecnici, riferimenti e campi minimizzati necessari a deduplica/ripresa. Un body grezzo conservato temporaneamente per verifiche resta soggetto alla propria scadenza, anche se il job non è concluso. La notifica viene renderizzata dai dati correnti autorizzati; un payload in coda non deve trattenere per mesi un CF eliminato dal database operativo.

<a id="s28"></a>
## 28. Contratti API e gestione degli errori

Endpoint applicativi HTTP sotto `/api/v1` **quando hanno un consumatore attuale**; callback/webhook mantengono i propri percorsi dedicati. Nessuna API pubblica commerciale né seconda API che duplichi ogni action/loader di React Router per la futura 3.x. Schemi runtime, errori e casi d’uso restano condivisibili: l’interfaccia nativa potrà esporre/riusare i contratti necessari quando verrà sviluppata.

Famiglie funzionali, non elenco obbligatorio di endpoint: profilo/sicurezza; negozi/link/reconnect/pause; ordini/query/dettaglio/refresh; sblocco singolo/multiplo; quote/diritti; trial/checkout/portal; notifiche/preferences; export/status/download; cancellazioni; admin; callback/webhook. Operazioni sensibili con authz server, idempotency key e risultato riconciliabile.

Convenzioni: cursori opachi, timestamp UTC ISO, valuta+intero/exponent, enum estensibili con stato sconosciuto sicuro; errori con codice stabile e messaggio IT/EN separato, correlation ID non sensibile, retry-after se applicabile. Esempi di categorie: `AUTH_REQUIRED`, `REAUTH_REQUIRED`, `STORE_RECONNECT_REQUIRED`, `QUOTA_EXHAUSTED`, `TAX_CHECK_PENDING`, `UPSTREAM_UNAVAILABLE`, `OUT_OF_RETENTION`, `EXPORT_EXPIRED`, `CHECKOUT_PENDING`, `CAPACITY_WAITLIST`. Sono default tecnici, non dipendenze di SDK.

Risposte asincrone con job ID/stato, polling limitato o push qualificato; nessun successo finto prima del commit. Alla richiesta duplicata stesso risultato o stato coerente, mai consumo ripetuto. Non esporre dettagli dell'altro tenant per distinguere «inesistente» da «non tuo».

Per le integrazioni realmente usate definire timeout, permessi, mapping errori, idempotenza e fixture nei moduli/test o in un contratto breve se serve spiegazione. Non duplicare manualmente schemi generati e tipi eseguibili in cataloghi API paralleli. OpenAPI eBay protegge i tipi, non sostituisce validazione runtime o l'analisi della semantica fiscale. Nuovi campi ignoti non devono abbattere tutta l'importazione né essere pubblicati indiscriminatamente.

Condividere negli adapter un punto minimo per timeout dell'intera lettura, limite di byte anche su risposte in streaming, parsing e classificazione degli errori. Distinguere credenziali scadute, rate limit, indisponibilità e payload invalido; propagare Retry-After quando presente, evitando retry sovrapposti fra client e coda. Coprire anche body senza Content-Length e interruzioni durante la lettura. Non costruire un framework HTTP generale.

<a id="s29"></a>
## 29. Sicurezza e segreti

Sicurezza da M0/M1, non rinviata a M7. Threat model minimo: accesso fra tenant, CF non sbloccati, takeover/linking, furto token eBay, replay OAuth/webhook, injection da titoli/CSV, privilege escalation admin, ripristino di revoche obsolete, supply chain e prompt injection nei tool.

Il threat model minimo è la tabella seguente (D147): ogni intervento che introduce un percorso esposto aggiunge qui la prova negativa pertinente, e M7 verifica la tabella intera sul candidato, non un documento separato.

| Minaccia | Controllo richiesto | Prova già presente | Da completare |
|---|---|---|---|
| Accesso fra tenant | Spazio e diritto all'ordine verificati nel servizio su ogni percorso ([§29.1](#s29)) | Test D1: utente di altro spazio, ordine altrui, grant altrui rifiutati; negozio già collegato altrove senza token salvati né dati dell'altro spazio nell'esito | Ricerca/conteggi M4, export M6; tutti i percorsi esposti in M7 |
| CF non sbloccati | Valore inviato solo dopo un grant valido; mai in log, URL o export non autorizzati | Grant atomico e quota concorrente; log con soli metadati ammessi; anteprima senza valore prima dello sblocco | Sblocco reale M3, ricerca fiscale M4, export M6 |
| Takeover e linking | Collegamento automatico solo con email verificata e provider affidabile; ultimo accesso non rimovibile | Callback eBay ambigui o senza stato rifiutati; enrollment passkey solo dopo verifica, profilo e Termini; revoca atomica con ultimo metodo valido conservato; origin estranea rifiutata, verifiche WebAuthn limitate per IP; reset password con revoca delle sessioni e token monouso; collegamento esplicito solo dalla stessa sessione verificata e senza `idToken` diretto; collegamento per email solo con email Google autorevole (Gmail o `hd`); account creato in anticipo con l'email altrui senza metodi propri; subject Google stabile anche con email cambiata e mai collegato a un secondo utente; rimozione atomica dei metodi anche concorrente; cambio email con conferma del vecchio e del nuovo indirizzo | Prove eBay reali in M8 (D160) |
| Furto token eBay | Scope minimi, token cifrati, nessuna route che li esponga, rotazione | Link `next` e URL del provider fuori dall'origine API HTTPS dell'ambiente rifiutati prima di inviare il token; token OAuth cifrati; `get-access-token` e `refresh-token` non esposti; collegamento negozio senza scope email; token seller cifrati con AES-GCM, chiave dedicata e legame a negozio e tipo; rinnovo in background che non sovrascrive un consenso più recente; scollegamento cancella i token e impedisce scritture tardive | Primo rinnovo reale e qualifiche provider nelle questioni aperte |
| Replay OAuth e webhook | State/PKCE legati all'utente; firma sul corpo grezzo e claim idempotente | State di un altro utente rifiutato; callback negozio duplicato con lo stesso esito e senza secondo scambio del codice; firma Stripe verificata ed evento registrato una volta | Ingresso Worker M3, webhook e riconciliazione M5 |
| Injection da titoli e CSV | Escaping in pagina, formule neutralizzate negli export, CSP | CSV con formule neutralizzate; rendering React con escaping; XML Trading oltre limite, con NUL o con `DOCTYPE`/`ENTITY` rifiutato prima del parsing; immagini solo da host eBay HTTPS in formato raster | CSP assente: da introdurre e provare entro M7 |
| Privilege escalation admin | Ruolo admin esplicito, MFA e nuova verifica per azioni sensibili | Confine admin e passkey UV provati con asserzioni sintetiche, revoca del ruolo applicata alla richiesta successiva | Enrollment owner e console completa M6 |
| Ripristino di revoche obsolete | Marker di erasure e revoca riapplicati dopo un restore ([§32.1](#s32)) | Nessuna prova conclusiva sul candidato finale | Retention M3, erasure M7 e drill pre-go-live M9 |
| Supply chain | Lockfile e versioni fissate, rifiuto di firme o provenance perse, Action a SHA, analisi statica; nessuna età minima dei pacchetti dal 2026-10-08 ([§26](#s26)) | `trustPolicy`, `minimumReleaseAge: 0`, Action a SHA, Dependabot, dependency review e CodeQL | Licenze e codice copiato M7 |
| Prompt injection nei tool | Dati esterni trattati come contenuto, permessi MCP minimi, separazione test/Production | Regola in AGENTS e in questo capitolo | Verifica in M7 |
| Perdita o esposizione di segreti | Custodia fuori repository, segreti elencati in `secrets.required` di ogni configurazione di deploy, nessun segreto nel client | Deploy test e Production che rifiutano un segreto mancante; pagina provvisoria che li conserva | Scadenze M7, readback alla pubblicazione M9 |

Misure: scope minimi effettivamente necessari; state/nonce/PKCE dove supportati e corretti per il provider; redirect allowlist; cookie/sessioni sicure e CSRF/origin check sulle mutation; rate limit di login e operazioni costose; token cifrati e rotazione; firme webhook su corpo originale e replay protection; validazione input/output; CSP e escaping; download autorizzati; nessun segreto build-time esportato al browser.

**Limiti di richiesta e anti-automazione (D166).** Il binding Rate Limiting di Workers è il primo filtro nel Worker per IP e percorso su Auth, richieste di link email, form di supporto, export e altre operazioni costose: non scrive su D1 e scarta il traffico anomalo prima del lavoro applicativo. Il suo contatore è locale al data center e approssimato, quindi non sostituisce i contatori D1 per indirizzo email e operazione, che restano dove serve un limite coerente per account. Il superamento risponde 429 con `Retry-After` e `no-store`, senza rivelare se l'account esiste.

Turnstile protegge registrazione con password, richiesta di reset, reinvio dei link email e form di supporto. Non si applica a passkey, Google, eBay, webhook o callback dei provider. Il token è verificato lato server con Siteverify, accettato una sola volta entro i cinque minuti di validità e confrontato con hostname e azione attesi; senza esito positivo, anche per indisponibilità di Siteverify, la richiesta è rifiutata con un messaggio che permette di riprovare. Widget e chiavi sono separati per test e Production; la CSP ammette soltanto l'origine del widget. Turnstile entra nell'inventario delle tecnologie e nell'informativa ([§30](#s30)). [S34](SOURCES.md#s34)

Dati fiscali non presenti in analytics, log automatici, URL pubblici, issue o Git. Error tracing elimina payload/request body sensibili. Fetch immagini/URL esterni solo su domini/formati qualificati, evitando SSRF e contenuti attivi. XML Trading con parser sicuro senza entità esterne. Non includere l'intera risposta provider in un messaggio di errore.

WAF/rate limit della zona, HSTS e header seguono [§24](#s24), con qualifica in [M7-12](#m7-12). I filtri edge non sostituiscono firme sul corpo grezzo, isolamento, quota o revoca server; le impostazioni esterne alla build entrano nel readback configurativo e nella regressione degli ingressi.

Difese minime sulle risposte eBay: XML Trading rifiutato oltre un limite di dimensione, con byte NUL o con `DOCTYPE`/`ENTITY`, prima di qualsiasi parsing; link di paginazione `next` e URL restituiti dal provider accettati solo se HTTPS e sulla stessa origine API eBay attesa per l'ambiente, altrimenti la pagina fallisce chiusa e il token non viene inviato. Il callback di cancellazione account applica un limite di richieste per origine con memoria limitata e un budget per il recupero delle chiavi pubbliche eBay, riusate dalla cache per la durata consentita; il superamento risponde 429 senza scartare le notifiche valide, che eBay ritenta.

Le scadenze note delle credenziali (token provider, client OAuth, API token Cloudflare e Stripe, piani a termine) sono registrate nell'inventario privato accanto ai nomi logici. Un controllo periodico legge quel registro e avvisa l'owner con almeno 45 giorni di anticipo; una voce senza data resta segnalata come da completare.

Codex può consultare dati anagrafici/fiscali reali per compiti pertinenti in contesto autorizzato; non è vietato in assoluto. Rimangono minimizzazione, condizioni applicabili del servizio, niente copie permanenti pubbliche o fixture live. Prompt/output non sono deposito di segreti. Le risposte degli strumenti e i dati ordini sono contenuto non attendibile, non istruzioni a eseguire comandi.

Inventario privato con owner/account/ambiente/nome logico segreto, custodia/rotazione/revoca/recovery. Template pubblici senza valori. Separazione test/Production verificata prima di scritture; permessi MCP minimi ma sufficienti al lavoro approvato. Il ripristino non deve riattivare sessioni rubate, consensi revocati o buyer cancellati.

### 29.1 Autorizzazione anche sotto gli adapter

Le credenziali privilegiate dei servizi server non sostituiscono il controllo dello spazio e del diritto all’ordine. Il client non può assegnarsi piano, grant, quota, appartenenza o ruolo modificando metadata personali o parametri della richiesta. Gli stessi vincoli valgono per ricerca, conteggi, snapshot, suggerimenti, export, RPC e dati di sincronizzazione.

Con PostgreSQL/Supabase, qualificare RLS insieme a permessi di tabella/colonna, viste e funzioni. Una vista o una funzione con privilegi del proprietario può aggirare policy che sembrano corrette sulle tabelle. Usare ruoli minimi, schemi esposti limitati, permessi di esecuzione espliciti e `search_path` sicuro nelle funzioni privilegiate; non rendere pubblici gli helper amministrativi. La policy deve verificare anche revoca sessione/diritto corrente dove richiesto, non soltanto un tenant nel JWT. Con D1 gli stessi invarianti sono applicati nel servizio e nelle operazioni atomiche qualificate. [S21](SOURCES.md#s21)

Il gate include prove negative attraverso **ogni percorso effettivamente esposto**, non solo il frontend: leggere un CF bloccato con la Data API diretta, usare una sessione revocata, alterare un workspace ID, scrivere direttamente un grant o scaricare un file altrui deve fallire. Non introdurre nuove API pubbliche per realizzare questi test.

<a id="s30"></a>
## 30. Privacy, conservazione, cancellazione e licenze

Temisfera è operatore del prodotto; Stripe Managed Payments assume il ruolo della vendita finale secondo il contratto applicabile. eBay, MoR, cloud, email, iCloud e strumenti Codex non vengono tutti etichettati automaticamente «subprocessor»: il gate privacy classifica i ruoli reali, finalità, basi, trasferimenti e accordi. Preferenza UE, non vincolo assoluto senza eccezioni. Il consenso owner non sostituisce ogni obbligo verso i buyer.

| Categoria | Regola di conservazione approvata |
|---|---|
| Ordini visibili Free | 30 giorni dalla data ordine, salvo obblighi prevalenti |
| Ordini Premium standard | Un anno, estensioni concesse esplicitamente |
| Eccedenza dopo downgrade | 30 giorni transitori, non consultabile/aggiornata, ove consentito |
| Raw eBay temporaneo | 24 ore, non storico diagnostico permanente |
| File export server | 24 ore; copie scaricate fuori dal servizio |
| Versioni fiscali interne | Fino alla cancellazione applicabile dell'ordine |
| Campanella | 30 giorni |
| Log applicativi ordinari minimizzati | 90 giorni |
| Audit sensibile minimizzato | Un anno, salvo eccezione motivata/obbligo |
| Segnali antiabuso/IP | Temporanei/pseudonimizzati e minimo necessario; durata motivata nel gate privacy |
| Consensi e prova diritti commerciali | Minimo per finalità/obblighi; separati da dati buyer |
| Backup nativi | Finestra del piano/provider qualificato; cancellazioni propagate alla riattivazione |

Pseudonimizzato non significa anonimo. Gli ultimi casi richiedono inventario di trattamento, non conservazione illimitata implicita. Durate tecniche/legali residue definite nel contratto privacy in M0/M7 entro le decisioni approvate; cambi di finalità o costo ritornano all'owner.

Cancellazione account: riautenticazione e conferma forte, stop immediato accesso/sync/notifiche e rinnovi, avvio cancellazione senza ripensamento. Se Stripe non conferma stop rinnovi, conservare solo job/tombstone e riferimenti minimi necessari a completarlo, alertare: non cancellare il raccordo che impedisce ulteriori addebiti. Non obbligare il merchant a disdire a mano. Proporre export prima della conferma senza vincolarlo.

La conferma via email usa `sendDeleteAccountVerification` di Better Auth, ma il callback di conferma avvia soltanto il job di cancellazione di FiscalBay: la cancellazione nativa di Better Auth non elimina l'utente nella stessa richiesta, prima dello stop dei rinnovi e dei marker. L'utente Auth viene eliminato dal job, dopo gli altri passaggi; l'email di cancellazione completata parte dal modulo email applicativo ([M6-12](#m6-12)).

Scollega vs Scollega ed elimina negozio separati. Eliminazioni richieste eBay/buyer autorevoli prevalgono sullo storico commerciale. L’accesso cessa quando scade il diritto/la finestra; la pulizia fisica segue il job deterministico, normalmente entro 24 ore dalla scadenza prevista, salvo termini prevalenti; nessun clone in suggerimenti/versioni/export già invalidati. Backup non equivale a diritto di restaurare dati cancellati: tombstone/replay delle revoche prima di riaprire servizio, oppure riconciliazione conservativa.

Le letture applicano scadenza e revoca anche se il job di pulizia non è ancora passato: dettaglio, ricerca, suggerimenti, generazione e download export non estendono la visibilità dei dati ancora fisicamente presenti. Provare i confini temporali con pulizia sospesa e le revoche durante richieste concorrenti.

Privacy e Termini IT/EN, italiano prevalente se appropriato; informativa cookie separata solo quando necessaria, comunque inventario delle tecnologie reali, incluso Turnstile ([§29](#s29)). Trasparenza fornitori e cosa leggiamo/non facciamo; diritto di recesso e tutela consumatori da qualificare, senza confondere assenza di garanzia commerciale con assenza di diritti obbligatori. Dati legali reali di Temisfera raccolti privatamente, non inventati.

L'inventario comprende anche eventi WAF e report aggregati DMARC ([§24](#s24)): finalità di sicurezza, campi, accessi e retention effettiva del provider si qualificano in M7-07; nessuna raccolta di corpi email, dati fiscali o diagnostica buyer per queste funzioni.

Nuovo codice originale proprietario/all rights reserved, repo pubblico senza promessa community. Riuso legacy già MIT e componenti terzi conserva condizioni/notices pertinenti; non revocare licenze già concesse. Registro provenienza dei componenti, licenze miste/Pro valutate file per file. Nome/logo eBay e FiscalBay passano gate marchi/licenza API prima del lancio, nessun cambio nome automatico.

**Accettazioni e trattamento.** Registrare versione/lingua dei Termini accettati e avvenuta disponibilità dell’informativa secondo il flusso legale qualificato. Non chiamare «consenso privacy» ogni trattamento necessario al servizio. Il consenso marketing è distinto, facoltativo e revocabile, con prova della versione e della scelta. Per nuove finalità o cambi contrattuali sostanziali vale il gate dell’owner; non inventare un consenso retroattivo da un semplice login.

**Cancellazione nelle copie derivate.** La matrice di conservazione include snapshot, suggerimenti, payload delle code, supporto, file temporanei, indici e log/provider. Un ID pseudonimo che può essere ricollegato resta dato da valutare. Il contratto con eBay va verificato anche per l’effettiva irreversibilità delle cancellazioni richieste: una semplice `deleted=true` o una chiave ancora recuperabile da backup non dimostrano conformità. Prova della notifica, verifica della fonte e cancellazione effettiva sono tre passaggi distinti. [S23](SOURCES.md#s23)

Le richieste di cancellazione finanziaria ricevute tramite Stripe/Link seguono anche §6.6; non sono ignorate perché non provengono dal pulsante FiscalBay. Conservazioni residue commerciali o di sicurezza devono essere motivate e minime, non un’esenzione generale dalla cancellazione.

<a id="s31"></a>
## 31. Osservabilità, metriche e supporto operativo

Log strutturati con correlation ID; contatori/istogrammi per esito e latenza, senza CF/buyer nei label. Audit separato dai log ordinari. Conservazione 90 giorni/un anno qualificata contro quote/costi: la retention breve della dashboard provider non soddisfa da sola la scelta. Preferire strumenti nativi e dati minimizzati; monitoring esterno soltanto se utile e autorizzato. Il polling ordinario riuscito alimenta contatori aggregati e ultimo stato utile, non un dump dettagliato per ogni ciclo conservato 90 giorni. Dettaglio per errori, sicurezza e riconciliazione quando necessario; le durate approvate restano invariate.

**Diagnosi del test.** La dashboard tecnica Cloudflare dedicata a `fiscalbay-test` usa invocazioni metriche e record di invocazione dei log nativi, con CPU, durata ed esiti per HTTP, coda e cron; configurazione, filtri e procedura di confronto fra release in [RELEASE](engineering/RELEASE.md#dashboard-test). I marcatori deploy restano quelli nativi Workers Metrics, senza codice aggiuntivo né gate CPU automatico. [M7-04](#m7-04) completa e mantiene la vista operativa con le integrazioni future, senza riaprire milestone chiuse.

**Conservazione effettiva (D166).** Workers Logs serve alla diagnosi recente: su Workers Paid conserva 7 giorni. I 90 giorni dei log ordinari si ottengono con Workers Logpush verso un bucket R2 dedicato, con giurisdizione UE, accesso limitato all'owner e regola di lifecycle a 90 giorni. La destinazione R2 diretta di Logpush non supporta bucket con giurisdizione: usare la destinazione S3-compatible con endpoint UE e credenziali limitate al solo bucket. I campi esportati seguono l'allowlist sotto; escludere l'oggetto `Event` e le `Exceptions` non sanificate, che possono portare contesto della richiesta e testo libero. I messaggi applicativi in `Logs` devono essere già minimizzati; filtrare per Worker FiscalBay e ambiente, senza esportare log degli altri progetti. Logpush dei Workers richiede Workers Paid, confermato con D169: il requisito dei 90 giorni è soddisfatto quando [M7-11](#m7-11) configura e verifica l'esportazione. L'audit sensibile a un anno non dipende dai log: vive in una tabella D1 minimizzata, con pulizia periodica alla scadenza e nessun dato fiscale o buyer. Dal 1° dicembre 2026 Workers Logs adotta i prezzi Cloudflare Observability: soglie e costi si rileggono prima di [M7-03](#m7-03). [S34](SOURCES.md#s34)

**Metriche tecniche (D166).** Contatori e istogrammi per esito e latenza, budget di prestazione e consumo per fase (Auth, D1, eBay, rendering) si scrivono su Workers Analytics Engine, senza CF, buyer, email, ID utente o URL con query fra i campi e gli indici. Analytics Engine non deduplica: i KPI di business che devono resistere a retry, schede concorrenti e reconnect restano eventi deduplicati in D1. Quote, retention e costo si verificano sulla documentazione corrente prima dell'adozione in [M6-11](#m6-11), senza estendere le durate approvate.

Analytics Engine conserva i dati per tre mesi, distinti dalla retention dei log e dell'audit. La SQL API di Workers Analytics Engine richiede di pesare conteggi, medie e quantili con `_sample_interval` quando interviene il campionamento adattivo; dichiarare finestra e approssimazione nel report, senza usare le stime per quota, billing o controlli di accesso. Prezzi e quote documentati, ancora senza addebito alla verifica del 2026-10-12, sono in [S34](SOURCES.md#s34); non considerarli una gratuità permanente.

**Lavoro pianificato.** Un solo Cron Trigger per ambiente, ogni 10 minuti come scelto in [M3-04](#m3-04) per il target 10/30, smista sync, ripresa delle ricevute non accodate, pulizie di retention, riconciliazioni e controlli periodici in base a `scheduledTime`; il lavoro pesante passa dalla Queue invece di restare nell'invocazione del cron. Workers Paid ammette 250 trigger per account, quindi il numero non è un vincolo. Un terzo trigger FiscalBay (per esempio giornaliero in Production) non aggiunge capacità, perché ogni lavoro pesante passa dalla coda: si valuta soltanto se le misure di [M3-12](#m3-12) mostrano che lo smistamento ordinario non riesce a programmare i compiti giornalieri. I riepiloghi Telegram usano la granularità del trigger.

Alert amministrativi azionabili o aggregati, non ogni errore transitorio; Telegram primario ed email alternativa, deduplica e messaggio di rientro. P1 sicurezza/corruzione/billing errato/indisponibilità sostanziale; P2 funzione importante degradata; P3 problema circoscritto. Escalation del MoR e richieste soggette a finestra temporale prioritarie. Un account email iCloud non deve essere l'unico controllo invisibile di incidenti critici.

Per la zona, [M7-12](#m7-12) configura Certificate Transparency Monitoring e report DMARC di [§24](#s24); M7-04 definisce chi li consulta e come gestisce un certificato inatteso, un mittente sconosciuto o un falso positivo WAF. Gli eventi del provider non sostituiscono log applicativi, audit o ricevute, e le emissioni legittime non producono automaticamente un incidente P1.

Ogni log strutturato contiene soltanto campi in allowlist: evento, classe, istante, correlation ID, codice errore stabile e metadati tecnici. Mai URL con query, payload, header, token, CF o dati buyer. Errori, webhook e sicurezza sono registrati sempre; gli eventi ordinari riusciti possono essere campionati. Le query di diagnosi (errori per codice, webhook, correlation ID, scritture di eventi fallite) e le soglie iniziali P1/P2 sono documentate nel runbook insieme al percorso che le legge. Il correlation ID si copia nella ricevuta dell'incidente, non i log completi.

**Quote e stop point.** Nessun controllo automatico di capacità dopo il deploy test (D158): la CPU per invocazione si legge quando serve nei log del Worker, e la capacità reale si misura in M7. Il runbook elenca per Worker, D1 e Queue le quote di riferimento e gli stop point operativi; al raggiungimento si verifica a quale progetto dell'account appartiene il consumo e si sceglie con l'owner fra ottimizzazione e costo aggiuntivo; si fermano nuovi ingressi solo se il consumo è anomalo o il costo non è accettato.

Con Workers Paid (D169) le soglie di attenzione si riferiscono alle quote mensili incluse per l'intero account: 10 milioni di richieste e 30 milioni di CPU-ms, 1 milione di operazioni Queue, 25 miliardi di righe D1 lette, 50 milioni scritte e 5 GB di storage D1, 20 milioni di eventi log fino al 30 novembre 2026 e poi le quote Observability, 3.000 email. L'80% di una quota inclusa raggiunto prima della fine del ciclo di fatturazione, o qualsiasi addebito oltre il canone, avvia la verifica del runbook. Sono riferimenti da riconfermare con il consumo condiviso corrente prima dell'apertura, non un controllo al deploy né autorizzazione automatica a costi. Con 150 negozi la stima M0 di circa 36.000 operazioni Queue al giorno supera di poco l'incluso mensile, con un costo marginale.

La CPU per invocazione non ha il vincolo dei 10 ms del Free: il limite predefinito è 30 secondi per le richieste e 15 minuti per cron e consumer. I budget di pagine, cron e consumer si fissano su latenza percepita, durata delle esecuzioni e consumo mensile, misurati in [M7-03](#m7-03); le ottimizzazioni di D167 restano valide perché riducono latenza e costo.

Per D1 vale anche il limite del singolo database: 10 GB su Workers Paid, distinto dallo storage dell'account. Applicare una soglia prudenziale di 8 GB per database, includendo indici, sessioni, ricevute e audit; il limite per database resta e le query vanno misurate. Per Queue contare scrittura, lettura, eliminazione, retry e passaggi in DLQ, non soltanto il numero di messaggi. [S34](SOURCES.md#s34)

Metriche prodotto aggregate iniziali: signup, email verificata, primo negozio, prima sync, primo CF trovato, primo sblocco, trial, Free→Premium, trial→acquisto, cancellazioni, attivi, error rate, ritardo sync, uso quota. Nessun session replay o funnel UI dettagliato nella 2.0; eventuale ampliamento approvato dopo.

Distinguere anche il primo ordine disponibile dalla prima sync riuscita a zero ordini. Misurare il passaggio fra account verificato, negozio collegato, prima sync e primo ordine con eventi business deduplicati per spazio, resistenti a retry, schede concorrenti e reconnect. Esporre conteggi aggregati e tempi fra passaggi con denominatore e finestra espliciti; nessun tracciamento di ogni clic o nuova raccolta di dati buyer.

Misurare separatamente Auth, D1, chiamate eBay e rendering/browser, con nomi e campi allowlistati e campionamento proporzionato. Le metriche distinguono latenza remota, tempo server e resa client; i report client hanno validazione, limite di dimensione e protezione da duplicazioni/abusi. Non includere query, URL con dati personali o identificativi fiscali. Usare questi dati, scritti su Analytics Engine, per verificare i budget di prestazione, senza aggiungere un provider di monitoraggio esterno per default.

Definizioni: merchant operativo = spazio con negozio collegato e sync riuscita negli ultimi 30 giorni; **non è l'attività umana** usata per sospendere Free. Metriche di conversione per coorte/denominatore/periodo, distinguendo trial ancora aperti. Error rate = tentativi falliti / tentativi definiti, senza mescolare retry e ordini; lag = tempo dalla disponibilità fonte quando noto, altrimenti misurare esplicitamente la proxy osservabile. Paganti distinti da omaggi; ricavo ricorrente normalizza annuale ma esclude lifetime; mostrare cassa, tasse e fee separatamente senza presentare il payout come utile.

Metrica primaria prodotto: merchant con collegamento e sync funzionanti; paganti metrica commerciale separata. Nessun obiettivo di massimizzare notifiche o tempo in app. Soglie performance/capacità definite con workload in M0 e validate in M7; baseline reali dopo lancio, non percentuali commerciali inventate.

<a id="s32"></a>
## 32. Recovery, incidenti e continuità

Solo backup/protezioni **native** come requisito 2.0, non copie indipendenti obbligatorie. RPO senza numero fisso, perdita minimizzata ragionevolmente con costo/provider; RTO interno obiettivo ≤24 ore, non SLA pubblico. Un solo restore drill reale in ambiente isolato **immediatamente prima del go-live**, sul candidato finale; nessuna periodicità obbligatoria successiva.

Supabase Free non offre automaticamente il percorso di backup giornaliero documentato per i piani paganti. M0 non può qualificare un database critico senza recupero nativo solo perché entra nei 500 MB: scartare la combinazione o ottenere deroga esplicita. D1 Time Travel è candidato nativo da qualificare. File, segreti, configurazioni, account, diritti e cancellazioni richiedono verifica distinta; il backup DB non ricrea automaticamente oggetti Storage. [S02](SOURCES.md#s02) [S07](SOURCES.md#s07)

Drill minimo: ripristinare dati con sblocchi/cicli/diritti e configurazioni necessarie, riapplicare revoche/erasure più recenti, riconciliare pagamenti, evitare rinotifiche Telegram, verificare login/letture/quote su istanza isolata, misurare tempi/perdita effettiva. Rigenerare fixture non è restore. Niente transazioni/invii reali prodotti dal test.

Kill switch separati per chiamate eBay, invii Telegram e nuovi checkout. Mantenere webhook e riconciliazione pagamenti dove sicuro. Stripe outage non spegne diritti locali validi; auth/database guasti possono impedire consultazione, quindi niente promessa fittizia di modalità lettura sempre disponibile. Incidenti iniziali: sospendere nuove registrazioni/acquisti o sola funzione interessata, preservando il resto quando sicuro.

Runbook: diagnosi/correlation, severità, perimetro, containment, comunicazioni, ripristino/forward-fix, verifica di uscita. Rollback codice solo compatibile con schema/config; mai ripristinare tutto il DB per annullare una release perdendo incassi o cancellazioni recenti.

### 32.1 Ripristino senza reintrodurre dati o diritti revocati

Un marker di cancellazione contenuto **solo nello stesso snapshot ripristinato** non prova quali cancellazioni siano avvenute dopo quello snapshot. M0 deve identificare una fonte nativa sufficientemente indipendente dal rollback interessato, o una ricostruzione autorevole consentita, per gli eventi successivi rilevanti: cancellazioni, revoche, pagamenti e allocazioni lifetime. Non è un nuovo requisito di backup esterno: è una condizione di correttezza del percorso nativo scelto.

FiscalBay usa una sola D1; con Workers Paid (D169) Time Travel copre gli ultimi 30 giorni. Prima di un restore Time Travel congela scritture, job, checkout e accessi, quindi estrae dal database corrente i marker di erasure e revoca successivi al punto scelto, quando ancora leggibili. Dopo il restore li riapplica prima di ogni riapertura e riconcilia diritti e consensi con Stripe, eBay e gli altri provider autorevoli. L'eventuale artefatto cifrato prodotto durante l'incidente è temporaneo, contiene solo i marker minimi necessari e viene eliminato dopo la verifica. Se il database corrente non è leggibile o l'intervallo non può essere ricostruito con certezza, il servizio interessato resta chiuso: non si accetta il rischio di reintrodurre dati o diritti cancellati. [S07](SOURCES.md#s07)

Durante il recupero tenere sospesi job in uscita, checkout e accessi ai dati non ancora riconciliati. Non rimettere automaticamente in uso un file export, una sessione, un token o un consenso recuperato da una copia precedente. Se l’intervallo mancante non può essere ricostruito, mantenere il perimetro interessato non esposto e segnalare il blocco; non dichiarare riuscito il recupero né estendere silenziosamente la retention. I requisiti di erasure del provider devono essere qualificati **prima** di accettare quella strategia di backup.

Classificare ciò che è recuperabile (dati/grant), riconciliabile dal provider (stati finanziari consentiti), ricreabile (configurazione da manifest) e rigenerabile (export temporanei). Account, chiavi e file non sono automaticamente compresi in un backup DB. Un ripristino di credenziali compromesse non è una recovery valida. Il drill conclusivo dimostra queste differenze con dati controllati, non la semplice riapertura di una tabella.

Il solo adempimento richiesto è **un drill conclusivo riuscito** sul candidato finale prima del go-live. Le attività M0/M7 preparano meccanismo e runbook; M8 prepara il candidato. Il [gate di ripristino](#pubblicazione-production) può richiamare la stessa prova svolta a fine M8 se candidato, schema e procedura sono invariati. Un tentativo fallito non chiude il gate: correggere e ottenere una prova riuscita non introduce una periodicità post-lancio.

Per incidenti con dati personali, il runbook individua anche ruoli, destinatari e termini di comunicazione imposti dai contratti/norme applicabili. L’obiettivo RTO24h e l’assenza di SLA pubblico non sostituiscono tali adempimenti.

<a id="s33"></a>
## 33. Agenti, plugin, MCP, skill e strumenti

Configurare CLI, MCP e skill necessari alla fase tramite [AGENT_SETUP.md](engineering/AGENT_SETUP.md). La scelta di un servizio non prova che il relativo tool sia già connesso nell’ambiente corrente dell'agente (Claude Code sul Mac, sessione cloud o thread del progetto Claude).

Tool di consultazione: fonte affidabile, configurazione, permessi minimi e prova di lettura. Tool con accesso a dati o scritture: target e ambienti espliciti, custodia, isolamento, prova pertinente e revoca. CLI e MCP sullo stesso servizio non richiedono due qualificazioni funzionali complete; si verificano i loro accessi e si riusano le prove del contratto.

GitHub e strumenti locali in M0; Stripe per qualifica/billing; Cloudflare/Supabase per candidati realmente valutati e poi solo assetto scelto; shadcn e skill UI nel frontend; eBay secondo i contratti disponibili. Paddle solo dopo decisione owner. Fonti ufficiali e capacità reali, non un nome di plugin inventato. [S13](SOURCES.md#s13) [S14](SOURCES.md#s14) [S15](SOURCES.md#s15) [S16](SOURCES.md#s16)

Le skill non cambiano scope, checkpoint o policy dati. Dati esterni non sono comandi e non autorizzano operazioni; Codex può consultare dati reali pertinenti senza pubblicarli. `/grill-me` e `/grill-with-docs` indicano metodi utilizzabili dove disponibili, non installazioni fittizie né prerequisiti dell’app.

<a id="s34"></a>
## 34. Git, CI/CD, versioning, Pubblica e Promuovi

Branch feature→`develop`, integrato su `test.fiscalbay.it`; `main` candidato Production. Nessun deploy live automatico al merge su `main`. Autodeploy test dopo merge su `develop` con gate e separazione dati; le migrazioni pericolose non diventano innocue per il solo ambiente test.

**Invarianti della pipeline.** Qui restano le regole che cambiano soltanto con una decisione; funzionamento, comandi e criteri tecnici vivono nella [procedura di pubblicazione](engineering/RELEASE.md) e nel codice.

- Action di terze parti pinnate allo SHA completo con la versione in commento, aggiornate da Dependabot; permessi minimi; PR da fork senza segreti né scritture live. CodeQL, dependency review, secret scanning e controlli licenze dove disponibili, senza presumere capacità o costi GitHub senza preflight.
- `develop` richiede `Node 26`, riepilogo di gate, build e browser ([D157](DECISION_REGISTER.md), [D190](DECISION_REGISTER.md)), e ammette il merge automatico soltanto con controlli verdi; l'amministratore conserva la possibilità di intervenire. `main` accetta PR soltanto da `develop` dello stesso repository e, dopo una promozione, `develop` si riallinea in fast-forward.
- Un classificatore unico per locale e CI sceglie fra cinque livelli (documenti, strumenti, test applicativi, build, completo), le prove browser e il deploy secondo l'impatto ([D162](DECISION_REGISTER.md), [D190](DECISION_REGISTER.md), [D192](DECISION_REGISTER.md), [D195](DECISION_REGISTER.md)); in locale prova soltanto le modifiche successive all'ultimo verde; ogni livello esegue uno script di `package.json`, unica definizione della sequenza, e comprende il precedente. I soli valori testuali delle variabili del Worker test distribuiscono dal livello build, senza prove browser della PR; ogni altra modifica di `cloudflare.config.ts` resta completa. File non classificati o confronti non disponibili eseguono il gate completo e il riepilogo CI ne espone i motivi. Il gate completo comprende install con lockfile congelato, formato, lint, typecheck, React Doctor, test e build; i browser seguono l'impatto e girano nell'immagine ufficiale di Playwright della versione del manifest. Un diff solo documentale non ridistribuisce.
- Il riuso di build e prove richiede lo stesso tree o gli stessi input, da run riuscite del repository, senza origine fork né artefatti scaduti; modifiche a classificazione, provenienza o workflow di pubblicazione impediscono il riuso. Il deploy test distribuisce l'artefatto verificato senza ricompilarlo.
- Mutation sui domini critici (sblocco, quota e grant, diritti Stripe, ingresso webhook, Auth, ordini, negozi, export), con il perimetro dei file nel repository: campagna settimanale su `develop` e avvio manuale, fuori dalle PR e da `Node 26`; il candidato qualifica i moduli critici modificati e i loro consumatori critici ([D173](DECISION_REGISTER.md), [D190](DECISION_REGISTER.md)). Superstiti, timeout ed errori bloccano sempre.
- Knip è bloccante nel gate `Node 26` per i controlli non solo documentali. La suite applicativa produce report di copertura completi del perimetro dichiarato, senza soglie percentuali. Benchmark Vitest a richiesta, fuori dal gate e dalla CI ([D190](DECISION_REGISTER.md)). Nessun gate automatico sulla CPU remota; comandi, perimetro ed eccezioni in [RELEASE](engineering/RELEASE.md#qualita-del-codice-e-prestazioni).
- Dopo ogni deploy test il remoto visita le pagine che provano ambiente, dati e accesso, più le aree toccate, anche quando la PR non ha eseguito browser ([D192](DECISION_REGISTER.md)); una prova remota fallita si ripete una volta e, se riesce, resta segnalata come instabile ([D159](DECISION_REGISTER.md)). Le prove browser della PR seguono la stessa regola; il candidato Production non ripete ([D184](DECISION_REGISTER.md)).
- Il candidato Production esegue la qualifica completa: matrice browser IT/EN, mobile/desktop, chiaro/scuro in Chromium e WebKit su test e Production locale, mutation pertinente e provenienza. La certificazione per tree vale sette giorni anche se il deploy successivo fallisce; `Promuovi` rilegge comunque readiness, via sul commit, provider e migration ([D172](DECISION_REGISTER.md)). Per la pubblicazione conta il diff cumulativo dal commit distribuito.
- Test di repository fanno rispettare le regole di AGENTS: nessuna sigla di milestone, task o fase nel codice, nei test, nelle fixture, nei log e nel copy runtime; fixture solo con host sintetici `.invalid` e senza dati reali; grafo degli import applicativi aciclico, controllato da Oxlint; ogni modulo server ha almeno un consumatore runtime; versioni di Node e pnpm di `mise.toml` coincidenti con `package.json`, da cui le legge la CI.

**Ciclo di una PR.** Una PR pronta si qualifica su una base compatibile, che la CI rilegge prima del gate finale: i commit entrati nella base nel frattempo non toccano file della PR né file globali e non aggiungono migration insieme a lei; altrimenti la PR si aggiorna e si riqualifica. Il push su `develop` riesegue il gate sul tree integrato prima del deploy test ([D195](DECISION_REGISTER.md)). Il comando operativo `release:cycle pr` aggiorna la base mediante merge soltanto quando serve, segue la qualifica già avviata sulla testa senza rimettere la PR in bozza, ripete l'aggiornamento se la base avanza in modo non compatibile durante la qualifica ([D184](DECISION_REGISTER.md)), attiva l'automerge e segue CI del commit integrato e, quando il diff distribuisce, ricevuta e readback provider del test; poi elimina il branch della PR. I residui di cicli precedenti si riconciliano a lotti, almeno una volta al giorno di lavoro e a ogni `Promuovi`, conservando lavoro non integrato o in uso. Le migration non additive si approvano nella PR con il digest del loro piano, prima del merge e non dopo un deploy test fallito. Le modifiche al workflow Production `publish.yml` integrate su `develop` avviano la sola qualifica del candidato, senza promozione né deploy.

**Proporzione delle PR.** Ogni PR porta codice, istruzioni o documentazione di prodotto, mai il solo readback o la chiusura. Le modifiche documentali ordinarie entrano nella PR di contenuto successiva; una PR solo documentale è ammessa per decisioni dell'owner, checkpoint o istruzioni che devono valere subito. Le ipotesi diagnostiche su CI o ambiente remoto si provano sul branch, con `workflow_dispatch` o con un deploy manuale sul test da worktree pulito seguito dal ripristino della versione attiva, e confluiscono in una sola PR. Mentre una qualifica è in corso non si aprono altre PR sul processo, salvo la correzione del difetto che la blocca.

Readback e collaudo successivi si riferiscono all'owner; una pendenza utile alla ripresa entra nelle questioni aperte con il prossimo intervento che ha contenuto proprio. Un difetto si registra nella PR che lo corregge.

Versioni interne `2.0.0-alpha.N`→`2.0.0-rc.N`→`2.0.0`. Non significano beta pubblica. `CHANGELOG.md` unica storia delle modifiche rilevanti; GitHub Release derivata per ogni versione Production, non ogni deploy test. Nessuna riscrittura tag pubblicati per correggere un errore.

**Pubblica** è un atto esplicito che autorizza il ciclo verso il test della modifica corrente: PR verso `develop`, gate, merge automatico, migration controllate, deploy test quando il diff distribuisce, readback e pulizia del branch. **Promuovi** autorizza l'intero ciclo Production del lotto su `develop`: promozione su `main`, commit atteso, gate, preflight provider, migration controllate, deploy, smoke/readback, ricevuta, tag/release solo dopo successo; richiede il via di M9 e i gate Production, e fino ad allora non avvia nulla. Domande, ipotesi e negazioni non autorizzano nessuno dei due. Non fermarsi dopo push o prima del readback; non estendere i comandi a provider/scopi non approvati. Cinque checkpoint owner restano separati dalle normali attività.

`Promuovi` comprende, dopo il readback Production e tag/release riusciti, l'inventario e la pulizia dei branch e worktree temporanei già conclusi, inclusi i residui di cicli precedenti. Il coordinatore verifica per ciascuno PR e contenuto integrato anche quando il merge è squash, stato pulito, commit non pubblicati, file non tracciati e processi o altri lavori che usano il checkout; solo allora elimina branch remoto e locale, libera il worktree e riallinea il checkout principale. Conserva `main`, `develop`, `legacy/1.x`, tag, rollback e ogni lavoro non integrato o ancora in uso. Una pulizia non sicura o un passo fallito conservano ricevuta e riferimento di ripresa e restano nelle questioni aperte, senza dichiarare conclusa la pulizia.

Migrazioni versionate, testate su schema/dati rappresentativi, forward-only dove sensato, approccio expand/contract se serve compatibilità. Release manifest collega codice, schema, config e artifact immutabile. Rollback codice automatico se sicuro, altrimenti forward-fix; recovery dati separato. Nessun comando di pubblicazione deve contenere token/PII nelle evidenze.

L'avanzamento segue milestone e task della roadmap (§37), con prove proporzionate e limiti espliciti. Non duplicare output grezzi né creare un diario delle sessioni. L'agente preserva modifiche dell'owner e worktree non propri.

**Pubblicazione riprendibile e provenienza dell’artefatto.** Legare il via a commit e release manifest attesi. Serializzare le pubblicazioni per ambiente; un workflow più vecchio non deve sovrascrivere uno successivo. Promuovere lo stesso artefatto verificato quando il provider lo consente; se serve una ricostruzione specifica Production, registrare gli input immutabili e verificarne l’artefatto, non chiamarlo automaticamente «lo stesso build testato».

Migration, deploy e tag sono passi con ricevuta e readback separati. Se il deploy riesce ma la creazione della GitHub Release fallisce, la ripresa completa quel passo senza riapplicare ciecamente migrazioni o cambiare versione live. Non pubblicare il tag di successo se smoke/readback non passano. Prima di rollback verificare compatibilità tra versione codice, schema e configurazione, senza recuperare un vecchio DB soltanto per tornare al codice precedente.

Il readback del candidato confronta commit/artefatto, schema e configurazione attesi e verifica gli invarianti applicativi pertinenti alla modifica, inclusi diritti e lavori pendenti bloccanti. Un deploy riuscito o un HTTP 200 non bastano. Provare ripresa dopo interruzione e rifiuto di un candidato superato senza ripetere effetti già confermati.

<a id="s35"></a>
## 35. Strategia di test e criteri osservabili

Vitest dominio/integrazione; Testing Library e user-event componenti; Playwright E2E; axe come aiuto, non certificazione. Chromium e WebKit sui flussi principali e prima delle release; nessun collaudo Firefox dedicato (D156). Viewport desktop/mobile più prova reale su Safari/iOS e un browser mobile rappresentativo quando disponibile: emulazione non dimostra comportamento passkey/clipboard/download su dispositivo. Fixture sintetiche o sanitizzate, accesso live controllato quando necessario.

| Suite critica | Casi minimi bloccanti |
|---|---|
| Sblocco | Assente/errore/locked/unlocked; due richieste simultanee; ultimo credito; CF+P.IVA; dato incoerente; quota finita; perdita risposta |
| Cicli | 7×24h, timezone/DST, evento nella prima notte del ciclo con fuso a est e a ovest di UTC, promo finita nel ciclo, reconnect/sostituzione senza reset, storico+nuovo stesso contatore |
| Diritti | Trial volontario, acquisto mensile/annuale durante la prova con primo addebito alla sua fine, senza doppio incasso, scadenza, omaggi, lifetime, refund per grant, grandfathering e switch |
| Downgrade | Dati Premium mai aperti; primo ID arrivato dopo; 30 giorni/negozio; grace retention e riacquisto; first connected default |
| Auth | 4 login, linking attendibile, email non verificata, ultimo metodo, MFA admin, reauth, revoca sessioni, OAuth error/replay |
| Isolamento | IDOR su query/dettagli/export/file/admin, CF locked non deducibile da search/count/cache/URL |
| eBay | Paging, overlap, checkpoint, versioni tardive, mascheramento vs rimozione, pagato/non pagato, conflitti fonti, quote condivise, ordine combinato con ID nuovo senza doppia quota, `next` fuori origine, XML con DOCTYPE o oltre limite, omesso vs `null` senza nuova versione |
| Jobs | Deduplica, retry budget, lease scaduta, riavvio, starvation, backfill con nuovo ordine, manuale coalesced, cancellazione durante esecuzione |
| Telegram | Solo fiscali vs tutti, verifica pendente, digest/daylight saving, backlog tecnico vs opt-out, chat sostituita, bot bloccato, escaper |
| Export | Ordine/articolo, zeri iniziali, valute, CSV injection, file grandi, autorizzazione cambiata dopo creazione, scadenza 24h |
| Privacy | Raw 24h, logs 90d/audit1y, erasure buyer/account/negozio, consensi, restore senza resuscitare dati o token |
| Commerciale | Checkout duplicati, lifetime ultimo posto, webhook tardivo/duplicato/out-of-order, ricevute, Link disdetta, metodi/costi, Paesi coperti |
| UI | Due card/una, drawer URL/back/scroll, filtri/persistenza, form errori, light/dark/IT-EN, ridotta motion, tastiera/touch, safe public navigation |

Coverage come segnale, non obiettivo arbitrario 90%. Ogni bug rilevante riceve regression test. Non abbassare validazioni per far passare fixture. Dataset M0 da almeno 70.000 ordini più relazioni e scenari multi-negozio; test non inviato integralmente alle API reali. Rate budget calcolato e prove live contenute.

La copertura Vitest usa Istanbul nelle suite Node e Cloudflare e include anche i sorgenti applicativi e Worker mai eseguiti; test browser e script operativi Node restano fuori dal report. I benchmark, eseguiti a richiesta, misurano normalizzazione eBay, qualità formale degli identificativi, importi ed export sintetici di 100 e 1.000 ordini. Questi campioni non sostituiscono le prove di capacità e carico previste in M7. Le dipendenze sono solo di sviluppo. Adozione dei tre strumenti approvata dall'owner il 2026-10-16 per implementazione e verifica locale; attivazione remota con la successiva pubblicazione autorizzata.

Mantenere scenari sintetici riusati da test di dominio e prove UI: CF assente, bloccato, formalmente invalido o con omocodia, quota esaurita, fonte in errore, dato modificato e suggerimenti discordanti. Le prove formali non certificano l'identità. Gli scenari vivono nei test o in superfici di sviluppo/test non disponibili in Production; nessuna demo mischiata agli ordini reali, nessun simulatore pubblico aggiunto allo scope.

L'anteprima resta disponibile sul test come riferimento visivo dell'area reale e per verificare graficamente stati rari, errori e superfici non raggiungibili con l'account corrente (D176, D179). Usa gli stessi componenti di prodotto, alimentati da scenari sintetici separati dai dati effettivi, con selezione degli stati e verifica IT/EN, temi e responsive. Ogni nuovo stato approvato entra negli scenari nello stesso task che lo realizza; il task non si chiude se area reale e anteprima divergono. L'anteprima rimane esclusa dalla Production: route, loader e azioni rispondono 404 anche con richieste dirette. Un elemento che il piano non prevede si elimina, senza trasformarlo in un nuovo requisito.

M4 integra nell'app reale interfaccia, preferenze e stati approvati; M5/M6 completano i servizi pertinenti. Ogni task aggiunge o trasferisce le prove funzionali sulle route reali, riusando componenti e fixture utili, e rimuove viste provvisorie, componenti duplicati e codice senza consumatori. Le azioni simulate e il cookie dell'anteprima restano confinati ai dati sintetici: non attestano persistenza, permessi, quota o funzionamento dei provider. Nessun salvataggio simulato viene presentato come riuscito nell'app reale.

Per le prove dei percorsi reali riusare fixture D1 e sessioni sintetiche locali, attraversando loader e azioni applicative senza bypass Auth. Ritardi, indisponibilità, risposta persa e clipboard negata si riproducono con gli strumenti di test esistenti; le prove della sola risposta UI restano distinte da quelle degli effetti server. Usare date coerenti nelle fixture e tempo controllato nei test di dominio. Conservare catalogo pagine, prove IT/EN, chiaro/scuro, smartphone/tablet/desktop, tastiera, focus, contrasto e movimento ridotto sui percorsi reali, oltre alle prove grafiche nell'anteprima. Le verifiche su dispositivi e provider reali restano ai gate competenti. Nessun secondo simulatore o nuova infrastruttura dedicata.

M4-08 verifica la baseline visiva e il trasferimento delle prove disponibili; M7-08 chiude l'integrazione end-to-end e la pulizia prima della RC, conservando l'anteprima sul test e verificandone l'esclusione dalla Production. Restano i componenti di prodotto, le fixture riusabili, l'anteprima tabellare dell'export e il server locale della build.

Mutation test mirati verificano che i test intercettino errori su ultimo credito, isolamento degli spazi, scadenza dei grant e revoca del grant rimborsato. Qualificare e fissare il tool di sviluppo compatibile con la toolchain scelta quando viene introdotto; nessuna nuova dipendenza runtime. La campagna settimanale su `develop` prova tutti i domini critici e il candidato quelli del diff cumulativo con i dipendenti ([D190](DECISION_REGISTER.md)); mutanti non equivalenti sopravvissuti sulle invarianti critiche richiedono correzione, timeout/errori non valgono come esito verde. Motivare eventuali equivalenze, senza percentuali arbitrarie o campagne sull'intera applicazione a ogni modifica.

P1/P2 aperti bloccano il rilascio. P3 richiede accettazione esplicita, scope circoscritto e prova che non comprometta dati, sicurezza, billing o core. DoD task = codice, test, documentazione necessaria e comportamento coerenti.

**Regressioni trasversali da coprire.** Token precedente al logout riusato direttamente su API/RPC/file; vista privilegiata che bypassa RLS; cancellazione durante generazione/download export; CSV aperto/importato con diversi comportamenti di tipizzazione; ordine con più righe e più identificativi senza prodotto cartesiano; conflitti fiscali di tipo diverso; Link deletion e oggetto provider non più disponibile; incasso lifetime tardivo dopo scadenza apparente della prenotazione; ripristino di uno snapshot antecedente a una cancellazione; redirect autenticato servito erroneamente a un anonimo; ripresa di Promuovi dopo deploy riuscito e tag fallito.

Ogni prova Stripe distingue i casi simulabili da quelli osservabili soltanto sul percorso live. Un test sintetico del nostro handler può provare la sua logica, non che Stripe emetta realmente quel payload/canale nell’account scelto.

<a id="s36"></a>
## 36. Gate di qualificazione e criteri di arresto

M0 qualifica le fondamenta prima dello sviluppo dipendente. Prototipi di design/copy indipendenti possono proseguire, non implementazione massiva sopra contratti non verificati. «Confermato» nel prodotto non diventa «gate passato».

**Qualificazione progressiva:** prima documentazione, condizioni e risorse effettive; poi esclusione dei candidati incompatibili; quindi spike circoscritti sui rischi ancora incerti e vertical slice del candidato migliore. Non costruire tre backend completi per confrontarli. Un secondo prototipo end-to-end serve solo se il primo fallisce o rimane una decisione realmente irrisolta.

La profondità M0 deve bastare a scegliere senza nascondere blocker: quattro login, operazioni atomiche, casi Stripe speciali, limiti e recovery devono essere qualificati. Schermate definitive e regressione completa arrivano nelle milestone applicative. Una fonte affidabile può risolvere un dubbio documentale, non sostituire una prova richiesta su FiscalBay; non ridurre i gate per accelerare. Le prove valide comuni ai candidati si riusano quando runtime e contratto coincidono.

| Gate | Output minimo | Blocca / criteri di arresto |
|---|---|---|
| G-INFRA | Inventario account/servizi, consumo altri progetti, opzioni CF/SB, separazione responsabilità, costi Free/Paid e limiti | Nessuna capacità inventata; nessun nuovo costo non approvato; no VPS |
| G-AUTH | 4 accessi, linking, sessioni/SSR e revoca su percorsi diretti, MFA/recovery, RP ID/origini test/live | Nessun login tagliato, secondo layer nascosto, credenziale cross-environment o JWT revocato accettato |
| G-EBAY | Matrice campi/fonti/età/stati, scope/identità, quote attuali keyset, sync 10/30, manuale/eventi/backfill | Non qualificato solo da OAuth+un ordine; assenze non inferite dall'elenco |
| G-STRIPE | Eligibility account/categoria, copertura fiscale, contratti commerciali e matrice di prove docs/sandbox/live con checkpoint assegnati | Nessun falso PASS per capacità non simulabile; no Payments standard o fallback Paddle senza owner; nessun incasso di capacità assente |
| G-DATA | Schema rappresentativo, 70k+ ordini e relazioni, query/concorrenza, indici, retention/erasure | Nessun CF tra tenant o saldo negativo; capienza con margine |
| G-EXPORT | CSV/XLSX/ZIP, limiti runtime e sicurezza formato/download | Non eliminare XLSX se una libreria fallisce; qualificare alternativa entro scope |
| G-RECOVERY | Meccanismo nativo, dati/diritti/Auth/config, erasure e revoche dopo snapshot, finestre/costi, unico drill finale | Supabase Free critico non accettato senza recovery; nessuna deroga a erasure obbligatoria o recupero dichiarato senza prova |
| G-STACK | Latest stable effettive, build/test/CLI, generatori SDK, lockfile e matrice runtime | Nessun beta generico o compiler API presunto compatibile |
| G-LEGAL | Ruoli, termini/consumatori, MoR residuale, API eBay/marchi, dati reali Codex, licenze | Nessuna certificazione fiscale/GDPR dal solo consenso owner |
| G-UX | Logo 2.0 approvato dall'owner, sistema token, prototipo dei flussi core approvato | Non usare mockup come nuove feature |
| G-GOLIVE | RC, test merchant, prove finali, restore drill, checklist unica e via owner | Nessun P1/P2, nessuna beta pubblica involontaria |

Gate M0: infrastruttura/Auth/database/strategie e stack selezionati, vertical slice `login→collega eBay→ordine→DB→pagina minimale`, prove costi/capacità e rischi bloccanti risolti o **esplicitamente accettati quando derogabili**. Non si può accettare un'assenza di legalità o sicurezza obbligatoria come default tecnico. Il gate Stripe M0 usa docs/sandbox e verifica eligibility reale; catalogo live configurato in M5 e qualifica commerciale finale prima di M9.

Casi di riferimento capacità: 50 Premium +100 Free, un negozio e 100 ordini/mese ciascuno, circa 70.000 ordini conservati a regime. Con polling puro 10/30 minuti: 12.000 cicli/giorno, 360.000/30 giorni. Nel modello un messaggio piccolo/ciclo e tre operazioni: 1.080.000 operazioni coda, **non previsione di costo o architettura imposta**. Aggiungere retry, dettagli fiscali, backfill, multi-negozio, audit, raw, test e consumo altrui. Eventi possono cambiare il modello. [S10](SOURCES.md#s10)

Il margine di lancio deve essere significativo rispetto ai limiti hard; soglie numeriche derivate in M0, non 90–95% nominale. Monitorare quota account/keyset, CPU per invocazione, memoria, righe lette/scritte, egress, connessioni, email e log. Un utente può far fallire un'operazione oltre limite per invocazione: capacità non è solo numero merchant.

### 36.1 Prerequisiti reali di M0

Distinguere tre percorsi: **inventario/lettura**, **prove eseguibili** e **chiusura della scelta**. Dopo l'adozione autorizzata, l'inventario può partire appena disponibili accessi read-only, senza attendere callback o email. La toolchain si prepara localmente, senza endpoint remoto; HTTPS/callback e trasporto Auth minimi su `test.fiscalbay.it` servono solo alle prove che ne dipendono. Documentazione, quote e review possono procedere nel frattempo.

Prima di acquisizioni reali verificare target, permessi e trattamento. M1 completa DNS/posta di servizio. Nessuna nuova spesa o modifica DNS fuori mandato per accelerare una prova. I prerequisiti d'avvio e le integrazioni necessarie alla chiusura sono distinti nella roadmap; la numerazione non è una catena obbligatoria.

L'inventario privacy preliminare precede ogni acquisizione reale; M0 ne consolida la verifica trasversale. Costi necessari a una prova prima della scelta finale richiedono una specifica autorizzazione limitata: il checkpoint di fine M0 non è autorizzazione retroattiva a spendere. In assenza di permessi, endpoint o trasporto qualificato, la prova è bloccata e non può essere sostituita da una simulazione dichiarata reale.

### 36.2 G-STRIPE: cosa si può provare in ogni fase

| Fase | Evidenza richiesta | Cosa non prova |
|---|---|---|
| M0 documentale/account | Eligibility, categoria, copertura, opzioni realmente supportate, modalità dei casi commerciali e accesso alla qualifica | Non prova che il catalogo live FiscalBay sia già configurato o che un pagamento sia avvenuto. |
| M0/M5 sandbox | Checkout/webhook e logica temporale su dati di test; simulazioni separate per casi non emessi dal sandbox | Non prova la presenza degli acquisti di test nell’app Link né la consegna automatica di email live. |
| M5 dopo via owner | Catalogo/configurazione live, webhook, branding e contatti verificati senza incassi non autorizzati | Non equivale al collaudo di una transazione o del percorso cliente live. |
| Gate finale pre-go-live | Prove residue del percorso live strettamente necessarie, se autorizzate, con esiti e riconciliazione | Non abilita acquisti pubblici prima di M9 o spese/test autonomi su account estranei. |

La documentazione Stripe segnala che gli acquisti di test non sono mostrati nell’app Link e che le email automatiche di ricevuta non sono inviate normalmente in sandbox. Questi casi restano **non osservati** fino alla relativa prova consentita, non «PASS perché il mock passa». Se una capacità indispensabile può essere verificata solo più avanti, M0 chiude la scelta con quell’attività esplicita di qualifica finale, senza dichiarare il requisito collaudato. Un’incompatibilità documentale già certa, invece, non viene rinviata come generico test futuro. [S01](SOURCES.md#s01)

G-LEGAL e G-RECOVERY hanno analogamente una qualifica preliminare M0 e una chiusura finale prima del rilascio. Non devono impedire per definizione l’avvio delle milestone che costruiscono ciò che va collaudato; devono impedire uso di dati reali o pubblicazione finché mancano i rispettivi prerequisiti obbligatori.

<a id="s37"></a>
## 37. Milestone M0–M9

Dipendenze rigide sui gate, attività indipendenti avviabili prima dell'integrazione completa. La numerazione non impone consegne sequenziali né autorizza a rinviare sicurezza/test all'ultima fase. Le integrazioni da CF Ready e Hub Fatture (D143 e D147) sono consolidate nei requisiti funzionali e nei task delle milestone qui sotto; non riaprono M0.

<a id="stato"></a>
### Avanzamento

Gli stati descrivono capacità significative: `Da completare`, `In corso`, `Bloccata`, `Completata`. La chiusura richiede comportamento, prove pertinenti e checkpoint previsto; implementazione, distribuzione sul test e collaudo reale restano distinti. Non ripetere conteggi di test, durate, branch o cronaca delle sessioni. Le prove di una chiusura si collegano alla PR, CI o ricevuta competente; questa sintesi non sostituisce il readback dei provider alla ripresa.

Ogni milestone elenca in coda i propri task (D164) con codice `Mx-yy`, stato (`Da completare`, `In corso`, `Bloccato`, `Completato`), prerequisiti d'avvio, eventuali dipendenze **Per chiudere**, contratto e criterio di completamento. I prerequisiti indicano ciò che serve per iniziare; **Per chiudere** aggiunge integrazioni che non impediscono di lavorare prima. Una milestone si chiude nel suo insieme senza attendere milestone successive (D187): prerequisiti e **Per chiudere** rimandano soltanto a task della stessa milestone o di quelle precedenti. Ciò che richiede una capacità successiva diventa un requisito del task che la crea, che integra i componenti esistenti; il task corrente lo dichiara fra i limiti residui. La PR che avvia, blocca o chiude un task ne aggiorna lo stato nello stesso diff; un task completato conserva descrizione, criterio e limiti residui, non la cronaca delle prove. I codici dei task restano nella documentazione di piano, mai nel codice o nel runtime. Prima di chiudere una milestone confrontare funzionalità, piano, task applicabili e DoD: un conflitto con un provider va portato al gate, non risolto eliminando in silenzio una funzione.

| Milestone | Stato | Capacità e limite |
|---|---|---|
| [M0](#m0) | Completata | Candidato Workers/D1/Queues/Better Auth qualificato e approvato; slice reale controllata, Stripe sandbox e recovery nativa preliminare. Via del 2026-09-23; prove nella storia Git precedente alla rimozione del tracker. Capacità pubblica, integrazioni e prove live finali restano nelle milestone competenti. |
| [M1](#m1) | Completata | Fondazioni, ambienti, logo, design system e prototipo approvati entro il 2026-09-28; fonti tecniche in codice/test/config e [design system](brand/DESIGN_SYSTEM.md). Cutover repository in [#163](https://github.com/max23468/FiscalBay/pull/163); la dismissione remota 1.x resta aperta. |
| [M2](#m2) | Completata | Account, quattro login, sessioni/MFA admin, OAuth seller, pause/scollegamento, Negozi/Profilo e routing collaudati sul test il 2026-10-06, compreso il primo rinnovo dei token dal cron. Login/linking eBay reali in M8 (D160), cancellazione account in M6 (D163). Riferimenti: [#229](https://github.com/max23468/FiscalBay/pull/229), [#241](https://github.com/max23468/FiscalBay/pull/241), [#245](https://github.com/max23468/FiscalBay/pull/245), [#269](https://github.com/max23468/FiscalBay/pull/269), [#270](https://github.com/max23468/FiscalBay/pull/270), [#296](https://github.com/max23468/FiscalBay/pull/296). |
| [M3](#m3) | Completata | Modello ordini, client eBay, import paginato, controllo fiscale, quota e diritti per ordine, retention, suggerimenti e template IT/EN implementati e verificati. Precedenza Fulfillment approvata e integrata ([#318](https://github.com/max23468/FiscalBay/pull/318)); ingresso eventi, cadenze e smistamento qualificati sul test ([#322](https://github.com/max23468/FiscalBay/pull/322), [#325](https://github.com/max23468/FiscalBay/pull/325), [#331](https://github.com/max23468/FiscalBay/pull/331)). Ordini combinati chiusi con limite ([#345](https://github.com/max23468/FiscalBay/pull/345)). Audit finale corretto e qualificato in locale: valori fiscali dopo consolidamento, errori immagini eBay, concorrenza dei compiti periodici e disposizione del template. Distribuzione delle correzioni finali ancora da eseguire, come nelle questioni aperte; ordini combinati reali e consegna attribuita eBay Production restano nel test merchant M8. |
| [M4](#m4) | Completata | Pagina Ordini definitiva sullo stesso albero di componenti dell'anteprima, con accesso separato e misure per fase ([M4-01](#m4-01)); ricerca rapida e filtri reali, con la query fuori dall'indirizzo ([M4-02](#m4-02)); contatti dell'acquirente formattati, cliccabili e copiabili ([M4-09](#m4-09)); elenco stabile con istantanea, nuovi ordini soltanto in cima e negozio ricordato ([M4-03](#m4-03)); pannello del dettaglio con indirizzo proprio, cronologia e focus coerenti ([M4-04](#m4-04)); selezione multipla con sblocco confermato ed Esporta con selezione, filtri e ricerca ([M4-05](#m4-05)); Impostazioni reali con preferenze persistenti, lingua e tema ricordati e campanella dei negozi ([M4-06](#m4-06)); eBay non disponibile, letture ferme di un negozio, caricamento, primi passi e servizio non disponibile nei percorsi reali ([M4-07](#m4-07)), con il collegamento al piano atteso da [M5](#m5). Baseline visiva e di accessibilità su smartphone, tablet e desktop, con focus visibile, movimento ridotto e WCAG 2.2 A/AA automatici sulle route reali e nell'anteprima ([M4-08](#m4-08)). Esporta compare nell'area reale con [M6-01](#m6-01). |
| [M5](#m5) | In corso | Cicli Free, promozione globale e quota congelata implementati ([M5-01](#m5-01)); prova Premium interna di 14 giorni attivabile dopo la prima lettura ([M5-02](#m5-02)). Catalogo netto e Hosted Checkout Managed Payments con verifica del prezzo prima della vendita e metodi qualificati economicamente ([M5-03](#m5-03)); acquisto durante la prova con primo addebito alla sua fine, provato con Test Clock ([M5-04](#m5-04)). Webhook Stripe e riconciliazione periodica qualificati sul test: una copertura per fattura pagata, Free subito al rinnovo non pagato e prezzo protetto sette giorni ([M5-05](#m5-05)). Negozio attivo del Free con conservazione al downgrade, cambio di periodicità alla scadenza, Portal e avviso allo scollegamento collaudati sul test; cambio di periodicità e di metodo su un abbonamento Managed Payments pagato si verificano al passaggio al live con [M9-01](#m9-01) ([M5-06](#m5-06)). Rimborso totale e disputa persa revocano la sola copertura pagata, con cancellazione tramite Link e stop dei rinnovi, collaudati sul test con abbonamenti, dispute e lifetime ([M5-08](#m5-08)). Collegamento Telegram con deep link monouso, cambio chat e preferenze collaudato sul test con il bot del test ([M5-09](#m5-09)). Inattività del Free con preavviso e ripresa, lista d'attesa e acquisti sospesi dagli interruttori di D1 ([M5-11](#m5-11)). Stripe e generatori di diritti qualificati preliminarmente; billing reale, ciclo commerciale e invii Telegram da integrare. Checkpoint live in attesa. |
| [M6](#m6) | Da completare | Generatori export e sito pubblico minimo disponibili; export autenticato, cancellazione account, console, supporto, sito completo e KPI da integrare. |
| [M7](#m7) | Da completare | Tooling di pubblicazione e prove locali disponibili; qualifiche remote, hardening, legali, capacità e recovery readiness da chiudere. |
| [M8](#m8) | Da completare | RC, merchant e prove reali autorizzate ancora da preparare; checkpoint in attesa. |
| [M9](#m9) | Da completare | Go-live non autorizzato; gate Production sotto ancora aperti. |

Una milestone chiusa non riceve nuovi compiti o criteri di completamento. Integrazioni e verifiche successive si assegnano a milestone ancora aperte; i riferimenti a task chiusi indicano soltanto capacità già disponibili come prerequisiti, senza riaprirli o modificarne il perimetro concluso.

<a id="questioni-aperte"></a>
### Questioni aperte e ripresa

Conservare soltanto pendenze che cambiano una decisione, impediscono una prova o richiedono di riconciliare un effetto remoto. Chiuderle o rimuoverle con il prossimo intervento pertinente, senza accumulare il diario delle prove riuscite. Il prossimo lavoro di integrazione è M5; le prove eBay reali rinviate da M2/M3 e le qualifiche della pubblicazione non vanno attribuite a un test sintetico.

| Ambito | Pendenza e condizione di chiusura |
|---|---|
| Dipendenze dei tool | `braces` 3.0.3 arriva da shadcn tramite `fast-glob` e `micromatch`, soltanto nello sviluppo. L'[avviso GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) segnala esaurimento dello stack con pattern annidati e non indica una versione corretta. Chiudere con una release corretta e qualificata della catena; non sopprimere l'avviso nell'audit. `vitest` e `@vitest/coverage-istanbul` restano a 5.0.3: con 5.0.4 e 5.0.5 il dry-run di Stryker sul pool Cloudflare termina il worker e nessuna partizione mutation di quei file produce un report. Aggiornarli soltanto a una versione che superi la mutation di un file Cloudflare. |
| Integrazione dell'anteprima nell'app reale | D176/D179: [M4](#m4) integra interfaccia e preferenze, con il vocabolario del [§9](#s09) già comune agli Ordini ([M4-01](#m4-01)); [M5](#m5)/[M6](#m6) completano servizi e stati pertinenti. Ogni task verifica i percorsi reali secondo [§35](#s35). [M7-08](#m7-08) chiude integrazione, copertura e rimozione del codice superfluo prima della RC, mantenendo scenari grafici sul test ed esclusione dalla Production. |
| Pagina Ordini reale | Gli ordini rimasti senza esito fiscale dopo la rilettura della migration `0028_order_tax_recheck.sql` risultano letture da riprovare. |
| Qualifica del ciclo | D172 integrata con [#337](https://github.com/max23468/FiscalBay/pull/337): controllo della base, automerge, riuso dell'artefatto fra PR e merge, deploy test e readback provider qualificati. La prima qualifica senza promozione su `develop` ha superato le due build e le otto partizioni browser, ma ha bloccato la certificazione per superstiti e timeout mutation; con D173 un test bloccato da un mutante cade sul timeout di Vitest prima di quello di Stryker, che dipendeva dal carico. Completare il collaudo delle correzioni di copertura e del runner Cloudflare, poi verificare certificazione `candidate-<tree>`, riuso delle ricevute e ripresa sullo stesso candidato. [M7-06](#m7-06) e i checkpoint Production restano aperti. |
| CI alleggerita | D190: i job browser nel container ufficiale di Playwright sono verdi dalla [run del 2026-10-25](https://github.com/max23468/FiscalBay/actions/runs/40199642453). Con `develop` branch predefinito ([D200](DECISION_REGISTER.md)) la campagna mutation settimanale e l'avvio manuale partono senza attendere il primo `Promuovi`. L'ultima campagna, del [2026-10-24](https://github.com/max23468/FiscalBay/actions/runs/40102026330), è fallita per mutanti sopravvissuti o in timeout in `grants.server.ts`, `orders.server.ts`, `order-sync.server.ts` e `webhooks.server.ts`. Chiudere con la prima campagna settimanale riuscita. |
| Configurazione Stripe | Sandbox del test (2026-10-24): listino unico con i prezzi duplicati della copia iniziale archiviati, impostazioni fiscali predefinite nette con il codice del prodotto, portale clienti con disdetta a fine periodo, senza cambio piano immediato con conguaglio contrario al [§6.2](#s06) e con termini, privacy e ritorno del test. Restano dalla dashboard, nella sandbox: sito, email e telefono di assistenza ancora sui valori fittizi di Stripe e indirizzi di termini e privacy del checkout. Account live, letto senza modifiche: prodotto e tre prezzi conformi, metodi di Managed Payments limitati a carta, Link, Apple Pay e Google Pay, nessun webhook; nel profilo pubblico dell'account nome commerciale, sito e contatti di assistenza sono vuoti e il checkout ricavava altrove il nome «Temisfera»; per [M5-12](#m5-12) servono nome pubblico «FiscalBay», sito e contatti di assistenza con `supporto@fiscalbay.it`, impostazioni fiscali predefinite nette, termini, privacy e ritorno nel portale e la verifica dei dati della sede fiscale che possono comparire nei documenti. Il prodotto e i prezzi una tantum del primo periodo usati prima di D194 sono archiviati. Nella sandbox Smart Retries riprova entro una settimana e poi annulla l'abbonamento; per il live servono gli stessi tentativi, l'endpoint webhook e una chiave con limitazioni al posto della chiave segreta standard usata dal test. |
| Ingresso webhook | [M3-11](#m3-11) qualificato sul test. Sottoscrivere `ORDER_CONFIRMATION` di un negozio Production soltanto con il test merchant. Stripe attivo sul test con [M5-05](#m5-05); l'endpoint live e il suo segreto si configurano con [M5-12](#m5-12). Telegram attivo sul test con [M5-09](#m5-09); il bot Production `fiscalbay_bot` riceve token, segreto e webhook soltanto nel mandato Production e a 1.x spenta, perché la 1.x legge il bot con il long polling e cancella il webhook a ogni avvio. |
| Pubblicazione | Percorsi `cf` qualificati sul provider test: migration su D1 temporanea in UE con errore e ripresa, ripresa senza ricevuta e fra tentativi CI, rollback compatibile e ripristino del candidato secondo [RELEASE](engineering/RELEASE.md#qualifica-sul-provider-test). Prove e collaudo remoto nella [run di #335](https://github.com/max23468/FiscalBay/actions/runs/38357985449/attempts/2). Le nuove migration sui dati applicativi si collaudano nella PR che le introduce; il recovery dei dati resta distinto. Modalità `prova` del workflow Production ancora da eseguire sul candidato autorizzato; creare `CHANGELOG.md` prima della pubblicazione reale. Il riuso mutation è stato osservato in [#298](https://github.com/max23468/FiscalBay/pull/298); resta la riconciliazione del deploy successivo. |
| Consenso eBay | La rotazione di `BETTER_AUTH_SECRET` richiede il ricollegamento dei negozi: un token che non si apre più chiude il consenso alla prima lettura o al primo rinnovo e il negozio risulta da ricollegare. Pagina di consenso: senza «Display Title» eBay mostra il nome dell'account sviluppatore. Sul RuName Sandbox (2026-10-08) nome FiscalBay, privacy e termini del sito test, branding con logo orizzontale; il link «terms of service» resta vuoto perché il portale non ha un campo per i termini, che compaiono solo come «About URL» sotto il logo. Prima delle prove Production replicare sul RuName Production con le pagine di fiscalbay.it. Il collegamento chiede `locale=it-IT` per accesso e consenso in italiano. |
| Sandbox e dati fiscali | Sul test la Sandbox è spenta dal 2026-10-24 su richiesta dell'owner (`EBAY_SANDBOX_ENABLED` a `false`), così le pagine reali coincidono con l'anteprima; segreti e configurazione restano e si riattiva soltanto su sua indicazione. Supporto Sandbox distribuito con [#273](https://github.com/max23468/FiscalBay/pull/273), migration e smoke attestati dalla [run di #274](https://github.com/max23468/FiscalBay/actions/runs/37377929129). I pagamenti Sandbox provati sono falliti; l'alternativa `CashOnPickup` è stata rimossa da eBay per managed payments e l'acquisto confermato resta non pagato, assente da Fulfillment. Buy API esclusa dall'owner. Serve pagamento Sandbox riuscito e importazione, oppure soluzione concordata. La consultazione Production autorizzata è stata qualificata sul campione fiscale di [M3-10](#m3-10); non prova il pagamento o l'import Sandbox. Nessun permesso implicito di modificare ordini Production o introdurre import Trading. |
| Login eBay | Prove reali su Production in M8 (D160), con checklist sotto. Il readback D1 del 2026-10-06 attesta un'identità eBay collegata all'utente owner con password/Google; la precedente registrazione descriveva un utente separato non verificato. Discrepanza non risolta: non vale come prova di linking. Keyset e RuName non riletti dal portale Developers. |
| Identità e admin | Collaudo passkey fisico Safari/iOS dichiarato positivo dall'owner il 2026-09-29, senza dispositivo/versione specificati; cambio email remoto escluso dall'owner il 2026-09-30, prove locali conservate. MFA admin provata con asserzioni sintetiche: quando serve la console, scegliere account owner, registrare due passkey indipendenti e concedere il ruolo secondo §7. |
| Protezioni della zona | HSTS/header, WAF/rate limit edge, report DMARC e alert certificati inclusi nel piano con D168, da configurare e qualificare in [M7-12](#m7-12). DNS e risposte pubbliche non attestano impostazioni WAF, destinatari degli alert o piano della zona: servono inventario e readback provider prima della RC. Nessuna attivazione remota attestata dalla revisione documentale. |
| Piano e costi | Workers Paid continuativo e invio email con Cloudflare Email Service decisi dall'owner il 2026-10-12, con rinnovo già effettuato (D169). Misura dello stesso giorno sugli ultimi 7 giorni: dopo D167 il cron FiscalBay supera ancora i 10 ms in ogni esecuzione (mediana 33 ms) e il Worker di Production di CF Ready in circa una richiesta su dieci. Coda e DLQ del test ricreate in UE a 14 giorni il 2026-10-13 con readback di giurisdizione, retention, produttore e consumer (D171); le versioni test precedenti non sono più distribuibili. Quelle di Production nascono in UE a 14 giorni secondo la [pubblicazione](engineering/RELEASE.md#webhook). Da configurare: Logpush in [M7-11](#m7-11), avvisi di consumo e di budget dell'account in [M7-03](#m7-03); recapito dell'invio qualificato in [M6-06](#m6-06) prima della registrazione pubblica. Rileggere quote condivise e prezzi Observability in vigore dal 1° dicembre 2026 prima dell'apertura. Dalle 22:00 UTC del 2026-10-11 alle 08:00 UTC del 2026-10-12 il cron del test ha ricevuto due o tre invocazioni per slot, con orari pianificati distinti a pochi secondi di distanza; dalle 08:30 UTC le invocazioni sono di nuovo singole con la stessa versione del codice e anche dopo il passaggio a 10 minuti. Nessuna segnalazione a Cloudflare: lo smistamento resta idempotente rispetto a invocazioni ripetute ([M3-12](#m3-12)). Le misure M0 non autorizzano capacità pubblica né costi oltre il canone. |
| CLI Cloudflare | Migrazione a `cf` con D170: primo deploy test, readback, annotazioni di versione e conservazione dei segreti confermati dalla [run di #332](https://github.com/max23468/FiscalBay/actions/runs/38314516889). CLI migration qualificata su D1 temporanea in UE, ripresa e rollback compatibile qualificati sul Worker test secondo la [procedura](engineering/RELEASE.md#qualifica-sul-provider-test); il primo deploy Production con `cf` avviene con `Promuovi`. La versione fissata di `cf` supporta `--mode` per React Router; la patch residua limita la rilevazione al pacchetto corrente nella radice del workspace; i gate applicativi compilano pagina provvisoria, `live` e test, lasciando come artefatto finale quello test. Rimuovere la patch quando una versione qualificata di `cf` corregge il rilevamento dei workspace, il collegamento `build/client` in `vite.config.ts` quando plugin Vite 2.x e React Router concordano sulla cartella client, e `scripts/local-d1.mjs` quando `cf --local` termina da solo ([cloudflare/cf#64](https://github.com/cloudflare/cf/issues/64)). La preview locale Production conserva `APP_ORIGIN` per verificare l'esclusione dell'anteprima senza cambiare l'artefatto. La pagina provvisoria è migrata a `placeholder/cloudflare.config.ts`, usa `cf` con il bundler Wrangler e viene rimossa al primo `Promuovi` 2.0. Aggiornare `cf` e plugin solo a versioni esatte riprovate. |
| Cutover provider | OAuth Production sul keyset `botCF` salvato ma disattivato: sul keyset un solo RuName può averlo attivo ed è quello del test. Scegliere al cutover fra keyset dedicato al test e perdita del login eBay sul test. Non modificare `botCF 2` (SyncBay) o il callback condiviso con Hub Fatture. Branding finale Checkout ancora da osservare. |
| Dati e risorse di prova | Eliminare prima del go-live utenti e dati reali controllati nella D1 di test, compresi ordine e identificativo fiscale ratificati dall'owner il 2026-09-23, e la copia recuperabile con Time Travel. Account sintetico di collaudo ammesso solo nel test. Better Auth Infrastructure rimosso dal runtime (D152), progetto Starter residuo da eliminare se inutile; Supabase escluso già eliminato. Inventario privato fuori checkout: `FiscalBay/m0-inventory`. |
| Legacy 1.x | Ultimo inventario registrato: VPS `fiscalbay-bot`, checkout `/opt/fiscalbay`, autodeploy disabilitato; bot `fiscalbay-bot`, callback `fiscalbay-oauth` e timer `reconcile`, `alertcheck`, `external-healthcheck`, `backup`, `log-maintenance`, `restore-drill`, `duckdns` ancora operativi. Owner responsabile del cutover: callback cancellazione 2.0 e consumatore Hub Fatture coordinati in M7, poller fermato prima del webhook bot live, dismissione conclusiva in M9. Nessuno spegnimento attestato da questa migrazione. |

<a id="m0"></a>

### M0 · Qualificazione tecnica e transizione delle fondamenta

**Prerequisiti:** approvazione del piano e avvio esplicito; accessi necessari, inventario 1.x e risorse condivise. **Attività:** disinnescare workflow/assunti legacy incompatibili senza danni; preparare tooling, autorizzazioni preliminari, endpoint/email minimi di test; censire fonti; qualificare G-INFRA/AUTH/EBAY/STRIPE/DATA/EXPORT/RECOVERY/STACK e vincoli legali preliminari; setup agenti; vertical slice minimale; misure e scenario sostenibilità. Nessuna transazione live indiscriminata o modifica ai progetti vicini.

**Output:** memo decisionale del candidato selezionato con alternative scartate, costi/quote residue, responsabilità, ADR solo se necessari, matrice API, versioni congelate, slice riproducibile e gate evidenziati. Nessun adapter completo delle alternative scartate. **DoD:** ogni requisito critico ha esito/prova/limite; nessun impedimento nascosto; via owner a scelta/costi. Fonti insufficienti non diventano «PASS».

**Assetto approvato:** Workers, una D1 UE, Queues e Better Auth; Supabase Pro escluso per budget e Free per continuità insufficiente. Nessun adapter alternativo mantenuto. Protezione nativa Time Travel e riapertura fail-closed secondo §32; nessun backup parallelo. Il progetto Better Auth Infrastructure non è più collegato al runtime dopo D152. Generatori OAS ammessi solo se supportano TypeScript 7 senza secondo compilatore: finché manca tale compatibilità, schemi Zod mirati per Identity/Fulfillment, parser Trading e SDK Stripe ufficiale (§25).

**Esiti di qualifica utili alle milestone successive.** Misure di settembre 2026 sull'account Cloudflare condiviso e su dati sintetici: sono riferimenti per decidere, non capienza pubblica approvata, e vanno rimisurate prima dell'apertura (M7-03).

| Area | Esito misurato | Conseguenza |
|---|---|---|
| Limiti Free | Workers: 100.000 richieste dinamiche/giorno, 10 ms CPU e 50 subrequest per invocazione, 200.000 eventi log/giorno. Queues: 10.000 operazioni/giorno, retention 24 ore. D1: 5 milioni di righe lette e 100.000 scritte/giorno, 500 MB per database | L'account è condiviso con altri progetti: il margine residuo si rilegge prima della sync continuativa e dell'apertura |
| Coda e sync | Con un messaggio per ciclo, tre operazioni per messaggio, 48 cicli/giorno Free e 144 Premium, la soglia prudenziale di 8.000 operazioni copre 55 negozi tutti Free, 18 tutti Premium o 33 nel mix un Premium ogni due Free (69, 23 e 39 ai limiti nominali). 150 negozi richiedono circa 36.000 operazioni/giorno prima dei retry | La Queue è il primo limite del Free: evitare messaggi per polling senza lavoro (M3-04) e rivalutare il piano prima dell'apertura |
| D1 | 150 negozi, 70.000 ordini, 210.000 articoli, 84.000 identificativi e 14.000 grant: 44,8 MB, caricamento in 830 ms. Pagina da 50 ordini con grant: 996 righe lette, 11,4 ms a freddo e 0,6-1,8 ms dopo. Burst di 30.000 raw: 90.000 righe scritte in 395 ms; picco con raw attivi e scaduti 130,6 MB; pruning TTL di 30.000 raw in 128 ms | Lo storage regge circa 459 negozi entro 400 MB prudenziali, prima di eBay, CPU e retry. Un backfill pieno supera la soglia Free di 80.000 scritture/giorno: va distribuito (M3-03) |
| Costo Paid | Workers Paid da 5 USD/mese per account con 10 milioni di richieste e 30 milioni di CPU-ms; circa 1,08 milioni di operazioni Queue/mese per 360.000 messaggi, circa 0,03 USD oltre l'incluso | Ordine di costo indicativo di circa 5 USD/mese prima di retry ed email; decisione al checkpoint competente |
| Export | `exceljs` e `fflate` (MIT) in Workerd: 1.000 ordini con due identificativi in 81 ms | Percorso CSV/XLSX/ZIP fattibile nel runtime (M6-01..M6-03) |
| Recovery | D1 Time Travel: 7 giorni sul Free, 30 sul Paid. Restore sintetico dopo un bookmark riuscito, migration conservate | Superare i 7 giorni richiede di rivalutare il piano; drill conclusivo in M9-02 |

<a id="m0-01"></a>
#### M0-01 · Inventario della baseline e conflitti legacy

**Stato:** Completato · **Prerequisiti:** Avvio autorizzato · **Contratto:** [§0](#s00) · [§2](#s02) · [§34](#s34)

Seguire la [procedura di adozione](archive/2026-09-adozione-2.0.md), verificare l’integrità iniziale e le istruzioni/automazioni pertinenti (AGENTS, README, workflow, main, autodeploy e keyset condivisi); individuare cosa deve essere dismesso/allineato senza spostare gli altri progetti.

**Criterio di completamento:** Adozione locale e istruzioni 2.0 verificate; inventario dei trigger e regola di blocco per ogni effetto remoto non ancora qualificato. Questo chiude il prerequisito delle attività locali indipendenti, non autorizza push/merge: prima di quei passaggi occorre attestare che le automazioni legacy non possano attivare il vecchio deploy. Un accesso remoto mancante resta un blocco circoscritto registrato nelle questioni aperte, senza dichiarare dismessa la 1.x. Nessun checkpoint owner aggiuntivo.

<a id="m0-02"></a>
#### M0-02 · Bootstrap delle prove, agenti e custodia privata

**Stato:** Completato · **Prerequisiti:** M0-01, M0-11 · **Contratto:** [§33](#s33)

Configurare accessi minimi e inventario privato; preparare solo l’endpoint test HTTPS/callback e il trasporto email Auth necessari alla qualifica, su risorse autorizzate. Prima dell’acquisizione reale verificare il relativo perimetro di trattamento; applicare la qualifica tool proporzionata al rischio e riusare prove condivise fra CLI/MCP. M1-08 completa la configurazione, non è il primo momento in cui un login può essere provato.

**Criterio di completamento:** Prerequisiti di prova osservabili: endpoint/TLS, destinatario email controllato, account/ambiente corretti, autorizzazioni e lista tool. Mancanze segnate BLOCKED; nessuna spesa, PII pubblica o scrittura estranea. Le prove eseguibili usano la toolchain qualificata in M0-11.

<a id="m0-03"></a>
#### M0-03 · Inventario risorse Cloudflare/Supabase

**Stato:** Completato · **Prerequisiti:** M0-01; accessi di lettura pertinenti (non callback/email) · **Contratto:** [§25](#s25) · [§36](#s36)

Leggere piani, quote e consumi degli account pertinenti, inclusi altri progetti; separare capacità nominale da residua e individuare costi nuovi.

**Criterio di completamento:** Misure/fonti per CPU, DB, file, queue, egress, auth, email e log; nessun canone dato per già pagato o gratuito senza evidenza.

<a id="m0-04"></a>
#### M0-04 · Qualifica dei quattro accessi

**Stato:** Completato · **Prerequisiti:** M0-02, M0-11 · **Contratto:** [§7](#s07) · [§36](#s36)

Escludere documentalmente candidati incompatibili; sul candidato preferito provare email/password, Google, eBay e passkey con linking, recupero e revoca. La MFA amministrativa resta assegnata a M2-04 e non è un gate M0. Un secondo spike Auth è necessario solo se resta un’incertezza determinante. Non costruire quattro schermate definitive per ogni provider.

**Criterio di completamento:** Matrice pass/fail con prove e limiti; nessun secondo layer nascosto o metodo eliminato per comodità.

<a id="m0-05"></a>
#### M0-05 · Qualifica fonti eBay e keyset

**Stato:** Completato · **Prerequisiti:** M0-02, M0-11 · **Contratto:** [§9](#s09) · [§11](#s11) · [§36](#s36)

Verificare OAuth seller/Identity, scope, ID stabili, getOrders/getOrder/Trading necessarie, età campi, mascheramenti, immagini e ordini non pagati.

**Criterio di completamento:** Matrice fonte-campo-età-stato, condizioni autorizzate, quote effettive; fixture sanitizzate e test read-only autorizzati.

<a id="m0-06"></a>
#### M0-06 · Qualifica eventi, polling e lavoro API

**Stato:** Completato · **Prerequisiti:** M0-05 · **Contratto:** [§11](#s11) · [§36](#s36)

Misurare strategia incrementale, disponibilità eventi utili, manuale, 10/30min, backfill, retry e vincoli keyset condivisi.

**Criterio di completamento:** Budget chiamate/messaggi realistico con margine, eventi non presunti, nessuna invasione quote altrui.

<a id="m0-07"></a>
#### M0-07 · Schema rappresentativo e concorrenza

**Stato:** Completato · **Prerequisiti:** M0-03, M0-05, M0-11 · **Contratto:** [§27](#s27) · [§36](#s36)

Misurare sul candidato credibile un dataset sintetico rappresentativo di 70.000+ ordini con articoli, dati fiscali, grant/cicli e telemetria effettivamente necessaria. Niente tabella per ogni concetto o copia di ogni polling; misurare spazio, indici, query, isolamento e consumi.

**Criterio di completamento:** Dati misurati più scenari picchi/multistore/retention; test consumo atomico e privacy senza record reali pubblici.

<a id="m0-08"></a>
#### M0-08 · Qualifica Stripe Managed Payments

**Stato:** Completato · **Prerequisiti:** M0-02, M0-11 · **Contratto:** [§6](#s06) · [§36](#s36)

Leggere eligibility effettiva, copertura fiscale, capabilities checkout/portal/Link, prezzi/metodi e testare i casi commerciali critici.

**Criterio di completamento:** Matrice commerciale con esito e ambito docs/sandbox/live per ogni caso; prove non supportate dal sandbox assegnate esplicitamente al gate finale, senza falso PASS. MoR effettivo verificato, nessun Payments standard o Paddle senza owner.

<a id="m0-09"></a>
#### M0-09 · Recovery nativa e limiti

**Stato:** Completato · **Prerequisiti:** M0-03, M0-04, M0-07 · **Contratto:** [§32](#s32) · [§36](#s36)

Verificare le protezioni native dei candidati ancora ammissibili; approfondire il percorso dati/Auth/grant/file/config/chiavi del candidato migliore e i costi. Nessun restore completo su ogni alternativa: l’unico drill conclusivo rimane pre-go-live.

**Criterio di completamento:** Meccanismo nativo, finestra, costo, limiti e percorso fail-closed qualificati quanto basta per scegliere l'architettura. Free senza recovery non viene promosso. Una prova tecnica circoscritta può dimostrare la fattibilità, ma non sostituisce né anticipa il drill conclusivo sul candidato finale.

<a id="m0-10"></a>
#### M0-10 · Qualifica export e runtime

**Stato:** Completato · **Prerequisiti:** M0-07 · **Contratto:** [§12](#s12) · [§26](#s26)

Qualificare un percorso minimo CSV/XLSX/ZIP sul candidato runtime, con memoria, durata, tipi e licenze; confrontare un’altra libreria soltanto se il percorso non basta. Non costruire già il sistema export completo per ogni stack.

**Criterio di completamento:** Almeno un percorso sicuro fattibile per ogni formato promesso; libreria scelta se utile, nessun taglio di XLSX.

<a id="m0-11"></a>
#### M0-11 · Toolchain latest stable riproducibile

**Stato:** Completato · **Prerequisiti:** M0-01 · **Contratto:** [§26](#s26) · [§34](#s34)

Qualificare localmente Node/TS/pnpm/ReactRouter/Vite/lint/test/CLI e una baseline eseguibile minima. Nessun endpoint/provider già configurato è prerequisito. Le integrazioni specifiche e i generatori OAS vengono verificati nei task pertinenti e riallineati prima del memo M0-14; congelare i pin effettivamente qualificati, senza presumere scelto il runtime finale.

**Criterio di completamento:** Install pulita e smoke di typecheck/build/test passano nell’ambiente locale/runner controllato; M0-04..M0-10 completano la compatibilità dei candidati esterni. Eccezioni latest motivate, non assunte.

<a id="m0-12"></a>
#### M0-12 · Consolidamento dei vincoli legali preliminari

**Stato:** Completato · **Prerequisiti:** M0-04, M0-05, M0-08 · **Contratto:** [§29](#s29) · [§30](#s30)

Mappare ruoli dati, uso Codex necessario, copertura MoR, obblighi italiani residui, eBay marchi/retention e licenze legacy.

**Criterio di completamento:** Nessun blocco legale ignorato prima di dati reali; deliverable pubblico/privato distinti e attività di chiusura assegnate.

<a id="m0-13"></a>
#### M0-13 · Vertical slice end-to-end

**Stato:** Completato · **Prerequisiti:** M0-04, M0-05, M0-07, M0-11, M0-12 · **Contratto:** [§36](#s36)

Sul candidato migliore: login→link seller→ordine→DB→pagina minima, con permessi e timestamp coerenti. Non implementare più prodotti paralleli; un’ulteriore slice richiede un problema concreto o un confronto ancora irrisolto.

**Criterio di completamento:** Flusso osservato con risorsa e commit identificati, errori gestiti e nessun segreto nel client; setup e trattamento dati già qualificati, non aggiunti retroattivamente.

**Limite:** il consenso OAuth seller 2.0 e il suo callback sono provati da test locali, non dal vivo: la prova live passa a [M2-05](#m2-05), insieme a storage cifrato e rinnovo del token. Sign in with eBay è in [M2-09](#m2-09).

<a id="m0-14"></a>
#### M0-14 · Memo di scelta e via owner

**Stato:** Completato · **Prerequisiti:** M0-03..M0-13 · **Contratto:** [§25](#s25) · [§36](#s36) · [§37](#s37)

Confrontare costo/complessità/capacità/Auth/recovery/jobs/lock-in, scegliere un assetto e separazione responsabilità, ADR limitati ai nodi stabili.

**Criterio di completamento:** Gate preliminari con esito, ambito e prova; prove ammissibili solo più avanti assegnate a task/checkpoint e non dichiarate completate. Owner approva architettura/costi e rischi derogabili; incompatibilità già dimostrate o obblighi inderogabili restano bloccanti.

**Stato residuo:** tutte le prove tecniche M0 sono chiuse o assegnate in modo esplicito a task successivi: Sign in with eBay a M2-09 con prove reali in M8, consenso seller live e token a M2-05, MFA amministrativa a M2-04, runbook e drill di recovery al pre go-live. Better Auth Infrastructure è stato rimosso dal runtime con D152; M7-07 qualifica i fornitori effettivamente usati. Il readback Free dopo un eventuale cambio di piano resta differito alla scelta dell'owner. L'invio email a utenti arbitrari richiede un trasporto qualificato secondo §14 e M6-06, senza imporre Cloudflare Paid alle alternative ammesse. Su richiesta owner il progetto Supabase Free `FiscalBay` del candidato escluso è stato eliminato il 2026-09-23; la rilettura mostra intatti i progetti SyncBay e Pratix. Il via owner di fine M0 è registrato il 2026-09-23 nel registro dei via.

<a id="m1"></a>
### M1 · Fondazioni applicative e design

**Prerequisiti:** M0 e scelte approvate per l’implementazione dipendente; preparazione grafica/copy indipendente può anticipare. **Attività:** cutover controllato che rende canonico l’albero 2.0 e congela la 1.x in un riferimento Git separato, senza confonderlo con la dismissione remota; monorepo minimo, CI/local dev/test, migration iniziale, confini tenant/AuthZ, logging redatto, errore/i18n, top nav/shell, tema/tokens; rifinitura manuale/vettoriale Concept 4 e asset; completamento di DNS/TLS/test e posta già avviati limitatamente ai prerequisiti M0; prototipo approvabile dei tre schermi e stati.

**Output:** repository con una sola implementazione e documentazione canonica 2.0, foundation eseguibile, brand foundation e inventario componenti scelti realmente, pipeline test, struttura dati iniziale. **DoD:** riferimento 1.x recuperabile, merge incapace di avviare il deploy legacy, componenti 1.x ancora live censiti fino al loro cutover operativo; approvazione owner logo/design system; test authz/shell/IT-EN/theme verdi; asset non inventano funzioni; ambiente test separato. No UI provvisoria massiva da rifare in M4.

<a id="m1-00"></a>
#### M1-00 · Cutover repository 1.x → 2.0

**Stato:** Completato · **Prerequisiti:** M0-14 completata e via owner di fine M0 · **Contratto:** [§33](#s33) · [§34](#s34)

Rendere la 2.0 canonica nell'albero attivo con un diff controllato di istruzioni di progetto, documentazione, codice, test, dipendenze, toolchain e CI. Congelare la 1.x in un riferimento Git identificabile per la sola manutenzione residua, senza mantenere due implementazioni o due fonti canoniche in `main`.

Prima dell'integrazione riconciliare i commit sopraggiunti sulla 1.x e rileggere hook, workflow, release script, timer e autodeploy. Disinnescare ogni percorso per cui il merge della 2.0 potrebbe distribuire il runtime 1.x. Conservare temporaneamente l'inventario operativo necessario a bot e callback ancora attivi, con proprietario e condizione di spegnimento espliciti: il cutover del repository non prova né implica la loro dismissione remota.

**Criterio di completamento:** Un checkout pulito presenta una sola implementazione e una sola documentazione canonica 2.0; la 1.x resta recuperabile dal riferimento Git dichiarato; nessun merge avvia il deploy legacy; componenti 1.x ancora live e successivo cutover operativo sono registrati senza duplicarne codice e istruzioni nell'albero attivo.

<a id="m1-01"></a>
#### M1-01 · Bootstrap monorepo e comandi comuni

**Stato:** Completato · **Prerequisiti:** M1-00 · **Contratto:** [§25](#s25) · [§26](#s26) · [§33](#s33)

Strutturare web/dominio/contratti/integrazioni/jobs/UI solo dove utile; script pnpm di controllo e manifest lockati.

**Criterio di completamento:** Checkout pulito installa e verifica; no dipendenze duplicate, output o backend Python richiesto dal nuovo runtime.

<a id="m1-02"></a>
#### M1-02 · Ambienti e CI fondamentale

**Stato:** Completato · **Prerequisiti:** M1-01 · **Contratto:** [§34](#s34)

Develop/main, PR test/lint/type/build, test deploy controllato; guardrail branch/credential e segreti ambienti separati.

**Criterio di completamento:** PR senza segreti eseguibile, test genera artefatto proprio; il merge main da solo non pubblica.

<a id="m1-03"></a>
#### M1-03 · Fondazioni DB, tenant e grant

**Stato:** Completato · **Prerequisiti:** M0, M1-01 · **Contratto:** [§27](#s27) · [§29](#s29)

Migration iniziale, chiavi/uniqueness, authz tenant/ordine, grant e transazioni; test concorrenza/rollback compatibile.

**Criterio di completamento:** Richieste tra workspace negate; ultimi sblocchi/lifetime non possono duplicarsi; migrazione verificata nel test.

<a id="m1-04"></a>
#### M1-04 · Errori, log e localizzazione

**Stato:** Completato · **Prerequisiti:** M1-01 · **Contratto:** [§26](#s26) · [§28](#s28) · [§31](#s31)

Registro errori tipizzato, correlationID, redazione, testi IT/EN e formatter UTC/locale (dizionari tipizzati da D149).

**Criterio di completamento:** Nessun CF/token nei log di errore; errori comprensibili in entrambe le lingue e retryability coerente.

<a id="m1-05"></a>
#### M1-05 · Logo 2.0

**Stato:** Completato · **Prerequisiti:** M0-01; mandato owner · **Contratto:** [§21](#s21)

Definire in vettoriale il logo 2.0 partendo dal Concept 4, con libertà di migliorarlo (D141): prima l'icona base generica, poi, dopo il via owner, wordmark con `Bay` blu, logo orizzontale, chiaro/scuro, monocromo, favicon e avatar Telegram.

**Criterio di completamento:** Icona base e varianti approvate dall'owner con prove a dimensioni piccole, fondo scuro e monocromo. Fino all'approvazione, usare sempre gli asset 1.0 su tutte le superfici, incluso Stripe. Dopo l’approvazione, sostituire il logo 1.0 provvisorio nel branding Google Auth e Stripe e aggiornare il logo dei keyset eBay pertinenti.

<a id="m1-06"></a>
#### M1-06 · Design system e catalogo candidati

**Stato:** Completato · **Prerequisiti:** M0, M1-05 · **Contratto:** [§22](#s22)

Esaminare i nove riferimenti nella fase frontend; scegliere componenti effettivi in base a funzione, licenza e qualità. Definire token, stati, form, icone e tipografia.

**Criterio di completamento:** Registro della provenienza e campione chiaro/scuro, IT/EN, tastiera e touch coerenti con il brief, senza kit sovrapposti.

<a id="m1-07"></a>
#### M1-07 · Shell e prototipo delle tre sezioni

**Stato:** Completato · **Prerequisiti:** M1-06 · **Contratto:** [§16](#s16) · [§17](#s17) · [§18](#s18) · [§19](#s19)

Realizzare top navigation desktop e bottom navigation mobile con tre destinazioni, ricerca, campanella e avatar. Prototipare Ordini a due schede, Negozi a lista e Impostazioni per categorie.

Aggiungere al prototipo esempi di problema con conseguenza/azione, supporto con diagnostica minima e ordini disponibili durante refresh. Riusare scenari sintetici del §35, includendo quota esaurita, errore fonte e dati discordanti; nessun dato demo nei percorsi reali.

**Criterio di completamento:** Approvazione dell’owner; mostrare anche testi lunghi, errori, quote e campi mancanti. I testi dei mockup non introducono nuove funzioni.

<a id="m1-08"></a>
#### M1-08 · Completamento DNS, ambienti e posta

**Stato:** Completato · **Prerequisiti:** M0 · **Contratto:** [§24](#s24)

Consolidare il bootstrap test predisposto in M0-02: DNS/TLS/redirect, configurazione Production, iCloud info/supporto e trasporto transazionale selezionato. Verificare inventario record, callback, SPF/DKIM/DMARC e isolamento; allineare i contatti dei provider alla regola email di [§14](#s14), incluso il branding Google OAuth; dismettere i record Register senza consumatori dopo il readback Cloudflare e non attivare servizi Register aggiuntivi.

**Criterio di completamento:** HTTP/TLS e callback test/live coerenti, posta umana e Auth provate, record attivi preservati o sostituiti con prova; nessun cookie/RP ID condiviso accidentalmente e nessun setup iniziale rinviato dopo il gate che lo richiedeva.

<a id="m1-09"></a>
#### M1-09 · Guardrail della pipeline e del repository

**Stato:** Completato · **Prerequisiti:** M1-02 · **Contratto:** [§34](#s34) · [§37](#s37)

Estende M1-02, già chiusa, con i guardrail ricavati da CF Ready e Hub Fatture: Action di terze parti pinnate a SHA completo con versione in commento e Dependabot allineato; guardia che accetta su `main` soltanto PR da `develop` dello stesso repository; classificazione dei file modificati (documentazione, test, runtime, tooling) che esegue il gate completo per ogni file non classificato e sostituisce l'attuale rilevamento docs-only; test di repository su sigle di milestone/task fuori dalla documentazione di piano, fixture solo con host `.invalid`, import applicativi aciclici, moduli server con almeno un consumatore e pin di Node/pnpm coincidenti fra `mise.toml`, `package.json` e workflow.

**Criterio di completamento:** Una PR verso `main` da una branch diversa da `develop` fallisce; un file fuori classificazione esegue il gate completo; ogni test di repository ha un caso negativo che fallisce davvero; nessun `uses:` di terze parti senza SHA. CI verde sul commit integrato.

<a id="m1-10"></a>
#### M1-10 · Budget di prestazioni e capacità al deploy

**Stato:** Completato · **Prerequisiti:** M1-02 · **Contratto:** [§22](#s22) · [§31](#s31) · [§37](#s37)

**Per chiudere:** M1-06; il budget del bundle si misura sul design system effettivo.

Aggiungere alla build il controllo del JavaScript client entro il budget gzip dichiarato nel repository (valore iniziale 350 KiB) e al deploy test il controllo CPU: traffico sintetico marcato, raccolta via tail delle sole invocazioni marcate, fallimento sopra il p95 ammesso o con errori, rollback del deploy test. Nessun traffico verso eBay, Stripe o Telegram.

**Criterio di completamento:** Un bundle oltre budget fa fallire la build; un deploy test con p95 oltre soglia o con errori fallisce e ripristina la versione precedente, provato almeno una volta con soglia forzata. Ricevuta con p95, numero di eventi e versione.

**Limite:** il controllo CPU al deploy test è stato rimosso con D158; resta bloccante il budget del bundle client, misurato per pagina dal D182 invece che sul totale iniziale di 350 KiB.

<a id="m2"></a>
### M2 · Account, Auth e Negozi eBay

**Prerequisiti:** foundation/Auth gate. **Attività:** quattro login, compresa l'integrazione di Sign in with eBay rinviata da M0 (prove reali in M8, D160), verifica email/linking, sessioni/reauth/MFA admin, profilo, OAuth login vs seller, connessioni/reconnect, pausa/scollega/elimina dati del negozio, unicità negozio/spazio, stati UI e reminder; instradamento utente autenticato/sito pubblico. La cancellazione dell'account si integra in M6 (D163).

**Output:** flusso utente e account completo e testabile. **DoD:** i percorsi positivi e negativi dei quattro accessi passano, per eBay con risposte sintetiche fino a M8; nessun trasferimento/merge improprio; segreti isolati; cronologie e azioni non approvate assenti.

**Verifica delle integrazioni:** callback seller e consenso reali, token cifrati/scadenze e rinnovo in background; replay senza doppio scambio e risposte tardive incapaci di ripristinare un consenso superato. Pausa manuale distinta da quella imposta dal piano; nessuna pausa ferma la retention. Scollegamento senza disdetta o reset dei benefici, eliminazione con nome verificato sul server e quota già consumata conservata. Le eccezioni assistite al vincolo Free dei 90 giorni si integrano in M5 insieme alla scelta del negozio attivo, per decisione owner del 2026-10-05.

**UI e routing:** elenco/pannello Negozi e Profilo da link diretto, ritorno e ricarica, mobile e testi lunghi; tipo di account registrato non modificato dal salvataggio del profilo. Frequenza, storico, aggiornamenti e azioni di sincronizzazione si mostrano quando M3 fornisce dati reali; notifiche per negozio quando M5 le integra. Root pubblica e area `/app` separate, visita esplicita del sito senza logout, IT/EN, nessun loop. Cache verificata con anonimo e due utenti, redirect/payload privati mai riusati; test/anteprima/area privata non indicizzati (§16, §23). Noindex non è un controllo d'accesso.

<a id="m2-01"></a>
#### M2-01 · Signup e verifica contatto

**Stato:** Completato · **Prerequisiti:** M1, G-AUTH · **Contratto:** [§7](#s07) · [§14](#s14)

Implementare login/signup email e Google, verifica richiesta prima eBay, opt-in facoltativo non bloccante.

**Criterio di completamento:** La registrazione apre la sessione solo dal link di conferma e non distingue un indirizzo già registrato; la sessione non verificata aperta con la password esplora ma non collega seller; nessun consenso preselezionato o dato fiscale obbligatorio.

<a id="m2-02"></a>
#### M2-02 · Passkey

**Stato:** Completato · **Prerequisiti:** M2-01 · **Contratto:** [§7](#s07)

Integrare il percorso passkey qualificato in M0, inclusi registrazione, recupero e revoca. Sign in with eBay è in [M2-09](#m2-09), così l'attesa del diritto eBay non ferma la catena Auth.

**Criterio di completamento:** La passkey funziona sui browser previsti. Un errore dell'autenticatore non produce un account attivato solo parzialmente.

<a id="m2-03"></a>
#### M2-03 · Linking e modifica identità

**Stato:** Completato · **Prerequisiti:** M2-01, M2-02 · **Contratto:** [§7](#s07) · [§29](#s29)

Collegare automaticamente solo identità con email verificata e affidabile. Consentire aggiunta e rimozione dei metodi, modifica email protetta e mantenimento di almeno un accesso valido.

**Criterio di completamento:** Test su registrazione preventiva abusiva, provider non attendibile ed email cambiata; nessuna fusione impropria di spazi né blocco dell’utente per rimozione dell’ultimo metodo.

<a id="m2-04"></a>
#### M2-04 · Sessioni e admin MFA

**Stato:** Completato · **Prerequisiti:** M2-03 · **Contratto:** [§7](#s07) · [§15](#s15)

Implementare durata e rotazione delle sessioni, elenco, revoche e nuova verifica per azioni sensibili. Proteggere l’admin con autorizzazione esplicita, MFA e recupero robusto.

**Criterio di completamento:** Logout singolo/globale e revoche effettivi anche sulle azioni sensibili; nessun metodo alternativo debole aggira la MFA amministrativa.

**Limiti:** la verifica dell'utente è provata con asserzioni sintetiche firmate, non con un autenticatore fisico; nessun account reale ha oggi il ruolo admin. Scegliere l'account owner, registrare due passkey indipendenti e concedere il ruolo restano passi da fare quando servirà l'area admin, secondo la procedura del [§7](#s07).

<a id="m2-05"></a>
#### M2-05 · OAuth negozi e identità stabile

**Stato:** Completato · **Prerequisiti:** M2-01, G-EBAY · **Contratto:** [§8](#s08) · [§29](#s29)

Implementare schermata preparatoria, callback e protezioni OAuth, token cifrati e identificatore stabile. Consentire una sola associazione del negozio a uno spazio.

Introdurre il confine HTTP minimo del §28 per le chiamate OAuth/Identity, con timeout, limite dei body e mapping degli errori provati. M3-02 lo riusa per gli ordini e M5-05 per Stripe, senza cambiare i contratti dei rispettivi provider.

**Criterio di completamento:** Replay e callback duplicate gestiti; nessuna informazione rivelata sullo spazio altrui. Un cambio di nome eBay non crea un nuovo negozio.

<a id="m2-06"></a>
#### M2-06 · Reconnect, pause e disconnessioni

**Stato:** Completato · **Prerequisiti:** M2-05 · **Contratto:** [§8](#s08)

Separare stato della connessione e della sincronizzazione. Implementare pausa, reconnect con riconciliazione recente, reminder per massimo 30 giorni, scollegamento ed eliminazione distinta.

Provare che una risposta iniziata prima del reconnect o dello scollegamento non ripristini uno stato superato; M3-04 completa la prova con sync e refresh concorrenti.

**Criterio di completamento:** Nessun reset di quota o diritti; scollegare non cancella l’abbonamento. Le eccezioni assistite al vincolo di sostituzione Free sono motivate e auditate, non un nuovo trial. Token e lavori pendenti incompatibili vengono invalidati.

<a id="m2-07"></a>
#### M2-07 · Schermata negozi e profilo

**Stato:** Completato · **Prerequisiti:** M2-04, M2-06 · **Contratto:** [§18](#s18) · [§19](#s19)

Realizzare elenco e pannello con URL del negozio, ultima sincronizzazione, frequenza prevista, storico e notifiche. Completare profilo minimo e scorciatoie a Sicurezza.

**Criterio di completamento:** Link diretto, ritorno, refresh e mobile funzionano; il piano è chiaramente dello spazio FiscalBay, non del singolo negozio.

<a id="m2-08"></a>
#### M2-08 · Routing pubblico autenticato

**Stato:** Completato · **Prerequisiti:** M2-01 · **Contratto:** [§16](#s16) · [§23](#s23)

Applicare il redirect dalla root all’app per l’utente autenticato, con comando esplicito per visitare il sito pubblico mantenendo la sessione. Gestire IT/EN.

**Criterio di completamento:** Nessun loop o logout forzato per leggere prezzi e FAQ; test e area riservata non sono esposti anonimamente né indicizzati.

<a id="m2-09"></a>
#### M2-09 · Qualifica e integrazione Sign in with eBay

**Stato:** Completato · **Prerequisiti:** M2-01; account eBay business controllato per la prova reale · **Contratto:** [§7](#s07) · [§36](#s36)

Qualifica rinviata da M0-04 per decisione owner del 2026-09-23: provare sul dominio di test login e linking eBay con lo scope Identity base (D153), poi integrarli con i percorsi di M2-03. Il consenso seller resta un flusso distinto (D048) ed è già provato in M0.

**Criterio di completamento:** Login eBay e linking integrati e provati in locale con risposte eBay sintetiche; nessun account attivato solo parzialmente, nessuna email simulata e nessun duplicato d'identità. Le prove reali sui browser previsti sono in [M8-03](#m8-03) (D160).

**Caso limite accettato:** Better Auth controlla l'email prima di cercare l'account già collegato, quindi un utente registrato con eBay business che passa a un account individuale non può più accedere con eBay; l'avviso lo indirizza agli altri metodi e il recupero password resta disponibile sull'email FiscalBay.

<a id="m3"></a>
### M3 · Sincronizzazione, ordini e modello fiscale

**Prerequisiti:** M2, G-EBAY/DATA. **Attività:** modelli/versioni, adapters, elenco/dettaglio, import recenti/storico, scheduler/eventi, priorità/coalescing/checkpoint/retry, classificazione dato, controlli formali, suggerimenti e conflitti, contratto sblocco atomico e grant iniziali.

**Output:** ordini consistenti, ricerca di base e pipeline riprendibile con fixture/live controllato. **DoD:** fonte/campo provati, nessun consumo su assenza, nessun leak o doppio ordine, cancellazione/retention rispettata dai job; nuovi ordini non bloccati dal backfill. Test sicurezza/contratti presenti prima della UI completa. Il calcolo diritti/cicli di base deve già essere testabile con fixture tipizzate e transazioni; M5 integra il motore con billing, calendario commerciale e provider reali. Non dichiarare «Free/Premium completo» soltanto per uno sblocco simulato.

**Fonti e modello:** importazioni multi-articolo idempotenti, importi esatti, UTC e snapshot non riscritti dall'anagrafica corrente; storia di tutte le variazioni fiscali effettive, senza versioni duplicate. Identità di riga riconciliata fra acquisti provvisori Trading e ordine definitivo: consolidare solo se tutte le righe appartengono allo stesso ordine; sovrapposizioni parziali, identità mancanti o più candidati restano anomalie. Cambio di ID senza perdita di grant, nuova quota o doppia notifica; fixture e prova reale controllata di ordine combinato se disponibile, altrimenti limite dichiarato. La riqualifica Fulfillment e la precedenza circoscritta approvata dall'owner sono in [§9](#s09) e [M3-10](#m3-10); Trading resta il fallback dei casi non qualificati, senza equivalenza generale dedotta dal campione.

**Contratto eBay qualificato preliminarmente:** Fulfillment lista/dettaglio fino a due anni, pagine fino a 200, PII mascherata oltre 90 giorni ed email buyer non disponibile dopo 14 giorni; acquisti pending-payment con pagamento anticipato assenti, ordini senza pagamento anticipato da classificare senza inventarne lo stato. Trading `GetOrders` ha finestra massima di 90 giorni e `BuyerTaxIdentifier` può non avere Paese emittente, che resta nullo. `legacyOrderId` eventuale non è chiave canonica. Immagini da Trading `GetItem` tramite `legacyItemId`, con domini/formati qualificati contro SSRF. Quote del keyset Production riconfermate il 2026-10-08 con `getRateLimits` della Developer Analytics API: Fulfillment 100.000 chiamate/giorno, Trading `GetOrders` e `GetItem` 5.000 ciascuna, condivise da tutto ciò che usa il keyset; la guida OAuth di eBay limita il grant `refresh_token` a 50.000 richieste/giorno per applicazione. Ogni lettura periodica di un negozio usa al massimo 12 chiamate, più un `GetStore` e un `GetUser` a settimana fuori budget (D186); la passata Trading dei modificati avviene al massimo ogni due ore (D177), cioè 12 `GetOrders` al giorno per negozio con qualsiasi piano, e la quota da 5.000 copre circa 400 negozi prima delle richieste manuali e delle letture fiscali di riserva per gli ordini senza CF Fulfillment. Fulfillment e i circa dodici rinnovi/giorno per negozio attivo restano molto sotto. Soglia di consumo e misura per l'apertura sono in [M7-03](#m7-03). Fixture per `c/o`, destinatario diverso dal buyer, telefono strutturato, campi assenti/inattesi; stato sconosciuto sicuro e provenienza conservata (§9, §28, §29).

**Ripresa e sblocco:** dettaglio e lavoro fiscale presi in carico in modo recuperabile prima di avanzare il watermark; interruzioni fra pagina, accodamento, commit e ACK senza salti o doppi effetti. Polling con overlap autorevole; `ORDER_CONFIRMATION` opzionale anticipa solo la verifica mirata e non blocca il polling se assente. Ingresso Worker condiviso per eventi eBay, Stripe, Telegram e cancellazione account: metodo/dimensione/firma sul corpo grezzo, claim D1, coda con soli riferimenti, ACK solo dopo accettazione, retry/DLQ nativi (§25). Nessun orchestratore parallelo; callback OAuth browser separate. Mutation su ingresso, isolamento, ultimo credito e scadenza dei grant. Accesso negato alla scadenza anche con pulizia sospesa; vecchi eventi/job non resuscitano raw, versioni, suggerimenti o dati eliminati (§30).

<a id="m3-01"></a>
#### M3-01 · Modello ordini, articoli e buyer

**Stato:** Completato · **Prerequisiti:** M2, G-DATA · **Contratto:** [§9](#s09) · [§27](#s27)

Implementare stato corrente e snapshot degli ordini, mapping delle chiavi esterne, importi esatti, UTC e dati fiscali separati. Mantenere articoli e buyer nel modello qualificato.

Provare identità provvisoria→definitiva e arrivo invertito Trading/Fulfillment tramite identità comprovate delle righe: UUID stabile, nessun duplicato o unione fra negozi, ambiguità esplicita. M3-06 verifica conservazione di grant e quota.

**Criterio di completamento:** Importazioni multi-articolo idempotenti; valori monetari precisi; modificare l’anagrafica corrente non riscrive lo storico dell’ordine.

Entità logiche accorpabili quando sicuro; mantenere dati correnti e snapshot dell’ordine senza duplicati a ogni sync. Lo storico di tutte le variazioni fiscali effettive resta richiesto.

**Limiti residui:** l'identità stabile ricavata da Fulfillment (articolo e riga) ha la forma di `OrderLineItemID` Trading ma non è provata su ordini combinati reali: senza coincidenza o un riferimento Trading dello stesso definitivo gli ordini restano distinti, mai uniti. Il consolidamento locale è descritto in M3-09; la rimozione autorevole di un identificativo si applica solo quando la fonte la dichiara, e la lettura Trading al collegamento non lo fa ancora (M3-05).

<a id="m3-02"></a>
#### M3-02 · Client eBay e normalizzazione

**Stato:** Completato · **Prerequisiti:** M3-01, G-EBAY · **Contratto:** [§11](#s11) · [§28](#s28)

Integrare client generati o adapter REST e Trading mirato, errori tipizzati, provenienza dei campi e stati normalizzati.

Riusare il confine HTTP di M2-05: timeout dell'intera lettura, limiti anche senza Content-Length, parsing e codici stabili con Retry-After. Aggiungere fixture per `c/o`, destinatario diverso dall'acquirente, telefono strutturato, campi assenti e inattesi; conservare originale/provenienza senza correggere l'intestatario fiscale.

**Criterio di completamento:** Contract test con fixture; stati sconosciuti non inventati; ordini pagati, non pagati e dati mascherati classificati correttamente.

Da M0: immagini articolo da Trading `GetItem` tramite `legacyItemId`, con domini e formati qualificati contro SSRF; nessun generatore OAS finché TypeScript 7 non espone un'API compatibile (M0-11).

Integrato da CF Ready e Hub Fatture: XML Trading rifiutato oltre limite, con byte NUL o con `DOCTYPE`/`ENTITY` prima del parsing; `next` e URL del provider accettati solo HTTPS sulla stessa origine API eBay dell'ambiente, altrimenti la pagina fallisce chiusa senza inviare il token. Contract test negativi per entrambi. La lettura Fulfillment conserva il marketplace dell'inserzione per [M3-10](#m3-10).

**Limiti residui:** codici d'errore Trading, risposta di `GetItem` e soglie di mascheramento (email 14 giorni, nome, telefono e prima riga dell'indirizzo 90) seguono la documentazione eBay e fixture sintetiche, senza una lettura reale. Un campo mascherato conserva il valore letto in precedenza; senza lettura precedente resta marcato come mascherato. Le immagini si salvano sulla riga ma la pagina Ordini le mostrerà con [M4-01](#m4-01); `GetItem` (5.000 chiamate/giorno) si chiama una volta per inserzione ancora senza immagine, nel dettaglio separato di [M3-03](#m3-03) ed entro il suo budget.

<a id="m3-03"></a>
#### M3-03 · Import recenti e backfill

**Stato:** Completato · **Prerequisiti:** M3-02 · **Contratto:** [§11](#s11)

Implementare paginazione, cursori, checkpoint, finestra di sovrapposizione e ripresa del backfill. Rendere disponibili prima gli ordini recenti e un avanzamento veritiero.

Estendere l'acquisizione condivisa già usata dal collegamento del negozio per recenti, backfill e richieste manuali, senza mantenere un secondo import dentro OAuth, con il lavoro fiscale separato e il salvataggio dell'ordine anche quando Trading fallisce durante il parsing.

**Criterio di completamento:** Interruzioni fra pagine recuperabili senza duplicati o salti; il backfill non impedisce l’acquisizione dei nuovi ordini.

Un'unica acquisizione per negozio serve collegamento e lavoro periodico: prima i recenti per data di modifica dal limite applicato con 15 minuti di sovrapposizione, poi lo storico per data di creazione nella finestra fissata al primo avvio, infine il dettaglio (rilettura dell'ordine, immagini mancanti e identificativi Trading) di ogni versione Fulfillment non ancora letta, anche quando cambia solo il dato fiscale. Ogni pagina si applica prima di salvarne il link `next`; il limite dei recenti avanza a passata conclusa e, se il totale di eBay cambia a metà, la passata ricomincia. Un errore del singolo ordine rimanda il dettaglio (15 minuti, 1, 4 e 16 ore, poi chiusura della versione con il codice); credenziali, limite o indisponibilità di eBay fermano l'esecuzione senza consumare tentativi. La quota esaurita di una singola chiamata Trading sospende solo quella chiamata (D177): senza `GetItem` le righe restano senza immagine, senza `GetOrders` la lettura fiscale di riserva resta in attesa. Un blocco di 15 minuti per negozio evita esecuzioni sovrapposte; le scritture restano legate al consenso. La schermata Negozi mostra la finestra dello storico, l'importazione in corso o completata e la sincronizzazione in corso mentre un'esecuzione tiene il negozio.

**Limiti residui:** filtri, paginazione con `next`/`total` e `getOrder` seguono la documentazione eBay e fixture sintetiche, senza lettura reale. Lo storico è di 30 giorni per tutti finché [M5](#m5) non estende la finestra Premium a un anno. Ogni lettura del negozio ha un budget di 12 chiamate eBay e 3 pagine; cadenza, priorità ed equità sono in [M3-04](#m3-04), lo smistamento in coda in [M3-12](#m3-12). Il dettaglio in attesa è derivato dalla versione registrata in D1, non da messaggi in coda. Al collegamento si leggono i recenti, la prima pagina Trading dei modificati, la prima pagina dello storico e il dettaglio dei primi ordini; il resto prosegue nel lavoro periodico.

<a id="m3-04"></a>
#### M3-04 · Scheduler, eventi e manuale

**Stato:** Completato · **Prerequisiti:** M3-03 · **Contratto:** [§11](#s11)

Implementare target 10/30 minuti, eventi qualificati con riconciliazione, priorità, concorrenza controllata ed equità. Unificare richieste manuali ripetute rispettando la quota del provider.

Provare risposte tardive fra sync, refresh e reconnect con revisione attesa o controllo atomico equivalente. Iniettare interruzioni fra acquisizione, accodamento, commit e ACK: presa in carico recuperabile, nessun evento perso o doppio effetto. Le verifiche fiscali rispettano anche la precedenza delle fonti.

**Criterio di completamento:** Test con clic ripetuti, backfill e processi concorrenti; eventi Free non ritardati artificiosamente e Retry-After rispettato. Nessun countdown inventato.

La schermata Negozi di M2-07 mostra frequenza prevista, storico, stato dell'import, ultimi aggiornamenti, «Sincronizza» e «Reimporta» dalla route reale.

**Implementazione:** cron ogni 10 minuti; un negozio è dovuto quando la sua ultima lettura dei recenti (`polled_at`, segnata anche se fallisce) ha l'età della cadenza del piano, Premium 10 e Free 30 minuti, con un minuto di margine. Ordine sotto carico: dovuti Premium, dovuti Free, poi negozi con storico, passata o dettagli arretrati la cui ultima lettura è riuscita (Premium, poi Free); a parità prima la richiesta manuale e poi il negozio letto meno di recente. Finché non esistono gli abbonamenti ogni spazio è Free. Gli eventi `ORDER_CONFIRMATION` non dipendono da piano né cadenza e non spostano il turno. «Sincronizza» e «Reimporta» registrano `requested_at` e accodano `{ syncStore }`: richieste ripetute confluiscono, il consumer chiude le consegne già servite, un negozio occupato riprova dopo 60 secondi e il cron riprende le richieste che la coda non ha accettato o consegnato. La reimportazione rifissa la finestra dello storico del piano soltanto a importazione conclusa. Un `429` sospende tutte le letture della stessa origine API per il `Retry-After` (15 minuti senza intestazione, al massimo un giorno): cron, consumer ed eventi non chiamano eBay durante l'attesa e la schermata lo dice. Il negozio conserva le ultime tre letture con esito e ordini nuovi, come nell'anteprima; lo stato di una richiesta si comunica con l'avviso dell'azione. Prove con clic ripetuti, consegne duplicate, coda non disponibile, blocco rimasto da un'esecuzione interrotta, rinnovo del token e ricollegamento durante la lettura.

**Qualifica sul test (2026-10-12):** dopo [#325](https://github.com/max23468/FiscalBay/pull/325) cron registrato ogni 10 minuti, una sola esecuzione per turno, 12-22 ms di CPU senza letture e 95 ms al primo avvio con due negozi letti. Dalla coda: richiesta manuale servita con 28 ms di CPU, consegna duplicata chiusa in 2 ms senza chiamare eBay, reimportazione dello storico ripartita senza duplicare gli ordini (89 ms per tre pagine). Con un limite registrato per l'origine Production consumer e cron non hanno chiamato eBay e la consegna è ripartita alla scadenza. I negozi sintetici di collaudo, con token non apribile, passano il turno senza chiamare eBay e ritentano con la cadenza del piano.

**Limiti residui:** priorità Premium e cadenza 10 minuti sono provate sull'ordinamento, non con spazi Premium reali, che arrivano con [M5](#m5). Il cron accoda le letture e il consumer le esegue, come descritto in [M3-12](#m3-12). Il limite di frequenza è prudenzialmente per origine API, non per singola API o negozio. Un 429 reale di eBay non è stato osservato: l'attesa è provata sul test con un limite registrato. «Sincronizza» e «Reimporta» sono collaudati sul test dalla coda, senza clic da una sessione reale. La consegna attribuita di `ORDER_CONFIRMATION` resta in [M8-03](#m8-03).

Lo smistamento del lavoro periodico e l'esecuzione in coda sono in [M3-12](#m3-12); qui si definiscono cadenza per piano, priorità ed equità che lo smistamento applica.

Usare consegna/retry/ritardi/DLQ del servizio scelto. Stato applicativo solo per checkpoint, deduplica e recupero di effetti di business; outbox/lease soltanto se necessari, non un secondo orchestratore.

**Per chiudere:** integrazione delle regole di sync con l'ingresso Worker [M3-11](#m3-11), verificata sui casi attribuiti controllati.

Lo smistamento Cron/coda ha la qualifica distinta in M3-12; la chiusura della milestone M3 richiede entrambi i task.

**Qualifica reale successiva obbligatoria:** la sottoscrizione e la consegna attribuita di `ORDER_CONFIRMATION` di un negozio Production appartengono a [M8-03](#m8-03), nel manifest merchant autorizzato. M3 chiude l'implementazione tecnica senza dichiarare riuscita quella prova; M8 e il gate finale restano aperti fino al suo esito.

<a id="m3-05"></a>
#### M3-05 · Controllo fiscale e aggiornamenti

**Stato:** Completato · **Prerequisiti:** M3-02 · **Contratto:** [§9](#s09)

Mostrare subito l’ordine e verificare i dati fiscali con un lavoro separato. Gestire più identificativi, controlli formali e distinzione fra assenza, errore, mascheramento e rimozione.

Completare gli scenari sintetici condivisi con la UI e provare che una risposta fiscale tardiva non sovrascriva una versione autorevole più recente; includere omocodia e identificativi formalmente invalidi senza certificazione d'identità.

**Criterio di completamento:** Un errore fiscale non blocca l’ordine; rimozione solo su evidenza autorevole, prima disponibilità e variazioni elaborate senza duplicati.

Integrato da CF Ready e Hub Fatture: qualità formale del CF (formato, carattere di controllo, coerenza con nome e cognome nelle due orientazioni e con il nome di registrazione, `c/o` separato solo per il confronto) come indicazione che non corregge, non blocca e non cambia la quota; omocodie e nomi ambigui danno `non verificabile`. Osservazioni con `lastModifiedDate` più vecchia scartate prima di ogni scrittura e contate; confronto normalizzato (omesso uguale a `null`, stessi formati e precisione) che non crea versioni, notifiche o consumi per riletture invariate.

**Implementazione locale:** il dettaglio fiscale separato dall'import mantiene verifica, disponibilità della fonte e diritto all'ordine distinti nella vista reale IT/EN. Un errore o un campo Trading malformato non elimina l'ordine; mascheramento, ordine non restituito e assenza conservano i valori già acquisiti. Un valore presente sostituisce i precedenti dello stesso tipo/Paese e della stessa fonte, conservandoli nello storico; l'omissione di un altro tipo non lo rimuove. La rimozione senza sostituto richiede `complete`, che gli adapter eBay restano incapaci di affermare dalla sola assenza. La prima disponibilità usa l'istante del salvataggio nel database e resta nello storico anche dopo consolidamento; non retrodata il dato all'avvio del job. Per le osservazioni anteriori alla sua introduzione resta la data già nota, senza inventare un nuovo istante di acquisizione. I cambiamenti sono deduplicati sul valore normalizzato, senza contare la sola provenienza. La versione della fonte e l'istante della lettura proteggono anche il batch transazionale dalle risposte tardive; gli scarti producono un contatore nei log senza dati dell'ordine. Il controllo formale CF/P.IVA e gli scenari dell'anteprima condividono le stesse regole, senza certificare identità o esistenza. La vista reale usa riquadro, note e stati dell'anteprima; lo scenario dei dati discordanti mostra valore letto in precedenza con lettura non riuscita, non riportata, in corso o nascosta, e dato nascosto o rimosso.

**Limiti residui:** prove sintetiche; distribuito sul test con [#347](https://github.com/max23468/FiscalBay/pull/347), migration riletta sulla D1 di test, nessuna lettura con ordini eBay reali. Le date delle due API non vengono confrontate fra loro; una risposta fiscale senza versione della propria fonte non può sovrascriverne una già autorevole. Il mascheramento fiscale esplicito è gestito dal modello, ma non dedotto dall'età o dall'assenza di un campo eBay. Notifiche e grant commerciali restano nei task competenti di M3/M5; la loro integrazione userà i cambiamenti effettivi senza un nuovo consumo per identificativo.

<a id="m3-06"></a>
#### M3-06 · Sblocco per ordine e diritti acquisiti

**Stato:** Completato · **Prerequisiti:** M3-05, M1-03 · **Contratto:** [§5](#s05) · [§6](#s06) · [§9](#s09)

**Per chiudere:** M1-09 per i mutation test delle invarianti.

Implementare diritto per ordine, ciclo e quota con controllo atomico. Preservare dati acquisiti in Premium anche mai aperti; non restituire valori fiscali prima dell’autorizzazione. La conferma dello sblocco singolo offre «Non chiedermelo più», salvato per utente soltanto dopo uno sblocco riuscito, e Impostazioni lo ripristinano con «Riattiva conferma sblocco» (decisione owner del 2026-10-04, assegnata qui con D176); lo sblocco multiplo conferma sempre.

Aggiungere mutation test mirati con il tooling di M1-09 per ultimo credito e isolamento. Provare anche che il passaggio fra identificativi eBay preservi il grant e non consumi nuovamente quota o produca una nuova notifica dello stesso evento.

**Criterio di completamento:** Test su ultimo credito, concorrenza, sblocco multiplo, downgrade e valori tardivi. Un ordine copre tutti gli identificativi e la ricerca non permette di indovinare valori bloccati.

M3 realizza il contratto dominio/transaction con cicli e grant testabili; M5 integra provider e calendario commerciale. Non dichiarare funzionante l’intero billing solo perché il grant di una fixture passa.

**Implementazione locale:** sblocco singolo e multiplo con quota e preferenza nello stesso commit; cicli personali ancorati al primo collegamento, materializzati quando servono con quota base cinque. Le coperture locali immutabili e revocabili, insieme alla storia della disponibilità fiscale, conservano il diritto per ordine dopo la scadenza e il consolidamento, anche senza apertura; un primo dato successivo alla copertura resta bloccato e una revoca non elimina altri diritti indipendenti. I dialoghi sono condivisi con l'anteprima, compreso lo scenario di sblocco fallito con nuovo tentativo; «Riattiva conferma sblocco» è disponibile in Impostazioni, Sicurezza. Il provider, le promozioni e il calendario commerciale restano in M5; nessuna copertura commerciale viene attivata dal browser.

Integrato da CF Ready e Hub Fatture: mutation test mirati su sblocco, quota e grant, eseguiti dalla campagna settimanale e dal candidato Production ([D190](DECISION_REGISTER.md)).

<a id="m3-07"></a>
#### M3-07 · Suggerimenti e template mancanti

**Stato:** Completato · **Prerequisiti:** M3-01, M3-05 · **Contratto:** [§10](#s10)

Collegare soltanto buyer affidabili dentro lo stesso spazio. Suggerire il valore più recente con avviso di conflitto e provenienza, invalidandolo quando cambia la fonte. Aggiungere il template IT/EN copiabile.

**Criterio di completamento:** Il suggerimento non modifica l’ordine e non attraversa spazi; fonti cancellate o fuori conservazione non restano utilizzabili. Nessun invio automatico all’acquirente.

La recenza segue la data dell’ordine sorgente, non import/sync; la sua versione corrente è quella autorevole. Conflitto soltanto tra dati omogenei: un CF diverso da una P.IVA non è di per sé incoerenza.

**Implementazione locale completata:** suggerimenti Premium da ordini autorizzati ancora conservati, anche di altri negozi dello spazio nello stesso ambiente eBay. Collegamento soltanto con l'identità stabile dell'ordine Trading, senza matching per username o contatti e senza chiamate aggiuntive al buyer. Provenienza, conflitti omogenei e ambiguità visibili; ogni lettura ricalcola il risultato senza copie fiscali persistenti. Dettaglio reale e anteprima condividono il modello IT/EN modificabile e copiabile, con riferimento all'ordine e gestione del rifiuto della clipboard; nessuna modifica all'ordine o invio. Contratto e limiti nel [modello di conservazione](engineering/DATA_RETENTION.md#identita-e-suggerimenti). Distribuito sul test dai cicli di `develop`, che applicano le migration; preferenze persistenti dei template nel percorso Impostazioni di M4.

<a id="m3-08"></a>
#### M3-08 · Retention operativa e anti-resurrezione

**Stato:** Completato · **Prerequisiti:** M3-01, M3-04 · **Contratto:** [§30](#s30)

**Per chiudere:** M1-09 per i mutation test della scadenza.

Implementare cancellazioni periodiche deterministiche, raw a 24 ore e conservazione di ordini, versioni, identificativi e buyer. Usare marcatori di eliminazione dove necessari e invalidare lavori pendenti.

**Criterio di completamento:** Vecchi job o eventi rielaborati non ricreano dati cancellati; la richiesta di eliminazione prevale sulla finestra ordinaria di ripensamento del piano.

Inventariare body degli eventi, outbox, code, snapshot e suggerimenti: riferimenti minimi persistenti, dati grezzi soggetti a TTL anche dopo retry. Accesso negato alla scadenza; pulizia fisica nel margine dichiarato.

Con job di pulizia sospeso, provare dettaglio, ricerca e suggerimenti ai confini di scadenza e dopo revoca. Aggiungere mutation test della scadenza dei grant; M6-03 estende la prova agli export e M7-02 verifica l'intero percorso.

**Implementazione locale completata:** termini separati di accesso e pulizia, default Free dalla creazione dell'ordine, grant con scadenza e revoca, cancellazione giornaliera delle copie dipendenti e marker atomici su ID e identità delle righe. L'eliminazione del negozio prevale sulla grace e conserva il limite anche al ricollegamento, senza restituire quota. Elenco, dettaglio e conteggi rispettano subito la scadenza; import, dettagli pendenti e ricevute non riattivano dati eliminati. Confini temporali con pulizia sospesa, replay, concorrenza e ordini combinati verificati localmente; mutation mirata sui grant. Nessun raw persistito; inventario e raccordo delle scadenze commerciali nel [contratto di conservazione](engineering/DATA_RETENTION.md). I suggerimenti rileggono accesso e conservazione della fonte in M3-07; ricerca dedicata ed export restano rispettivamente in M4 e M6-03, senza copie indipendenti della fonte. Distribuito sul test dai cicli di `develop`, che applicano le migration.

<a id="m3-09"></a>
#### M3-09 · Ordini combinati e identità di riga

**Stato:** Completato · **Prerequisiti:** M3-02 · **Contratto:** [§9](#s09) · [§35](#s35)

Il punto tocca insieme modello (M3-01), client (M3-02) e sblocco (M3-06), quindi ha un task proprio. Leggere gli acquisti prima del checkout da Trading, collegarli all'ordine definitivo tramite l'identità stabile di riga e consolidare solo quando tutte le righe di ogni provvisorio appartengono allo stesso ordine definitivo. Sovrapposizioni parziali, righe senza identità o più candidati restano anomalie visibili. Quota, grant e sblocchi seguono il consolidamento.

**Criterio di completamento:** Test su ordine combinato con ID nuovo e righe rinominate al pagamento: nessuna seconda quota, nessun diritto perso, nessun duplicato; provvisorio annullato o assorbito fuori dalle viste correnti; casi ambigui bloccati senza indovinare. Prova su un ordine combinato reale dell'account controllato, se disponibile nella finestra; altrimenti fixture sanitizzata e limite dichiarato.

**Implementazione locale completata:** elenco Trading `GetOrders` dei modificati con paginazione e checkpoint separati entro il budget del negozio, nella finestra di trenta giorni attualmente implementata. Un ordine Trading illeggibile si salta con un errore registrato e un errore Trading lascia la passata da riprendere, senza fermare recenti, storico e dettaglio; credenziali e limite di eBay fermano l'esecuzione. Una passata interrotta conta come arretrato per lo scheduler. Il definitivo conserva un UUID esistente; provvisori interamente contenuti e disgiunti vengono assorbiti, mantenendo storico e grant originali. La consultazione riconosce gli sblocchi acquisiti e non genera un nuovo consumo; con D174 un acquisto non ancora pagato non si sblocca, così un ordine combinato consuma al massimo una quota. Il riferimento Trading del definitivo conserva le identità delle transazioni quando Fulfillment rinomina le righe. Arrivo invertito, replay, isolamento, revoca del consenso, annullamenti e ambiguità sono coperti da fixture sintetiche; le anomalie compaiono in IT/EN come «Ordine da verificare» nella scheda (D178) e con la spiegazione nel dettaglio, anche nello scenario «Dati discordanti» dell'anteprima. Migration locale additiva, nessuna riscrittura dei grant.

Mutation test mirati sulle decisioni di consolidamento (`order-import.server.ts:220-285`) e sblocco (`orders.server.ts:226-285`): 102 mutanti rilevati su 102, nessun sopravvissuto, timeout o esclusione.

**Limite della qualifica:** distribuito sul test con [#345](https://github.com/max23468/FiscalBay/pull/345) e la [run di develop](https://github.com/max23468/FiscalBay/actions/runs/38718449461). Readback del 2026-10-15 sulla D1 di test: migration `0022` applicata, passata Trading conclusa su tutti i negozi con consenso attivo (Production e Sandbox), nessun ordine assorbito né anomalia di consolidamento. Nessun ordine combinato reale osservato nella finestra dei trenta giorni: su decisione owner del 2026-10-15 il task si chiude con fixture sintetiche, non ricavate da una risposta eBay reale. Il primo ordine combinato reale del test merchant ([M8](#m8)) verifica consolidamento, quota e grant; un esito diverso riapre il task. Riferimento del contratto esterno: [GetOrders](https://developer.ebay.com/Devzone/xml/docs/reference/ebay/GetOrders.html).

Lettura diretta del 2026-10-19 sul negozio owner: un ordine combinato **creato dal venditore** (fattura per tre acquisti, `CreatingUserRole` Seller, ID in una forma diversa da quella Fulfillment, nessun `ExtendedOrderID`, `PaymentMethod` None e pagamento registrato due giorni dopo) esiste soltanto in Trading. Fulfillment rifiuta come non valido sia il suo ID sia gli ID delle righe e non espone quegli articoli in altri ordini dello stesso periodo; Trading restituisce lo stesso ordine anche cercato per riga. Una volta pagato l'ordine è definitivo e resta visibile, unico, senza provvisori da consolidare, ma senza marketplace, indirizzo di fatturazione e CF, che `GetOrders` non riporta: nessuna fonte disponibile li fornisce, quindi non è un difetto dell'abbinamento. Resta da verificare se ogni ordine combinato dal venditore, o solo quello pagato senza il checkout eBay, manchi in Fulfillment.

<a id="m3-10"></a>
#### M3-10 · Riqualifica della lettura fiscale Fulfillment

**Stato:** Completato · **Prerequisiti:** M3-02 · **Contratto:** [§9](#s09) · [§11](#s11)

Riapre in modo circoscritto l'esito di M0-05, senza modificarlo retroattivamente: con l'header `X-EBAY-C-MARKETPLACE-ID` ricavato dal marketplace dell'inserzione e `fieldGroups=TAX_BREAKDOWN`, leggere sugli stessi ordini controllati `buyer.taxIdentifier` da Fulfillment e `BuyerTaxIdentifier` da Trading, senza persistere né stampare valori.

**Criterio di completamento:** Matrice di presenza e coincidenza per ordine (solo conteggi ed esiti), limiti di età e marketplace osservati, impatto sul budget quote. Se Fulfillment con header è equivalente, proposta all'owner di rivedere D135; fino al suo via Trading resta primario e il client M3-02 conserva la seconda osservazione con provenienza.

**Esito:** Lettura Production controllata sul keyset FiscalBay: 18 ordini `EBAY_IT` nelle fasce 0–14, 15–90, 91–365 e oltre 365 giorni. L'header abilita il dato fiscale; sei CF presenti coincidono con Trading, sei assenze entro 90 giorni non provano equivalenza, oltre 90 giorni Trading non restituisce i sei ordini e Fulfillment espone quattro identificativi. La matrice, i limiti, le quote riconfermate e la revisione circoscritta di D135 sono nella [procedura di confronto](engineering/EBAY_TAX_COMPARISON.md#qualifica-production-del-2026-10-10). Paesi incompleti e marketplace/tipi non provati restano espliciti. L'owner ha approvato D135 il 2026-10-10: prima lettura Fulfillment per il CF italiano qualificato, Trading come fallback e storico preservato, integrati con [#318](https://github.com/max23468/FiscalBay/pull/318). La [run test successiva](https://github.com/max23468/FiscalBay/actions/runs/38177343366) attesta artefatto, schema e readback della versione distribuita; la qualifica fiscale resta quella del campione documentato. Nessuna rotazione Auth.

<a id="m3-11"></a>
#### M3-11 · Ingresso Worker per webhook e callback

**Stato:** Completato · **Prerequisiti:** M3-03 · **Contratto:** [§25](#s25) · [§11](#s11)

Realizzare una volta sola l'ingresso prima di React Router: metodo, dimensione e firma sul corpo grezzo, claim idempotente in D1, messaggio in coda con soli identificativi, risposta positiva solo dopo l'accettazione della coda, consumer con retry e dead-letter nativi. Il primo consumatore è `ORDER_CONFIRMATION` per M3-04; M5-05 (Stripe), M5-09 (Telegram) e M7-02 (cancellazione account eBay) lo riusano invece di creare percorsi propri.

Il webhook Stripe preliminare non va attivato come route React Router: l'ingresso condiviso ne sostituisce verifica e presa in carico e permette di rimuovere la route. M5-05 integra gli effetti commerciali sullo stesso ingresso, conservando le prove di firma e deduplica già qualificate.

**Criterio di completamento:** Consegna duplicata senza effetti ripetuti; coda non disponibile senza ACK al provider; firma errata o corpo oltre limite rifiutati prima di caricare l'app; CPU per invocazione letta nei log del Worker entro il limite del piano (D158); mutation test mirati sull'ingresso eseguiti dalla CI quando la PR lo tocca. Le callback OAuth aperte dal browser restano fuori da questo ingresso.

**Implementazione locale:** ingresso `/webhooks/ebay` (e percorso `/sandbox`) e `/webhooks/stripe` nel Worker prima del caricamento della build React Router; firme verificate sul corpo grezzo, limite di 256 KiB anche senza `Content-Length`, ricevute D1 con soli riferimenti e scadenza di sette giorni dall'evento. Claim e accettazione Queue sono separati: il cron recupera le ricevute non accodate; duplicati in coda non ripetono gli effetti e una lease scaduta permette la ripresa dopo crash. `ORDER_CONFIRMATION` rilegge soltanto l'ordine indicato, rivalidando ambiente, consenso, pausa, cancellazione e finestra dello storico; non avanza il watermark del polling. Stripe conserva la ricevuta verificata, senza effetti commerciali anticipati. La route preliminare è stata rimossa. Configurazione Queue/retry/DLQ separata per test e Production; procedure nella [pubblicazione](engineering/RELEASE.md#webhook).

**Verifica locale:** `pnpm verify`, collaudo Chromium locale completo e mutation test sull'ingresso, sulle firme eBay e sui tratti di acquisizione modificati, senza sopravvissuti né timeout.

**Qualifica sul test (2026-10-11):** migration applicata, Queue e DLQ create con produttore e consumer. Sul Worker pubblicato challenge eBay 200, firma errata 412, corpo da 2 MB 413 e metodo errato 405 con 0-5 ms di CPU, contro 48 ms della prima pagina che carica React Router; consumer Queue 0-2 ms, entro i 10 ms di Workers Free. Con coda indisponibile l'ingresso risponde 503 senza duplicare la ricevuta, e il cron la accoda e la completa; la stessa consegna ripetuta riceve 204 senza nuovo accodamento, lo stesso ID con contenuto diverso 409. Un riferimento non valido esegue cinque retry con backoff e finisce nella DLQ. Destinazione e sottoscrizione `ORDER_CONFIRMATION` Sandbox attive sul test; la consegna di prova eBay ha mostrato firma ECDSA SHA-256 sui byte ricevuti e payload senza `data.user`, ora gestiti e coperti da una fixture con firma autentica. Il negozio Production si sottoscrive con il test merchant.

**Limiti residui:** le prove remote e la correzione della firma sono in [#322](https://github.com/max23468/FiscalBay/pull/322), dopo l'integrazione di [#320](https://github.com/max23468/FiscalBay/pull/320). La consegna Sandbox sintetica senza `data.user` non prova l'attribuzione a un negozio: consegna attribuita e sottoscrizione Production restano nel test merchant; Stripe, Telegram e cancellazione account riusano l'ingresso nelle rispettive milestone. Nessun avvio commerciale Production.

<a id="m3-12"></a>
#### M3-12 · Smistamento del lavoro pianificato

**Stato:** Completato · **Prerequisiti:** M3-03, M3-11 · **Contratto:** [§31](#s31) · [§11](#s11)

**Per chiudere:** M3-04 per cadenza e priorità per piano.

Un solo Cron Trigger per ambiente sceglie in base a `scheduledTime` il lavoro dovuto (sync per piano, ricevute non accodate, pulizie di retention, riconciliazioni, controlli periodici) e lo accoda; il consumer lo esegue con budget limitati per invocazione. L'acquisizione ordini esce dall'invocazione del cron. Con i quattro trigger già previsti nell'account condiviso, il quinto posto resta di riserva ([§31](#s31)).

**Criterio di completamento:** CPU e durata del cron e di ogni invocazione consumer misurate sul test entro i budget di [§31](#s31), distinguendo avvio e lavoro effettivo. Compiti giornalieri eseguiti una volta anche con trigger saltati, ripetuti o sovrapposti; nessun negozio affamato da altri. Esito della valutazione di un terzo trigger registrato qui; il lavoro si fraziona in più messaggi solo se durata, memoria, equità fra negozi o costo lo richiedono, non per rientrare nei 10 ms del Free (D169).

La scadenza nativa di Queue/DLQ segue [§11](#s11): provare anche un messaggio accettato e poi scaduto, con il checkpoint ancora valido, oltre alla sola ripresa delle ricevute mai accodate.

**Implementazione locale:** il cron non chiama eBay e non esegue lavoro: accoda i compiti periodici, riprende le ricevute webhook e accoda le letture dei negozi dovuti, ciascun passo indipendente dagli altri. Ogni compito ha un turno per periodo in `scheduled_tasks` (pulizia dei dati tecnici scaduti una volta al giorno UTC, rinnovo anticipato dei token ogni 10 minuti), registrato con un claim atomico prima dell'invio: trigger ripetuti o sovrapposti dello stesso periodo non lo riaccodano, un trigger saltato lascia il turno al successivo, un periodo nuovo assorbe quello non concluso e un invio rifiutato libera il turno. Le letture dei negozi seguono ordine e cadenza di [M3-04](#m3-04): il cron segna `sync_state.dispatched_at` e accoda fino a 100 negozi con un invio a gruppi, nell'ordine di priorità; i negozi di un'origine API in attesa per un `429` non si accodano. Il consumer legge un negozio per invocazione con il budget di 12 chiamate e 3 pagine, serve insieme turno e richiesta manuale, passa il turno anche se fallisce prima di iniziare e chiude senza chiamare eBay le consegne già servite; con un'attesa nota riprova alla scadenza senza registrare errori. Messaggi accettati e poi persi (scaduti o nella DLQ) si riprendono dal checkpoint D1: turni dei compiti e letture dei negozi dopo un'ora, ricevute webhook non completate dopo un giorno e finché non scadono. La concorrenza del consumer passa a 5, così eventi e altri negozi avanzano mentre un negozio è in lettura; lo stesso negozio resta serializzato dal suo blocco.

**Terzo trigger:** non necessario. I compiti giornalieri si programmano dal trigger ogni 10 minuti con il turno per periodo, restano idempotenti rispetto a invocazioni ripetute e le misure sul test non mostrano limiti di durata o di CPU.

**Verifica locale:** prove con trigger ripetuti a pochi secondi, sovrapposti e saltati; coda non disponibile per compiti e letture; messaggio accettato e mai consegnato per compiti, letture e ricevute webhook; consegna ripetuta e turno superato senza effetti; compito fallito con backoff; cron che accoda senza chiamare eBay. Le prove di cadenza, limiti ed equità di M3-04 passano dal percorso cron, coda e consumer. Mutation test su smistamento e consumer delle letture, ingresso webhook e compiti periodici senza sopravvissuti né timeout.

**Qualifica sul test (2026-10-12/13):** dopo [#331](https://github.com/max23468/FiscalBay/pull/331) migration applicata; dalle 20:00 del 12 alle 05:20 del 13 ottobre 57 turni da 10 minuti, uno per slot, nessun trigger ripetuto o saltato, tutte le invocazioni con esito `ok`. Cron 3 ms di CPU mediani (massimo 11) e 0,45 s di durata (massimo 1,7), senza chiamate a eBay; consumer 6 ms mediani (massimo 88) e 0,8 s (massimo 18 s, attesa delle risposte eBay in una lettura). Pulizia del 13 ottobre eseguita una volta alle 00:00, i due negozi reali letti con la cadenza Free alternandosi fra i turni. La ricreazione in UE delle code del test, alle 05:31 del 13, ha fatto fallire gli invii di quel turno: il turno della pulizia, riaperto per la prova, è stato riaccodato e concluso al trigger successivo, e una ricevuta accodata da due giorni e mai consegnata è stata ripresa e completata dal checkpoint.

**Limiti residui:** spazi Premium reali e carico con molti negozi restano a [M5](#m5) e [M7-03](#m7-03); Production non ha ancora ricevuto il deploy.
<a id="m4"></a>
### M4 · UX completa Ordini, Negozi e Impostazioni

**Prerequisiti:** contratti M2/M3 stabili. **Attività:** card 2×riga, drawer URL/Articoli, query completa, filtri/sorting, Carica altri, selezione/barra, contesto export, profilo/impostazioni/inbox, onboarding progressivo, loading/error/degraded, light/dark/IT-EN/mobile e microcopy.

**Output:** esperienza completa su dati rappresentativi, senza funzionalità future nascoste nel concept. **DoD:** flow browser/touch/back/refresh/scroll coerente, nessun dato bloccato dal client bypassabile, inventario opzioni concordate coperto; integrazioni M5/M6 ancora assenti indicate come questioni aperte, non dichiarate Production-ready. M4 chiude struttura e comportamento UI sui contratti stabili, non fatturazione, Telegram o export funzionanti se ancora simulati. M6/M7 chiudono gli stessi flussi end-to-end prima della RC.

**Accettazione:** ricerca e conteggi solo su valori fiscali accessibili, senza CF/P.IVA in URL, referrer o log edge e senza inferenza dei valori bloccati; query server senza caricamento dell'intero storico nel browser. Cursori stabili, selezioni rivalidate, solo negozio e ordinamento ricordati fra sessioni. Pannello con URL, ritorno/focus/tastiera e contesto conservato; sblocco multiplo/export mai impliciti. Impostazioni con inventario completo, modifiche non salvate protette, lingua/tema persistenti, errore mai mostrato come successo. Onboarding riprendibile senza wizard bloccante; ordini autorizzati disponibili durante outage eBay, prima sync distinta dalla disponibilità fiscale. Integrare misure Auth/D1/eBay/browser allowlistate, controlli visivi e a11y in IT/EN, chiaro/scuro, smartphone/tablet/desktop e movimento ridotto (§17–§22, §31).

L'integrazione trasferisce nell'app reale le sole funzioni e gli stati approvati dell'anteprima. Questa resta sul test per le verifiche grafiche; i task applicativi mantengono componenti condivisi e provano i percorsi reali secondo §35. La chiusura end-to-end e la pulizia del codice superfluo confluiscono in M7-08, senza dismettere l'anteprima.

<a id="m4-01"></a>
#### M4-01 · Pagina Ordini definitiva

Integrare caricamento dai dati persistiti autorizzati e aggiornamento remoto separato (§20). Strumentare Auth, D1, eBay e rendering con metriche allowlistate (§31); usare custom span Workers per la diagnosi delle fasi server, distinti dalle misure browser. Le nuove API `getActiveSpan`, `startSpan` e `setAttributes` si usano soltanto dove necessarie, senza attributi personali o eccezioni grezze. Verificare prima visualizzazione e refresh con provider lento, senza esporre dati prima del controllo dei diritti. M6-11 integra i contatori/istogrammi aggregati su Analytics Engine, M6-08 protegge i report e M7-03 prova anche i trace sotto carico.

**Stato:** Completato · **Prerequisiti:** M1-07, M3 · **Contratto:** [§17](#s17)

Realizzare la griglia a due schede o una secondo viewport, dettagli intermedi, area fiscale e azioni primarie/secondarie. Usare segnaposto che non rivelino dati bloccati.

**Criterio di completamento:** Nessuna personalizzazione delle schede nella 2.0; titoli lunghi, importi e Partite IVA non rompono il layout. Sono visibili soltanto dati autorizzati.

Integrato da CF Ready e Hub Fatture: mostrare la qualità formale calcolata in M3-05 come indicazione, non come errore. Dove una verifica remota è lenta, HTML subito con l'ultimo stato salvato, «Verifica in corso» e azioni sensibili disabilitate, poi stato confermato in streaming; se fallisce, avviso e «Riprova». La schermata Negozi di M2-07 si allinea allo stesso comportamento in questo task.

Un solo albero di componenti per la pagina Ordini: area reale e anteprima la rendono con le stesse parti, alimentate da dati persistiti autorizzati o da scenari sintetici. La vista ridotta degli ordini importati, con le sue etichette locali di pagamento e spedizione, si rimuove a favore di quelle condivise, secondo il vocabolario del [§9](#s09). Gli ordini letti prima della verifica fiscale (stato «Dato non ancora acquisito», presenti solo sul test) si rileggono una volta e lo stato si elimina, senza aggiungerlo all'anteprima. Accesso e Ordini smettono di condividere pagina e loader: login, registrazione, reset, passkey e completamento del profilo diventano una pagina propria, e il loader Ordini carica soltanto i dati dell'area autenticata. Riscrivendo i componenti Ordini, separarli per area (scheda, dettaglio, barra strumenti e selezione). Il task non si chiude se area reale e anteprima divergono.

Prezzo della riga (D165): prezzo unitario quando l'importo di riga diviso per la quantità è esatto nell'esponente della valuta, altrimenti importo di riga; mai centesimi arrotondati.

Ricerca, paginazione e sblocco usano i contratti reali, senza trasferire le logiche simulate dell'anteprima. Aggiungere o trasferire le prove funzionali sulle route autenticate nello stesso intervento, conservando gli scenari grafici sul test (§35).

Mostrare e copiare CF e P.IVA italiani nella forma derivata normalizzata, senza spazi e in maiuscolo, nelle schede e nel dettaglio condivisi con l'anteprima. Conservare valore originale, fonte e qualità formale; la formattazione non corregge un identificativo errato né cambia autorizzazione o quota. Provare valori minuscoli, spazi, zeri iniziali, più identificativi e tipi esteri, senza applicare a questi ultimi regole italiane. L'export di M6-01/M6-02 conserva i valori originali secondo [§12](#s12); Telegram applica la forma derivata in [M5-10](#m5-10).

**Completato:** area reale e anteprima rendono la pagina con gli stessi componenti, separati per scheda, dettaglio, barra strumenti e selezione; la vista ridotta e le sue etichette locali non esistono più. L'accesso (login, registrazione, recupero, passkey e completamento del profilo) è una pagina con il proprio loader; il loader Ordini richiede sessione e registrazione completa e legge soltanto ordini persistiti e autorizzati, con il dettaglio su `/app/ordini/:id` e la stessa risposta per un ordine inesistente, scaduto o di un altro spazio. Vocabolario D176 uguale in area reale, anteprima e filtri: uno stato eBay non previsto compare con il codice originale e resta fuori dai filtri. Prezzo della riga secondo D165; CF e P.IVA italiani mostrati e copiati nella forma normalizzata, anche da «Copia dati di fatturazione», con l'originale invariato. Filtri, ricerca, conteggio e «Carica altri» dell'area reale sono una query D1 sugli ordini consultabili dello spazio, con gli stessi controlli di negozio e conservazione e i soli valori fiscali autorizzati; il filtro in memoria resta negli scenari dell'anteprima. Un ordine in verifica compare subito con l'ultimo stato salvato e lo sblocco sospeso, poi lo stato confermato arriva nella stessa risposta entro l'attesa dello streaming; una lettura non riuscita offre «Riprova», che rimette da leggere il dettaglio di quell'ordine con una lettura del negozio; un ordine noto soltanto a Trading riparte con la passata Trading del negozio. Negozi conferma allo stesso modo i negozi in lettura e sospende «Sincronizza» e «Reimporta» finché la lettura è in corso. Lo stato «Dato non ancora acquisito» non esiste più: la migration rilegge una volta gli ordini senza esito e un ordine che resta senza esito risulta una lettura da riprovare. Misure: span Workers per Auth, D1, eBay e rendering con attributi allowlistati, durata per fase nell'header `Server-Timing` e report del browser su `/api/v1/page-timing`, validato, limitato e registrato come evento `page_timing`. Distribuito sul test dal ciclo della PR, che applica la migration.

**Limiti residui:** Nell'area reale l'export non compare finché non esiste [M6-01](#m6-01). «Apri su eBay» apre in una nuova scheda la pagina dell'ordine nel Seller Hub (`www.ebay.it/sh/ord/details?orderid=`), lo stesso indirizzo usato dai messaggi Telegram della 1.x; compare soltanto per i negozi eBay reali, perché per la Sandbox non esiste un indirizzo verificato. Gli span eBay coprono le chiamate partite dalle pagine; quelle della coda restano senza span e senza durata fino a [M6-11](#m6-11). Il report del browser resta un log del Worker fino ad Analytics Engine in [M6-11](#m6-11), senza campionamento né limite di frequenza all'edge ([M7-12](#m7-12)); il modello di messaggio resta quello predefinito fino alle preferenze di [M4-06](#m4-06). L'avviso degli sblocchi esauriti compare senza il collegamento al piano finché la pagina del piano non esiste.

<a id="m4-02"></a>
#### M4-02 · Ricerca e filtri

**Stato:** Completato · **Prerequisiti:** M4-01 · **Contratto:** [§17](#s17) · [§28](#s28)

Unificare ricerca rapida e pagina risultati; implementare filtri per negozi, date, stati e situazione fiscale. Interrogare soltanto valori fiscali accessibili.

Il filtro «Non pagato» può rendere consultabili gli acquisti provvisori, esclusi dalle viste predefinite (D180); senza quel filtro restano nascosti. La situazione fiscale distingue l'acquirente estero dal dato non riportato da eBay.

**Criterio di completamento:** Query e conteggi non rivelano dati bloccati; indicizzazione e filtri server non richiedono di caricare tutto lo storico nel browser.

Per query CF/P.IVA preservare stato della vista senza mettere il valore in URL, referrer o log edge. Nessuna inferenza di identificativi bloccati attraverso conteggi o risultati parziali.

**Completato:** la barra superiore dell'area reale propone i primi cinque ordini e il loro numero con lo stesso filtro D1 della pagina, tramite `POST /api/v1/orders/search`; «Vedi tutti» e Invio aprono l'elenco filtrato e, se la risposta manca, il modulo invia la ricerca con un invio ordinario. L'anteprima risponde allo stesso modo sugli scenari, senza un secondo indice nel browser. La query viaggia soltanto nel corpo: l'indirizzo conserva la ricerca cifrata e legata a utente e sessione, così dettaglio, Indietro e ricarica la mantengono senza CF o P.IVA in URL, referrer o log, e una nuova sessione la dimentica. Il confronto ignora maiuscole e accenti di ogni alfabeto su un testo cercabile per ordine (numero, acquirente, titoli e SKU), scritto dalle letture e calcolato dalla manutenzione per gli ordini già presenti; i valori fiscali si confrontano soltanto se autorizzati all'istante della richiesta, anche senza spazi, quindi elenco, conteggi e suggerimenti non trovano valori bloccati. Elenco, conteggi e ricerca partono dai negozi dello spazio, con un indice per spazio, e ne leggono gli ordini per negozio, senza scorrere quelli degli altri spazi. Filtri per negozio, periodo, pagamento, spedizione e situazione fiscale, con «Acquirente estero» distinto da «Non disponibile su eBay» (il filtro per marketplace, presente alla chiusura, è stato tolto con D183). «Non pagato» mostra anche gli acquisti provvisori, con dettaglio e «Riprova», lo sblocco sospeso fino al pagamento (D174) e nessun suggerimento; viste predefinite e loro conteggi li escludono (D180).

**Limiti residui:** gli ordini presenti prima dell'indicizzazione si cercano con le sole minuscole ASCII finché la manutenzione giornaliera non ne calcola il testo, fino a 5.000 ordini per turno. I suggerimenti partono da due caratteri e, come «Vedi tutti», considerano la sola ricerca senza i filtri attivi.

<a id="m4-03"></a>
#### M4-03 · Carica altri e contesto

**Stato:** Completato · **Prerequisiti:** M4-02 · **Contratto:** [§17](#s17)

Implementare ordinamento recente, cursori stabili e conservazione del contesto durante la navigazione. Tra sessioni mantenere solo negozio e ordinamento; nuovi elementi automatici soltanto in cima.

**Criterio di completamento:** Nessun salto durante la lettura né filtro temporaneo invisibile al nuovo accesso; selezioni rivalidate rispetto ai permessi correnti.

**Completato:** l'ordinamento è unico per scelta dell'owner, dalla data ordine più recente con spareggio per ID, senza selettore; ricordarlo fra le sessioni non richiede uno stato. Ogni elenco ha un'istantanea, un cursore opaco nell'indirizzo (`vista`) che l'elenco aggiunge con una sostituzione senza nuova lettura: elenco, conteggio e «Carica altri» comprendono soltanto gli ordini entrati negli elenchi fino a quell'istante, registrato dalla migration additiva `0030_order_listing.sql` alla prima lettura e al pagamento di un acquisto provvisorio. Un ordine letto prima vale come già presente. Così «Carica altri», dettaglio, Indietro e ricarica ritrovano gli stessi ordini nello stesso ordine e nessun ordine nuovo o recuperato dallo storico si inserisce fra quelli letti. Gli ordini arrivati dopo si contano con gli stessi criteri: se stanno tutti sopra il primo mostrato e l'utente è in cima, senza selezione né dettaglio aperto, entrano subito con una nuova istantanea, che conserva le pagine caricate; altrimenti compare l'indicatore «N nuovi ordini · Mostra», anche per un ordine recuperato dallo storico che finirebbe fra quelli letti. Un nuovo filtro o una nuova ricerca aprono un elenco nuovo. Il negozio scelto nei filtri resta in un cookie del browser: un accesso agli Ordini senza parametri riapre l'elenco con quel negozio nell'indirizzo e nel filtro, soltanto se il negozio è ancora fra quelli filtrabili; «Reimposta filtri» lo dimentica, e ricerca e altri filtri non si ricordano. La selezione conta e sblocca soltanto gli ordini ancora presenti nell'elenco, e il server rilegge comunque quota e diritti. Area reale e anteprima usano gli stessi componenti e le stesse regole; gli scenari con ordini in arrivo li fanno entrare dopo l'apertura.

**Limiti residui:** una richiesta legge al massimo 300 ordini dall'inizio dell'elenco; oltre, l'elenco invita a usare ricerca o filtri invece di dichiarare finiti gli ordini. Un ordine che cambia situazione fiscale o stato mentre un filtro è attivo può entrare o uscire da quell'elenco filtrato alla lettura successiva. Durante l'importazione dello storico gli ordini recuperati dopo l'apertura compaiono con l'indicatore, non in fondo all'elenco.

<a id="m4-04"></a>
#### M4-04 · Drawer e articoli

**Stato:** Completato · **Prerequisiti:** M4-01 · **Contratto:** [§17](#s17)

Realizzare il pannello con URL su desktop e la vista completa mobile, Dettagli/Articoli e ultimo aggiornamento, senza cronologia.

**Criterio di completamento:** Link diretto, ritorno e ricarica funzionano; ricerca e selezione rimangono, con focus e tastiera corretti.

**Completato:** il dettaglio è un pannello laterale su `/app/ordini/:id` con i criteri dell'elenco nell'indirizzo, a tutto schermo sotto i 640px, con le schede Dettagli e Articoli e senza cronologia. Dettagli chiude con la sezione Aggiornamento, che mostra l'ultima modifica dell'ordine su eBay; la lettura dei dati fiscali resta indicata come fonte nel riquadro fiscale. Aperto da una scheda, chiuderlo con X, Esc o Indietro torna alla voce dell'elenco senza aggiungerne una, quindi Indietro non lo riapre; da un collegamento diretto, anche dopo una ricarica, la chiusura sostituisce il dettaglio con l'elenco. Ricerca, filtri, pagine caricate, posizione e selezione restano; con il pannello aperto i nuovi ordini non entrano in cima, così il pannello non si chiude. All'apertura il focus va sul pannello; alla chiusura torna sul titolo della scheda dell'ordine, se è fra quelle caricate, in tutti i browser. Stessi componenti nell'area reale e nell'anteprima.

**Limiti residui:** un ordine aperto con un collegamento diretto ma fuori dalle pagine caricate non ha una scheda su cui riportare il focus, che segue il comportamento predefinito del dialogo.

<a id="m4-09"></a>
#### M4-09 · Contatti dell'acquirente

**Stato:** Completato · **Prerequisiti:** M4-01 · **Contratto:** [§17](#s17) · [D181](DECISION_REGISTER.md)

Mostrare telefono, email e indirizzo di fatturazione in una forma derivata e renderli utilizzabili, senza modificare i valori di eBay (D181).

**Criterio di completamento:** Collegamenti soltanto per valori riconosciuti, inclusi gli alias email eBay, copiabili nel dettaglio. Dati mascherati e forme non riconosciute restano testo. Il collegamento all'alias apre una nuova email senza oggetto o richiesta fiscale precompilati. Stessi componenti nell'area reale e nell'anteprima.

**Completato:** il telefono si mostra in forma internazionale, con il prefisso del Paese di fatturazione quando manca e i cellulari italiani raggruppati; un numero internazionale (con `+` o `00`) già diviso in gruppi conserva quelli della fonte, uno non riconosciuto resta testo. L'email ha il dominio in minuscolo. Gli indirizzi italiani scritti tutto in maiuscolo ricevono le iniziali maiuscole, con particelle, sigle societarie, numeri romani ben formati, civici e «c/o» conservati; «Il» o «Li» restano parole. In scheda telefono ed email sono collegamenti `tel:` e `mailto:`, con la parte locale codificata, così un `?` o un `&` della fonte non aggiungono oggetto o testo; nel dettaglio anche Copia per i tre dati, con il telefono in forma internazionale e l'indirizzo su più righe. La richiesta del Codice Fiscale offre «Scrivi all'acquirente via email» con oggetto e testo già compilati nella lingua scelta, soltanto per un indirizzo reale e mai per un alias eBay. La formattazione è un modulo puro condiviso; lo scenario «Dati discordanti» mostra indirizzo in maiuscolo, cellulare senza prefisso, numero non riconosciuto e alias eBay.

**Limiti residui:** i gruppi del telefono sono calcolati soltanto per i cellulari italiani; gli altri numeri senza separatori mostrano prefisso e numero nazionale. Il prefisso dedotto dal Paese copre i Paesi europei più frequenti, Stati Uniti, Canada e Australia; per gli altri un numero senza prefisso resta testo.

<a id="m4-05"></a>
#### M4-05 · Multiselezione ed export entrypoint

**Stato:** Completato · **Prerequisiti:** M4-03 · **Contratto:** [§12](#s12) · [§17](#s17)

Aggiungere modalità Seleziona, barra contestuale sticky, sblocco multiplo ed Esporta, con conteggi coerenti e conferma.

**Criterio di completamento:** Nessun addebito, sblocco o file generato implicitamente. Ordini assenti o già sbloccati non consumano nuovi recuperi; autorizzazioni rilette.

**Completato:** «Seleziona» mostra le caselle e la barra contestuale fissa con gli ordini selezionati e quelli da sbloccare; contano soltanto gli ordini ancora presenti nell'elenco, e la selezione resta con dettaglio, «Carica altri» e Indietro; lo sblocco di un solo ordine dalla sua scheda la lascia com'è. Lo sblocco multiplo chiede sempre conferma con il numero di ordini e gli sblocchi che resteranno, e si disattiva se la selezione supera la quota invece di sceglierne una parte. Sul server il lotto è un solo commit che rilegge appartenenza, conservazione, diritti e quota: un ordine già sbloccato non consuma, un ordine assente o non più disponibile annulla il lotto senza consumi. Esporta porta alla sezione Esportazione delle Impostazioni il contesto degli Ordini: la selezione se presente, altrimenti l'elenco con filtri, ricerca cifrata e istantanea; dal menu della scheda e dal dettaglio il solo ordine. La sezione dichiara l'ambito e il numero esatto di ordini, contati con le regole dell'elenco e indicando quelli il cui dato resta vuoto perché da sbloccare; il periodo arriva dai filtri e il file nasce soltanto da «Crea file». «Torna agli ordini» e Indietro riaprono lo stesso elenco con la selezione esportata, ripristinata una sola volta: le modifiche successive restano anche dopo un dettaglio o «Carica altri». Stessi componenti nell'area reale e nell'anteprima.

**Limiti residui:** nell'area reale Esporta non compare finché [M6-01](#m6-01) non crea il file e la sezione Esportazione reale, che riceve lo stesso ambito e lo conta con la query D1 dell'elenco; nell'anteprima «Crea file» resta simulato. La selezione esportata si ritrova soltanto nella stessa scheda del browser e per lo stesso elenco, istantanea compresa.

<a id="m4-06"></a>
#### M4-06 · Impostazioni e campanella

**Stato:** Completato · **Prerequisiti:** M2, M1-07 · **Contratto:** [§19](#s19)

Completare tutte le categorie e opzioni delle impostazioni. Autosalvataggio per scelte semplici, Salva per testi; profilo separato e popover notifiche selettivo, senza pagina dedicata 2.0. Come in M4-01, un solo albero di componenti per Impostazioni reali e anteprima. La campanella riceve problemi dei negozi (M2/M3), quota e rinnovi (M5) e comunicazioni di servizio o manutenzione scritte dalla console di M6-04.

**Criterio di completamento:** Inventario delle preferenze coperto; modifiche non salvate protette, errori non presentati come successi, lingua e tema persistenti e coerenti dopo ricarica e nuovo accesso. Prove sui percorsi reali secondo §35 e scenari grafici mantenuti sul test.

Le schermate dei servizi M5/M6 possono essere verificate su contratti/fixture in questa milestone, ma la loro integrazione rimane un requisito tracciato: niente impostazione «salvata» che in realtà non governa alcun servizio.

Integrare le route reali con una sola fonte persistente per ogni preferenza e con i dati effettivi di Profilo e Sicurezza, conservando le integrazioni Auth e Negozi già disponibili. Spostare nei soli scenari sintetici passkey, sessioni e valori dimostrativi; rimuovere rami duplicati e comportamenti simulati dai percorsi reali. I servizi M5/M6 completano gli stessi componenti nei rispettivi task, senza ricostruire le schermate.

**Completato:** `/app/impostazioni/:sezione?` rende le Impostazioni con lo stesso componente dell'anteprima, che riceve categorie e servizi disponibili; Sicurezza è una categoria della pagina e ne riceve le azioni, con metodi e sessioni reali, mentre passkey e sessioni dimostrative stanno negli scenari. Ogni preferenza ha una sola fonte: la migration additiva `0031_user_preferences.sql` conserva lingua, tema, fuso e modello di messaggio IT/EN, con il predefinito dove manca una scelta; la conferma dello sblocco resta in `unlock_preferences` e il consenso marketing in `marketing_consents`, con versione e lingua di ogni scelta. Tema, fuso e consenso si salvano a ogni scelta con attesa ed esito; un rifiuto o un errore di rete riporta il valore salvato e lo dice. Il modello si salva con Salva, resta scritto se il salvataggio non riesce e chiede conferma prima di lasciare la pagina, ricaricarla o chiuderla con modifiche non salvate; gli Ordini usano il testo scelto per ciascuna lingua dell'acquirente. Il tema viene dal server su `<html>`, il fuso governa le date dell'area e la lingua scelta riapre nella propria lingua ogni pagina dell'area, anche dopo un nuovo accesso: la scelta passa da `/app/lingua`, che torna soltanto a pagine dell'area. Navigazione e menu dell'avatar seguono il [§19](#s19); la lingua resta nel menu soltanto prima della conferma dell'email, quando le Impostazioni non sono raggiungibili. La campanella dell'area mostra i negozi da ricollegare e i consensi in scadenza degli ultimi 30 giorni, con il collegamento al negozio; anche i problemi delle letture compaiono soltanto negli ultimi 30 giorni, poi restano negli avvisi di Ordini e Negozi. Letture e «Segna tutte come lette» restano sul server in `notification_reads`, a lotti di 50, e la manutenzione le elimina dopo 30 giorni; una lettura che il server non registra torna da leggere.

**Limiti residui:** fino ai rispettivi servizi l'area reale non mostra Esportazione ([M6-01](#m6-01)), Telegram, acquisto, gestione del piano e negozio attivo del Free ([M5](#m5)), esportazione e cancellazione dell'account e modulo di assistenza ([M6](#m6)); Supporto offre domande frequenti e indirizzo email. La campanella riceve quota e rinnovi con [M5](#m5) e le comunicazioni di servizio dalla console di [M6-04](#m6-04). La pagina del collegamento eBay applica tema e fuso ma non reindirizza alla lingua scelta. Gli avvisi di Ordini e Negozi verso Piano, Notifiche e Supporto restano nascosti finché quelle destinazioni non hanno i servizi.

<a id="m4-07"></a>
#### M4-07 · Onboarding e degradazione

**Stato:** Completato · **Prerequisiti:** M4-01, M2 · **Contratto:** [§20](#s20)

Implementare stati vuoti reali, passaggi riprendibili, prerequisiti funzionali senza wizard bloccante, avanzamento dell’import e avvisi contestuali. Lo stato di Auth o database non disponibili entra negli scenari dell'anteprima ([§35](#s35)).

Riusare gli scenari sintetici di M1-07/M3-05 nelle prove IT/EN e mobile. Con eBay lento o indisponibile, gli ordini persistiti autorizzati restano utilizzabili con timestamp e avanzamento locale, senza skeleton globale né azioni autorizzate da stato obsoleto.

Con quota esaurita mostrare l'azione contestuale verso Piano prevista dal [§20](#s20), mantenendo consultabili i dati non fiscali autorizzati, senza collegamenti a pagine assenti o attivazioni automatiche del trial. La destinazione commerciale effettiva arriva con [M5-03](#m5-03).

**Criterio di completamento:** Prima sincronizzazione e disponibilità fiscale sono distinte; nessun dato demo spacciato per reale, nessun blocco globale quando parti sicure funzionano.

**Completato:** Ordini e Negozi ricavano lo stato delle letture dai dati salvati. Quando le ultime due letture di tutti i negozi attivi dell'ambiente non riescono compare «eBay non risponde» con l'ultimo aggiornamento riuscito, e si sospendono soltanto le azioni che chiamano eBay (Riprova, Sincronizza, Reimporta, Ricollega, anche nell'avviso del consenso in scadenza degli Ordini), pure sul server; un errore isolato non basta. Production e Sandbox rispondono ciascuno per sé in Ordini, Negozi e campanella. La campanella riporta allora un solo avviso di eBay. Se le letture si fermano in un solo negozio, Ordini lo segnala dopo gli avvisi dei collegamenti, con l'ultimo aggiornamento, quando i suoi ordini sono nella vista; la campanella lo riporta finché una lettura non riesce. Passando agli Ordini da un'altra sezione compare lo scheletro dell'elenco al posto della pagina precedente; dentro gli Ordini ricarica e aggiornamenti conservano i dati mostrati. I primi passi compaiono anche durante la prima sincronizzazione, dal punto raggiunto, e un negozio collegato senza ordini indica il periodo letto. Se sessione o database non rispondono, anche in una lettura successiva a quella dell'account, Ordini, Negozi, Impostazioni e Profilo rispondono 503 con «Servizio non disponibile» e Riprova, senza dati. Nell'anteprima lo stesso stato è lo scenario «Servizio non disponibile», mostrato dentro la shell per poter cambiare scenario; «Problema su un negozio» comprende un negozio con le letture ferme e il consenso in scadenza, «eBay non risponde» anche un consenso in scadenza con Ricollega sospeso, «Prima sincronizzazione» il negozio appena collegato. Gli scenari usano gli stessi componenti e, per la campanella, gli stessi testi dell'area reale.

**Limiti residui:** «Sblocchi esauriti» resta senza collegamento al piano finché [M5-03](#m5-03) non crea la destinazione. Con un solo negozio attivo l'indisponibilità di eBay e un problema del negozio non si distinguono. Lo scheletro compare nelle navigazioni dentro l'app: il primo caricamento del documento attende i dati dal server. Stripe non disponibile, pagamento in attesa e cancellazione in corso arrivano con [M5](#m5) e [M6](#m6).

<a id="m4-08"></a>
#### M4-08 · Review visiva e a11y baseline

**Stato:** Completato · **Prerequisiti:** M4-01..M4-07, M4-09 · **Contratto:** [§22](#s22) · [§35](#s35)

Verificare desktop, tablet e smartphone, IT/EN, chiaro/scuro, tastiera, focus, contrasto e movimento ridotto con gli asset approvati. Comprende gli stati aggiunti all'anteprima dopo il checkpoint M1, senza riaprirlo. Verificare gli stessi componenti sulle route reali e nell'anteprima test secondo §35; trasferire le prove funzionali disponibili senza perdere gli scenari per la verifica grafica manuale.

**Criterio di completamento:** E2E e controlli visivi mirati superati; nessuna dichiarazione di certificazione WCAG o supporto browser non provati.

Distinguere approvazione visuale e collaudo end-to-end delle impostazioni: i percorsi billing/Telegram/export vengono ricontrollati su implementazioni reali in M6/M7.

**Completato:** il catalogo delle pagine prova ogni route reale e dell'anteprima, IT/EN, su smartphone, tablet e desktop in chiaro e scuro: la matrice completa aggiunge il tablet a 768 px. Su ogni pagina i primi sei elementi raggiunti con Tab devono mostrare contorno o anello di focus, con il movimento ridotto nessuna animazione dura più di un istante, e axe controlla anche i criteri WCAG 2.2 A/AA, dimensione dei bersagli compresa. Il controllo del focus ha trovato il pannello delle schede senza indicatore, in Accesso e nel dettaglio dell'ordine: ora mostra l'anello come le schede. Le prove dell'anteprima su dettaglio con filtri e Indietro, selezione conservata, dettaglio a schermo intero su smartphone, navigazione inferiore al tocco, pannello scorrevole, superfici dei due temi, copia fallita, lingue con il proprio nome e domande frequenti girano anche sull'area reale; l'area reale ha inoltre prove proprie per navigazione, campanella e menu dell'account, suggerimenti della ricerca, stati vuoti e conferma forte dell'eliminazione di un negozio. Gli screenshot delle pagine reali alle tre larghezze, in Chromium e WebKit, sono stati controllati; la verifica su Chrome del test con un account reale ha trovato due difetti, ora corretti e provati: sul tablet quattro filtri lasciavano l'ultimo da solo in una riga, ora stanno su due colonne (cinque, con il negozio, su tre); l'elenco delle Impostazioni su smartphone descriveva Notifiche e Dati e privacy con Telegram, esportazione e cancellazione ancora assenti, ora ogni descrizione nomina soltanto i servizi disponibili. Il confronto delle due aree sul test, al netto dei limiti dei task M4, ha trovato due divergenze, ora corrette: la riga del negozio reale non indicava il marketplace pertinente del [§18](#s18), ora quello con più ordini del negozio; l'anteprima ignorava il fuso del dispositivo e mostrava «Automatico, dal dispositivo» dove l'area reale indica il fuso rilevato. Le prove locali dell'area reale ricevono ora anche i cookie scritti dalla pagina, con il fuso fissato a Roma.

**Limiti residui:** axe e i controlli automatici aiutano la verifica e non certificano la conformità WCAG. Restano solo nell'anteprima gli stati che l'account locale non raggiunge (sblocchi esauriti, Premium, Esporta, supporto con modulo, eBay non risponde) e le prove che modificherebbero le fixture condivise, come pausa ed eliminazione reale di un negozio. Safari reale non è stato controllato con l'account del test, perché l'accesso all'app non è stato concesso nella sessione: vale la verifica su WebKit. Dispositivi fisici, Safari/iOS e lettori di schermo restano ai gate competenti; billing, Telegram ed export si ricontrollano sulle implementazioni reali in [M5](#m5), [M6](#m6) e [M7-08](#m7-08).

<a id="m5"></a>
### M5 · Free/Premium, Stripe e Telegram

**Prerequisiti:** gate Stripe e modello diritti/sblocchi. **Attività:** cicli/promo/inattività, trial, checkout/portal/link, catalogo generazioni, acquisto durante la prova con addebito alla sua fine, upgrade/lifetime/prorata residua qualificata, webhook/reconciliation, grant admin base, Telegram linking/messaggi/riepiloghi/retry/preferences, comunicazioni pagamento vs prodotto.

**Output:** matrice commerciale osservabile funzionante in test, casi solo-live esplicitamente assegnati al gate finale; configurazione live dopo checkpoint owner senza incassi non autorizzati. **DoD:** nessun doppio incasso/sblocco; diritti post-downgrade Q568, concessioni, rimborsi e lifetime ultimo posto testati; Telegram non è accesso obbligatorio; acquisto eleggibile coperto dal MoR; Paddle inattivo salvo via.

**Dipendenze e accettazione:** completare i cicli/diritti M3 prima dei percorsi commerciali e riusare l'ingresso eventi; configurazione live solo dopo integrazione test e checkpoint. Verificare confini UTC/fuso, fine mese/anno bisestile, promo e quota congelata. Costruzione Q567 (D194) qualificata in sandbox: prezzo ricorrente con `trial_end` alla scadenza originale della prova, almeno due giorni dopo l'acquisto; Test Clock deve provare nessun incasso all'acquisto, un solo addebito alla fine della prova e rinnovo corretto, anche in Link/Portal con cancellazione durante la prova. Posti lifetime: `expires_at` fra 30 minuti e meno di 24 ore, mai liberazione prematura con pagamento asincrono; sessione completata non pagata conserva il posto fino all'esito asincrono. Casi solo-live assegnati al gate commerciale, senza copertura fittizia.

Nel Free integrare scelta del negozio attivo, pause `plan`, vincolo dei 90 giorni ed eccezioni assistite motivate/auditate senza reset di quota, trial o ciclo. Webhook e riconciliazione autonoma con browser chiuso, eventi mancanti/tardivi/fuori ordine, oggetti Stripe non disponibili e outage, senza inventare refund o diritti. Mutation su grant, revoca del solo diritto rimborsato e diritti indipendenti. Telegram rilegge Premium/preferenze all'invio, invalida vecchia chat/consegne, distingue esito remoto incerto e fallimento certo, recupera solo arretrati tecnici e non promette exactly-once (§6, §13).

<a id="m5-01"></a>
#### M5-01 · Cicli, promo e quota Free

**Stato:** Completato · **Prerequisiti:** M3-06 · **Contratto:** [§5](#s05)

Implementare cicli di 7×24 ore dal collegamento, quota congelata nel ciclo e promozione globale configurabile, senza azzeramenti abusabili. Assenza del dato non consuma quota.

**Criterio di completamento:** Test su confini UTC, ora legale, fine promo e accessi concorrenti; sito pubblico e quota personale spiegano correttamente eventuali differenze temporanee.

Integrato da CF Ready e Hub Fatture: i confini si confrontano sull'istante UTC e sul fuso del ciclo, mai sulla data locale ricavata da un timestamp UTC; test con evento nella prima notte del ciclo e fuso a est e a ovest di UTC.

**Completato:** i cicli durano 7×24 ore sull'istante UTC dall'ancoraggio del primo collegamento, che il database non lascia spostare né azzerare; una richiesta concorrente crea un solo ciclo e finestra, quota e utilizzo non tornano indietro. La promozione globale vive in `free_promotions`, senza sovrapposizioni, e si configura senza deploy: il ciclo riceve la quota della promozione in corso al suo inizio e la conserva fino alla fine, anche se la promozione termina o viene accorciata. Il sito pubblico annuncia la promozione con la data finale e poi la quota base; in Impostazioni, Piano, la quota personale indica la quota del proprio ciclo e quella diversa del ciclo seguente, anche nello scenario «Fine della promozione» dell'anteprima. Test su ora legale, prima notte del ciclo con fusi a est e a ovest di UTC, fine promozione, concorrenza e vincoli del database; l'assenza del dato continua a non consumare quota.

**Limiti residui:** il modulo della console per quota base, promozione e date arriva con [M6-04](#m6-04): fino ad allora la promozione si inserisce nella tabella di D1. Le date effettive restano a [M9-01](#m9-01); la pagina prezzi completa con preavviso e confronto dei piani arriva con il sito di [M6](#m6). La quota base resta 5 nel codice. Il controllo di un solo beneficio Free per attività, anche con un account nuovo per lo stesso negozio, resta ai controlli antiabuso di [M5-11](#m5-11).

<a id="m5-02"></a>
#### M5-02 · Trial e grant accesso

**Stato:** Completato · **Prerequisiti:** M5-01 · **Contratto:** [§6](#s06)

Implementare trial interno di 14 giorni scelto dopo la prima sync, senza ripartenze o pause. Distinguere origine dei diritti e acquisizione automatica dei dati durante Premium. Trial attivo con giorni residui negli scenari dell'anteprima ([§35](#s35)).

Nell'area reale proporre il trial con un'azione discreta dopo la prima sync riuscita, anche con zero ordini, soltanto se disponibile. Mostrare il tempo residuo senza un riquadro permanente invasivo e renderlo più evidente vicino alla scadenza, secondo [§20](#s20). Provare disponibilità, attivazione volontaria, trial già usato e scadenza nelle due lingue e nell'anteprima.

**Criterio di completamento:** Il trial da solo non crea abbonamento o addebito. Dati mai aperti e tardivi seguono Q568; la prova non scorre mentre il servizio è in attesa.

**Completato:** la prova è una copertura `trial` di `workspace_entitlements`, senza abbonamento, pagamento o sblocchi: dura 14×24 ore sull'istante UTC dall'attivazione volontaria, non si ferma né riparte e continua anche scollegando il negozio. Si offre allo spazio dopo la prima lettura riuscita di un suo negozio, anche senza ordini, quando non ha un'altra copertura in corso e non ha mai avuto la prova; la migration additiva `0035_workspace_trial.sql` ne ammette una sola per spazio, anche dopo scadenza o revoca, e richieste concorrenti ne attivano una sola. L'origine del diritto resta distinta da quella dei dati: durante la prova i Codici Fiscali arrivati sono leggibili senza sblocco né quota e restano tali dopo la fine anche se mai aperti, mentre quelli arrivati dopo tornano agli sblocchi del Free (Q568); i negozi dello spazio si leggono con la cadenza Premium finché la copertura dura. Ordini propone la prova con una riga e un pulsante dopo la prima lettura, poi mostra i giorni rimasti e negli ultimi tre giorni un avviso con la fine e il rimando al Piano; Piano offre la prova e, attiva, ne indica fine, giorni rimasti e cosa resta dopo. L'anteprima ha gli scenari «Prova Premium», «Prova in scadenza» e «Prova terminata» e l'attivazione simulata una sola volta dagli scenari che la offrono. Prove di dominio su disponibilità, durata, concorrenza, coperture concomitanti, scadenza e Q568, di route su Ordini e Piano, della cadenza di lettura e E2E IT/EN in Chromium e WebKit sull'area reale con account dedicati e sull'anteprima.

**Limiti residui:** la lista d'attesa che sospende l'offerta quando il servizio non è erogabile arriva con [M5-11](#m5-11), che verifica anche che la prova non si ripeta con un account nuovo per lo stesso negozio; fino ad allora la prova parte soltanto dall'attivazione volontaria. Uno spazio che ha avuto soltanto coperture pagate o concesse, ora terminate, può ancora attivare la prova. Acquisto durante la prova e conclusione della prova con il lifetime arrivano con [M5-04](#m5-04) e [M5-07](#m5-07); l'anno di storico durante la prova con [M5-13](#m5-13). Alla fine della prova vale il negozio attivo del Free di [M5-06](#m5-06). La campanella non segnala la fine della prova.

<a id="m5-03"></a>
#### M5-03 · Catalogo e Hosted Checkout

**Stato:** Completato · **Prerequisiti:** G-STRIPE, M5-02 · **Contratto:** [§4](#s04) · [§6](#s06)

Configurare generazioni di prezzo, listino netto e totale comprensibile, conversione ammessa, metodi valutati economicamente e copertura fiscale. Richiedere collegamento e prima sync prima dell’acquisto.

Con la destinazione del piano nell'area reale, l'avviso «Sblocchi esauriti» degli Ordini e gli avvisi di Ordini e Negozi verso Piano, oggi nascosti ([M4-06](#m4-06), [M4-07](#m4-07)), vi portano con i componenti esistenti, senza attivare la prova.

**Criterio di completamento:** Operazioni non coperte bloccate prima della vendita; checkout senza segreti client, nessun passaggio involontario a Paddle o conto PayPal personale.

Dimostrare che le sessioni usano davvero Managed Payments, non Checkout standard. Qualificare opzioni metodi e costo per ticket, Link/descriptor e raccolta dati; nessun custom checkout domain acquistato come requisito.

**Completato:** il listino netto della generazione corrente vive in un solo catalogo, da cui la pagina del piano mostra i prezzi IVA esclusa e la nota sul totale con imposte e valuta del paese, calcolato da Stripe prima del pagamento; la generazione accompagna sessione, abbonamento e pagamento nei metadati. L'acquisto parte dalla pagina del piano soltanto con chiave e prezzi configurati, dopo la prima lettura riuscita di un negozio e senza coperture in corso: prima della lettura i prezzi restano visibili senza azione. Prima di creare la sessione il server rilegge il prezzo su Stripe e ferma la vendita se non è attivo, in euro, netto con `tax_behavior` esplicito `exclusive`, della periodicità attesa o con un prodotto senza codice fiscale; una sessione che Stripe non restituisce in Managed Payments viene chiusa subito. I parametri del Checkout ordinario per imposte, valuta, metodi e fatture non compaiono: conversione e metodi restano a Managed Payments. Il ritorno mostra «Attivazione Premium in corso» o l'annullamento senza attribuire diritti; l'anteprima simula lo stesso ritorno. Con l'acquisto disponibile l'avviso «Sblocchi esauriti» degli Ordini porta al piano. La rotta di checkout separata e mai registrata è stata rimossa.

Sul test, con la sandbox dedicata, la pagina del piano apre sessioni in Managed Payments con i prezzi del listino. Qualifica economica (D193): Managed Payments costa il 3,5% oltre alle commissioni di pagamento e alla Billing dello 0,7% sui ricorrenti; con carta UE standard, Link, Apple Pay o Google Pay, allo stesso costo della carta, e un acquirente italiano il costo è circa 12% del netto sul mensile, 7,5% sull'annuale e 6,3% sul lifetime, fino a 16,5%, 11,9% e 10,7% con carta extra UE e conversione. Restano attivi carta, Link, Apple Pay, Google Pay e Bancontact, solo una tantum e non più caro della carta; Klarna, limitato a clienti USA e una tantum a 4,99% + 0,40 €, e crypto, senza tariffa pubblicata, sono disattivati; PayPal non è offerto da Managed Payments. Sull'estratto conto compare `LINK.COM*` seguito dal descriptor dell'account, «FISCALBAY» nel live. Il checkout raccoglie email, dati di pagamento, nome del titolare, paese e una partita IVA facoltativa, senza telefono né spedizione; ricevute, fatture, supporto alla transazione e gestione dell'ordine passano da Link, e FiscalBay non conserva questi dati.

**Limiti residui:** Acquisto durante la prova con [M5-04](#m5-04); prova e acquisto condividono la stessa regola della prima lettura riuscita. Il lifetime è escluso dalla vendita reale fino alle prenotazioni atomiche di [M5-07](#m5-07). Gli avvisi dei Negozi verso Notifiche e Supporto restano nascosti fino ai rispettivi servizi. Le stime di costo usano le tariffe pubbliche del 2026-10-24 e non osservano un incasso reale: le commissioni effettive si rileggono nel gate commerciale di [M9-01](#m9-01). Nome pubblico, contatti di assistenza e indirizzi di termini e privacy dell'account si impostano dalla dashboard e si riallineano per il live in [M5-12](#m5-12).

<a id="m5-04"></a>
#### M5-04 · Acquisto durante la prova

**Stato:** Completato · **Prerequisiti:** M5-03 · **Contratto:** [§6](#s06)

Implementare Q567 per mensile e annuale secondo D194: durante la prova l'acquisto è possibile, oggi non si paga, i giorni di prova residui restano e il primo addebito arriva alla fine della prova, da cui decorrono rinnovi e periodo pagato.

**Criterio di completamento:** Test temporali e ricevute sandbox dimostrano nessun incasso all'acquisto, un solo addebito alla fine della prova e rinnovo alla data corretta, con testi Stripe coerenti con ciò che accade.

Separare fine della prova, primo addebito e prossimo rinnovo; test sul minimo di due giorni del Checkout e sull'assenza di addebiti prima della fine della prova.

**Completato:** durante la prova l'acquisto mensile e annuale resta disponibile; un diritto diverso dalla prova continua a fermarlo. La sessione Managed Payments in modalità abbonamento porta il solo prezzo ricorrente con `trial_end` alla fine della prova e la sua data nei metadati; con meno di due giorni e dieci minuti residui, che il Checkout rifiuta come prova, l'abbonamento parte subito come un acquisto ordinario. Nella pagina del piano, anche nell'anteprima, la prova mostra le offerte con la data del primo addebito e la nota che con mensile o annuale oggi non si paga, o che il primo addebito è oggi negli ultimi due giorni. Dopo la scelta la prova continua: il piano indica l'abbonamento scelto e la data del primo addebito, senza parlare di pagamento in attesa né offrire un secondo acquisto, anche nello scenario «Prova con abbonamento scelto» dell'anteprima; il ritorno da Stripe durante la prova annuncia la scelta in corso. Sandbox del 2026-10-24: Managed Payments rifiuta `custom_text` e un `billing_cycle_anchor` oltre il primo periodo, quindi un incasso anticipato può rinviare il rinnovo soltanto come prova gratuita, presentata da Stripe come «giorni gratuiti» anche per il periodo pagato: da qui D194. Con Test Clock, prova originale fino al 31 gennaio: all'acquisto una fattura da zero «Prova gratuita», alla fine della prova un solo addebito di 4,90 € o 49 €, poi rinnovo il 28 febbraio e il 31 gennaio dell'anno dopo. Dal test, durante una prova reale, le sessioni mensile e annuale si aprono in Managed Payments con il primo addebito alla fine della prova. Ordini e Piano contano i giorni di prova rimasti come il Checkout, soltanto interi, e nell'ultimo giorno scrivono «meno di un giorno rimasto», così il cliente non legge due numeri diversi.

**Limiti residui:** il diritto Premium dell'abbonamento arriva con [M5-05](#m5-05): durante la prova lo copre la prova interna, alla fine il primo addebito riuscito. Un addebito fallito alla fine della prova segue i pagamenti falliti di [M5-05](#m5-05). La sessione Checkout completata dal cliente, con imposte e metodi dinamici, si osserva con il webhook di [M5-05](#m5-05). L'app Link non mostra gli acquisti di prova: la sua rappresentazione resta al gate commerciale di [M9-01](#m9-01). Il lifetime durante la prova, pagato subito, arriva con [M5-07](#m5-07).

<a id="m5-05"></a>
#### M5-05 · Webhook e riconciliazione

**Stato:** Completato · **Prerequisiti:** M5-03 · **Contratto:** [§6](#s06) · [§28](#s28)

Verificare firme sul corpo originale, persistenza, idempotenza ed eventi fuori ordine. Riconciliare dal server, applicando subito Free al rinnovo fallito e sette giorni di tutela del prezzo. Stripe non disponibile e pagamento ricevuto in attesa di attivazione negli scenari dell'anteprima ([§35](#s35)).

Provare browser chiuso dopo pagamento, evento mancante/tardivo, errore di accodamento e riavvio. La riconciliazione autonoma usa la stessa logica di grant, priorità e cadenze motivate dai limiti Stripe; riusare timeout e limiti HTTP, senza doppi retry o doppi diritti.

**Criterio di completamento:** Un redirect falso non attiva Premium e un evento duplicato non raddoppia i diritti. Un outage Stripe non blocca l’uso già autorizzato né concede proroghe indefinite.

Eventi out-of-order o dati Stripe non più disponibili non significano automaticamente acquisto inesistente o refund. I corpi grezzi dei webhook non diventano archivio fiscale permanente.

**Per chiudere:** il webhook Stripe usa l'ingresso Worker già qualificato in [M3-11](#m3-11), con segreto e effetti commerciali configurati qui.

Integrato da CF Ready e Hub Fatture: ciclo periodico che riconcilia i diritti attivi con Stripe come rete di sicurezza, senza inventare diritti in caso di errore; ogni passo periodico registra il proprio errore senza fermare gli altri; priorità di recupero una sola volta per gli elementi mai tentati. Mutation test mirati sui diritti Stripe.

**Completato:** il consumer dell'ingresso condiviso riceve dalla ricevuta soltanto tipo di evento e identificativo, rilegge da Stripe sessione, fattura o abbonamento e ne applica lo stato corrente: duplicati, ritardi e arrivi fuori ordine portano alla stessa rilettura, e una rilettura più vecchia conclusa dopo una più recente non ne sovrascrive lo stato. Lo spazio viene dai metadati scritti dal checkout sul server; un abbonamento senza quei riferimenti, dell'altro ambiente o di uno spazio inesistente non ha effetti. La migration additiva `0036_stripe_subscriptions.sql` conserva stato, periodo, periodicità e generazione del listino dell'abbonamento e lega ogni copertura `premium` alla fattura pagata, con importo, valuta e istante del pagamento, una sola volta per fattura. La copertura dura il periodo pagato, letto dalle righe dell'abbonamento della fattura: l'abbonamento scelto durante la prova di [M5-04](#m5-04), che Stripe registra come `trialing` senza incasso, non crea coperture finché la prova non finisce e il primo addebito copre dalla fine della prova al rinnovo. Un rinnovo non pagato non ne crea una e lo spazio torna subito al Free, mentre la regolarizzazione entro sette giorni dall'inizio del periodo crea la copertura contigua al vecchio prezzo; allo scadere della tutela FiscalBay chiude su Stripe l'abbonamento ancora non pagato. Finché un abbonamento può incassare, il nuovo acquisto resta fermo e la prova non si offre né si attiva. Un oggetto non più disponibile su Stripe viene segnalato senza revoche né rimborsi presunti; con Stripe irraggiungibile la ricevuta si ripete con il backoff della coda, l'uso già pagato prosegue e finisce con il suo periodo. Il client delle letture non ripete le richieste per conto proprio e riusa timeout e limite dei byte del confine HTTP. Il compito orario `billing` del cron rilegge le sessioni completate degli ultimi due giorni senza abbonamento locale, poi fino a 25 abbonamenti per turno: prima rinnovo scaduto o tutela finita mai riletti dopo quell'istante, poi pagamenti senza copertura da oltre un'ora, poi una rilettura al giorno; ogni tentativo, anche fallito, aggiorna il turno dell'abbonamento e ogni errore si registra senza fermare gli altri. Il piano mostra periodicità e rinnovo o fine dopo la disdetta, l'attivazione in corso finché Stripe non conferma, durante la prova l'abbonamento scelto con la data del primo addebito, e il rinnovo non riuscito con la data della tutela; l'anteprima ha gli scenari «Prova con abbonamento scelto», «Pagamento in attivazione», «Rinnovo non riuscito», «Rinnovo disdetto» e «Stripe non disponibile». Un E2E IT/EN apre gli stessi quattro stati dell'abbonamento nell'area reale, con account locali sintetici, e nello scenario corrispondente dell'anteprima, con gli stessi testi e senza prova né secondo acquisto. Il modulo rientra nella campagna mutation dei domini critici. Prove sul consumer, sul cron e sul dominio con Stripe simulato: redirect falso, eventi duplicati e fuori ordine, abbonamenti estranei, pagamento asincrono, rinnovo fallito e regolarizzato, chiusura dopo la tutela, oggetto non disponibile, outage, browser chiuso e priorità del recupero.

Qualificato sul test il 2026-10-24 con [#416](https://github.com/max23468/FiscalBay/pull/416): l'endpoint della sandbox invia i sette eventi di [RELEASE](engineering/RELEASE.md) e il Worker ne verifica la firma con `STRIPE_WEBHOOK_SECRET`. Con un Test Clock e metodi di pagamento di prova dell'API, su uno spazio sintetico poi rimosso, primo pagamento, rinnovo, pagamento fallito, regolarizzazione, disdetta a fine periodo e annullamento sono arrivati dal webhook in pochi secondi: coperture contigue legate alle fatture, `past_due` senza coperture nuove e coperture pagate conservate dopo l'annullamento. Un acquisto durante la prova dal Checkout del test, con l'endpoint disattivato, è stato recuperato dal compito `billing` senza alcun evento come abbonamento `trialing` scelto, senza coperture anticipate, e il piano reale lo ha mostrato come scelto. Nella sandbox Smart Retries riprova fino a 8 volte entro una settimana e annulla l'abbonamento se falliscono tutte; la chiave del Worker test è la chiave segreta standard della sandbox.

**Limiti residui:** la chiusura su Stripe allo scadere della tutela del prezzo è provata sul dominio, non sul test, dove richiederebbe sette giorni reali. Endpoint, tentativi e una chiave con limitazioni dell'account live si configurano con [M5-12](#m5-12). Rimborsi e dispute revocano la copertura della fattura con [M5-08](#m5-08). Il lifetime resta fuori vendita fino a [M5-07](#m5-07). Gestione dell'abbonamento, disdetta e cambio periodicità da Portal e Link arrivano con [M5-06](#m5-06). Durante l'ora che Stripe impiega a incassare un rinnovo il piano indica l'attivazione in corso; il pagamento confermato copre poi anche quell'intervallo.

<a id="m5-06"></a>
#### M5-06 · Cambi piano e Portal/Link

**Stato:** Completato · **Prerequisiti:** M5-05 · **Contratto:** [§6](#s06)

Implementare cambi periodicità alla scadenza, protezione di entrambi i prezzi originari, disdetta e cambio carta da Link/Portal, accesso ai documenti mediante link.

**Criterio di completamento:** Gli eventi nativi del provider rispettano i diritti; scollegare un negozio non disdice l’abbonamento e le email di pagamento non vengono duplicate.

Prove client Link/Portal e comunicazioni distinguono sandbox e live; i casi non riproducibili nel primo sono assegnati a M9-01. Cambio carta tramite provider non richiede una copia completa nel DB FiscalBay.

Da M2-06, per decisione owner del 2026-10-05: scelta del negozio attivo nel Free (D155), pausa del piano per gli altri negozi con la ragione `plan` già prevista da `ebay_store_pauses`, vincolo di sostituzione ogni 90 giorni non spostato dal ricollegamento ed eccezioni assistite motivate e registrate in audit, senza reset di quota, prova o ciclo.

Applicare il downgrade anche alla conservazione: negozi eccedenti e ordini fuori dalla finestra Free diventano subito non consultabili né aggiornabili, restano conservati per 30 giorni transitori ove consentito e poi vengono eliminati secondo [§6.4](#s06) e [§30](#s30). Integrare i termini di accesso e pulizia già disponibili da M3-08 con lo storico di [M5-13](#m5-13), senza cancellare diritti acquisiti ancora validi né rinviare eliminazioni obbligatorie. Provare scadenza con pulizia sospesa, ritorno a Premium prima e dopo la cancellazione e lavori pendenti, senza ripristinare dati eliminati.

**Implementazione locale:** senza una copertura in corso lo spazio ha un solo negozio eBay attivo, registrato in `free_store_changes` dalla migration additiva `0037_free_store.sql`; gli altri hanno la pausa `plan`, che ferma letture e rinnovi dei token, nasconde gli ordini e prevale sul consenso scaduto nello stato mostrato. Senza scelta vale il primo negozio ancora collegato, registrato quando il Free si applica: scollegarlo e ricollegarlo non sposta il negozio attivo né il vincolo. Con una copertura il predefinito si dimentica e al downgrade successivo vale di nuovo il primo ancora collegato (D155). La scelta compare soltanto nel Free, in Piano, con una conferma che nomina il negozio messo in pausa: la prima è sempre ammessa, le successive ogni 90×24 ore, e scelta e pause sono un unico commit anche con richieste concorrenti. L'eccezione assistita è una riga `assisted` con motivo e autore obbligatori, immutabile come le scelte, che conta come sostituzione e non tocca quota, prova o ciclo. Nello stesso riallineamento gli ordini tornano alla finestra di 30 giorni dalla data e quelli che la perdono restano, non consultabili, 30 giorni dal downgrade; i negozi esclusi conservano i dati 30 giorni dalla pausa; nessun termine si allunga. Il riallineamento parte dal cron prima dello smistamento delle letture, a ogni pagina dell'area e al collegamento di un negozio, che nel Free entra in pausa prima della prima lettura. La Sandbox eBay resta fuori dal limite. Contratto nel [downgrade](engineering/DATA_RETENTION.md#downgrade).

Il cambio di periodicità parte dal Piano: il prezzo dell'altra periodicità si cerca nella generazione salvata nei metadati dell'abbonamento, anche se non è più la corrente, e deve restare conforme al listino; si applica con `trial_end` alla fine del periodo pagato e `proration_behavior` `none`, quindi nessun addebito fino al rinnovo, e lo stesso pulsante lo annulla fino ad allora. La migration additiva `0038_subscription_renewal.sql` conserva la periodicità del rinnovo accanto a quella del periodo pagato, rilette da Stripe a ogni evento: il Piano indica «Si rinnova il … come annuale». Il Portal di Stripe, con il cliente dello spazio e il ritorno al Piano, gestisce disdetta, metodo di pagamento, ricevute e fatture; FiscalBay non conserva dati di pagamento né copie dei documenti e non invia email di pagamento, che restano a Stripe e Link. Disdetta e cambio di carta fatti dal Portal o da Link tornano con il webhook di [M5-05](#m5-05). Il Portal si apre anche durante la prova con un abbonamento scelto, che si disdice prima del primo addebito e lì si riattiva: disdetto, il Piano indica che alla fine della prova si torna al Free senza addebiti. Il cambio di periodicità aspetta invece il primo periodo pagato. Scollegare l'ultimo negozio collegato con un abbonamento che addebiterà ancora, rinnovo o primo addebito a fine prova, lo dice nella conferma, con il rimando alla gestione dell'abbonamento. L'anteprima ha lo scenario «Cambio di rinnovo» e le stesse risposte alle azioni.

Prove di dominio e di route su predefinito, scollegamento, copertura e downgrade, vincolo e concorrenza, eccezione assistita, pulizia sospesa, ritorno a Premium prima e dopo la cancellazione, cron, cambio e annullamento della periodicità, listino della generazione, prezzi non conformi, abbonamento disdetto e Portal. E2E IT/EN in Chromium e WebKit: scelta con conferma nell'area reale e nell'anteprima, stessi stati dell'abbonamento e stesso avviso allo scollegamento sulle due superfici. L'account di collaudo resta Free con un negozio attivo e tre in pausa per il piano; un account Premium con due negozi copre il filtro del negozio.

**Prove sandbox (2026-10-24):** con Test Clock, un abbonamento mensile e uno annuale aggiornati al prezzo dell'altra periodicità della stessa generazione, con `trial_end` alla fine del periodo pagato e `proration_behavior` `none`: al cambio una fattura a zero, nessun addebito; il mensile passa all'annuale con un solo incasso alla scadenza del mese, l'annuale passa al mensile alla scadenza dell'anno. Il Portal non può programmare un passaggio a una periodicità più lunga senza conguaglio immediato e non lascia disdire un abbonamento con una modifica programmata: per questo il cambio parte dall'app e non usa le Subscription Schedules.

**Collaudo sul test (2026-10-25):** con un annuale Managed Payments scelto durante la prova sull'account dell'owner, il Piano ha mostrato l'abbonamento scelto con il primo addebito e il pulsante del Portal. Il Portal offre annullamento, cambio del metodo di pagamento e documenti e indica il primo addebito con l'IVA; il ritorno porta al Piano. La conferma di scollegamento dell'unico negozio ha mostrato l'avviso, poi annullata. Disdetta e riattivazione dal Portal sono arrivate dal webhook nella D1 del test in circa tre secondi: Stripe registra la disdetta come `cancel_at` alla fine della prova. Dopo la disdetta il Piano annunciava ancora il primo addebito: corretto, ora indica il ritorno al Free senza addebiti; l'avviso allo scollegamento non nomina più un rinnovo prima del primo addebito.

**Limiti residui:** la modifica di un abbonamento Managed Payments pagato non è osservata: le prove Test Clock usano abbonamenti ordinari con gli stessi prezzi e l'annuale del collaudo è stato chiuso prima del primo addebito, quando lo spazio dell'owner è passato a vita. Cambio e annullamento della periodicità e cambio del metodo di pagamento letto nell'app si verificano al passaggio al live, nelle prove commerciali di [M9-01](#m9-01) ([D196](DECISION_REGISTER.md)). I prezzi di una generazione precedente devono restare attivi su Stripe, fuori dal checkout, finché esistono abbonamenti che la usano. Portal live con termini, privacy e ritorno di fiscalbay.it in [M5-12](#m5-12); documenti del lifetime con [M5-07](#m5-07); interfaccia dell'eccezione assistita con la console di [M6-04](#m6-04), fino ad allora la riga si inserisce in D1; termine di un anno da ripristinare al ritorno a Premium con [M5-13](#m5-13). L'app Link non mostra gli acquisti di prova, come già in [M5-04](#m5-04).

<a id="m5-07"></a>
#### M5-07 · Lifetime e concessioni

**Stato:** Completato · **Prerequisiti:** M5-05 · **Contratto:** [§6](#s06) · [§15](#s15)

Gestire 20 disponibilità fra vendite e omaggi, prenotazioni atomiche con scadenza, detrazione del residuo effettivamente pagato, grant amministrativi ed estensioni con stop/rinvio dei rinnovi.

**Criterio di completamento:** Test ultimo posto concorrente, webhook tardivo e rimborso; nessuna sovravendita o incasso fittizio. Lifetime valido anche dopo cambio provider.

La scadenza locale della prenotazione deve essere coerente con la possibilità residua di incasso del checkout. Provare ultimo posto, sessione scaduta, pagamento asincrono, conferma tardiva e ripresa dopo crash: nessuna liberazione prematura.

Dati qualificati in M0-08: `expires_at` fra 30 minuti e meno di 24 ore; `checkout.session.expired` libera il posto solo se la sessione non è stata completata; i metodi dinamici includono anche Bancontact, quindi una sessione completata con pagamento non ancora confermato tiene il posto fino a `checkout.session.async_payment_succeeded` o `failed`.

**Completato:** i venti posti restano in `lifetime_allocations`, dove il numero del posto è il vincolo atomico del tetto. La migration additiva `0039_lifetime_sales.sql` distingue vendita e omaggio, aggiunge scadenza della prenotazione, completamento in attesa del pagamento, cliente Stripe e attivazione, e lega il diritto `lifetime` a un posto attivo dello stesso spazio, uno per spazio, con la sessione Checkout pagata oppure autore e motivo dell'omaggio come prova. Un posto attivo non si elimina né cambia, neanche dopo un rimborso; la cancellazione dell'account lo lascia occupato con i riferimenti all'acquisto.

L'acquisto dalla pagina del piano prenota il primo posto libero prima di creare la sessione, che scade dopo un'ora insieme alla prenotazione, e lega la sessione al posto prima di mandare il cliente su Stripe. Una sessione precedente dello stesso spazio si chiude prima di aprirne un'altra, così un posto ha una sola sessione che può incassare; un errore prima del collegamento libera subito il posto. Il posto si libera soltanto quando Stripe conferma la sessione scaduta o il pagamento asincrono fallito: una sessione completata con il pagamento in conferma lo tiene oltre la scadenza, e intanto mensile e annuale restano fermi. Il ritorno da Stripe e il pagamento in conferma annunciano «Premium a vita in attivazione», anche durante la prova o con un abbonamento, che resta fino alla conferma. Webhook `checkout.session.*` e compito `billing` rileggono la sessione con lo stesso codice: il pagamento confermato attiva il posto e crea il diritto senza scadenza con importo, valuta e istante dell'incasso. Una conferma arrivata dopo una liberazione occupa il primo posto libero oppure, a posti finiti, si registra per l'assistenza senza diritto né rimborso automatico. Il cron chiude le sessioni rimaste aperte oltre la scadenza e libera alla scadenza una prenotazione mai legata a una sessione, come dopo un crash.

Il lifetime si acquista anche durante la prova o con un abbonamento: il diritto è immediato e prevale su prova e abbonamento nel piano, e l'abbonamento si chiude subito su Stripe senza conguaglio; quello scelto durante la prova non arriva al primo addebito. Con un periodo pagato in corso si paga il listino corrente meno il valore netto del periodo non ancora usato, proporzionale al tempo sull'istante UTC, nella generazione dell'abbonamento: un coupon da usare una volta, sul solo prodotto lifetime ed entro la scadenza della sessione, chiamato «Periodo pagato non usato». Prova e concessioni non si detraggono. Con il rinnovo o il primo addebito entro la durata del checkout il passaggio aspetta il rinnovo. Il piano mostra il lifetime accanto a mensile e annuale, nel Premium come «Passa a vita» con la detrazione e la chiusura dell'abbonamento, e «Posti esauriti» a posti finiti; il lifetime acquistato apre i documenti dal Portal con il proprio cliente Stripe.

Le concessioni sono funzioni di dominio con autore e motivo obbligatori, senza incasso e senza effetti su quota, prova o ciclo. Premium per 1-366 giorni parte dalla fine dell'ultima copertura in corso e, con un abbonamento che si rinnova, ne rinvia il rinnovo o il primo addebito alla fine della concessione con `trial_end` e senza conguaglio; un rinnovo disdetto non si riattiva e la concessione prolunga soltanto il diritto. Il lifetime in omaggio consuma un posto e chiude l'abbonamento. Il piano indica la fine del Premium concesso, il rinnovo rinviato e il lifetime concesso senza documenti su Stripe. L'anteprima ha gli scenari «Lifetime esaurito», «Passaggio a vita in conferma», «Premium concesso» e «Premium a vita concesso», con le stesse regole dell'area reale per offerta, detrazione e ritorno da Stripe; gli scenari Premium mostrano il passaggio a vita con la detrazione.

Prove di dominio e di route su ultimo posto con acquisti concorrenti, sessione scaduta, pagamento asincrono riuscito e fallito, conferma tardiva, errore di Stripe nella creazione della sessione, crash fra prenotazione e sessione, sessione precedente chiusa, pagamento senza posto, rimborso che non libera il posto, detrazione con fine mese e anno bisestile, rinnovo imminente, prova con abbonamento scelto, omaggio e concessioni con rinnovo rinviato o disdetto, oltre ai vincoli del database sui posti. E2E IT/EN in Chromium e WebKit sull'anteprima per passaggio a vita, conferma in corso, posti esauriti, concessioni e ritorno del lifetime durante la prova, e per il passaggio a vita negli stati dell'abbonamento accanto all'area reale.

Qualificato sul test il 2026-10-25 con [#424](https://github.com/max23468/FiscalBay/pull/424). L'endpoint della sandbox riceve anche `checkout.session.expired`. In Managed Payments la sessione lifetime si apre con la scadenza a un'ora, con `customer_creation` per un nuovo cliente o con il cliente esistente, e il coupon del credito porta il totale da 149 a 146,55 € netti. Dall'app, sullo spazio dell'owner durante la prova con un annuale scelto: un secondo «Scegli a vita» chiude la sessione precedente e ne apre una sullo stesso posto; la sessione abbandonata, chiusa su Stripe, libera il posto in pochi secondi tramite il webhook; il pagamento con la carta di prova attiva il posto 1 e il diritto senza scadenza con importo, valuta e istante dell'incasso, e chiude subito l'annuale senza addebiti.

**Limiti residui:** la detrazione del periodo pagato non usato è provata in sandbox e sul dominio, non con un acquisto dall'app, perché sul test nessuno spazio aveva un periodo pagato in corso; lo spazio dell'owner sul test resta a vita e i collaudi seguenti di prova e abbonamenti usano un altro account. L'interfaccia delle concessioni e la vista di posti venduti, omaggi e residui arrivano con la console di [M6-04](#m6-04); fino ad allora le concessioni non sono raggiungibili dall'interfaccia. Il lifetime rimborsato si revoca con [M5-08](#m5-08) e il posto resta occupato. Il recupero del lifetime dopo la cancellazione dell'account, dai riferimenti del posto, si verifica con [M7-02](#m7-02). Il residuo dei posti sul sito pubblico arriva con il sito di [M6](#m6). Una nuova generazione del listino deve conservare nel catalogo quella precedente: senza, il passaggio a vita di chi la usa non si propone.

<a id="m5-08"></a>
#### M5-08 · Rimborsi, dispute e recovery commerciale

Con il tooling di M1-09, mutation test mirati provano che il rimborso revochi soltanto il grant correlato, preservando diritti indipendenti. Coprire riconciliazione senza browser, eventi duplicati e arrivo fuori ordine insieme a M5-05.

**Stato:** Completato · **Prerequisiti:** M5-06, M5-07 · **Contratto:** [§6](#s06) · [§30](#s30)

Revocare dopo rimborso totale soltanto il diritto collegato. Gestire dispute, rimborsi del supporto provider, escalation e cancellazione account coordinata con i rinnovi.

**Criterio di completamento:** Nessun altro diritto legittimo cancellato; rimborso parziale non convertito automaticamente in giorni; casi temporali e schermate coerenti.

Includere cancellazione finanziaria tramite Link: verificare segnale/ambito, annullamento subscription e perdita oggetti, senza eliminare tacitamente lo spazio o ricreare i dati cancellati. Conservare soltanto la prova dei diritti lecita e necessaria.

**Implementazione locale:** con Managed Payments rimborsi e dispute li decide anche Stripe: l'assistenza Link rimborsa entro 60 giorni e Stripe gestisce le dispute. FiscalBay rilegge il pagamento e revoca soltanto la copertura che ha pagato quando il cliente ha riavuto l'intero importo: rimborsi riusciti pari all'addebito oppure disputa persa. La migration additiva `0040_payment_reversals.sql` registra sulla copertura la revoca, con il motivo `refund` o `dispute` immutabile, e la somma dei rimborsi riusciti. Un rimborso in corso o fallito non revoca; un rimborso parziale si registra senza diventare giorni; una disputa aperta o vinta non revoca. Rimborso parziale, disputa aperta e disputa persa arrivano all'assistenza come segnalazioni senza importi né riferimenti. Prova, concessioni, altre fatture e diritti di altri spazi restano; gli sblocchi del ciclo Free restano, mentre gli ordini sbloccati soltanto dalla copertura revocata tornano bloccati e il downgrade parte dall'istante della revoca. Il lifetime rimborsato lascia il posto occupato e non torna in vendita allo spazio, che può acquistare mensile e annuale; un abbonamento acquistato dopo non viene chiuso.

Gli eventi `charge.refunded`, `charge.refund.updated`, `charge.dispute.created` e `charge.dispute.closed` portano dal payment intent alla fattura o alla sessione lifetime che l'ha incassato, poi alla stessa rilettura di [M5-05](#m5-05) e [M5-07](#m5-07). La riconciliazione dell'abbonamento legge una volta gli addebiti del cliente e interroga rimborsi e dispute soltanto per quelli che ne hanno; il cron rilegge ogni giorno i lifetime venduti e non revocati. Duplicati, arrivi fuori ordine e un rimborso segnalato prima della fattura portano alla stessa revoca, che non si sposta né si annulla. Un periodo rimborsato non è un pagamento da confermare e il cron non lo rilegge ogni ora. Il piano spiega il ritorno al Free con «Pagamento rimborsato»: per il periodo in corso con il rinnovo che riporta Premium, per il lifetime con il solo ritorno al Free. L'anteprima ha gli scenari «Pagamento rimborsato» e «Lifetime rimborsato».

La cancellazione dei dati finanziari tramite Link arriva come `customer.deleted`. Vale soltanto per un cliente ancora cancellato su Stripe e di uno spazio di questo ambiente: la tabella `stripe_customer_erasures` lo registra una volta, l'abbonamento chiuso da Stripe si rilegge senza leggere gli addebiti cancellati, portale e passaggio a vita non usano più quel cliente e l'assistenza riceve la segnalazione. Coperture pagate e spazio restano, senza revoche, rimborsi o nuovi clienti creati da FiscalBay. La stessa registrazione, con autore e motivo, copre una cancellazione segnalata all'assistenza fuori webhook. Per la cancellazione dell'account la funzione di stop dei rinnovi chiude subito su Stripe gli abbonamenti che possono ancora addebitare, senza conguaglio né rimborso, e fa scadere le sessioni lifetime aperte; conferma soltanto quando nulla può più addebitare, altrimenti lascia al job la ripetizione e l'alert.

Prove di dominio e di route con Stripe simulato su rimborso totale fra diritti indipendenti, rimborso parziale, in corso, fallito e ripetuto, rimborso prima della fattura, eventi duplicati e fuori ordine, dispute aperta, vinta e persa, evento di un pagamento estraneo, lifetime rimborsato con omaggio di un altro spazio e abbonamento successivo, rilettura giornaliera dei lifetime senza webhook, cancellazione Link con cliente ancora presente, estraneo e ripetuta, stop dei rinnovi senza chiave, con Stripe non disponibile, già fermo e con l'abbonamento sparito. Il modulo dei rimborsi rientra nella campagna mutation dei domini critici. E2E IT/EN in Chromium e WebKit: periodo rimborsato e lifetime rimborsato nell'area reale e nello scenario corrispondente dell'anteprima.

**Collaudo sul test (2026-10-25):** l'endpoint della sandbox riceve i cinque eventi nuovi. Con un Test Clock e tre spazi sintetici poi rimossi: il rimborso parziale di un abbonamento si registra senza revoca e il resto revoca la copertura con motivo `refund`; una disputa aperta o vinta non revoca, una persa revoca con motivo `dispute`; il cliente cancellato su Stripe si registra, con l'abbonamento chiuso e copertura e spazio conservati; la pulizia, con gli spazi già eliminati, non ricrea dati. La rilettura giornaliera dei lifetime ha girato sul test. Il rimborso parziale del lifetime dell'owner non arrivava alla sessione: Managed Payments emette una fattura anche per l'acquisto una tantum e l'evento si fermava a quella fattura senza abbonamento. Ora una fattura senza abbonamento porta alla sessione Checkout del pagamento.

Dopo la correzione ([#432](https://github.com/max23468/FiscalBay/pull/432)) il rimborso del resto del lifetime dell'owner ha revocato il diritto con motivo `refund` e importo di 181,78 €, con il posto occupato; lo spazio è tornato alla prova residua, acquistata prima del lifetime (D197). Il lifetime dell'owner è stato poi ripristinato a mano nella D1 del test, con autore e motivo, su sua autorizzazione: un intervento sui dati di prova, mai un percorso dell'app.

**Limiti residui:** le segnalazioni all'assistenza sono righe del log strutturato: alert deduplicati e vista nella console arrivano con [M6-04](#m6-04) e [M7-04](#m7-04), le richieste dell'assistenza Link con termine con il contatto di [M5-12](#m5-12). La cancellazione segnalata dall'assistenza si inserisce in D1 fino alla console. Lo stop dei rinnovi entra nel job di [M6-12](#m6-12). Un rimborso su un abbonamento già chiuso, senza webhook, dipende dai tentativi della coda: il cron rilegge soltanto abbonamenti aperti e lifetime. Il segnale reale di una cancellazione tramite Link non è riproducibile nella sandbox.

<a id="m5-09"></a>
#### M5-09 · Telegram link e preferenze

**Stato:** Completato · **Prerequisiti:** M3, M2, M5-02 · **Contratto:** [§13](#s13)

Integrare bot privato e bot test separato, token monouso, cambio chat, preferenze off/soli fiscali/tutti, scelta negozi e messaggi singoli o digest nel fuso configurato.

**Criterio di completamento:** Nessuna notifica alla vecchia chat o ad altri spazi; default rispettati e login web indipendente da Telegram.

Le notifiche riguardano soltanto ordini definitivi: un acquisto provvisorio non genera messaggi finché non diventa definitivo (D180). I job rileggono il diritto Premium e le preferenze al momento dell’invio. Collegamento, cambio chat e disattivazione invalidano le consegne incompatibili già accodate. La route reale dei Negozi (M2-07) passa oggi `notifications: null`: qui riceve lo stato per negozio.

Integrato da CF Ready e Hub Fatture: il webhook Telegram entra dall'ingresso Worker di M3-11, già compreso nel prerequisito M3.

**Completato:** ogni Worker ha il proprio bot: nome in `cloudflare.config.ts` (`fiscalbay_bot` in Production, `fiscalbay_test_bot` sul test), token e segreto del webhook come segreti facoltativi; senza i tre valori Notifiche mostra soltanto le comunicazioni e l'ingresso risponde 503. «Collega Telegram», con Premium, prova o lifetime, crea un deep link con 32 byte casuali valido 15 minuti e legato a spazio, utente e sessione: in D1 resta l'impronta, chiudere la sessione lo elimina e un nuovo link sostituisce quello non usato. Il link si apre in una nuova scheda e la pagina si rilegge finché la chat non cambia. `/webhooks/telegram` verifica il segreto del webhook e accetta soltanto `/start` in una chat privata: la ricevuta conserva chat e impronta del token, mai il testo, e la coda porta il suo identificativo. La migration `0041_telegram_links.sql` ricostruisce `webhook_receipts` per ammettere il provider e aggiunge richieste, collegamento, preferenze e scelte per negozio. Il consumer consuma il token una volta sola, entro la scadenza all'istante del messaggio, con sessione e appartenenza allo spazio ancora valide, rilegge il nome della chat da Telegram e risponde nella lingua della richiesta; lo stesso aggiornamento riprovato ripete soltanto la conferma. Una chat per spazio: quella nuova sostituisce la precedente nello stesso commit dopo il suo «Avvia», con una nuova generazione del collegamento, e fino ad allora la precedente resta. La stessa chat può servire più spazi, ciascuno con il proprio collegamento. Preferenze salvate a ogni scelta: notifiche attive, soli ordini con dato fiscale o tutti, un messaggio per ordine o riepilogo giornaliero alle 8, 12, 18 o 21 nel fuso dell'account fissato al collegamento e a ogni scelta di frequenza o orario, negozi inclusi di predefinito. `telegramRecipient` rilegge all'invio Premium, chat, preferenze e negozio, scarta la consegna preparata per un collegamento sostituito e gli eventi precedenti a collegamento o riattivazione: è il contratto degli invii di [M5-10](#m5-10). Negozi mostra lo stato per negozio con Premium e la scorciatoia verso Notifiche. L'anteprima conserva le chat dimostrative e simula il collegamento negli scenari Premium senza chat.

Prove di dominio e di route su ingresso (metodo, segreto, corpo, aggiornamenti ignorati, ricevuta senza token, deduplica), collegamento, token monouso, scaduto, sostituito, di una sessione chiusa o di chi ha lasciato lo spazio, risposta senza token, nuovo tentativo dopo il limite di Telegram, bot bloccato, chat senza nome, cambio chat con le consegne della precedente senza destinatario, preferenze e riattivazioni, fuso del riepilogo, isolamento fra spazi, Premium scaduto, pagine Impostazioni e Negozi, errori della Bot API e pulizia. E2E IT/EN in Chromium e WebKit: chat collegata con preferenze e negozi salvati e riletti, collegamento con il deep link e attesa dell'«Avvia», scenario dell'anteprima senza chat.

**Collaudo sul test (2026-10-25):** con [#434](https://github.com/max23468/FiscalBay/pull/434) distribuita, «Collega Telegram» dall'account dell'owner e «Avvia» nel bot hanno collegato la chat in pochi secondi, con il link usato una volta e la conferma del bot; filtro, riepilogo alle 21 nel fuso di Roma e interruttore di un negozio spento e riacceso, con l'inizio degli eventi alla riattivazione, sono stati salvati e riletti nella D1 del test. Il cambio di chat non è stato ripetuto sul test: lo provano dominio ed E2E. Il bot del test `fiscalbay_test_bot` è configurato dal 2026-10-25: nome in `cloudflare.config.ts`, token e segreto del webhook sul Worker test, webhook registrato e riletto con `getWebhookInfo` secondo [RELEASE](engineering/RELEASE.md); profilo, descrizione e foto lo dichiarano di prova e non ufficiale, con il rimando a `@fiscalbay_bot`, gruppi disattivati e il solo comando `start`. Sul test il bot non risponde alle chat che non arrivano da un link di un suo account.

**Limiti residui:** invii, riepilogo, bot bloccato e `delivery_failed` arrivano con [M5-10](#m5-10), che usa `telegramRecipient`; fino ad allora nessun messaggio oltre alle risposte del collegamento. Il fuso del riepilogo è quello dell'account all'ultima scelta: cambiarlo in Aspetto non lo sposta finché frequenza o orario non vengono scelti di nuovo. La disattivazione è lo switch delle notifiche: la chat resta collegata fino al cambio o alla cancellazione dello spazio. I comandi dell'owner di [M6-09](#m6-09) arriveranno sullo stesso bot e sullo stesso ingresso (D198).

<a id="m5-10"></a>
#### M5-10 · Telegram invii e arretrati

Estendere le prove di interruzione di M3-04 al commit→accodamento→invio: ripresa senza perdita dell'evento né duplicazioni applicative. Distinguere l'esito remoto incerto da un fallimento certo, senza promettere consegna esattamente una volta se il provider non la garantisce.

**Stato:** Da completare · **Prerequisiti:** M5-09, M3-05 · **Contratto:** [§13](#s13)

Gestire nuovo ordine in verifica, dato successivamente disponibile, cambi/rimozioni, digest, escaping, suddivisione e retry. Recuperare arretrati soltanto per interruzioni tecniche.

**Criterio di completamento:** CF autorizzato leggibile; riepilogo singolo di completamento import senza messaggi per ogni ordine storico; niente indirizzo/email buyer standard, duplicati da ripresa o arretrato volontariamente disabilitato. Correzioni/rimozioni pertinenti non soppresse dal filtro «solo fiscali»; nessuna garanzia exactly-once esterna.

Usare per CF e P.IVA italiani la stessa forma derivata di visualizzazione e copia definita in [M4-01](#m4-01), preservando gli originali persistiti e distinguendo tipi esteri e valori rimossi. Provare minuscole, spazi e zeri iniziali anche nei messaggi suddivisi e nei digest.

**Funzioni del bot per i venditori (D199).** Ogni comando e ogni pulsante rilegge chat collegata, generazione del collegamento, Premium e spazio prima di rispondere; una chat non collegata non vede nulla (sul test nessuna risposta, in Production il rimando al sito). Testi IT/EN secondo la lingua del collegamento; i menu aggiornano lo stesso messaggio invece di aggiungerne.

- **Menu dei comandi** di Telegram, per lingua e soltanto nelle chat private: `/stato`, `/ultimi`, `/preferenze`, `/aiuto`.
- **`/stato`:** piano (Premium con la scadenza, prova, lifetime; con il Free le notifiche sono ferme), notifiche attive o in pausa, filtro, frequenza con orario e fuso, negozi inclusi ed esclusi con quelli sospesi da ricollegare, ultimo invio ed eventuale problema di consegna; pulsanti «Preferenze» e «Apri le Impostazioni».
- **`/preferenze`:** pulsanti per pausa e ripresa, filtro, frequenza con gli orari ammessi, inclusione di ogni negozio con pagine se sono molti e scollegamento della chat con conferma in due tocchi, che annulla le consegne in attesa. Stesse regole delle Impostazioni, compreso l'inizio degli eventi alla riattivazione; il fuso del riepilogo si cambia soltanto dal sito. Un pulsante di un collegamento sostituito non ha effetto.
- **Pulsanti nei messaggi degli ordini:** «Apri in FiscalBay» sul dettaglio dopo l'accesso, «Apri su eBay» per i negozi reali, «Copia Codice Fiscale» soltanto con un valore autorizzato e corrente; nel riepilogo «Apri gli ordini» sul periodo del riepilogo.
- **`/ultimi`:** gli ultimi 5 ordini definitivi dei negozi inclusi, fino a 20 con «Altri 5»: numero, negozio, data, nome dell'acquirente, totale e stato fiscale, con gli stessi pulsanti. Stessi permessi, isolamento e conservazione del sito; nessuno sblocco né ricerca.
- **Ingresso e sicurezza:** il webhook riceve anche i tocchi sui pulsanti (`callback_query`), con ricevute idempotenti e risposta immediata a ogni tocco; nei pulsanti soltanto identificativi brevi legati alla generazione del collegamento; limite di comandi per chat; log senza testo dei messaggi.

**Criterio di completamento delle funzioni del bot:** stato e preferenze coincidono con le Impostazioni nei due sensi; nessun dato di un altro spazio o di un collegamento sostituito; Codice Fiscale soltanto se autorizzato; prove IT/EN di comandi, pulsanti, scollegamento, chat non collegata, Premium scaduto e tocchi ripetuti.

<a id="m5-11"></a>
#### M5-11 · Ammissione, inattività e costo

**Stato:** Completato · **Prerequisiti:** M5-01, M5-03 · **Contratto:** [§5](#s05)

Implementare inattività Free 30+7 giorni, riattivazione autonoma, waitlist manuale e percorso Q569 con verifica della capacità disponibile. Free inattivo, riattivazione e lista d'attesa negli scenari dell'anteprima ([§35](#s35)).

**Criterio di completamento:** Nessun trial che scorre o nuovo incasso per servizio non erogabile; utenti esistenti non messi in attesa e benefici non azzerati abusivamente.

**Completato:** l'attività umana verificata è una pagina dell'area aperta con una sessione, registrata al massimo una volta l'ora sullo spazio; letture, webhook e cron non la toccano. Un compito orario manda allo spazio Free ammesso, con un negozio che legge eBay e senza attività da 30 giorni, un'email di preavviso con la data limite; il preavviso vale soltanto se l'invio riesce, uno per periodo di inattività. Dopo 7 giorni senza nuova attività i negozi entrano nella pausa `inactivity`: nessuna lettura di eBay, ordini consultabili, stato «In pausa per inattività» in Negozi e una notifica nella campanella. «Riprendi le letture» è la conferma dell'utente: riprende tutti i negozi dello spazio e chiede subito una lettura, che recupera quanto resta nella finestra del piano, senza toccare quota, ciclo, prova o promozione. Una copertura in corso, pagata, lifetime, concessa o di prova, non va mai in pausa per inattività: toglie la pausa e il preavviso, e al ritorno al Free serve un nuovo preavviso. La migration additiva `0043_admission_inactivity.sql` aggiunge l'attività e il preavviso allo spazio, l'attesa al profilo e la tabella `admission_settings` con due interruttori: lista d'attesa per i nuovi Free e acquisti aperti. Senza la riga valgono nessuna lista d'attesa e acquisti aperti; uno spazio senza attività registrata riceve la prima dal compito, così gli account esistenti hanno 30 giorni pieni. La lista d'attesa vale per chi completa la registrazione mentre è attiva (Q569): con gli acquisti aperti collega un negozio e ottiene la prima lettura, poi niente letture periodiche o a richiesta e niente sblocchi del Free; Ordini e Piano lo spiegano e propongono prova e Premium, che attivati riportano le letture con la cadenza Premium. Gli account già registrati non entrano in attesa; spegnere la lista d'attesa ammette tutti, in modo definitivo. Con gli acquisti chiusi si fermano checkout, lifetime di chi non è abbonato e prova, e chi è in attesa non collega negozi; rinnovi, passaggio a vita degli abbonati e Free degli ammessi continuano. La prova non si ripete con un account nuovo per lo stesso negozio perché un account eBay appartiene a un solo spazio anche dopo scollegamento ed eliminazione dei dati. L'anteprima ha gli scenari «Free inattivo», con la ripresa simulata, «Lista d'attesa» e «Acquisti sospesi». Prove di dominio su preavviso, invio non riuscito, accesso durante il preavviso, pausa, ripresa, coperture, attività mancante, lista d'attesa, acquisti chiusi e ammissione; E2E IT/EN sull'area reale con un account inattivo dedicato e sull'anteprima.

**Limiti residui:** gli interruttori si impostano nella tabella di D1 finché la console di [M6-05](#m6-05) non li espone; l'ammissione di un singolo account in attesa toglie `waitlisted_at` dal suo profilo. Chi viene ammesso non riceve un'email: lo vede al prossimo accesso. La cancellazione dell'account di [M6-12](#m6-12) deve conservare il segno minimo che impedisce di ripetere prova e beneficio Free ricollegando lo stesso negozio. Il controllo di più negozi della stessa attività su account diversi resta alla revisione antiabuso di [M6-04](#m6-04). L'email di preavviso usa il mittente transazionale da qualificare in [M6-06](#m6-06).

<a id="m5-12"></a>
#### M5-12 · Configurazione live sotto checkpoint

**Stato:** Da completare · **Prerequisiti:** M5-03..M5-11, M5-13 · **Contratto:** [§33](#s33) · [§37](#s37)

Dopo il checkpoint owner, configurare branding, webhook, catalogo, coperture e metodi live, separandoli dal test. Non eseguire incassi indiscriminati.

**Criterio di completamento:** Target live riletti e coerenti con Managed Payments; nessun oggetto test riutilizzato come live. Evidenza minima con dati sensibili protetti.

Configurare contatto supporto realmente ricevibile e alert di richieste a scadenza. Nessuna migrazione automatica di ID test. Prima di agganciare il bot live, fermare il poller 1.x concorrente; prove con incasso reale restano sotto gate finale autorizzato.

<a id="m5-13"></a>
#### M5-13 · Storico e conservazione Premium

**Stato:** Da completare · **Prerequisiti:** M3-03, M3-08, M5-02 · **Contratto:** [§4](#s04) · [§11](#s11) · [§30](#s30)

Estendere a un anno la finestra di acquisizione, consultazione e conservazione per Premium, trial e lifetime, integrando import e termini di retention esistenti. All'attivazione riprendere il backfill del periodo aggiuntivo recuperabile, mantenendo prioritari i recenti e mostrando il periodo effettivamente acquisito. Non promettere dati fiscali oltre la finestra qualificata della fonte e non ricreare dati eliminati.

Gestire estensioni oltre l'anno soltanto su richiesta valutata, dopo verifica del periodo recuperabile, consenso e approvazione dell'eventuale costo una tantum secondo §11; nessun diritto illimitato implicito. Il ritorno al Free e i 30 giorni transitori si integrano in [M5-06](#m5-06).

**Criterio di completamento:** Confini di 30 giorni/un anno coerenti fra import, elenco, dettaglio, ricerca e pulizia; provare attivazione e scadenza dei diversi diritti, backfill interrotto e ripreso, estensione concessa e replay dopo cancellazione. Con pulizia sospesa nessun accesso oltre la finestra effettiva. **Per chiudere:** M4-02 per la ricerca e M5-06 per il downgrade. Le stesse finestre negli export si verificano in [M6-03](#m6-03).

<a id="m6"></a>
### M6 · Export, admin e supporto

**Prerequisiti:** modelli/diritti/UX e G-EXPORT per la chiusura end-to-end; generazione formati e test puri possono iniziare prima su contratti stabili. **Attività:** CSV/XLSX e template colonne, granularità ordine/articolo, file lifecycle e portabilità ZIP, cancellazione account secondo §30 con export proposto prima della conferma (D163), admin operativo/retry/pause/flag, concessioni/config commerciale, supporto IT/EN/form, email e consensi, sito pubblico completo e KPI aggregati.

**Output:** percorsi self-service e controllo operativo senza accesso diretto ordinario al DB. **DoD:** tutte le opzioni Free/Premium effettive, export sicuri e test grandi, admin MFA minimizzato, notifiche/supporto/consensi verificati; niente copie pagamento inutili.

**Dipendenze e accettazione:** export completo solo con selezione UI e diritti reali M4/M5, non con il solo generatore. CSV letterale con escaping/neutralizzazione formule e istruzioni per import testuale; XLSX con CF/P.IVA/SKU come testo; più articoli/identificativi non duplicano importi o righe. Generazione/pubblicazione/download verificano revisione workspace, sessione, diritti e retention, anche con pulizia sospesa o revoca durante il lavoro; file privati massimo 24 ore, URL bearer insufficiente, ZIP JSON/CSV senza copie delle ricevute di pagamento (§12, §30).

Console e Control Center owner sulle stesse query aggregate, senza impersonazione o dati buyer ordinari; anomalie con conseguenza/azione e scritture con conferma/audit. Webhook/menu del bot test riletti, chat/utente estranei ignorati, incidenti deduplicati all'apertura e risoluzione; gli alert M7 dipendono da questa integrazione (§15). Supporto/consensi richiedono impostazioni persistenti; diagnostica allowlistata opzionale, form funzionante anche senza diagnostica, retention applicata. Sito completo chiuso solo con prezzi/checkout e routing coerenti, poi qualifica legale M7. KPI aggregati esposti nella console, primi passaggi deduplicati anche con retry/reconnect, sync a zero ordini distinta e attività automatica separata da inattività umana (§14, §23, §31).

<a id="m6-01"></a>
#### M6-01 · CSV e opzioni standard

**Stato:** Da completare · **Prerequisiti:** M3-06, G-EXPORT · **Contratto:** [§12](#s12)

**Per chiudere:** M4-05, M5-05; integrazione UI e diritti reali verificata, non solo generatore con fixture.

Implementare CSV standard per ordine/articolo, tipi e campi fiscali, ambito da filtri o selezione, opzione soli dati accessibili e motivo dei campi vuoti, compreso l'acquirente estero. L'export comprende soltanto ordini definitivi, salvo il filtro «Non pagato» di M4-02 (D180).

**Criterio di completamento:** CSV con valori sorgente integri, escaping e istruzioni di import colonne testuali; nessuna promessa di conservare zeri al doppio clic. Più identificativi non moltiplicano righe/importi, dati bloccati assenti, formule in input neutralizzate.

<a id="m6-02"></a>
#### M6-02 · XLSX e configurazioni Premium

**Stato:** Da completare · **Prerequisiti:** M6-01 · **Contratto:** [§12](#s12)

Implementare XLSX qualificato, colonne e ordinamenti personalizzati, configurazioni Premium salvate e dataset estesi con più identificativi.

**Criterio di completamento:** Memoria, bundle e durata misurati; cambiare libreria non elimina funzioni promesse. Totali ordine non sommati più volte nelle righe articolo.

Campi CF/P.IVA/SKU tipizzati testo nel file XLSX; verificare i totali anche in ordini con più articoli e più identificativi contemporaneamente.

<a id="m6-03"></a>
#### M6-03 · Job export e portabilità

Provare generazione e download con pulizia fisica sospesa: file scaduti e accessi revocati rimangono negati anche se i byte esistono ancora. Gli export rispettano gli stessi confini di 30 giorni e un anno di elenco e ricerca ([M5-13](#m5-13)). Includere scadenza o revoca durante la generazione e il download secondo §30.

**Stato:** Da completare · **Prerequisiti:** M6-01, M6-02, M6-10 · **Contratto:** [§12](#s12) · [§30](#s30)

Implementare storage privato con scadenza a 24 ore, download autenticato, ZIP del profilo JSON/CSV e notifica dei job pronti, senza duplicare documenti di pagamento.

Salva e trasmette i file tramite lo storage di [M6-10](#m6-10).

**Criterio di completamento:** Test su revisione workspace prima della generazione/pubblicazione/download: una revoca o cancellazione invalida anche gli export pendenti. Coprire concorrenza e scadenza naturale dei diritti/dati prima del job di pulizia; rigenerare invece di mantenere un grafo file/versioni. Nessun bypass via link bearer o sblocco implicito.

<a id="m6-04"></a>
#### M6-04 · Console admin

**Stato:** Da completare · **Prerequisiti:** M2-04, M5 · **Contratto:** [§15](#s15)

Completare liste utenti/spazi/negozi, diritti e incassi, grant, promo, prezzi, configurazioni, retry, pause e revisione antiabuso. Fra diritti e incassi compaiono le coperture revocate per rimborso o disputa, i rimborsi parziali e le cancellazioni finanziarie di [M5-08](#m5-08); la console registra con autore e motivo una cancellazione tramite Link segnalata fuori webhook. Comunicazioni di servizio o manutenzione per la campanella, con titolo, testo IT/EN e periodo di validità.

Aggiungere la vista delle quote delle API eBay (D188): per ambiente, API e chiamata (Trading `GetOrders`, `GetItem`, `GetStore`, `GetUser` e Fulfillment) limite, consumo, residuo e ora di azzeramento letti da `getRateLimits` della Developer Analytics API con il token dell'applicazione, insieme alle chiamate oggi sospese in `ebay_rate_limits`. Oltre il 70% del consumo giornaliero di una chiamata la vista apre un'anomalia con gravità, conseguenza sulle letture e azione «chiedi a eBay l'aumento», una sola per giorno e per chiamata. La lettura ha un'attesa propria e un esito non riuscito resta indicato come tale, mai come quota piena o vuota; nessuna chiamata eBay dei negozi passa dalla console. Provare soglia, azzeramento, sospensione attiva e lettura non riuscita su fixture e sul keyset test.

Includere il trasferimento assistito di un negozio fra spazi previsto dal [§8](#s08), dopo verifica, conferma e audit dell'operazione. Rileggere appartenenza e autorizzazioni al momento dell'esecuzione, invalidare accessi e lavori pendenti incompatibili e mantenere un solo spazio proprietario. Nessun trasferimento automatico di storico, login o pagamenti né reset di trial, quota o vincoli Free. Provare richieste concorrenti, replay e accesso negato dal vecchio spazio, senza esporre dati dell'altro spazio.

Ogni anomalia espone gravità, conseguenza e azione contestuale; raggruppare duplicati e verificare permessi/stato aggiornato all'esecuzione. Provare rientro effettivo e isolamento del problema a un negozio, senza payload buyer nella console ordinaria.

**Criterio di completamento:** MFA e autorizzazione per operazione, nessuna impersonazione o vista fiscale ordinaria; azioni auditate senza reset surrettizi dei benefici.

<a id="m6-05"></a>
#### M6-05 · Flag e ammissione manuale

**Stato:** Da completare · **Prerequisiti:** M6-04 · **Contratto:** [§15](#s15) · [§32](#s32)

Configurare flag tipizzati, soglie di attenzione, efficacia temporale delle modifiche, waitlist e interruttori distinti. Lista d'attesa e acquisti aperti di [M5-11](#m5-11) vivono già in `admission_settings`: la console li legge e li scrive con conferma e audit, insieme all'ammissione di un singolo account in attesa.

**Criterio di completamento:** Nessun prezzo protetto riscritto, ciclo corrente invariato, comportamento sicuro quando manca una configurazione.

<a id="m6-06"></a>
#### M6-06 · Email, supporto e consenso

**Stato:** Da completare · **Prerequisiti:** M1-08, M4-06 · **Contratto:** [§14](#s14) · [§24](#s24)

Qualificare info/supporto iCloud e noreply transazionale, template Auth/servizio IT/EN, form/FAQ, consenso/revoca e gestione mancata consegna.

Integrare anche la proposta separata del consenso marketing dopo l'onboarding prevista dal [§14](#s14), facoltativa, non preselezionata e senza bloccare il servizio. Provare proposta, mancata adesione, prova della scelta e revoca dalle impostazioni nelle due lingue; il consenso non abilita campagne o nuovi fornitori senza il mandato previsto.

Integrare il riepilogo diagnostico visibile e allowlistato del §14. Provare isolamento fra spazi, assenza di CF/token/payload e invio del form anche con diagnostica indisponibile; includere il riepilogo nella gestione della retention del supporto. Rate Limiting di [M7-09](#m7-09) e Turnstile di [M7-10](#m7-10) si aggiungono poi al form esistente: M6-06 si chiude senza attenderli.

Il trasporto è Cloudflare Email Service con Workers Paid (D169): qualificare il recapito verso caselle esterne comuni, rimbalzi, reclami e lista di soppressione, consumo della quota mensile e comportamento del modulo email quando l'invio fallisce. Verificare le soppressioni con scope `sending_domain` sul dominio mittente FiscalBay, incluse quelle automatiche per rimbalzo/reclamo, senza coinvolgere gli altri progetti: il dominio e i suoi sottodomini sono scope distinti; una soppressione manuale senza scope resta `account` e coinvolge tutti i mittenti. Usare gli strumenti nativi, senza un nuovo pannello nell'app. La registrazione pubblica si apre solo dopo questa qualifica.

**Criterio di completamento:** Ricezione e risposte funzionano, marketing separato dal servizio; nessun CF copiato automaticamente nei ticket e nessun digest ordini via email nella 2.0.

Qualificare il mittente transazionale insieme alla posta iCloud con SPF/DKIM/DMARC coerenti. La lettura aggregata dei report DMARC appartiene a M7-12 e non sostituisce la prova di consegna qui richiesta.

<a id="m6-07"></a>
#### M6-07 · Sito pubblico e SEO

**Stato:** Da completare · **Prerequisiti:** M1-06 · **Contratto:** [§23](#s23)

**Per chiudere:** M5-03, M2-08.

Verificare contenuti/prezzi e percorsi autenticati; la qualifica legale conclusiva resta nel successivo M7-07.

Completare Home, Funzionalità, Prezzi, Sicurezza, FAQ, Supporto e legali. Focus Codice Fiscale, P.IVA secondaria, canonical, hreflang, Open Graph e sitemap.

**Criterio di completamento:** Verificati percorsi pubblici/autenticati e prezzi totali; niente social proof inventata, blog o roadmap pubblica. Noindex non è la sola protezione delle aree private.

Verificare il comportamento della cache su home/redirect autenticati e pagina prezzi, mantenendo i totali fiscali e la preferenza di visita del sito corretti per il singolo utente.

<a id="m6-08"></a>
#### M6-08 · KPI e misure minime

**Stato:** Da completare · **Prerequisiti:** M3 · **Contratto:** [§31](#s31)

**Per chiudere:** M6-04; metriche esposte nella console e collegate ai flussi effettivi.

Implementare eventi business e operativi tipizzati, funnel aggregato, separazione fra MRR, trial e lifetime, errori/ritardi sync e capacità.

**Criterio di completamento:** Metriche riproducibili senza doppioni da retry, nessun dato fiscale nel tracking o session replay. L’attività automatica non azzera l’inattività umana.

Successi ordinari aggregati, senza record dettagliato di ogni polling nei log a novanta giorni. Testare formule KPI e consumo del volume realmente conservato.

Deduplicare i primi passaggi account verificato→negozio→sync→ordine anche con retry, schede concorrenti e reconnect; distinguere sync riuscita a zero ordini. Aggregare conteggi e tempi con denominatori espliciti. Integrare le misure Auth/D1/eBay/browser avviate in M4-01, con report limitati e allowlistati, senza tracciamento dei clic.

Le metriche tecniche arrivano da [M6-11](#m6-11); i KPI di business restano eventi deduplicati in D1 ([§31](#s31)).

<a id="m6-09"></a>
#### M6-09 · Control Center Telegram dell'owner

**Stato:** Da completare · **Prerequisiti:** M6-04, M6-08, M5-09 · **Contratto:** [§15](#s15) · [§31](#s31)

Il punto si sovrappone a console admin (M6-04), KPI (M6-08), bot Telegram (M5-09) e alert (M7-04), quindi ha un task proprio. Comandi dell'owner sul bot delle notifiche dell'ambiente (D198), di sola lettura sulle stesse query aggregate della console, navigazione inline e aggiornamento dello stesso messaggio; webhook tramite l'ingresso di M3-11 con verifica di secret, chat privata e identità owner; notifiche incidenti deduplicate all'apertura e alla risoluzione, compresa l'anomalia delle quote eBay di [M6-04](#m6-04), e un comando con la stessa vista delle quote. Nessun CF o dato buyer.

**Criterio di completamento:** Chat o utente diversi ignorati senza risposta informativa; stesso update ripetuto senza doppio effetto; ogni comando coerente con la vista console corrispondente; eventuale azione di scrittura prevista da §15 con conferma e audit. Readback del webhook e del menu comandi nell'ambiente test, bot test separato.

<a id="m6-10"></a>
#### M6-10 · Storage R2 dei file temporanei

**Stato:** Da completare · **Prerequisiti:** M1-02 · **Contratto:** [§12](#s12) · [§25](#s25) · [§30](#s30)

Creare per test e Production un bucket R2 con giurisdizione UE, collegato solo dal binding del Worker, senza dominio pubblico, `r2.dev` o URL prefirmati, e con lifecycle a un giorno come rete di sicurezza ([§12.1](#s12)). Modulo di persistenza unico per scrivere, leggere in streaming ed eliminare oggetti con chiavi opache, riusato da export e portabilità.

**Criterio di completamento:** Il download passa dal Worker dopo sessione, revisione dello spazio e scadenza; un oggetto scaduto o revocato non si scarica anche se esiste ancora; nessun dato personale nelle chiavi; readback di bucket, giurisdizione, lifecycle e assenza di accesso pubblico sul test.

<a id="m6-11"></a>
#### M6-11 · Metriche tecniche su Analytics Engine

**Stato:** Da completare · **Prerequisiti:** M1-04 · **Contratto:** [§31](#s31)

**Per chiudere:** M4-01 per le misure del browser.

Verificare quote, retention e costo correnti, poi scrivere su Workers Analytics Engine contatori e istogrammi per esito e latenza, con le fasi Auth, D1, eBay e rendering separate, e un dataset per ambiente. Integrare le misure di M4-01 mantenendo Analytics Engine come fonte aggregata e i custom span campionati come diagnosi dettagliata, senza derivare contatori dai trace. Query per i budget di prestazione e per la console di M6-04.

**Criterio di completamento:** Test che nessun campo o indice contenga CF, buyer, email, ID utente o URL con query; campionamento dichiarato e query della SQL API pesate con `_sample_interval`, confrontate con un campione controllato; retention di tre mesi esplicitata; query riproducibili sul test. Nessun KPI che richieda deduplica letto da Analytics Engine.

<a id="m6-12"></a>
#### M6-12 · Cancellazione dell'account

**Stato:** Da completare · **Prerequisiti:** M6-03, M5-05 · **Contratto:** [§30](#s30) · [§32](#s32)

**Qualifica successiva obbligatoria:** M7-02 esegue la verifica trasversale dell'erasure sull'implementazione completa di M6-12. Il completamento funzionale di questo task richiede tutte le prove sotto e rende possibile l'audit M7; non attesta né elimina il suo gate o il drill finale.

Percorso self-service secondo [§30](#s30) e D163: riautenticazione, export proposto senza obbligo, conferma forte. La conferma via email usa `sendDeleteAccountVerification` di Better Auth; il suo callback avvia soltanto il job FiscalBay, che ferma accesso, sync, notifiche e rinnovi Stripe con lo stop dei rinnovi di [M5-08](#m5-08), scrive i marker di cancellazione, elimina i dati operativi e per ultimo l'utente Auth. L'email di cancellazione completata parte dal modulo email applicativo alla fine del job. Se Stripe non conferma lo stop dei rinnovi restano soltanto job, marker e riferimenti minimi, con alert all'owner. Cancellazione in corso negli scenari dell'anteprima ([§35](#s35)).

Oggi un account eBay resta legato al suo spazio anche dopo scollegamento ed eliminazione dei dati, e questo impedisce di ripetere prova e beneficio Free con un nuovo account ([M5-11](#m5-11)). La cancellazione dello spazio conserva per ogni negozio reale soltanto il segno minimo di prova usata e ciclo del Free, con durata e base giuridica del [§30](#s30), e un nuovo spazio che ricollega lo stesso negozio non riceve una nuova prova né quota azzerata.

**Criterio di completamento:** Nessuna eliminazione dell'utente nella richiesta di conferma; job ripreso dopo crash o retry senza doppi effetti; nessun rinnovo dopo la conferma; vecchi job, webhook e restore non ricreano i dati; link di conferma scaduto o riusato rifiutato.

<a id="m7"></a>
### M7 · Hardening, privacy, performance e recovery readiness

**Prerequisiti:** implementazioni pertinenti disponibili per avviare i task; funzionalità complete per audit conclusivo e chiusura della milestone. **Attività:** audit contratti/sicurezza/dipendenze/licenze, retention/deletion/supply chain, carico/margine/costi residui, incidenti/kill switch/forward-fix, monitoraggio e runbook; protezioni della zona e report posta di §24; revisione legale e marchi; preparazione restore, **non aggiunta di drill periodici**.

**Output:** candidato senza P1/P2, rischi residui espliciti, runbook e capacità misurata. **DoD:** test isolamento/concorrenza/pagamenti/erasure/limiti verdi; nessun segreto/PII pubblici; provider produzione conformi al progetto; G-LEGAL chiuso per go-live.

**Verifica conclusiva:** threat model §29, CSP, licenze/notices e marchi eBay; inventario dei trattamenti/trasferimenti e condizioni IT/EN, consumatore, versioni/accettazioni e copertura effettiva Temisfera/MoR. Verificare piano/account e trattamento OpenAI prima di un uso sistematico di Codex su dati reali; nessun training o riuso estraneo di dati eBay. Account-deletion eBay senza esenzione per dati persistiti: callback 2.0 condiviso con l'ingresso eventi, firma, retry e budget/cache delle chiavi, cutover coordinato con Hub Fatture prima di readiness. Eliminazione attraversa Auth, ordini, raw, code, suggerimenti, export e billing, anche con pulizia sospesa; recupero lifetime non ripristina dati o trial consumati (§30, §32).

Carico su almeno 70.000 ordini, multistore, picchi, code/export/log, separando Auth/D1/eBay/browser e consumi dell'account condiviso; quote e stop point nel runbook, nessun controllo CPU automatico al deploy reintrodotto (D158). Alert/rientro P1–P3 senza PII, query di diagnosi, campionamento e scadenze credenziali con avviso a 45 giorni (§29, §31). Qualificare pubblicazione e ripresa sul provider: diff cumulativo, artefatto Production distinto, rollback/forward-fix, candidato superato, interruzioni migration/deploy/tag e readback coerente. Riuso dei gate/promozione e riallineamento di `develop` secondo §34 e RELEASE; nessun restore periodico. Matrice interna di tutte le funzioni e rinvii, P3 espliciti, zero P1/P2; prove solo-live finali assegnate al preflight M9.

<a id="m7-01"></a>
#### M7-01 · Audit sicurezza e licenze

**Stato:** Da completare · **Prerequisiti:** M2..M6 · **Contratto:** [§29](#s29) · [§30](#s30) · [§35](#s35)

Verificare la tabella del threat model nel [§29](#s29) sul candidato, riga per riga, inclusa la CSP ancora assente, e poi XSS, CSRF, isolamento e autorizzazioni, rotazione token, dipendenze e codice copiato, separazione pubblico/privato e dati usati da Codex.

**Criterio di completamento:** Nessun P1/P2; ogni finding ha riproduzione e regression test. Avvisi delle licenze terze preservati e nessun segreto esposto.

<a id="m7-02"></a>
#### M7-02 · Erasure e retention end-to-end

Verificare trasversalmente i casi di M3-08/M6-03 con il job di pulizia sospeso: dettaglio, ricerca, suggerimenti ed export rispettano subito scadenza e revoca, senza estensioni implicite della retention.

**Stato:** Da completare · **Prerequisiti:** M7-01 · **Contratto:** [§30](#s30) · [§32](#s32)

Verificare eliminazioni di account, negozio e buyer, comprese richieste eBay, su job, export, raw, versioni, suggerimenti, Auth e billing. Separare i minimi diritti commerciali.

**Criterio di completamento:** Vecchi job o recovery non ricreano dati eliminati; firme e ambito delle richieste corretti. Recuperare lifetime non ripristina dati operativi o prova già consumata.

Coprire anche outbox/event payload/file/indici e segnalazioni Stripe/Link. Il test di logica erasure usa fixture e non sostituisce il drill nativo finale; qualifica delle condizioni di irreversibilità eBay esplicita.

Integrato da CF Ready e Hub Fatture: il callback 2.0 di cancellazione account eBay entra dall'ingresso Worker di M3-11, con limite di richieste per origine a memoria limitata e budget per il recupero delle chiavi pubbliche, riusate dalla cache; il superamento risponde 429 senza perdere notifiche valide.

<a id="m7-03"></a>
#### M7-03 · Stress capacità e costi residui

**Stato:** Da completare · **Prerequisiti:** M0, M3, M5, M6 · **Contratto:** [§36](#s36)

Misurare il runtime reale con almeno 70.000 ordini, più negozi, picchi, code, export, log e traffico. Considerare capacità residua degli account condivisi e le quote delle API eBay del keyset, lette dalla vista di [M6-04](#m6-04) (D177, D188): oltre il 70% del consumo giornaliero si chiede a eBay un aumento.

Separare nei risultati tempi Auth, D1, eBay e rendering/browser usando la strumentazione di M4-01/M6-11 e i report di M6-08; identificare la fase limitante e verificare i budget con campionamento proporzionato. Provare i custom span sotto carico, con allowlist priva di attributi personali ed eccezioni grezze, dichiarando copertura e costo del campionamento.

**Criterio di completamento:** Soglie misurate e configurazione approvata sufficiente; nessuna stima di clienti basata sui soli MAU Auth o sulla media degli ordini.

Integrato da CF Ready e Hub Fatture: runbook con quote di riferimento e stop point per Worker, D1 e Queue, e con la procedura al raggiungimento (fermare nuovi ingressi, attribuire il consumo al progetto giusto dell'account, scegliere con l'owner fra ottimizzazione e cambio piano). Il confronto CPU/durata/errori fra release usa i marcatori nativi Workers Metrics secondo [RELEASE](engineering/RELEASE.md#metriche-release); nessun gate CPU automatico al deploy (D158).

Includere nel runbook R2, Analytics Engine, Logpush e Cron Trigger dell'account condiviso; confermare consumo e quote residue dell'account e la transizione dei prezzi Observability dal 1° dicembre 2026 ([§31](#s31)), distinguendo ingestione e storage condivisi. È una qualifica dei costi già prevista, senza nuova attivazione o modifica di piano.

Qualificare separatamente HTTP/Auth/SSR, cron, consumer ed export su Workers Paid (D169): spostare il lavoro in Queue non elimina i limiti di memoria e durata delle altre invocazioni. Confrontare carichi a freddo e a caldo, includere il limite D1 per database di [§31](#s31) e stimare il costo mensile oltre le quote incluse con il consumo condiviso dell'account. Configurare gli avvisi di consumo e di budget di Cloudflare sull'account, con destinatario e soglie indicati dall'owner.

<a id="m7-04"></a>
#### M7-04 · Monitoraggio e incidenti

**Stato:** Da completare · **Prerequisiti:** M6-04, M6-08 · **Contratto:** [§31](#s31) · [§32](#s32)

Configurare log ordinari a 90 giorni e audit a un anno, alert azionabili e business, severità P1–P3, canali Telegram/email ed escalation del MoR. Fra gli alert rientrano l'anomalia delle quote eBay di [M6-04](#m6-04) e le segnalazioni commerciali di [M5-08](#m5-08) (rimborso parziale, disputa aperta o persa, cancellazione finanziaria), con severità e rientro provati.

La conservazione a 90 giorni e un anno è realizzata in [M7-11](#m7-11).

Completare e mantenere la dashboard tecnica test descritta in [RELEASE](engineering/RELEASE.md#dashboard-test), integrando le metriche di M6-11 e le protezioni di M7-12 quando disponibili. Qualificare query di diagnosi e confronti fino a 30 giorni sui dataset analytics della zona supportati, verificandone `settings`, campionamento, campi e limiti effettivi. Lo storico analytics della zona non estende Workers Logs: retention analytics, log recenti e archivio R2 restano distinti. Mantenere anche la procedura di confronto fra release con i marcatori Workers Metrics, senza una console aggiuntiva nell'app.

**Criterio di completamento:** Allarme, deduplicazione e rientro provati senza PII; soglie reali nella documentazione privata. Nessun indicatore di salute puramente decorativo.

Runbook dati personali separa risposta operativa, obblighi di notifica ai soggetti pertinenti e finestre del supporto MoR; l’assenza di SLA pubblico non li annulla.

Definire anche la gestione degli alert certificati, report DMARC e falsi positivi WAF di [M7-12](#m7-12), usando i canali nativi previsti e la stessa responsabilità degli incidenti applicativi, senza duplicare gli invii.

**Per chiudere:** M6-09; gli alert owner usano le notifiche incidenti del Control Center. M7-11 per la conservazione; M6-11 e M7-12 per completare la dashboard operativa.

Integrato da CF Ready e Hub Fatture: i log redatti con correlation ID sono già attivi da M1-04; qui si aggiungono campionamento degli eventi ordinari riusciti, query di diagnosi documentate (errori per codice, webhook, correlation ID, scritture di eventi fallite) e soglie iniziali P1/P2. Registro delle scadenze delle credenziali nell'inventario privato, con controllo periodico che avvisa l'owner almeno 45 giorni prima e segnala le voci senza data.

<a id="m7-05"></a>
#### M7-05 · Kill switch e modalità degrade

**Stato:** Da completare · **Prerequisiti:** M7-04 · **Contratto:** [§20](#s20) · [§32](#s32)

Provare interruttori distinti per eBay, Telegram e nuovi checkout, continuità dei grant validi e dei webhook, accesso alle parti che rimangono sicure.

**Criterio di completamento:** Simulazioni di guasto limitano soltanto le operazioni pertinenti; nessuna promessa di consultazione quando manca il database o l’autenticazione.

<a id="m7-06"></a>
#### M7-06 · Release, migration e recovery readiness

**Stato:** Da completare · **Prerequisiti:** M7-01, M7-02 · **Contratto:** [§32](#s32) · [§34](#s34)

Qualificare pubblicazione e readback, migrazioni, scelta rollback/forward-fix, recovery nativa dei componenti e custodia delle chiavi necessarie.

**Preparazione locale:** workflow e procedura disponibili in [Test e pubblicazione](engineering/RELEASE.md), con build Production separata, provenienza, controllo del candidato, ripresa, confronto delle migration applicate e rollback limitato alla compatibilità provata. Non chiude le qualifiche remote, recovery o checkpoint.

**Criterio di completamento:** Percorso eseguibile documentato e RC preparabile; nessun drill periodico aggiunto né ripristino dichiarato prima della prova effettiva.

Provare la ripresa idempotente di Promuovi dopo deploy riuscito/tag fallito e blocco di deploy concorrenti. Preparare riconciliazione post-snapshot di cancellazioni e diritti senza inventare un backup esterno.

Integrato da CF Ready e Hub Fatture: la promozione `develop`→`main` riusa i controlli già verdi sullo stesso tree, salvo modifiche ai file che governano la pubblicazione; dopo la promozione `develop` viene riallineato automaticamente. M9-04 usa questo percorso.

Provare anche candidato superato e interruzioni fra passi già confermati. Il readback confronta artefatto/commit, schema, configurazione e invarianti applicative pertinenti; il classificatore di M1-09 considera il diff cumulativo dal distribuito e non elude gate live.

Da D145: su `develop` sono attivi l'artefatto verificato per tree (`build-<tree>`) e il riuso della verifica. D172 prepara e qualifica separatamente l'artefatto Production con input immutabili nella modalità `prova` del workflow Production, anche su `develop` senza promozione, poi conserva `candidate-<tree>` per il rilascio. La pubblicazione reale resta limitata a `main` e ai checkpoint approvati. La build live non coincide con quella test; oltre la scadenza delle prove si ripete la qualifica. Il percorso resta da osservare su GitHub e sul provider prima di dichiarare chiusa questa capacità.

<a id="m7-07"></a>
#### M7-07 · Qualifica legale e commerciale finale

**Stato:** Da completare · **Prerequisiti:** M6-06, M6-07, M5-12 · **Contratto:** [§30](#s30) · [§36](#s36)

Chiudere verifica marchi/API eBay, ruoli dati, copertura MoR, adempimenti italiani residui, diritti consumatori e testi IT/EN di Termini, Privacy e consenso.

**Criterio di completamento:** Blocchi legali risolti; nessuna certificazione non dimostrata e distinzione chiara fra operatore Temisfera e venditore MoR.

Verificare testi accettati/versioni, ruoli effettivi, erasure provider e obblighi residui della vendita al MoR. Nessuna rinuncia generale a diritti consumatore nascosta in una traduzione o nel prezzo IVA esclusa.

Comprendere nell'inventario gli eventi WAF e i report DMARC di §24, con campi/accessi/retention del servizio effettivo; le impostazioni di sicurezza non autorizzano raccolte aggiuntive di dati fiscali o contenuti email.

<a id="m7-09"></a>
#### M7-09 · Rate Limiting nativo

**Stato:** Da completare · **Prerequisiti:** M2-01 · **Contratto:** [§29](#s29)

Aggiungere il binding Rate Limiting di Workers come primo filtro nel Worker per IP e percorso su Auth, richieste di link email, form di supporto, export e altre operazioni costose, davanti ai contatori D1 esistenti, che restano per indirizzo e operazione. Configurazione separata per test e Production; il filtro di zona di M7-12 non sostituisce questo controllo.

**Criterio di completamento:** Le richieste scartate dal binding non scrivono su D1; 429 con `Retry-After` e `no-store`, senza enumerazione degli account; i limiti per indirizzo restano coerenti fra data center; readback sul test.

<a id="m7-10"></a>
#### M7-10 · Turnstile sugli ingressi pubblici

**Stato:** Da completare · **Prerequisiti:** M2-01 · **Contratto:** [§29](#s29) · [§30](#s30)

**Per chiudere:** form di supporto di M6-06 implementato e disponibile al collaudo, senza richiedere la chiusura dell'intero task email/supporto; il controllo viene poi riverificato nella matrice finale.

Integrare Turnstile su registrazione con password, richiesta di reset, reinvio dei link email e form di supporto, con verifica Siteverify lato server, widget e chiavi separati per ambiente e CSP coerente. Aggiornare inventario delle tecnologie e informativa.

**Criterio di completamento:** Token assente, scaduto, riusato o di un altro hostname rifiutato; Siteverify indisponibile rifiuta con possibilità di riprovare, senza toccare passkey, Google ed eBay; prove automatiche con le chiavi di test Turnstile e readback sul test.

<a id="m7-11"></a>
#### M7-11 · Conservazione di log e audit

**Stato:** Da completare · **Prerequisiti:** M1-02, M1-04 · **Contratto:** [§30](#s30) · [§31](#s31)

**Per chiudere:** M3-12 per la pulizia periodica dell'audit. Workers Paid, necessario a Logpush dei Workers, è confermato con D169. Il bucket dei log resta indipendente dal modulo export M6-10 e non è esposto ai merchant.

Configurare Workers Logpush verso un bucket R2 UE dedicato tramite la destinazione S3-compatible di [§31](#s31), con credenziali limitate al bucket, accesso limitato all'owner e lifecycle a 90 giorni; audit sensibile a un anno in una tabella D1 minimizzata con pulizia periodica nello smistamento di [M3-12](#m3-12). La disponibilità generale di Logpush non elimina requisiti e tariffazione separata di Workers Trace Events: non attribuire a questo dataset i 25 GB inclusi del nuovo modello Logpush; qualificare il costo della destinazione effettiva.

**Criterio di completamento:** L'esportazione contiene soltanto i campi in allowlist e soltanto i Worker FiscalBay dell'ambiente previsto, senza `Event` o eccezioni non sanificate; verificare il contenuto di un oggetto esportato, non soltanto la configurazione del job. Oggetti e righe scaduti spariscono nel margine di pulizia qualificato; query di diagnosi del runbook funzionanti sull'archivio; readback di job Logpush, endpoint UE, bucket e lifecycle sul test.

<a id="m7-12"></a>
#### M7-12 · Protezioni della zona e della posta

**Stato:** Da completare · **Prerequisiti:** M1-08, M3-11 · **Contratto:** [§24](#s24) · [§29](#s29) · [§30](#s30) · [§31](#s31)

**Per chiudere:** M5-05, M5-09 e M7-02 per i consumer Stripe, Telegram e cancellazione eBay; M6-06 per il trasporto email e i mittenti legittimi.

Inventariare il piano della zona, regole e quote esistenti; configurare HSTS graduale, header di sicurezza, WAF/rate limit mirati, DMARC Management e Certificate Transparency Monitoring secondo §24. Prima di applicare WAF e rate limiting della zona, validare il ruleset con `dry_run=true` sulle operazioni supportate; poi eseguire readback e prove reali di login/webhook legittimi. Il dry run valida la configurazione, non simula il traffico né prova la compatibilità applicativa; nessuno script generico senza un bisogno concreto. Conservare configurazione precedente e percorso di rientro; nessun upgrade a pagamento implicito. La scelta Workers Free/Paid resta distinta dal piano della zona.

**Criterio di completamento:** readback della configurazione e delle risposte reali sul test; DNSSEC/HTTPS e redirect conservano validità, percorso e query sicure; Auth/OAuth/passkey, form e download funzionano con le protezioni attive. Webhook/callback validi raggiungono il Worker senza challenge, quelli invalidi restano rifiutati dal verificatore. La posta iCloud e transazionale mantiene autenticazione e consegna; report DMARC leggibili quando ricevuti e destinatario/procedura degli alert certificati verificati. Inventario privacy coerente; impostazioni Production incluse nel manifest e prove applicabili ripetute in M8/M9 prima dell'apertura pubblica, senza dichiararle passate dal collaudo test.

Le funzioni non si dichiarano complete dal solo toggle della dashboard: report non ancora arrivati o invii non osservati restano prove aperte. M7-04 gestisce la risposta operativa, M7-07 verifica i trattamenti, M7-08 controlla la matrice completa; M9-03 rilegge lo stato finale del dominio. Non introdurre un secondo sistema di alert o un archivio di report email nell'app.

<a id="m7-08"></a>
#### M7-08 · Verifica interna della matrice funzionale

**Stato:** Da completare · **Prerequisiti:** M7-01..M7-07, M7-09..M7-12 · **Contratto:** [§35](#s35) · [§41](#s41)

Riesaminare tutte le funzioni, i diritti, le schermate, i dispositivi, gli errori e i rinvii rispetto al piano; eliminare aggiunte accidentali dei mockup.

**Per chiudere:** integrazione dei flussi approvati di Ordini, Negozi, Profilo e Impostazioni nei task competenti di M4/M5/M6, compresi billing, Telegram, export, supporto, comunicazioni e cancellazione; prove dei percorsi reali secondo §35.

**Criterio di completamento:** Matrice di accettazione coperta, P3 espliciti, zero P1/P2. Funzioni e stati approvati integrati e verificati nell'app reale prima della RC; viste provvisorie, componenti duplicati, valori dimostrativi nei percorsi reali e codice senza consumatori rimossi. Anteprima conservata sul test con scenari selezionabili, gli stessi componenti di prodotto e copertura grafica di stati rari, errori, IT/EN, temi e dispositivi; route, loader e azioni a 404 in Production. Catalogo pagine, prove browser e documentazione coerenti, senza un secondo simulatore e senza perdere fixture o prove utili. Piano ed evidenze distinguono lavoro concluso e futuro.

Distinguere criteri già provati e casi live finali assegnati a M9-01. La readiness per RC non è una certificazione di compliance o un PASS delle transazioni non ancora osservate.

<a id="m8"></a>
### M8 · Release Candidate e merchant di fiducia

**Prerequisiti:** M7 e via owner al test reale. **Attività:** freeze feature, RC tracciata su test; un merchant, scenari guidati e dati autorizzati, quattro login e percorsi reali pertinenti, mobile/IT-EN/dark; correction-only. Test senza durata arbitraria ma con criteri osservabili. Manifest di ambiente/risorse/dati del merchant esplicito: credenziali e passkey test non diventano Production, oggetti Stripe sandbox non attestano diritti live, bot e messaggi di test rimangono separati. Nessuna migrazione test→Production o riuso di dati personali per default.

**Output:** evidenza test e RC approvabile. **DoD:** scenari core riusciti, nessun P1/P2, P3 accettati; test non generalizzato come prova statistica; reali effetti e condizioni registrati. Restore unico svolto sul candidato finale a fine M8 o nel preflight M9, immediatamente prima del live.

Il manifest approvato identifica candidato, artefatto, schema/config, account, dati, credenziali, bot ed effetti live; nessuna attivazione implicita di Production. Provare registrazione, quattro login, seller, sync, dati fiscali/copia, export, Telegram, preferenze e billing pertinente; dispositivi/browser effettivi distinti dai motori sintetici. Una correzione cambia la RC e richiede i controlli pertinenti. Il preflight prepara target isolato e marker per il solo drill conclusivo di M9.

<a id="prove-ebay"></a>
#### Prove reali di Sign in with eBay su Production

Checklist rinviata da M2 con D160, eseguibile soltanto nel manifest e negli effetti autorizzati del checkpoint M8; non autorizza di per sé deploy o go-live:

1. Registrare esito/data del riferimento `260920-000007` e rileggere sul keyset `botCF` il diritto effettivo, senza cambiare scope, RuName o callback legacy.
2. Verificare consenso con soli scope base e `commerce.identity.readonly`, RuName FiscalBay attivo e candidato esatto distribuito sul Worker Production dopo gate e autorizzazioni applicabili.
3. Dalla sessione email verificata controllata, collegare `ebay` con state/PKCE, consenso e callback Production; D1 deve attestare un solo utente, stesso user ID, nessun subject duplicato e token cifrati non esposti via HTTP.
4. Dopo logout, accedere con eBay e ritrovare lo stesso utente; il login non collega negozi.
5. Provare revoca globale della sessione FiscalBay, rinnovo del token provider quando necessario e revoca/scollegamento secondo il contratto corrente; nessun dato personale o token nelle evidenze.
6. Rileggere sessioni/account e identità del Worker, revocare sessioni residue senza disattivare RuName o callback 1.x condiviso; dichiarare collaudato solo con tutte le prove.
7. Account individuale controllato: avviso dedicato senza utenti/account creati; email business già registrata: rifiuto del collegamento implicito.

<a id="m8-01"></a>
#### M8-01 · Congelamento RC

**Stato:** Da completare · **Prerequisiti:** M7 · **Contratto:** [§34](#s34) · [§37](#s37)

Selezionare il candidato esatto da promuovere a RC, congelare nuove funzioni e identificare artefatto, schema e configurazione dell’ambiente di test.

**Criterio di completamento:** Commit e artefatto corrispondono, gate CI superati; soltanto correzioni necessarie. Nessuna release stabile 2.0 anticipata.

<a id="m8-02"></a>
#### M8-02 · Preparazione test merchant

**Stato:** Da completare · **Prerequisiti:** M8-01 e via owner · **Contratto:** [§30](#s30) · [§35](#s35)

Preparare il test con un merchant di fiducia, dati e risorse autorizzati, scenari reali e modalità che non falsino i diritti della Production.

**Criterio di completamento:** Manifest del test approvato: account, ambiente, dati, credenziali, bot, eventuali effetti live e condizioni di uscita. Nessuna migrazione implicita di passkey, oggetti sandbox, ordini o diritti nel live; nessuna beta aperta o durata minima senza criterio.

<a id="m8-03"></a>
#### M8-03 · Esecuzione percorsi reali

**Stato:** Da completare · **Prerequisiti:** M8-02 · **Contratto:** [§35](#s35)

Eseguire registrazione, quattro accessi, collegamento, sync, dati fiscali, copia, export, Telegram, impostazioni e percorsi billing pertinenti.

Comprende le [prove reali di Sign in with eBay](#prove-ebay) rinviate da M2-09 (D160).

Comprende la sottoscrizione e la consegna attribuita `ORDER_CONFIRMATION` del negozio Production rinviate da M3-04/M3-11, con un solo effetto anche dopo riconsegna e polling. Il manifest precisa ambiente e mandato; senza consegna osservata la prova resta aperta. Verificare inoltre che la configurazione di zona prevista per la RC non interrompa i percorsi reali autorizzati.

**Criterio di completamento:** Evidenze proporzionate di risultati e limiti, nessun P1/P2 né difficoltà strutturale di comprensione del prodotto principale.

<a id="m8-04"></a>
#### M8-04 · Verifica browser e presentazione

**Stato:** Da completare · **Prerequisiti:** M8-01 · **Contratto:** [§22](#s22) · [§35](#s35)

Verificare Chromium/WebKit, viewport, touch/tastiera, IT/EN, scuro e testi lunghi. Usare screenshot reali solo nei contesti approvati.

**Criterio di completamento:** Layout e funzioni coerenti; mockup non sostituisce prova del software. Nessuna funzione assente viene annunciata come già attiva.

<a id="m8-05"></a>
#### M8-05 · Correzioni e decisione RC

**Stato:** Da completare · **Prerequisiti:** M8-03, M8-04 · **Contratto:** [§34](#s34) · [§41](#s41)

Correggere difetti, aggiungere regressioni mirate e identificare una nuova RC quando cambia il candidato; accettare soltanto P3 non critici.

**Criterio di completamento:** Candidato tracciato e approvabile; test pertinenti superati e nessuna regressione di checkout, grant e decorrenze.

<a id="m8-06"></a>
#### M8-06 · Preflight restore unico

**Stato:** Da completare · **Prerequisiti:** M8-05 · **Contratto:** [§32](#s32) · [§41](#s41)

Preparare target isolato, fonte di backup nativa, procedura e controlli su dati, diritti e revoche per l’unico ripristino pre-go-live.

**Criterio di completamento:** Unico drill conclusivo assegnato a M9-02 con candidato/schema/procedura identificati; eseguibile a fine M8 richiamando la stessa evidenza, senza duplicazione né periodicità obbligatoria. Non dichiararlo riuscito prima della prova.

<a id="m9"></a>
### M9 · Go-live

**Prerequisiti:** M0–M8 chiuse, RC, controlli commerciali live e via owner. **Attività:** fissare date promo globale, validare checklist unica §41, restore drill unico, Promuovi, readback, tag/release/changelog; aprire iscrizioni con ammissione corretta, sorveglianza rafforzata iniziale senza beta pubblica. Conclusa la sorveglianza e dismessa la 1.x, chiudere il passaggio definitivo alla 2.x eliminando `legacy/1.x` secondo il criterio sotto.

**Output:** `2.0.0` realmente pubblicata e verificata, no claim anticipato. **DoD:** dominio/posta/provider/diritti/job/alert/supporto/SEO operativi; rollback o forward-fix pronto; nessuna vecchia automazione concorrente. Il mantenimento del bot 1.x non è prerequisito: può essere dismesso prima, preservando identità bot/keyset utili e storia Git.

La branch `legacy/1.x` resta disponibile durante il cutover operativo e la sorveglianza iniziale. Eliminarla, sia in locale sia sul remoto, soltanto dopo dismissione e sorveglianza: runtime e automazioni 1.x inattivi, consumatori e callback trasferiti e verificati, nessun intervento o rollback operativo ancora dipendente dal codice 1.x. Prima della cancellazione verificare che il commit finale 1.x sia raggiungibile da un tag Git permanente pubblicato sul remoto; registrare commit, tag e readback nella ricevuta conclusiva. La cancellazione della branch non elimina la storia Git né le identità bot o i keyset condivisi. La dismissione può anticipare il go-live nel mandato, ma M9 si chiude soltanto dopo pubblicazione, sorveglianza e pulizia verificate.

<a id="m9-01"></a>
#### M9-01 · Preflight commerciale e promo

**Stato:** Da completare · **Prerequisiti:** M8 · **Contratto:** [§4](#s04) · [§5](#s05) · [§6](#s06)

Confermare date promo e configurazione commerciale; chiudere le prove Stripe residualmente solo-live nel perimetro autorizzato dei checkpoint M8/M9 già approvati, con effetti economici espliciti e senza apertura pubblica prima di Promuovi. Verificare percorso cliente Link/Portal, ricevute/contatti, riferimento del pagamento e riconciliazione dei diritti, con impatti economici espliciti. Su un abbonamento Managed Payments dopo il primo addebito: cambio e annullamento della periodicità dal Piano, letti su Stripe e in D1, e cambio del metodo di pagamento dal Portal riletto nell'app ([M5-06](#m5-06), [D196](DECISION_REGISTER.md)).

**Criterio di completamento:** Nessun caso commerciale necessario rimane solo documentato/simulato senza prova consentita o decisione esplicita sul limite. Configurazione database/Stripe/UI allineata, nessun acquisto di capacità assente, Paddle inattivo salvo owner.

<a id="m9-02"></a>
#### M9-02 · Restore drill pre-go-live

**Stato:** Da completare · **Prerequisiti:** M8-06 · **Contratto:** [§32](#s32) · [§41](#s41)

Eseguire il solo restore reale isolato sul candidato finale, oppure riusare la prova appena svolta a fine M8. Verificare dati, Auth, diritti, configurazioni e revoche.

**Criterio di completamento:** Un’unica prova conclusiva riuscita: dati/grant/config recuperati, post-snapshot riconciliato e accessi/erasure rispettati, outbound isolato. Può richiamare il drill sullo stesso candidato a fine M8; un fallimento blocca Promuovi finché corretto e riprovato.

<a id="m9-03"></a>
#### M9-03 · Checklist pubblica e operativa

**Stato:** Da completare · **Prerequisiti:** M9-01, M9-02 · **Contratto:** [§41](#s41)

Rileggere in una checklist DNS/TLS/www/test, email, Auth, eBay, Telegram, Stripe, SEO, legali, supporto, alert, KPI, quote e rollback.

Includere il readback sul dominio Production delle protezioni di §24 e M7-12, con header, compatibilità degli ingressi, report posta e destinatari degli alert; la prova sul test non attesta la configurazione Production.

**Criterio di completamento:** Gate effettivamente superati, zero P1/P2 e go-live pronto per l’owner. Nessun evento o target non verificato indicato come riuscito.

<a id="m9-04"></a>
#### M9-04 · Promuovi 2.0.0

**Stato:** Da completare · **Prerequisiti:** M9-03 e comando owner · **Contratto:** [§34](#s34)

Dopo `Promuovi` dell’owner, eseguire il workflow Production sul commit atteso: gate, migrazioni, deploy, readback, tag, release e changelog; concludere con l'inventario e la pulizia Git di [§34](#s34).

**Criterio di completamento:** Artefatto e servizi attivi corrispondono; branch e worktree temporanei conclusi sono rimossi e il checkout è allineato. Eventuali riferimenti conservati per lavoro in corso o ripresa sono motivati qui. Dichiarazione di pubblicazione soltanto dopo conclusione del ciclo applicabile.

Via riferito a commit/manifest, ambiente serializzato e artefatto verificato; ricevute per migration/deploy/tag. Se fallisce solo la Release GitHub dopo deploy riuscito, riprendere il passo mancante senza riscrivere dati o ripubblicare ciecamente.

<a id="m9-05"></a>
#### M9-05 · Dismissione residui 1.x e handover

**Stato:** Da completare · **Prerequisiti:** M0-01; dismissione anticipata consentita nel mandato · **Contratto:** [§2](#s02) · [§33](#s33)

**Per chiudere:** M9-04; verifica conclusiva del passaggio di runtime e bot dopo il go-live.

Verificare che runtime e auto-update 1.x siano inattivi; rimuovere file obsoleti dopo aver trasferito contenuti utili. Preservare identità bot, keyset condivisi e storia Git.

**Criterio di completamento:** Nessun processo concorrente o credenziale condivisa eliminata; indici e procedure 2.0 autorevoli, altri progetti invariati. La dismissione può già essere avvenuta prima del go-live.

<a id="m9-06"></a>
#### M9-06 · Sorveglianza iniziale

**Stato:** Da completare · **Prerequisiti:** M9-04 · **Contratto:** [§31](#s31) · [§41](#s41)

**Per chiudere:** M9-05; passaggio definitivo e rimozione della branch 1.x secondo [§37](#s37).

Nei primi giorni sorvegliare registrazioni, sync, Stripe, code, quote, errori e supporto, usando interventi mirati secondo le procedure.

**Criterio di completamento:** Esiti e anomalie registrati senza inventare una nuova beta pubblica o un SLA. Normale esercizio predisposto e nessuna chiusura fittizia delle verifiche. Dopo la prova che nessun percorso operativo dipende dalla 1.x, commit finale conservato tramite tag remoto e cancellazione di `legacy/1.x` verificata in locale e sul remoto; riferimenti registrati qui.

<a id="pubblicazione-production"></a>
### Gate per la pubblicazione Production

Prima di `Promuovi` devono risultare chiusi preflight commerciale, restore conclusivo e checklist operativa sul candidato. Le righe seguenti riportano l'esito di [M9-01](#m9-01), [M9-02](#m9-02) e [M9-03](#m9-03); `scripts/release/release.mjs` le legge sia prima del workflow reale sia prima degli effetti Production. Una riga `COMPLETATO` richiede un riferimento alla prova applicabile; righe mancanti, duplicate, prive di prova o con altro stato bloccano il ciclo. Non modificare i nomi dei tre gate senza aggiornare lo script e i suoi test. Il via owner riferito al commit, la variabile di abilitazione e il gate dell'environment restano controlli separati obbligatori.

| Gate | Stato | Prova |
|---|---|---|
| commerciale | DA COMPLETARE | - |
| ripristino | DA COMPLETARE | - |
| operativita | DA COMPLETARE | - |

`commerciale`: date promo approvate, Stripe/database/UI allineati, Link/Portal, ricevute, contatti e riconciliazione osservati nei casi solo-live autorizzati da M8/M9, con effetti economici espliciti; nessun acquisto senza capacità o caso necessario soltanto simulato senza decisione sul limite. Nessuna apertura pubblica anticipata.

`ripristino`: unico drill reale isolato sul candidato finale a fine M8 o prima del go-live, senza ripetizioni periodiche; dati, Auth, grant, configurazioni e marker successivi allo snapshot riconciliati, outbound isolato, revoche ed erasure rispettate. Un fallimento blocca la pubblicazione finché corretto e riprovato.

`operativita`: M0–M8 concluse e RC approvata; checklist §41 riletta per DNS/TLS/www/test, email, Auth, eBay, Telegram, Stripe, SEO, legali, supporto, alert, KPI, quote e rollback, con zero P1/P2 e i due gate precedenti chiusi. Non confonde readiness con il via owner o con un deploy già avvenuto.

La rilettura operativa include le protezioni della zona di §24 e M7-12 sul dominio Production: impostazioni effettive, header, compatibilità degli ingressi e destinatari degli alert. Le prove reali eBay rinviate a M8-03 restano obbligatorie; nessuna chiusura tecnica precedente le sostituisce.

<a id="s38"></a>
## 38. Registro rischi operativo

| Rischio prioritario | Trigger / rilevazione | Mitigazione / prova richiesta | Responsabile |
|---|---|---|---|
| Cambi/quote API eBay | 429, deprecazioni, fonte fiscale diversa | G-EBAY, quota condivisa, adapter/test, riconciliazione; stop polling interessato | Agente tecnico, owner eccezioni |
| Dato fiscale assente/mascherato | Copertura per età/stato non uniforme | Matrice campo/fonte, claim prudenti, stati non ambigui | Agente/prodotto |
| Isolamento tenant/CF locked | Accesso a ID o inferenza tramite search/export | Test negativi server/DB/cache, P1 e containment | Agente/owner |
| Billing/entitlement divergenti | Webhook perso, refund/periodo errati | Reconciliation, grant separati, esempi calendario/test clock | Agente/Stripe |
| Costi/saturazione free tier | Limiti per richiesta/account/test vicini | Capacità residua e margine; alert/ammissione; costo nuovo approvato | Owner |
| Auth sperimentale/identity linking | API instabile, claim email debole | Quattro login qualificati e recovery; no doppio Auth improvvisato | Agente/owner |
| Backup nativo insufficiente | Stato critico non ripristinabile | G-RECOVERY e drill unico reale; combinazione non qualificata esclusa | Agente/owner |
| Abuso Free/trial | Multi-account ripetuti, reset apparenti | Segnali minimizzati e revisione, nessun blocco da solo IP | Owner/admin |
| Lifetime oneroso | Troppe concessioni/costi di lungo periodo | Tetto20 atomico inclusi omaggi, modello cassa/ricorrenza distinto | Owner |
| Cancellazione incompleta | Reimport/job/restore ripristinano dati | Tombstone e sweep, invalidazione suggerimenti/export, test ripristino | Agente |
| Token o segreti compromessi | Alert/log/supply chain | Secret store/rotazione, scope minimi, P1 e revoca mirata | Owner/Codex |
| Shared resources danneggiate | Modifica keyset/DNS/quote altrui | Manifest target e isolamento, no cleanup indiscriminato 1.x | Agente |
| Fiscalità vendite non coperta | Checkout fuori copertura MoR | G-STRIPE/LEGAL, restrizione acquisto coerente, no fallback Payments | Owner |
| Pubblico confonde FB con eBay/fatturazione | Copy/logo ambigui | Gate marchi/disclaimer, no promesse emissione fatture | Owner |
| Tool AI esfiltra o esegue contenuti | Istruzioni in payload/tool result | Context autorizzato, dati come input non comandi, target/permessi | Agente |

Ogni rischio chiuso collega prova o decisione di accettazione; nessuna tabella rischi compilata vale come mitigazione effettuata. Budget e consumi reali si registrano privatamente. Nessun incidente obbliga a cambiare provider senza decisione owner.

<a id="s39"></a>
## 39. Roadmap successiva e non-promesse

Ordine indicativo approvato, non calendario pubblico:

| Versione | Perimetro indicativo |
|---|---|
| 2.1 | Pagina Notifiche completa; filtri salvati e personalizzazione schede Premium |
| 2.2 | Analisi Premium su ordini/presenza CF/trend/negozi/marketplace; eventuali metriche prodotto più evolute previa scelta |
| 2.3 | Collaboratori/team; integrazioni richieste realmente dal mercato |
| Altre 2.x | Coupon, accessibilità avanzata/formalizzazione, pagina pubblica stato; codici email/conferma Telegram come login futuri se ancora utili |
| 3.x | iOS/Android nativi con React Native/Expo e riuso ragionato; Apple login da riesaminare, offline solo eventuale |

La disponibilità PayPal **come pagamento** può entrare in 2.0 solo se supportata dal MoR scelto, senza account PayPal personale separato e con costo accettabile; non è garanzia di roadmap o collegamento login. Niente Microsoft login, nessuna app desktop promessa.

API pubblica non impegnata a una specifica 2.x: si valuta solo se domanda concreta, mantenendo servizi e contratti riusabili; endpoint solo quando necessari a un client reale. Analisi non diventa una suite e-commerce generale. Lifetime mantiene livello equivalente, non dà licenza di cambiare indiscriminatamente l'offerta già acquistata.

<a id="s40"></a>
## 40. Decisioni superate e coerenza trasversale

Sono sostituiti: Telegram-first/Python/VPS come destinazione; Dynu/DuckDNS; Supabase obbligatorio o Better Auth obbligatorio; Node24/LTS come preferenza automatica; email-only; passkey/eBay login rinunciabili; database imposto prima M0; quota Free3 o sempre10 individuale; trial automatico; incasso differito Q155; addebito solo EUR Q551; diritto post-Premium solo per dati cliccati Q334; sidebar principale; Export voce primaria; cronologia ordini visibile; card in ogni pagina; paginazione numerata mockup; campagne senza opt-in; backup esterno/drill periodico obbligatori; GitHub Issues backlog; conferma per ogni comando Production; migrazione utenti 1.x obbligatoria; fedeltà vincolante al Concept 4 originale del logo (D141); i18next come libreria di localizzazione (D149); controllo automatico della CPU dopo il deploy test (D158); Workers Free come piano di esercizio, target di 10 ms per invocazione e Resend/Brevo come trasporto email (D169); incasso immediato del primo periodo durante la prova, sostituito dal primo addebito alla fine della prova (D194).

Correzioni già derivate dall'audit e non nuove scelte: sblocco per ordine copre tutti i tipi; snapshot versione distinto dalla vista corrente; omissione campo non rimozione; refund revoca grant correlato; promo globale vs quota congelata ciclo; attività KPI distinta dall'uso umano; piano workspace non negozio; cancellazione/chat nuova invalidano job vecchi; sicurezza non rinviata a M7; doc private non rendono segreto il codice pubblico.

Quattro chiarimenti finali prevalenti: **Q566** listino EUR con conversione provider; **Q567** mensile/annuale durante la prova con primo addebito alla sua fine e prova residua conservata (D194, che supera il pagamento immediato); **Q568** accesso dati acquisiti Premium anche mai aperti; **Q569** percorso acquisto circoscritto durante waitlist Free quando capacità pagante disponibile. Non riaprire questi punti come domande di routine.

Le semplificazioni approvate eliminano duplicazioni, vincoli documentali storici, dipendenze artificiali e implementazioni speculative; non cambiano prezzi, diritti, quattro login, checkpoint, retention o protezioni native. M0 confronta progressivamente i candidati; runtime scelto soltanto dopo qualifica. Per ogni nuova incompatibilità sostanziale vale [§0](#s00).

Il tracker separato e la cronaca delle sessioni sono superati da D161; i task per milestone sono tornati nella roadmap di questo piano con D164, senza diario delle prove. Stato, task e questioni aperte sono nella roadmap; prove in PR/CI e ricevute.

<a id="s41"></a>
## 41. Definition of Done finale e checklist go-live

La 2.0 è completa, visivamente curata, veloce, responsive, IT/EN, robusta e operabile senza frequenti interventi manuali. Non basta «funziona sul mio account». Tutte le capacità necessarie di M0–M8 devono essere complete con prove pertinenti; M9 pubblica solo dopo il via esplicito e i [gate Production](#pubblicazione-production).

| Gate finale | Prova richiesta |
|---|---|
| Prodotto | Matrice piani/versioni completa, nessuna funzione involontariamente eliminata o aggiunta dai concept |
| Identità | Quattro login, sessioni/recovery, MFA admin e verifica email qualificati |
| eBay | Scope/fonti/storico reali, sync10/30 target e manuale, quote/capacità con margine |
| Dati | Isolamento, sblocchi/concorrenza, retention/erasure e prezzi/grant coerenti |
| Stripe | Managed Payments live eleggibile, checkout/portal/Link, categorie/Paesi coperti, casi Q567 e lifetime, nessun doppio addebito |
| Commerciale | Catalogo/listino protetto, date promo approvate, quote/ciclo/waitlist e capacità per nuovi acquisti |
| Telegram/email | Bot corretto, chat/token, preferenze/digest, dominio/iCloud/transazionali, recapiti/alert funzionanti |
| UX/brand | Logo 2.0 approvato, 2 card, app/sito dark/IT-EN, mobile/browser, baseline accessibilità |
| Pubblico | Domini/TLS/www, protezioni di zona §24 qualificate, sito/SEO reali, prezzi/tasse chiari, noindex aree private, privacy/termini/supporto/disclaimer |
| Recovery | Protezioni native qualificate, unico drill riuscito pre-go-live, revoche/diritti/config recuperabili |
| Qualità | Nessun P1/P2, P3 accettati, RC congelata e merchant di fiducia superato |
| Release | Commit/artifact/schema/config tracciati, Promuovi/readback, tag/release/changelog coerenti |
| Continuità | Kill switch, monitoraggio/alert, capacità residua, rollback o forward-fix, niente doppio runtime1.x |

Dopo pubblicazione: sorveglianza rafforzata iniziale su signup, eBay, billing, errori e quote, senza fase beta visibile o SLA aggiuntivo. Handover deve indicare cosa è attivo, dove stanno le prove, limiti residuali e prossima attività, non dire «pubblicato» prima di readback.

**Criterio per nuove domande all'owner:** un requisito non realizzabile, conflitto di diritti, nuovo costo/provider, variazione sostanziale di UX/privacy/scope o rischio non derogabile. Non chiedere preferenze su dettagli tecnici reversibili già delegati. In tutti gli altri casi implementare, testare e aggiornare la fonte appropriata.
