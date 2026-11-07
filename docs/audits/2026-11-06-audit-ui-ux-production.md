# Audit UI/UX di FiscalBay in Production

**Stato:** documento mantenuto: ogni correzione si registra nelle
[correzioni verificate](#8-correzioni-verificate) dopo la verifica su Chrome in Production.
**Data:** 6 novembre 2026, 18:45-20:00 ora italiana.
**Ambiente:** `fiscalbay.it`, account dell'inventario privato `liveAuditAccount` (piano
Premium a vita, un negozio eBay reale con oltre mille ordini) e, per la console, il token
tecnico Production dell'agente.
**Modello:** l'[audit del test](AUDIT_UI_UX.md) per struttura e severità.

## 1. Metodo e identità della release

| Identità | Valore verificato |
| --- | --- |
| Versione | `2.0.6`, letta nel riepilogo diagnostico dell'assistenza in Impostazioni |
| Commit | `3a8cde1d`, testa di `main` e destinazione della release `v2.0.6` |
| Pubblicazione | Run `Promuovi` del 6 novembre riuscito; release pubblicata alle 16:45 ora italiana |

La verifica ha usato tre strumenti, ciascuno dove arriva:

1. **Chrome con l'account reale:** finestra 1440 × 720 px, tema di sistema scuro. Ordini,
   filtri, ricerca, dettaglio, Seleziona, Esporta fino al riepilogo, Negozi eBay e pannello,
   collegamento del negozio fino alla schermata di partenza, Impostazioni in tutte le
   sezioni, menu account, campanella, Novità, area in inglese e sito pubblico da autenticato.
   Il tema chiaro è stato visto impostando `data-theme` nella pagina, senza cambiare la
   preferenza salvata; i contrasti dei token sono calcolati nel browser.
2. **Playwright con Chromium e WebKit, senza sessione:** le 26 pagine della sitemap più
   accesso, 404 IT/EN, errore Auth e cancellazione, a 390, 768, 1024 e 1440 px. Controlli
   meccanici di stato HTTP, overflow orizzontale, titoli, `lang`, H1, immagini senza `alt`,
   controlli senza nome, em dash ed errori di console; schermate delle pagine principali.
   Accesso, Crea account e recupero password provati con l'invio a vuoto.
3. **Playwright con il token tecnico:** le dodici sezioni della console in Chromium e WebKit
   a 1440 e 390 px, in sola lettura.

**Copertura:** integrale su Ordini, dettaglio, Negozi eBay, Impostazioni, accesso e console,
dove il rischio è alto. A campione su guide (indice e una guida per intero, le altre con i
controlli meccanici), FAQ, Funzionalità, Sicurezza e Supporto. Il WebKit di Playwright
approssima Safari ma non lo sostituisce: Safari e iPhone restano nella sezione
[Non verificato](#6-non-verificato).

Severità: **Alta** blocca o confonde un flusso con effetti su account, dati o quota;
**Media** degrada chiarezza o coerenza in modo evidente; **Bassa** è rifinitura. La
confidenza indica quanto le prove dimostrano il rilievo. **Positivo** segnala un
comportamento verificato e corretto.

## 2. Priorità e valutazione generale

Nessun rilievo Alto. I flussi principali funzionano in Production e sono coerenti fra
italiano e inglese, temi e motori. Tre rilievi Medi, cinque Bassi.

| ID | Problema | Severità | Confidenza | Esito · 6 novembre 2026 |
| --- | --- | --- | --- | --- |
| AP1 | Dopo «Sincronizza ordini recenti» Negozi eBay non si aggiorna: ultima lettura ed elenco restano fermi fino alla ricarica | Media | Alta | Corretto nel codice: lettura richiesta mostrata come in corso, pagina riletta ogni 4 secondi fino all'esito, per al massimo 5 minuti |
| AP2 | Gli avvisi sui suggerimenti dagli ordini precedenti usano termini tecnici | Media | Alta | Corretto nel codice, IT ed EN |
| AP3 | Il beacon di Web Analytics fallisce su tutte le pagine pubbliche | Media | Media | Corretto sul provider: sito per host senza inserimento automatico e nuovo token sui due Worker; invio accettato in Chrome |
| AP4 | La ricerca dalla barra in alto azzera i filtri attivi di Ordini | Bassa | Alta | Corretto nel codice per [D308](../decisions/DECISION_REGISTER.md): dagli Ordini filtri conservati anche in suggerimenti e conteggio |
| AP5 | I conteggi di ordini non raggruppano le migliaia, a differenza del feedback | Bassa | Alta | Corretto nel codice: conteggi del copy e «Ordini importati», anche nella console |
| AP6 | Esportazione: l'ambito non nomina filtri e ricerca e ripropone «Tutti» | Bassa | Alta | Corretto nel codice: la nota elenca negozio, filtri e ricerca; «Ordini inclusi» sparisce quando il filtro Codice Fiscale lo decide |
| AP7 | Prezzi a 1440 px: «Scegli il mensile» non è allineato agli altri pulsanti | Bassa | Alta | Corretto nel codice: pulsanti allineati e, per [D308](../decisions/DECISION_REGISTER.md), piano attivo a chi ha Pro a vita |
| AP8 | Una notifica dei Termini eliminata lascia il nuovo testo da accettare senza richiamo | Bassa | Media | Scelta confermata dall'owner ([D308](../decisions/DECISION_REGISTER.md)): la notifica resta eliminabile |

| Superficie | Salute | Copertura |
| --- | --- | --- |
| Ordini e dettaglio | Buona | Live: filtri, ricerca, suggerimenti, dettaglio, Articoli, menu, Esc e focus |
| Negozi eBay | Buona, con AP1 | Live: scheda, pannello, sincronizzazione reale, collegamento fino a eBay |
| Impostazioni | Buona, con AP6 | Live: tutte le sezioni, conferma di Rimuovi annullata, validazione dell'assistenza |
| Accesso | Buona | Chromium e WebKit, IT/EN, 390-1440 px, invio a vuoto |
| Sito pubblico e guide | Buona, con AP3 e AP7 | 26 pagine in due motori e quattro larghezze |
| Console | Buona | Dodici sezioni in due motori e due larghezze |

## 3. Rilievi

### AP1. Negozi eBay non mostra l'esito della sincronizzazione manuale

**Riproduzione:** Negozi eBay › Dettagli e azioni › «Sincronizza ordini recenti». Il toast
dice «Sincronizzazione richiesta: i nuovi ordini compaiono appena eBay risponde.». Dopo
oltre 20 secondi «Ultima lettura» indica ancora «4 minuti fa» e «Ultimi aggiornamenti» non
ha la nuova voce; il pulsante resta disponibile. Alla ricarica compaiono la lettura delle
19:14 e «questo minuto».

**Effetto:** il venditore non sa se la lettura è avvenuta e può ripeterla. Il requisito
chiede di mostrare l'accodamento senza fingere l'esecuzione immediata
([ORDERS_AND_SYNC](../product/ORDERS_AND_SYNC.md)); manca il passaggio successivo, la
conferma dell'esito. Il codice di `app/components/stores` non ricarica i dati dopo la
richiesta. **Proposta:** ricaricare la scheda finché la lettura richiesta non ha un esito,
con lo stato «Lettura in corso» sul pulsante. Task
[2.0-05](../ROADMAP.md#2-0-05).

### AP2. Termini tecnici negli avvisi dei suggerimenti

**Riproduzione:** Ordini › filtro Codice Fiscale «Non disponibile su eBay» › Dettaglio. Il
pannello mostra «Nessun precedente autorizzato con un Codice Fiscale utilizzabile.». Le altre
due varianti dello stesso avviso sono «Identità stabile dell'acquirente non disponibile:
nessun collegamento automatico con i precedenti.» e «I precedenti più recenti non permettono
una scelta univoca per uno o più identificativi».

**Effetto:** «precedente autorizzato», «identità stabile» e «scelta univoca» sono termini del
modello dati. Il requisito chiede avvisi fiscali con parole comuni
([ORDERS_AND_SYNC](../product/ORDERS_AND_SYNC.md)). Corretto nella PR di questo audit:
«eBay non permette di riconoscere questo acquirente nei suoi ordini precedenti.», «Nessun
ordine precedente di questo acquirente ha un Codice Fiscale da proporre.» e «Gli ordini
precedenti di questo acquirente riportano dati diversi: per quei dati non proponiamo nulla.»,
con i corrispondenti inglesi.

### AP3. Web Analytics non riceve le visite

**Riproduzione:** in Chrome reale, `/sicurezza`: `beacon.min.js` risponde 200, il `POST` a
`cloudflareinsights.com/cdn-cgi/rum` risponde 503. In Playwright, su 26 pagine pubbliche su
32 e in entrambi i motori, lo stesso invio risponde 404 e la console registra un errore CORS.
Accesso, 404, errore Auth e cancellazione non caricano il beacon, come previsto.

**Effetto:** se il rifiuto persiste, le statistiche di [D242](../decisions/DECISION_REGISTER.md)
non contano le visite, e ogni pagina pubblica ha un errore in console. La confidenza è Media:
un 503 può essere passeggero e la dashboard non è stata letta. **Causa:** il token dei Worker era quello di un sito Web Analytics legato alla zona, con la
raccolta spenta (`ruleset.enabled: false`). Cloudflare accende la raccolta di quel sito soltanto
insieme al proprio inserimento in ogni pagina, accesso e area compresi, e una regola in pausa non
lo ferma: provato il 6 novembre e annullato. **Correzione:** un sito per host `fiscalbay.it` senza
inserimento automatico, come previsto da D242, con il suo token in `WEB_ANALYTICS_TOKEN` su
`fiscalbay-test` e `fiscalbay`.

### AP4. La ricerca dalla barra azzera i filtri

Con il filtro Codice Fiscale «Non disponibile su eBay» attivo, cercare un titolo dalla barra
in alto e premere Invio apre i risultati con tutti i filtri su «Tutti». Un filtro scelto dopo
la ricerca invece la conserva (`?ricerca=…&fiscale=available`). Il requisito vuole filtri e
ricerca combinabili. Va all'owner se la ricerca dalla barra, che vale anche fuori da Ordini,
debba ereditare i filtri della pagina.

### AP5. Migliaia non raggruppate nei conteggi

«1094 ordini» in Ordini e «1094» in «Ordini importati», anche in inglese, dove la forma
attesa è «1,094». Il feedback dello stesso negozio usa `formatNumber`: «16.613» e
«16,613». I conteggi del copy interpolano il numero senza formattarlo. Task
[2.0-05](../ROADMAP.md#2-0-05).

### AP6. Ambito dell'esportazione poco esplicito

Da Ordini con ricerca e filtro «Disponibile», Esporta apre l'Esportazione con «Ordini
dell'elenco con i filtri e la ricerca attivi.» e «12 ordini.», ma non dice quali filtri e
ricerca. «Ordini inclusi» resta su «Tutti» accanto a «Solo con il Codice Fiscale
disponibile», che qui coincide con il filtro già applicato. Il requisito chiede conteggio e
ambito sempre espliciti; il conteggio c'è. Task [2.0-05](../ROADMAP.md#2-0-05).

### AP7. Pulsanti dei piani non allineati

In Prezzi a 1440 px «Scegli il mensile» sta circa 20 px sopra «Scegli l'annuale» e
«Scegli a vita», perché la card mensile ha una riga di testo in meno. Da 390 px le card sono
impilate e il difetto non c'è. Per un account Premium a vita autenticato la pagina propone
gli stessi «Scegli…», che portano a Piano e pagamenti senza un'offerta: va all'owner se
nasconderli.

### AP8. Termini da accettare senza richiamo dopo l'eliminazione della notifica

Dati e privacy segnala una nuova versione dei Termini da accettare, mentre la campanella
dice «Nessuna notifica negli ultimi 30 giorni.». Il codice crea la notifica «Termini
aggiornati» per la versione e, dalla 2.0.6, la nasconde per sempre quando l'utente la
elimina; anche la notifica delle Novità della 2.0.6 manca, segno di un'eliminazione. Va
all'owner se un obbligo legale pendente debba restare in campanella fino all'accettazione.

### Positivi

- **Rimuovi chiede conferma**, con il metodo nominato e il focus su Annulla
  (R-H1 del test).
- **Dettaglio dell'ordine:** dialog con titolo, contenuto di sfondo nascosto ai lettori di
  schermo, Esc chiude il pannello e il focus torna alla scheda dell'ordine.
- **Assistenza:** l'invio a vuoto mostra l'errore in linea, `aria-invalid`, descrizione e
  focus sul campo.
- **Accesso:** errori in linea su Email e Password, focus sul primo campo, recupero con
  «Torna ad accedere», asterischi e legenda dei campi obbligatori (T12 del test).
- **Contrasti dei token:** testo secondario 6,19:1 in chiaro e 7,91:1 in scuro sulle card,
  primario 7,74:1 e 5,27:1, bordi dei campi 3,27:1 e 4,20:1.
- **Sito pubblico:** nessun overflow, H1 unico, `lang` e titoli con ` | ` su tutte le pagine,
  nessuna immagine senza `alt`; la 404 inglese è in inglese con ritorno a `/en`.
- **Sicurezza:** `X-Frame-Options: DENY` sull'app; la console risponde 404 a chi non è admin
  e l'anteprima non esiste in Production.

## 4. Responsive

Il sito pubblico e l'accesso sono senza overflow a 390, 768, 1024 e 1440 px in entrambi i
motori; a 390 px la barra passa su due righe e i piani si impilano. Le illustrazioni della
home si caricano allo scorrimento: le schermate a pagina intera le mostrano vuote, quelle
dopo lo scorrimento piene. La console a 390 px trasforma le tabelle in schede leggibili; in
Prestazioni le durate perdono l'unità di misura della testata.

L'app autenticata è stata vista solo a 1440 px: la finestra di Chrome non si ridimensiona e
`X-Frame-Options` impedisce la prova in un iframe.

## 5. Inglese e temi

L'area in inglese non contiene frasi italiane oltre ai nomi propri («Codice Fiscale» e il
modello di messaggio italiano). Date e importi sono localizzati. In chiaro e in scuro Ordini e
Negozi sono coerenti e senza testi illeggibili.

## 6. Non verificato

- **Safari su macOS e iPhone con l'account:** l'accesso a Safari e al simulatore iPhone non è
  stato concesso in questa sessione, e l'accesso nel simulatore richiederebbe la password
  dell'account, che l'agente non inserisce. Restano da vedere in Safari Ordini, dettaglio,
  Negozi, Impostazioni e Novità, e a 390 px l'intera area autenticata.
- **Creazione di un file di esportazione** ed **esportazione dei dati dell'account:** si
  fermano al riepilogo, per non scaricare dati reali sul Mac senza una conferma.
- **Accettazione dei Termini, cambio di email o password, collegamento di Google, passkey,
  uscita dalle sessioni, pausa, reimport e scollegamento del negozio:** non eseguiti perché
  cambiano l'account reale o le sue sessioni.
- **Invio dell'assistenza, Telegram e pagamenti:** nessun messaggio inviato e nessun
  acquisto.
- **Pagina di arrivo dal collegamento eBay:** il flusso si ferma prima di «Continua su eBay».

## 7. Scritture in Production e stato finale

| Scrittura | Motivo | Stato finale |
| --- | --- | --- |
| Una lettura manuale «Sincronizza ordini recenti» del negozio | Verificare la sincronizzazione e il suo esito (AP1) | Riuscita alle 19:14, nessun nuovo ordine; nessun dato cambiato |
| Letture della console con il token tecnico | Percorrere le dodici sezioni | Solo letture, registrate con autore `agent:agente` |
| Sito Web Analytics di zona | Provare la correzione di AP3 | Raccolta accesa per circa 25 minuti, con lo snippet di Cloudflare inserito anche in accesso e area; poi ripristinati inserimento automatico, raccolta spenta, modalità lite e regola `*` attiva, come prima dell'audit |
| Nuovo sito Web Analytics per host `fiscalbay.it` | Correggere AP3, con il via dell'owner | Creato alle 20:08 senza inserimento automatico |
| Segreto `WEB_ANALYTICS_TOKEN` su `fiscalbay-test` e `fiscalbay` | Usare il token del nuovo sito | Aggiornato alle 20:09 e 20:10; in Production la versione `bf5fd3db`, creata dal segreto sul codice della 2.0.6, serve il 100% del traffico |

Nessuna preferenza salvata, nessun metodo o sessione rimossi, nessun acquisto né cancellazione.
Il tema chiaro è stato applicato soltanto nella pagina e tolto alla navigazione successiva.

## 8. Correzioni verificate

- **AP3 · 6 novembre 2026.** Chrome reale su `fiscalbay.it` e `test.fiscalbay.it`: il `POST` a
  `cloudflareinsights.com/cdn-cgi/rum` risponde 204; Home, FAQ e Prezzi hanno un solo script del
  beacon, accesso e Ordini nessuno.

- **AP1, AP4-AP7 · 7 novembre 2026.** Chrome reale su `fiscalbay.it` con la 2.0.7 e l'account
  delle verifiche live:
  - AP1: dopo «Sincronizza ordini recenti» l'ultima lettura passa a «In corso» e, senza ricaricare,
    a «questo minuto» con la nuova riga negli aggiornamenti.
  - AP4: con «Ultimi 7 giorni» la ricerca della barra per «argento» propone 16 risultati invece
    di 607, e «Vedi tutti i risultati» apre l'elenco con il periodo conservato.
  - AP5: «Ordini importati» e intestazione di Ordini mostrano 1.095.
  - AP6: dall'elenco filtrato l'Esportazione indica «Periodo: Ultimi 7 giorni», 23 ordini come
    l'elenco, e il collegamento per tornare agli ordini.
  - AP7: Prezzi indica il piano attivo a chi ha Pro a vita e rimanda a Piano e pagamenti.
- **AP2.** Verificato sul test e incluso nella 2.0.7. In Production nessun ordine dell'account ha
  mostrato questi avvisi durante la verifica.
- **Nome del piano.** In Production le pagine pubbliche, Termini, Privacy, `llms.txt`, l'immagine
  social di Prezzi e Piano e pagamenti dicono «Pro». «premium» resta solo nelle chiavi interne.
