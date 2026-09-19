# FiscalBay 2.0 — Avvio, ripresa e documenti

La baseline contiene la specifica approvata del prodotto, il backlog, gli strumenti documentali e i riferimenti grafici. M0 aggiunge il candidato locale Workers/D1/Better Auth e le prove mirate; non contiene credenziali o configurazioni provider già qualificate. Lo stato eseguibile e i blocchi correnti sono nel solo [BACKLOG.md](BACKLOG.md#stato).

<a id="avvio"></a>

## 1. Avvio iniziale in Codex desktop

### Recuperare e verificare la consegna

Aprire Codex sul checkout locale di `max23468/FiscalBay`, oppure individuarlo/clonarlo nel mandato di avvio. Lo ZIP consegnato si chiama **`FiscalBay_2.0_Finale.zip`** e l’owner lo collocherà in **iCloud Drive → Downloads**. Il percorso macOS standard candidato è `$HOME/Library/Mobile Documents/com~apple~CloudDocs/Downloads/`, da verificare; non è necessariamente `~/Downloads`. Se il file non è disponibile localmente, usare il download di Finder o chiedere l’accesso mirato necessario. Non disabilitare le protezioni del client per raggiungerlo. [Fonti ambiente desktop](docs/SOURCES.md#s28)

Conservare lo ZIP originale ed estrarlo in una cartella temporanea **esterna al checkout**. Ispezionare file e percorsi: nessuna scrittura fuori dalla destinazione di estrazione o esecuzione automatica di script. Dalla radice estratta verificare l’integrità della consegna con uno strumento locale affidabile, per esempio su macOS:

```sh
shasum -a 256 -c SHA256SUMS.txt
```

Dopo aver letto lo script, eseguire anche `node scripts/verify-docs.mjs --assets` se Node è disponibile. Il Node di questo controllo non fissa la baseline applicativa: M0 qualifica le versioni effettive. Non installare dipendenze soltanto per leggere i documenti.

### Adottare nel checkout senza attivare la 1.x

Leggere prima gli AGENTS/override applicabili e lo stato reale (`git status`, branch, remote, HEAD). Non stampare credenziali eventualmente presenti nei remote. Preservare modifiche estranee con branch/worktree appropriato: nessun reset distruttivo o riscrittura della storia.

L’adozione autorizzata aggiorna le **istruzioni del progetto** superate: Telegram-first/Python/VPS, vecchio workflow di pubblicazione e divieti incompatibili con la 2.0. Conservare regole compatibili; non alterare istruzioni globali o superiori. Rileggere hook, workflow, release script e autodeploy: **prima di push/merge attestare che le modifiche non possano attivare il deploy 1.x legato a `main`**. La dismissione anticipata del solo runtime FiscalBay è ammessa; nessuna migrazione su VPS della 2.0 o modifica di risorse condivise estranee. Il vecchio poller non può consumare gli update del bot quando il nuovo backend ne prende il controllo.

Se non è possibile verificare un effetto remoto, lasciare bloccato quel passaggio e proseguire localmente sulle attività indipendenti. La mancanza di accesso alla vecchia VPS non impedisce tutta M0, ma non permette di dichiararne la dismissione.

Integrare i file mediante un diff controllato nei percorsi corrispondenti del repository, **senza annidare la cartella esterna dello ZIP**. Non importare inventari privati, credenziali o altri pacchetti. Gli snapshot in `docs/archive/` sono solo storia: possono rimanere nella consegna esterna, non sono necessari all’app o alla CI. Il relativo controllo di integrità riguarda la consegna, non ogni commit futuro.

Verificare che la sessione usi davvero le istruzioni 2.0 dopo l’allineamento; se mantiene il contesto precedente, riprendere con una nuova sessione sul checkout. Registrare mandato e stato in [BACKLOG.md](BACKLOG.md#stato). Da quel momento il workflow è feature branch → `develop` per test; `main` è candidato, non deploy automatico. [Istruzioni Codex](docs/SOURCES.md#s25)

### Eseguire M0 senza costruire più prodotti

Dopo M0-01, inventario in lettura M0-03 e toolchain minima M0-11 possono avanzare indipendentemente; M0-02 prepara callback/email soltanto per le prove che ne dipendono. Leggere i prerequisiti del [backlog M0](BACKLOG.md#m0), non dedurre l’ordine dal numero dei task.

Seguire il percorso **documentazione e risorse reali → esclusione delle alternative incompatibili → spike dei punti incerti → vertical slice del candidato migliore**. Non implementare integralmente tre stack. Tutti i requisiti bloccanti, compresi i quattro accessi, restano da qualificare; la UI definitiva e la regressione completa si realizzano nelle milestone pertinenti. Gli input mancanti sono nel [catalogo setup](docs/engineering/AGENT_SETUP.md#input): un accesso assente blocca solo il lavoro dipendente.

Il memo M0-14 porta al checkpoint di fine M0: scelta proposta, motivazioni, costi, capacità residua, Auth/database, prove e condizioni residue. Attendere il via dell’owner prima delle attività M1 dipendenti, senza anticipare i checkpoint successivi.

### Eseguire il candidato locale

Usare Node 26.8.2 e pnpm 12.4.1 indicati in `mise.toml` e `package.json`. L’installazione e i gate locali non creano risorse remote:

```sh
pnpm install --frozen-lockfile
pnpm verify
pnpm exec wrangler d1 migrations apply DB --local
pnpm dev
```

Per provare gli endpoint Auth con account controllati, copiare `.dev.vars.example` in `.dev.vars` e sostituire i soli valori test. `EBAY_RUNAME` è il RuName eBay dell’ambiente test, distinto dall’autorizzazione seller. Il file `.dev.vars` resta ignorato da Git. Nessun comando applicativo esegue deploy.

### Mandato pronto da inviare quando si intende partire

Il testo seguente avvia l’implementazione soltanto quando viene inviato dall’owner nella sessione Codex:

```text
Adotta il pacchetto `FiscalBay_2.0_Finale.zip` come baseline del progetto `max23468/FiscalBay` e avvia M0. Lo ZIP si trova in iCloud Drive → Downloads sul mio Mac; cerca quel nome esatto, non uno dei precedenti pacchetti FiscalBay. Il percorso standard candidato è `$HOME/Library/Mobile Documents/com~apple~CloudDocs/Downloads/FiscalBay_2.0_Finale.zip`, ma verificalo: non presumere che coincida con `~/Downloads`. Se il file è solo nel cloud o manca un permesso, chiedi esclusivamente il download/accesso necessario.

Estrai il pacchetto in una cartella temporanea fuori dal checkout, ispeziona contenuti e checksum e leggi `README.md` e `AGENTS.md`, poi le sezioni di Master Plan, backlog e setup indicate per M0. Individua e verifica il checkout locale corretto; se manca, prepara il clone del repository autorizzato. Non sovrascrivere lavoro esistente, non operare direttamente nella cartella iCloud e non usare vecchi pacchetti come baseline concorrenti.

Questo incarico autorizza l’adozione selettiva della documentazione e l’esecuzione di M0 nel perimetro approvato, non un semplice riepilogo del piano. Prima di push o merge verifica le automazioni 1.x, in particolare l’eventuale deploy legato a main. Riallinea le istruzioni del progetto incompatibili con la 2.0, preservando le regole compatibili e quelle superiori. Non avviare i vecchi script di deploy; se un effetto remoto non è verificabile, blocca soltanto quel passaggio e prosegui con il lavoro locale indipendente.

Esegui M0 in modo progressivo: inventario e valutazione documentale, esclusione delle alternative incompatibili, prove mirate dei rischi e vertical slice del candidato migliore. Non implementare in parallelo tutte le architetture né introdurre package, adapter, API o documenti vuoti per usi futuri. Rispetta i quattro login, i diritti commerciali, i controlli sui dati e tutte le decisioni canoniche. Usa gli strumenti già disponibili e configura quelli pertinenti; non presumere connessioni MCP o credenziali ereditate dalla chat.

Hai autonomia sui dettagli tecnici e sulle operazioni previste nel mandato. Non attivare costi non approvati, nuovi provider o Paddle, non modificare risorse di altri progetti e non anticipare i checkpoint. Acquisisci gli input mancanti dal catalogo, chiedendo solo ciò che blocca il lavoro effettivamente necessario.

Mantieni `BACKLOG.md` come unica fonte di avanzamento, prove, blocchi, autorizzazioni ed effetti remoti incompleti. Alla fine di M0 presenta esiti osservati, candidato proposto, costi e capacità residua, Auth/database, rischi e prove ancora da svolgere; fermati per il mio via prima delle attività M1 dipendenti. Nessun go-live o pubblicazione commerciale è autorizzato. Non serve tornare alla conversazione di progettazione.
```

<a id="ripresa"></a>

## 2. Riprendere nelle sessioni successive

Leggere `AGENTS.md`, lo [stato del backlog](BACKLOG.md#stato), i task eleggibili e le sezioni pertinenti della [matrice di lettura](docs/engineering/AGENT_SETUP.md#lettura). Verificare Git e gli ultimi effetti remoti prima di ripetere operazioni; una sessione interrotta non prova che una scrittura sia fallita.

Aggiornare nello stesso backlog attività, blocchi, prossimo passo, checkpoint ed evidenze brevi. Non creare un secondo stato, diario o task tracker. Documenti e codice devono conservare il comportamento canonico; storia della chat e audit vecchi non sono prerequisiti per lavorare.

<a id="documenti"></a>

## 3. Mappa dei documenti e manutenzione

| Documento                                      | Consultarlo per                                                          |
| ---------------------------------------------- | ------------------------------------------------------------------------ |
| [AGENTS.md](AGENTS.md)                         | Regole operative e confini del mandato                                   |
| [Master Plan](docs/MASTER_PLAN.md)             | Requisiti completi, eccezioni, gate, milestone e criteri di accettazione |
| [BACKLOG.md](BACKLOG.md)                       | Stato unico, attività, prerequisiti d’avvio e chiusura, prove            |
| [Decision Register](docs/DECISION_REGISTER.md) | Scelte sintetiche, motivazioni e alternative superate                    |
| [Agent Setup](docs/engineering/AGENT_SETUP.md) | Tool per fase, input, ambienti, custodia e responsabilità documentali    |
| [Fonti](docs/SOURCES.md)                       | Documentazione esterna da verificare quando pertinente                   |
| [Riferimenti brand](docs/brand/REFERENCES.md)  | Concept e immagini originali, non asset finali già approvati             |

Questo README è l’unico ingresso/indice generale. `CLAUDE.md`, se usato, rinvia ad AGENTS senza una seconda policy. Audit della consegna e copertura Q1–Q569 sono snapshot storici in `docs/archive/`, **non fonti correnti da aggiornare o letture ordinarie**. Non serve consegnare la trascrizione del grill: le regole utili sono nel piano e nel registro.

Controllo ordinario dopo modifiche documentali:

```sh
node scripts/verify-docs.mjs
```

Il controllo rileva riferimenti interni rotti, ID duplicati, task inesistenti e cicli del backlog. Non impone numeri di capitoli, Q storiche, ID consecutivi o nomi di documenti non più utili. `--assets` aggiunge la verifica degli originali secondo il manifest; `SHA256SUMS.txt` serve solo a confrontare la consegna iniziale, non a bloccare il normale sviluppo. `pnpm verify` è il gate locale M0; test end-to-end e deploy restano da introdurre soltanto nelle milestone che li richiedono.
