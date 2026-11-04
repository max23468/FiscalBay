# Sito, processi e documenti

## Changelog

### Novità

#### Funzionalità

- **Guide.** Nel sito trovi le Guide per i venditori eBay: dove trovare il Codice Fiscale dell'acquirente e perché a volte non si vede nell'ordine, come chiederlo, la Partita IVA, la fattura elettronica e l'export in Excel o CSV.

#### Miglioramenti

- **Inizia gratis.** Il pulsante per registrarti è nella barra di ogni pagina del sito, accanto ad Accedi.
- **Piano scelto in Prezzi.** Ogni offerta Premium ha il suo pulsante e, dopo la registrazione, la pagina Piano ti mostra quella che avevi scelto.
- **Domande sui pagamenti.** La pagina Prezzi risponde alle domande su carta, prova, pagamento e piano a vita.
- **Indirizzi in inglese.** Le pagine in inglese hanno indirizzi in inglese, anche nell'app; i vecchi indirizzi portano a quelli nuovi.
- **Vai al contenuto principale.** Con la tastiera, il primo tasto Tab porta direttamente al contenuto della pagina.
- **Prezzi sempre visibili.** Home e Prezzi restano consultabili anche durante un disservizio e mostrano i prezzi del listino.

### What's new

#### Features

- **Guides.** The website has Guides for eBay sellers: where to find the buyer's tax code and why it sometimes does not show on the order, how to ask for it, the VAT number, the Italian e-invoice and exporting to Excel or CSV.

#### Improvements

- **Start for free.** The sign-up button is in the bar of every page of the website, next to Sign in.
- **Plan chosen in Pricing.** Each Premium offer has its own button and, after you sign up, the Plan page shows the one you chose.
- **Questions about payments.** The Pricing page answers questions about cards, the trial, payment and the lifetime plan.
- **English addresses.** English pages have English addresses, in the app too; old addresses lead to the new ones.
- **Skip to main content.** With the keyboard, the first Tab takes you straight to the page content.
- **Prices always visible.** Home and Pricing stay available during an outage and show the price list.

### Altre modifiche

- Home e Prezzi arrivano da una copia di un minuto nella cache di Cloudflare a chi non ha cookie, con il listino di riserva senza database; i vecchi indirizzi inglesi rispondono 301, o 308 ai moduli.
- Titoli con la parola chiave davanti, offerte e articoli nei dati strutturati, un'immagine social per pagina, `lastmod` nella sitemap, manifest con icone e colore del tema, immagine principale in AVIF a più larghezze e trenta giorni di cache per le immagini del sito; `security.txt` pubblicato.
- Il testo inglese segue la regola del 27 settembre: «Codice Fiscale» in titoli ed etichette, «tax code» nelle frasi.
- Un hook degli agenti ferma reset, stash, push forzati, Wrangler fuori dai casi ammessi, modifiche di migration applicate ed em dash; `verify:repo` controlla anche gli indirizzi degli account delle verifiche live e la scadenza di `security.txt`.
- Le decisioni superate per intero passano in un archivio e le operazioni sono divise in runbook.
