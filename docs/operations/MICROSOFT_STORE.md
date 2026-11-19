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

`node scripts/site-screenshots.mjs --store`, sulla preview locale della build come le schermate del sito, scrive in `build/microsoft-store/` cinque schermate PNG per lingua (Ordini, scheda di un ordine, Negozi eBay, notifiche Telegram, esportazione) dai soli dati dell'anteprima, a 2732×1536 px: la misura minima dello Store è 1366×768, il massimo 3840×2160. Lo stesso comando aggiorna l'icona quadrata della scheda, `docs/brand/logo/exports/fiscalbay-app-icon-300.png`, dall'icona per app approvata. Locandina 9:16 e immagine della confezione 1:1 sono facoltative per le app, obbligatorie soltanto su Xbox; l'immagine 16:9 del primo piano è facoltativa e non c'è.

Didascalie, fino a 200 caratteri:

| Schermata | Italiano | English |
|---|---|---|
| 1 | Gli ordini dei tuoi negozi eBay, con il Codice Fiscale pronto da copiare | Orders from your eBay stores, with the tax code ready to copy |
| 2 | Ogni ordine con acquirente, indirizzo di fatturazione e articoli | Every order with buyer, billing address and items |
| 3 | I negozi collegati, con l'ultima lettura e gli ordini importati | Your connected stores, with the latest read and the imported orders |
| 4 | Notifiche Telegram dei nuovi ordini, per negozio | Telegram notifications for new orders, by store |
| 5 | Esportazione in CSV o XLSX per il gestionale | Export to CSV or XLSX for your management software |

<a id="scheda"></a>
## Testi della scheda

Testo semplice, senza HTML né indirizzi nella descrizione. Prezzi e prova seguono il listino ([§4](../product/PLANS_AND_BILLING.md#s04), `app/catalog.ts`), come chiede la policy 10.8.4: se il listino cambia, cambia anche la scheda. La sezione Novità resta vuota al primo invio.

### Italiano

Limiti dello Store: descrizione fino a 10.000 caratteri, breve sotto i 270 perché tutte le viste la mostrino intera, fino a 20 caratteristiche da 200.

**Descrizione breve** (245 caratteri)

```text
FiscalBay legge gli ordini dei tuoi negozi eBay e ti mostra il Codice Fiscale dell'acquirente, quando disponibile su eBay, pronto da copiare ed esportare. Anche la Partita IVA, se c'è. Piano Free gratuito, Pro con prova di 14 giorni senza carta.
```

**Descrizione**

```text
FiscalBay ti aiuta a trovare e gestire il Codice Fiscale dei tuoi ordini eBay.

Colleghi il tuo negozio eBay e FiscalBay importa gli ordini recenti, poi legge da solo i nuovi ordini e gli aggiornamenti, anche quando non sei collegato. Per ogni ordine vedi acquirente, indirizzo di fatturazione e Codice Fiscale, quando disponibile su eBay, pronto da copiare con un clic, senza spazi e in maiuscolo. Se l'acquirente ha indicato una Partita IVA, la trovi accanto al Codice Fiscale o al suo posto.

Con FiscalBay puoi:
- vedere gli ordini di tutti i tuoi negozi in un solo elenco, con la ricerca per ordine, acquirente, articolo, SKU o Codice Fiscale e i filtri per negozio, periodo, pagamento, spedizione e stato del Codice Fiscale;
- esportare gli ordini in CSV, una riga per ordine o per articolo, da importare nel gestionale o nel software di fatturazione;
- chiedere il Codice Fiscale all'acquirente con un modello di messaggio, quando manca;
- con Pro, ricevere su Telegram ogni nuovo ordine con il Codice Fiscale, oppure un riepilogo giornaliero, ed esportare in XLSX con le colonne che scegli.

FiscalBay non emette fatture e non modifica nulla sul tuo negozio: legge gli ordini con le API ufficiali di eBay, in sola lettura. Il Codice Fiscale compare soltanto quando l'acquirente l'ha indicato ed eBay lo rende disponibile. Accedi con passkey, Google, eBay oppure email e password; i dati degli ordini restano su server nell'Unione Europea.

Piani e prezzi
- Free, gratuito: un negozio eBay attivo, gli ordini degli ultimi 30 giorni, 5 ordini con il Codice Fiscale da sbloccare ogni 7 giorni (di più durante le promozioni), esportazione in CSV.
- Pro: più negozi, un anno di storico, ordini da sbloccare senza limite, esportazione in XLSX e notifiche Telegram. Costa 4,90 € al mese, 49 € all'anno oppure 149 € una sola volta per l'accesso a vita, finché ci sono posti. I prezzi sono IVA esclusa: con l'IVA italiana al 22% diventano 5,98 €, 59,78 € e 181,78 €; prima del pagamento vedi il totale con le imposte del tuo paese.
- Prova Pro di 14 giorni, senza carta e senza rinnovo automatico: la attivi quando vuoi dopo la prima lettura riuscita di un negozio e alla fine torni al Free.

Pro si acquista dall'app, con pagamenti gestiti da Stripe e non dal Microsoft Store. Gli abbonamenti si disdicono da Impostazioni, Piano e pagamenti.

FiscalBay è un servizio indipendente, non affiliato a eBay.
```

**Caratteristiche**

```text
Codice Fiscale dell'acquirente, quando disponibile su eBay, da copiare con un clic
Partita IVA dell'acquirente, se indicata nell'ordine
Lettura automatica dei nuovi ordini e degli aggiornamenti, anche ad app chiusa
Ordini di tutti i negozi in un solo elenco, con ricerca e filtri
Ricerca per ordine, acquirente, articolo, SKU o Codice Fiscale
Esportazione in CSV, una riga per ordine o per articolo
Con Pro, esportazione in XLSX con le colonne che scegli e configurazioni salvate
Con Pro, notifiche Telegram dei nuovi ordini o un riepilogo giornaliero
Con Pro, più negozi eBay e un anno di storico
Modello di messaggio per chiedere il Codice Fiscale quando manca
Suggerimenti dagli ordini precedenti dello stesso acquirente
Accesso a eBay in sola lettura con le API ufficiali
Accesso con passkey, Google, eBay oppure email e password
Dati degli ordini conservati nell'Unione Europea
Badge dell'icona con le notifiche da leggere
Interfaccia in italiano e in inglese, tema chiaro e scuro
```

**Termini di ricerca**: al massimo 7, senza prezzi e senza nomi di prodotti di altri editori (policy 10.1.3), quindi senza «eBay», che compare già in titolo e descrizione: `codice fiscale`, `partita IVA`, `fattura elettronica`, `export ordini`, `ordini online`, `venditori online`, `marketplace`.

### English

**Short description** (253 caratteri)

```text
FiscalBay reads the orders of your eBay stores and shows the buyer's tax code (Codice Fiscale), when eBay provides it, ready to copy and export. The VAT number (Partita IVA) too, when there is one. Free plan at no cost, Pro with a 14-day trial, no card.
```

**Description**

```text
FiscalBay helps you find and manage the tax code (Codice Fiscale) of your eBay orders.

Connect your eBay store and FiscalBay imports your recent orders, then reads new orders and updates on its own, even when you are not signed in. For every order you see the buyer, the billing address and the tax code, when eBay provides it, ready to copy in one click, without spaces and in capitals. If the buyer gave a VAT number (Partita IVA), you find it next to the tax code or in its place.

With FiscalBay you can:
- see the orders of all your stores in one list, with search by order, buyer, item, SKU or tax code and filters by store, period, payment, shipping and tax code status;
- export your orders to CSV, one row per order or per item, ready for your management or invoicing software;
- ask the buyer for the tax code with a message template, when it is missing;
- with Pro, get every new order with its tax code on Telegram, or a daily summary, and export to XLSX with the columns you choose.

FiscalBay does not issue invoices and changes nothing in your store: it reads your orders through eBay's official APIs, read only. The tax code appears only when the buyer provided it and eBay makes it available. Sign in with a passkey, Google, eBay or email and password; order data stays on servers in the European Union.

Plans and pricing
- Free, at no cost: one active eBay store, orders from the last 30 days, 5 orders with the tax code to unlock every 7 days (more during promotions), CSV export.
- Pro: more stores, one year of history, unlimited orders to unlock, XLSX export and Telegram notifications. It costs €4.90 a month, €49 a year or €149 once for lifetime access, while places last. Prices exclude VAT: with Italian VAT at 22% they are €5.98, €59.78 and €181.78; before paying you see the total with your country's taxes.
- 14-day Pro trial, no card and no automatic renewal: start it whenever you like after the first successful read of a store, and at the end you go back to Free.

Pro is bought in the app, with payments handled by Stripe, not by the Microsoft Store. Subscriptions are cancelled from Settings, Plan and payments.

FiscalBay is an independent service, not affiliated with eBay.
```

**Product features**

```text
The buyer's tax code (Codice Fiscale), when eBay provides it, copied in one click
The buyer's VAT number (Partita IVA), when given in the order
Automatic reading of new orders and updates, even with the app closed
Orders from all your stores in one list, with search and filters
Search by order, buyer, item, SKU or tax code
CSV export, one row per order or per item
With Pro, XLSX export with the columns you choose and saved configurations
With Pro, Telegram notifications for new orders or a daily summary
With Pro, more eBay stores and one year of history
Message template to ask for the tax code when it is missing
Suggestions from the same buyer's previous orders
Read-only access to eBay through the official APIs
Sign in with a passkey, Google, eBay or email and password
Order data stored in the European Union
App icon badge with your unread notifications
Interface in Italian and English, light and dark theme
```

**Search terms**, con la stessa regola: `tax code`, `codice fiscale`, `VAT number`, `e-invoicing`, `order export`, `online sellers`, `marketplace`.

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
