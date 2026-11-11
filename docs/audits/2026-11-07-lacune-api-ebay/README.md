# FiscalBay: lacune delle API eBay e richieste

Ricognizione del 7 novembre 2026 sulle API eBay usate da FiscalBay: Fulfillment, Trading, Notification, Identity, cancellazione degli account e quote. Gli invii a eBay li decide e li fa l'owner: il [ticket inviato](#ticket-inviato) e la [risposta](#risposta-di-ebay) sono riportati qui sotto, le bozze in inglese sono in questa cartella.

## In sintesi

Cinque richieste analizzate e cinque domande secondarie. A eBay è andato un solo ticket, limitato a ciò che la dismissione di `GetOrders` toglie senza sostituta; il resto è analisi interna, utilizzabile per eventuali invii futuri. Le capacità già costruibili con le API pubbliche esistenti stanno in un'[appendice](#appendice-costruibile-oggi-da-non-chiedere-a-ebay): chiederle a eBay indebolirebbe le richieste vere.

| # | Richiesta | Tipo | Stato |
| --- | --- | --- | --- |
| 1 | Header del marketplace necessario per l'identificativo fiscale, assente dalla specifica di `getOrder` | bug documentale | nota interna, non inviata ([bozza](bozza-01-header-marketplace.en.md)) |
| 2 | Identificativo fiscale dell'acquirente nelle letture di elenco e nelle API moderne, fatture combinate comprese | capacità | nota interna, non inviata; del punto 2.3 il ticket chiede soltanto dove leggere le fatture combinate ([bozza](bozza-02-dati-fiscali-acquirente.en.md)) |
| 3 | Identità immutabile dell'acquirente negli ordini, per le cancellazioni degli account | capacità e contratto da chiarire | inviata, punto 2 del ticket; eBay lo offre soltanto nella Order API GraphQL, con un nuovo consenso non chiesto ([bozza](bozza-03-identita-acquirente.en.md)) |
| 4 | Notifiche degli ordini: versione 1.1 di `ORDER_CONFIRMATION`, variazioni dell'ordine in sola lettura, destinazioni | contratto da chiarire e capacità | nota interna, non inviata ([bozza](bozza-04-notifiche-ordini.en.md)) |
| 5 | Quote per utente leggibili con gli scope di sola lettura degli ordini | capacità | nota interna, non inviata ([bozza](bozza-05-quote-per-utente.en.md)) |

Stato: ticket inviato dall'owner il 7 novembre 2026, area Trading API; [risposta](#risposta-di-ebay) ricevuta l'11 novembre e scelta dell'owner registrata in [D334](../../decisions/DECISION_REGISTER.md).

**Dismissione di `GetOrders`.** Il 6 novembre eBay ha deprecato Trading `GetOrders` e fissato lo spegnimento al 30 giugno 2027: per gli ordini pagati rimanda a Fulfillment, per impegni non pagati e `PurchaseQuote` alla Order API GraphQL (documentato, [stato delle dismissioni](https://developer.ebay.com/develop/get-started/api-deprecation-status), letto nel browser il 7 novembre). Con `GetOrders` spariscono il fallback fiscale, che in Production non ha mai aggiunto un CF, le fatture combinate senza checkout eBay e l'unica fonte del token eIAS dell'acquirente. La migrazione interna è [2.6-01](../../ROADMAP.md#2-6-01).

**Rischio emerso, ridotto internamente.** Il token eIAS dell'acquirente arriva soltanto da Trading `GetOrders`, entro 90 giorni, e sparirà con il suo spegnimento. Il 7 novembre, in Production, 978 dei 1.100 ordini definitivi non lo avevano: tutti gli 891 oltre i 90 giorni e 87 fra 30 e 90, rimasti fuori dalla finestra Trading del primo collegamento (conteggio aggregato in sola lettura, senza identità). Per questi una cancellazione dell'account eBay si abbina soltanto allo username ([conservazione](../../engineering/DATA_RETENTION.md#cancellazione-ebay)), che l'acquirente può cambiare. Ora ogni ordine registra l'ultima lettura dello username e quelli senza token lo rileggono ogni settimana ([D319](../../decisions/DECISION_REGISTER.md)); resta scoperto un cambio di username a ridosso della cancellazione, che soltanto un identificativo immutabile negli ordini chiude. La [risposta](#risposta-di-ebay) lo colloca nella Order API GraphQL, con un nuovo consenso dei negozi che l'owner non chiede ([D334](../../decisions/DECISION_REGISTER.md)): il rischio resta quello residuo di D319.

**Rapporto con i riconoscimenti esterni.** Il dossier non ripete [RE-01](../../ROADMAP.md#re-01)–[RE-04](../../ROADMAP.md#re-04). L'aumento dei limiti resta nell'Application Growth Check ([RE-01](../../ROADMAP.md#re-01)): l'invio 2 riduce le chiamate necessarie, non chiede quota. `USER_STATUS_CHANGE` e i contatti diretti con eBay potrebbero arrivare con il Partner Program ([RE-02](../../ROADMAP.md#re-02)); se FiscalBay viene ammesso, gli invii 2 e 3 possono passare dal referente del programma.

## Ticket inviato

**Subject:** GetOrders decommission: combined invoices, buyer identity and scopes

```text
FiscalBay is a read-only app for Italian eBay sellers. It reads their orders with sell.fulfillment.readonly to collect the buyer's Codice Fiscale for invoicing. Trading GetOrders will be decommissioned on June 30, 2027. Fulfillment already covers the tax ID for us, but we use GetOrders for two things Fulfillment doesn't provide, and the documented replacements need new scopes.

1. Combined invoices paid outside eBay checkout
A seller can create a combined invoice that the buyer pays outside eBay checkout. GetOrders returns these orders, but getOrder rejects them because they have no extended order ID. After June 30, 2027, which API returns them with buyer, line items and amounts? Is it PurchaseQuote, and does it still return them once they're paid?

2. Immutable buyer identifier
Fulfillment returns only the buyer's username, which the buyer can change. Today we take the buyer's EIAS token from GetOrders and use it to:
- match MARKETPLACE_ACCOUNT_DELETION notifications to the orders we store, as the deletion policy requires;
- recognize repeat buyers across a seller's orders.
Will Fulfillment getOrder/getOrders or the GraphQL Order API expose an immutable buyer ID (userId or eiasToken) with the order read scopes? Is Order.buyer.userId returned to the seller? If not, which key should we use to match deletion notifications to orders read from Fulfillment?

3. Scopes and seller consent
The Order API needs sell.order.read and PurchaseQuote needs sell.purchase.quote.read. Can these reads work with sell.fulfillment.readonly, or will all our sellers have to grant consent again? If new scopes are needed, is there a way to add them without a full re-authorization?

Thank you.
```

## Risposta di eBay

Ricevuta per email dal supporto sviluppatori l'11 novembre 2026 (dichiarato dal supporto, non contratto pubblicato).

1. **Fatture combinate pagate fuori dal checkout.** La guida di migrazione conferma Fulfillment per gli ordini pagati e la Order API GraphQL con gli impegni e `PurchaseQuote` per ordini non pagati, impegni e preventivi. `PurchaseQuote` non è documentata come sostituta delle fatture combinate offline già pagate: nessuna API le restituisce dopo lo spegnimento.
2. **Identità immutabile.** In Fulfillment il campo documentato è `buyer.username`; per alcuni sviluppatori, soprattutto statunitensi, può contenere un ID immutabile. La notifica `MARKETPLACE_ACCOUNT_DELETION` porta `userId` e `eiasToken`, e la documentazione indica `userId` come identificativo immutabile. Secondo lo schema GraphQL interno, la lettura degli ordini del venditore può chiedere `buyer { userId username }`: lo schema pubblico del 7 novembre non lo chiariva.
3. **Scope e consenso.** `sell.order.read` e `sell.purchase.quote.read` sono scope separati, non coperti da `sell.fulfillment.readonly`. Il refresh token vale soltanto per gli scope del consenso originale: aggiungerne richiede un nuovo consenso di ogni negozio.

**Scelta dell'owner dell'11 novembre ([D334](../../decisions/DECISION_REGISTER.md)).** La sostituzione di `GetOrders` ([2.6-01](../../ROADMAP.md#2-6-01)) usa soltanto Fulfillment, senza scope nuovi né nuovo consenso. Le fatture combinate offline escono da FiscalBay allo spegnimento: 1 su 1.100 ordini il 7 novembre, senza CF in nessuna fonte. Cancellazioni e acquirenti ricorrenti si abbinano per username, con la rilettura settimanale di D319. `buyer.userId` della Order API resta l'unica strada per un identificativo immutabile, da riconsiderare se un nuovo consenso servisse comunque per altri motivi.

## Metodo e livelli di prova

Codice e documenti: `origin/develop` al commit `9e39de91`, versione `2.0.7` in Production.

Fonti eBay rilette il 7 novembre:

- specifica OpenAPI ufficiale di Fulfillment `v1.20.7`, scaricata e interrogata campo per campo, sia all'indirizzo storico sia a quello del nuovo portale (`/develop/api/spec/fulfillment_api.json`), che include anche gli enum;
- schema GraphQL unificato `listing.graphqls`, scaricato lo stesso giorno;
- specifica OpenAPI della Developer Analytics API `v1_beta.0.1`;
- Notification API Production: `getTopics` e `getTopic` con il token dell'applicazione del keyset FiscalBay, tre chiamate in tutto, nessun token di venditore;
- guida [Marketplace user account deletion](https://developer.ebay.com/develop/guides-v2/marketplace-user-account-deletion) e release notes di [Fulfillment](https://developer.ebay.com/api-docs/sell/fulfillment/release-notes.html) e [Notification](https://developer.ebay.com/api-docs/commerce/notification/release-notes.html);
- riferimenti di migrazione eBay per ordini e account (mappatura ufficiale `GetOrders`, `GetStore`, `GetUser`, `GetItem`).

La pagina [API Deprecation Status](https://developer.ebay.com/develop/get-started/api-deprecation-status) rifiuta la lettura automatica (403) ed è stata letta nel browser integrato; `TaxIdentifierTypeEnum` è stato letto dalla specifica del nuovo portale.

| Livello | Significato |
| --- | --- |
| specifica verificata | campo, parametro o scope letto nella specifica ufficiale scaricata il 7 novembre |
| documentato | guida, reference o release notes correnti |
| osservato | prova di FiscalBay con data, in [confronto fiscale](../../reference/EBAY_TAX_COMPARISON.md) o in questa ricognizione |
| dichiarato dal supporto | risposta del supporto sviluppatori eBay del 27 ottobre ([#477](https://github.com/max23468/FiscalBay/pull/477)), non contratto pubblicato |
| non individuato | assente nelle fonti consultate; non prova che la capacità manchi |

Non sono state eseguite chiamate a Fulfillment o Trading, scritture, sottoscrizioni o letture con token dei venditori. Nessun dato di negozi o acquirenti entra nel dossier o nelle bozze.

## 1. Header del marketplace e identificativo fiscale

**Tipo:** bug documentale. **Canale:** seguito del ticket al supporto sviluppatori del 27 ottobre, poi feedback sulla pagina di reference. **Prerequisiti:** nessuno.

**Problema.** La specifica Fulfillment `v1.20.7` non cita mai `X-EBAY-C-MARKETPLACE-ID`: né tra i parametri di `getOrder`, né nelle descrizioni di `Buyer.taxIdentifier` e `TaxIdentifier` (specifica verificata). Le descrizioni dicono soltanto che il contenitore torna con `getOrder` per gli ordini dei marketplace italiano e spagnolo.

Nella qualifica del 10 ottobre, sugli stessi 18 ordini `EBAY_IT`, `getOrder` senza header non ha restituito alcun identificativo; con l'header del marketplace dell'inserzione ne ha restituiti 10, coincidenti con Trading dove confrontabili (osservato, [qualifica](../../reference/EBAY_TAX_COMPARISON.md#qualifica-production-del-2026-10-10)). Il 27 ottobre il supporto ha confermato che l'header è obbligatorio per ricevere l'identificativo (dichiarato dal supporto). Chi segue la documentazione riceve un'assenza indistinguibile da un acquirente senza CF.

**Richiesta.** Documentare l'header nei parametri di `getOrder` e nelle descrizioni di `taxIdentifier`, con il valore atteso (il marketplace dell'inserzione), il comportamento per ordini con righe di marketplace diversi e la differenza tra «identificativo assente» e «header mancante». Meglio ancora, un avviso nella risposta quando l'header manca e l'ordine potrebbe portare un identificativo.

**Accettazione.** Seguendo soltanto la reference, un'integrazione nuova riceve il CF italiano al primo tentativo.

## 2. Dati fiscali dell'acquirente nelle letture di elenco e nelle API moderne

**Tipo:** capacità. **Canale:** ticket al supporto sviluppatori; in alternativa referente del Partner Program ([RE-02](../../ROADMAP.md#re-02)). **Prerequisiti:** azione interna 1, per un eventuale invio.

### 2.1 Una chiamata in più per ogni ordine

`taxIdentifier` torna soltanto da `getOrder`, non da `getOrders`, nemmeno con il parametro `orderIds`, che accetta fino a 50 ordini (specifica verificata). FiscalBay legge elenchi da 200 ordini per tratto ([#647](https://github.com/max23468/FiscalBay/pull/647)), poi una `getOrder` per ogni ordine di cui serve il CF ([§9](../../product/ORDERS_AND_SYNC.md#s09)). La quota Fulfillment è di 100.000 chiamate al giorno per applicazione, sul keyset condiviso (osservato, [quote](../../reference/EBAY_TAX_COMPARISON.md#quote-e-contratto-esterno)).

**Richiesta.** `taxIdentifier` anche in `getOrders`, almeno con `orderIds` o con un `fieldGroups` dedicato, alle stesse condizioni di autorizzazione di `getOrder`.

### 2.2 Completezza del contenitore

- `Buyer.taxIdentifier` è un oggetto singolo, non un elenco (specifica verificata), mentre `TaxIdentifierTypeEnum` comprende `CODICE_FISCALE`, `CURP`, `DNI`, `NIE`, `NIF`, `NIT`, `RFC`, `RUT` e `VATIN`, la partita IVA usata nell'Unione europea (specifica verificata): un acquirente italiano con CF e partita IVA non può avere entrambi nella stessa risposta.
- `issuingCountry` è descritto, ma nella qualifica il Paese non era completo (osservato); in Trading `BuyerTaxIdentifier` non lo riporta mai (osservato il 27 ottobre).
- L'assenza del contenitore non distingue «acquirente senza identificativo», «marketplace non coperto» e «dato non più disponibile».

**Richiesta.** Un elenco di identificativi con tipo e Paese emittente sempre valorizzati per i marketplace coperti, e un'indicazione esplicita quando il dato non è disponibile.

### 2.3 Parità delle API moderne

La mappatura ufficiale indica la Order API GraphQL (`orders`, `ordersByIds`, prima versione nelle release notes del 26 ottobre 2026) come sostituta di `GetOrders` e `GetSellerTransactions`, e la pagina delle dismissioni lo ripete per lo spegnimento di `GetOrders` del 30 giugno 2027 (documentato). Nello schema del 7 novembre:

- `Order` ha `buyer`, `taxes`, `logistics` e totali; `OrderTaxes` contiene soltanto `eBayCollectAndRemitTax`, `taxAddress` e `taxBreakdown` (specifica verificata);
- non compaiono identificativi fiscali dell'acquirente né un indirizzo di fatturazione per ordine (non individuato);
- `PurchaseQuote`, la sostituta delle fatture combinate, ha `shippingAddress` ma nessun dato fiscale (specifica verificata).

Le fatture combinate dal venditore senza checkout eBay esistono soltanto in Trading: Fulfillment rifiuta come non valide quelle senza `ExtendedOrderID` (osservato, [prova del 27 ottobre](../../reference/EBAY_TAX_COMPARISON.md#seller-transactions)). Il supporto ha dichiarato che `GetOrders` restituisce CF e indirizzo di fatturazione di queste fatture e che ogni dismissione segue il preavviso standard.

Il 7 novembre, in Production, tutti i 907 ordini con CF lo avevano da Fulfillment e nessuno soltanto da Trading; le fatture combinate senza checkout eBay erano 1 su 1.100, senza CF in nessuna fonte, come le sei della prova del 27 ottobre (osservato, conteggi aggregati). Lo spegnimento di `GetOrders` toglie quindi queste fatture come ordini, non un CF che Fulfillment non dia già.

**Richiesta.** Indicare quale API restituisce dopo il 30 giugno 2027 le fatture combinate senza checkout eBay, con acquirente, articoli e importi, anche dopo il pagamento (punto 1 del ticket). Il CF nella Order API non va chiesto: Fulfillment lo fornisce già.

**Accettazione.** Le fatture combinate senza checkout eBay restano leggibili da un'API non deprecata.

## 3. Identità immutabile dell'acquirente negli ordini

**Tipo:** capacità e contratto da chiarire. **Canale:** ticket al supporto sviluppatori. **Prerequisiti:** nessuno; l'azione interna 3 è conclusa.

La notifica `MARKETPLACE_ACCOUNT_DELETION` porta `userId` immutabile, `eiasToken` e `username`; la guida avverte che alcuni sviluppatori non ricevono lo username degli utenti statunitensi (documentato). Fulfillment `Buyer` ha soltanto `username`, `taxAddress`, `taxIdentifier` e `buyerRegistrationAddress` (specifica verificata), e Identity `getUser` descrive lo username come modificabile dall'utente (specifica verificata). Il token eIAS dell'acquirente si legge soltanto in Trading `GetOrders` (codice: `buyerEiasToken` nell'adapter Trading).

Per gli ordini senza token, l'89% di quelli in Production il 7 novembre, FiscalBay abbina quindi una cancellazione allo username registrato nell'ordine, che può non essere più quello attuale; la rilettura settimanale ([D319](../../decisions/DECISION_REGISTER.md)) accorcia questo intervallo senza chiuderlo. La guida richiede di cancellare i dati dell'utente pena la revoca dell'accesso, ma non dice come riconoscerlo negli ordini letti da Fulfillment (non individuato). Lo schema GraphQL espone `User.userId` sotto `commerce.identity.readonly`, ma non chiarisce se è restituito per l'acquirente di un ordine del venditore (non individuato).

**Richiesta.** Un identificativo immutabile dell'acquirente (`userId` o `eiasToken`) in Fulfillment `getOrder` e `getOrders` e nella Order API, con gli scope di lettura degli ordini; in subordine, l'indicazione ufficiale della chiave con cui abbinare la notifica agli ordini letti da Fulfillment.

Con lo spegnimento di `GetOrders` il 30 giugno 2027 il token eIAS non arriverà più da nessuna fonte: tutti gli ordini si abbineranno soltanto per username (documentato, stato delle dismissioni).

**Accettazione.** Ogni ordine conservato si abbina a una cancellazione senza dipendere dallo username o da Trading.

## 4. Notifiche degli ordini

**Tipo:** contratto da chiarire e capacità. **Canale:** ticket al supporto sviluppatori. **Prerequisiti:** nessuno.

### 4.1 Versione 1.1 di `ORDER_CONFIRMATION`

`getTopic` dichiara gli schemi `1.0` e `1.1` (osservato il 7 novembre); FiscalBay sottoscrive la `1.0`. Le release notes riportano l'aggiunta del topic il 1° dicembre 2025, senza la versione 1.1 (documentato), e la differenza tra le due versioni non risulta pubblicata (non individuato). La descrizione del topic rimanda a `GetOrders` di Trading per leggere l'ordine e dice che si riceve una notifica per ogni riga.

**Richiesta.** Pubblicare lo schema di entrambe le versioni, la differenza, l'eventuale deprecazione della `1.0`, e aggiornare la descrizione verso `getOrder`.

### 4.2 Variazioni dell'ordine in sola lettura

Dei 28 topic esistenti, quelli sugli ordini del venditore sono `ORDER_CONFIRMATION`, `ITEM_MARKED_SHIPPED` (`commerce.shipping`) e i topic consolidati di annullamenti, contestazioni e resi, ciascuno con i propri scope `sell.cancellation`, `sell.inquiry` e `sell.return` (osservato il 7 novembre). Con `sell.fulfillment.readonly` non esiste un evento per pagamento successivo, rimborso, annullamento o identificativo fiscale arrivato dopo la conferma. FiscalBay le scopre con la lettura periodica e la passata Trading ogni due ore ([D177](../../decisions/DECISION_REGISTER.md)).

**Richiesta.** Un topic `ORDER_UPDATED`, o un'estensione di `ORDER_CONFIRMATION`, con ID ordine, tipo di variazione e `modifiedDate`, sottoscrivibile con gli scope di sola lettura di Fulfillment.

### 4.3 Una sottoscrizione per venditore e applicazione

eBay ammette una sola sottoscrizione per venditore e topic per applicazione (osservato, [D235](../../decisions/DECISION_REGISTER.md)): l'ambiente di test e Production, che condividono il keyset, non possono ricevere entrambi gli eventi dello stesso venditore. La documentazione indica la cardinalità 1:1 tra applicazione e topic, senza parlare di più destinazioni (specifica verificata).

**Richiesta.** Più destinazioni per la stessa sottoscrizione, oppure una sottoscrizione per destinazione.

**Accettazione.** Schema 1.1 documentato; una variazione di un ordine pagato produce un evento con i soli scope di lettura.

## 5. Quote per utente

**Tipo:** capacità. **Canale:** ticket al supporto sviluppatori. **Prerequisiti:** nessuno.

`getUserRateLimits` accetta soltanto token con uno tra `sell.inventory`, `sell.inventory.readonly`, `sell.marketplace.insights.readonly`, `commerce.catalog.readonly`, `sell.marketing` e `sell.marketing.readonly` (specifica verificata). FiscalBay chiede ai venditori soltanto identità, lettura degli ordini e notifiche ([collegamento](../../product/ACCOUNTS_AND_STORES.md#s08)): la chiamata rifiuta il token del venditore (osservato il 27 ottobre) e il consumo per venditore resta invisibile. La API è ancora `v1_beta` (specifica verificata) e `GetApiAccessRules` di Trading risponde 410 (osservato). La console legge le quote dell'applicazione con `getRateLimits` ([D188](../../decisions/DECISION_REGISTER.md)).

**Richiesta.** `getUserRateLimits` con qualunque token utente, o almeno con `sell.fulfillment.readonly`, e una versione stabile della Developer Analytics API.

**Accettazione.** Un'applicazione di sola lettura degli ordini vede il consumo per venditore senza chiedere scope che non usa.

## Domande secondarie

Non inviate. In un eventuale invio vanno poste come domande, senza presentarle come lacune dimostrate.

**Q1. Ordini di prova con dati fiscali in Sandbox.** In Sandbox i pagamenti non riescono, l'acquisto confermato resta non pagato e non compare in Fulfillment (osservato, [questioni aperte](../../ROADMAP.md#questioni-aperte)). Domanda: come si crea in Sandbox un ordine pagato di un acquirente italiano con `taxIdentifier`?

**Q2. Partita IVA degli acquirenti italiani.** `TaxIdentifierTypeEnum` comprende `VATIN` (specifica verificata) e FiscalBay lo tratta già come partita IVA italiana soltanto con Paese emittente `IT`, che spesso manca (2.2). Domanda: sul marketplace `EBAY_IT` la partita IVA di un acquirente con account aziendale arriva come `VATIN`, e in quali condizioni al posto del CF?

**Q3. Sostitute moderne di `GetItem`, `GetStore` e `GetUser`.** Il 7 novembre la pagina delle dismissioni non le elenca (documentato). La mappatura indica `sellerListings`, Stores API e la query `user` (documentato), ciascuna con scope nuovi. `LineItem` di Fulfillment non ha l'immagine dell'articolo (specifica verificata). Domanda: se sono previste dismissioni e se feedback, percentuale positiva e Top Rated restano leggibili senza scope aggiuntivi ([D186](../../decisions/DECISION_REGISTER.md), [D216](../../decisions/DECISION_REGISTER.md)).

**Q4. Dati dell'acquirente oltre i 90 giorni.** Fulfillment toglie indirizzo ed email dopo 90 giorni e i recapiti della spedizione dopo 14 (specifica verificata). Domanda: esiste un accesso ai dati di fatturazione già forniti per i documenti che il venditore emette più tardi?

**Q5. Soglie del Bulk Data Transfer.** FiscalBay riceve `BULK_DATA_TRANSFER_THRESHOLD`, mentre la lettura delle soglie restituisce un elenco vuoto ([D215](../../decisions/DECISION_REGISTER.md)). Domanda: quali categorie e soglie si applicano a un'applicazione di sola lettura degli ordini?

## Azioni interne prima degli invii

1. **Rileggere la specifica al momento dell'invio.** Ripetere i controlli di questo dossier su Fulfillment e sullo schema GraphQL; se eBay ha già corretto un punto, toglierlo dalla bozza. Serve prima di inviare le bozze 1 e 2.
2. **Tipi fiscali (conclusa il 7 novembre).** Elenco in 2.2 e Q2.
3. **Copertura delle cancellazioni (conclusa il 7 novembre).** Misura in sintesi; la rilettura settimanale dello username è in [D319](../../decisions/DECISION_REGISTER.md).
4. **Stato delle dismissioni (conclusa il 7 novembre).** `GetOrders` deprecato dal 6 novembre e spento il 30 giugno 2027; `GetItem`, `GetStore`, `GetUser`, `GetSellerTransactions` e la Developer Analytics API non compaiono.
5. **`ORDER_CONFIRMATION` 1.1.** Sottoscrivere la 1.1 soltanto dopo la pubblicazione del suo schema (punto 4.1); fino ad allora l'ingresso resta sulla 1.0.

## Appendice: costruibile oggi, da non chiedere a eBay

| Bisogno | Perché resta interno |
| --- | --- |
| Elenco degli ordini per data nelle API moderne | `User.orders` della Order API accetta `dateRange`, filtri di stato e paginazione (specifica verificata), con lo scope `sell.order.read`: è una scelta di scope e consenso ([D216](../../decisions/DECISION_REGISTER.md)), non una lacuna |
| Più quota | percorso dell'Application Growth Check ([RE-01](../../ROADMAP.md#re-01)) |
| Annullamenti, contestazioni e resi in tempo reale | topic consolidati esistenti, con i propri scope; esclusi da [D216](../../decisions/DECISION_REGISTER.md) perché coperti dalla lettura periodica |
| Spedizione segnata | `ITEM_MARKED_SHIPPED` esiste con `commerce.shipping` |
| Immagine dell'articolo | sostitute di `GetItem` già mappate (Q3 chiede solo le date) |
| Profilo del negozio | Stores API e query `user` esistono; serve un nuovo consenso ([D216](../../decisions/DECISION_REGISTER.md)) |
| Stato dell'account del venditore | `USER_STATUS_CHANGE` esiste per i partner ([RE-02](../../ROADMAP.md#re-02)) |
| Username aggiornato degli ordini senza token | rilettura settimanale da Fulfillment ([D319](../../decisions/DECISION_REGISTER.md)) |

## Fonti

Progetto:

- [confronto delle fonti fiscali](../../reference/EBAY_TAX_COMPARISON.md) e [fonti S06, S23, S32](../../reference/SOURCES.md#s06);
- [ordini e sincronizzazione](../../product/ORDERS_AND_SYNC.md#s09), [cancellazione richiesta da eBay](../../engineering/DATA_RETENTION.md#cancellazione-ebay), [webhook](../../operations/WEBHOOKS.md);
- registro: [D135, D177, D186, D188, D215, D216, D235](../../decisions/DECISION_REGISTER.md);
- PR [#317](https://github.com/max23468/FiscalBay/pull/317), [#477](https://github.com/max23468/FiscalBay/pull/477), [#647](https://github.com/max23468/FiscalBay/pull/647).

eBay:

- [Fulfillment `getOrder`](https://developer.ebay.com/api-docs/sell/fulfillment/resources/order/methods/getOrder), [specifica OpenAPI](https://developer.ebay.com/api-docs/master/sell/fulfillment/openapi/3/sell_fulfillment_v1_oas3.json), [release notes](https://developer.ebay.com/api-docs/sell/fulfillment/release-notes.html);
- [schema GraphQL](https://developer.ebay.com/develop/api/spec/listing.graphqls), [Modern APIs Migration Guide](https://developer.ebay.com/develop/guides/sell/modern-apis-migration-guide);
- [Notification API](https://developer.ebay.com/api-docs/commerce/notification/overview.html) e [release notes](https://developer.ebay.com/api-docs/commerce/notification/release-notes.html);
- [Marketplace user account deletion](https://developer.ebay.com/develop/guides-v2/marketplace-user-account-deletion);
- [Developer Analytics API](https://developer.ebay.com/api-docs/master/developer/analytics/openapi/3/developer_analytics_v1_beta_oas3.json), [Identity API](https://developer.ebay.com/api-docs/commerce/identity/resources/user/methods/getUser).
