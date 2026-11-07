# FiscalBay · Roadmap

Lavoro futuro e pendenze. La `2.0.0` è in Production dal 2026-11-01: la sua storia, con i task conclusi, è [archiviata](archive/2026-11-master-plan-2.0.md). I requisiti stanno nei [documenti di prodotto](product/PRODUCT.md) e di [engineering](engineering/ARCHITECTURE.md); le motivazioni nel [registro](decisions/DECISION_REGISTER.md).

<a id="stato"></a>
## Stato

| Filone | Stato | Contenuto |
|---|---|---|
| [Riconoscimenti esterni](#riconoscimenti-esterni) | Da completare | Candidatura all'eBay Partner Program 2027 entro il 31 dicembre 2026, Application Growth Check, pagina Solution Provider di eBay Italia e verifica del brand Google, senza funzioni in scrittura su eBay né nuovi costi ([D255](decisions/DECISION_REGISTER.md)). Procede in parallelo alle versioni, senza legarsi a nessuna. |
| [2.0.x Correzioni](#correzioni-2-0) | Completato | Correzioni e miglioramenti della 2.0 decisi dall'owner il 2026-11-03 ([D293](decisions/DECISION_REGISTER.md)): ordini e piattaforma, accesso e pagamenti, sito e processi, più la provenienza degli iscritti ([D304](decisions/DECISION_REGISTER.md)) la proporzione delle verifiche di pubblicazione ([D309](decisions/DECISION_REGISTER.md)) e il controllo di sicurezza pianificato ([D312](decisions/DECISION_REGISTER.md)), un task per PR. Comprende i rilievi dell'[audit Production](audits/2026-11-06-audit-ui-ux-production.md). |
| [2.1 Comunicazioni](#versione-2-1) | Da completare | Prossima versione: pagina Notifiche, avvisi operativi più utili e pagina pubblica di stato. |
| [2.2-2.5](#s39) | Da completare | Si dettagliano quando diventano la prossima versione. |

Stati: `Da completare`, `In corso`, `Bloccato`, `Completato`. Ogni task ha codice, stato, prerequisiti, contratto e criterio di completamento: `RE-yy` per i riconoscimenti esterni, `2.x-yy` per le versioni. La chiusura richiede comportamento, prove pertinenti e documenti coerenti; le prove restano in PR, CI e ricevute. La PR che avvia, blocca o chiude un task ne aggiorna lo stato nello stesso diff. Un task completato conserva intestazione, stato e contratto, poi una frase sulla capacità consegnata con le decisioni che la motivano e gli eventuali limiti residui. I codici restano in questo file, mai nel codice o nel runtime.

Decidono soltanto l'owner: requisiti non realizzabili, conflitti di diritti, nuovi costi o provider, variazioni sostanziali di UX, privacy o scope, Stripe live e Paddle.

## Riconoscimenti esterni

**Prerequisiti:** nessuno per la candidatura al Partner Program, che ha una scadenza propria; `2.0.0` in Production, già raggiunta, per i task che richiedono la Production. **Attività:** ottenere da eBay e Google il riconoscimento di FiscalBay come strumento per i venditori: programma partner, limiti API adeguati, presenza nel Seller Center italiano, schermata di consenso Google con il marchio.

**Output:** candidature inviate, esiti registrati e readback delle verifiche ottenute. **DoD:** nessuno scope eBay in scrittura, funzione di inserzione o spedizione, nuovo costo o provider introdotto per ottenere un riconoscimento ([D255](decisions/DECISION_REGISTER.md)); sito, badge e copy citano un riconoscimento soltanto dopo l'esito scritto e nei limiti d'uso del titolare. I moduli riportano numeri e capacità reali, mai stime presentate come risultati.

<a id="re-01"></a>
#### RE-01 · Application Growth Check

**Stato:** Da completare · **Prerequisiti:** `2.0.0` in Production, raggiunta · **Contratto:** [§11](product/ORDERS_AND_SYNC.md#s11) · [§15](product/CHANNELS_AND_ADMIN.md#s15)

Completare l'Application Growth Check sull'applicazione Production per i limiti delle chiamate di lettura degli ordini, senza attendere che l'anomalia della soglia del 70% ([D188](decisions/DECISION_REGISTER.md)) lo imponga. Il keyset è condiviso con altri progetti: la richiesta riguarda le sole chiamate di FiscalBay e non cambia impostazioni, RuName o notifiche altrui.

**Criterio di completamento:** esito di eBay registrato e nuovi limiti riletti nelle quote della console; con un rifiuto, motivazione registrata e soglia del 70% invariata.

<a id="re-02"></a>
#### RE-02 · eBay Partner Program 2027

**Stato:** Da completare · **Prerequisiti:** nessuno · **Contratto:** [§1](product/PRODUCT.md#s01) · [§11](product/ORDERS_AND_SYNC.md#s11)

Candidatura alla coorte 2027 del [programma](https://developer.ebay.com/grow/ebay-partner-program) entro il 31 dicembre 2026, con il [modulo](https://www.ebay.com/sml/apply-partner-program-2027) inviato dall'owner perché contiene dati aziendali e di contatto. L'agente prepara le risposte da piano e codice: mercato IT, flussi «Order management», «Reporting and analytics» e «Regulatory compliance», segmenti SMB e C2C, abbonamento a piani fissi, integrazione Fulfillment e Trading con controllo di quote e anomalie. L'owner legge i requisiti tecnici minimi come non cumulativi; se eBay li conferma cumulativi la candidatura si chiude senza ammissione, senza aggiungere funzioni per rientrarvi. Gli impegni del livello Gold, cioè Joint Business Plan e iniziative congiunte di acquisizione, richiedono una scelta dell'owner al momento dell'esito.

**Criterio di completamento:** candidatura inviata entro la scadenza ed esito della coorte, atteso nel primo trimestre 2027, registrato con il livello assegnato; un badge ottenuto si usa secondo le Badge Usage Terms.

<a id="re-03"></a>
#### RE-03 · Pagina Solution Provider di eBay Italia

**Stato:** Da completare · **Prerequisiti:** `2.0.0` in Production, raggiunta · **Contratto:** [§1](product/PRODUCT.md#s01) · [§23](product/EXPERIENCE.md#s23)

Chiedere a eBay Italia l'inserimento di FiscalBay nella pagina Solution Provider del Seller Center come strumento per gli adempimenti fiscali dei venditori italiani. Il programma la riserva ai livelli Gold e Silver: la richiesta verifica anche se esiste un percorso per gli strumenti di conformità fuori dal programma, e si ripete dopo l'esito di [RE-02](#re-02) se il livello assegnato la include.

**Criterio di completamento:** richiesta inviata e risposta registrata; con l'inserimento, scheda riletta con nome, descrizione e link a fiscalbay.it corretti.

<a id="re-04"></a>
#### RE-04 · Verifica del brand Google

**Stato:** Da completare · **Prerequisiti:** `2.0.0` in Production, raggiunta · **Contratto:** [§7](product/ACCOUNTS_AND_STORES.md#s07) · [§21](product/EXPERIENCE.md#s21)

Far verificare a Google il brand della schermata di consenso del client OAuth Production, così che «Accedi con Google» mostri nome e logo FiscalBay. Servono home page, Privacy e Termini pubblicati su fiscalbay.it e il dominio verificato in Search Console; gli scope restano quelli del login, senza ambiti sensibili.

**Criterio di completamento:** verifica approvata e schermata di consenso riletta su Production con nome, logo e link legali di FiscalBay.

<a id="correzioni-2-0"></a>
## 2.0.x · Correzioni e miglioramenti

**Prerequisiti:** nessuno. **Attività:** correggere i difetti e rafforzare i punti deboli emersi dall'analisi trasversale del 2026-11-03 ([D293](decisions/DECISION_REGISTER.md)), più la provenienza degli iscritti approvata il 2026-11-04 ([D304](decisions/DECISION_REGISTER.md)). Ogni task è una sola PR e i task procedono in parallelo su file distinti. Nessun nuovo costo; l'unico servizio esterno nuovo è il controllo gratuito delle password violate di Have I Been Pwned.

<a id="2-0-01"></a>
#### 2.0-01 · Ordini, eBay e piattaforma

**Stato:** Completato · **Prerequisiti:** nessuno · **Contratto:** [§11](product/ORDERS_AND_SYNC.md#s11) · [§12](product/ORDERS_AND_SYNC.md#s12) · [retention](engineering/DATA_RETENTION.md) · [§25](engineering/ARCHITECTURE.md#s25) · [§31](operations/OPERATIONS.md#s31)

Recenti e storico si leggono per tratti di una pagina e Trading per finestre di trenta giorni concatenate, con meno chiamate eBay; la scadenza non blocca più il reimport e i blocchi dimostrabilmente nati da scadenza sono stati tolti; export con l'indirizzo di spedizione, ricollegamento dopo tre rifiuti delle credenziali, sottoscrizione ricontrollata ogni settimana, coda propria per webhook e pagamenti con ripresa in due ore, registro senza scritture per richiesta, CPU limitata, ID dell'owner in un segreto e Worker del bot con le tracce del principale riaccese ([D293](decisions/DECISION_REGISTER.md)). Il cron fermo resta al Monitor dell'account. Restano sul provider le nuove code, il Worker del bot, il segreto dell'owner e il readback dei Monitor.

<a id="2-0-02"></a>
#### 2.0-02 · Accesso, console e pagamenti

**Stato:** Completato · **Prerequisiti:** nessuno · **Contratto:** [§7](product/ACCOUNTS_AND_STORES.md#s07) · [§15](product/CHANNELS_AND_ADMIN.md#s15) · [§29](engineering/SECURITY_AND_PRIVACY.md#s29) · [§30](engineering/SECURITY_AND_PRIVACY.md#s30)

Preparazione della passkey limitata per IP e pulizia di Auth indicizzata; password nuove confrontate con Have I Been Pwned, Turnstile all'accesso dopo tre errori dallo stesso IP e regola di zona estesa ad accesso e assistenza; ultimo metodo segnato da un cookie; token tecnico con scadenza e blocco dei tentativi; token eBay con un segreto proprio, versionati e ricifrati al rinnovo; Stripe con versione fissata, timeout breve e idempotenza ([D293](decisions/DECISION_REGISTER.md)). La verifica in due passaggi esce dal task per scelta owner. Dopo `Pubblica` restano l'applicazione della regola di zona e la prova reale di Turnstile sul test.

<a id="2-0-03"></a>
#### 2.0-03 · Sito, processi e documenti

**Stato:** Completato · **Prerequisiti:** nessuno · **Contratto:** [§23](product/EXPERIENCE.md#s23) · [§34](operations/RELEASE.md#s34) · [§35](engineering/TESTING.md#s35)

Home e Prezzi restano consultabili senza database con il listino di riserva e arrivano dalla cache di un minuto a chi non ha cookie. Sito, area e anteprima hanno indirizzi inglesi, con 301 dai vecchi; titoli con la parola chiave davanti, offerte e Guide nei dati strutturati, immagine social per pagina, `lastmod`, manifest, AVIF e cache delle immagini. «Inizia gratis» sta nella barra, l'offerta scelta arriva alla pagina Piano, Prezzi risponde sui pagamenti, «Vai al contenuto principale» apre ogni pagina, l'inglese segue la regola del 27 settembre e `security.txt` è pubblicato. Hook degli agenti e nuovi controlli di `verify:repo`; decisioni superate in archivio e operazioni in runbook ([D293](decisions/DECISION_REGISTER.md)). Le Actions erano già fissate per SHA; la mutation resta nelle PR per [D301](decisions/DECISION_REGISTER.md); meno JavaScript resta alla 2.x.

<a id="2-0-04"></a>
#### 2.0-04 · Provenienza degli iscritti

**Stato:** Completato · **Prerequisiti:** nessuno · **Contratto:** [§15](product/CHANNELS_AND_ADMIN.md#s15) · [§23](product/EXPERIENCE.md#s23) · [§30](engineering/SECURITY_AND_PRIVACY.md#s30) · [retention](engineering/DATA_RETENTION.md)

Ogni nuovo account salva una volta sola la categoria del canale d'arrivo e il percorso della prima pagina: il Worker li ricava dal Referer o da un'etichetta `via` dell'elenco chiuso, i link interni li portano fino all'accesso senza cookie né archivi del browser e i provider li passano nello state firmato. La console li mostra in aggregato con iscritti, attivazioni e paganti; il dato entra nell'esportazione, sparisce con l'account ed è nella Privacy IT/EN `2026-11-05` ([D304](decisions/DECISION_REGISTER.md)). Senza JavaScript la provenienza non si propaga e vale «unknown»; le iscrizioni reali con Google ed eBay si provano sul test dopo `Pubblica`.

<a id="2-0-05"></a>
#### 2.0-05 · Rilievi dell'audit Production

**Stato:** Completato · **Prerequisiti:** nessuno · **Contratto:** [§11](product/ORDERS_AND_SYNC.md#s11) · [§12](product/ORDERS_AND_SYNC.md#s12) · [§23](product/EXPERIENCE.md#s23) · [audit Production](audits/2026-11-06-audit-ui-ux-production.md)

I rilievi dell'audit Production del 2026-11-06 sono corretti: Negozi eBay mostra in corso la lettura richiesta e si rilegge fino all'esito, gli avvisi dei suggerimenti usano parole comuni, i conteggi di ordini raggruppano le migliaia, l'Esportazione nomina filtri e ricerca, la ricerca della barra avviata dagli Ordini ne conserva i filtri e Prezzi mostra a chi ha Pro a vita il piano attivo, con i pulsanti dei piani allineati ([D308](decisions/DECISION_REGISTER.md)). Web Analytics conta di nuovo le visite con un sito per host senza inserimento automatico. La notifica dei Termini resta eliminabile per scelta dell'owner. Le correzioni sono verificate su Chrome in Production con la 2.0.7.

<a id="2-0-06"></a>
#### 2.0-06 · Proporzione delle verifiche di pubblicazione

**Stato:** Completato · **Prerequisiti:** nessuno · **Contratto:** [Pubblicazione](operations/RELEASE.md#controlli-proporzionati)

La mutation divide i moduli secondo le durate misurate sullo stesso sorgente e cede posti alle PR e ai cicli attivi soltanto nel lavoro di fondo; ogni ambiente si compila una volta per run, i browser del candidato si dimensionano sulle prove rimaste e quelli Production partono dalla propria build, roadmap e documenti di prodotto passano dal gate documentale, `.gitignore` e gli script del manifest estranei all'artefatto da quello degli strumenti changelog e frammenti invalidano soltanto le aree che mostrano le Novità, il runner browser prova il nucleo e il merge di una PR che non tocca il processo distribuisce la build già provata nella PR ([D309](decisions/DECISION_REGISTER.md)). Inventari, provenienza, migration e readback restano obbligatori; la riduzione dei tempi si misura sulle qualifiche successive.

<a id="2-0-07"></a>
#### 2.0-07 · Controllo di sicurezza pianificato

**Stato:** Completato · **Prerequisiti:** nessuno · **Contratto:** [§29](engineering/SECURITY_AND_PRIVACY.md#s29)

Ogni giovedì, anche senza PR, un workflow ricontrolla avvisi delle dipendenze distribuite, firme dei pacchetti, protezione di `develop` e `main` con il solo `Node 26` richiesto e alert aperti di Dependabot, code scanning e secret scanning; un fallimento arriva all'owner come notifica di GitHub ([D312](decisions/DECISION_REGISTER.md)). Gli alert si leggono con un token in sola lettura la cui scadenza sta nel registro delle credenziali, che resta l'unico controllo delle scadenze.

<a id="versione-2-1"></a>
## 2.1 · Comunicazioni

**Prerequisiti:** nessuno. **Attività:** dare alle comunicazioni operative una pagina completa nell'area riservata, avvisi più utili e un punto pubblico sullo stato del servizio ([D291](decisions/DECISION_REGISTER.md), [D293](decisions/DECISION_REGISTER.md)). Nessun nuovo costo o provider. Retention, Termini e Privacy non cambiano.

<a id="2-1-01"></a>
#### 2.1-01 · Pagina Notifiche

**Stato:** Da completare · **Prerequisiti:** nessuno · **Contratto:** [§19](product/EXPERIENCE.md#s19) · [§30](engineering/SECURITY_AND_PRIVACY.md#s30)

Pagina dell'area riservata, raggiunta dalla campanella, con tutte le voci degli ultimi 30 giorni: filtri per categoria e stato di lettura, testo completo e link all'azione. Stessa fonte, stesse letture ed eliminazioni e stessa retention del popover, che resta com'è.

**Criterio di completamento:** una lettura o «Segna tutte come lette» su una delle due superfici si riflette sull'altra dal server, IT/EN e mobile compresi; nessuna voce oltre i 30 giorni.

<a id="2-1-02"></a>
#### 2.1-02 · Controlli di stato

**Stato:** Da completare · **Prerequisiti:** nessuno · **Contratto:** [§20](product/EXPERIENCE.md#s20) · [§31](operations/OPERATIONS.md#s31)

Registrare per FiscalBay, eBay, Telegram, Stripe, accessi ed email l'esito dell'ultimo controllo e la sua ora, dai controlli interni e dalle pagine di stato dei fornitori dove sono leggibili. eBay risulta non disponibile secondo la definizione del [§20](product/EXPERIENCE.md#s20): le ultime letture di tutti i negozi attivi non riescono, mai per un errore isolato. I segnali sono aggregati, senza dati di merchant o negozi, e non si conserva uno storico.

**Criterio di completamento:** ogni servizio ha un esito con ora, provato con un guasto simulato per ciascuno, senza quote di lettura aggiuntive oltre il margine del [runbook di capacità](operations/CAPACITY.md#capacita).

<a id="2-1-03"></a>
#### 2.1-03 · Comunicazioni pubbliche

**Stato:** Da completare · **Prerequisiti:** nessuno · **Contratto:** [§15](product/CHANNELS_AND_ADMIN.md#s15)

Nella console ogni comunicazione di servizio dichiara se è pubblica o riservata agli utenti autenticati, con riservata come valore predefinito. Una comunicazione si scrive una volta sola e compare in campanella e, se pubblica, sulla pagina di stato. Le comunicazioni esistenti restano riservate.

**Criterio di completamento:** una comunicazione riservata non è mai leggibile senza sessione; cambio e ritiro compaiono nel registro della console.

<a id="2-1-04"></a>
#### 2.1-04 · Pagina pubblica di stato

**Stato:** Da completare · **Prerequisiti:** 2.1-02, 2.1-03 · **Contratto:** [§20](product/EXPERIENCE.md#s20) · [§23](product/EXPERIENCE.md#s23)

Pagina del sito su `/stato` e `/en/stato`, collegata dal piè di pagina: una riga per servizio con stato e ora dell'ultimo controllo, più le comunicazioni pubbliche attive. Niente esito complessivo, storico o percentuali di disponibilità, e nessuna promessa di SLA. Un controllo non recente mostra «Stato non verificato» e mai l'ultimo esito positivo.

**Criterio di completamento:** la pagina funziona senza sessione e resta raggiungibile con il servizio sospeso o con D1 non disponibile, dove mostra «Stato non verificato»; il divieto di semaforo globale del [§20](product/EXPERIENCE.md#s20) resta rispettato.

<a id="2-1-05"></a>
#### 2.1-05 · Avvisi operativi

**Stato:** Da completare · **Prerequisiti:** nessuno · **Contratto:** [§13](product/CHANNELS_AND_ADMIN.md#s13) · [§19](product/EXPERIENCE.md#s19)

Riepilogo settimanale o mensile oltre a quello giornaliero; promemoria degli ordini senza CF da 48 ore con il messaggio per l'acquirente pronto da copiare, senza invii all'acquirente; avviso di un negozio senza letture riuscite da un numero di ore; avviso al venditore quando gli ordini senza CF superano il 60%, oggi riservato all'owner. In campanella e su Telegram secondo le preferenze ([D293](decisions/DECISION_REGISTER.md)).

**Criterio di completamento:** ogni avviso provato con dati sintetici, disattivabile, IT/EN, senza leggere dati oltre la retention.

<a id="s39"></a>
## 39. Roadmap successiva e non-promesse

Elenco delle funzioni previste per la 2.x, approvato dall'owner il 2026-10-31, non calendario pubblico. Ogni versione raccoglie un contesto; una versione `2.y.0` contiene soltanto funzioni di questo elenco e aggiunte o spostamenti richiedono l'owner ([D248](decisions/DECISION_REGISTER.md), [D249](decisions/DECISION_REGISTER.md)):

| Versione | Contesto | Funzioni |
|---|---|---|
| 2.1 | Comunicazioni | Pagina Notifiche completa; pagina pubblica dello stato di FiscalBay e dei servizi da cui dipende (eBay, Telegram, Stripe, accessi ed email), dai controlli interni e dalle pagine di stato dei fornitori dove esistono; riepiloghi settimanali o mensili e avvisi su ordini senza CF, negozi fermi e CF mancanti |
| 2.2 | Ordini | Filtri salvati e personalizzazione delle schede Pro; elenco degli ordini senza codice fiscale da richiedere, con la data in cui il merchant ha copiato il messaggio, senza invii all'acquirente; periodi di calendario per filtri ed export (dal… al…, mese scorso, trimestre); ricerca indicizzata e stato fiscale salvato |
| 2.3 | Dati | Analisi Pro su ordini, presenza del CF, andamento, negozi e marketplace; metriche di prodotto per l'owner, con l'aggiornamento della Privacy |
| 2.4 | Crescita | Coupon; invito di un collega con premio e regole antiabuso decisi sui numeri delle metriche; prova sociale reale con numeri aggregati e testimonianze autorizzate |
| 2.5 | Team | Collaboratori nello stesso spazio, con un ruolo in sola lettura per il commercialista |
| 3.x | App native | iOS/Android nativi con React Native/Expo e riuso ragionato; Apple login da riesaminare, offline solo eventuale |

Da collocare in una versione 2.x ([D293](decisions/DECISION_REGISTER.md)): dati economici dell'ordine già forniti da Fulfillment (commissioni, netto, IVA riscossa da eBay, rimborsi, spedizione), senza la Finances API, che richiederebbe lo scope `sell.finances`, un nuovo consenso dei negozi e le firme digitali per i venditori UE; comandi Telegram di ricerca, riepilogo della giornata ed export; chat di supporto Tawk.to con una pagina Supporto migliorata, subordinata all'inventario dei cookie e alla Privacy, unica eccezione alle integrazioni con altri servizi; JavaScript ridotto nelle pagine pubbliche.

L'accessibilità entra nelle correzioni `2.2.x`, dopo i cambi della pagina Ordini: prove manuali con VoiceOver e NVDA sui percorsi principali e correzioni conseguenti, senza dichiarazione di accessibilità pubblicata. Restano fuori dalla 2.x le integrazioni con altri servizi e l'accesso con codice via email o con conferma Telegram. Le dismissioni delle API Trading annunciate da eBay si coprono con le sostitute moderne in una versione di correzione appena eBay fissa la data; se una funzione visibile si riduce o sparisce decide l'owner prima della pubblicazione.

La disponibilità PayPal **come pagamento** può entrare in 2.0 solo se supportata dal MoR scelto, senza account PayPal personale separato e con costo accettabile; non è garanzia di roadmap o collegamento login. Niente Microsoft login, nessuna app desktop promessa.

Nella 2.0 FiscalBay non invia né legge messaggi eBay (Message API, `NEW_MESSAGE`), non mostra le linee guida normative di `REGULATORY_GUIDELINE` e non sottoscrive topic con scope propri per spedizioni, annullamenti, resi o preventivi, già coperti dalla lettura periodica (D215, D216). La candidatura all'eBay Partner Program presenta FiscalBay per gestione degli ordini, analisi e conformità fiscale, senza aggiungere gestione di inserzioni o spedizioni ([D255](decisions/DECISION_REGISTER.md), [RE-02](#re-02)). Restano fuori anche le novità eBay estranee agli ordini: Inventory Mapping, garanzia di durabilità UE, taglie moda, condizione delle monete, resi facilitati in Germania, Media API e video, API Buy, annunci video del Marketing, VeRO ed eDIS.

API pubblica fuori dalla roadmap: si valuta caso per caso soltanto per chi ne ha un bisogno concreto, mantenendo servizi e contratti riusabili; endpoint solo quando necessari a un client reale. Analisi non diventa una suite e-commerce generale. Lifetime mantiene livello equivalente e riceve tutte le funzioni Pro della 2.x, team compreso (conferma dell'owner del 2026-10-31); non dà licenza di cambiare indiscriminatamente l'offerta già acquistata.

<a id="questioni-aperte"></a>
## Questioni aperte

Conservare soltanto pendenze che cambiano una decisione, impediscono una prova o richiedono di riconciliare un effetto remoto. Chiuderle o rimuoverle con il prossimo intervento pertinente, senza accumulare il diario delle prove riuscite. I fatti stabili sui servizi stanno nello [stato dei servizi](operations/OPERATIONS.md#stato-dei-servizi).

| Ambito | Pendenza e condizione di chiusura |
|---|---|
| Dipendenze dei tool | `pnpm audit --prod` non segnala avvisi. Nello sviluppo restano `deepmerge`, da shadcn, senza versione corretta indicata ([GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)), e `minimatch` sotto 11.0.1, da Stryker. Chiudere con release corrette e qualificate delle catene, senza sopprimere gli avvisi nell'audit. `vitest` e `@vitest/coverage-istanbul` restano a 5.0.3: con 5.0.4 e 5.0.5 il worker del pool Cloudflare termina nel dry-run di Stryker anche con Stryker 10.1.1 e, dal 2026-11-02, con `@cloudflare/vitest-plugin` 1.4.12, che con la 5.0.3 supera la mutation. Dependabot ignora quelle versioni e propone runner e mutation in una PR propria, senza merge automatico; aggiornarli soltanto a una versione che superi la mutation di un file Cloudflare, avviata a mano sul branch della PR. |
| Qualifica del ciclo | D172 e D173 qualificate; D265-D288 e D295-D300 implementate. Il primo `Promuovi` del 2026-11-02 ha provato coordinatore remoto, upload al 0%, override, avanzamento protetto di `main` e conferma finale. La guardia a tempo è rimossa dal ciclo ([D288](decisions/DECISION_REGISTER.md)). Restano da osservare un merge durante una promozione, qualifica automatica, scrittura del giorno su una versione nuova con frammenti, ritiro per collaudo fallito e `rollback`; poi due cicli `pr` insieme con il blocco del merge, `production`, la scelta del commit certificato, la rinumerazione di una decisione e la prima mutation delle righe in parti con base incrementale. `publication` è limitato a `develop` con `PUBLISH_TOKEN`; la protezione di `main` richiede `Node 26`. |
| CI alleggerita | D190 e [D200](decisions/DECISION_REGISTER.md): browser nel container ufficiale di Playwright, campagna mutation settimanale e avvio manuale su `develop`; i moduli con più di 150 mutanti si dividono in parti parallele ([pubblicazione](operations/RELEASE.md#mutation-test)). Chiudere con la prima campagna settimanale riuscita. |
| Runner della mutation | Runner GitHub più capienti accorcerebbero ogni parte della mutation, ma esistono soltanto per organizzazioni GitHub Team o Enterprise Cloud, e il repository è su un account personale gratuito. Decide l'owner, con il costo. |
| Prima vendita reale | `commercial.mjs verify` del 2026-11-02 non trova vendite: si ripete alla prima vendita reale. |
| Sandbox e dati fiscali | Sul test la Sandbox è spenta su richiesta dell'owner (`EBAY_SANDBOX_ENABLED` a `false`) e si riattiva soltanto su sua indicazione. I pagamenti Sandbox non riescono (`CashOnPickup` rimosso per managed payments, acquisto confermato non pagato e assente da Fulfillment) e Buy API è esclusa dall'owner: serve un pagamento Sandbox riuscito con importazione, oppure una soluzione concordata. La consultazione Production autorizzata della lettura fiscale non prova il pagamento o l'import Sandbox. Nessun permesso implicito di modificare ordini Production o introdurre import Trading. |
| Protezioni della zona | HSTS/header, WAF/rate limit edge, report DMARC e alert certificati configurati per ambiente da `scripts/zone-protection.mjs` (D229): applicati e riletti sul test il 2026-10-29 e in Production il 2026-11-01. HSTS è a un anno sui due ambienti dal 2026-11-02, su indicazione dell'owner, senza `includeSubDomains` né `preload`. Primo report DMARC ricevuto il 2026-11-01, con DMARC, SPF e DKIM superati; primo alert dei certificati ancora da osservare. Rilevamento delle credenziali trapelate attivo sulla zona dal 2026-11-03 ([D294](decisions/DECISION_REGISTER.md)): il readback con la password nota e la cache degli asset si ripete sul test dopo il deploy della PR e in Production dopo `Promuovi`. |
| Piano e costi | Workers Paid continuativo e Cloudflare Email Service (D169); nessun costo variabile (D227), con avvisi di budget da 0,01 USD all'owner. Il cron supera ancora i 10 ms in ogni esecuzione dopo D167. Coda e DLQ del test in UE a 14 giorni (D171); quelle di Production nascono allo stesso modo secondo la [pubblicazione](operations/WEBHOOKS.md#webhook). Prezzi Observability dal 1° dicembre 2026 riletti il 2026-11-02 ([runbook](operations/CAPACITY.md#capacita)): consumo stimato ben sotto i 50 GB inclusi, da confermare con il volume reale alla prima fattura successiva. Lo smistamento resta idempotente rispetto alle invocazioni ripetute del cron già osservate. Le misure della qualifica iniziale non autorizzano capacità pubblica né costi oltre il canone. |
| CLI Cloudflare | `cf` (D170) qualificata sul test per deploy, migration, ripresa e rollback; il primo deploy Production con `cf` avviene con `Promuovi`. Rimuovere la patch che limita la rilevazione al pacchetto della radice quando una versione qualificata di `cf` corregge i workspace, il collegamento `build/client` in `vite.config.ts` quando plugin Vite 2.x e React Router concordano sulla cartella client, e `scripts/local-d1.mjs` quando `cf --local` termina da solo ([cloudflare/cf#64](https://github.com/cloudflare/cf/issues/64)). Aggiornare `cf` e plugin solo a versioni esatte riprovate. |
| Cutover provider | OAuth eBay attivo sul RuName Production dal 2026-10-31 ([D247](decisions/DECISION_REGISTER.md)): sul test non funzionano più Accedi con eBay né il collegamento di nuovi negozi. Non modificare `botCF 2` (SyncBay) o il callback condiviso con Hub Fatture. Branding finale Checkout ancora da osservare. |

<a id="s38"></a>
## 38. Registro rischi operativo

| Rischio prioritario | Trigger / rilevazione | Mitigazione / prova richiesta | Responsabile |
|---|---|---|---|
| Cambi/quote API eBay | 429, deprecazioni, fonte fiscale diversa | Quota condivisa, adapter/test, riconciliazione; stop polling interessato | Agente tecnico, owner eccezioni |
| Dato fiscale assente/mascherato | Copertura per età/stato non uniforme | Matrice campo/fonte, claim prudenti, stati non ambigui | Agente/prodotto |
| Isolamento tenant/CF locked | Accesso a ID o inferenza tramite search/export | Test negativi server/DB/cache, P1 e containment | Agente/owner |
| Billing/entitlement divergenti | Webhook perso, refund/periodo errati | Reconciliation, grant separati, esempi calendario/test clock | Agente/Stripe |
| Costi/saturazione free tier | Limiti per richiesta/account/test vicini | Capacità residua e margine; alert/ammissione; costo nuovo approvato | Owner |
| Auth sperimentale/identity linking | API instabile, claim email debole | Quattro login qualificati e recovery; no doppio Auth improvvisato | Agente/owner |
| Backup nativo insufficiente | Stato critico non ripristinabile | Drill unico reale; combinazione non qualificata esclusa | Agente/owner |
| Abuso Free/trial | Multi-account ripetuti, reset apparenti | Segnali minimizzati e revisione, nessun blocco da solo IP | Owner/admin |
| Lifetime oneroso | Troppe concessioni/costi di lungo periodo | Tetto20 atomico inclusi omaggi, modello cassa/ricorrenza distinto | Owner |
| Cancellazione incompleta | Reimport/job/restore ripristinano dati | Tombstone e sweep, invalidazione suggerimenti/export, test ripristino | Agente |
| Token o segreti compromessi | Alert/log/supply chain | Secret store/rotazione, scope minimi, P1 e revoca mirata | Owner/Codex |
| Shared resources danneggiate | Modifica keyset/DNS/quote altrui | Manifest target e isolamento, no cleanup indiscriminato 1.x | Agente |
| Fiscalità vendite non coperta | Checkout fuori copertura MoR | Restrizione acquisto coerente, no fallback Payments | Owner |
| Pubblico confonde FB con eBay/fatturazione | Copy/logo ambigui | Gate marchi/disclaimer, no promesse emissione fatture | Owner |
| Tool AI esfiltra o esegue contenuti | Istruzioni in payload/tool result | Context autorizzato, dati come input non comandi, target/permessi | Agente |

Ogni rischio chiuso collega prova o decisione di accettazione; nessuna tabella rischi compilata vale come mitigazione effettuata. Budget e consumi reali si registrano privatamente. Nessun incidente obbliga a cambiare provider senza decisione owner.
