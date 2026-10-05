# Test e pubblicazione

## Controlli proporzionati

`pnpm verify:changed` usa lo stesso classificatore della CI. I documenti ordinari richiedono copy e link; il tooling ammesso richiede anche test degli script, repository, formato e lint. Le modifiche applicative conservano il gate completo e selezionano le prove browser seguendo gli import fino alle route. Moduli condivisi, configurazioni, nuovi percorsi non risolvibili e modifiche ai gate richiedono tutte le prove. I domini critici interessati eseguono anche mutation test, senza considerare timeout o assenza di copertura come successi.

La selezione mirata conserva entrambe le suite funzionali Chromium: i titoli generici di alcune interazioni non consentono una riduzione affidabile per dominio. Riduce le visite del catalogo alle aree coinvolte e riusa la stessa selezione dopo il deploy test. Le mutation includono i consumatori server pertinenti per Auth, sessioni, isolamento, ordini, export, negozi e integrazioni, oltre a quota e diritti.

`Node 26` resta il controllo richiesto. La verifica superata produce `build-<tree>`: un push o una promozione dello stesso tree può riusarlo soltanto da una run CI riuscita dello stesso repository e prima della scadenza. Dopo un merge Dependabot, il workflow avvia esplicitamente la CI sul commit integrato, perché gli effetti del token GitHub non generano un nuovo evento push. I deploy sono serializzati; la verifica delle PR può essere cancellata quando superata da una nuova revisione.

## Tutte le pagine

`e2e/page-cases.ts` dichiara route, parametri e ruoli. `pnpm verify:pages` confronta il catalogo con `app/routes.ts`: aggiungere una route senza scenario blocca il gate. I dati dei parametri dinamici e gli stati significativi si aggiungono nel catalogo; non si deducono tutti i possibili ordini o utenti da un crawler.

Il controllo verifica anche che tutte le sezioni dichiarate delle Impostazioni abbiano un caso in italiano e inglese, e segnala gli scenari rimasti dopo la rimozione di una route.

`pnpm test:pages` visita ogni scenario in italiano e inglese, a 390 e 1280 px, nei due temi, con Chromium e WebKit. Controlla risposta, redirect, lingua, titolo, contenuto, ricarica, navigazione, errori JavaScript e risorse, immagini, collegamenti, overflow, tastiera e WCAG A/AA con axe. Le prove funzionali esistenti verificano le azioni e gli stati dell'anteprima. `pnpm verify:full` aggiunge Firefox e conserva la suite funzionale Chromium. Nessun confronto automatico degli screenshot.

Il database locale contiene utente, amministratore e sessioni sintetiche: non esiste un bypass runtime. Il preview riceve soltanto segreti sintetici, rimossi dall'artefatto prima dell'upload. Il membro verifica sia il dato sbloccato sia l'assenza del dato bloccato dall'HTML. Sul test remoto si usa soltanto l'account di collaudo già previsto; amministratore e MFA non vengono sintetizzati sul provider. Un account remoto indisponibile produce esplicitamente un collaudo parziale. Production esegue soltanto visite anonime e verifica che l'anteprima risponda 404.

In Production l'anteprima assente viene verificata una volta per ciascun pattern di route, in entrambe le lingue e nella matrice dei browser/temi/viewport. Non si ripete lo stesso 404 per ogni identificativo sintetico o sezione della simulazione. La build test mantiene tutti gli scenari.

Il reporter scrive `test-results/browser/summary.json` e il riepilogo GitHub con pagine, browser, esiti e motivi delle esclusioni. Le tracce restano disponibili soltanto in locale; il report remoto non contiene DOM, cookie o dati degli account. Le sentinelle invisibili di Base UI per il cursore VoiceOver in WebKit sono escluse soltanto dalla regola `aria-command-name`: non sono comandi utente. Ogni altro nodo e regola resta controllato. Axe e WebKit non attestano un dispositivo Safari/iOS né i flussi esterni fiscali o di pagamento.

Ogni visita registra route, risposta/percorso attesi, controlli effettivamente completati e omissioni. I collegamenti interni devono risolvere un pattern registrato; la navigazione verifica anche Avanti quando applicabile. Il report identifica commit, ambiente e sorgenti modificati: la release rifiuta un report vuoto, parziale, di un checkout non salvato, di un altro candidato o del dominio test.

Le prove locali usano due worker, quelle remote uno. Ogni caso ha un limite di 60 secondi per visita, audit, ricarica e navigazione; non è una soglia di velocità della pagina. La durata effettiva di ciascun caso entra nel report JSON. Il gate non applica retry automatici per nascondere un errore.

## Artefatto e readback

`node scripts/release.mjs manifest --environment test` registra commit, tree, SHA256 dell'artefatto, configurazione, lockfile, toolchain e hash delle migration. `verify` controlla gli stessi input prima della distribuzione. Un merge può cambiare commit conservando il tree. Il deploy rifiuta un candidato superato sul branch remoto e registra l'identità completa nelle annotazioni della versione Cloudflare.

Il Worker restituisce `x-fiscalbay-version` dal binding nativo di Cloudflare. Il readback confronta questa versione su `/`, `/en` e `/api/auth/get-session`. La ricevuta `reports/release.json` distingue schema applicato, deploy e readback. D1 espone i nomi delle migration applicate: gli hash SQL nella provenienza sono locali, non un attestato byte per byte del remoto.

Quando la precedente versione espone un commit qualificato, le migration già applicate devono coincidere byte per byte con quel sorgente Git. Una versione storica senza identità qualificata non permette questo confronto: il primo ciclo test deve registrare tale limite. La provenienza rifiuta un checkout con modifiche non salvate nel commit.

Le migration nuove additive vengono applicate prima del deploy, poi rilette dal registro D1. Quelle contenenti alterazioni o scritture distruttive richiedono il digest esatto del piano nel campo `reviewed_migrations`. Il primo tentativo senza digest mostra il valore da esaminare e si arresta prima dell'applicazione. Non riutilizzare il digest dopo modifiche al piano. I file delle migration già applicate restano immutabili.

Prima della migration si ricontrolla il candidato remoto; un artefatto diverso dello stesso commit viene rifiutato prima degli effetti. Il piano approvato è salvato nella ricevuta: una ripresa può completarne il sottoinsieme ancora pendente, soltanto con gli stessi hash SQL e lo stesso digest approvato. Un cambiamento della versione provider durante il preflight impedisce il deploy. Una risposta CLI persa dopo un deploy viene riconciliata con l'identità provider, così il rollback può usare un esito effettivamente confermato.

Il rollback automatico è ammesso soltanto senza nuove migration e con precedente versione identificata, configurazione e migration uguali. Altrimenti resta necessario un forward-fix o una compatibilità qualificata. Prima del rollback si rilegge la versione attuale: uno stato cambiato impedisce di sovrascrivere un altro deploy. Il rollback del codice non ripristina dati.

La capacità è un controllo separato, consultivo: campione incompleto o CPU non disponibile producono `non attendibile`, senza presentare un p95 valido. Il campionamento procede per piccoli gruppi aspettando la telemetria.

## Pubblica e ripresa

Il workflow `Pubblica` accetta il commit completo su `main` e la versione presente in `CHANGELOG.md`. Verifica i checkpoint nel backlog e la variabile `PRODUCTION_PUBLISH_ENABLED`; l'environment Production conserva il suo gate owner. Nessuno di questi prerequisiti viene attivato dall'implementazione del workflow.

La configurazione dell'environment richiede `CLOUDFLARE_ACCOUNT_ID`, `PRODUCTION_PUBLISH_ENABLED` e `OWNER_APPROVED_SHA` uguale al candidato autorizzato, oltre al segreto `CLOUDFLARE_API_TOKEN` e ai segreti runtime elencati nella configurazione Wrangler. La CLI e il workflow non impostano questi valori né compilano automaticamente i checkpoint. Nel workflow CI il test usa `TEST_DEPLOY_ENABLED` e il segreto già previsto per l'account di collaudo.

Il confronto è cumulativo dall'ultima release, o dalla radice della storia alla prima pubblicazione. Il candidato esegue il collaudo completo. Production viene ricostruita con `CLOUDFLARE_ENV=production` dagli input fissati, provata localmente e registrata in un artefatto proprio: non si distribuisce la build test in Production. Dopo deploy, readback e collaudo anonimo completi si creano tag e GitHub Release dalle note della versione. Un tag già esistente deve puntare al commit atteso, senza riscritture.

Una ripresa rilegge registro D1, branch e identità provider; le migration già applicate e il deploy già confermato non si ripetono. La creazione della release può ripartire dopo un tag riuscito. Nei tentativi successivi della stessa run i workflow recuperano la ricevuta del tentativo precedente non scaduto, verificandone candidato, artefatto e ambiente prima di usarla. Una nuova run senza tale riferimento non inventa una versione precedente.

Subito prima del tag, `confirm` rilegge branch, versione provider e risposte HTTP, senza applicare migration o ridistribuire. Un cambiamento rispetto alla versione collaudata blocca la release.

Dopo un fallimento del collaudo o del tag, usare la ripetizione dei soli job falliti su GitHub per conservare l'artefatto originale qualificato. Una ricostruzione dello stesso commit con digest diverso viene rifiutata se quel commit è già distribuito: non viene scambiata per una ripresa della stessa versione.

Dopo la promozione, `Riallinea develop` integra la storia di `main` senza forzare il branch e avvia la CI sul nuovo commit. Un conflitto resta una run fallita da risolvere, non una riscrittura. Alla chiusura riconciliare PR, SHA e readback con il backlog; eliminare tramite gli strumenti Codex soltanto branch/worktree temporanei assorbiti e non in uso. La CI non può eliminare checkout locali o lavoro concorrente dell'owner.

Le ricevute remote, il comportamento delle migration, il primo rollback e la ripresa fra run GitHub devono essere qualificati nel prossimo ciclo autorizzato sul test. Recovery, restore dei dati, prova merchant e checkpoint Production restano nei task canonici del backlog.
