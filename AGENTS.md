# FiscalBay 2.0 · Istruzioni operative

## Ingresso, fonti e autonomia

Operare dopo un mandato esplicito di avvio, secondo il [README](README.md#avvio). Rispettare istruzioni di sessione, ambiente e override applicabili. L’adozione allinea le istruzioni **del progetto** 1.x incompatibili; non modifica regole globali o superiori.

Master Plan = requisiti; registro = sintesi/motivazioni; codice/test/configurazioni = stato tecnico; readback provider = stato remoto.

Decidere i dettagli tecnici reversibili ed eseguire autonomamente le attività nel mandato, incluse quelle Production già autorizzate. Non chiedere un via per ogni comando. Non modificare scope, diritti, nuovi costi/provider, privacy o UX sostanziale senza owner.

## Vincoli essenziali

- Web-first, dati eBay in sola lettura; Telegram complementare.
- Non modificare risorse di altri progetti o keyset condivisi senza mandato.
- Permessi server, quota e grant per **ordine**, isolamento e retention su ogni percorso dati/file; nessun aggiramento via ricerca, API, export o job.
- Stripe Managed Payments; il suo comportamento predefinito non sostituisce trial, listino protetto, lifetime e waitlist approvati.
- Sole protezioni native per recovery; un drill riuscito pre-go-live, non backup esterni o ripetizioni periodiche aggiunte d’ufficio.
- Nessun offline 2.x. Expo 3.x: riuso ragionato, non UI universale o API aggiuntive senza consumatori.

## Implementazione e Git

Nei titoli delle pagine del sito usare ` | ` come separatore. Gli em dash (U+2014), anche codificati come entità HTML o escape Unicode, sono vietati in tutti i file della repository, inclusi documenti, commenti e test. `pnpm verify:copy`, incluso in `pnpm verify`, controlla i file versionati e quelli nuovi non ignorati da Git.

Controllare stato, branch, diff e istruzioni vicine prima di scrivere. Preservare lavoro altrui; no reset distruttivi o riscritture della storia. Un blocco remoto non ferma le prove locali indipendenti.

Seguire feature branch → `develop`, test dai merge, `main` candidato e Production soltanto con `Promuovi`. La 1.x è dismessa e la sua branch eliminata: il commit finale `508ded87` resta raggiungibile da `v2.0.0`.

Le PR verso `develop` richiedono il controllo `Node 26`. Ogni PR porta codice, istruzioni o documentazione di prodotto, mai soltanto readback o chiusura, e dichiara nel template «Impatto sul piano: aggiornato / non necessario, con motivo»: cambi a requisiti, checkpoint, stato dei task, avanzamento significativo o questioni aperte aggiornano il Master Plan nella stessa PR, prima del merge. Le migration non additive si approvano nella PR con la riga `reviewed-migrations`. Il collaudo spetta all'agente, prima del merge: prove locali dell'area, area reale e anteprima, CI. La stessa PR porta il task a «Completato» nella forma breve dell'[avanzamento](docs/MASTER_PLAN.md#stato), che `verify-docs` controlla: prove e collaudi restano nella PR; ciò che solo l'owner può provare si dichiara prima di `Pubblica`. Una modifica chiesta durante una qualifica entra nella PR in corso anche se la CI riparte. Gli altri casi sono nel [contenuto delle PR](docs/engineering/RELEASE.md#contenuto-delle-pr).

Chiudere ogni merge su `develop` riconciliando PR, commit e readback ed eliminando il branch della PR; i residui di cicli precedenti si puliscono a lotti e in ogni `Promuovi` secondo il [governo](docs/MASTER_PLAN.md#s34). Conservare riferimenti con lavoro non integrato o ancora in uso; una pulizia rimasta sospesa è una questione aperta nel piano.

Cloudflare si gestisce con `pnpm exec cf` alla versione fissata e con `cloudflare.config.ts`: modalità `live` per Production, test negli altri casi; Wrangler soltanto per `tail` e, finché `cf --local` non termina, per D1 locale in `scripts/local-d1.mjs` (D170).

pnpm, latest stable **qualificata**, pin nei manifest/lockfile. Dipendenze opzionali solo con un uso concreto. Primitive native per HTTP/crypto e servizi scelti per code/retry quando bastano; mantenere deduplica e invarianti applicativi. Entità logiche non impongono altrettante tabelle; nessuna versione dati senza cambiamento utile.

Gli artefatti durevoli descrivono prodotto, dominio e comportamento, non il piano di lavoro. Non usare nomi o sigle di milestone, task, fasi, spike o vertical slice nel codice o nei nomi di componenti, moduli, file, cartelle, servizi, risorse provider, package/versioni tecniche, configurazioni, fixture, test, log, metriche o copy runtime. Tali riferimenti restano nella documentazione di piano; fuori da lì sono ammessi soltanto per artefatti realmente temporanei, identificati come tali e destinati alla rimozione. Non rinominare per questo motivo una migration già applicata: il nome registrato dal database è un vincolo di compatibilità. Documenti e voci del piano hanno la lunghezza che la sostanza richiede, senza sezioni riassuntive, ripetizioni o boilerplate.

## `Pubblica` e `Promuovi`

Una richiesta affermativa e inequivocabile di pubblicare la modifica corrente (`Pubblica`) autorizza senza seconda conferma il ciclo verso il test: commit, PR verso `develop` con merge automatico e monitoraggio attivi, CI, deploy test quando il diff distribuisce, readback riferito in chat e pulizia del branch, con `pnpm release:cycle pr <numero>` e senza nuovo sollecito. `Promuovi` autorizza allo stesso modo il ciclo Production del lotto su `develop`: promozione su `main`, workflow `publish.yml` sullo SHA atteso, migration, deploy, readback, tag e release, poi la pulizia di [§34](docs/MASTER_PLAN.md#s34). Domande, ipotesi e negazioni non li autorizzano.

Una richiesta di `Promuovi` con un gate Production non completato riceve l'elenco dei prerequisiti mancanti, senza PR verso `main` né avvio del workflow. Nessuno dei due comandi concede checkpoint, Stripe live, Paddle, nuovi costi o provider.

## Verifica, dati e ripresa

`node scripts/verify-docs.mjs` è incluso. Gli script applicativi `pnpm verify`, build, test e deploy devono essere creati e provati prima di dichiararli disponibili. Test proporzionati al rischio: prima della PR, in locale, gate e prove mirate all'area, mentre la suite browser completa resta alla CI ([pubblicazione](docs/engineering/RELEASE.md)). DONE soltanto con comportamento, prove pertinenti e documentazione coerenti. Non abbassare un gate per produrre un esito verde. Recovery dei dati separato dal rollback del codice. Audit e verifiche live con un account reale usano gli account dell'[inventario privato](docs/engineering/AGENT_SETUP.md#account-delle-verifiche-live), senza riportarne gli indirizzi nel repository, nelle PR o nei log. Alla ripresa leggere avanzamento, poi verificare Git, PR/CI e ricevute pertinenti prima di ripetere scritture.
