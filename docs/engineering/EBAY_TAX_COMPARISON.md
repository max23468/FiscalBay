# Confronto delle fonti fiscali eBay

`node scripts/compare-ebay-tax.mjs` confronta gli identificativi dell'acquirente sugli stessi ordini controllati, senza scritture nel database né file di risposta. Gli adapter applicativi mantengono Trading primario; `fulfillmentTaxIdentifiers` restituisce soltanto una seconda osservazione con fonte `ebay_fulfillment`. L'import automatico non attiva questa prova né acquisisce nuovi valori Fulfillment.

## Esecuzione controllata

Prima della lettura verificare mandato, account venditore, ambiente e keyset FiscalBay nella custodia privata. Non usare il keyset di SyncBay o un token di un altro progetto. Lo strumento non può attestare da quale keyset provenga un token opaco. Non crea né modifica ordini e non rinnova token.

Fornire un access token seller valido, con i permessi di lettura Fulfillment e Trading, mediante `EBAY_ACCESS_TOKEN` già valorizzata dalla custodia sicura. Non scrivere il token nella riga di comando, nel campione o nel repository. Lo standard input riceve un oggetto JSON con `environment` (`production` oppure `sandbox`) e `orderIds` (da 1 a 50 ID distinti dello stesso account). Il campione e la corrispondenza con il numero progressivo dell'output restano privati, fuori dal checkout.

Esempio della sola struttura, con ID sintetico:

```json
{ "environment": "sandbox", "orderIds": ["ordine-sintetico"] }
```

Eseguire dalla radice del progetto, fornendo il campione privato allo standard input. L'output JSON contiene numeri progressivi, marketplace, fasce di età in giorni, conteggi degli identificativi, coincidenza ed errori sanitizzati. Non contiene ID ordine, valori, hash, token, nomi o payload. Gli errori di input non vengono stampati con dettagli. Il caricamento degli adapter usa Vite già installato, senza avviare il server applicativo. Il codice d'uscita è 1 per errori o letture interrotte; una divergenza fra fonti resta un risultato leggibile con codice 0.

## Lettura ed esiti

Per ogni ordine si eseguono al massimo due `getOrder` e un `GetOrders` Trading, senza retry automatici:

1. Fulfillment con `fieldGroups=TAX_BREAKDOWN`, senza header marketplace. La risposta fornisce `lineItems[].listingMarketplaceId` e il conteggio fiscale di controllo.
2. Stessa lettura con `X-EBAY-C-MARKETPLACE-ID` ricavato da tutte le righe. Marketplace assenti, incompleti o discordanti impediscono la seconda chiamata; nessun fallback su Paese del buyer o marketplace predefinito.
3. Trading sul medesimo ID, considerando anche `ExtendedOrderID` nella risposta. Un ordine non restituito è distinto da uno restituito senza identificativi.

Le risposte Fulfillment devono riguardare l'ID richiesto e conservare marketplace, fascia di età e revisione dell'ordine. Campi fiscali presenti ma malformati causano errore. Si considera esclusivamente `buyer.taxIdentifier` con `taxpayerId`, `taxIdentifierType` e Paese emittente: dati del venditore, di eBay o delle righe non entrano nel confronto. I valori Trading duplicati si contano una sola volta.

`equal` indica stesso insieme di tipo e valore, con Paesi compatibili; `countryComplete=false` rende esplicito che il confronto del Paese non è completo. Paesi entrambi presenti e diversi producono `different`. Non si inferiscono tipi equivalenti o Paesi mancanti. `both_absent` non dimostra equivalenza né rimozione autorevole. `trading_order_unavailable`, `marketplace_unresolved`, `error` e `not_read` non sono confronti riusciti. Errori di credenziali, quota o indisponibilità interrompono le letture successive; errori del singolo ordine lasciano proseguire il campione.

`supportsReview` è vero soltanto se ogni ordine del campione ha un confronto positivo con dati presenti. Non cambia la precedenza delle fonti e non certifica copertura per età o marketplace non provati. La proposta all'owner deve accompagnarlo con composizione e limiti del campione, Paesi incompleti e budget del keyset condiviso. La prova locale sintetica non sostituisce quella su FiscalBay.

## Quote e contratto esterno

Il report misura le chiamate realmente tentate e mostra il costo massimo del confronto. Il dettaglio attuale richiede una chiamata Fulfillment e una Trading, escluse immagini, lista e rinnovi. L'ipotesi dopo approvazione richiederebbe una Fulfillment con marketplace già noto e nessuna Trading fiscale: risparmio di una `GetOrders` per dettaglio, senza togliere le chiamate Trading `GetItem`. Non è una modifica dello scheduler o una nuova capacità autorizzata.

Le quote riportate (100.000 Fulfillment e 5.000 Trading al giorno) sono il readback registrato nel piano il 2026-10-08, non una nuova interrogazione Analytics. Prima della decisione vanno riconfermati consumo condiviso, immagini, polling, backfill e quota residua.

La [specifica ufficiale Fulfillment v1.20.7](https://developer.ebay.com/api-docs/master/sell/fulfillment/openapi/3/sell_fulfillment_v1_oas3.json), consultata il 2026-10-09, definisce questi campi fiscali solo per `getOrder`, indica ordini fino a due anni e descrive il contenitore per i marketplace Italia e Spagna. [Trading GetOrders](https://developer.ebay.com/devzone/xml/docs/reference/ebay/GetOrders.html) documenta la finestra di 90 giorni. L'effetto dell'header sulla disponibilità fiscale e le finestre effettive vanno misurati: oltre 90 giorni un ordine Trading non restituito non dimostra assenza dell'identificativo.
