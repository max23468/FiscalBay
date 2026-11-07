# Osservabilità

Dashboard, avvisi, log, metriche e statistiche del sito. Fa parte delle [operazioni](OPERATIONS.md); il rilascio è in [Test e pubblicazione](RELEASE.md).

<a id="dashboard-test"></a>
## Dashboard tecnica test

La vista Cloudflare [FiscalBay | Test](https://dash.cloudflare.com/98195e505f42abaaeb4827f71a924b1a/dashboards/0745e833-f896-4168-9ff4-3246c6ab84a9) usa le sorgenti native già attive, senza telemetria aggiuntiva. Si apre da Osservabilità → Dashboard nell'account del progetto; la finestra iniziale è 24 ore. Il filtro persistente di ogni grafico deve identificare esattamente `fiscalbay-test`, mai un prefisso FiscalBay o l'intero account. Il nome tecnico dell'ambiente nel provider è `production` anche per questo Worker test: non identifica la Production applicativa `fiscalbay`. Il dominio test resta `test.fiscalbay.it`.

| Grafico | Sorgente e selezione | Misura |
|---|---|---|
| Invocazioni registrate, HTTP/coda/cron | Workers Observability Logs; `$metadata.service = fiscalbay-test`, `$metadata.type = cf-worker-event`; gruppo `$workers.eventType` | Eventi, totale: solo record di invocazione, distinti dai messaggi applicativi |
| CPU media | Stessa selezione e gruppo | Tempo CPU (ms), media |
| Durata media | Stessa selezione e gruppo | Tempo di clock (ms), media; include attesa I/O |
| Errori e annullamenti | Stessa selezione e gruppo; `$workers.outcome != ok` | Record di invocazione non riuscita; gli annullamenti non sono automaticamente eccezioni |
| Invocazioni metriche | Workers Invocations; `scriptName = fiscalbay-test` | Richieste totali del dataset metrico, distinte dai record log |

Logs espone anche Durata/media. CPU e tempo di clock nel selettore qualificato offrono la media, non percentili: questi si leggono in Workers Metrics. L'osservabilità attiva del test è stata riletta via API: log persistiti e invocation logs abilitati con `head_sampling_rate = 1`; le tracce sono accese, perché il token del bot non passa più dal Worker principale ([D293](../decisions/DECISION_REGISTER.md)), e restano spente nel Worker del bot. Il primo totale non conta tutte le righe di log: una singola invocazione può emettere più messaggi `cf-worker`.

Per diagnosi scegliere una finestra comune, poi confrontare `fetch`, `queue` e `scheduled`, verificando dove la versione osservata esegue l'acquisizione. Nella release qualificata il cron contiene ancora la sincronizzazione periodica; il consumer esegue webhook e sincronizzazioni manuali. HTTP include pagine, richieste manuali e ingresso webhook. Per isolare un ingresso usare soltanto percorsi statici verificati come `/webhooks/ebay` o `/webhooks/ebay/sandbox` nel filtro nativo `$workers.event.path`; non raggruppare per URL, query, header, messaggi liberi o identificativi di negozio/ordine. Se il campione non distingue l'import dal resto del lavoro, dichiararlo e usare la diagnosi nativa pertinente; non introdurre attributi nuovi per il grafico.

I grafici Logs seguono la retention dei log sottostanti, oggi 7 giorni su Paid, distinta dallo storico analytics della zona e dall'[archivio R2](#archivio-log). Una finestra senza eventi o fuori retention non prova assenza di errori. Query e dashboard non aggiungono un costo secondo i [prezzi Observability](https://developers.cloudflare.com/observability/pricing/); ingestione e storage restano consumi dell'account condiviso.

Le metriche di Analytics Engine non sono un dataset delle dashboard, che leggono GraphQL e Workers Observability: si leggono nella sezione Prestazioni della console e con `scripts/metrics-query.mjs`. Gli eventi delle protezioni della zona non entrano nella vista: si leggono in Security Events, filtrati sull'host dell'ambiente, e con le query qui sotto.

**Analytics della zona.** Le diagnosi oltre i sette giorni dei log usano la GraphQL Analytics API sulla zona `fiscalbay.it`, piano Free, con il token «FiscalBay analytics zona» del Portachiavi (soli Analytics Read e Firewall Services Read sulla zona, scadenza nel registro). `settings` riletto il 2026-10-29:

| Dataset | Finestra per query | Storico | Uso |
|---|---|---|---|
| `httpRequestsAdaptiveGroups` | 30 giorni | 31 giorni | Esiti, percorsi e giorni dell'host; 106 campi, al più 40 per query |
| `firewallEventsAdaptive` | 30 giorni | 31 giorni | Eventi delle regole WAF, rate limiting e Bot Fight Mode, uno per riga, al più 10.000 |
| `httpRequests1dGroups` | Un anno | Un anno | Andamento giornaliero, senza filtro per host |
| `httpRequests1hGroups` | 3 giorni | 3 giorni | Andamento orario recente |

`firewallEventsAdaptiveGroups` non è disponibile sul piano Free: gli eventi di sicurezza si contano dalle righe. Ogni query filtra `clientRequestHTTPHost` sull'host dell'ambiente, perché la zona è comune. I conteggi sono stime campionate, con `avg { sampleInterval }` fra 10 e 25 sul test, quindi multipli di dieci: un evento raro può mancare e i numeri esatti restano a Workers Logs e all'[archivio](#archivio-log). Le richieste interne di Early Hints (user agent con `early hints`) compaiono come 504 e vanno escluse con `userAgent_notlike: "%early hints%"`: nei 30 giorni al 2026-10-29 erano tutti i 20.250 504 del test, mentre i 5xx dei visitatori erano circa trenta 503. Per confrontare due release si usa la stessa finestra prima e dopo l'istante del deploy, per esito e per giorno (`date`).

Per mantenere la vista, aprire Configura dal menu di ciascun grafico e controllare dataset, filtri e aggregazione; dopo una modifica salvare, uscire dall'editor e riaprire il collegamento stabile. Verificare nuovamente filtri e valori: un toast di successo non basta. Aggiornare qui il collegamento soltanto se la vista viene sostituita; il completamento operativo e la manutenzione sono assegnati al piano.

<a id="incidenti"></a>
## Incidenti e avvisi all'owner

Un lifetime incassato senza assegnazione apre una P1 sullo spazio. La scheda mostra Checkout e cliente da verificare su Stripe; non avvia assegnazioni o rimborsi. La rilettura giornaliera chiude la segnalazione dopo un diritto assegnato o un rimborso totale o una disputa persa confermati, mantenendola aperta quando il provider non è leggibile. La cancellazione dello spazio o dei dati finanziari elimina i riferimenti; dopo il rientro la pulizia li conserva per 90 giorni. La cattura per il ripristino include questi casi e il loro esito.

Gli incidenti nascono dalle anomalie della console (`app/domain/admin-operations.server.ts`), ricavate dallo stato corrente: un problema esce dall'elenco al rientro osservato, mai per una chiusura manuale. Il compito `owner_incidents`, ogni dieci minuti, porta le P1 e le P2 sul bot dell'ambiente all'apertura, all'aggravamento e al rientro; le P3 restano nella console e in `/incidenti`. Telegram è il canale primario: dopo tre tentativi non riusciti lo stesso avviso parte una volta per email a `info@fiscalbay.it`, come testo con il collegamento alla console, e Telegram continua a ritentare fino a sei ore fra un tentativo e l'altro. Nessun SLA pubblico; l'obiettivo interno di ripristino è 24 ore ([§32](OPERATIONS.md#s32)).

| Gravità | Soglie iniziali | Prima risposta |
|---|---|---|
| P1 grave | Tutti i negozi attivi di un ambiente con le ultime due letture fallite (almeno due negozi); riconciliazione Stripe o rinnovo dei token fermi; eventi Stripe non elaborati da oltre un'ora; quota eBay giornaliera oltre il 90%; soglia Bulk Data Transfer raggiunta; rinnovi di un account cancellato non fermati su Stripe; credenziale del registro scaduta | Subito: perimetro, contenimento con l'interruttore pertinente, poi ripristino o correzione in avanti |
| P2 da risolvere | Negozi con le ultime due letture fallite; altri lavori periodici fermi da due periodi o da un'ora dall'accodamento; eventi eBay o Telegram in ritardo; quota eBay oltre la soglia di attenzione della console (70%); soglia Bulk Data Transfer in avvicinamento; chiamate eBay sospese per limite; servizi spenti dalla console; cancellazioni ferme da oltre un'ora; credenziale che scade entro 45 giorni | Nella giornata |
| P3 da controllare | Dettagli degli ordini non letti; messaggi Telegram non consegnati nelle ultime 24 ore; operazioni della console senza esito; credenziali senza data nel registro | Alla prossima revisione della console |

Per ogni incidente: leggere la scheda della console e il correlation ID riportato dall'utente o dal registro, poi le query dell'[archivio](#archivio-log) (`errors`, `webhooks`, `failures`, `correlation`) o i Workers Logs degli ultimi sette giorni; stabilire perimetro e gravità; contenere con l'interruttore della sola funzione interessata (chiamate eBay, invii Telegram dei venditori, nuovi acquisti) o con l'ammissione della lista d'attesa; ripristinare o correggere in avanti con un rollback del codice soltanto se compatibile con schema e configurazione; verificare l'uscita sul rientro osservato nella console. Il correlation ID si copia nella ricevuta dell'incidente, non i log. Le soglie di capacità e i punti di arresto sono nella [tabella delle quote](CAPACITY.md#capacita).

Gli avvisi partono dal compito `owner_incidents` della coda: un cron o un consumer fermo, o il database guasto, non li inviano, e senza i segreti Telegram nell'ambiente non parte nemmeno l'email di riserva. Li coprono i **Monitor** dell'account (**Avvisi** > **Monitor** della dashboard): policy `custom_analytics` che Cloudflare valuta fuori dal Worker sulla SQL API e invia per email a `info@fiscalbay.it`. L'account ne ammette cinque, quante ne servono a un ambiente, quindi sono quelli della Production. `node scripts/alert-monitors.mjs apply --mode live` li crea o riscrive per nome e li rilegge; `readback --mode live` li confronta senza scrivere. `--mode test` li prova sul test prendendo il loro posto, e l'`apply` successivo della Production li ripristina.

| Monitor | Query e soglia |
|---|---|
| `fiscalbay cron fermo` | `logs.workersLogs`, invocazioni `scheduled` del Worker: nessuna in un'ora |
| `fiscalbay eccezioni` | `logs.workersLogs`, invocazioni con esito diverso da `ok` e `canceled`: almeno tre in 15 minuti |
| `fiscalbay coda dei falliti` | `events.queuesMessages`, scritture nella coda `fiscalbay-webhooks-failed`: almeno una in un'ora |
| `fiscalbay spazio D1` | `states.d1Storage`, dimensione del database nell'ultima ora: oltre 8 GB, il punto di arresto della [tabella delle quote](CAPACITY.md#capacita) |
| `fiscalbay email non consegnate` | `logs.emails`, invii da `fiscalbay.it` non consegnati, esclusi i destinatari `.invalid` delle prove e comuni ai due ambienti: almeno tre in un'ora |

Un avviso si tratta come un incidente P2, P1 per il cron fermo o la coda dei falliti. Ogni monitor si valuta una volta per periodo, sul conteggio dell'intero periodo: con valutazioni al minuto e la media sul periodo un monitor appena creato non vede i dati precedenti, e il 2026-11-03 il primo ha segnalato un cron fermo che girava. Il 2026-11-07 alle 02:01 la valutazione su 30 minuti ha contato zero esecuzioni del cron che i log contenevano, poi rientrata alle 02:31: la finestra del cron fermo è di un'ora, sei esecuzioni mancate. Lo stesso avviso si ripete ogni ora finché la condizione resta vera. I Monitor non hanno un prezzo pubblicato e dopo la loro creazione, il 2026-11-03, gli abbonamenti dell'account non sono cambiati.

**Degrado per guasto ([§20](../product/EXPERIENCE.md#s20), [§32](OPERATIONS.md#s32)).** Un guasto o un interruttore ferma soltanto le operazioni che ne dipendono; nessuna pagina simula una consultazione senza i dati.

| Guasto o interruttore | Si ferma | Continua |
|---|---|---|
| eBay non risponde, o chiamate eBay spente | Letture, dettagli, rinnovi dei token, collegamenti e «Riprova», con lo stato in Ordini e Negozi | Consultazione e sblocchi dai dati salvati; eventi eBay ricevuti, serviti come richiesta di lettura al rientro; Telegram e acquisti |
| Telegram non risponde, o invii spenti | Consegne e risposte del bot ai venditori, che restano in attesa | Letture, consultazione, acquisti; con l'interruttore, il Control Center dell'owner |
| Acquisti chiusi | Nuovi checkout e prove | Rinnovi, eventi Stripe, diritti in corso, letture e Telegram |
| Stripe non risponde | Nuovo checkout, portale e cambio di periodicità, con l'avviso di riprovare | Diritti locali, consultazione e sblocchi; nessuna revoca o proroga, eventi riconciliati al rientro |
| Auth o database non rispondono | Area, accesso, collegamento del negozio, console e API: 503 con «Riprova», senza dati; Home e Prezzi 503 | Funzionalità, Sicurezza, FAQ, Supporto, Termini e Privacy come per un visitatore senza sessione; i webhook rispondono 503 e il provider ritenta |

**Pagamenti e MoR.** Rimborsi, dispute e cancellazioni finanziarie passano da Stripe Managed Payments, che ha l'ultima parola: un incasso errato o una revoca non attesa sono P1. Le richieste dell'assistenza Link e di Stripe con un termine hanno la precedenza su ogni altro lavoro: si leggono sulla dashboard Stripe dell'ambiente, si risponde entro il termine indicato e si registra l'esito nella console quando tocca un diritto, come la cancellazione finanziaria segnalata all'assistenza ([procedura](BILLING_SUPPORT.md)).

**Dati personali.** Un incidente che espone, altera o perde dati personali è P1. Oltre alla risposta operativa: registrare fatti, perimetro, categorie di dati e interessati coinvolti, istanti di scoperta e di contenimento; valutare con l'owner, per Temisfera titolare del trattamento, la notifica al Garante entro 72 ore dalla scoperta e la comunicazione agli interessati quando il rischio è elevato (artt. 33 e 34 GDPR); avvisare eBay quando l'incidente riguarda dati ottenuti dalle sue API e Stripe quando riguarda pagamenti, nei termini dei rispettivi accordi. Le finestre del supporto del MoR e l'assenza di un SLA pubblico non sospendono questi termini. Il ripristino segue il [runbook dei dati](RECOVERY.md#ripristino-dei-dati), senza riattivare sessioni, consensi o dati cancellati.

**Avvisi dei provider della zona.** Li legge l'owner, con la stessa responsabilità degli incidenti applicativi e senza un secondo invio dall'app. Un alert di Certificate Transparency per un certificato non emesso da Cloudflare si confronta con `cf ssl certificate-packs list` e con l'elenco dei sottodomini: un'emissione legittima si annota, una sconosciuta è P1, con revoca presso la CA emittente e verifica di DNS, registrar e account. Un report DMARC con un mittente sconosciuto che supera SPF o DKIM è P1 (record o chiave da ruotare); uno che fallisce è un tentativo di spoofing già respinto dalla policy, da annotare. Un falso positivo WAF si riconosce dagli eventi della regola in Security Events: si corregge la regola dello script di [protezione della zona](PROTECTION.md#protezioni-zona) e si ripete il readback, mai con un'eccezione manuale dalla dashboard.

**Avvisi commerciali.** Lo stesso compito invia sul bot dell'ambiente, nell'ordine di arrivo e al più dieci per turno, gli avvisi di `owner_notifications` ([D219](../decisions/DECISION_REGISTER.md)): registrazione e ammissione dalla lista d'attesa, primo negozio, prova avviata e conclusa con o senza acquisto, primo acquisto mensile, annuale o lifetime con l'importo, disdetta programmata, rinnovo non pagato, chiusura dell'abbonamento, rimborso parziale o totale, disputa aperta o persa, cancellazione finanziaria, posti lifetime rimasti cinque, due e nessuno, cancellazione dell'account. Ogni fatto ha una chiave univoca, quindi webhook ripetuti e riconciliazione non producono doppioni; un invio fallito si ritenta con attese crescenti fino a sei ore per cinque tentativi, poi resta non riuscito. I messaggi portano piano, importi e istanti con nome, email, ragione sociale e metodi di accesso del titolare, riletti all'invio ([D250](../decisions/DECISION_REGISTER.md)); la cancellazione dell'account li conserva dalla richiesta, perché l'utente esce prima. Lo spazio si apre dalla console.

**Scadenze delle credenziali.** Il registro vive nell'inventario privato, fuori dal checkout, come file JSON con i nomi logici e le date per ambiente, in `~/.config/fiscalbay/credential-expiries.json` o nel percorso di `FISCALBAY_CREDENTIAL_REGISTRY` (`null` se la data è da cercare, `"never"` per ciò che non scade). `node scripts/credential-expiries.mjs plan` lo convalida e lo confronta con i segreti dichiarati in `cloudflare.config.ts`; `apply` lo copia nella D1 dell'ambiente (`--mode live` per la Production, `--local` per la D1 locale), con i segreti senza voce aggiunti senza data. Da lì la console apre una P2 quando una credenziale scade entro 45 giorni, che diventa P1 alla scadenza, e una P3 per le voci senza data. Dopo ogni rinnovo si aggiorna il file e si ripete `apply`: il rientro arriva al controllo successivo.

**Errori fuori dal consumer.** Un'eccezione che esce dal consumer della coda, come un errore passeggero di D1, rimanda i messaggi non ancora chiusi con la stessa attesa crescente dei consumer: la ripetizione immediata di Cloudflare consumerebbe i cinque tentativi in pochi secondi. Il messaggio nella coda dei falliti si legge senza toccarlo con `cf queues messages peek`.

**Eventi ordinari.** L'app scrive nei log soltanto errori, segnalazioni dei pagamenti, osservazioni tardive degli ordini e fasi del collaudo; webhook e sicurezza falliti sono sempre registrati. Gli eventi ordinari riusciti vanno soltanto nei contatori di Analytics Engine, che campiona da sé, e nei record di invocazione. Questi restano al 100% (`headSamplingRate = 1`): il campionamento di Workers Logs scarterebbe anche gli errori e il tempo CPU delle pagine.

<a id="archivio-log"></a>
## Archivio dei log

Workers Logs conserva sette giorni; i 90 giorni del [§31](OPERATIONS.md#s31) stanno in un bucket R2 UE per ambiente, `fiscalbay-test-logs` per il test e `fiscalbay-logs` soltanto nel mandato Production, scritto da un job Logpush `workers_trace_events` e senza binding del Worker. `logpush: true` in `cloudflare.config.ts` invia gli eventi di invocazione; il job tiene soltanto quelli con lo `ScriptName` dell'ambiente ed esporta `EventTimestampMs`, `EventType`, `Outcome`, `ScriptName`, `ScriptVersion`, `CPUTimeMs`, `WallTimeMs` e `Logs`, senza campionamento. `Event` e `Exceptions` restano fuori: l'esito di un'eccezione si legge in `Outcome`, il suo testo soltanto nei sette giorni di Workers Logs. I messaggi di `Logs` nascono tutti da `app/log-records.ts`, con eventi e chiavi da elenchi chiusi e valori scalari; un test dello script rifiuta altre scritture sulla console nel codice del Worker.

La destinazione R2 diretta di Logpush non accetta bucket con giurisdizione, quindi il job usa quella S3-compatible sull'endpoint `<account>.eu.r2.cloudflarestorage.com`, senza ownership challenge, con oggetti NDJSON compressi in sottocartelle giornaliere UTC. `node scripts/log-archive.mjs plan` stampa bucket, regola e job con le credenziali sostituite.

1. `node scripts/log-archive.mjs apply` crea il bucket con giurisdizione UE se manca e applica la regola `log-scaduti`: oggetti eliminati dopo 90 giorni, caricamenti incompleti dopo uno. Senza credenziali si ferma qui.
2. Creare con `cf accounts tokens create` un token dell'account con i permessi Workers R2 Storage Bucket Item Read e Write sulla sola risorsa `com.cloudflare.edge.r2.bucket.<account>_eu_<bucket>`. Per l'endpoint S3 l'ID della chiave di accesso è l'ID del token e la chiave segreta è lo SHA-256 del suo valore: salvarli senza stamparli nel Portachiavi, con `security -i` da standard input, alle voci «FiscalBay log archive test access key ID» e «FiscalBay log archive test secret access key» (`live` per la Production). In alternativa lo script legge `LOG_ARCHIVE_ACCESS_KEY_ID` e `LOG_ARCHIVE_SECRET_ACCESS_KEY`. Le credenziali passano alla CLI da un file temporaneo leggibile soltanto dall'utente e non compaiono nell'output. Il token del test è «FiscalBay archivio log test».
3. Ripetere `apply`: crea o aggiorna il job con il corpo completo, perché l'aggiornamento di Logpush sostituisce l'intero `output_options`. La CLI `cf` alla versione fissata rifiuta la creazione senza `--kind`: lo script passa `--kind edge` soltanto per la validazione, mentre la richiesta usa il corpo, che non ha `kind`.
4. Dopo il deploy che porta `logpush: true`, `node scripts/log-archive.mjs readback` controlla giurisdizione, `r2.dev` spento e assenza di domini, la sola regola a 90 giorni, un solo job verso il bucket, attivo, con filtro, campi, campionamento ed endpoint attesi e senza errori dopo l'ultimo invio riuscito, e il Worker con Logpush attivo. Esce con 1 se un controllo non passa; non stampa la destinazione.
5. Qualche minuto dopo un'invocazione, `node scripts/log-archive.mjs verify` scarica l'oggetto più recente degli ultimi due giorni e controlla ogni record: soltanto i campi ammessi, soltanto il Worker dell'ambiente, ogni messaggio un evento applicativo ammesso o il marcatore di troncamento di Logpush. Riporta conteggi, mai il contenuto.

Query di diagnosi sull'archivio, con `--days` da 1 a 90 (predefinito 1) e `--mode live` per la Production:

| Comando | Risultato |
|---|---|
| `errors` | Errori applicativi per codice, operazione e tipo di guasto del provider |
| `webhooks` | Gli stessi, soltanto per ingresso, consumer e webhook Stripe |
| `failures` | Invocazioni non riuscite per tipo, esito e versione: eccezioni, annullamenti e scritture interrotte |
| `correlation --id <id>` | Invocazioni con il correlation ID mostrato all'utente o riportato dal supporto, in ordine di tempo |

Le query scaricano ogni oggetto della finestra con la CLI, quindi le finestre lunghe richiedono tempo; i Workers Logs restano la via più rapida per gli ultimi sette giorni. Ogni invocazione esportata conta per Logpush dei Workers, 10 milioni al mese inclusi nell'account: restano sotto l'incluso finché le invocazioni dei Worker con Logpush dell'account restano sotto quella soglia; lo storage segue la riga R2 della [tabella delle quote](CAPACITY.md#capacita). R2 elimina gli oggetti scaduti normalmente entro un giorno dalla scadenza della regola.

<a id="statistiche-sito"></a>
## Statistiche del sito e Search Console

Le pagine pubbliche caricano il beacon di Cloudflare Web Analytics soltanto se il Worker ha il segreto facoltativo `WEB_ANALYTICS_TOKEN` ([D242](../decisions/DECISION_REGISTER.md)); l'area dell'account, la console e l'anteprima non lo caricano mai. Il token è pubblico, ma nasce con il sito Web Analytics e si imposta come segreto per non renderlo obbligatorio in locale e nelle prove.

1. Il sito Web Analytics è per host, `fiscalbay.it`, e vale anche per `test.fiscalbay.it`, perché Cloudflare accetta i sottodomini dello stesso dominio; nella dashboard le visite si separano per hostname. Non ha inserimento automatico (`pnpm exec cf rum site-info list` rilegge `auto_install: false`, senza `ruleset`): il Worker sceglie le pagine e la CSP ammette soltanto lo script del beacon. Il sito legato alla zona, creato il 2026-09-19, resta con la raccolta spenta e non si usa: accendere la raccolta di un sito di zona accende anche l'inserimento di Cloudflare in ogni pagina, accesso e area compresi, che una regola in pausa non ferma.
2. `pnpm exec cf workers secrets update` imposta su ogni Worker `WEB_ANALYTICS_TOKEN`, il token del sito letto con `cf rum site-info list`, con le stesse cautele dei segreti Turnstile. Il token non scade: nel [registro](#incidenti) ha `"never"` in entrambi gli ambienti, seguito da `credential-expiries.mjs apply`. La versione creata dal segreto non porta l'identità della release: fino al deploy successivo `release.mjs` non considera compatibile il rollback automatico e vale la correzione in avanti, e il preflight di `Promuovi` prende la base dall'ultimo stato registrato dal ciclo ([pubblicazione](RELEASE.md)).
3. Readback: la fase `dopo` della [checklist](LAUNCH.md#checklist-operativa) verifica che le pagine pubbliche, legali comprese, contengano lo script `https://static.cloudflareinsights.com/beacon.min.js` con il token e `"spa":false` e la CSP che lo ammette, e che accesso, area riservata e anteprima non lo contengano. In un browser reale l'invio a `/cdn-cgi/rum`, sull'origine o su `cloudflareinsights.com`, risponde 204 senza violazioni della CSP; i browser automatici possono ricevere un rifiuto. La presenza dello script non prova la raccolta: fino al 2026-11-06 il token era quello del sito di zona, che rifiutava ogni invio. La CSP ammette lo script in `script-src` e `https://cloudflareinsights.com` in `connect-src`: in locale, fuori dalla rete Cloudflare, il beacon invia lì.

Il robots.txt della Production dichiara i Content Signals `search=yes, ai-input=yes, ai-train=yes` per ogni crawler, e `/llms.txt` descrive il servizio con le pagine della sitemap nelle due lingue, con titoli e descrizioni dei metadati delle pagine ([D294](../decisions/DECISION_REGISTER.md)). Fuori dalla Production robots.txt resta chiuso.

Search Console si verifica sul dominio `fiscalbay.it` con il record TXT `google-site-verification`, aggiunto da Google nella zona con l'integrazione Cloudflare il 2026-10-31, e ha ricevuto `https://fiscalbay.it/sitemap.xml` il 2026-11-01. Non aggiunge nulla alle pagine.

Bing Webmaster Tools importa il sito da Search Console con l'account dell'owner. Dopo una promozione che aggiunge, rinomina o toglie pagine pubbliche, `node scripts/indexnow.mjs submit` invia a IndexNow le pagine della sitemap Production; `plan` mostra l'invio senza eseguirlo. La chiave è pubblica per protocollo e il file `public/<chiave>.txt` la serve dal dominio. Crawler Hints di Cloudflare resta spento: segnala i MISS della cache, e le pagine del sito escono dal Worker senza passare dalla cache.

Il collaudo browser non conta come visita: i fixture di Playwright sostituiscono script e raccolta su ogni dominio, compresa la Production di `publish.yml`.

<a id="metriche-release"></a>
## Confronto delle metriche fra release test

Workers Metrics mostra nativamente i deploy nella finestra scelta: un deploy al 100% appare come marcatore, quelli vicini possono essere raggruppati; un rollout graduale mostra progressione e percentuali. Una versione soltanto caricata o allo 0% non appare. La [capacità di piattaforma](https://developers.cloudflare.com/changelog/post/2026-09-25-release-flows-workers-metrics/) non richiede codice, un nuovo servizio o un gate CPU automatico nella CI.

1. Aprire il Worker `fiscalbay-test` da Compute → Workers e Pages, poi Metrics. Rileggere prima `pnpm exec cf workers deployments list --worker fiscalbay-test` e la ricevuta della release pertinente: collegare deployment ID, version ID, commit annotato, percentuale e orario UTC. Un deploy concorrente cambia il confronto, non si sovrascrive.
2. Selezionare una finestra che includa un deploy test esistente con dati su entrambi i lati. Leggere il suo marcatore, o il gruppo di marcatori vicini, e riconciliare versione e posizione temporale con la cronologia delle distribuzioni e la lettura CLI; consultare il dettaglio del rollout quando disponibile. Non distribuire una versione per creare un evento.
3. Confrontare finestre di uguale durata, escludendo il rollout e il periodo di assestamento. Annotare granularità, fuso, volume e composizione del traffico; usare CPU e wall time p50/p90/p99 disponibili nei grafici nativi e numero/tasso di errori; per p95 usare la lettura GraphQL sotto. Separare HTTP, cron e consumer nei Logs quando disponibile, senza confondere un cambio di carico con un effetto del codice.
4. Se serve una lettura riproducibile, usare GraphQL Analytics sullo schema effettivo: `workersInvocationsAdaptive` filtrato per `scriptName`, intervallo UTC e `scriptVersion`, con `sum.requests`, `sum.errors`, `quantiles.cpuTimeP50/P95`, `quantiles.wallTimeP50/P95` e `avg.sampleInterval`. I quantili sono in microsecondi, da dividere per 1.000 per ottenere ms. I conteggi del dataset adattivo sono stime quando campionati; non pesarli nuovamente come datapoint Analytics Engine né sommare/mediofare percentili di gruppi diversi. Rileggere `settings` per disponibilità, finestra massima e retention.
5. Riportare il confronto nella PR/CI o nella ricevuta pertinente con limiti del campione; una correlazione non attribuisce da sola la causa e non chiude il collaudo browser o la capacità pubblica. Se mancano dati, marcatori o accesso, separare procedura aggiornata e prova rimasta aperta.

La qualifica del 12 ottobre 2026 ha rilevato nel grafico CPU nativo il marcatore `78d2692d` e il gruppo di due distribuzioni precedenti, riconciliati con la cronologia provider; il dettaglio hover del gruppo non è stato letto. La lettura API ha qualificato il confronto sulle release già esistenti sotto, entrambe al 100%; nessun deploy eseguito per questa prova. Le finestre sono UTC e contengono una sola versione ciascuna.

| Lato | Release e finestra | Invocazioni / errori | CPU p50 / p95 | Wall time p50 / p95 |
|---|---|---|---|---|
| Prima | Deployment `8e54843f-7141-4918-8520-7c2a7fda52fa`, versione `1f0345d8-b59e-4b84-89ea-4b5450f25a3e`, commit `a2bbf1d5e1dd29382679e4dae63a5523d7ac482c`, deploy 11 ottobre 21:47:42; finestra 12 ottobre 03:00–05:00 | 8 / 0 | 25,416 / 54,869 ms | 2.456,621 / 4.973,567 ms |
| Dopo | Deployment `95a2d3aa-f777-4068-a7ef-78aea82d9841`, versione `78d2692d-dca9-4448-8a5c-0744f4edcc1b`, commit `1fbdf2f6e8b9ffd11833b682c70539630841ff4e`, deploy 12 ottobre 05:57:42; finestra 12 ottobre 07:00–09:00 | 11 / 0 | 50,384 / 87,476 ms | 2.778,139 / 9.997,963 ms |

`avg.sampleInterval = 1` in entrambi i gruppi; entrambi hanno `status = success`. Il campione ridotto e il carico non controllato qualificano la lettura, non dimostrano una regressione. `settings.workersInvocationsAdaptive` ha confermato dataset abilitato, query fino a 32 giorni e dati non più vecchi di 90 giorni: sono limiti di questo dataset dell'account, non la retention Workers Logs o un'estensione degli analytics della zona.

<a id="metriche-tecniche"></a>
## Metriche tecniche su Analytics Engine

Il Worker scrive nel dataset dell'ambiente, `fiscalbay_test_metrics` o `fiscalbay_metrics`, che nasce alla prima scrittura e conserva i punti tre mesi. La disposizione dei campi è in `app/metrics.server.ts`, le query in `app/metrics-queries.ts`. Ogni valore è una stima pesata con `_sample_interval`: si riporta con finestra e approssimazione e non decide quote, billing o accessi. I KPI deduplicati restano in D1.

```bash
node scripts/metrics-query.mjs phases --hours 24
```

Le query sono `invocations`, `phases` e `pages`; in `invocations` numero, media e quantili valgono per invocazione e `messages` conta i messaggi della coda; `--mode live` legge la Production, `--hours` va da 1 a 2.160. La CLI `cf` usa il proprio accesso: nessun token passa dallo script.

```bash
node scripts/metrics-query.mjs sample --count 40
```

Il campione controllato invia al solo test 40 richieste anonime `HEAD /api/v1/page-timing`, che rispondono 405 senza effetti. Il Worker dà a questa sola richiesta la classe `sample`, con metodo `HEAD` ed esito `4xx`: altre richieste `HEAD` sulle API restano nella classe `api` e fuori dal conteggio. Dopo due minuti confronta il conteggio stimato e pesato con `_sample_interval` nella finestra di invio con quello atteso. Esito non zero se diverge; `sampled` indica che Analytics Engine ha campionato. I punti restano nel dataset test fino alla scadenza. I report del browser richiedono il biglietto della pagina, quindi il campione non li usa.

Il rendering non è una fase misurata nel Worker: l'orologio resta fermo durante il calcolo, quindi una durata misurata nel codice vale zero. Il suo costo si legge come tempo CPU delle pagine dai Workers Logs, conservati sette giorni e registrati per ogni invocazione.

```bash
node scripts/metrics-query.mjs cpu --hours 24
```

Per Ordini e Negozi, documento e dati (`.data`), la query conta le richieste GET, senza il collegamento di un negozio (`negozi/collega`) che è un'altra route, e riporta CPU mediana e al 95° percentile e durata mediana; `--hours` va da 1 a 168. La CPU comprende rendering e resto del calcolo della richiesta, senza le attese di D1 ed eBay. L'indirizzo resta nel filtro della query, mai nel risultato.

La sezione Prestazioni della console legge le stesse query sulle ultime 24 ore con il segreto `ANALYTICS_READ_TOKEN` del Worker: un token API dell'account con i soli permessi Account Analytics Read e Workers Observability Read, uno per ambiente. Si crea con `pnpm exec cf accounts tokens create --name "<nome>" --policies @<file>` e una policy limitata all'account e ai due gruppi; il valore passa dall'output JSON al Portachiavi e poi al segreto del Worker dell'ambiente, mai nella cronologia dei comandi o nei log. Il token del test è «FiscalBay metriche test», nel Portachiavi alla voce «FiscalBay analytics test». Senza il segreto la sezione resta non configurata e nessuna altra parte dell'app ne dipende.
