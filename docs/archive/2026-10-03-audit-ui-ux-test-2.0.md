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

## 2. Priorità

| ID | Problema | Severità | Confidenza |
| --- | --- | --- | --- |
| R-H1 | "Rimuovi" su un metodo di accesso agisce al primo clic, senza conferma | Alta | Alta |
| R-H2 | La card dell'ordine reale mostra solo numero, data e importo: nessuno stato del Codice Fiscale | Alta | Alta |
| R-H3 | Con sessione non recente "Collega", "Rimuovi" e "Cambia email" sembrano attivi e falliscono solo dopo il clic | Media | Alta |
| T1 | L'anteprima non rappresenta l'app reale: header, card ordini, stato vuoto, Sicurezza e messaggi diversi | Media | Alta |
| T2 | "Nome" facoltativo nel Profilo, Nome e Cognome obbligatori alla registrazione | Media | Alta |
| N-H1 | Negozio in pausa nel piano Free: "Scegli quale in Piano e pagamenti" porta a una sezione senza scelta | Media | Alta |
| T3 | Toast sotto l'oscuramento dei pannelli e sopra la barra di selezione | Media | Alta |
| N-H2 | Stati dei negozi contraddittori: aggiornamenti "previsti" con sincronizzazione sospesa, storico "completato" mai sincronizzato | Media | Alta |
| I-H1 | Notifiche Telegram spente: le opzioni dipendenti restano attive | Media | Alta |

## 3. Problemi trasversali

| ID | Problema | Severità | Confidenza |
| --- | --- | --- | --- |
| T1 | Anteprima e app reale divergono. Header: nav, ricerca, campanella e avatar contro "Italiano / English / Sicurezza / Esci". Ordini: card ricche contro card con numero e importo. Primo accesso: illustrazione e primi passi contro card "Nessun ordine". Sicurezza: gruppo Email in Profilo e "Email e password" senza "Rimuovi" contro gruppo Email in pagina e "Rimuovi". Negozio già collegato: titolo e "Accedi con quell'account oppure contatta l'assistenza" contro "Contatta il supporto: supporto@". Le decisioni prese sull'anteprima non valgono per ciò che l'utente vede | Media | Alta |
| T2 | Il Profilo dice "Facoltativo. Compare nelle email di servizio." per un campo unico "Nome"; la registrazione rende obbligatori Nome e Cognome (`required`) e, per Azienda, Ragione sociale, che il Profilo non mostra | Media | Alta |
| T3 | I toast compaiono centrati in basso con z-index inferiore all'overlay dei pannelli laterali: con un pannello aperto restano attenuati ("Anteprima: l'azione è simulata." dopo "Ricollega negozio" e "Metti in pausa"). Con la barra di selezione aperta il toast (y 610) la copre per 4,5 s. Il nodo del toast non ha `role` né `aria-live` | Media | Alta |
| T4 | Larghezze e allineamenti di pagina incoerenti: Ordini e Negozi a 1152 px allineati a sinistra; Impostazioni finisce a 1192 px mentre l'header arriva a 1296; Profilo colonna centrata di 672 px; app reale con card da 448 e 576 px e banner da 1152 | Media | Alta |
| T5 | Tile delle icone in molti toni senza regola: titolo Ordini blu-grigio, Impostazioni grigio, Negozi verde acqua; nel dettaglio negozio cinque colori (blu, verde, viola, ambra, verde acqua); funzioni della pagina di accesso blu, ambra, verde acqua | Media | Alta |
| T6 | Lo stesso cerchio tratteggiato indica "Non disponibile su eBay" (sembra uno spinner di caricamento), la notifica "Nuovo accesso" e "In pausa per il piano Free" | Media | Alta |
| T7 | Colori di stato usati per dati neutri: avatar dei negozi rosati o rossi ("OR", "BR"), puntino e miniatura rossi per il negozio Outlet, barra rossa nell'illustrazione di "Nessun ordine": sembrano errori | Bassa | Media |
| T8 | Quattro stili per le azioni distruttive: outline neutro ("Rimuovi"), ghost rosso rientrato di 13 px ("Esci da tutti gli altri dispositivi", "Elimina account", "Scollega"), bottone rosso pieno nelle conferme, `variant="destructive"` nell'app reale | Media | Alta |
| T9 | Azioni secondarie in tre stili: outline ("Cambia email", "Scegli"), ghost senza bordo ("Carica altri", "Apri Sicurezza", "Apri il negozio", "Cancella ricerca"), link sottolineato ("Passa a Premium", "Scopri Premium") | Bassa | Alta |
| T10 | Scala tipografica dei controlli: bottoni piccoli a 12,8 px (0,8 rem), testo a 14 px, note a 12 px ("Serve almeno un metodo di accesso.", "Prezzi IVA esclusa..."); titoli delle card a 16 px in Profilo e app reale, 20 px in Impostazioni; righe di Sicurezza a 14 px nell'app reale e 16 px nell'anteprima | Bassa | Alta |
| T11 | Due selettori di lingua diversi: pillola piena più testo semplice nell'header reale e nella pagina di accesso, segmentato con bordo in Impostazioni. I nomi delle lingue cambiano: "English" in Lingua, "Inglese" nelle schede del Modello di messaggio | Bassa | Alta |
| T12 | Validazione dei moduli affidata al fumetto nativo del browser ("Compila questo campo.", "Aggiungi un simbolo @"), senza stile d'errore né `aria-invalid`; i campi obbligatori non sono marcati mentre "Facoltativo" sì | Bassa | Alta |
| T13 | Banner di esito con raggio 8 px e padding 10/8 px, contro card a 14 px e 16 px; l'esito resta nell'URL (`?accesso=...`) e ricompare alla ricarica | Bassa | Alta |
| T14 | Terminologia della quota mista: "Hai ancora 2 ordini disponibili" (quota), "Ti resta 1 ordine da sbloccare" (quota), "Nessun ordine da sbloccare" (ordini bloccati tra i selezionati), "Nessun ordine da sbloccare rimasto in questo ciclo" (quota). In italiano anche "dopo lo sblocco ne resteranno 0" | Media | Alta |
| T15 | FAQ con il triangolo nativo del browser, unico controllo non disegnato del prodotto | Bassa | Alta |
| T16 | Contrasti dei token adeguati: testo secondario 6,2:1 in chiaro e 7,9:1 in scuro su card; bottone primario 7,7:1 e 5,3:1; bordo dei campi 3,05:1 in chiaro | Positivo | Alta |

## 4. App reale

### 4.1 Ordini e Sicurezza

| ID | Problema | Severità | Confidenza |
| --- | --- | --- | --- |
| R-H1 | "Rimuovi" per Email e password, Google, eBay e passkey è un submit diretto (`rimuovi-metodo` in `app/routes/sign-in.ts`): con accesso recente il metodo sparisce al primo clic. Unico freno è "Serve almeno un metodo di accesso". Non eseguito per non togliere metodi reali | Alta | Alta |
| R-H2 | La card dell'ordine importato contiene numero (senza "Ordine"), data e importo. Mancano stato, negozio, articoli, acquirente e soprattutto lo stato del Codice Fiscale: senza identificativo non c'è "Non disponibile su eBay" né altra spiegazione, e la card non apre un dettaglio | Alta | Alta |
| R-H3 | Con sessione più vecchia di 24 ore "Collega" (eBay), "Rimuovi" e "Cambia email" restano attivi; dopo il clic compare "Per questa modifica serve un accesso recente: esci e accedi di nuovo a FiscalBay." senza un'azione per farlo | Media | Alta |
| R-B1 | La pagina si chiama "Ordini" ma contiene anche la card Sicurezza; header con tre stili (pillola lingua, link "Sicurezza" sottolineato, bottone "Esci" con bordo) | Media | Alta |
| R-B2 | "Cambia password" risponde "Ti abbiamo inviato un link per scegliere la password": "scegliere" per un cambio | Bassa | Alta |
| R-B3 | Dopo un invio il focus torna al body, non al banner di esito né al controllo usato | Bassa | Alta |
| R-B4 | Riga Passkey: la descrizione va a capo a circa 330 px ("del / dispositivo.") per il bottone a destra, mentre le altre righe usano tutta la larghezza | Bassa | Alta |
| R-B5 | L'ultima sessione ha un divisore sotto di sé e poi 16 px prima del bordo della card | Bassa | Alta |
| R-B6 | Nessun selettore del tema nell'app reale: esiste solo nelle Impostazioni dell'anteprima | Bassa | Alta |
| R-B7 | Il campo "Nuova email" ha un anello di focus di 3 px molto marcato rispetto al resto | Bassa | Media |
| R-P1 | "Collega negozio eBay" completa l'OAuth senza schermata quando il consenso esiste e torna con "Questo negozio eBay è già collegato a un altro account FiscalBay. Contatta il supporto: supporto@fiscalbay.it" | Positivo | Alta |
| R-P2 | "Cambia email" apre il campo in linea e "Annulla" riporta il focus sul bottone | Positivo | Alta |

### 4.2 Pagina di accesso

| ID | Problema | Severità | Confidenza |
| --- | --- | --- | --- |
| A1 | La colonna del marchio si ricentra in verticale a ogni cambio di scheda o di tipo: il titolo passa da y 206 (Accedi) a 322 (Crea account, Privato) e 364 (Azienda) | Media | Alta |
| A2 | "Continua con Google" ha il logo, "Continua con eBay" no | Bassa | Alta |
| A3 | In scuro la scheda attiva del segmentato è più scura del contenitore e sembra incassata | Bassa | Media |
| A4 | Spaziature irregolari: "Hai dimenticato la password?" 40 px sotto "Accedi"; passkey staccata di 20 px contro 8 px tra Google ed eBay. A 1440 x 666 la card supera la finestra e "Accedi con passkey" richiede scroll | Bassa | Alta |
| A5 | Nel recupero password il link di ritorno si chiama "Accedi" come la scheda e il bottone; sotto restano social e passkey | Bassa | Alta |
| A6 | A 500 px logo a 18 px dal bordo, titolo e card a 26 px; l'app usa 16 px | Bassa | Alta |
| A7 | Nessun collegamento a Termini e Privacy nella scheda Accedi; compaiono solo nella casella della registrazione | Bassa | Media |

### 4.3 Pagine standalone

| ID | Problema | Severità | Confidenza |
| --- | --- | --- | --- |
| S1 | Termini e Privacy sono segnaposto: "Bozza · Versione bozza-2026-09-28" ripete "bozza" e mostra uno slug; l'unico ritorno è il logo | Media | Alta |
| S2 | Logo staccato di circa 200 px sopra la card centrata in tutte le pagine standalone | Bassa | Alta |
| S3 | Testi ripetuti: "Pagina non trovata" / "La pagina richiesta non è stata trovata."; in "Accesso non completato" "contatta il supporto" nel testo e subito dopo nel link | Bassa | Alta |
| S4 | "Account già collegato: Questo account è già collegato a un altro utente FiscalBay." non dice che l'account è quello Google appena usato | Bassa | Alta |
| S5 | `/admin` per chi non è admin risponde come un indirizzo inesistente, come previsto dal codice | Positivo | Alta |

## 5. Anteprima: Ordini

| ID | Problema | Severità | Confidenza |
| --- | --- | --- | --- |
| O1 | "Non disponibile su eBay" usa il cerchio tratteggiato che sembra un caricamento (T6) | Media | Alta |
| O2 | Un Codice Fiscale "Da verificare" sta nello stesso box blu con copia dei codici validi: l'avviso è solo nella riga sotto | Media | Media |
| O3 | "Riprova" mostra il toast "Nuova lettura richiesta." ma la card resta su "Aggiornamento non riuscito", senza stato in corso | Media | Alta |
| O4 | "Sblocca ordine" consuma la quota al primo clic; il testo sotto avvisa del consumo, manca una conferma o un annulla | Bassa | Alta |
| O5 | Barra di selezione: "Sblocca 0" primario blu pieno anche se disabilitato; dopo "Annulla" il focus va al body invece che su "Seleziona" | Bassa | Alta |
| O6 | Select Periodo: il menu si allinea sull'opzione corrente, è più largo del campo e copre metà di "Pagamento"; "Ultimi 90 giorni" disabilitato con corona viola, senza spiegazione | Bassa | Alta |
| O7 | Miniature in tre stili (icona su tile scuro, quadrato grigio chiaro che sembra un'immagine rotta, quadrato beige); in scuro i tile chiari abbagliano. Dipende dai dati di esempio | Bassa | Media |
| O8 | Acquirente su una riga centrato sul box del codice, su due righe allineato in alto: le basi cambiano tra card vicine | Bassa | Alta |
| O9 | Numeri d'ordine con `tabular-nums`: i trattini sembrano spaziati | Bassa | Media |
| O10 | Ricerca senza risultati: riga tra divisori invece di una card come gli altri stati vuoti; "Ricerca: zzzz ×" e "Cancella ricerca" fanno la stessa cosa | Bassa | Alta |
| O11 | Fine elenco "Hai visto tutti gli ordini del periodo." anche con Periodo "Tutti" | Bassa | Alta |
| O12 | Indicatore "Aggiornato 5 minuti fa" con icona a barre nei colori del logo; resta neutro anche quando eBay non risponde | Bassa | Alta |
| O13 | Menu dell'ordine, copia (spunta nel box), dettaglio e ritorno del focus su "Dettaglio" funzionano | Positivo | Alta |

### 5.1 Dettaglio ordine

| ID | Problema | Severità | Confidenza |
| --- | --- | --- | --- |
| D1 | Intestazione e schede non restano fisse: scorrendo resta solo la X | Bassa | Alta |
| D2 | Sezione "Acquirente" con prima etichetta "Acquirente"; "Destinatario" su una riga, indirizzo di fatturazione su due | Bassa | Alta |
| D3 | Scheda Articoli senza miniature; "Prezzo: 524,50 €" non dice se è unitario. Con quantità e prezzi di esempio la somma (1292 €) supera il totale (1249 €) | Bassa | Media |
| D4 | Aperto da URL, il pannello mostra un contorno di focus blu di 1 px su tutto il contenitore (`outline: auto`), in desktop e a 500 px | Bassa | Alta |
| D5 | "Apri su eBay" ed "Esporta ordine" esistono solo nel menu della card, non nel dettaglio | Bassa | Media |

## 6. Anteprima: Negozi eBay

| ID | Problema | Severità | Confidenza |
| --- | --- | --- | --- |
| N-H1 | Negozio in pausa nel piano Free: "Il piano Free include un solo negozio attivo. Scegli quale in Piano e pagamenti." Il testo non è un link e Piano e pagamenti del Free non ha la scelta, che esiste solo in Premium ("Negozio attivo se torni al piano Free") | Media | Alta |
| N-H2 | Stati contraddittori nel dettaglio: negozio in pausa o con collegamento scaduto con "Aggiornamento previsto circa ogni 30/10 minuti"; autorizzazione incompleta con "Importazione dello storico completata", sincronizzazione "Mai" e 0 ordini; negozio in pausa da 6 giorni con aggiornamenti riusciti del 27 settembre; "Autorizzazione valida fino al: Scaduta" | Media | Alta |
| N1 | La pagina dice che i negozi in pausa hanno ordini "non consultabili"; il dettaglio dice "In pausa, FiscalBay non legge nuovi ordini. Quelli già importati restano consultabili." Le due pause non sono distinte | Media | Alta |
| N2 | "Reimporta storico" resta disponibile con collegamento scaduto; "Collega negozio eBay" resta attivo quando "sincronizzazione e ricollegamento sono sospesi" | Media | Alta |
| N3 | Stesso stato con colori diversi: "Autorizzazione incompleta" badge rosso, banner ambra | Bassa | Alta |
| N4 | In tabella il badge di collegamento sta circa 6 px sopra la riga di testo; l'intestazione "Ultima sincronizzazione" è 24 px a sinistra dei valori (slot icona vuoto) | Bassa | Alta |
| N5 | Nel dettaglio "Autorizzazione valida fino al" va su due righe e disallinea i valori della griglia; "Ordini importati: 128" usa il formato etichetta: valore diverso dal resto | Bassa | Alta |
| N6 | Termini diversi per lo stesso caso: banner Ordini "collegamento scaduto" con azione "Apri il negozio" e testo "Ricollega il negozio"; badge Negozi "Da ricollegare" | Bassa | Alta |
| N7 | Dialog "Scollega ed elimina": il titolo va a capo dopo "i"; il pannello laterale resta illuminato sotto la modale | Bassa | Alta |
| N8 | "contatta l'assistenza" nei banner dei negozi non è un link | Bassa | Alta |
| N9 | Conferma di "Scollega ed elimina dati" digitando il nome del negozio, con bottone disabilitato finché non coincide | Positivo | Alta |

## 7. Anteprima: Impostazioni

| ID | Problema | Severità | Confidenza |
| --- | --- | --- | --- |
| I-H1 | Con "Invia notifiche degli ordini" spento, Quali ordini, Frequenza e Negozi restano attivi e invariati | Media | Alta |
| I1 | Scrollspy in ritardo: "Sicurezza" attiva mentre si legge Aspetto e lingua, "Modello di messaggio" con Dati e privacy in vista | Bassa | Alta |
| I2 | Piano: tre card prezzo con "Scegli" identico, nessuna evidenza; "Passa a Premium" è un titolo, poi un link sottolineato in Notifiche, poi "Scopri Premium" nei banner | Bassa | Alta |
| I3 | "Fuso orario" mostra l'ID grezzo "Europe/Rome" | Bassa | Alta |
| I4 | Dati e privacy: il bottone "Informativa privacy" ripete il titolo della riga; il dialog di eliminazione ripete il testo della riga e conferma con un generico "Continua" | Bassa | Alta |
| I5 | Supporto: "Puoi scrivere anche a supporto@fiscalbay.it." non è un link; messaggio senza segnaposto | Bassa | Alta |
| I6 | Tema: "Nell'anteprima la scelta vale fino alla chiusura della pagina." In pratica si perde a ogni ricarica completa | Bassa | Alta |
| I7 | Ridondanze: "Premium annuale" più badge "Premium"; "Consulta ricevute e fatture su Stripe" più "Ricevute e fatture sono disponibili su Stripe." | Bassa | Alta |
| I8 | Errore di salvataggio in linea chiaro: "Modifica non salvata. L'impostazione è tornata com'era: riprova." Il salvataggio riuscito è silenzioso | Positivo | Alta |

## 8. Anteprima: Profilo

| ID | Problema | Severità | Confidenza |
| --- | --- | --- | --- |
| P1 | Campo unico "Nome" facoltativo (T2) | Media | Alta |
| P2 | Colonna centrata di 672 px e avatar al posto del tile icona: unica pagina con questa impaginazione | Bassa | Alta |
| P3 | Email ripetuta sotto il titolo e nella card Email; "Apri Sicurezza" ghost accanto a "Cambia email" outline | Bassa | Alta |

## 9. Scenari del selettore

| ID | Scenario | Problema | Severità | Confidenza |
| --- | --- | --- | --- | --- |
| SC1 | Ordini da sbloccare esauriti | Banner ambra con icona d'avviso per un limite normale del piano; card "Sblocco disponibile dal 2 ott 2026." senza ora, banner "fino al 2 ott 2026, 14:20" | Bassa | Alta |
| SC2 | Aggiornamento in corso | I due ordini nuovi in cima non hanno segno di novità; il contatore resta "12 ordini" | Bassa | Media |
| SC3 | eBay non risponde | Banner su due righe in Ordini, su una in Negozi; vedi N2 e O12 | Bassa | Alta |
| SC4 | Problema su un negozio | Vedi N-H2, N3, N6, N8 | Media | Alta |
| SC5 | Dati discordanti | Omocodia spiegata con "Il nome non permette un controllo univoco del codice."; tipo estero ("Steuernummer (DE)") chiaro | Bassa | Media |
| SC6 | Primo accesso | "Codici / Fiscali" spezzato a fine riga; terzo destro della card vuoto; diverso dall'app reale (T1) | Bassa | Alta |
| SC7 | Importazione iniziale | "4 ordini" e "Importazione in corso: 4 ordini finora" ripetono il numero | Bassa | Alta |
| SC8 | Nessun ordine | Senza sottotitolo l'indicatore "Aggiornato" scende 12 px sotto la linea del titolo; "5 minuti fa" e "aggiornato al 27 set 2026, 14:55" nella stessa vista | Bassa | Alta |
| SC9 | Caricamento | Scheletro solo in Ordini; Negozi e Impostazioni mostrano dati. I filtri dello scheletro sono larghi 248 px, quelli reali 160 | Bassa | Alta |
| SC10 | Premium, più negozi | Vedi I-H1, I7, N4 | Media | Alta |
| SC11 | Premium a vita | Vedi I7 | Bassa | Alta |
| SC12 | Tutti | Cambiare scenario azzera sblocchi e stato simulato; la descrizione nella barra cresce fino a tre righe | Positivo | Alta |

## 10. Responsive

| ID | Problema | Severità | Confidenza |
| --- | --- | --- | --- |
| RW1 | A 1200 e 1024 px i sei filtri (scenari con più negozi) vanno su due righe da tre, con select da 334 e 281 px; "Seleziona" resta solo in basso a destra e in alto a destra resta un vuoto | Media | Alta |
| RW2 | A 500 px "Filtri" espande sei select impilate, circa 450 px prima del primo ordine, senza conteggio né azzeramento | Bassa | Alta |
| RW3 | A 500 px la barra dell'anteprima perde la frase "Qui le azioni sono simulate e usano dati di esempio." | Bassa | Alta |
| RW4 | A 500 px barra di navigazione in basso, Impostazioni come elenco di sottopagine, Negozi come elenco, dettaglio a tutta larghezza, senza scorrimento orizzontale | Positivo | Alta |

## 11. Inglese

| ID | Problema | Severità | Confidenza |
| --- | --- | --- | --- |
| EN1 | Etichette "Codice Fiscale" e "Partita IVA" senza spiegazione, mentre i testi dicono "tax code" e "VAT number" ("When eBay does not provide the tax code", "We could not get the tax code"). Il titolo dell'accesso è "The Codice Fiscale of your eBay orders" | Media | Alta |
| EN2 | "{ordine} is replaced with the order number": segnaposto italiano nell'interfaccia inglese | Bassa | Alta |
| EN3 | Grafia britannica ("Authorisation valid until") con date nel formato statunitense ("Sep 27, 2026, 2:22 PM") | Bassa | Alta |
| EN4 | Gli URL restano italiani (`/en/anteprima/ordini`) | Bassa | Alta |
| EN5 | Nessun testo d'interfaccia italiano residuo, a parte dati di esempio e modello di messaggio italiano. Alcune frasi sono più chiare dell'italiano: "You have 2 orders left to unlock. After this one, you will have 1." | Positivo | Alta |

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

| ID | Esito | Verifica su Chrome live |
| --- | --- | --- |
| R-B1 | Corretto. La pagina reale usa la shell dell'anteprima: logo e menu dell'avatar con Sicurezza, lingua ed Esci al posto di pillola, link e pulsante. Sicurezza ha una pagina propria su `/impostazioni/sicurezza` e `/en/impostazioni/sicurezza`, fuori da Ordini | Ordini con il solo ordine e «Collega negozio eBay» nella riga del titolo; menu con «Mario Prova», info@, Sicurezza, English, Esci; pagina Sicurezza con Email, Metodi di accesso e passkey; nessuno scorrimento orizzontale a 500 px |
| T1 | Corretto in parte: header, collocazione di Sicurezza e stato vuoto del primo accesso ora coincidono con l'anteprima. Restano per scelta: navigazione, ricerca, campanella e «Visita fiscalbay.it» finché le funzioni reali non esistono; card degli ordini (R-H2); conferma e accesso recente in Sicurezza (R-H1, R-H3); testo del negozio già collegato nell'anteprima (N8) | Header e Sicurezza come sopra. Lo stato vuoto reale non è visibile con info@, che ha un ordine: verificato solo in locale, con D1 locale e utente sintetico |
| SC6 | Corretto. Illustrazione e testo centrati insieme nella card, senza il terzo destro vuoto; «Codici Fiscali» non va più a capo a metà | Scenario «Primo accesso» a 1440 px. Lo scenario è stato poi riportato a «Free, uso ordinario» |
| RW3 | Corretto. Sotto 768 px la barra dell'anteprima mostra «Qui le azioni sono simulate e usano dati di esempio.»; la descrizione dello scenario resta da 768 px | Iframe di 496 px: nota visibile, descrizione nascosta |
| R-B6 | Non corretto, per scelta approvata: l'app reale segue il tema di sistema finché le Impostazioni non salveranno la scelta | Non applicabile |
| P2 | Nessuna modifica: Profilo centrato confermato dalla decisione già approvata e documentata nel design system | Non applicabile |

Emerso durante le correzioni e corretto nella stessa PR: con la navigazione
nel browser, dopo l'uscita da `/en` o tornando a `/en` dal logo, la pagina
compariva in italiano con titolo inglese, perché la richiesta dei dati
`/en.data` era letta come italiano. Verificato su Chrome live: da
`/en/impostazioni/sicurezza` il logo porta a `/en` con `lang="en"`, «Orders»
e sottotitolo inglese.

