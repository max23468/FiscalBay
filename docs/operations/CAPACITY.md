# Capacità e costi

Quote, costi e punti di arresto dei servizi. Fa parte delle [operazioni](OPERATIONS.md); il rilascio è in [Test e pubblicazione](RELEASE.md).

<a id="capacita"></a>
## Capacità e costi

```bash
node scripts/capacity.mjs
```

Il comando è manuale, fuori da `verify` e dalla CI. Popola la D1 locale con il caso di riferimento del [§36](../archive/2026-11-master-plan-2.0.md#s36) (`benchmarks/capacity-dataset.ts`): 50 spazi Pro con un anno di ordini, uno dei quali con tre negozi e 10.002 ordini, e 100 spazi Free con trenta giorni, per 78.802 ordini, 236.406 articoli e 94.562 identificativi, con i termini di conservazione che assegna l'app. Poi esegue due misure e scrive `reports/capacity/summary.md`.

- `costs` esegue `benchmarks/capacity.spec.ts` nel runtime Workers locale e conta per operazione query, righe D1 lette e scritte, messaggi accodati e chiamate eBay per API, con le cinque istruzioni più pesanti. I valori sono esatti e ripetibili. Qui l'orologio avanza soltanto con l'I/O, quindi i tempi non si leggono da questa suite.
- `latency` costruisce la build test, carica lo stesso dataset nella D1 locale e la serve con `vite preview` sulla porta 5196: pagine Ordini con SSR e suggerimenti di ricerca, a freddo, venti in sequenza e dieci in parallelo per tre volte, con le fasi di `Server-Timing`. Misura la macchina di sviluppo, non il runtime distribuito, e sostituisce la D1 locale delle prove browser, che la ripopolano. `vite preview` non espone il cron: il suo costo viene dalla suite, il suo tempo dai Workers Logs con `metrics-query.mjs cpu`.
- `remote`, soltanto sul test e a richiesta dell'owner, carica lo stesso dataset nella D1 del test negozio per negozio, con i negozi sintetici mai dovuti al cron e gli spazi appena attivi, così nessuna lettura, email o pausa parte da loro. Accede con tre spazi sintetici e una password generata e mai salvata, ripete le prove delle pagine su `test.fiscalbay.it`, poi elimina ogni riga `cap-` e verifica tabella per tabella che non ne resti nessuna; tre minuti dopo legge richieste, CPU e durata del Worker e righe della D1 nella finestra. Ogni query ripete fino a tre volte un errore dell'API; se la pulizia si ferma, le misure restano in `reports/capacity/remote-partial.json` e `node scripts/capacity.mjs remote-clean` la completa. Le righe per istruzione della D1 remota si leggono da `d1QueriesAdaptiveGroups`.
- `account` legge dalla GraphQL Analytics API il consumo degli ultimi 30 giorni dell'account condiviso, per Worker, database e coda, con il token di sola lettura del Portachiavi «FiscalBay analytics test» o `CLOUDFLARE_API_TOKEN`. Attribuisce il consumo a ciascun progetto per nome del Worker e ID del database.

La proiezione mensile moltiplica i costi per operazione per le cadenze dei piani (Pro ogni 10 minuti, Free ogni 30), 100 ordini nuovi al mese per negozio, un turno del cron ogni 10 minuti e visite ipotizzate per spazio e giorno (10 aperture degli Ordini, 2 ricerche, 5 dettagli). Il tempo CPU usa la media per invocazione del Worker test letta con `account`. Le visite sono un'ipotesi: si sostituiscono con le misure reali quando esistono. Il numero di clienti si stima da questa proiezione, mai dai soli MAU Auth o dalla media degli ordini.

### Quote di riferimento e punti di arresto

Quote mensili di Workers Paid lette il 2026-10-28 dalla [documentazione dei prezzi](https://developers.cloudflare.com/workers/platform/pricing/); i valori sono per l'intero account, condiviso con altri progetti. Come vuole il [§31](OPERATIONS.md#s31), l'80% di una quota inclusa raggiunto prima della fine del ciclo di fatturazione, o qualsiasi addebito oltre il canone, avvia la verifica: la quota si confronta con la somma della proiezione FiscalBay e del consumo degli altri progetti letto con `account`. Le quote eBay hanno la soglia del 70% fissata da eBay per l'Application Growth Check.

| Risorsa | Inclusa nel piano | Oltre l'incluso | Punto di arresto |
|---|---|---|---|
| Worker | 10 milioni di richieste e 30 milioni di ms CPU al mese; 30 s di CPU per invocazione, fissati in `cloudflare.config.ts`, con 15 minuti di clock per cron e consumer | 0,30 USD per milione di richieste, 0,02 USD per milione di ms | 80% delle richieste o della CPU; CPU p95 di una pagina oltre il doppio della misura del 2026-10-28 sul test (Ordini 177 ms il documento e 37 ms i dati, Negozi 86 e 50 ms) |
| Database D1 | 25 miliardi di righe lette, 50 milioni di righe scritte, 5 GB al mese; 10 GB per database | 0,001 USD per milione di righe lette, 1 USD per milione scritte, 0,75 USD per GB | 80% delle righe o 8 GB nel database dell'ambiente |
| Queue | 1 milione di operazioni al mese, tre per messaggio; il cron accoda dieci negozi per messaggio | 0,40 USD per milione | 80% delle operazioni; arretrato oltre un turno del cron o messaggi nella coda dei falliti |
| Email Service | 3.000 invii al mese | Prezzi del servizio | 80% degli invii |
| Cron e smistamento | Un turno ogni 10 minuti; ogni turno accoda al massimo 300 letture dei negozi, a gruppi da dieci | Nessun costo diretto | 240 negozi dovuti per turno: Pro più un terzo dei Free |
| R2 | 10 GB-mese, 1 milione di operazioni di classe A e 10 milioni di classe B | 0,015 USD per GB-mese, 4,50 e 0,36 USD per milione | 80% dello storage o delle operazioni |
| Workers Logs e Logpush | Fino al 30 novembre 2026, 20 milioni di eventi al mese; dal 1° dicembre 2026 50 GB di ingestione e 10 GB-mese di storage condivisi con le altre fonti dell'[Observability](https://developers.cloudflare.com/observability/pricing/). Logpush dei Workers: 10 milioni di richieste al mese | 0,60 USD per milione di eventi; poi 0,25 USD per GB e 0,10 USD per GB-mese; Logpush 0,05 USD per milione | 80% degli eventi, poi dell'ingestione |
| Analytics Engine | Un punto per invocazione e uno per fase misurata, da elenchi chiusi | Prezzi da rileggere nella pagina del prodotto prima dell'apertura | Punti per invocazione oltre quelli delle fasi elencate in `app/observability.server.ts` |
| Quote eBay del keyset | Fulfillment 100.000 chiamate al giorno, Trading `GetOrders` e `GetItem` 5.000 ciascuna, condivise | Nessuna | 70% del consumo giornaliero di una API: Application Growth Check di eBay |

Al raggiungimento di un punto di arresto: fermare i nuovi ingressi con l'ammissione della lista d'attesa e, se serve, le chiamate eBay dalla console; attribuire il consumo al progetto e al Worker giusti con `account` e con i grafici nativi; poi ottimizzare la voce. Nessun costo variabile è accettato ([D227](../decisions/DECISION_REGISTER.md)): se l'ottimizzazione non basta, le nuove ammissioni restano ferme. Il confronto CPU, durata ed errori fra release resta quello [fra release test](OBSERVABILITY.md#metriche-release), senza gate CPU automatico al deploy.

Avvisi dell'account: Cloudflare invia gli avvisi di budget per email sulla spesa a consumo dell'account, esclusi i canoni. Con D227 la soglia utile è il primo centesimo: gli avvisi di budget da 0,01 USD già presenti sull'account, riletti il 2026-10-28, segnalano qualsiasi addebito variabile. L'account è condiviso: le notifiche esistenti si rileggono prima di aggiungerne o cambiarne.
