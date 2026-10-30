# FiscalBay · Setup degli strumenti e contesto operativo

L’avvio e la ripresa sono nel [README](../../README.md); autonomia e checkpoint nel [governo](../MASTER_PLAN.md#s00). Qui si documentano strumenti necessari, input e custodia. Non è una certificazione che gli accessi siano già configurati. Le [fonti](../SOURCES.md) vanno verificate sul client/versione effettivi.

## 1. Strumenti e comandi

Gli strumenti si configurano quando la capacità li richiede: Git e GitHub, `pnpm exec cf` per Cloudflare, SDK e CLI Stripe con contesti test e live espliciti, API Telegram con un bot di test separato, strumenti eBay come sotto. SDK, MCP o framework aggiuntivi entrano soltanto se risparmiano lavoro concreto; Paddle e il relativo tooling restano soltanto su decisione dell'owner, finché Stripe è primario.

Claude Code lavora sul Mac con file e CLI locali, nelle sessioni cloud e nei thread del progetto Claude con il clone del repository e i connettori autorizzati. Non assumere che un MCP presente in un’altra applicazione o una skill citata nella chat sia già disponibile qui. Le skill guidano l’implementazione, non prevalgono su scope e checkpoint. `/grill-me` e `/grill-with-docs` non sono dipendenze dell’app.

### Comandi del progetto

| Comando | Responsabilità |
|---|---|
| `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm typegen` | Oxfmt, Oxlint (anche cicli degli import), compilatore e tipi generati di Cloudflare e React Router; versioni nel lockfile e nelle configurazioni. |
| `pnpm test`, `pnpm test:coverage` | Vitest con i progetti Node e Cloudflare: dominio, integrazioni e risposte delle route; il gate usa la variante con la copertura ([qualità](RELEASE.md#qualita-del-codice-e-prestazioni)). |
| `pnpm test:e2e`, `pnpm test:pages`, `pnpm verify:pages` | Playwright con axe sulla build locale in Chromium e WebKit: flussi funzionali, catalogo delle pagine e suo confronto con le route ([tutte le pagine](RELEASE.md#tutte-le-pagine)). |
| `pnpm test:e2e:smoke` | Controllo breve sul dominio test dopo il deploy ([tutte le pagine](RELEASE.md#tutte-le-pagine)). |
| `pnpm verify:repo`, `pnpm verify:copy`, `pnpm test:scripts` | Regole di repository, em dash compreso, e test degli script in `scripts/**/*.test.mjs`, con casi negativi. |
| `pnpm quality:knip`, `pnpm doctor:react` | File, dipendenze ed export inutilizzati; regole React ([qualità](RELEASE.md#qualita-del-codice-e-prestazioni)). |
| `pnpm build` | Artefatto del runtime selezionato, nessun deploy implicito. |
| `pnpm verify:changed`, `pnpm verify`, `pnpm verify:full` | Gate per livello scelto dal classificatore, gate completo e gate con tutte le prove browser; le sequenze sono soltanto in `package.json` ([controlli proporzionati](RELEASE.md#controlli-proporzionati)). |
| `pnpm benchmark`, `pnpm test:mutation <file>...` | Comandi fuori dalle PR: misure sintetiche a richiesta e mutation dei moduli critici ([mutation](RELEASE.md#mutation-test)). |
| `pnpm release:cycle` | Cicli autorizzati di `Pubblica` e `Promuovi`, ripresa, stato delle run e controllo della base delle PR nella CI ([ciclo operativo](RELEASE.md#ciclo-operativo)). |

La tabella descrive i comandi presenti e le loro responsabilità; prove in PR/CI e ricevute, qualifiche mancanti nelle [questioni aperte](../MASTER_PLAN.md#questioni-aperte). Node locale/CI non è il runtime Workers o Supabase. Librerie opzionali non si installano per riempire un catalogo.

## 2. Due livelli di verifica dei tool

**Consultazione di documentazione pubblica:** origine ufficiale/affidabile, configurazione minima, nessun permesso di account non necessario e una ricerca/lettura riuscita. Basta una nota breve quando serve; non occorrono prove di scrittura, isolamento tenant o revoca di credenziali che non esistono.

**Accesso a dati privati o operazioni:** verificare account, risorsa, ambiente e scope minimi; custodire la credenziale fuori dal repository, provare una lettura innocua e, quando necessaria al mandato, una scrittura limitata in test con readback/cleanup. Documentare come revocare l’accesso e verificare il confine test/live. Una credenziale admin non prova che il percorso merchant sia sicuro: i test di autorizzazione usano sessioni/ruoli reali del caso.

CLI e MCP dello stesso provider condividono le prove funzionali dell’integrazione. Verificare separatamente soltanto i rispettivi accessi e le differenze di capacità: non rifare tutta la qualifica eBay/Stripe due volte. Nessun obbligo di scrittura o cancellazione di prova in Production per certificare un tool. Applicare conferme imposte dal client senza scavalcarle; non assegnare accesso globale per evitare un singolo blocco.

<a id="ebay-skills"></a>
### Skill di migrazione delle API eBay

Le Public API migration Agent Skills 1.0.0 di eBay (Apache 2.0, pacchetto `public-api-migration-skills-1.0.0.tgz` della pagina [AI Tools](https://developer.ebay.com/develop/tools/ai-tools), SHA-256 `446e407b83125d685d339bdee989f38335e0d1a06a70160fc186dabdfa519005`) restano sul Mac, fuori dal repository: il pacchetto, con licenza e README di eBay, è in `~/.agents/vendor/ebay-public-api-migration-skills/`. Contiene soltanto Markdown: nessuno script, permesso di tool o istruzione eseguibile, verificati il 2026-10-27 prima dell'installazione. Le nove skill sono collegamenti simbolici `ebay-<dominio>` in `~/.claude/skills/` per Claude Code e in `~/.agents/skills/` per Codex, senza copie; le sessioni cloud non le hanno. L'unica modifica locale sostituisce con spazi le tabulazioni del frontmatter di `authorization`, `listing-management` e `listing-metadata`, che Codex rifiuta come YAML non valido.

Le skill guidano la pianificazione delle migrazioni dalle chiamate Trading alle API moderne; non autorizzano nuovi scope né modifiche al runtime senza la decisione dell'owner. Una nuova versione si installa sostituendo la cartella del pacchetto, ripetendo la verifica dei file e riapplicando la correzione del frontmatter se ancora necessaria. Come fonti gli agenti usano la versione «View as Markdown» delle guide (per esempio `https://developer.ebay.com/develop/guides/modern-apis-migration-guide.md`), lo schema GraphQL `https://developer.ebay.com/develop/api/spec/listing.graphqls` e le specifiche AsyncAPI dei topic in `/develop/api/spec/events/`, che si scaricano con `curl` anche quando le pagine HTML rispondono 403; il browser resta il ripiego. Prima di scrivere codice le chiamate si qualificano con API Explorer e GraphQL Explorer; le poche query GraphQL usano schemi zod scritti a mano, senza generatori di codice. L'assistente AI del portale eBay serve soltanto come primo filtro: documentazione, specifiche e letture controllate restano le fonti.

<a id="ebay-mcp"></a>
### Server MCP di eBay

Il server ufficiale [`@ebay/npm-public-api-mcp`](https://github.com/eBay/npm-public-api-mcp) 1.1.0 (Apache 2.0, Node 22 o superiore) è registrato come `ebay` in `.mcp.json` per Claude Code e in `.codex/config.toml` per Codex. Entrambi avviano `scripts/ebay-mcp.mjs`, che:

- usa soltanto la modalità applicazione del keyset Production `botCF`: specifiche, metadati e API pubbliche;
- legge Client ID e Cert ID dalle voci «FiscalBay eBay Production Client ID» e «FiscalBay eBay Production Client Secret» del Portachiavi macOS, senza scriverli in file, argomenti o log;
- esegue con `npx` la versione fissata senza script di installazione, fuori dal checkout, perché il server carica il `.env` della cartella di avvio, e non eredita variabili `EBAY_*`.

Fuori dal Mac, comprese le sessioni cloud, il keyset non è disponibile e il server non parte.

Il codice letto il 2026-10-27 accetta in Production soltanto richieste GET e invia il token solo ad `api.ebay.com`. `query_ebay_api` cerca nelle specifiche tramite un servizio di eBay; `call_ebay_api` esegue la chiamata e restituisce all'agente la risposta grezza. Prova dello stesso giorno: avvio, elenco dei due strumenti, ricerca nelle specifiche e lettura della Taxonomy API riuscite, POST rifiutata dal server. `getTopic` della Notification API con il token dell'applicazione risponde con l'errore interno 2003, mentre con il token di un venditore funziona.

La modalità utente è esclusa per decisione dell'owner del 2026-10-27. Con il token di un negozio il server leggerebbe senza filtri nomi, indirizzi e CF degli acquirenti, mentre licenza e DPA di eBay limitano i dati degli altri utenti allo stretto necessario e ai fornitori vincolati alle stesse condizioni. Per revocare l'accesso degli agenti basta eliminare le due voci del Portachiavi; la rotazione del Cert ID dal portale eBay invalida anche i segreti del Worker e va coordinata con quelli.

La riuscita di una chiamata dimostra quella chiamata, non l’intera funzionalità. Sandbox, simulazioni e prove reali sono distinti secondo [§36](../MASTER_PLAN.md#s36); ciò che non è osservabile va assegnato al gate reale competente. I tool di sviluppo non diventano dipendenze del runtime del prodotto.

<a id="lettura"></a>
## 3. Lettura mirata per attività

Leggere AGENTS, avanzamento e questioni aperte nel piano, poi la capacità interessata e le sezioni pertinenti. La tabella non è un secondo grafo di dipendenze; sicurezza, privacy, localizzazione e prove si applicano a ogni funzione interessata.

| Attività | Sezioni canoniche |
|---|---|
| Adozione/M0 | [Governo](../MASTER_PLAN.md#s00), [scope](../MASTER_PLAN.md#s02), [architettura](../MASTER_PLAN.md#s25), [stack](../MASTER_PLAN.md#s26), [gate](../MASTER_PLAN.md#s36), [superati](../MASTER_PLAN.md#s40) |
| Auth/account/negozi | [Auth](../MASTER_PLAN.md#s07), [negozi](../MASTER_PLAN.md#s08), [sicurezza](../MASTER_PLAN.md#s29), [privacy](../MASTER_PLAN.md#s30) |
| Ordini/sync | [Ordini](../MASTER_PLAN.md#s09), [suggerimenti](../MASTER_PLAN.md#s10), [sync](../MASTER_PLAN.md#s11), [dati](../MASTER_PLAN.md#s27), [servizi](../MASTER_PLAN.md#s28) |
| UI/brand/sito | [Navigazione](../MASTER_PLAN.md#s16)–[onboarding](../MASTER_PLAN.md#s20), [brand](../MASTER_PLAN.md#s21), [design](../MASTER_PLAN.md#s22), [SEO](../MASTER_PLAN.md#s23), [reference](../brand/REFERENCES.md), [audit UI/UX](../archive/2026-10-03-audit-ui-ux-test-2.0.md) |
| Piani/Stripe | [Piani](../MASTER_PLAN.md#s04), [Free](../MASTER_PLAN.md#s05), [billing](../MASTER_PLAN.md#s06), [fonti Stripe](../SOURCES.md#s01) |
| Export/comunicazioni/admin | [Export](../MASTER_PLAN.md#s12), [Telegram](../MASTER_PLAN.md#s13), [email](../MASTER_PLAN.md#s14), [admin](../MASTER_PLAN.md#s15), [dominio](../MASTER_PLAN.md#s24) |
| Operations/test/release | [Sicurezza](../MASTER_PLAN.md#s29)–[recovery](../MASTER_PLAN.md#s32), [Git/release](../MASTER_PLAN.md#s34), [test](../MASTER_PLAN.md#s35), [milestone](../MASTER_PLAN.md#s37), [rischi](../MASTER_PLAN.md#s38), [DoD](../MASTER_PLAN.md#s41) |
| Documentazione | [Governo](../MASTER_PLAN.md#s00), [README](../../README.md#documenti), fonte interessata e relativa milestone; procedura di adozione in archivio solo per ricostruzioni storiche eccezionali |

<a id="input"></a>
## 4. Input esterni

Prima di chiedere un input controllare checkout, tool autorizzati e inventario privato. I seguenti sono prerequisiti da acquisire, non dati già forniti o risorse già esistenti. Richiedere solo l’input necessario attraverso un canale adatto, senza dump di credenziali o ritorno alla chat di progettazione.

| ID | Input / responsabilità | Quando e acquisizione | Se manca |
|---|---|---|---|
| IN-01 | Mandato di adozione/avvio e checkout corretto | Avvio owner, remote/branch/commit verificati nell'adozione M0 | Sola lettura/preparazione; nessuna M0 dichiarata iniziata. |
| IN-02 | Istruzioni applicabili, stato locale e automazioni legacy | Lettura del checkout e scope autorizzato; inventario iniziale M0 | Isolare le modifiche; bloccare solo push/deploy rischiosi. |
| IN-03 | Accesso GitHub al repository e ambiente CI | Tool/CLI esistenti, autorizzazione repo-scoped e setup mirato M0 | Proseguire localmente; nessun check remoto fittizio. |
| IN-04 | Account Cloudflare, zona fiscalbay.it, quote condivise | Enumerazione autorizzata e selezione risorsa M0; no token globali superflui | Qualifica documentale/sintetica soltanto, scelta non conclusa. |
| IN-05 | Account/progetti Supabase da valutare, piani e limiti | Solo se candidati M0, letture e prove isolate approvate | Nessuna obbligatorietà Supabase introdotta per mancanza di accesso. |
| IN-06 | Keyset eBay, ambiente, RuName/callback, scope, account controllato | Canale sicuro per qualifica eBay M0; inventario delle condivisioni con altri progetti; consenso seller quando necessario | Mock/documentazione; blocco della qualifica live pertinente, nessuna credenziale presa da un altro progetto senza mandato. |
| IN-07 | Configurazione login Google e identità eBay | Qualifica Auth M0, console/account appropriati e redirect test; passkey origin/RP ID secondo host reale | Non eliminare un metodo richiesto: registrare il blocco del gate Auth. |
| IN-08 | Account Stripe, Managed Payments eligibility, contesti test/live | Scoperta account autorizzata M0; prodotti/config live soltanto M5 sotto checkpoint | Nessun fallback Payments standard o Paddle autonomo. |
| IN-09 | Identità bot Telegram esistente e bot di test separato | Metadati/token protetti M0/M2/M5; chat controllata, webhook/poller inventariati | Nessun invio a chat sconosciute; il bot operativo non viene riutilizzato come test. |
| IN-10 | Registrar Register.it e controllo DNS | M0 per callback minimo, completamento M1; registrar solo ciò che non può essere svolto altrove | Non inventare records/password; niente Dynu o host alternativi esclusi. |
| IN-11 | Abbonamento iCloud+ e dominio posta, account destinatario controllato | Owner/sessione sicura M1; info@ e supporto@, terzo indirizzo libero | Preparare record e procedura, non dichiarare ricezione/risposta verificate. |
| IN-12 | Trasporto email Auth/transazionale e relativo mittente | Prova controllata e scelta nei costi di M0; configurazione finale M1/M6 | Endpoint Auth email non qualificato; non usare iCloud come sistema di invio automatico massivo. |
| IN-13 | Canale amministrativo privato e fallback email | Owner o inventario privato M0/M7; destinatari confermati | Allarmi di test su destinatario controllato; readiness alert non chiusa. |
| IN-14 | Dati legali Temisfera e rapporto contabile con il MoR | Dati effettivi dell'operatore nella qualifica preliminare M0 e finale M7, fonti e condizioni applicabili | Non usare generalità/P.IVA inventate; blocco della sola pubblicazione legale/commerciale dipendente. |
| IN-15 | Budget/prove a pagamento e piani iniziali | Proposta con costi in M0; autorizzazione prima di sostenere la spesa, scelta finale al checkpoint | Eseguire prove gratuite possibili; nessuna spesa retroattivamente autorizzata. |
| IN-16 | Asset originali e scelte visuali approvate | Già nello ZIP: manifest e quattro PNG; rifiniture logo/prototipo M1 sottoposte all'owner | Verificare checksum, non sostituire con immagini omonime rigenerate. |
| IN-17 | Merchant di fiducia, consenso al test e dati/ambiente | Acquisizione nel checkpoint M8, non requisito per partire con M0 | Test automatici proseguibili; test reale non inventato. |
| IN-18 | Date promozione globale e configurazione finale | Owner nella milestone finale, inizio/fine e cicli già avviati coerenti | Nessuna data fittizia o countdown pubblico; go-live commerciale in attesa. |
| IN-19 | Custodia delle chiavi e percorso di recupero nativo | Assetto selezionato M0 e readiness M7, accesso privato realmente disponibile | Gate recovery aperto; non introdurre automaticamente backup esterni o test periodici. |

Nel contesto privato segnare disponibilità, owner, fonte e blocco; nelle questioni aperte del piano soltanto il nome logico e la capacità dipendente. IN-17/18 non bloccano M0. Un token valido non sostituisce la qualifica del contratto. Dove non si può completare una prova, continuare le attività indipendenti e riportare il limite.

### Ambienti

Registrazioni test: `REGISTRATION_MODE=approval`; il secret `REGISTRATION_ALLOWED_EMAILS` contiene un array JSON di indirizzi esatti, per esempio `["tester@example.invalid"]`. Confronto senza distinzione fra maiuscole e minuscole, senza equivalenze fra alias o domini. Lista assente, `[]` o formato non valido bloccano la creazione degli utenti; non revocano account esistenti. Custodire l'elenco fuori da checkout e directory distribuibili e caricarlo solo sul Worker `fiscalbay-test` con `pnpm exec cf workers secrets update`, verificando prima schema e custodia. Nessun indirizzo reale in Git o nei log. Production usa `REGISTRATION_MODE=open`; le prove Vitest su fixture usano esplicitamente `open`. Il collaudo browser locale e dopo il deploy usa l'account sintetico predisposto direttamente nella D1 test da `scripts/reset-test-account.mjs`: non richiede registrazione pubblica né inserimento nella lista. La pubblicazione della modifica e la configurazione remota richiedono il normale ciclo `Pubblica`.

**Negozi eBay Sandbox sul test.** Il collegamento propone eBay Production come scelta predefinita. In locale e su `test.fiscalbay.it`, `EBAY_SANDBOX_ENABLED=true` abilita la scelta Sandbox soltanto con i segreti `EBAY_SANDBOX_CLIENT_ID`, `EBAY_SANDBOX_CLIENT_SECRET` e `EBAY_SANDBOX_RUNAME`; `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET` e `EBAY_RUNAME` restano per i negozi Production e il login eBay, e `fiscalbay.it` non ammette Sandbox. La sessione OAuth conserva l'ambiente scelto e lettura e rinnovi usano chiavi ed endpoint dello stesso ambiente. Il flag è spento anche sul test finché l'owner non chiede di riattivarlo ([questioni aperte](../MASTER_PLAN.md#questioni-aperte)). Per riattivarlo: nel keyset Sandbox si configura il RuName con callback accettato e rifiutato `https://test.fiscalbay.it/api/auth/callback/ebay` e i soli scope `commerce.identity.readonly` e `sell.fulfillment.readonly`, si verifica il callback, poi si custodiscono i segreti nel Worker test, mai nel repository. Nessuna configurazione Sandbox cambia il keyset Production.

Locale per fixture e prove isolate; `test.fiscalbay.it` per collaudo separato, bot test e Stripe test; `fiscalbay.it` per Production qualificata. Callback, cookie, sessioni, database e credenziali non si confondono. Una lettura eBay Production controllata, necessaria quando Sandbox è insufficiente, resta una prova su dati reali con finalità/retention autorizzate: non autorizza una copia generale di Production. Regione, costi e continuità del test sono scelti in M0, non presumendo un secondo ambiente sempre acceso a pagamento.

<a id="custodia"></a>
## 5. Custodia privata

Predisporre un riferimento locale non versionato a una custodia **fuori da checkout e directory distribuibili**, accessibile alle sessioni autorizzate. Nessun obbligo di comprare un secret manager; scegliere quanto è già adatto e disponibile. L’inventario contiene nomi logici, owner, ID/ambiente, scope e riferimenti alla custodia, **non segreti in chiaro**.

Prima di caricare un nuovo segreto sul provider, conservarlo nella custodia scelta e verificarne la rilettura senza stamparlo. Per `BETTER_AUTH_SECRET` del test il valore attivo è custodito nel Worker e nel Portachiavi macOS, con riferimento nell'inventario privato; la copia custodita apre i token seller reali. `.dev.vars` resta riservato alle prove locali sintetiche. Una rotazione del segreto Auth richiede anche di gestire sessioni e credenziali cifrate, quindi non serve per correggere un riferimento di custodia mancante.

L'accesso tecnico alla console ([D213](../DECISION_REGISTER.md)) usa per ogni ambiente un token `fbat_` casuale da 32 byte, custodito nel Portachiavi macOS come «FiscalBay admin <ambiente>». Nel D1 dell'ambiente si registra soltanto l'impronta SHA-256 in `admin_agent_tokens`, con un'etichetta. L'agente lo legge senza stamparlo e lo invia come `Authorization: Bearer` sulle pagine `/admin`: vede le sezioni ed esegue le operazioni come la sessione admin, con il motivo dove serve e l'intestazione `Origin` del sito per i moduli. Ogni lettura e operazione resta nel registro con autore `agent:<etichetta>`. Il token vale quanto la passkey: non va mai stampato, copiato in file o messaggi. La rotazione aggiunge un nuovo token e revoca il precedente con `revoked_at`.

Tenere privati capacità residue e costi reali degli account condivisi, euristiche anti-abuso, identità dei tester/chat e prove contenenti dati reali. Conservare il minimo necessario a riconoscere target, autorizzazioni, rotazione e recovery. Le normali evidenze nel repository usano dati sintetici/sanificati e riferimenti logici; verificare anche screenshot, allegati, log CI e ZIP. Un hash pseudonimo non è automaticamente anonimo.

Per sostenibilità misurare ordini, negozi multipli, storico, retry, export, log, email e ambienti, distinguendo entrate ricorrenti/lifetime/omaggi e commissioni effettive. Non attribuire a FB l’intera quota di account usati da altri progetti. Non introdurre backup esterni o consultazioni periodiche obbligatorie contrarie alle scelte approvate.

<a id="deliverable"></a>
## 6. Informazioni da mantenere durante lo sviluppo

Questa è una mappa di **contenuti e responsabilità**, non un elenco di file obbligatori. Prima usare codice, schema, configurazione e test come contratti eseguibili. Creare un documento separato quando spiega un comportamento sostanziale condiviso, una scelta costosa da invertire o una procedura operativa reale. Accorpare elementi brevi; nessuno scaffolding documentale vuoto.

Per creare o aggiornare una PR, passare la descrizione direttamente allo strumento, senza creare file `.md` temporanei per il testo: sul Mac `gh pr create --body-file -` o `gh pr edit --body-file -` con input standard; nel cloud, dove `gh pr` è rifiutato, il connettore GitHub o `pnpm release:cycle`.

| Quando / responsabile | Informazione che deve risultare verificabile | Collocazione più semplice |
|---|---|---|
| Adozione e qualifica M0 | Mandato, trigger legacy, toolchain/accessi; confronto progressivo e decisione del candidato, capacità/costi, Auth/eBay/Stripe/export/recovery | Governo e roadmap del piano; manifest/lockfile/config e prove collegate alla PR; ADR solo per scelte durevoli, dettagli privati fuori repo |
| M1 e frontend | Asset rifiniti, token, origine/licenza/modifiche dei componenti, approvazione grafica | Brand foundation + asset e registro delle sole risorse integrate |
| M2/M3 | Identità, isolamento, unità dello sblocco, quota, versioni fiscali, permessi, fonti/cursori e budget eBay | Schema/migrazioni/test e contratto breve eBay/Auth soltanto dove serve spiegazione oltre il codice |
| M5 | Incasso/periodi/grant, lifetime, callback e riconciliazione; Telegram/opt-out/arretrati | Contratto billing utile per i casi incrociati, adapter e test; Telegram vicino al codice salvo complessità reale |
| M6 | CSV/XLSX/ZIP, accesso/scadenza file; email, consenso, supporto e KPI | Tipi/schema/test, template e definizioni riusate; nessun catalogo API manuale duplicato |
| M7/M8 | Cancellazione e restore, escalation, rilascio interrotto, rollback/forward-fix, evidenze RC | Runbook reali di release, incidenti e recovery, eventualmente accorpati; prove brevi collegate |
| M9 | Date/prezzi/promo, readiness, unico restore riuscito, mandato Promuovi, readback e dismissione 1.x | Gate e checkpoint nel piano; checklist unica e ricevuta conclusiva proporzionata |

Se un'informazione richiesta manca, l'intervento competente la produce prima di dichiarare chiusa la capacità; l'assenza di un file con un nome ipotetico non è da sola un blocco. Una lettura approvata non inventa un'API o una condizione legale: i vincoli esterni rimangono da qualificare. Gli audit storici non sono contratti da mantenere in parallelo.
