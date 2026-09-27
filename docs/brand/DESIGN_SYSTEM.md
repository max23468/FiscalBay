# Design system

Fondazione visiva di sito e app, circoscritta al prodotto ([§22](../MASTER_PLAN.md#s22)). Il codice è la fonte dei valori: token in [`app/app.css`](../../app/app.css), componenti in [`app/components/ui/`](../../app/components/ui/), stati in [`app/components/status.tsx`](../../app/components/status.tsx). Il campione vive su `/design` e `/en/design`, risponde 404 in Production ed è `noindex`.

## Base tecnica

| Scelta | Versione | Licenza | Motivo |
|---|---|---|---|
| Tailwind CSS + `@tailwindcss/vite` | 4.3.3 | MIT | CSS previsto dallo stack ([§26](../MASTER_PLAN.md#s26)) |
| shadcn/ui, stile `base-nova` | CLI 4.21.0 | MIT | Sorgenti copiati e posseduti, base personalizzabile |
| Base UI (`@base-ui/react`) | 1.8.0 | MIT | Primitive accessibili (focus, tastiera, ARIA); un solo kit al posto di Radix |
| `cn` | 0.4.0 | MIT | Fusione delle classi Tailwind usata dai sorgenti shadcn |
| `class-variance-authority` | 0.7.1 | Apache-2.0 | Varianti dei componenti |
| `tw-animate-css` | 1.4.0 | MIT | Animazioni CSS di apertura e chiusura |
| Lucide (`lucide-react`) | 1.48.0 | ISC | Icone outline uniformi, confermate da D103 |
| Inter Variable (`@fontsource-variable/inter`) | 5.3.0 | OFL-1.1 | Unico sans-serif, lo stesso del wordmark; servito dal nostro dominio |

`shadcn` è una dipendenza di sviluppo: serve soltanto il suo CSS al build. Motion non è installato: bastano transizioni CSS e `tw-animate-css`.

## Token

- **Marchio:** i tre blu del logo, `--brand-blue` `#1A4FA6`, `--brand-navy` `#0E3372`, `--brand-sky` `#4F87E3`. Il primario è il blu medio su chiaro e l'azzurro su scuro.
- **Superfici e testo:** neutri con leggera tinta blu; `background`, `card`, `popover`, `muted`, `foreground`, `muted-foreground`, `border`, `input`, `ring`.
- **Stati**, ciascuno con colore del testo e superficie (`--success` e `--success-surface`, e così via):

| Tono | Significato | Icona |
|---|---|---|
| `success` verde | Riuscito, collegato, accessibile | `CircleCheck` |
| `info` blu | Informazione, operazione in corso | `Info` |
| `warning` ambra | Da verificare, attenzione | `TriangleAlert` |
| `danger` rosso | Errore realmente rilevante | `CircleAlert` |
| `premium` viola | Premium o disponibile da sbloccare | `Sparkles` |
| `neutral` grigio | Dato assente per natura, non un errore | `CircleDashed` |

`StatusBadge` e `StatusAlert` mostrano sempre icona e testo insieme al colore. `StatusAlert` usa `role="alert"` solo per `danger`, altrimenti `role="status"`.

- **Contrasto:** testo almeno 4,5:1 su ogni superficie pertinente, bordo dei campi e anello di focus almeno 3:1, in entrambi i temi. Lo verifica [`test/design-tokens.spec.ts`](../../test/design-tokens.spec.ts) leggendo i valori da `app.css`. Il chip giallo del logo resta un'eccezione del solo marchio.
- **Tipografia:** Inter Variable con `cv11`; scala Tailwind predefinita, titoli `font-semibold`/`font-bold` con `tracking-tight` e `text-balance`; cifre tabellari (`tabular-nums`) per importi e identificativi, monospace per Codice Fiscale e numeri d'ordine.
- **Spaziature, radius, ombre:** scala Tailwind; `--radius` 10 px con derivati da `sm` a `4xl`; ombre leggere dei sorgenti shadcn, senza effetti aggiunti.

## Tema

Tre modalità: sistema (predefinita), chiaro, scuro. I token scuri valgono con `prefers-color-scheme: dark` salvo `data-theme="light"` su `<html>`, oppure con `data-theme="dark"`. La variante Tailwind `dark:` segue la stessa regola. La persistenza della scelta appartiene alle Impostazioni.

## Accessibilità di base

- **Focus:** anello pieno di 3 px nel colore `ring`, visibile su ogni controllo; il dialog porta il focus sull'azione sicura e lo restituisce al pulsante di apertura.
- **Tocco:** con puntatore coarse pulsanti, campi, select, voci di menu, schede ed etichette di checkbox/switch/radio arrivano ad almeno 44 px; con il mouse restano compatti (36 px).
- **Form:** etichetta visibile, descrizione e errore collegati con `aria-describedby`, `aria-invalid`, errori annunciati e focus sul primo campo errato.
- **Testi:** i nomi accessibili che i sorgenti shadcn avevano fissi in inglese (`Close`, `Loading`) sono prop obbligatorie tradotte dal chiamante.
- **Movimento:** con `prefers-reduced-motion: reduce` animazioni e transizioni sono azzerate.

Controllo manuale del 2026-09-27 sul campione, in locale: tema cambiato da tastiera, form inviato vuoto, dialog e pannello aperti e chiusi con tastiera e tocco, IT/EN, 375 px con touch emulato senza scorrimento orizzontale della pagina e con tutti i target a 44 px. Non è una certificazione WCAG AA.

## Catalogo dei nove riferimenti

Valutazione del 2026-09-27. Nessun acquisto Pro e nessun materiale copiato fuori da quanto elencato nel registro.

| Riferimento | Origine e licenza | Esito |
|---|---|---|
| ui.shadcn.com | `shadcn-ui/ui`, MIT | **Adottato** come base: stile `base-nova` su Base UI. |
| coss.com/ui | `cosscom/coss`: registry in `apps/ui` MIT, pacchetto `packages/ui` AGPL-3.0 | Stesse primitive Base UI. Nessun file copiato: i sorgenti shadcn coprono le funzioni attuali. Un'eventuale copia futura solo da `apps/ui`, mai da `packages/ui`. |
| reui.io/components | `keenthemes/reui`, MIT per i componenti gratuiti; blocchi Pro a pagamento | Candidato per filtri e tabelle dati quando servirà, nella variante Base UI. Nessun file copiato; Pro escluso. |
| beui.dev | `starc007/ui-components`, MIT; Pro a pagamento | Richiede Motion. Nessun componente copiato; riferimento per le micro-interazioni del sito pubblico. |
| rareui.com | `899ms/rare-ui`, MIT con Commons Clause e link di attribuzione visibile obbligatorio | Nessun componente adottato: animazioni decorative senza funzione nell'app, e l'attribuzione andrebbe esposta. |
| beautifului.dev | Dichiarato MIT, nessun repository pubblico indicato | Orientato a interfacce AI, estranee al prodotto. Nessun uso. |
| transitions.dev | Termini propri: uso commerciale e modifica ammessi, redistribuzione della raccolta vietata; Pro in abbonamento | Riferimento per durate e curve di dialog, pannelli e toast. Nessun file copiato. |
| ui-skills.com | `ibelick/ui-skills`, MIT | Metodo di review (target 44 px, layout stabile, `text-balance`), non dipendenza. |
| designsystemchecklist.com | `ardakaracizmeli/design-system-checklist`, nessuna licenza dichiarata | Usato solo come elenco di controllo; nessun testo copiato. |

Copertura della checklist: colori, tipografia, spaziature, radius, ombre, icone, movimento, tema e accessibilità di base sono definiti qui; componenti presenti: pulsante, campo, area di testo, select, checkbox, switch, radio, etichetta e gruppo di campi, dialog, pannello laterale, avviso, badge di stato, scheda, tabella, schede, separatore, tooltip, menu, skeleton, spinner. Navigazione, toast e paginazione «Carica altri» arrivano con la shell e le sezioni che li usano.

## Registro della provenienza

Componenti copiati nel repository, anche se non compaiono in `package.json`.

| Percorso locale | Origine | Licenza | Modifiche sostanziali |
|---|---|---|---|
| `app/components/ui/*.tsx` (21 file) e `app/lib/utils.ts` | Registry shadcn/ui, stile `base-nova`, tramite `shadcn@4.21.0 add` il 2026-09-27 | MIT, © shadcn | Anello di focus pieno; altezze a 44 px con puntatore coarse; varianti di stato in `badge` e `alert` con ruolo ARIA per tono; `closeLabel` obbligatorio in `dialog` e `sheet`, pulsante `Close` rimosso da `DialogFooter`; `label` obbligatorio in `spinner`; stile selezionato di `FieldLabel` limitato alle schede di scelta; export delle varianti non usati rimossi; chiave per messaggio in `FieldError`; formattazione Oxfmt |
| `app/app.css` | Scheletro generato da `shadcn init` | MIT, © shadcn | Token FiscalBay, tema sistema/chiaro/scuro, Inter, riduzione del movimento |

Per aggiornare un componente usare la stessa CLI (`pnpm dlx shadcn@<versione> add <nome>`), poi riapplicare le modifiche elencate e aggiornare questa tabella. Notice e attribuzioni distributive restano nel gate licenze di M7.
