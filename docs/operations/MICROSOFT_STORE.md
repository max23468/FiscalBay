# Microsoft Store

FiscalBay è nel Microsoft Store come la stessa web app impacchettata con PWABuilder, senza codice nativo né offline ([D342](../decisions/DECISION_REGISTER.md), [§16](../product/EXPERIENCE.md#s16)). Fa parte delle [operazioni](OPERATIONS.md). Le regole citate sono le [Microsoft Store Policies](https://learn.microsoft.com/en-us/windows/apps/publish/store-policies) 7.20, in vigore dal 22 ottobre 2026, rilette il 2026-11-19.

<a id="account"></a>
## Account e identità del prodotto

1. **Account sviluppatore.** Si apre gratis da storedeveloper.microsoft.com con un account Microsoft personale, con la verifica d'identità con documento e selfie. Il tipo non si converte dopo: da individuale ad aziendale serve un account nuovo. L'aziendale richiede una persona giuridica registrata, verificata con il DUNS o con documenti societari, e un'email con il dominio dell'azienda.
2. **Tipo di account.** La policy 10.14 vuole l'account aziendale per chi agisce nell'ambito della propria attività commerciale o professionale e quando un consumatore leggerebbe l'editore come un'azienda; la 10.8.3 lo vuole se la funzione principale richiede dati finanziari, tra cui le informazioni sul codice fiscale. FiscalBay è un servizio a pagamento e mostra il Codice Fiscale degli acquirenti: con un account individuale la certificazione può respingerlo. Il 2026-11-19 l'owner ha scelto di inviare con l'account individuale già aperto; un rifiuto per questi motivi riapre la scelta ([questione aperta](../ROADMAP.md#questioni-aperte)).
3. **Nome.** In Partner Center, App e giochi › Nuovo prodotto › App MSIX o PWA, si prenota «FiscalBay». Un nome prenotato decade se il prodotto non viene inviato entro tre mesi. Il nome del pacchetto deve essere uno dei nomi prenotati e coincidere con `name` del manifest (`app/web-manifest.server.ts`).
4. **Identità.** Gestione prodotto › Identità del prodotto dà Package ID, Publisher ID e Publisher display name, che PWABuilder chiede per firmare il pacchetto. Si conservano nell'inventario privato (`~/.config/fiscalbay/merchant-test.json`, voce `microsoftStore`) e non nel repository. Lo Store ID è pubblico, perché compare nell'indirizzo della scheda: lo usano il badge e la voce `Installa l'app` su Windows (`app/installed-app.ts`).

<a id="pacchetto"></a>
## Pacchetto

1. Su pwabuilder.com si inserisce `https://fiscalbay.it/`, poi Package For Stores › Windows. Il manifest arriva dal sito; servono `display: standalone`, le icone da 512 px e il service worker, già presenti.
2. Nelle opzioni si incollano Package ID, Publisher ID e Publisher display name, si lascia «FiscalBay» come nome e si sceglie la versione: `1.0.0` al primo invio, poi una versione maggiore a ogni pacchetto nuovo.
3. Lo ZIP scaricato contiene `.msixbundle` e `.classic.appxbundle`: si caricano entrambi nell'invio. Lo ZIP resta fuori dal repository.

Un pacchetto nuovo, con un nuovo invio, serve soltanto quando cambia il manifest: nome, icone, scorciatoie, `display`, ambito, gestori di file, protocolli o condivisione. Pagine, script, stili e service worker arrivano con i deploy ordinari, perché l'app installata carica il sito.

<a id="invio"></a>
## Invio

| Sezione di Partner Center | Valore |
|---|---|
| Prezzi e disponibilità | App gratuita, senza componenti aggiuntivi dello Store, in tutti i mercati (scelta dell'owner del 2026-11-19): chi vende su eBay.it può trovarsi all'estero e la scheda è anche in inglese |
| Proprietà | Categoria «Lavoro», sottocategoria «Contabilità e finanza». Il prodotto usa informazioni personali: privacy `https://fiscalbay.it/privacy`; sito `https://fiscalbay.it/`, supporto `https://fiscalbay.it/supporto` |
| Dichiarazioni del prodotto | Spuntare «Questo prodotto consente agli utenti di effettuare acquisti, ma non usa il sistema di e-commerce di Microsoft Store» (policy 10.8.2 e 10.8.6: gli abbonamenti Pro passano da Stripe). Lasciare spuntati i due predefiniti su unità alternative e backup; togliere registrazione e trasmissione, riservate ai giochi. Accessibilità, penna e intelligenza artificiale generativa restano vuote |
| Classificazione | [Questionario IARC](#iarc) |
| Pacchetti | `.msixbundle` e `.classic.appxbundle` dello stesso ZIP |
| Schede dello Store | Italiano (Italia) e inglese (Stati Uniti), con i [testi](#scheda) e le [immagini](#immagini). Prima del pacchetto si aggiungono come lingue aggiuntive; il pacchetto porta poi le sue |
| Opzioni dell'invio | Pubblicazione soltanto con «Pubblica ora», così l'app esce quando il sito è pronto per il badge. [Note per la certificazione](#certificazione) |

La bozza dell'invio 1 è compilata dal 2026-11-20 in tutto tranne il pacchetto, la conferma della classificazione e le credenziali dell'account dimostrativo.

La certificazione dura in genere uno o due giorni lavorativi. Dopo l'approvazione si rilegge la scheda nello Store e si prova l'installazione su Windows con accesso, collegamento dei provider e badge dell'icona ([2.0-15](../ROADMAP.md#2-0-15)).

<a id="immagini"></a>
## Immagini

`node scripts/site-screenshots.mjs --store`, sulla preview locale della build come le schermate del sito, scrive in `build/microsoft-store/` cinque schermate PNG per lingua (Ordini, scheda di un ordine, Negozi eBay, notifiche Telegram, esportazione) dai soli dati dell'anteprima, a 2732×1536 px: la misura minima dello Store è 1366×768, il massimo 3840×2160. Lo stesso comando aggiorna in `docs/brand/logo/exports/`, dagli asset approvati sul blu del marchio, l'icona quadrata della scheda (`fiscalbay-app-icon-300.png`), la locandina 9:16 con il logo (`fiscalbay-store-poster-1440x2160.png`), che su Windows fa da logo principale della scheda, e l'immagine della confezione 1:1 con il simbolo (`fiscalbay-store-box-2160.png`). L'immagine 16:9 del primo piano e i trailer sono facoltativi e non ci sono.

Didascalie, fino a 200 caratteri:

| Schermata | Italiano | English |
|---|---|---|
| 1 | Il Codice Fiscale di ogni ordine, pronto da copiare | The tax code of every order, ready to copy |
| 2 | Tutti i dati dell'acquirente in un'unica scheda | All the buyer's details on one card |
| 3 | Tutti i tuoi negozi eBay in un posto solo | All your eBay stores in one place |
| 4 | Nuovi ordini su Telegram, negozio per negozio | New orders on Telegram, store by store |
| 5 | Esporti gli ordini per il gestionale in CSV o XLSX | Export your orders to CSV or XLSX for your software |

<a id="scheda"></a>
## Testi della scheda

Testo semplice, senza HTML né indirizzi nella descrizione. Il tono è commerciale per scelta dell'owner del 2026-11-20: la scheda deve far venire voglia di provare l'app e farsi trovare nelle ricerche, con frasi naturali, senza avvertenze sulla sicurezza né elenchi di ciò che l'app non fa; restano soltanto i limiti che rendono vere le affermazioni («quando l'acquirente l'ha indicato»). Prezzi e prova seguono il listino ([§4](../product/PLANS_AND_BILLING.md#s04), `app/catalog.ts`), come chiede la policy 10.8.4: se il listino cambia, cambia anche la scheda. La sezione Novità resta vuota al primo invio.

### Italiano

Limiti dello Store: descrizione fino a 10.000 caratteri, breve sotto i 270 perché tutte le viste la mostrino intera, fino a 20 caratteristiche da 200.

**Descrizione breve** (229 caratteri)

```text
Il Codice Fiscale e la Partita IVA che i tuoi acquirenti lasciano su eBay, pronti da copiare o esportare per la fattura. FiscalBay legge gli ordini da solo, anche da più negozi. Parti gratis e prova Pro per 14 giorni senza carta.
```

**Descrizione**

```text
Vendi su eBay e devi fare fattura? Con FiscalBay il Codice Fiscale dei tuoi acquirenti è già lì, dentro l'ordine, pronto da copiare. Un clic e passi alla fattura.

Colleghi il tuo negozio eBay e FiscalBay importa subito gli ordini recenti. Poi continua da solo: legge i nuovi ordini anche quando l'app è chiusa. Per ogni ordine trovi acquirente, indirizzo di fatturazione e Codice Fiscale, quando l'acquirente l'ha indicato, già senza spazi e in maiuscolo. Se c'è una Partita IVA, la vedi subito.

Cosa puoi fare
- Vedere gli ordini di tutti i tuoi negozi eBay in un unico elenco e trovare quello che ti serve per numero d'ordine, acquirente, articolo, SKU o Codice Fiscale.
- Filtrare per negozio, periodo, pagamento, spedizione e Codice Fiscale presente o mancante.
- Esportare gli ordini in CSV, una riga per ordine o per articolo, e caricarli nel gestionale o nel programma di fatturazione.
- Chiedere il Codice Fiscale a chi non l'ha lasciato con un messaggio già pronto, in italiano o in inglese.

Con Pro hai anche
- Ogni nuovo ordine su Telegram con il Codice Fiscale da copiare, oppure un riepilogo al giorno.
- L'export in XLSX con le colonne che vuoi, nell'ordine che vuoi.
- Più negozi eBay e un anno di storico.
- I dati fiscali suggeriti dagli ordini precedenti dello stesso acquirente.

Accedi con passkey, Google, eBay oppure email e password. L'app è in italiano e in inglese, con tema chiaro e scuro, e la sua icona ti mostra quante notifiche hai da leggere.

Piani e prezzi
- Free, gratuito: un negozio eBay, gli ordini degli ultimi 30 giorni, 5 ordini con Codice Fiscale o Partita IVA da sbloccare ogni 7 giorni (di più durante le promozioni) ed export in CSV.
- Pro: 4,90 € al mese, 49 € all'anno (12 mesi al prezzo di 10) oppure 149 € una volta sola per averlo a vita, finché ci sono posti. Prezzi IVA esclusa: con l'IVA italiana al 22% diventano 5,98 €, 59,78 € e 181,78 €; prima di pagare vedi il totale per il tuo paese.
- Prova Pro gratis per 14 giorni, senza carta e senza rinnovo automatico: la attivi quando vuoi, appena FiscalBay ha letto il tuo negozio.

Pro si acquista dall'app, con pagamento tramite Stripe, e l'abbonamento si disdice quando vuoi da Impostazioni.

FiscalBay è un servizio indipendente da eBay.
```

**Caratteristiche**

```text
Il Codice Fiscale degli acquirenti eBay, pronto da copiare
La Partita IVA in evidenza quando l'acquirente la indica
Nuovi ordini letti in automatico, anche ad app chiusa
Tutti i tuoi negozi eBay in un unico elenco
Ricerca per ordine, acquirente, articolo, SKU o Codice Fiscale
Filtri per negozio, periodo, pagamento e spedizione
Export CSV per il gestionale e la fatturazione
Messaggio già pronto per chiedere il Codice Fiscale mancante
Pro: ogni nuovo ordine su Telegram con il Codice Fiscale
Pro: export XLSX con le colonne che vuoi
Pro: più negozi eBay e un anno di storico
Pro: dati fiscali suggeriti dagli ordini precedenti
Accesso con passkey, Google, eBay o email
Icona con il numero di notifiche da leggere
In italiano e in inglese, con tema chiaro e scuro
Gratis per iniziare, Pro in prova per 14 giorni senza carta
```

**Termini di ricerca**: al massimo 7 voci da 40 caratteri e 21 parole in tutto, senza prezzi (policy 10.1.3). Come per le [guide](../product/EXPERIENCE.md#s23) sono le frasi che i venditori cercano: `codice fiscale ebay`, `codice fiscale acquirente`, `partita iva ebay`, `fattura elettronica ebay`, `ordini ebay excel`, `alternativa probay`, `venditori ebay`. La policy esclude anche i nomi di prodotti di altri editori: eBay e ProBay ci sono per scelta dell'owner del 2026-11-20, e si tolgono se la certificazione li contesta.

### English

**Short description** (227 caratteri)

```text
The tax code (Codice Fiscale) and VAT number your eBay buyers leave, ready to copy or export for your invoices. FiscalBay reads your orders on its own, across all your stores. Start free and try Pro for 14 days, no card needed.
```

**Description**

```text
Selling on eBay in Italy and need to invoice? With FiscalBay your buyers' tax code (Codice Fiscale) is already there, inside the order, ready to copy. One click and you are on to the invoice.

Connect your eBay store and FiscalBay imports your recent orders right away. Then it keeps going on its own, reading new orders even when the app is closed. For every order you get the buyer, the billing address and the tax code, whenever the buyer provided it, already without spaces and in capitals. If there is a VAT number (Partita IVA), you see it straight away.

What you can do
- See the orders of all your eBay stores in one list and find what you need by order number, buyer, item, SKU or tax code.
- Filter by store, period, payment, shipping and tax code present or missing.
- Export your orders to CSV, one row per order or per item, and load them into your management or invoicing software.
- Ask buyers who left no tax code with a ready-made message, in Italian or English.

With Pro you also get
- Every new order on Telegram with the tax code to copy, or one summary a day.
- XLSX export with the columns you want, in the order you want.
- More eBay stores and one year of history.
- Tax details suggested from the same buyer's previous orders.

Sign in with a passkey, Google, eBay or email and password. The app is in Italian and English, with light and dark theme, and its icon shows how many notifications you have to read.

Plans and pricing
- Free, at no cost: one eBay store, orders from the last 30 days, 5 orders with tax code or VAT number to unlock every 7 days (more during promotions) and CSV export.
- Pro: €4.90 a month, €49 a year (12 months for the price of 10) or €149 once for lifetime access, while places last. Prices exclude VAT: with Italian VAT at 22% they are €5.98, €59.78 and €181.78; before paying you see the total for your country.
- Free 14-day Pro trial, no card and no automatic renewal: start it whenever you like once FiscalBay has read your store.

Pro is bought in the app, paid through Stripe, and you can cancel any time from Settings.

FiscalBay is an independent service, not affiliated with eBay.
```

**Product features**

```text
Your eBay buyers' tax code (Codice Fiscale), ready to copy
VAT number (Partita IVA) shown when the buyer gives one
New orders read automatically, even with the app closed
All your eBay stores in one list
Search by order, buyer, item, SKU or tax code
Filters by store, period, payment and shipping
CSV export for your management and invoicing software
Ready-made message to ask for a missing tax code
Pro: every new order on Telegram with its tax code
Pro: XLSX export with the columns you want
Pro: more eBay stores and one year of history
Pro: tax details suggested from previous orders
Sign in with a passkey, Google, eBay or email
App icon with your unread notification count
In Italian and English, light and dark theme
Free to start, 14-day Pro trial with no card
```

**Search terms**, con la stessa scelta: `ebay tax code`, `codice fiscale ebay`, `ebay vat number`, `ebay invoice italy`, `ebay orders excel`, `probay alternative`, `ebay sellers italy`.

<a id="iarc"></a>
## Classificazione IARC

Il questionario (IARC 10.4) chiede prima il tipo di app, poi domande che dipendono dalle risposte; nome dell'editore ed email vanno a IARC. Risposte date nella bozza del 2026-11-20:

| Domanda | Risposta |
|---|---|
| Tipo di app | Tutti gli altri tipi di app |
| Contenuti rilevanti (sesso, violenza, linguaggio) nel pacchetto | No |
| Gli utenti interagiscono o si scambiano contenuti tra loro | No: ogni account vede soltanto i propri ordini; i messaggi Telegram arrivano al solo titolare |
| Contenuti online non inclusi nel download | Sì: ordini e articoli letti da eBay |
| Materiale violento, sessuale, linguaggio offensivo, sostanze, anche fra quelli online | No |
| Promozione o vendita di prodotti riservati agli adulti | No |
| Condivisione della posizione precisa con altri utenti | No |
| Acquisto di beni digitali | Sì: abbonamenti e accesso a vita Pro, pagati con Stripe |
| Articoli casuali (loot box) | No |
| Premi in denaro, buoni, criptovalute o asset trasferibili | No |
| Browser o motore di ricerca; prodotto di notizie o educativo | No |
| Classificazioni di un altro ente o supporti fisici | No |

L'anteprima dà 3+ per IARC, PEGI e Microsoft, «Per tutti» per ESRB e USK, 14 in Brasile, con «Acquisti in-app». Il salvataggio richiede di accettare le Condizioni d'uso di IARC e di dichiararsi maggiorenni: lo fa l'owner. La classificazione resta valida per i pacchetti successivi finché il contenuto non cambia.

<a id="certificazione"></a>
## Note per la certificazione

La policy 10.3.1 chiede un account dimostrativo funzionante nelle note, e il server deve essere raggiungibile durante la verifica (10.3.2). L'account lo sceglie l'owner fra:

1. **Account dimostrativo senza negozio**, in Production, con email confermata e password: mostra accesso, Impostazioni, Piano e pagamenti e lo stato vuoto degli Ordini, non gli ordini. Nessun dato reale, ma la funzione principale non si vede.
2. **Account dimostrativo con un negozio eBay di prova** dell'owner, collegato in Production, con pochi ordini fatti apposta: la funzione principale si vede con dati che l'owner controlla. Richiede un negozio e ordini creati per la verifica.
3. **Account dell'owner**: escluso, perché mostrerebbe ordini e dati fiscali di acquirenti reali.

Il 2026-11-19 l'owner ha scelto l'account senza negozio. Lo registra Codex su sua richiesta, in Production, con una casella che controlla, diversa da quelle dell'account admin e delle verifiche live, e una password nuova, e conferma l'email; non collega negozi. La password sta nel Portachiavi macOS come «FiscalBay Microsoft Store demo», l'email nell'inventario privato (voce `microsoftStore.demoAccount`); all'invio vanno soltanto nel campo di Partner Center, mai nel repository. Se la certificazione chiede di vedere gli ordini, si passa all'account con il negozio di prova.

Le note hanno una descrizione e una sezione Credenziali separata, dove l'owner inserisce email e password; la descrizione non contiene credenziali. Descrizione salvata nella bozza:

```text
FiscalBay is a web app for Italian eBay sellers (fiscalbay.it): it reads the seller's eBay orders through eBay's official APIs, read only, and shows the buyer's tax code (Codice Fiscale) when eBay provides it. The package opens the same site published by its owner.

Demo account: the email and password are in the Credentials section of these notes. Select «Accedi» (Sign in) on the home page or open https://fiscalbay.it/en/sign-in and sign in with email and password. The account has no eBay store connected, so the Orders page shows its empty state: connecting a store requires a real eBay seller account and eBay's own consent page. Settings, Plan and payments, notifications and the account pages are fully available; https://fiscalbay.it/en/features shows the orders view with sample data.

Purchases: the app is free. The optional Pro plan (monthly, annual or lifetime) is sold in the app through Stripe, a secure third-party payment provider, as declared in Product declarations; Stripe identifies itself on its checkout page and confirms each transaction. Pricing and the 14-day trial without card are stated in the description.

Privacy policy: https://fiscalbay.it/en/privacy. Support: https://fiscalbay.it/en/support, supporto@fiscalbay.it.
```

<a id="badge"></a>
## Badge e installazione da Windows

Su Windows il sito propone lo Store invece dell'installazione del browser: il badge ufficiale «Scarica da Microsoft Store» sta nella riga dei pulsanti della home, che hanno la sua altezza, e nel footer, fra testo e collegamenti o sotto l'email su smartphone, nel tema della pagina, mentre la voce `Installa l'app` del menu dell'avatar apre la scheda. Il badge compare dopo l'idratazione e non dentro l'app installata. Le immagini sono quelle di Microsoft salvate in `public/store/`, senza lo script di get.microsoft.com e senza cambiare la CSP. Badge e voce puntano a `https://apps.microsoft.com/detail/<Store ID>`, che risponde 410 finché l'app non è pubblicata: si pubblicano dopo l'approvazione.
