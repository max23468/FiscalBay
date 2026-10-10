# Confronto delle fonti fiscali eBay

`node scripts/compare-ebay-tax.mjs` confronta gli identificativi dell'acquirente sugli stessi ordini controllati, senza scritture nel database né file di risposta. `fulfillmentTaxIdentifiers` conserva il tipo originale e la fonte `ebay_fulfillment`. L'import automatico usa la precedenza circoscritta approvata in D135; non esegue il confronto sperimentale fra due letture Fulfillment e Trading.

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

`equal` indica stesso insieme di tipo e valore, con Paesi compatibili; `countryComplete=false` rende esplicito che il confronto del Paese non è completo. Paesi entrambi presenti e diversi producono `different`. Si riconosce soltanto la corrispondenza documentata tra [`CODICE_FISCALE` di Fulfillment](https://developer.ebay.com/api-docs/sell/fulfillment/types/sel:TaxIdentifierTypeEnum) e [`CodiceFiscale` di Trading](https://developer.ebay.com/devzone/XML/docs/Reference/eBay/types/ValueTypeCodeType.html); tutti gli altri tipi richiedono uguaglianza esatta. Gli adapter conservano i tipi originali e nessun Paese viene inferito. `both_absent` non dimostra equivalenza né rimozione autorevole. `trading_order_unavailable`, `marketplace_unresolved`, `error` e `not_read` non sono confronti riusciti. Errori di credenziali, quota o indisponibilità interrompono le letture successive; errori del singolo ordine lasciano proseguire il campione.

`supportsReview` è vero soltanto se ogni ordine del campione ha un confronto positivo con dati presenti. Non cambia la precedenza delle fonti e non certifica copertura per età o marketplace non provati. La proposta all'owner deve accompagnarlo con composizione e limiti del campione, Paesi incompleti e budget del keyset condiviso. La prova locale sintetica non sostituisce quella su FiscalBay.

## Quote e contratto esterno

Il report misura le chiamate realmente tentate e mostra il costo massimo del confronto. Il dettaglio qualificato richiede una chiamata Fulfillment con marketplace già noto e nessuna Trading fiscale: risparmio di una `GetOrders`, senza togliere le chiamate Trading `GetItem`. Negli altri casi il dettaglio mantiene una Fulfillment e una Trading, escluse immagini, lista e rinnovi. Il budget applicativo scala le chiamate effettivamente necessarie; non cambia la frequenza dello scheduler né autorizza nuova capacità.

Le quote riportate nel report (100.000 Fulfillment e 5.000 Trading al giorno) conservano la data del readback registrato nel piano il 2026-10-08. La lettura Analytics del 2026-10-10 sul keyset FiscalBay ha riconfermato 100.000 per `sell.fulfillment` e 5.000 per ciascuna delle risorse `GetOrders` e `GetItem`, con finestra di 86.400 secondi. Consumo e margine condivisi restano privati e vanno riletti al momento di una modifica dello scheduler.

La [specifica ufficiale Fulfillment v1.20.7](https://developer.ebay.com/api-docs/master/sell/fulfillment/openapi/3/sell_fulfillment_v1_oas3.json), consultata il 2026-10-09, definisce questi campi fiscali solo per `getOrder`, indica ordini fino a due anni e descrive il contenitore per i marketplace Italia e Spagna. [Trading GetOrders](https://developer.ebay.com/devzone/xml/docs/reference/ebay/GetOrders.html) documenta la finestra di 90 giorni. L'effetto dell'header sulla disponibilità fiscale e le finestre effettive vanno misurati: oltre 90 giorni un ordine Trading non restituito non dimostra assenza dell'identificativo.

## Qualifica Production del 2026-10-10

Lettura controllata sul negozio owner con ordini, usando il keyset FiscalBay dalla custodia 1.x. `GetUser` ha confermato la corrispondenza con il negozio collegato al test prima del confronto. Il token iniziale dell'altro negozio, privo di ordini recenti, non era utilizzabile per questo campione. Nessun ordine, consenso, token persistito o dato fiscale è stato modificato. Durante il confronto le copie locali del segreto Auth non aprivano i token correnti. La custodia è stata poi riconciliata su mandato owner, recuperando il valore attivo del Worker nel Portachiavi senza rotazione; la copia apre tutti gli otto token dei quattro negozi reali e il deploy test è invariato.

Il campione comprende sei ordini per ciascuna fascia entro 90 giorni, divisi tra presenza e assenza fiscale già osservate nel test, e tre ordini per ciascuna delle due finestre storiche ottenuti direttamente da Fulfillment. Tutti hanno marketplace `EBAY_IT`; la prova non qualifica Spagna, altri tipi fiscali, più identificativi per ordine o altri venditori.

| Età osservata | Ordini | Senza header | Con header | Confronto Trading |
|---|---|---|---|---|
| 0–14 giorni | 6 | Nessun identificativo | 3 presenti, 3 assenti | 3 valori CF coincidenti; 3 assenti in entrambe |
| 15–90 giorni | 6 | Nessun identificativo | 3 presenti, 3 assenti | 3 valori CF coincidenti; 3 assenti in entrambe |
| 91–365 giorni, selezione 91–120 | 3 | Nessun identificativo | 1 presente, 2 assenti | Ordini non restituiti da Trading |
| Oltre 365 giorni, selezione 366–400 | 3 | Nessun identificativo | 3 presenti | Ordini non restituiti da Trading |

Il confronto ha eseguito 36 chiamate Fulfillment e 18 Trading, senza errori né interruzioni; le letture di identità, selezione del campione e diagnosi restano separate. Nei sei confronti con dati presenti i valori coincidono esattamente; il Paese non è completo in entrambe le fonti e non è stato ricostruito. La differenza iniziale era il nome del tipo: il comparatore è stato corretto sulla sola corrispondenza ufficiale, con test negativi per gli altri nomi. Il report complessivo conserva `supportsReview=false`, perché assenze e ordini Trading non disponibili non dimostrano equivalenza universale.

La revisione circoscritta di D135 è stata approvata dall'owner il 2026-10-10 e implementata localmente. Il dettaglio usa Fulfillment con marketplace dell'inserzione `EBAY_IT` e `TAX_BREAKDOWN` come prima lettura del CF italiano Production: un identificativo presente di tipo `CODICE_FISCALE`, con Paese assente o `IT`, evita Trading. Assenze, campi malformati, tipi o marketplace non qualificati e Sandbox mantengono il fallback Trading, nei limiti di disponibilità del provider. Un dettaglio riferito a un altro ordine o a un marketplace discordante si rifiuta e resta da riprovare. Un'assenza Fulfillment non autorizza rimozioni di dati già osservati. Oltre 90 giorni la presenza Fulfillment è provata sul campione, ma la coincidenza con Trading non è verificabile. `GetItem`, liste, rinnovi e fallback mantengono il proprio costo. Le osservazioni persistite conservano fonti e tipi originali; nella consultazione un CF coincidente appare una sola volta con precedenza Fulfillment, senza nascondere valori o Paesi discordanti. Distribuzione test e readback delle ultime modifiche restano da completare.
