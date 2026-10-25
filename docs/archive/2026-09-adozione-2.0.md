# FiscalBay 2.0 · Procedura di adozione iniziale (archivio)

Snapshot storico della procedura con cui il pacchetto `FiscalBay_2.0_Finale.zip` è stato adottato nel repository e M0 è stata avviata. M0 e M1 sono concluse: la procedura non si ripete e non è una fonte corrente. Avvio e ripresa attuali sono nel [README](../../README.md#avvio).

### Recuperare e verificare la consegna

Aprire Codex sul checkout locale di `max23468/FiscalBay`, oppure individuarlo/clonarlo nel mandato di avvio. Lo ZIP consegnato si chiama **`FiscalBay_2.0_Finale.zip`** e l’owner lo collocherà in **iCloud Drive → Downloads**. Il percorso macOS standard candidato è `$HOME/Library/Mobile Documents/com~apple~CloudDocs/Downloads/`, da verificare; non è necessariamente `~/Downloads`. Se il file non è disponibile localmente, usare il download di Finder o chiedere l’accesso mirato necessario. Non disabilitare le protezioni del client per raggiungerlo. [Fonti ambiente desktop](../SOURCES.md#s28)

Conservare lo ZIP originale ed estrarlo in una cartella temporanea **esterna al checkout**. Ispezionare file e percorsi: nessuna scrittura fuori dalla destinazione di estrazione o esecuzione automatica di script. Dalla radice estratta verificare l’integrità della consegna con uno strumento locale affidabile, per esempio su macOS:

```sh
shasum -a 256 -c SHA256SUMS.txt
```

Dopo aver letto lo script, eseguire anche `node scripts/verify-docs.mjs --assets` se Node è disponibile. Il Node di questo controllo non fissa la baseline applicativa: M0 qualifica le versioni effettive. Non installare dipendenze soltanto per leggere i documenti.

### Adottare nel checkout senza attivare la 1.x

Leggere prima gli AGENTS/override applicabili e lo stato reale (`git status`, branch, remote, HEAD). Non stampare credenziali eventualmente presenti nei remote. Preservare modifiche estranee con branch/worktree appropriato: nessun reset distruttivo o riscrittura della storia.

L’adozione autorizzata aggiorna le **istruzioni del progetto** superate: Telegram-first/Python/VPS, vecchio workflow di pubblicazione e divieti incompatibili con la 2.0. Conservare regole compatibili; non alterare istruzioni globali o superiori. Nell'inventario iniziale rileggere hook, workflow, release script e autodeploy. La dismissione anticipata del solo runtime FiscalBay è ammessa; nessuna migrazione su VPS della 2.0 o modifica di risorse condivise estranee. Il vecchio poller non può consumare gli update del bot quando il nuovo backend ne prende il controllo.

Se non è possibile verificare un effetto remoto, lasciare bloccato quel passaggio e proseguire localmente sulle attività indipendenti. La mancanza di accesso alla vecchia VPS non impedisce tutta M0, ma non permette di dichiararne la dismissione.

Integrare i file mediante un diff controllato nei percorsi corrispondenti del repository, **senza annidare la cartella esterna dello ZIP**. Non importare inventari privati, credenziali o altri pacchetti. Gli snapshot in `docs/archive/` sono solo storia: possono rimanere nella consegna esterna, non sono necessari all’app o alla CI. Il relativo controllo di integrità riguarda la consegna, non ogni commit futuro.

Verificare che la sessione usi davvero le istruzioni 2.0 dopo l'allineamento; se mantiene il contesto precedente, riprendere con una nuova sessione sul checkout. Registrare il via di adozione nel [governo](../MASTER_PLAN.md#s00) e l'avanzamento nella [roadmap](../MASTER_PLAN.md#stato). Da quel momento il workflow è feature branch → `develop` per test; `main` è candidato, non deploy automatico. [Istruzioni Codex](../SOURCES.md#s25)

Il [cutover repository](../MASTER_PLAN.md#m1) è eseguito dopo il via owner di fine M0: `main` contiene soltanto la 2.0 e la 1.x congelata vive nella branch `legacy/1.x`. Il passaggio rende canonici codice e documentazione 2.0 e congela la 1.x in un riferimento Git separato; la dismissione dei componenti 1.x ancora live resta un cutover operativo distinto e deve essere provata sullo stato remoto.

### Eseguire M0 senza costruire più prodotti

Dopo l'adozione autorizzata, inventario in lettura e toolchain minima possono avanzare indipendentemente; callback/email servono soltanto alle prove che ne dipendono. Leggere i prerequisiti di [M0](../MASTER_PLAN.md#m0) e dei [gate](../MASTER_PLAN.md#s36), senza dedurre l'ordine dalla numerazione.

Seguire il percorso **documentazione e risorse reali → esclusione delle alternative incompatibili → spike dei punti incerti → vertical slice del candidato migliore**. Non implementare integralmente tre stack. Tutti i requisiti bloccanti, compresi i quattro accessi, restano da qualificare; la UI definitiva e la regressione completa si realizzano nelle milestone pertinenti. Gli input mancanti sono nel [catalogo setup](../engineering/AGENT_SETUP.md#input): un accesso assente blocca solo il lavoro dipendente.

La scelta del candidato porta al checkpoint di fine M0: motivazioni, costi, capacità residua, Auth/database, prove e condizioni residue. Attendere il via dell'owner prima delle attività M1 dipendenti, senza anticipare i checkpoint successivi. M0/M1 sono già concluse nel checkout corrente: questa procedura di adozione non ne impone la ripetizione.

### Mandato pronto da inviare quando si intende partire

Questo mandato riguarda soltanto una prima adozione; per il checkout già adottato usare la [ripresa](../../README.md#ripresa). Avvia l'implementazione soltanto quando viene inviato dall'owner nella sessione Codex:

```text
Adotta il pacchetto `FiscalBay_2.0_Finale.zip` come baseline del progetto `max23468/FiscalBay` e avvia M0. Lo ZIP si trova in iCloud Drive → Downloads sul mio Mac; cerca quel nome esatto, non uno dei precedenti pacchetti FiscalBay. Il percorso standard candidato è `$HOME/Library/Mobile Documents/com~apple~CloudDocs/Downloads/FiscalBay_2.0_Finale.zip`, ma verificalo: non presumere che coincida con `~/Downloads`. Se il file è solo nel cloud o manca un permesso, chiedi esclusivamente il download/accesso necessario.

Segui la procedura di adozione del README e le istruzioni AGENTS correnti, con governo, gate e roadmap del Master Plan e catalogo input dell'Agent Setup. Il mandato autorizza adozione selettiva ed esecuzione di M0 nel perimetro approvato, preservando lavoro e risorse estranei. Registra scelta, avanzamento e pendenze nel piano; prove nella PR e negli output pertinenti. Alla fine di M0 presenta il candidato e fermati per il via previsto al checkpoint. Nessun nuovo costo, go-live o pubblicazione commerciale autorizzato.
```
