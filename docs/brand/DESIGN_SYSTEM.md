# Design system

Fondazione visiva di sito e app, circoscritta al prodotto ([§22](../MASTER_PLAN.md#s22)). Il codice è la fonte dei valori: token e ruoli di movimento in [`app/app.css`](../../app/app.css), primitive in [`app/components/ui/`](../../app/components/ui/), componenti di marchio e dominio in [`app/components/`](../../app/components/). Il campione vive su `/design` e `/en/design`, risponde 404 in Production ed è `noindex`; va rimosso dopo l'approvazione di M1-07.

## Principi

Personalità scelta dall'owner il 2026-09-27: **precisa e sobria**, uno strumento professionale.

1. **Il dato è il protagonista.** Codici Fiscali, numeri d'ordine e importi hanno la tipografia più curata; il resto si fa da parte.
2. **Colore raro e con un significato.** Il blu pieno indica l'azione principale; la superficie colorata segnala solo uno stato che chiede un'azione.
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
- **Tessera illustrata (`TesseraArt`):** nel primo utilizzo tre istanze della tessera originale passano da inclinate e arretrate a una tessera frontale, per suggerire ordini che trovano ordine. Riutilizzo della grafica esistente, senza immagini generate. Ricerca vuota e collegamento scaduto usano piccole icone Lucide accanto al testo.
- **Codice Fiscale (`TaxCode`):** mostrato sempre intero, senza separazioni, per scelta owner del 2026-09-27; `font-code` evita di confondere 0/O e I/1/l. Copia con feedback immediato (icona che diventa conferma, annuncio per i lettori di schermo). Un errore di copia resta visibile fino al nuovo tentativo riuscito. Da bloccato non riceve il valore: mostra sedici punti e un lucchetto viola; allo sblocco usa solo una dissolvenza di 150 ms, senza sfocatura o spostamento del testo.
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
| `premium` viola | Piano Premium | `Sparkles` |
| `locked` viola | Dato da sbloccare | `Lock` |
| `neutral` grigio | Dato assente per natura, non un errore | `CircleDashed` |

`StatusBadge` e `StatusAlert` mostrano sempre icona e testo insieme al colore. `StatusAlert` usa `role="alert"` solo per `danger`, altrimenti `role="status"`.

**Uso sobrio del colore**, scelto dall'owner il 2026-09-27 dopo un confronto affiancato con la resa a superfici piene:

- La superficie colorata spetta solo agli stati che chiedono un'azione. I badge `warning`, `danger` e `locked` sono tinti; `premium`, `success`, `info` e `neutral` sono testo grigio con l'icona colorata. Gli avvisi hanno lo sfondo tinto solo per `danger` e `warning`; gli altri usano la superficie della card con l'icona colorata.
- Il blu pieno è riservato all'azione principale. Il pulsante secondario è grigio.
- Il pulsante distruttivo (`destructive`) è testo rosso su fondo trasparente; il rosso pieno (`destructive-solid`) compare solo nella conferma di un `AlertDialog`.
- Al massimo un accento colorato per riga o scheda.

- **Contrasto:** testo almeno 4,5:1 su ogni superficie pertinente, bordo dei campi e anello di focus almeno 3:1, in entrambi i temi. Lo verifica [`test/design-tokens.spec.ts`](../../test/design-tokens.spec.ts) leggendo i valori da `app.css`. Il chip giallo del logo resta un'eccezione del solo marchio.
- **Tipografia:** Inter Variable con `cv11`; scala Tailwind predefinita, titoli `font-semibold`/`font-bold` con `text-balance`, `tracking-tight` solo sui titoli. `font-code` per codici, numeri d'ordine e importi: cifre tabellari, zero barrato e I maiuscola con grazie, per non confondere 0/O e I/1/l. Nessun monospace di sistema.
- **Spaziature, radius, profondità:** scala Tailwind, `--radius` 10 px; card `xl`, pulsanti e contenitori fiscali `lg`, pillole riservate ai badge brevi. Spazi ravvicinati fra dato e azione, più ampi fra gruppi distinti. Pagina neutra, card con bordo senza ombra, popup/dialog/pannelli con ombra `md`. Il catalogo confronta chiaro e scuro.

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
| Nuovo ordine in lista (Motion) | 250 ms | · | Attende la scelta dell'utente; poi ingresso breve senza sfocatura e riordino FLIP |

Curva unica `cubic-bezier(0.22, 1, 0.36, 1)`; `ease-out` per i tooltip. Si animano `opacity`, `scale` e `translate` come proprietà separate; sfocature solo brevi, una tantum e di 2 px su elementi piccoli; nessun `transition-all`. Il pulsante risponde in 150 ms. Con `prefers-reduced-motion: reduce` animazioni e transizioni sono azzerate e Motion rispetta la stessa preferenza.

## Testi

- **Codice Fiscale in inglese:** su indicazione owner del 2026-09-27, titoli, etichette, intestazioni e azioni usano «Codice Fiscale»; le frasi descrittive usano «tax code». Esempio: colonna `Codice Fiscale`, tooltip «Copy the tax code».
- **Dato assente:** non attribuirne la causa all'acquirente; dire che eBay non lo riporta per l'ordine, oppure «quando disponibile su eBay».
- **Stati vuoti:** primo utilizzo con composizione ampia, tessere e invito a collegare il negozio; ricerca senza risultati compatta accanto ai criteri; collegamento scaduto vicino al negozio e alla sua azione. Nessun bordo tratteggiato. I pulsanti di collegamento del catalogo restano esempi visivi, senza integrazioni.
- **Messaggi operativi:** evento, conseguenza e prossima azione, senza attribuire cause non note. Esempio: «Collegamento scaduto. La sincronizzazione è sospesa. Ricollega il negozio.» Stessa struttura in inglese. Un errore di copia propone il nuovo tentativo o la selezione manuale.
- **Sblocco e Premium:** lucchetto per accesso bloccato, scintilla per il piano. Nella scheda il segnaposto mostra un solo lucchetto; le righe compatte usano il badge. Prima dell'azione si spiega quanti ordini restano. La conferma locale scompare dopo quattro secondi.
- **Gerarchia dei dati:** acquirente a 16 px nella scheda e 14 px nelle righe; CF continuo a 15 px. Il componente fiscale ha angoli arrotondati, bordo e fondo neutri, larghezza uniforme di 224 px entro lo spazio disponibile e copia allineata a destra. Le righe condividono la larghezza della colonna fiscale, anche per gli stati senza codice. Ordine, data e importo sono contesto attenuato; valuta e importo restano uniti. I nomi lunghi restano interi e vanno a capo; gli articoli si aprono sotto il riepilogo. Le conferme non lasciano spazi vuoti quando assenti.
- I testi del campione sono dimostrativi e non introducono funzioni: niente digest email degli ordini, nessuna accettazione di condizioni fuori dai flussi previsti.

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

### Campione di composizione e prove

Il catalogo affianca una scheda ordine e cinque righe compatte: lo stesso primo ordine, nomi lunghi, CF intero e metadati subordinati. Su mobile le composizioni si impilano. Il selettore espone CF da copiare, bloccato, assente, da verificare e aggiornamento fallito. Il normale stato disponibile non aggiunge badge o spiegazioni. Gli articoli sono consultabili con un'apertura nativa. L'avvertenza di anteprima chiarisce che le azioni sono simulazioni locali: nessun caricamento di ordini reali, consumo di quota o navigazione applicativa.

Le prove di geometria IT/EN coprono 320, 375, 640, 768 e 1280 px: assenza di overflow della pagina, colonne allineate, CF senza sovrapposizione con Copia e azioni entro lo schermo. Le prove touch e dei temi completano la verifica; il giudizio sulle proporzioni richiede anche il controllo visivo.

`pnpm test:e2e` usa Playwright con Chromium e avvia un server locale dedicato sulla porta 5186. Alla prima esecuzione installare il browser con `pnpm exec playwright install chromium`. La CI esegue queste prove dopo `pnpm verify`: errori e focus del form, dialog e ritorno del focus, copia fallita e nuovo tentativo, select con nomi lunghi e scheda a 375 px in IT/EN con touch, pannello ad altezza ridotta, schede verticali, stati fiscali e riduzione del movimento. Fixture e appunti simulati restano nel browser del test. Il campione è temporaneo: quando viene rimosso, trasferire le prove applicabili ai consumatori reali senza conservare una route soltanto per i test.

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

Componenti presenti: pulsante, campo, area di testo, select, checkbox, switch, radio, etichetta e gruppo di campi, dialog, alert dialog, pannello laterale, avviso, badge di stato, scheda, tabella, schede, separatore, tooltip, menu, skeleton, spinner, Codice Fiscale, indicatore di sincronizzazione, stato vuoto. Navigazione, toast e paginazione «Carica altri» arrivano con la shell e le sezioni che li usano.

## Registro della provenienza

Componenti copiati nel repository, anche se non compaiono in `package.json`.

| Percorso locale | Origine | Licenza | Modifiche sostanziali |
|---|---|---|---|
| `app/components/ui/*.tsx` (22 file) | Registry shadcn/ui, stile `base-nova`, tramite `shadcn@4.21.0 add` il 2026-09-27 | MIT, © shadcn | Anello di focus pieno e staccato sui pulsanti; area di tocco invisibile e altezze a 44 px con puntatore coarse; testo a 16 px nei campi su mobile; superfici card con ombra sottile e luce interna del primario; varianti di stato in `badge` e `alert` con ruolo ARIA per tono; pulsante secondario grigio, `destructive` a solo testo, `destructive-solid` per le conferme; `AlertDialogClose` aggiunto; `closeLabel` obbligatorio in `dialog` e `sheet`, pulsante `Close` rimosso da `DialogFooter`; `label` obbligatorio in `spinner`; animazioni `tw-animate-css` sostituite dai ruoli di movimento; velatura del marchio senza sfocatura; tooltip con attesa di 400 ms; schede con indicatore scorrevole; menu largo almeno quanto il contenuto; pannello a tutta larghezza su mobile; stile selezionato di `FieldLabel` limitato alle schede di scelta; chiave per messaggio in `FieldError`; export non usati e `app/lib/utils.ts` rimossi; formattazione Oxfmt |
| `app/app.css` | Scheletro generato da `shadcn init` | MIT, © shadcn | Token FiscalBay, tema sistema/chiaro/scuro, Inter, `font-code`, ruoli e animazioni di movimento, riduzione del movimento |

Ulteriori adattamenti delle primitive: `SelectItem` permette il wrapping dei nomi; `SheetContent` separa il contenuto scorrevole dalla chiusura e `SheetHeader` le riserva spazio; `Tabs` trasmette l'orientamento alla primitiva. Le card ordinarie ora sono senza ombra; dialog, alert dialog e pannelli condividono l'ombra `md`. Queste modifiche vanno conservate negli aggiornamenti dei sorgenti.

`app/components/brand.tsx`, `tax-code.tsx`, `empty-state.tsx` e `status.tsx` sono codice originale FiscalBay. Per aggiornare un componente shadcn usare la stessa CLI (`pnpm dlx shadcn@<versione> add <nome>`), senza sovrascrivere i file modificati, poi riapplicare le modifiche elencate e aggiornare questa tabella. Notice e attribuzioni distributive restano nel gate licenze di M7.
