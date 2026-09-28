# Design system

Fondazione visiva di sito e app, circoscritta al prodotto ([§22](../MASTER_PLAN.md#s22)). Il codice è la fonte dei valori: token e ruoli di movimento in [`app/app.css`](../../app/app.css), primitive in [`app/components/ui/`](../../app/components/ui/), componenti di marchio e dominio in [`app/components/`](../../app/components/). I componenti si vedono in uso nell'anteprima dell'app (`/anteprima`, vedi sotto). Il campione `/design` è stato rimosso il 2026-09-28, dopo l'approvazione owner delle schermate: i componenti restano nel codice e le sue prove sono passate alle schermate reali.

## Principi

Personalità scelta dall'owner il 2026-09-27: **precisa e sobria**, uno strumento professionale.

1. **Il dato è il protagonista.** Codici Fiscali, numeri d'ordine e importi hanno la tipografia più curata; il resto si fa da parte.
2. **Colore misurato e con un significato.** Il blu pieno indica l'azione principale; la superficie colorata piena segnala solo uno stato che chiede un'azione. Su indicazione owner del 2026-09-28 Ordini e Negozi hanno più colore (etichette di stato tinte, tinta per negozio, tessere colorate nel pannello del negozio), mentre Impostazioni e Profilo restano sobri con icone monocromatiche; nessuna superficie piena decorativa.
3. **Identità nei dettagli, non nelle decorazioni.** La tessera del logo entra nell'interfaccia dove comunica qualcosa: sincronizzazione, stati vuoti.
4. **Movimento che spiega.** Ogni animazione mostra da dove arriva o dove va qualcosa, entro 250 ms per le aperture; niente movimento decorativo nell'app.
5. **Tono del prodotto** ([§21](../MASTER_PLAN.md#s21)): diretto, senza toni rassicuranti o promesse assolute; dire cosa FiscalBay legge e cosa non fa.

## Base tecnica

| Scelta | Versione | Licenza | Motivo |
|---|---|---|---|
| Tailwind CSS + `@tailwindcss/vite` | 4.3.3 | MIT | CSS previsto dallo stack ([§26](../MASTER_PLAN.md#s26)) |
| shadcn/ui, stile `base-nova` | CLI 4.21.0 | MIT | Sorgenti copiati e posseduti, base personalizzabile |
| Base UI (`@base-ui/react`) | 1.8.0 | MIT | Primitive accessibili (focus, tastiera, ARIA); un solo kit al posto di Radix |
| Motion (`motion`) | 13.4.4 | MIT | Solo dove il CSS non basta: ingresso e riordino animato delle liste; caricato con `LazyMotion` |
| `cn` | 0.4.0 | MIT | Fusione delle classi Tailwind usata dai sorgenti shadcn |
| `class-variance-authority` | 0.7.1 | Apache-2.0 | Varianti dei componenti |
| Lucide (`lucide-react`) | 1.48.0 | ISC | Icone outline uniformi, confermate da D103 |
| Inter Variable (`@fontsource-variable/inter`) | 5.3.0 | OFL-1.1 | Unico sans-serif, lo stesso del wordmark; servito dal nostro dominio |

`shadcn` è una dipendenza di sviluppo: serve soltanto il suo CSS al build. `tw-animate-css` è stato rimosso: aperture e chiusure usano i ruoli di movimento qui sotto.

## Identità nell'interfaccia

- **Righe della tessera (`LedgerIndicator`):** blu, verde e rossa nelle proporzioni del logo (224:156:72). Ferme accompagnano l'ultima sincronizzazione; animate in sequenza indicano una sincronizzazione in corso, al posto di uno spinner generico. Con la riduzione del movimento restano ferme e intere. Lo spinner resta per il solo caricamento dentro un pulsante.
- **Illustrazioni degli stati vuoti (`EmptyArt`):** tutte costruite sulla tessera del logo, senza immagini generate. Primo utilizzo: tre tessere che passano da inclinate e arretrate a una frontale. Nessun ordine: tessera frontale con le tre righe del marchio e un segno di conferma, perché tutto è aggiornato. Ricerca senza risultati: tessera con lente, in piccolo accanto ai criteri. Indirizzo inesistente: tessera con punto interrogativo. Il collegamento scaduto resta una piccola icona Lucide accanto al negozio.
- **Icona dello sblocco (`UnlockIcon`):** la tessera con due righe e una serratura, disegnata sulla griglia Lucide (24 px, tratto 2). Accompagna il dato da sbloccare, il pulsante «Sblocca ordine» e lo sblocco multiplo; resta distinta dalla corona del piano Premium.
- **Corona Premium (`Crown` di Lucide):** su scelta owner del 2026-09-28 sostituisce la scintilla, letta come simbolo di funzioni AI. Nel piano Free compare accanto alle funzioni Premium (notifiche Telegram, XLSX, colonne dell'esportazione, periodo di 90 giorni visibile ma non selezionabile) con `PremiumNote`, una sola volta per pagina invece che su ogni riga.
- **Codice Fiscale (`TaxCode`):** mostrato sempre intero, senza separazioni, per scelta owner del 2026-09-27; `font-code` evita di confondere 0/O e I/1/l. Copia con feedback immediato (icona che diventa conferma, annuncio per i lettori di schermo). Un errore di copia resta visibile fino al nuovo tentativo riuscito. Da bloccato non riceve il valore: mostra sedici punti e l'icona viola dello sblocco; allo sblocco usa solo una dissolvenza di 150 ms, senza sfocatura o spostamento del testo. Variante `compact` (32 px) per le righe dense delle tabelle.
- **Etichetta e nome della copia:** l'etichetta segue il tipo restituito da eBay (`CODICE_FISCALE` è «Codice Fiscale», `VAT_ID` è «Partita IVA», un tipo sconosciuto resta com'è) e una Partita IVA non viene mai chiamata Codice Fiscale. Su indicazione owner del 2026-09-28 non si usa «dati fiscali»: il nome prevalente è «Codice Fiscale», anche nei testi generici; un ordine che riporta soltanto la Partita IVA la mostra con il suo nome già prima dello sblocco (`shownAs` dello stato `locked`), senza rivelarne il valore. Il nome accessibile del pulsante indica dato e riga, per esempio «Copia Codice Fiscale: Maria Rossi» o, nell'app, «Copia Codice Fiscale: ordine 12-34567-89012», così più pulsanti in un elenco restano distinguibili.
- **Velatura dei dialog:** blu scuro del marchio al 24% su chiaro, nero al 60% su scuro, senza sfocatura dello sfondo.

## Token

- **Marchio:** i tre blu del logo, `--brand-blue` `#1A4FA6`, `--brand-navy` `#0E3372`, `--brand-sky` `#4F87E3`, e le righe `--brand-green` `#1F9F9A`, `--brand-red` `#DA353E`. Il primario è il blu medio su chiaro e l'azzurro su scuro.
- **Superfici e testo:** neutri con leggera tinta blu; `background`, `card`, `popover`, `muted`, `foreground`, `muted-foreground`, `border`, `input`, `ring`.
- **Tema scuro:** sfondo antracite con una lieve componente fredda; card e popup progressivamente più chiari, testo secondario e separazioni leggibili. Il blu resta concentrato nelle azioni e nel focus. Logo, colori del marchio e tema chiaro invariati.
- **Stati**, ciascuno con colore del testo e superficie (`--success` e `--success-surface`, e così via):

| Tono | Significato | Icona |
|---|---|---|
| `success` verde | Riuscito, collegato, accessibile | `CircleCheck` |
| `info` blu | Informazione, operazione in corso | `Info` |
| `warning` ambra | Da verificare, attenzione | `TriangleAlert` |
| `danger` rosso | Errore realmente rilevante | `CircleAlert` |
| `premium` viola | Piano Premium | `Crown` |
| `locked` viola | Dato da sbloccare | `UnlockIcon` (propria) |
| `neutral` grigio | Dato assente per natura, non un errore | `CircleDashed` |

`StatusBadge` e `StatusAlert` mostrano sempre icona e testo insieme al colore. `StatusAlert` usa `role="alert"` solo per `danger`, altrimenti `role="status"`.

**Uso sobrio del colore**, scelto dall'owner il 2026-09-27 dopo un confronto affiancato con la resa a superfici piene:

- La superficie colorata spetta solo agli stati che chiedono un'azione. I badge `warning`, `danger` e `locked` sono tinti; `premium`, `success`, `info` e `neutral` sono testo grigio con l'icona colorata. Gli avvisi hanno lo sfondo tinto solo per `danger` e `warning`; gli altri usano la superficie della card con l'icona colorata.
- Il blu pieno è riservato all'azione principale. Il pulsante secondario è grigio.
- Il pulsante distruttivo (`destructive`) è testo rosso su fondo trasparente; il rosso pieno (`destructive-solid`) compare solo nella conferma di un `AlertDialog`.
- Al massimo un accento colorato per riga o scheda.
- **Tessere e avatar (`IconTile`, `InitialsTile`, `PageTitle`, tinte in `tile-tone.ts`):** icona o iniziali su una tessera tinta con i colori di stato o il verde del marchio. Ordini e Negozi usano tessere colorate; categorie delle Impostazioni e riquadri del Profilo usano il tono `neutral`, su scelta owner. Il colore di un negozio o di una persona deriva dal nome ed è stabile fra le pagine: avatar in Negozi, punto accanto al negozio e segnaposto della miniatura nella scheda dell'ordine. Le iniziali non usano il verde acqua, poco leggibile sul tema scuro.
- **Stati di pagamento e spedizione:** etichette tinte sotto il numero d'ordine (verde completato, ambra da fare, blu in corso, grigio annullato). In Negozi lo stato del collegamento usa `StatusBadge` con `filled`, e gli ultimi aggiornamenti hanno l'icona dell'esito.
- **Codice disponibile:** riquadro tinto di blu, per distinguere il dato protagonista dagli stati senza valore, che restano neutri.

- **Contrasto:** testo almeno 4,5:1 su ogni superficie pertinente, bordo dei campi e anello di focus almeno 3:1, in entrambi i temi. Lo verifica [`test/design-tokens.spec.ts`](../../test/design-tokens.spec.ts) leggendo i valori da `app.css`. Il chip giallo del logo resta un'eccezione del solo marchio.
- **Tipografia:** Inter Variable con `cv11`; scala Tailwind predefinita, titoli `font-semibold`/`font-bold` con `text-balance`, `tracking-tight` solo sui titoli. `font-code` per codici, numeri d'ordine e importi: cifre tabellari, zero barrato e I maiuscola con grazie, per non confondere 0/O e I/1/l. Nessun monospace di sistema.
- **Spaziature, radius, profondità:** scala Tailwind, `--radius` 10 px; card `xl`, pulsanti e contenitori fiscali `lg`, pillole riservate ai badge brevi. Spazi ravvicinati fra dato e azione, più ampi fra gruppi distinti. Pagina neutra, card con bordo senza ombra, popup/dialog/pannelli con ombra `md`. Le prove verificano le superfici nei due temi.

## Movimento

Scala ricavata da transitions.dev e usata tramite token (`--duration-*`, `--ease-smooth-out`, `--scale-*`):

| Ruolo | Apertura | Chiusura | Dettagli |
|---|---|---|---|
| `motion-modal` (dialog, alert dialog) | 250 ms | 150 ms | Dissolvenza e scala da 0,96 |
| `motion-popover` (menu, select) | 250 ms | 150 ms | Scala da 0,97 dal punto d'origine, chiusura a 0,99 |
| `motion-tooltip` | 150 ms dopo 400 ms di attesa | istantanea | Scala da 0,98 |
| `motion-panel` (pannello laterale) | 250 ms | 150 ms | Scorrimento di 2,5 rem e dissolvenza |
| `motion-backdrop` | 250 ms | 150 ms | Sola dissolvenza |
| Indicatore delle schede | 250 ms | · | Pillola o barra che segue la scheda attiva |
| Copia | 250 ms | · | Scambio d'icona con scala e sfocatura di 2 px |
| Nuovo ordine in lista (Motion) | 250 ms | · | Ingresso breve senza sfocatura e riordino FLIP, quando il nuovo ordine entra nell'elenco |

Curva unica `cubic-bezier(0.22, 1, 0.36, 1)`; `ease-out` per i tooltip. Si animano `opacity`, `scale` e `translate` come proprietà separate; sfocature solo brevi, una tantum e di 2 px su elementi piccoli; nessun `transition-all`. Il pulsante risponde in 150 ms. Con `prefers-reduced-motion: reduce` animazioni e transizioni sono azzerate e Motion rispetta la stessa preferenza.

## Testi

- **Codice Fiscale in inglese:** su indicazione owner del 2026-09-27, titoli, etichette, intestazioni e azioni usano «Codice Fiscale»; le frasi descrittive usano «tax code». Esempio: colonna `Codice Fiscale`, tooltip «Copy the tax code».
- **Dato assente:** non attribuirne la causa all'acquirente; dire che eBay non lo riporta per l'ordine, oppure «quando disponibile su eBay».
- **Stati vuoti:** primo utilizzo con composizione ampia, tessere, invito a collegare il negozio e primi passi nella stessa scheda, con il passo corrente evidenziato; nessun ordine con composizione ampia e collegamento al negozio; ricerca senza risultati compatta accanto ai criteri, con «Cancella ricerca» se c'è solo la ricerca e «Reimposta filtri» altrimenti; indirizzo inesistente dentro la shell, con titolo di pagina e ritorno all'elenco; collegamento scaduto vicino al negozio e alla sua azione. Nessun bordo tratteggiato. «Già collegato a un altro account» è l'esito di un tentativo di collegamento, non uno stato della pagina. I pulsanti di collegamento del catalogo restano esempi visivi, senza integrazioni.
- **Messaggi operativi:** evento, conseguenza e prossima azione, senza attribuire cause non note. Esempio: «Collegamento scaduto. La sincronizzazione è sospesa. Ricollega il negozio.» Stessa struttura in inglese. Un errore di copia propone il nuovo tentativo o la selezione manuale.
- **Sblocco e Premium:** icona dello sblocco per il dato da sbloccare, corona per il piano. Il conteggio si esprime in ordini («ordini da sbloccare», «ordini sbloccati»), non in «sblocchi». Nella scheda il segnaposto mostra un solo lucchetto; le righe compatte usano il badge. Prima dell'azione si spiega quanti ordini restano. La conferma locale scompare dopo quattro secondi.
- **Gerarchia dei dati:** acquirente a 16 px nella scheda e 14 px nelle righe; CF continuo a 15 px. Il componente fiscale ha angoli arrotondati, bordo e fondo neutri, larghezza uniforme di 224 px entro lo spazio disponibile e copia allineata a destra. Le righe condividono la larghezza della colonna fiscale, anche per gli stati senza codice. Ordine, data e importo sono contesto attenuato; valuta e importo restano uniti. I nomi lunghi restano interi e vanno a capo; gli articoli si aprono sotto il riepilogo. Le conferme non lasciano spazi vuoti quando assenti.
- I testi dell'anteprima sono dimostrativi e non introducono funzioni: niente digest email degli ordini, nessuna accettazione di condizioni fuori dai flussi previsti.

Il copy si rivolge a chi gestisce gli ordini: «Sblocca ordine», «Riprova», «Ordine sbloccato. Ti resta 1 ordine da sbloccare». Evitare gergo tecnico come dato accessibile, quota residua, lettura e retention nei messaggi di prodotto. Nei casi ordinari bastano il codice e Copia; spiegare soprattutto eccezioni e conseguenze.

Titoli descrittivi e ordinari: «Dettaglio ordine», «Elenco ordini», «Nessun negozio collegato». Evitare slogan, giochi di parole e attribuzioni umane agli ordini. Negli stati vuoti compatti, l'azione si allinea alla colonna del testo su mobile e al margine destro su schermi ampi.

La comparsa del CF mantiene una sede stabile; il dato si rivela con una dissolvenza e la copia segue con un ritardo breve di 100 ms. Con movimento ridotto entrambi sono immediati.

## Tema

Tre modalità: sistema (predefinita), chiaro, scuro. I token scuri valgono con `prefers-color-scheme: dark` salvo `data-theme="light"` su `<html>`, oppure con `data-theme="dark"`. La variante Tailwind `dark:` segue la stessa regola. La persistenza della scelta appartiene alle Impostazioni.

## Accessibilità di base

- **Focus:** anello pieno di 3 px nel colore `ring`, visibile su ogni controllo; sui pulsanti è staccato di 2 px, così resta distinguibile anche sul pulsante primario dello stesso colore. Le azioni distruttive usano `AlertDialog`, che porta il focus sull'annullamento e lo restituisce al pulsante di apertura.
- **Tocco:** con puntatore coarse ogni pulsante e scheda ha un'area di tocco invisibile di almeno 44 px, così resta visivamente compatto; campi, select, voci di menu ed etichette di checkbox/switch/radio arrivano a 44 px. Sotto 640 px i campi usano testo a 16 px, per evitare lo zoom automatico di iOS.
- **Caricamento:** il pulsante resta a colore pieno con spinner e `aria-busy`, bloccato con `disabled` e `focusableWhenDisabled`, così non perde il focus. Lo spinner è decorativo quando il pulsante contiene già l'etichetta di caricamento, per evitare annunci duplicati.
- **Form:** etichetta visibile, descrizione e errore collegati con `aria-describedby`, `aria-invalid`, errori annunciati e focus sul primo campo errato.
- **Testi:** i nomi accessibili che i sorgenti shadcn avevano fissi in inglese (`Close`, `Loading`) sono prop obbligatorie tradotte dal chiamante.
- **Stati interattivi:** hover del pulsante primario su token proprio (`--primary-hover`) e testo della conferma distruttiva (`--danger-foreground`) verificati a 4,5:1.
- **Tooltip:** solo informazione accessoria, perché non viene annunciato dai lettori di schermo; il nome del controllo deve bastare da solo.
- **Pannello laterale:** a tutta larghezza sotto 640 px; contenuto interno scorrevole anche con altezza ridotta e pulsante di chiusura sempre raggiungibile.
- **Nomi lunghi:** le opzioni del select vanno a capo per conservare il nome completo del negozio, anche su touch.
- **Schede verticali:** orientamento trasmesso alla primitiva; frecce su/giù e pannelli coerenti con la disposizione visiva.

### Prove

Le prove girano sulle schermate reali dell'anteprima, con gli scenari sintetici. `e2e/app-components.spec.ts` verifica le garanzie del design system: errori del form associati al campo con focus sul primo errato, conferma che porta il focus su Annulla e lo restituisce, copia fallita e nuovo tentativo, nomi lunghi nella select su touch IT/EN, pannello di dettaglio scorrevole con chiusura raggiungibile ad altezza ridotta, geometria dei codici da 320 a 1280 px (nessun overflow della pagina, codice e Copia senza sovrapposizione, colonne fiscali allineate), stati senza valore senza Copia, icona dello sblocco distinta dalla corona Premium, nomi distinti delle copie, superfici nei due temi e movimento ridotto. `e2e/app-shell.spec.ts` copre navigazione, dettaglio con URL, filtri, sblocco, ricerca, mobile, Premium senza ordini da sbloccare, piano a vita, stati vuoti, indirizzi inesistenti, filtri sconosciuti e stati di aggiornamento, eBay fermo e collegamento già usato. Le schede verticali non hanno oggi un consumatore: la primitiva resta, la sua prova tornerà con la prima schermata che le usa.

`pnpm test:e2e` usa Playwright con Chromium e verifica la build compilata con un server preview locale dedicato sulla porta 5186. La compilazione fa parte del comando, salvo con `E2E_PREBUILT=1`, che la CI usa per provare la stessa build di `pnpm verify` poi distribuita; il server di sviluppo non entra nelle prove, evitando ricaricamenti durante l'idratazione. Alla prima esecuzione installare il browser con `pnpm exec playwright install chromium`. La CI esegue queste prove dopo `pnpm verify`. Fixture e appunti simulati restano nel browser del test. `pnpm verify:full` esegue in locale `pnpm verify` e queste prove.

Confronto visivo: `e2e/visual.spec.ts` cattura la pagina Ordini dello scenario ordinario in chiaro e scuro a 375 e 1280 px, con animazioni disattivate, e la confronta con le catture di riferimento in `e2e/visual.spec.ts-snapshots/`. Le catture sono generate su Linux in CI, perché il rendering dei font cambia fra sistemi; fuori da Linux la prova viene saltata. Dopo una modifica visiva voluta si rigenerano eliminando le catture interessate: la CI le ricrea e le pubblica nell'artefatto `visual-references`, da scaricare e aggiungere al branch.

Controllo manuale del 2026-09-27 sul campione, in locale: tema cambiato da tastiera, form inviato vuoto, dialog e pannello aperti e chiusi con tastiera e tocco, menu, select e schede da tastiera, IT/EN, 375 px con touch emulato senza scorrimento orizzontale della pagina. Non è una certificazione WCAG AA.

## Catalogo dei nove riferimenti

Valutazione del 2026-09-27, con studio a schermo e dei sorgenti pubblici. Nessun acquisto Pro e nessun file copiato fuori da quanto elencato nel registro.

| Riferimento | Origine e licenza | Esito |
|---|---|---|
| ui.shadcn.com | `shadcn-ui/ui`, MIT | **Adottato** come base: stile `base-nova` su Base UI. |
| transitions.dev | `Jakubantalik/transitions.dev`, termini propri: uso commerciale e modifica ammessi, redistribuzione della raccolta vietata; Pro in abbonamento | **Adottata la scala di movimento** (durate, curva, scale, sfocature) e i pattern di dialog, menu, tooltip, pannello, schede e scambio d'icona, reimplementati sulle primitive Base UI. Nessun file o snippet copiato. |
| coss.com/ui | `cosscom/coss`: registry in `apps/ui` MIT, pacchetto `packages/ui` AGPL-3.0 | **Ispirazione** per le rifiniture: area di tocco invisibile, testo a 16 px su mobile, luce interna del primario, ombre sottili, icone all'80%. Nessun file copiato; un'eventuale copia futura solo da `apps/ui`, mai da `packages/ui`. |
| beui.dev | `starc007/ui-components`, MIT; Pro a pagamento | **Ispirazione** per lo scambio d'icona della copia e per le liste animate con Motion. Nessun componente copiato. |
| ui-skills.com | `ibelick/ui-skills`, MIT | Skill `baseline-ui`, `improve-ui`, `fixing-accessibility`, `fixing-motion-performance` e `create-design-md` installate a livello utente, fuori dal repository, e usate come metodo di revisione. Non è una dipendenza. |
| designsystemchecklist.com | `ardakaracizmeli/design-system-checklist`, nessuna licenza dichiarata | Elenco di controllo: visione e principi, tono e terminologia, colore, tema scuro, tipografia, profondità, icone, movimento. Nessun testo copiato. |
| reui.io/components | `keenthemes/reui`, MIT per i componenti gratuiti; blocchi Pro a pagamento | Candidato per filtri e tabelle dati quando servirà, nella variante Base UI. Nessun file copiato; Pro escluso. |
| rareui.com | `899ms/rare-ui`, MIT con Commons Clause e link di attribuzione visibile obbligatorio | Nessun componente adottato: animazioni decorative senza funzione nell'app, e l'attribuzione andrebbe esposta. |
| beautifului.dev | Dichiarato MIT, nessun repository pubblico indicato | Orientato a interfacce AI, estranee al prodotto. Nessun uso. |

Componenti presenti: pulsante, campo, area di testo, select, checkbox, switch, radio, etichetta e gruppo di campi, alert dialog, pannello laterale, avviso, badge di stato, scheda, tabella, schede, separatore, tooltip, menu, skeleton, spinner, Codice Fiscale, indicatore di sincronizzazione, stato vuoto. Popover per la campanella. La shell e le sezioni aggiungono navigazione, avvisi brevi dopo un'azione e paginazione «Carica altri» (vedi sotto).

## Shell e anteprima dell'app

La shell ([`app-shell.tsx`](../../app/components/app-shell.tsx)) ha tre destinazioni: Ordini, Negozi eBay, Impostazioni. Su desktop c'è una top navigation con ricerca ordini, campanella e avatar; il campo di ricerca compare da 1024 px, sotto diventa un'icona che apre il pannello, perché a 768 px la barra non contiene tutto. Su mobile ci sono una top bar compatta, con la ricerca in un pannello, e una bottom navigation fissa sopra l'area sicura. Le schermate ([`orders.tsx`](../../app/components/orders.tsx), [`stores.tsx`](../../app/components/stores.tsx), [`settings.tsx`](../../app/components/settings.tsx)) ricevono dati tipizzati da [`view-models.ts`](../../app/view-models.ts) e testi IT/EN da [`app-copy.ts`](../../app/app-copy.ts): le route reali dell'app riusano gli stessi componenti.

- **Ordini:** due schede per riga da 1024 px, una sotto; le schede di una riga hanno la stessa altezza. Nella scheda, su indicazione owner del 2026-09-27, l'ordine viene prima dell'acquirente: numero d'ordine come titolo con importo, poi data, stato e negozio, gli articoli e infine l'acquirente con il dato fiscale. Questa gerarchia sostituisce, per la scheda dell'app, quella del campione `/design`, poi rimosso. Da due colonne ogni scheda occupa quattro righe condivise con quella accanto (subgrid): intestazione, articolo, acquirente e «Dettaglio» partono alla stessa altezza. Numero d'ordine e collegamento «Dettaglio» aprono il dettaglio; su indicazione owner del 2026-09-28 «Dettaglio» sta in fondo alla scheda, a destra con una freccia, lontano dal menu accanto all'importo, che contiene Apri su eBay ed Esporta ordine. Da 640 px acquirente e dato fiscale stanno affiancati. La colonna fiscale ha larghezza fissa (14,5 rem, quanto il riquadro): l'azione («Sblocca ordine», «Riprova») va sotto il riquadro invece di allargare la colonna, così acquirente e codice hanno le stesse proporzioni in ogni scheda. Il riquadro degli stati senza valore misura 224 px e si allarga appena solo se l'etichetta non ci sta, per non andare a capo. Il dettaglio segue lo stesso ordine della scheda: ordine, acquirente, dati fiscali; il riquadro del Codice Fiscale con la sua azione sta però in cima al pannello, sopra le schede Dettagli e Articoli, e raccoglie anche spiegazioni complete, suggerimento, richiesta all'acquirente e fonte: nessuna sezione separata in fondo. Nella scheda le spiegazioni restano brevi quando l'avviso in cima alla pagina spiega già la condizione comune (per esempio «Sblocco disponibile dal 2 ott 2026»). Ogni scheda ha la miniatura dell'articolo; senza immagine un segnaposto neutro con l'icona di un pacco. Aggiornamento e importazione compaiono una sola volta, nell'indicatore dell'intestazione; durante l'importazione la fine dell'elenco dice che altri ordini stanno arrivando. Con eBay che non risponde «Riprova» resta visibile ma disattivato. Un valore sconosciuto dei filtri nell'URL vale come «Tutti», sul server e nell'interfaccia. Nella scheda il dato fiscale ha una forma fissa (etichetta e riquadro di 224 px per ogni stato, con l'azione accanto) e la spiegazione completa sta sotto, a tutta larghezza; restano i primi due articoli con quantità e il numero degli altri. Compattare significa ridurre gli spazi, non togliere informazioni. Su decisione owner D144 la scheda mostra anche stato del pagamento e della spedizione nella riga sotto il numero d'ordine, e sotto acquirente e codice indirizzo di fatturazione completo con Paese, telefono ed email, allineati alle stesse colonne; un contatto che eBay non riporta resta indicato come tale. Filtri, ricerca e paginazione vivono nell'URL. Il dettaglio è un pannello con URL proprio (`ordini/:id`), a tutto schermo su mobile, con schede Dettagli e Articoli; Indietro ed Esc lo chiudono conservando filtri e scorrimento. La modalità Seleziona mostra una barra fissa con conteggio e sole azioni valide; lo sblocco multiplo confronta la selezione con gli sblocchi rimasti e non sceglie al posto dell'utente.
- **Negozi:** tabella leggera su desktop, con l'intera riga cliccabile e la freccia finale, righe impilate su mobile; la colonna Notifiche compare solo con Premium, nel Free la sostituisce una nota con la corona. Le righe della tessera accompagnano solo i negozi che si sincronizzano: sospesi o mai sincronizzati mostrano il solo testo. Nel pannello, «Ricollega» sta nell'avviso del problema e l'autorizzazione scaduta non mostra più la data di validità; pannello con URL proprio per collegamento, sincronizzazione, ultimi aggiornamenti e azioni. «Scollega ed elimina dati» chiede di scrivere il nome del negozio. I problemi di collegamento distinguono collegamento scaduto, autorizzazione incompleta e negozio non verificabile.
- **Impostazioni:** da 768 px tutte le categorie stanno in una sola pagina che scorre, ognuna in un riquadro con la propria icona monocromatica; il menu a sinistra resta fisso e l'indicatore scorre verso la categoria visibile, e un clic porta alla sezione con uno scorrimento fluido. Un indirizzo `impostazioni/:sezione` apre la pagina già sulla sezione. Su mobile restano elenco e poi pagina della singola categoria. I testi vanno a capo sulla larghezza della colonna, senza larghezze massime proprie. Le scelte semplici si salvano da sole con stato in corso, esito e ripristino del valore precedente se il salvataggio fallisce; il modello di messaggio ha un salvataggio esplicito.
- **Nuovi ordini:** come chiede il §17 (scelta owner del 2026-09-28), entrano subito se l'utente è in cima alla lista e non sta selezionando; altrimenti compare l'indicatore e l'utente sceglie quando mostrarli. L'ingresso usa Motion (comparsa breve e riordino FLIP delle schede), azzerato con il movimento ridotto.
- **Accesso e registrazione:** colonna del marchio a sinistra da 1024 px, con i colori del logo e cosa fa FiscalBay, e a destra una scheda con due schede interne, Accedi e Crea account: un solo form visibile evita che il browser compili i campi dell'altro. Pannelli e campo della ragione sociale entrano con `rise-in`. Dopo un errore del server il form torna con i valori inviati, salvo la password, dalla memoria di sessione del browser; l'avviso usa il tono dell'esito. Un indirizzo email non precompila mai il nome.
- **Profilo:** avatar colorato con le iniziali, poi riquadri con icona monocromatica per nome, email e collegamento alla Sicurezza.
- **Negozi, pannello:** sezioni con tessera colorata; azioni in una colonna di pulsanti uguali con icona, poi le due disconnessioni affiancate.
- **Menu dell'avatar:** ogni voce ha la sua icona.
- **Campanella:** il punto delle notifiche da leggere è blu, perché indica una novità e non un errore.
- **Collegamenti testuali:** titolo della scheda e «Dettaglio» hanno la stessa area di tocco invisibile di 44 px dei pulsanti; «Dettaglio» è sottolineato nel colore del testo, per non ripetere il blu su ogni scheda.
- **Pannelli di dettaglio:** all'apertura il focus va sul pannello stesso, così la lettura parte dal titolo e la vista resta in cima.
- **Griglie di pagina:** colonna `minmax(0, 1fr)`, così un contenuto senza a capo (per esempio un nome lungo selezionato in una select) non allarga la pagina oltre lo schermo.
- **Pulsanti disattivati ma raggiungibili:** con `focusableWhenDisabled` Base UI non imposta `disabled` ma `data-disabled`; lo stile attenuato vale per entrambi.
- **Collegamenti con aspetto da pulsante:** `Link` con `buttonVariants` da `button-variants.ts`, non `Button` con `render`, che esporrebbe la navigazione come pulsante.

L'anteprima vive su `/anteprima` e `/en/anteprima`, risponde 404 in Production ed è `noindex`. Gli scenari sintetici ([`app/preview/scenarios.server.ts`](../../app/preview/scenarios.server.ts)) coprono uso ordinario, sblocchi esauriti, aggiornamento in corso, eBay non disponibile, problema su un negozio, dati discordanti, primo accesso, importazione, nessun ordine, caricamento, Premium e Premium a vita. I valori da sbloccare restano sul server: lo sblocco simulato passa da un'azione che verifica appartenenza e quota. Scenario scelto e ordini sbloccati stanno in un cookie tecnico con soli identificativi sintetici. `e2e/app-shell.spec.ts` prova navigazione, dettaglio con URL e Indietro, filtri conservati, sblocco singolo e multiplo, quota esaurita, ricerca, conferma forte, ripristino del salvataggio automatico e mobile IT/EN senza scorrimento orizzontale.

## Registro della provenienza

Componenti copiati nel repository, anche se non compaiono in `package.json`.

| Percorso locale | Origine | Licenza | Modifiche sostanziali |
|---|---|---|---|
| `app/components/ui/*.tsx` (22 file) | Registry shadcn/ui, stile `base-nova`, tramite `shadcn@4.21.0 add` il 2026-09-27 (`popover` aggiunto lo stesso giorno per la campanella) | MIT, © shadcn | Anello di focus pieno e staccato sui pulsanti; area di tocco invisibile e altezze a 44 px con puntatore coarse; testo a 16 px nei campi su mobile; superfici card con ombra sottile e luce interna del primario; varianti di stato in `badge` e `alert` con ruolo ARIA per tono; pulsante secondario grigio, `destructive` a solo testo, `destructive-solid` per le conferme; `AlertDialogClose` aggiunto; `closeLabel` obbligatorio in `sheet`; `dialog` rimosso perché senza consumatori, si rigenera con `shadcn add` riapplicando `closeLabel` quando serve; `label` obbligatorio in `spinner`; animazioni `tw-animate-css` sostituite dai ruoli di movimento; velatura del marchio senza sfocatura; tooltip con attesa di 400 ms; schede con indicatore scorrevole; menu largo almeno quanto il contenuto; pannello a tutta larghezza su mobile; stile selezionato di `FieldLabel` limitato alle schede di scelta; chiave per messaggio in `FieldError`; export non usati e `app/lib/utils.ts` rimossi, varianti del pulsante spostate in `button-variants.ts` per i collegamenti; `popover` con ruolo `motion-popover` e larghezza entro lo schermo; formattazione Oxfmt |
| `app/app.css` | Scheletro generato da `shadcn init` | MIT, © shadcn | Token FiscalBay, tema sistema/chiaro/scuro, Inter, `font-code`, ruoli e animazioni di movimento, riduzione del movimento |

Ulteriori adattamenti delle primitive: `SelectItem` permette il wrapping dei nomi; `SheetContent` separa il contenuto scorrevole dalla chiusura e `SheetHeader` le riserva spazio; `Tabs` trasmette l'orientamento alla primitiva. Le card ordinarie ora sono senza ombra; dialog, alert dialog e pannelli condividono l'ombra `md`. Queste modifiche vanno conservate negli aggiornamenti dei sorgenti.

`app/components/brand.tsx`, `tax-code.tsx`, `empty-state.tsx` e `status.tsx` sono codice originale FiscalBay. Per aggiornare un componente shadcn usare la stessa CLI (`pnpm dlx shadcn@<versione> add <nome>`), senza sovrascrivere i file modificati, poi riapplicare le modifiche elencate e aggiornare questa tabella. Notice e attribuzioni distributive restano nel gate licenze di M7.
