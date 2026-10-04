# Audit UI/UX di FiscalBay 2.0 sul dominio test

**Stato:** audit concluso, correzioni in corso: vedi [§15](#15-correzioni-verificate)
**Data:** 3 ottobre 2026
**Ambiente:** Worker `fiscalbay-test` su `test.fiscalbay.it`, codice di `develop`
a `de1fcab`; la diagnostica dell'anteprima riporta `2.0.0 (anteprima)`
**Strumento:** Chrome con le sessioni esistenti, finestra a 1440 x 666 px.
La finestra non si ridimensiona: 1200, 1024 e 500 px sono stati provati con un
iframe della stessa origine, che fa rispondere le media query alla sua
larghezza

## 1. Metodo

L'audit si è svolto in quattro giri.

1. **App reale con un account senza negozio**, sessione più vecchia di 24
   ore: Ordini, Sicurezza, collegamento del negozio, pagine standalone.
2. **Anteprima** (`/anteprima`): Ordini, dettaglio, Negozi eBay,
   Impostazioni, Profilo, ricerca, notifiche e menu account, in tutti i
   dodici scenari del selettore della barra in alto. Azioni simulate eseguite
   davvero: selezione, esportazione, sblocco, riprova, scollegamento,
   pausa, eliminazione account fino alla conferma, interruttori delle notifiche.
3. **Pagina di accesso da disconnesso**: Accedi, Crea account (Privato e
   Azienda), recupero password, invio a vuoto, IT ed EN.
4. **App reale con info@**, appena autenticato dall'owner: ordine importato,
   Sicurezza con accesso recente, collegamento Google, `/admin`.

Ogni superficie è stata vista in scuro (tema di sistema) e in chiaro (stesso
attributo `data-theme` che imposta il selettore Tema), e in inglese su `/en`.
Contrasti dei token calcolati nel browser.

Severità: **Alta** blocca o confonde un flusso con effetti su account, dati o
quota; **Media** degrada chiarezza o coerenza in modo evidente; **Bassa** è
rifinitura. La confidenza indica quanto il problema è dimostrato dalle prove
raccolte. **Positivo** segnala comportamenti verificati e corretti.


## Verifica di implementazione del 4 ottobre 2026

La colonna aggiunta fotografa le prove di questa ripresa; i findings originali
restano invariati. Non sostituisce lo stato canonico di `BACKLOG.md`.
Codice consultato: `develop dc0a884`; confrontati i cambiamenti da `de1fcab`
e le convenzioni del design system. La run «Push on develop» sullo stesso
commit risulta riuscita; questo dato non sostituisce il readback provider.
Le prove browser sono state eseguite direttamente su `test.fiscalbay.it`
in Chrome, con la sessione già autenticata, il 4 ottobre 2026.

**Lettura degli esiti:** Implementato indica una correzione riscontrata nel
codice e nella superficie specificata; Parziale conserva un residuo; Non
implementato indica il difetto ancora osservato o il codice che lo conserva;
Non verificato evita di dedurre una chiusura senza la prova pertinente.
Rinviato e Scelta confermata distinguono decisioni approvate da correzioni.
Le osservazioni positive non entrano nel conteggio dei 92 problemi. Gli ID
ripetuti nella tabella Priorità e in §15 hanno lo stesso esito.

**Superfici e prove:** Ordini e Sicurezza reali, menu account, apertura e
annullamento di Nuova email, validazione locale dell’invio vuoto; anteprima
Ordini, dettaglio e Articoli, Negozi e dettaglio del negozio in pausa/scaduto,
Impostazioni, Profilo, scenari del selettore, IT/EN, tema chiaro/scuro;
Termini ed errore Auth pubblici. Verificati toast sopra il pannello, attributi
accessibili, icone e dimensioni dei controlli, data inglese e pulizia di un
esito sintetico dall’URL di Sicurezza con successiva ricarica.

**Responsive:** 1440×666 px e 390×844 px, quest’ultimo con emulazione CDP
verificata tramite `innerWidth/innerHeight`. Il comando di viewport di alto
livello non cambiava le dimensioni effettive; non è stato usato come prova.
A 390 px verificati nota delle azioni simulate, primo accesso e filtri Premium.
Emulazione rimossa al termine; 1200/1024 px non riprovati.

**Limiti:** accesso/registrazione da disconnesso non riprovati per conservare
la sessione; nessuna rimozione di metodi, revoca sessioni, cambio credenziali,
nuovo OAuth, invio email, pagamento o scrittura sui provider. Il submit di
Nuova email vuota è stato bloccato dalla validazione locale. Nessuna prova
nuova su admin o dialoghi nativi passkey. I test simulati non qualificano i
flussi reali di Stripe, Telegram, supporto, export o cancellazione. I residui
assegnati a milestone aperte restano tali. Nessun dato reale è stato aggiunto
al rapporto. Scenario riportato a Free, uso ordinario, e tema a Sistema.

## 2. Priorità

| ID | Problema | Severità | Confidenza | Verifica implementazione · 4 ottobre 2026 |
| --- | --- | --- | --- | --- |
| R-H1 | "Rimuovi" su un metodo di accesso agisce al primo clic, senza conferma | Alta | Alta | Non implementato. Chrome: Rimuovi disponibile; codice di MethodAction ancora submit diretto. Nessuna rimozione reale eseguita. |
| R-H2 | La card dell'ordine reale mostra solo numero, data e importo: nessuno stato del Codice Fiscale | Alta | Alta | Non implementato. Chrome: card reale con numero, data e importo, senza stato fiscale o dettaglio. Funzioni complete a M4-01. |
| R-H3 | Con sessione non recente "Collega", "Rimuovi" e "Cambia email" sembrano attivi e falliscono solo dopo il clic | Media | Alta | Non implementato nel codice. Controlli attivi e verifica recente solo nell’action; nessuna azione reale con sessione scaduta eseguita. |
| T1 | L'anteprima non rappresenta l'app reale: header, card ordini, stato vuoto, Sicurezza e messaggi diversi | Media | Alta | Parziale. Chrome: shell e Sicurezza separate; card reale ancora incompleta. Navigazione e primi passi restano ai task aperti. |
| T2 | "Nome" facoltativo nel Profilo, Nome e Cognome obbligatori alla registrazione | Media | Alta | Non implementato. Chrome: Profilo con Nome facoltativo; registrazione ancora con Nome/Cognome obbligatori nel codice. |
| N-H1 | Negozio in pausa nel piano Free: "Scegli quale in Piano e pagamenti" porta a una sezione senza scelta | Media | Alta | Non implementato. Chrome Free: rinvio a Piano e pagamenti, dove manca la scelta del negozio. |
| T3 | Toast sotto l'oscuramento dei pannelli e sopra la barra di selezione | Media | Alta | Implementato. Chrome: toast sopra il pannello, role=status e aria-live=polite; compensazione della barra nel codice. PR #254. |
| N-H2 | Stati dei negozi contraddittori: aggiornamenti "previsti" con sincronizzazione sospesa, storico "completato" mai sincronizzato | Media | Alta | Non implementato. Chrome: negozio in pausa/scaduto con aggiornamento previsto e storico completato. |
| I-H1 | Notifiche Telegram spente: le opzioni dipendenti restano attive | Media | Alta | Non implementato. Chrome Premium: switch spento dopo il retry, radio Tutti i nuovi ordini ancora abilitato. |

## 3. Problemi trasversali

| ID | Problema | Severità | Confidenza | Verifica implementazione · 4 ottobre 2026 |
| --- | --- | --- | --- | --- |
| T1 | Anteprima e app reale divergono. Header: nav, ricerca, campanella e avatar contro "Italiano / English / Sicurezza / Esci". Ordini: card ricche contro card con numero e importo. Primo accesso: illustrazione e primi passi contro card "Nessun ordine". Sicurezza: gruppo Email in Profilo e "Email e password" senza "Rimuovi" contro gruppo Email in pagina e "Rimuovi". Negozio già collegato: titolo e "Accedi con quell'account oppure contatta l'assistenza" contro "Contatta il supporto: supporto@". Le decisioni prese sull'anteprima non valgono per ciò che l'utente vede | Media | Alta | Parziale. Chrome: shell e Sicurezza separate; card reale ancora incompleta. Navigazione e primi passi restano ai task aperti. |
| T2 | Il Profilo dice "Facoltativo. Compare nelle email di servizio." per un campo unico "Nome"; la registrazione rende obbligatori Nome e Cognome (`required`) e, per Azienda, Ragione sociale, che il Profilo non mostra | Media | Alta | Non implementato. Chrome: Profilo con Nome facoltativo; registrazione ancora con Nome/Cognome obbligatori nel codice. |
| T3 | I toast compaiono centrati in basso con z-index inferiore all'overlay dei pannelli laterali: con un pannello aperto restano attenuati ("Anteprima: l'azione è simulata." dopo "Ricollega negozio" e "Metti in pausa"). Con la barra di selezione aperta il toast (y 610) la copre per 4,5 s. Il nodo del toast non ha `role` né `aria-live` | Media | Alta | Implementato. Chrome: toast sopra il pannello, role=status e aria-live=polite; compensazione della barra nel codice. PR #254. |
| T4 | Larghezze e allineamenti di pagina incoerenti: Ordini e Negozi a 1152 px allineati a sinistra; Impostazioni finisce a 1192 px mentre l'header arriva a 1296; Profilo colonna centrata di 672 px; app reale con card da 448 e 576 px e banner da 1152 | Media | Alta | Parziale. Convenzioni di larghezza applicate nell’anteprima; route reali e superfici future restano nel perimetro dei task aperti. |
| T5 | Tile delle icone in molti toni senza regola: titolo Ordini blu-grigio, Impostazioni grigio, Negozi verde acqua; nel dettaglio negozio cinque colori (blu, verde, viola, ambra, verde acqua); funzioni della pagina di accesso blu, ambra, verde acqua | Media | Alta | Implementato. Tinte per sezione nel codice e nel pannello negozio visto su Chrome. PR #254. |
| T6 | Lo stesso cerchio tratteggiato indica "Non disponibile su eBay" (sembra uno spinner di caricamento), la notifica "Nuovo accesso" e "In pausa per il piano Free" | Media | Alta | Implementato. CircleMinus per dato assente e CirclePause per pausa; Chrome e codice. PR #254. |
| T7 | Colori di stato usati per dati neutri: avatar dei negozi rosati o rossi ("OR", "BR"), puntino e miniatura rossi per il negozio Outlet, barra rossa nell'illustrazione di "Nessun ordine": sembrano errori | Bassa | Media | Implementato. Tinte rosse dei negozi rimosse; Chrome: avatar Outlet neutro e illustrazione del primo accesso senza rosso. PR #254. |
| T8 | Quattro stili per le azioni distruttive: outline neutro ("Rimuovi"), ghost rosso rientrato di 13 px ("Esci da tutti gli altri dispositivi", "Elimina account", "Scollega"), bottone rosso pieno nelle conferme, `variant="destructive"` nell'app reale | Media | Alta | Parziale. Chrome: distruttivi con bordo nell’anteprima; Rimuovi reale resta outline neutro, da trattare con R-H1. |
| T9 | Azioni secondarie in tre stili: outline ("Cambia email", "Scegli"), ghost senza bordo ("Carica altri", "Apri Sicurezza", "Apri il negozio", "Cancella ricerca"), link sottolineato ("Passa a Premium", "Scopri Premium") | Bassa | Alta | Implementato nelle convenzioni condivise. Varianti aggiornate in PR #254; Chrome su Impostazioni e Negozi. Non tutte le azioni future sono disponibili. |
| T10 | Scala tipografica dei controlli: bottoni piccoli a 12,8 px (0,8 rem), testo a 14 px, note a 12 px ("Serve almeno un metodo di accesso.", "Prezzi IVA esclusa..."); titoli delle card a 16 px in Profilo e app reale, 20 px in Impostazioni; righe di Sicurezza a 14 px nell'app reale e 16 px nell'anteprima | Bassa | Alta | Implementato. Chrome: controlli piccoli a 14 px; scala aggiornata nel codice. PR #254. |
| T11 | Due selettori di lingua diversi: pillola piena più testo semplice nell'header reale e nella pagina di accesso, segmentato con bordo in Impostazioni. I nomi delle lingue cambiano: "English" in Lingua, "Inglese" nelle schede del Modello di messaggio | Bassa | Alta | Implementato. LanguageSwitch condiviso nel codice; Chrome: Italiano/English anche nelle schede del modello. PR #254. |
| T12 | Validazione dei moduli affidata al fumetto nativo del browser ("Compila questo campo.", "Aggiungi un simbolo @"), senza stile d'errore né `aria-invalid`; i campi obbligatori non sono marcati mentre "Facoltativo" sì | Bassa | Alta | Parziale. Chrome: Nuova email vuota mostra errore in linea, aria-invalid e focus. Campi obbligatori ancora senza indicazione; accesso disconnesso non riprovato. |
| T13 | Banner di esito con raggio 8 px e padding 10/8 px, contro card a 14 px e 16 px; l'esito resta nell'URL (`?accesso=...`) e ricompare alla ricarica | Bassa | Alta | Implementato. Chrome: esito sintetico in Sicurezza tolto dall’URL e assente alla ricarica; Alert aggiornato nel codice. PR #254. |
| T14 | Terminologia della quota mista: "Hai ancora 2 ordini disponibili" (quota), "Ti resta 1 ordine da sbloccare" (quota), "Nessun ordine da sbloccare" (ordini bloccati tra i selezionati), "Nessun ordine da sbloccare rimasto in questo ciclo" (quota). In italiano anche "dopo lo sblocco ne resteranno 0" | Media | Alta | Non implementato. Chrome: restano ordini disponibili e ordini da sbloccare per concetti diversi. |
| T15 | FAQ con il triangolo nativo del browser, unico controllo non disegnato del prodotto | Bassa | Alta | Implementato. Chrome: summary senza marker nativo e con chevron. PR #254. |
| T16 | Contrasti dei token adeguati: testo secondario 6,2:1 in chiaro e 7,9:1 in scuro su card; bottone primario 7,7:1 e 5,3:1; bordo dei campi 3,05:1 in chiaro | Positivo | Alta | Riscontro positivo dell’audit originale; nessuna correzione da implementare. Non riconfermato integralmente in questa ripresa. |

## 4. App reale

### 4.1 Ordini e Sicurezza

Stato aggiornato dopo l'implementazione `0b8a47c` e il mandato di pubblicazione del 4 ottobre 2026. Prove locali su build e dati sintetici: `pnpm verify` verde con 153 test applicativi, 85/85 E2E Chromium e collaudo dell'area reale IT/EN a 330 e 1280 px. Il collaudo successivo al deploy test viene riferito in chat, senza anticiparlo in questa tabella. Stato operativo e limiti di ripresa nel [backlog](../../BACKLOG.md#stato).

| ID | Problema | Severità | Confidenza | Verifica implementazione · 4 ottobre 2026 |
| --- | --- | --- | --- | --- |
| R-H1 | "Rimuovi" per Email e password, Google, eBay e passkey è un submit diretto (`rimuovi-metodo` in `app/routes/sign-in.ts`): con accesso recente il metodo sparisce al primo clic. Unico freno è "Serve almeno un metodo di accesso". Non eseguito per non togliere metodi reali | Alta | Alta | Implementato nelle correzioni trasversali e ricontrollato. Conferma che nomina il metodo, focus iniziale su Annulla e ritorno al pulsante. E2E condivisi per password, Google e passkey IT/EN; collaudo locale nell'area reale della rimozione password annullata. Controlli server sull'ultimo metodo conservati. Nessuna rimozione su account reali. |
| R-H2 | La card dell'ordine importato contiene numero (senza "Ordine"), data e importo. Mancano stato, negozio, articoli, acquirente e soprattutto lo stato del Codice Fiscale: senza identificativo non c'è "Non disponibile su eBay" né altra spiegazione, e la card non apre un dettaglio | Alta | Alta | Parziale. Card con «Ordine», negozio, acquirente, articoli/quantità, pagamento, spedizione e dati fiscali; dettaglio in pannello con URL aggiornato, a tutta larghezza mobile. Riepilogo validato da Fulfillment e nome negozio da Identity, con migration additiva 0011. Prove locali di importazione, isolamento tenant e assenza di valori bloccati nel browser. Dati presenti senza grant: «Da sbloccare»; assenza non qualificata: «Disponibilità fiscale da verificare». Restano acquisizione completa, verifica autorevole della disponibilità e recupero dei riepiloghi storici nei percorsi M3/M4-01; i campi non acquisiti sono dichiarati, senza inventare dati o assenza su eBay. |
| R-H3 | Con sessione più vecchia di 24 ore "Collega" (eBay), "Rimuovi" e "Cambia email" restano attivi; dopo il clic compare "Per questa modifica serve un accesso recente: esci e accedi di nuovo a FiscalBay." senza un'azione per farlo | Media | Alta | Implementato. Loader e UI espongono accesso recente e requisito passkey admin, disabilitano le modifiche bloccate e offrono «Esci e accedi di nuovo», anche nel banner di rifiuto server. Cambio password e chiusura sessioni restano consentiti. Test server per sessione vecchia/admin ed E2E IT/EN; collaudo locale di una sessione di 25 ore con uscita effettiva. |
| R-B1 | La pagina si chiama "Ordini" ma contiene anche la card Sicurezza; header con tre stili (pillola lingua, link "Sicurezza" sottolineato, bottone "Esci" con bordo) | Media | Alta | Implementato. Chrome: Ordini separato da Sicurezza, logo e menu account condivisi. PR #255. |
| R-B2 | "Cambia password" risponde "Ti abbiamo inviato un link per scegliere la password": "scegliere" per un cambio | Bassa | Alta | Implementato IT/EN: «impostare una nuova password», valido per aggiunta e cambio. Esito e focus coperti dagli E2E. Nessuna email reale inviata per questo collaudo. |
| R-B3 | Dopo un invio il focus torna al body, non al banner di esito né al controllo usato | Bassa | Alta | Implementato. `AccessNotice` sposta il focus al banner dopo il caricamento dell'esito; i parametri escono dall'URL per non riproporlo alla ricarica. E2E IT/EN su nuovo accesso e link password, distinti dalla validazione locale. Nessun submit sensibile sull'account reale. |
| R-B4 | Riga Passkey: la descrizione va a capo a circa 330 px ("del / dispositivo.") per il bottone a destra, mentre le altre righe usano tutta la larghezza | Bassa | Alta | Implementato. Testo e azioni su righe separate sotto 768 px, allineamento laterale da 768 px. Collaudo locale a 330 e 1280 px, IT/EN e chiaro/scuro, senza overflow. |
| R-B5 | L'ultima sessione ha un divisore sotto di sé e poi 16 px prima del bordo della card | Bassa | Alta | Implementato. Separatori soltanto tra le sessioni e bordo superiore, senza divisore finale. Controllo visivo locale IT/EN, mobile/desktop e chiaro/scuro. |
| R-B6 | Nessun selettore del tema nell'app reale: esiste solo nelle Impostazioni dell'anteprima | Bassa | Alta | Rinviato. Nessun selettore nell’app reale su Chrome; tema di sistema fino a M4-06, come decisione approvata. |
| R-B7 | Il campo "Nuova email" ha un anello di focus di 3 px molto marcato rispetto al resto | Bassa | Media | Verificato nel codice: Nuova email riusa lo stesso componente `Input` e l'anello comune degli altri campi. Nessuna variante locale o difetto di coerenza da correggere; anello mantenuto per accessibilità. |
| R-P1 | "Collega negozio eBay" completa l'OAuth senza schermata quando il consenso esiste e torna con "Questo negozio eBay è già collegato a un altro account FiscalBay. Contatta il supporto: supporto@fiscalbay.it" | Positivo | Alta | Riscontro positivo dell’audit originale; nessuna correzione da implementare. Non riconfermato integralmente in questa ripresa. |
| R-P2 | "Cambia email" apre il campo in linea e "Annulla" riporta il focus sul bottone | Positivo | Alta | Positivo riconfermato. Chrome: Annulla riporta il focus a Cambia email. |

### 4.2 Pagina di accesso

Aggiornamento locale del 4 ottobre 2026: A1–A7 implementati sul branch
`codex/accesso-standalone`. Marchio ancorato in alto, logo eBay dal kit
ufficiale, scheda attiva più chiara in scuro, accesso compatto con passkey
visibile a 1440 × 666, recupero senza social/passkey e con «Torna ad accedere»,
margine mobile di 16 px e collegamenti legali disponibili anche in Accedi.
Prove Chromium sulla build locale: IT/EN, chiaro/scuro, 500 e 1440 px;
cambio scheda e tipo di account, recupero e ritorno, asset caricato,
assenza di overflow e di errori console. Le colonne seguenti descrivono
le correzioni locali; collaudo sul candidato distribuito dopo il deploy autorizzato.

| ID | Problema | Severità | Confidenza | Verifica implementazione · 4 ottobre 2026 |
| --- | --- | --- | --- | --- |
| A1 | La colonna del marchio si ricentra in verticale a ogni cambio di scheda o di tipo: il titolo passa da y 206 (Accedi) a 322 (Crea account, Privato) e 364 (Azienda) | Media | Alta | Implementato localmente: marchio ancorato in alto, posizione invariata al cambio Accedi/Crea account/Privato/Azienda nella matrice Chromium. |
| A2 | "Continua con Google" ha il logo, "Continua con eBay" no | Bassa | Alta | Implementato localmente: logo eBay dal kit ufficiale, asset caricato e proporzioni conservate; provenienza nel design system. |
| A3 | In scuro la scheda attiva del segmentato è più scura del contenitore e sembra incassata | Bassa | Media | Implementato localmente: indicatore attivo in superficie accent, più chiaro del contenitore nel tema scuro; controllo Chromium e screenshot. |
| A4 | Spaziature irregolari: "Hai dimenticato la password?" 40 px sotto "Accedi"; passkey staccata di 20 px contro 8 px tra Google ed eBay. A 1440 x 666 la card supera la finestra e "Accedi con passkey" richiede scroll | Bassa | Alta | Implementato localmente: accesso e recupero compatti, 8 px fra i metodi alternativi; passkey visibile senza scroll a 1440 × 666. |
| A5 | Nel recupero password il link di ritorno si chiama "Accedi" come la scheda e il bottone; sotto restano social e passkey | Bassa | Alta | Implementato localmente: «Torna ad accedere», senza social o passkey durante il recupero; ritorno provato IT/EN. |
| A6 | A 500 px logo a 18 px dal bordo, titolo e card a 26 px; l'app usa 16 px | Bassa | Alta | Implementato localmente: logo, titolo e card a 16 px dal bordo a 500 px; misura nel test Chromium. |
| A7 | Nessun collegamento a Termini e Privacy nella scheda Accedi; compaiono solo nella casella della registrazione | Bassa | Media | Implementato localmente: collegamenti Termini/Privacy disponibili anche in Accedi, con URL localizzati. |

### 4.3 Pagine standalone

Aggiornamento locale del 4 ottobre 2026: S2–S4 implementati. Logo e card
formano un gruppo centrato; errore 404 con indicazione utile e richiamo
all'assistenza presente soltanto nel link dell'errore Auth. Il ritorno OAuth
conserva Google/eBay e lingua; il messaggio di account già collegato nomina
il provider appena usato, con testo generico per provider assente o sconosciuto.
S1 parziale: data della bozza leggibile e localizzata, senza slug o ripetizioni,
e pulsante «Torna a FiscalBay». I testi legali definitivi restano ai task
legali aperti; versioni registrate e accettazioni non cambiano. S5 resta
un riscontro positivo, con comportamento admin invariato.
Prove Chromium locali sulla stessa matrice di §4.2, inclusi ritorni e
messaggi Google/eBay/generici; test Workerd del callback OAuth rifiutato,
senza chiamate ai provider. Le colonne seguenti descrivono le correzioni
locali; nessuna nuova prova live anticipata.

| ID | Problema | Severità | Confidenza | Verifica implementazione · 4 ottobre 2026 |
| --- | --- | --- | --- | --- |
| S1 | Termini e Privacy sono segnaposto: "Bozza · Versione bozza-2026-09-28" ripete "bozza" e mostra uno slug; l'unico ritorno è il logo | Media | Alta | Parziale: data della bozza leggibile e localizzata, senza slug o ripetizioni, e ritorno esplicito. Contenuti definitivi ai task legali aperti; versioni e accettazioni persistenti invariate. |
| S2 | Logo staccato di circa 200 px sopra la card centrata in tutte le pagine standalone | Bassa | Alta | Implementato localmente: logo e card nello stesso gruppo centrato, distanza controllata su Termini, Privacy ed errore Auth. |
| S3 | Testi ripetuti: "Pagina non trovata" / "La pagina richiesta non è stata trovata."; in "Accesso non completato" "contatta il supporto" nel testo e subito dopo nel link | Bassa | Alta | Implementato localmente: errore 404 con indicazione utile; richiamo al supporto presente soltanto nel link dell’errore Auth. Copy IT/EN verificato. |
| S4 | "Account già collegato: Questo account è già collegato a un altro utente FiscalBay." non dice che l'account è quello Google appena usato | Bassa | Alta | Implementato localmente: messaggio con Google/eBay e fallback generico; callback OAuth rifiutato conserva provider e lingua nel test Workerd. Nessun conflitto OAuth reale provocato. |
| S5 | `/admin` per chi non è admin risponde come un indirizzo inesistente, come previsto dal codice | Positivo | Alta | Riscontro positivo conservato: nessuna modifica alla protezione admin. Collaudo post-deploy da riferire in chat. |

## 5. Anteprima: Ordini

Implementazione locale del 4 ottobre 2026 su `codex/anteprima-ordini`, comprendente §5.1. Gli stati sotto descrivono il codice locale, senza attribuirgli i precedenti riscontri Chrome sul dominio test. Su richiesta owner «Non chiedermelo più» permette di saltare le conferme successive dello sblocco singolo; la scelta si salva solo dopo uno sblocco riuscito e si ripristina con «Riattiva conferma sblocco». Il multiplo conserva la conferma. Nell’anteprima la preferenza appartiene al cookie tecnico di 30 giorni, comune alle lingue e azzerato al cambio scenario; nessuna preferenza modificata su account reali.

Prove finali: `pnpm verify` verde, 156 test applicativi e 24 test degli script; React Doctor 100/100; build 322,9 KiB gzip su 350. Chromium completo 101/101, inclusi otto nuovi casi IT/EN, chiaro/scuro e 390/1280 px per stati, conferme e preferenza, filtri, ricerca vuota, fine elenco, outage e dettaglio con scorrimento effettivo. Screenshot locali ispezionati. Pubblicazione sul test autorizzata dall’owner il 4 ottobre 2026; stato dei finding allineato alle prove disponibili prima della PR. Resta il collaudo su Chrome dopo il deploy, da riferire in chat.

| ID | Problema | Severità | Confidenza | Verifica implementazione · 4 ottobre 2026 |
| --- | --- | --- | --- | --- |
| O1 | "Non disponibile su eBay" usa il cerchio tratteggiato che sembra un caricamento (T6) | Media | Alta | Già implementato e conservato: CircleMinus per il dato assente. |
| O2 | Un Codice Fiscale "Da verificare" sta nello stesso box blu con copia dei codici validi: l'avviso è solo nella riga sotto | Media | Media | Implementato e verificato localmente: riquadro e copia ambra con «Da verificare» dentro il box; il valore originale resta copiabile e la spiegazione della qualità resta visibile. |
| O3 | "Riprova" mostra il toast "Nuova lettura richiesta." ma la card resta su "Aggiornamento non riuscito", senza stato in corso | Media | Alta | Implementato e verificato localmente: stato in corso durante la richiesta; retry simulato valido porta a In verifica e persiste alla ricarica. Nessun esito eBay reale simulato come riuscito. |
| O4 | "Sblocca ordine" consuma la quota al primo clic; il testo sotto avvisa del consumo, manca una conferma o un annulla | Bassa | Alta | Implementato e verificato localmente: conferma iniziale con ordine e quota residua; Annulla riceve il focus e torna al controllo. «Non chiedermelo più» si salva dopo uno sblocco riuscito e salta i popup dei successivi singoli; scelta riattivabile. Verifica server della quota sempre presente. |
| O5 | Barra di selezione: "Sblocca 0" primario blu pieno anche se disabilitato; dopo "Annulla" il focus va al body invece che su "Seleziona" | Bassa | Alta | Implementato e verificato localmente: Sblocca 0 disabilitato usa la superficie neutra; Annulla torna a Seleziona. |
| O6 | Select Periodo: il menu si allinea sull'opzione corrente, è più largo del campo e copre metà di "Pagamento"; "Ultimi 90 giorni" disabilitato con corona viola, senza spiegazione | Bassa | Alta | Implementato e verificato localmente: menu sotto il campo, stessa larghezza, senza allineamento sull’opzione corrente; spiegazione Premium visibile nell’opzione non disponibile. |
| O7 | Miniature in tre stili (icona su tile scuro, quadrato grigio chiaro che sembra un'immagine rotta, quadrato beige); in scuro i tile chiari abbagliano. Dipende dai dati di esempio | Bassa | Media | Implementato e verificato localmente: miniature sintetiche scure e coerenti, segnaposto Package neutro con bordo; nessuna immagine chiara da confondere con un errore. |
| O8 | Acquirente su una riga centrato sul box del codice, su due righe allineato in alto: le basi cambiano tra card vicine | Bassa | Alta | Implementato e verificato localmente: nome dell’acquirente sempre allineato in alto, con altezza minima condivisa. |
| O9 | Numeri d'ordine con `tabular-nums`: i trattini sembrano spaziati | Bassa | Media | Implementato e verificato localmente: numeri d’ordine senza cifre tabellari nell’elenco e nel titolo del dettaglio; formato tabellare conservato per importi e codici fiscali. |
| O10 | Ricerca senza risultati: riga tra divisori invece di una card come gli altri stati vuoti; "Ricerca: zzzz ×" e "Cancella ricerca" fanno la stessa cosa | Bassa | Alta | Implementato e verificato localmente: stato vuoto in card; con sola ricerca senza risultati resta una sola azione Cancella ricerca. |
| O11 | Fine elenco "Hai visto tutti gli ordini del periodo." anche con Periodo "Tutti" | Bassa | Alta | Implementato e verificato localmente: fine elenco distingue ordini disponibili da ordini del periodo filtrato. |
| O12 | Indicatore "Aggiornato 5 minuti fa" con icona a barre nei colori del logo; resta neutro anche quando eBay non risponde | Bassa | Alta | Implementato e verificato localmente: orologio per ultimo aggiornamento, spinner durante l’operazione e avviso ambra quando eBay non risponde. |
| O13 | Menu dell'ordine, copia (spunta nel box), dettaglio e ritorno del focus su "Dettaglio" funzionano | Positivo | Alta | Riscontro positivo conservato; regressione locale copre menu, copia e ritorno del focus dal dettaglio. |

### 5.1 Dettaglio ordine

| ID | Problema | Severità | Confidenza | Verifica implementazione · 4 ottobre 2026 |
| --- | --- | --- | --- | --- |
| D1 | Intestazione e schede non restano fisse: scorrendo resta solo la X | Bassa | Alta | Implementato e verificato localmente: intestazione fuori dall’area scorrevole e schede sticky nel contenuto. |
| D2 | Sezione "Acquirente" con prima etichetta "Acquirente"; "Destinatario" su una riga, indirizzo di fatturazione su due | Bassa | Alta | Implementato e verificato localmente: prima etichetta Nome e destinatario con nome e località su righe distinte. |
| D3 | Scheda Articoli senza miniature; "Prezzo: 524,50 €" non dice se è unitario. Con quantità e prezzi di esempio la somma (1292 €) supera il totale (1249 €) | Bassa | Media | Implementato e verificato localmente: miniatura per l’ordine a singolo articolo, segnaposto per gli articoli senza immagine propria; Prezzo unitario esplicito. Nell’esempio multiarticolo quantità × prezzi = 1249 EUR, senza alterare dati reali. |
| D4 | Aperto da URL, il pannello mostra un contorno di focus blu di 1 px su tutto il contenitore (`outline: auto`), in desktop e a 500 px | Bassa | Alta | Implementato e verificato localmente: focus iniziale sul pannello senza outline del contenitore; focus visibile conservato sui controlli. |
| D5 | "Apri su eBay" ed "Esporta ordine" esistono solo nel menu della card, non nel dettaglio | Bassa | Media | Implementato e verificato localmente: Apri su eBay ed Esporta ordine disponibili anche nel dettaglio, tramite le stesse azioni della card. |

## 6. Anteprima: Negozi eBay

| ID | Problema | Severità | Confidenza | Verifica implementazione · 4 ottobre 2026 |
| --- | --- | --- | --- | --- |
| N-H1 | Negozio in pausa nel piano Free: "Il piano Free include un solo negozio attivo. Scegli quale in Piano e pagamenti." Il testo non è un link e Piano e pagamenti del Free non ha la scelta, che esiste solo in Premium ("Negozio attivo se torni al piano Free") | Media | Alta | Non implementato. Chrome Free: rinvio a Piano e pagamenti, dove manca la scelta del negozio. |
| N-H2 | Stati contraddittori nel dettaglio: negozio in pausa o con collegamento scaduto con "Aggiornamento previsto circa ogni 30/10 minuti"; autorizzazione incompleta con "Importazione dello storico completata", sincronizzazione "Mai" e 0 ordini; negozio in pausa da 6 giorni con aggiornamenti riusciti del 27 settembre; "Autorizzazione valida fino al: Scaduta" | Media | Alta | Non implementato. Chrome: negozio in pausa/scaduto con aggiornamento previsto e storico completato. |
| N1 | La pagina dice che i negozi in pausa hanno ordini "non consultabili"; il dettaglio dice "In pausa, FiscalBay non legge nuovi ordini. Quelli già importati restano consultabili." Le due pause non sono distinte | Media | Alta | Non implementato. Chrome: consultabilità degli ordini durante la pausa ancora descritta senza distinguere le cause. |
| N2 | "Reimporta storico" resta disponibile con collegamento scaduto; "Collega negozio eBay" resta attivo quando "sincronizzazione e ricollegamento sono sospesi" | Media | Alta | Non implementato in parte verificata. Chrome: Reimporta storico attivo con collegamento scaduto; azioni dell’outage non tutte riprovate. |
| N3 | Stesso stato con colori diversi: "Autorizzazione incompleta" badge rosso, banner ambra | Bassa | Alta | Non verificato integralmente. Badge Autorizzazione incompleta visto; confronto col relativo banner non ripetuto. |
| N4 | In tabella il badge di collegamento sta circa 6 px sopra la riga di testo; l'intestazione "Ultima sincronizzazione" è 24 px a sinistra dei valori (slot icona vuoto) | Bassa | Alta | Non verificato. Tabella vista su Chrome; disallineamenti non misurati. |
| N5 | Nel dettaglio "Autorizzazione valida fino al" va su due righe e disallinea i valori della griglia; "Ordini importati: 128" usa il formato etichetta: valore diverso dal resto | Bassa | Alta | Non implementato. Chrome: etichetta Autorizzazione valida fino al su più righe e Ordini importati nel formato originale. |
| N6 | Termini diversi per lo stesso caso: banner Ordini "collegamento scaduto" con azione "Apri il negozio" e testo "Ricollega il negozio"; badge Negozi "Da ricollegare" | Bassa | Alta | Non implementato. Chrome: Collegamento scaduto nel banner e Da ricollegare nel badge. |
| N7 | Dialog "Scollega ed elimina": il titolo va a capo dopo "i"; il pannello laterale resta illuminato sotto la modale | Bassa | Alta | Non verificato. Conferma di scollegamento/eliminazione non aperta in questa ripresa. |
| N8 | "contatta l'assistenza" nei banner dei negozi non è un link | Bassa | Alta | Non verificato su Chrome. Banner di supporto pertinente non aperto; nessun nuovo OAuth eseguito. |
| N9 | Conferma di "Scollega ed elimina dati" digitando il nome del negozio, con bottone disabilitato finché non coincide | Positivo | Alta | Riscontro positivo dell’audit originale; nessuna correzione da implementare. Non riconfermato integralmente in questa ripresa. |

## 7. Anteprima: Impostazioni

| ID | Problema | Severità | Confidenza | Verifica implementazione · 4 ottobre 2026 |
| --- | --- | --- | --- | --- |
| I-H1 | Con "Invia notifiche degli ordini" spento, Quali ordini, Frequenza e Negozi restano attivi e invariati | Media | Alta | Non implementato. Chrome Premium: switch spento dopo il retry, radio Tutti i nuovi ordini ancora abilitato. |
| I1 | Scrollspy in ritardo: "Sicurezza" attiva mentre si legge Aspetto e lingua, "Modello di messaggio" con Dati e privacy in vista | Bassa | Alta | Non implementato nel caso osservato. Chrome: Sicurezza evidenziata mentre Aspetto e lingua è in vista. |
| I2 | Piano: tre card prezzo con "Scegli" identico, nessuna evidenza; "Passa a Premium" è un titolo, poi un link sottolineato in Notifiche, poi "Scopri Premium" nei banner | Bassa | Alta | Non implementato. Chrome Free: tre Scegli identici e richiami Premium nei formati originali. |
| I3 | "Fuso orario" mostra l'ID grezzo "Europe/Rome" | Bassa | Alta | Non implementato. Chrome: Europe/Rome ancora mostrato come ID grezzo. |
| I4 | Dati e privacy: il bottone "Informativa privacy" ripete il titolo della riga; il dialog di eliminazione ripete il testo della riga e conferma con un generico "Continua" | Bassa | Alta | Non verificato integralmente. Chrome: Informativa privacy ripetuta; dialog di eliminazione non aperto. |
| I5 | Supporto: "Puoi scrivere anche a supporto@fiscalbay.it." non è un link; messaggio senza segnaposto | Bassa | Alta | Non implementato. Chrome: supporto come testo e Messaggio senza segnaposto. |
| I6 | Tema: "Nell'anteprima la scelta vale fino alla chiusura della pagina." In pratica si perde a ogni ricarica completa | Bassa | Alta | Non implementato nel testo. Chrome conserva «fino alla chiusura della pagina»; persistenza attraverso ricarica non riprovata. |
| I7 | Ridondanze: "Premium annuale" più badge "Premium"; "Consulta ricevute e fatture su Stripe" più "Ricevute e fatture sono disponibili su Stripe." | Bassa | Alta | Non implementato. Chrome Premium e lifetime: badge ridondante e doppio testo su ricevute/fatture. |
| I8 | Errore di salvataggio in linea chiaro: "Modifica non salvata. L'impostazione è tornata com'era: riprova." Il salvataggio riuscito è silenzioso | Positivo | Alta | Positivo riconfermato. Chrome Premium: primo salvataggio simulato fallisce e ripristina il controllo. |

## 8. Anteprima: Profilo

| ID | Problema | Severità | Confidenza | Verifica implementazione · 4 ottobre 2026 |
| --- | --- | --- | --- | --- |
| P1 | Campo unico "Nome" facoltativo (T2) | Media | Alta | Non implementato. Chrome: Nome unico facoltativo. Stesso problema di T2. |
| P2 | Colonna centrata di 672 px e avatar al posto del tile icona: unica pagina con questa impaginazione | Bassa | Alta | Scelta confermata. Profilo centrato approvato dall’owner e documentato; nessuna correzione richiesta. Chrome e design system. |
| P3 | Email ripetuta sotto il titolo e nella card Email; "Apri Sicurezza" ghost accanto a "Cambia email" outline | Bassa | Alta | Non implementato. Chrome: email ripetuta e Apri Sicurezza/Cambia email con stili diversi. |

## 9. Scenari del selettore

| ID | Scenario | Problema | Severità | Confidenza | Verifica implementazione · 4 ottobre 2026 |
| --- | --- | --- | --- | --- | --- |
| SC1 | Ordini da sbloccare esauriti | Banner ambra con icona d'avviso per un limite normale del piano; card "Sblocco disponibile dal 2 ott 2026." senza ora, banner "fino al 2 ott 2026, 14:20" | Bassa | Alta | Non implementato. Chrome: limite con banner di avviso, data senza ora nella card e con ora nel banner. |
| SC2 | Aggiornamento in corso | I due ordini nuovi in cima non hanno segno di novità; il contatore resta "12 ordini" | Bassa | Media | Non implementato. Chrome: nuovi ordini senza segno di novità, contatore ancora 12. |
| SC3 | eBay non risponde | Banner su due righe in Ordini, su una in Negozi; vedi N2 e O12 | Bassa | Alta | Non verificato integralmente. Scenario eBay non risponde visto in Ordini; confronto delle righe con Negozi non ripetuto. |
| SC4 | Problema su un negozio | Vedi N-H2, N3, N6, N8 | Media | Alta | Non implementato in parte verificata. Chrome: restano N-H2 e N6; N3 e N8 non qualificati integralmente. |
| SC5 | Dati discordanti | Omocodia spiegata con "Il nome non permette un controllo univoco del codice."; tipo estero ("Steuernummer (DE)") chiaro | Bassa | Media | Non verificato integralmente. Scenario Dati discordanti visto; dettaglio della spiegazione di omocodia non riprovato. |
| SC6 | Primo accesso | "Codici / Fiscali" spezzato a fine riga; terzo destro della card vuoto; diverso dall'app reale (T1) | Bassa | Alta | Parziale. Chrome: card del primo accesso centrata e Codici Fiscali non separabile; differenze con primi passi reali restano a M4-07/T1. |
| SC7 | Importazione iniziale | "4 ordini" e "Importazione in corso: 4 ordini finora" ripetono il numero | Bassa | Alta | Non implementato. Chrome: 4 ordini ripetuto nel sottotitolo e nello stato di importazione. |
| SC8 | Nessun ordine | Senza sottotitolo l'indicatore "Aggiornato" scende 12 px sotto la linea del titolo; "5 minuti fa" e "aggiornato al 27 set 2026, 14:55" nella stessa vista | Bassa | Alta | Non implementato in parte verificata. Chrome: tempi relativo/assoluto insieme; disallineamento non misurato. |
| SC9 | Caricamento | Scheletro solo in Ordini; Negozi e Impostazioni mostrano dati. I filtri dello scheletro sono larghi 248 px, quelli reali 160 | Bassa | Alta | Parziale. Skeleton rivisto nelle PR precedenti; Chrome: scenario Caricamento verificato in Ordini. Altre superfici non qualificate come caricamento. |
| SC10 | Premium, più negozi | Vedi I-H1, I7, N4 | Media | Alta | Non implementato. Chrome Premium: restano I-H1 e I7; N4 non misurato. |
| SC11 | Premium a vita | Vedi I7 | Bassa | Alta | Non implementato. Chrome lifetime: restano le ridondanze di I7. |
| SC12 | Tutti | Cambiare scenario azzera sblocchi e stato simulato; la descrizione nella barra cresce fino a tre righe | Positivo | Alta | Riscontro positivo dell’audit originale; nessuna correzione da implementare. Non riconfermato integralmente in questa ripresa. |

## 10. Responsive

| ID | Problema | Severità | Confidenza | Verifica implementazione · 4 ottobre 2026 |
| --- | --- | --- | --- | --- |
| RW1 | A 1200 e 1024 px i sei filtri (scenari con più negozi) vanno su due righe da tre, con select da 334 e 281 px; "Seleziona" resta solo in basso a destra e in alto a destra resta un vuoto | Media | Alta | Non verificato. Nuova prova a 1200/1024 px non eseguita. |
| RW2 | A 500 px "Filtri" espande sei select impilate, circa 450 px prima del primo ordine, senza conteggio né azzeramento | Bassa | Alta | Non implementato. Chrome a 390 px: sei filtri impilati, senza conteggio o azzeramento. |
| RW3 | A 500 px la barra dell'anteprima perde la frase "Qui le azioni sono simulate e usano dati di esempio." | Bassa | Alta | Implementato. Chrome con viewport effettivo 390×844: nota sulle azioni simulate visibile. PR #255. |
| RW4 | A 500 px barra di navigazione in basso, Impostazioni come elenco di sottopagine, Negozi come elenco, dettaglio a tutta larghezza, senza scorrimento orizzontale | Positivo | Alta | Riscontro positivo dell’audit originale; nessuna correzione da implementare. Non riconfermato integralmente in questa ripresa. |

## 11. Inglese

| ID | Problema | Severità | Confidenza | Verifica implementazione · 4 ottobre 2026 |
| --- | --- | --- | --- | --- |
| EN1 | Etichette "Codice Fiscale" e "Partita IVA" senza spiegazione, mentre i testi dicono "tax code" e "VAT number" ("When eBay does not provide the tax code", "We could not get the tax code"). Il titolo dell'accesso è "The Codice Fiscale of your eBay orders" | Media | Alta | Non implementato. Chrome EN: Codice Fiscale/Partita IVA ancora nelle etichette, tax code nel testo. |
| EN2 | "{ordine} is replaced with the order number": segnaposto italiano nell'interfaccia inglese | Bassa | Alta | Non implementato. Chrome EN: spiegazione ancora con {ordine}. |
| EN3 | Grafia britannica ("Authorisation valid until") con date nel formato statunitense ("Sep 27, 2026, 2:22 PM") | Bassa | Alta | Implementato. Chrome EN: 27 Sep 2026, 14:22; locale en-GB nel codice. PR #254. |
| EN4 | Gli URL restano italiani (`/en/anteprima/ordini`) | Bassa | Alta | Non implementato. Chrome EN: URL ancora con segmenti italiani. |
| EN5 | Nessun testo d'interfaccia italiano residuo, a parte dati di esempio e modello di messaggio italiano. Alcune frasi sono più chiare dell'italiano: "You have 2 orders left to unlock. After this one, you will have 1." | Positivo | Alta | Riscontro positivo dell’audit originale; nessuna correzione da implementare. Non riconfermato integralmente in questa ripresa. |

## 12. Tema chiaro e scuro

- Entrambi i temi sono coerenti nei token e nei contrasti (T16). Non sono
  emersi testi illeggibili.
- Il toast è chiaro in scuro e blu notte in chiaro: inversione coerente.
- In scuro i tile chiari delle miniature di esempio abbagliano (O7).
- In chiaro la barra dell'anteprima si distingue poco dallo sfondo.
- I problemi specifici di tema sono A3, D4 e O7.

## 13. Stato dopo i test

L'anteprima è tornata allo scenario "Free, uso ordinario" con 3 ordini su 5
sbloccati, valori iniziali riletti in Impostazioni. Il tema non ha override.
Restano queste tracce:

- **Sessione Chrome:** l'account senza negozio usato all'inizio è uscito.
  Ora Chrome è collegato con info@, autenticato dall'owner. Il rientro con il
  primo account richiede la sua password.
- **Email:** un link di cambio password inviato all'indirizzo del primo
  account, mai usato; la password non è cambiata.
- **OAuth:** un'autorizzazione eBay per il collegamento del negozio, rifiutata
  dall'app perché il negozio è di un altro account; un'autorizzazione Google
  per il collegamento come metodo di accesso, rifiutata per lo stesso motivo.
  Nessun collegamento creato.
- **Anteprima:** sblocchi, esportazioni e interruttori simulati, azzerati dal
  cambio di scenario.
- **Nessuna rimozione** di metodi di accesso o sessioni, nessuna passkey
  aggiunta o tolta, nessun dato reale riportato in questo documento.

## 14. Non verificato

- **Area admin:** info@ non ha `user.admin` sul test e `/admin` risponde 404;
  la conferma con passkey e la pagina concessa non sono state viste.
- **Rimozione dei metodi, "Esci" e "Esci da tutti gli altri dispositivi"
  reali:** non eseguiti per non togliere accessi o chiudere la sessione di
  un'altra prova in corso; R-H1 viene dal codice.
- **Passkey:** "Aggiungi passkey" e "Accedi con passkey" aprono il dialogo del
  sistema operativo, non visibile negli screenshot.
- **Stripe:** l'app reale non ha bottoni verso il checkout; nell'anteprima
  "Scegli" e "Gestisci abbonamento" sono simulati.
- **Larghezze reali:** la finestra di Chrome non si ridimensiona; 1200, 1024 e
  500 px sono stati provati con un iframe della stessa origine. 390 px non
  provati.
- **Invio del supporto, esportazione dei dati dell'account e salvataggio del
  modello:** simulati nell'anteprima, non provati sull'app reale, che non li
  espone.

## 15. Correzioni verificate

### Struttura dell'app e coerenza con l'anteprima

Correzioni della PR #255 (`a9efe04` su `develop`), distribuita sul test il
4 ottobre 2026. Prima di registrarle le ho verificate su Chrome live, su
`test.fiscalbay.it`, con la sessione di info@: pagina reale in IT ed EN, tema
scuro a 1440 px, tema chiaro a 500 px; anteprima a 1440 px e, con un iframe
della stessa origine, a 496 px. Non ho eseguito azioni reali di Sicurezza
(cambio password, rimozioni, uscite) per non modificare l'account.

| ID | Esito | Verifica su Chrome live | Verifica implementazione · 4 ottobre 2026 |
| --- | --- | --- | --- |
| R-B1 | Corretto. La pagina reale usa la shell dell'anteprima: logo e menu dell'avatar con Sicurezza, lingua ed Esci al posto di pillola, link e pulsante. Sicurezza ha una pagina propria su `/impostazioni/sicurezza` e `/en/impostazioni/sicurezza`, fuori da Ordini | Ordini con il solo ordine e «Collega negozio eBay» nella riga del titolo; menu con «Mario Prova», info@, Sicurezza, English, Esci; pagina Sicurezza con Email, Metodi di accesso e passkey; nessuno scorrimento orizzontale a 500 px | Implementato. Chrome: Ordini separato da Sicurezza, logo e menu account condivisi. PR #255. |
| T1 | Corretto in parte: header, collocazione di Sicurezza e stato vuoto del primo accesso ora coincidono con l'anteprima. Restano per scelta: navigazione, ricerca, campanella e «Visita fiscalbay.it» finché le funzioni reali non esistono; card degli ordini (R-H2); conferma e accesso recente in Sicurezza (R-H1, R-H3); testo del negozio già collegato nell'anteprima (N8) | Header e Sicurezza come sopra. Lo stato vuoto reale non è visibile con info@, che ha un ordine: verificato solo in locale, con D1 locale e utente sintetico | Parziale. Chrome: shell e Sicurezza separate; card reale ancora incompleta. Navigazione e primi passi restano ai task aperti. |
| SC6 | Corretto. Illustrazione e testo centrati insieme nella card, senza il terzo destro vuoto; «Codici Fiscali» non va più a capo a metà | Scenario «Primo accesso» a 1440 px. Lo scenario è stato poi riportato a «Free, uso ordinario» | Parziale. Chrome: card del primo accesso centrata e Codici Fiscali non separabile; differenze con primi passi reali restano a M4-07/T1. |
| RW3 | Corretto. Sotto 768 px la barra dell'anteprima mostra «Qui le azioni sono simulate e usano dati di esempio.»; la descrizione dello scenario resta da 768 px | Iframe di 496 px: nota visibile, descrizione nascosta | Implementato. Chrome con viewport effettivo 390×844: nota sulle azioni simulate visibile. PR #255. |
| R-B6 | Non corretto, per scelta approvata: l'app reale segue il tema di sistema finché le Impostazioni non salveranno la scelta | Non applicabile | Rinviato. Nessun selettore nell’app reale su Chrome; tema di sistema fino a M4-06, come decisione approvata. |
| P2 | Nessuna modifica: Profilo centrato confermato dalla decisione già approvata e documentata nel design system | Non applicabile | Scelta confermata. Profilo centrato approvato dall’owner e documentato; nessuna correzione richiesta. Chrome e design system. |

Emerso durante le correzioni e corretto nella stessa PR: con la navigazione
nel browser, dopo l'uscita da `/en` o tornando a `/en` dal logo, la pagina
compariva in italiano con titolo inglese, perché la richiesta dei dati
`/en.data` era letta come italiano. Verificato su Chrome live: da
`/en/impostazioni/sicurezza` il logo porta a `/en` con `lang="en"`, «Orders»
e sottotitolo inglese.
