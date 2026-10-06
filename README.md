# FiscalBay 2.0 · Avvio, ripresa e documenti

FiscalBay 2.0 usa Workers/D1/Better Auth. Il [Master Plan](docs/MASTER_PLAN.md) contiene requisiti e roadmap, [avanzamento e questioni aperte](docs/MASTER_PLAN.md#stato); i via effettivi sono nel suo [governo](docs/MASTER_PLAN.md#s00). Codice/test/configurazioni attestano l'implementazione, PR/CI le verifiche e ricevute/readback lo stato remoto. Segreti e inventari privati restano fuori dal repository.

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

L’adozione autorizzata aggiorna le **istruzioni del progetto** superate: Telegram-first/Python/VPS, vecchio workflow di pubblicazione e divieti incompatibili con la 2.0. Conservare regole compatibili; non alterare istruzioni globali o superiori. Nell'inventario iniziale rileggere hook, workflow, release script e autodeploy. La dismissione anticipata del solo runtime FiscalBay è ammessa; nessuna migrazione su VPS della 2.0 o modifica di risorse condivise estranee. Il vecchio poller non può consumare gli update del bot quando il nuovo backend ne prende il controllo.

Se non è possibile verificare un effetto remoto, lasciare bloccato quel passaggio e proseguire localmente sulle attività indipendenti. La mancanza di accesso alla vecchia VPS non impedisce tutta M0, ma non permette di dichiararne la dismissione.

Integrare i file mediante un diff controllato nei percorsi corrispondenti del repository, **senza annidare la cartella esterna dello ZIP**. Non importare inventari privati, credenziali o altri pacchetti. Gli snapshot in `docs/archive/` sono solo storia: possono rimanere nella consegna esterna, non sono necessari all’app o alla CI. Il relativo controllo di integrità riguarda la consegna, non ogni commit futuro.

Verificare che la sessione usi davvero le istruzioni 2.0 dopo l'allineamento; se mantiene il contesto precedente, riprendere con una nuova sessione sul checkout. Registrare il via di adozione nel [governo](docs/MASTER_PLAN.md#s00) e l'avanzamento nella [roadmap](docs/MASTER_PLAN.md#stato). Da quel momento il workflow è feature branch → `develop` per test; `main` è candidato, non deploy automatico. [Istruzioni Codex](docs/SOURCES.md#s25)

Il [cutover repository](docs/MASTER_PLAN.md#m1) è eseguito dopo il via owner di fine M0: `main` contiene soltanto la 2.0 e la 1.x congelata vive nella branch `legacy/1.x`. Il passaggio rende canonici codice e documentazione 2.0 e congela la 1.x in un riferimento Git separato; la dismissione dei componenti 1.x ancora live resta un cutover operativo distinto e deve essere provata sullo stato remoto.

### Eseguire M0 senza costruire più prodotti

Dopo l'adozione autorizzata, inventario in lettura e toolchain minima possono avanzare indipendentemente; callback/email servono soltanto alle prove che ne dipendono. Leggere i prerequisiti di [M0](docs/MASTER_PLAN.md#m0) e dei [gate](docs/MASTER_PLAN.md#s36), senza dedurre l'ordine dalla numerazione.

Seguire il percorso **documentazione e risorse reali → esclusione delle alternative incompatibili → spike dei punti incerti → vertical slice del candidato migliore**. Non implementare integralmente tre stack. Tutti i requisiti bloccanti, compresi i quattro accessi, restano da qualificare; la UI definitiva e la regressione completa si realizzano nelle milestone pertinenti. Gli input mancanti sono nel [catalogo setup](docs/engineering/AGENT_SETUP.md#input): un accesso assente blocca solo il lavoro dipendente.

La scelta del candidato porta al checkpoint di fine M0: motivazioni, costi, capacità residua, Auth/database, prove e condizioni residue. Attendere il via dell'owner prima delle attività M1 dipendenti, senza anticipare i checkpoint successivi. M0/M1 sono già concluse nel checkout corrente: questa procedura di adozione non ne impone la ripetizione.

### Eseguire il candidato locale

Usare Node 26.10.0 e pnpm 12.9.1 indicati in `mise.toml` e `package.json`. L’installazione e i gate locali non creano risorse remote:

```sh
pnpm install --frozen-lockfile
pnpm verify
pnpm exec wrangler d1 migrations apply DB --local
pnpm dev
```

Per provare gli endpoint Auth con account controllati, copiare `.dev.vars.example` in `.dev.vars` e sostituire i soli valori test. `EBAY_RUNAME` è il RuName eBay dell’ambiente test, distinto dall’autorizzazione seller. Il file `.dev.vars` resta ignorato da Git. Nessun comando applicativo esegue deploy.

### Negozi eBay Production e Sandbox sul sito test

Il collegamento dei negozi mantiene eBay Production come scelta predefinita. Sul dominio
`test.fiscalbay.it` e in locale, `EBAY_SANDBOX_ENABLED=true` abilita la scelta Sandbox soltanto
quando sono presenti i tre segreti `EBAY_SANDBOX_CLIENT_ID`, `EBAY_SANDBOX_CLIENT_SECRET` e
`EBAY_SANDBOX_RUNAME`. Le credenziali `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET` e `EBAY_RUNAME`
continuano a servire i negozi Production e il login eBay, distinto dal consenso seller.
Il dominio pubblico `fiscalbay.it` non permette collegamenti Sandbox.

Applicare la migration `0014_ebay_environments.sql` prima del codice. I negozi esistenti restano
Production con ID, token e ordini invariati. La sessione OAuth conserva l'ambiente scelto sul
server; lettura iniziale e rinnovi usano chiavi ed endpoint dello stesso ambiente. Account e
ordini con ID uguali nei due ambienti rimangono distinti. I nomi dei negozi sugli ordini Sandbox
riportano `(Sandbox)` e gli inviti a ricollegare conservano l'ambiente originale. L'elenco ordini
mostra Production per impostazione predefinita; sul test il selettore permette di consultare
separatamente Sandbox, senza mescolare le due fonti nello stesso elenco.

Nel keyset Sandbox configurare il RuName con callback accettato e rifiutato
`https://test.fiscalbay.it/api/auth/callback/ebay`, mantenendo i soli scope base,
`commerce.identity.readonly` e `sell.fulfillment.readonly`. Custodire i valori dei segreti nel
Worker test, mai nel repository. Il flag è abilitato nella configurazione test e disabilitato
in Production; la scelta resta nascosta finché mancano i segreti. Verificare il callback prima
di configurare i segreti. Nessuna configurazione
Sandbox richiede di cambiare il keyset Production.

### Mandato pronto da inviare quando si intende partire

Questo mandato riguarda soltanto una prima adozione; per il checkout già adottato usare la [ripresa](#ripresa). Avvia l'implementazione soltanto quando viene inviato dall'owner nella sessione Codex:

```text
Adotta il pacchetto `FiscalBay_2.0_Finale.zip` come baseline del progetto `max23468/FiscalBay` e avvia M0. Lo ZIP si trova in iCloud Drive → Downloads sul mio Mac; cerca quel nome esatto, non uno dei precedenti pacchetti FiscalBay. Il percorso standard candidato è `$HOME/Library/Mobile Documents/com~apple~CloudDocs/Downloads/FiscalBay_2.0_Finale.zip`, ma verificalo: non presumere che coincida con `~/Downloads`. Se il file è solo nel cloud o manca un permesso, chiedi esclusivamente il download/accesso necessario.

Segui la procedura di adozione del README e le istruzioni AGENTS correnti, con governo, gate e roadmap del Master Plan e catalogo input dell'Agent Setup. Il mandato autorizza adozione selettiva ed esecuzione di M0 nel perimetro approvato, preservando lavoro e risorse estranei. Registra scelta, avanzamento e pendenze nel piano; prove nella PR e negli output pertinenti. Alla fine di M0 presenta il candidato e fermati per il via previsto al checkpoint. Nessun nuovo costo, go-live o pubblicazione commerciale autorizzato.
```

<a id="ripresa"></a>

## 2. Riprendere nelle sessioni successive

Leggere `AGENTS.md`, [avanzamento e questioni aperte](docs/MASTER_PLAN.md#stato), checkpoint e milestone pertinente, poi le sole sezioni della [matrice di lettura](docs/engineering/AGENT_SETUP.md#lettura) necessarie. Verificare Git, PR/CI e ricevute degli ultimi effetti remoti prima di ripetere operazioni; una sessione interrotta non prova che una scrittura sia fallita.

Aggiornare il piano nella stessa PR quando cambiano requisiti, checkpoint, stato dei task, avanzamento significativo o questioni aperte. Nel template dichiarare «Impatto sul piano: aggiornato / non necessario, con motivo»; fix ordinari e miglioramenti dei test restano nella PR con le loro prove. Non mantenere un secondo stato, diario o tracker; la cronologia è in Git. Chat e audit vecchi non sono prerequisiti per lavorare.

<a id="documenti"></a>

## 3. Mappa dei documenti e manutenzione

| Documento                                      | Consultarlo per                                                          |
| ---------------------------------------------- | ------------------------------------------------------------------------ |
| [AGENTS.md](AGENTS.md)                         | Regole operative e confini del mandato                                   |
| [Master Plan](docs/MASTER_PLAN.md)             | Requisiti, gate, roadmap, avanzamento sintetico, checkpoint e questioni aperte |
| PR, CI e ricevute di pubblicazione            | Modifiche/verifiche dell'intervento e stato remoto osservato |
| [Decision Register](docs/DECISION_REGISTER.md) | Scelte sintetiche, motivazioni e alternative superate                    |
| [Agent Setup](docs/engineering/AGENT_SETUP.md) | Tool per fase, input, ambienti, custodia e responsabilità documentali    |
| [Fonti](docs/SOURCES.md)                       | Documentazione esterna da verificare quando pertinente                   |
| [Riferimenti brand](docs/brand/REFERENCES.md)  | Concept e immagini originali, non asset finali già approvati             |
| [Design system](docs/brand/DESIGN_SYSTEM.md)  | Token, componenti, catalogo dei riferimenti e provenienza                |

Questo README è l’unico ingresso/indice generale. `CLAUDE.md`, se usato, rinvia ad AGENTS senza una seconda policy. Audit della consegna e copertura Q1–Q569 sono snapshot storici in `docs/archive/`, **non fonti correnti da aggiornare o letture ordinarie**. Non serve consegnare la trascrizione del grill: le regole utili sono nel piano e nel registro.

Controllo ordinario dopo modifiche documentali:

```sh
node scripts/verify-docs.mjs
```

Il controllo rileva link e ancore interni rotti, tabelle incoerenti, decisioni duplicate/inesistenti e gate Production mancanti o non validi. Gli stati aperti sono ammessi nel piano, ma bloccano la pubblicazione. Non impone un tracker separato, un grafo dei task verificato dallo script o ID consecutivi. `--assets` aggiunge la verifica degli originali secondo il manifest; `SHA256SUMS.txt` serve solo a confrontare la consegna iniziale. Comandi e gate attuali sono in `package.json` e [Agent Setup](docs/engineering/AGENT_SETUP.md); il percorso di pubblicazione è in [RELEASE](docs/engineering/RELEASE.md).
