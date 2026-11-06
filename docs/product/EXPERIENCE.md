# FiscalBay · Esperienza

Architettura dell'informazione, Impostazioni, onboarding, brand, design system e sito pubblico.

<a id="s16"></a>
## 16. Architettura dell'informazione e route

Desktop: **top navigation**, non sidebar principale. Voci **Ordini · Negozi eBay · Impostazioni**. Top bar con ricerca ordini, campanella e avatar/profilo. Mobile: bottom navigation sulle stesse tre destinazioni; top bar compatta. Analisi sarà quarta voce solo quando rilasciata nelle 2.x Premium, senza placeholder 2.0.

| Superficie | Percorso canonico indicativo |
|---|---|
| Pubblico IT / EN | `/`, `/en` e pagine localizzate |
| Accesso / registrazione / recupero | `/login`, `/registrati`, route Auth coerenti |
| Ordini e dettaglio | `/app/ordini`, `/app/ordini/:id` |
| Negozi e dettaglio | `/app/negozi`, `/app/negozi/:id` |
| Impostazioni e sottosezioni | `/app/impostazioni/:sezione` |
| Profilo | `/app/impostazioni/profilo`; `/app/profilo` reindirizza (D191) |
| Admin | `/admin` e sottosezioni autorizzate |
| Endpoint applicativi necessari | `/api/v1/...`, solo con un consumatore concreto |
| Callback / webhook | Endpoint dedicati, non confusi con pagine pubbliche |

Gli slug sono default tecnico; ID opachi e controlli server indipendenti dalla route. Deep-link protetti, refresh/back/forward funzionanti. Filtri e ricerche seguono la protezione degli URL e della cache descritta in [§23](#s23).

Un utente autenticato che visita la root viene indirizzato all'app. Dal menu avatar `Visita fiscalbay.it` deve permettere navigazione pubblica senza logout e senza loop: distinguere intenzione di visita pubblica tramite stato/cookie strettamente funzionale o parametro consumato, con canonical pulito e nessuna pagina duplicata indicizzabile.

<a id="s19"></a>
## 19. Impostazioni, Profilo e campanella

Impostazioni desktop: categorie a sinistra e contenuto a destra; navigazione locale, non sidebar globale. Mobile elenco→pagina. Le categorie stanno in tre gruppi con un'etichetta, nell'ordine della tabella: Ordini, Account, Generale (D185). Tutte le opzioni concordate, incluse notifiche per negozio, template IT/EN e configurazioni export, devono avere una sola fonte di stato; collegamenti da altre superfici sono scorciatoie, non configurazioni duplicate.

| Gruppo | Sezione | Contenuto |
|---|---|---|
| Ordini | Notifiche | Chat Telegram, stato, filtro tutti/solo fiscali, singolo/riepilogo giornaliero, orario/fuso, negozi; consenso marketing separato |
| Ordini | Export | Ambito/anteprima, CSV/XLSX secondo piano, righe/colonne, configurazioni; non archivio permanente |
| Ordini | Dati fiscali / modello messaggio | Template IT/EN copiabile, non anagrafica fiscale fittizia del merchant né modifica ordini |
| Account | Account | Dati personali (nome, cognome, ragione sociale e tipo di account registrato, che il salvataggio non cambia), email, metodi di accesso, passkey, password, sessioni e logout globale (D191) |
| Account | Piano e pagamenti | Stato effettivo, trial, quote/date, upgrade, periodicità, lifetime, disdetta, concessioni, negozio attivo nel Free, storico pagamenti e documenti tramite il portale del provider, senza elenco interno (D176) |
| Account | Dati e privacy | Termini e informativa privacy, export account, cancellazione e gestione diritti; i Termini si raggiungono soltanto da qui perché l'area non ha footer (D202) |
| Generale | Aspetto e lingua | Sistema/chiaro/scuro, IT/EN, fuso del dispositivo come predefinito o scelto (D185) |
| Generale | Supporto | FAQ/form, contatto, Novità (D203), storico esteso, integrazioni su valutazione |

Account come categoria delle Impostazioni: dati personali minimi, email, accessi e sessioni nello stesso posto (D191). Fuso in Aspetto e lingua, dati necessari alla vendita nel checkout provider. Menu avatar: nome/email, Account, Piano e pagamenti, Impostazioni, Novità, Console per il solo admin, Visita sito, Esci; Account apre la sua categoria. Lingua, tema e fuso scelti valgono in ogni pagina dell'area, anche dopo un nuovo accesso; prima della conferma dell'email, quando le Impostazioni non sono raggiungibili, la lingua si sceglie dal menu dell'avatar. Gli Ordini usano il modello di messaggio nella lingua dell'acquirente. Categorie e descrizioni nominano soltanto i servizi disponibili.

Il profilo abilita Salva soltanto per modifiche pendenti, espone attesa ed esito e conserva i valori in caso di errore. Uscire dalle Impostazioni, ricaricare o chiudere avvisa quando restano modifiche non salvate al profilo o al modello di messaggio; il passaggio fra categorie conserva le bozze.

Campanella: problemi e comunicazioni rilevanti di sicurezza/billing/servizio/manutenzione e una voce per ogni rilascio con Novità, che porta alla pagina; non tutti gli ordini. Popover in 2.0, letture/segna tutti, ultimi **30 giorni**; pagina completa in 2.x. Niente storico di sicurezza visibile separato. Salvataggio misto: autosave controllato per toggle/scelte semplici, Salva per template/configurazioni articolate; pending/error espliciti, ripristino coerente in caso di fallimento. La campanella riporta anche negozi da ricollegare, consensi in scadenza e letture non riuscite. Letture e «Segna tutte come lette» restano sul server; una lettura che il server non registra torna da leggere. Ogni notifica si elimina, anche tutte insieme, con «Annulla» per qualche secondo; l'eliminazione resta sul server e vale per quella notifica, non per lo stesso problema ripresentato più avanti. Ogni tipo di notifica ha la sua icona, la campanella mostra il numero da leggere fino a 9+ e la notifica delle Novità porta la versione ([D305](../decisions/DECISION_REGISTER.md)).

Novità (D203): pagina dell'area autenticata in Supporto e nel menu avatar, IT/EN, con le voci più recenti in alto. Entrano nuove funzioni, cambi visibili di comportamento, schermate o flussi e correzioni di difetti che gli utenti hanno notato o segnalato, soltanto dell'area dell'app; restano fuori il sito pubblico, fix interni, refactoring, prestazioni non percepibili e cambi di piani, prezzi o limiti, che seguono le comunicazioni di billing e servizio. Le voci stanno nelle parti «Novità» e «What's new» della versione in `CHANGELOG.md`, nei gruppi Funzionalità, Miglioramenti e Correzioni, scritte nella PR che introduce la modifica e lette alla build: in Production compaiono con il giorno scritto dalla PR di promozione ([D252](../decisions/DECISION_REGISTER.md)), sul test la versione in preparazione si vede dopo il deploy come «In preparazione». Le RC e le versioni senza parte Novità non generano voci, mentre la 2.0.0 presenta le funzioni principali; finché la pagina è vuota, menu, Supporto e campanella non la mostrano. Nessuna pagina pubblica, email o editor nella console.

<a id="s20"></a>
## 20. Onboarding, stati vuoti e modalità degradate

La pagina Ordini mostra i dati persistiti autorizzati senza attendere una nuova lettura eBay. Gli aggiornamenti remoti proseguono separatamente, con timestamp e stato locale di avanzamento; non sostituiscono l'intera vista con uno skeleton. Verificare sessione, diritti e retention lato server prima della risposta: uno stato memorizzato non autorizza da solo un'azione o l'esposizione di un dato fiscale.

Onboarding dentro Ordini, contestuale, riprendibile e non bloccante. Account creato→email verificata→negozio collegato→prima sync→ordini disponibili. Senza prerequisito la funzione dipendente non è usabile, ma Profilo/Impostazioni lo sono. Nessuna demo mescolata ai dati reali. Breve preparazione OAuth, poi eBay, ritorno in Ordini con conferma e import progressivo.

Dopo prima sync mostrare valore reale e CTA trial discreta, mai attivazione automatica. Tempo residuo trial poco invasivo, più evidente a ridosso della fine; upsell contestuale, non enorme box permanente.

| Condizione | Comportamento richiesto |
|---|---|
| Nessun negozio | Empty state reale e CTA Collega eBay |
| Collegato, zero ordini | Esito corretto, periodo interrogato, nessun errore inventato |
| Import in corso | Prime righe disponibili, conteggio/stato; percentuale solo affidabile |
| Caricamento iniziale | Skeleton aderente al layout |
| Refresh | Dati esistenti restano, indicatore locale |
| Query senza risultati | Spiegazione e pulisci filtri |
| Quota fiscale esaurita | Non fiscale consultabile, quota/prossimo ciclo e CTA pertinente |
| Errore singolo negozio | Stato locale + campanella, banner se influenza la vista |
| eBay down | Timestamp, degrado esplicito, sole azioni dipendenti disabilitate |
| Stripe down | Diritti locali validi operativi; checkout/gestioni dipendenti sospesi |
| Auth/DB indisponibile | Niente promessa di lettura dal nulla: errore/manutenzione circoscritto sicuro |
| Pagamento acquisito, evento in attesa | Attivazione Premium in corso, riconciliazione server |
| Cancellazione in corso | Accesso operativo e automazioni fermate; nessuna schermata apparentemente attiva |

Consultazione ridotta solo quando i dati e l'autorizzazione sono disponibili e sicuri; non introdurre replica/offline/cache personale per simulare disponibilità. Non mostrare semaforo globale verde permanente. eBay risulta non disponibile quando le ultime letture di tutti i negozi attivi dello stesso ambiente non riescono, non per un errore isolato; Production e Sandbox si valutano ciascuno per sé e la campanella riporta un solo avviso. Si sospendono, anche sul server, soltanto le azioni che chiamano eBay. Con sessione o database non disponibili, Ordini, Negozi e Impostazioni rispondono «Servizio non disponibile» con Riprova, senza dati. I primi passi compaiono anche durante la prima sincronizzazione, dal punto raggiunto.

<a id="s21"></a>
## 21. Brand, logo e riferimenti

Direzione professionale, moderna e accessibile, senza tono eccessivamente rassicurante o promesse assolute. Il copy dice cosa FiscalBay fa per chi vende; limiti, esclusioni e garanzie di sicurezza compaiono solo dove servono a una decisione o spiegano un'eccezione (D154). Simbolo+wordmark FiscalBay, differenza sottile Fiscal/Bay; blu/indaco, navy e richiami ai quattro colori del mondo eBay senza riproduzione 1:1 o impressione di affiliazione.

**Logo: evoluzione del Concept 4 · Minimal Ledger Card**, file identificato in [REFERENCES](../brand/REFERENCES.md). Il concept è il punto di partenza, non un vincolo: su indicazione owner (D141) forma, proporzioni, inclinazione e dettagli possono essere migliorati per chiarezza e resa piccola, mantenendo un segno autonomo che non richiami un prodotto ufficiale eBay. `Bay` resta blu come il simbolo. L'icona è generica, non una tile in stile piattaforma. Proposte e versione definitiva richiedono il via owner come checkpoint.

Produrre dopo approvazione vettoriali puliti, versioni orizzontale/mark, chiaro/scuro, favicon, avatar Telegram e preparazione future icone; niente condivisione di file font. Logo/claim delle tavole non sono specifiche funzionali né copy definitivo. Eliminare dagli asset finali date fittizie, testi estranei e promesse di fatturazione/vendite non previste. Il logo approvato è l'unico in uso su app, sito e superfici dei provider, compresi branding Google OAuth, Stripe e keyset eBay pertinenti.

Riferimenti da valutare **nella fase frontend**: beautifului.dev; beui.dev; rareui.com; transitions.dev; ui.shadcn.com; ui-skills.com; coss.com/ui; designsystemchecklist.com; reui.io/components. Catalogare componenti/guide, origine, licenza, cambi, costo e compatibilità repo pubblico. shadcn è una base, non l'unica ispirazione. Nessun acquisto Pro o copia di materiali con licenza incompatibile implicito.

<a id="s22"></a>
## 22. Design system, accessibilità e predisposizione Expo

Sistema iniziale vero ma circoscritto al prodotto: token colori/superfici/stati, typography, scale spaziature/radius, ombre moderate, focus, controlli, pulsanti, feedback, dialog/drawer, liste/tabelle, schede e responsive. Un solo sans-serif moderno, scelta e licenza qualificate. Icone outline uniformi Lucide. Densità bilanciata, non mosaico di card ovunque.

Semantica stati con testo/icona oltre colore: verde successo/connesso/accessibile; blu informazione; ambra verifica/attenzione; rosso errore realmente rilevante; viola Premium/disponibile da sbloccare. L'assenza fisiologica del dato non va resa indistinguibile da un errore tecnico bloccante. Light/dark/sistema completi per sito e app, stessa qualità.

Motion sottile e funzionale nell'app; più espressivo dove utile sul pubblico. CSS prima, Motion opzionale. Illustrazioni geometriche leggere in app e scene più ricche nel sito, senza decorazioni che oscurano il lavoro.

Accessibilità baseline obbligatoria 2.0: tastiera, focus visibile/gestito, etichette semantiche, contrasto leggibile, touch target adeguati, HTML corretto, non colore solo, reduced motion, errori annunciabili. Test automatici + manuali essenziali. Target formale avanzato nelle 2.x; **nessuna certificazione AA non dimostrata**, senza rinviare obblighi legali applicabili.

Token semantici, dominio, naming e contratti condivisibili con Expo; implementazioni visuali web-specifiche ammesse. Componenti HTML/CSS non diventano nativi per il solo uso di React. Non introdurre WebView come sostituto della futura esperienza nativa né dipendenze Expo nel runtime 2.0. [S17](../reference/SOURCES.md#s17)

**Prestazioni percepite.** La build fallisce se il JavaScript iniziale di una pagina supera il budget gzip della sua classe, dichiarato nel repository e rivedibile solo con motivazione: 170 KiB per sito, documenti legali ed errori, 300 KiB per area riservata, accesso, amministrazione e anteprima (D182). Conta ciò che il browser carica all'apertura della pagina; gli import dinamici successivi al primo disegno e il totale di tutti i file restano informativi. Le pagine che dipendono da una verifica remota lenta mostrano subito l'ultimo stato salvato con un'indicazione di verifica in corso e azioni sensibili disabilitate, poi lo sostituiscono con lo stato confermato in streaming; se la verifica fallisce compaiono avviso e «Riprova». Non si attende il provider prima di inviare l'HTML e non si presenta come confermato un dato ancora in verifica. Dati sensibili bloccati restano esclusi anche dallo stato provvisorio.

<a id="s23"></a>
## 23. Sito pubblico, contenuti e SEO

Home, Funzionalità, Prezzi, Sicurezza, FAQ, Supporto e Guide. Italiano su root, inglese `/en` con i segmenti in inglese, anche nell'area riservata e nell'anteprima (`/en/pricing`, `/en/app/orders`, `/en/app/settings/plan`); la console resta con le sezioni italiane. Un vecchio indirizzo inglese con i segmenti italiani porta a quello nuovo con un solo redirect permanente, 308 per gli invii di moduli. Le Guide sono articoli stabili sulle domande ricorrenti dei venditori (dove trovare il Codice Fiscale dell'acquirente e perché non si vede nell'ordine, come chiederlo, Partita IVA, fattura elettronica, export in Excel o CSV), con il titolo che comincia dalla frase cercata, un titolo breve per i risultati di ricerca, data di aggiornamento, un riquadro finale su come FiscalBay risolve il problema con la schermata della funzione, `Inizia gratis` e `Accedi`, e il menu di tutte le guide a lato o dopo l'articolo, senza notizie né categorie; dati strutturati dell'articolo e del percorso Guide › articolo; ogni affermazione resta nei limiti di ciò che FiscalBay fa ed eBay rende disponibile e le regole fiscali rimandano al commercialista ([D293](../decisions/DECISION_REGISTER.md)). Nessun blog/news, roadmap pubblica o pagine fittizie «prossimamente»; le Novità esistono soltanto nell'area autenticata (D203). Funzionalità in pagina unica: CF, sync, ordini, export, Telegram, multi-negozio, sicurezza. Pagina Sicurezza dedicata a due livelli ma senza eccesso tecnico.

Descriptor principale: **Recupera il Codice Fiscale dagli ordini eBay**; breve: **Codice Fiscale per ordini eBay**. Hero: **Trova e gestisci il Codice Fiscale dei tuoi ordini eBay.** Title approvato: `Recupera il Codice Fiscale dagli ordini eBay | FiscalBay`: ogni titolo mette prima la pagina e poi il marchio, e le pagine pubbliche portano la parola chiave nel titolo della scheda, dopo il nome della pagina (`Prezzi | Codice Fiscale degli ordini eBay | FiscalBay`), mentre l'H1 resta il nome della pagina (`Prezzi`); la home tiene l'hero. Meta: recupero/gestione del CF disponibile con sync, export e notifiche. Keyword secondarie solo pertinenti, inclusa fattura elettronica per spiegare l'utilità, mai per affermare che FB la emetta.

CTA primaria `Inizia gratis`, secondaria `Come funziona`, accesso evidente. In Prezzi ogni offerta Premium ha il proprio pulsante: l'offerta scelta segue la registrazione e la conferma dell'email apre la pagina Piano con quell'offerta in evidenza, senza acquistare nulla. Prezzi chiude con le domande sui pagamenti riprese dalla FAQ. Tre passaggi: collega eBay; sync/individuazione CF; consulta/copia/esporta/notifiche secondo piano. Fascia fiducia: API ufficiali eBay, pagamenti sicuri gestiti da Stripe, nessuna carta per iniziare. Precisare quando necessario «quando disponibile su eBay». Letture e cose non fatte esplicite; indipendenza da eBay visibile e nei Termini.

Barra superiore e footer delle pagine pubbliche (D202). La barra porta logo, Funzionalità, Prezzi, Sicurezza, FAQ, Guide, lingua, `Accedi` e `Inizia gratis`, oppure `Apri l'app` con una sessione; `Accedi` e `Inizia gratis` restano a ogni larghezza. Sotto i 1024 px le pagine stanno in una seconda riga della barra, distribuite con spazi uguali anche ai lati sotto i 640 px, e la lingua mostra soltanto il codice dell'altra; sotto i 360 px la lingua passa nel footer. Nessuno scorrimento orizzontale. Il primo elemento raggiunto con Tab è «Vai al contenuto principale», nascosto finché non riceve il focus, in sito e area riservata. Il footer è uno solo per tutte le pagine pubbliche, accesso, Termini e Privacy compresi: «© FiscalBay» con l'anno corrente, indipendenza da eBay, Termini, Privacy, Supporto e indirizzo di assistenza. Le pagine della barra non si ripetono nel footer, che non nomina Temisfera né riporta sede, P.IVA o titolare: l'operatore compare soltanto in Termini e Privacy (D204). L'area autenticata non ha footer (§19).

Prezzi: Free e tre modalità Premium nello stesso confronto; annuale evidenziato senza scelta nascosta; lifetime allo stesso livello con il residuo reale; esaurito resta visibile come tale, senza urgenza artificiale (D218). Ogni prezzo netto ha accanto il totale con l'IVA italiana al 22%; Stripe calcola prima del pagamento imposte e totale del paese dell'acquirente. Senza il database Home e Prezzi mostrano il listino di riserva: i prezzi del catalogo, senza quota, prova, promozione o posti, invece del 503. Trial 14 giorni senza carta evidente e volontario dopo prima sync. Promo mostra 10/7 giorni fino alla data, poi 5; la quota reale individuale può restare 10 fino a fine ciclo. Home e Piano dell'app usano lo stesso listino di Prezzi, con il totale IVA accanto al netto, la prova oppure gli acquisti sospesi e i posti lifetime rimasti. La promozione indica il giorno di fine senza orario.

SEO tecnico: sitemap solo pagine pubbliche canoniche, con `lastmod` dall'ultima modifica sostanziale del contenuto e senza Termini e Privacy che rispondono `noindex` (D204), robots, noindex su app/test/anteprime, canonical, hreflang, Open Graph con un'immagine per pagina e lingua, metadata IT/EN, structured data soltanto veri e appropriati (organizzazione, FAQ, offerte di Prezzi con il prezzo netto, articoli delle Guide), manifest con icone e colore del tema, `/.well-known/security.txt` verso `info@`, performance: l'immagine principale della home arriva per prima, in AVIF e alla larghezza adatta (640, 960 px o l'originale), le immagini del sito restano in cache per trenta giorni. `robots.txt` non è controllo d'accesso. Nessun dato account indicizzabile o cache cross-user. Solo strumenti strettamente necessari; evitare banner cookie quando le tecnologie effettive lo consentono, non dichiarare l'esenzione senza inventario. Le visite delle sole pagine pubbliche si contano con Cloudflare Web Analytics senza cookie e Search Console riceve la sitemap con la verifica DNS; Google Analytics è escluso perché richiederebbe consenso e banner ([D242](../decisions/DECISION_REGISTER.md), [procedura](../operations/OBSERVABILITY.md#statistiche-sito)). La provenienza degli iscritti ([D304](../decisions/DECISION_REGISTER.md)) viaggia nel parametro `via` dei link interni delle pagine pubbliche e dell'accesso: il Worker lo calcola dal Referer o da un'etichetta dell'elenco chiuso, il browser lo aggiunge ai link e lo toglie dalla barra dell'indirizzo senza scrivere cookie o archivi. Canonical, hreflang, sitemap e dati strutturati non lo contengono mai, quindi l'indirizzo con il parametro non è una pagina indicizzabile distinta; senza JavaScript la provenienza non si propaga e la registrazione la salva come sconosciuta. Social proof soltanto quando reale/autorizzata.

**Cache e navigazione autenticata.** La home può reindirizzare l’utente autenticato agli Ordini, ma quel redirect è specifico della sessione e non può essere memorizzato nella cache pubblica per tutti. Anche la scelta «Visita il sito» resta personale. Ogni pagina pubblica legge la sessione e risponde `no-store`; soltanto la home porta agli Ordini, salvo la scelta di visitare il sito. Home e Prezzi chiesti senza alcun cookie né parametro arrivano da una copia di un minuto nella cache di Cloudflare, per indirizzo, versione del Worker e categoria di provenienza, che la pagina porta nei link interni: la risposta è la stessa per ogni visitatore anonimo con quella provenienza e il browser riceve comunque `no-store`. Le pagine mostrano il prodotto con schermate reali dell'anteprima, nella lingua e nel tema della pagina. Sicurezza indica `info@` per le vulnerabilità; la FAQ raccoglie le domande prima di iniziare, Supporto quelle d'uso. Definire regole esplicite di bypass/no-store per `/app`, `/admin`, API sensibili, callback, risposte con sessione e download; il solo header `Vary` o il solo noindex non dimostra isolamento della cache del provider.

Le ricerche che contengono un CF/P.IVA non devono finire in URL condivisibili, referrer, log edge o analytics. Conservare il contesto di navigazione con stato di sessione protetto; non disabilitare la ricerca fiscale già approvata per risolvere il problema. Filtri non sensibili possono mantenere URL riproducibili. Provare visitatore anonimo, utente autenticato, ritorno al sito e due merchant distinti sullo stesso percorso.
