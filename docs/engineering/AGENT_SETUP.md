# FiscalBay — Setup degli strumenti e contesto operativo

L’avvio e la ripresa sono nel [README](../../README.md); autonomia e checkpoint nel [governo](../MASTER_PLAN.md#s00). Qui si documentano strumenti necessari, input e custodia. Non è una certificazione che gli accessi siano già configurati. Le [fonti](../SOURCES.md) vanno verificate sul client/versione effettivi.

## 1. Strumenti, comandi e fasi

| Fase / ecosistema | Configurazione necessaria |
|---|---|
| M0 — locale e GitHub | Git/CLI o connettore già autorizzato, Node e pnpm qualificati, repository/branch verificati; accesso a readback di CI e automazioni quando necessario. |
| M0 — Cloudflare/Supabase | Iniziare da lettura piani, risorse e quote. CLI/MCP per le prove realmente richieste; dopo la scelta conservare soltanto strumenti e adapter utili all’assetto. |
| M0/M2 — Auth/eBay | Console e callback pertinenti, account controllati, API/spec ufficiali; quattro accessi qualificati e consenso seller distinto. SDK/MCP aggiuntivi solo se risparmiano lavoro concreto. |
| M0/M5 — Stripe | SDK ufficiale, CLI webhook, MCP/strumenti disponibili, contesti test/live espliciti. Managed Payments e regole commerciali qualificati, non dedotti dalla disponibilità generica di Billing. |
| M1/M4 — frontend | CLI shadcn e MCP se utile, registry dichiarati, skill frontend/React/test e nove riferimenti approvati; licenze verificate prima dell’integrazione. |
| M5 — Telegram | API ufficiale, bot test separato e chat controllata, token sicuro, controllo webhook/poller; framework opzionale. |
| M6/M7 — comunicazioni e operazioni | Email transazionale scelta, iCloud per posta umana, metriche/alert nativi; tool esterni solo se necessari e con costo autorizzato. |
| Solo su decisione owner | Paddle e relativo tooling; non predisporre un secondo billing operativo mentre Stripe è primario. |

Codex desktop può usare file/CLI locali e le connessioni effettivamente autorizzate. Non assumere che un MCP presente in un’altra applicazione o una skill citata nella chat sia già disponibile qui. Configurare secondo documentazione corrente, senza URL, plugin o nomi di tool inventati. Le skill guidano l’implementazione, non prevalgono su scope e checkpoint. `/grill-me` e `/grill-with-docs` non sono dipendenze dell’app.

### Comandi del progetto da implementare nello scaffolding

| Comando previsto | Responsabilità |
|---|---|
| `pnpm format:check`, `pnpm lint`, `pnpm typecheck` | Oxfmt, Oxlint e compilatore; versione esatta nel lockfile/config, non copiata in più documenti. |
| `pnpm test`, `pnpm test:e2e` | Vitest/Testing Library e Playwright, fixture controllate; accessibilità smoke dove pertinente. |
| `pnpm build` | Artefatto del runtime selezionato, nessun deploy implicito. |
| `pnpm verify` | Composizione dei gate applicabili; comandi e risultati realmente verificati. |
| Workflow `Pubblica` | Contratto [§34](../MASTER_PLAN.md#s34), readback e ripresa degli esiti parziali. |

Sono comandi **da creare**, non già presenti per effetto della guida. Il solo verificatore documentale è consegnato eseguibile. Node locale/CI non è il runtime Workers o Supabase. Librerie opzionali non si installano per riempire un catalogo.

## 2. Due livelli di verifica dei tool

**Consultazione di documentazione pubblica:** origine ufficiale/affidabile, configurazione minima, nessun permesso di account non necessario e una ricerca/lettura riuscita. Basta una nota breve quando serve; non occorrono prove di scrittura, isolamento tenant o revoca di credenziali che non esistono.

**Accesso a dati privati o operazioni:** verificare account, risorsa, ambiente e scope minimi; custodire la credenziale fuori dal repository, provare una lettura innocua e, quando necessaria al mandato, una scrittura limitata in test con readback/cleanup. Documentare come revocare l’accesso e verificare il confine test/live. Una credenziale admin non prova che il percorso merchant sia sicuro: i test di autorizzazione usano sessioni/ruoli reali del caso.

CLI e MCP dello stesso provider condividono le prove funzionali dell’integrazione. Verificare separatamente soltanto i rispettivi accessi e le differenze di capacità: non rifare tutta la qualifica eBay/Stripe due volte. Nessun obbligo di scrittura o cancellazione di prova in Production per certificare un tool. Applicare conferme imposte dal client senza scavalcarle; non assegnare accesso globale per evitare un singolo blocco.

La riuscita di una chiamata dimostra quella chiamata, non l’intera funzionalità. Sandbox, simulazioni e prove reali sono distinti secondo [§36](../MASTER_PLAN.md#s36); ciò che non è osservabile va assegnato al gate reale competente. I tool di sviluppo non diventano dipendenze del runtime del prodotto.

<a id="lettura"></a>
## 3. Lettura mirata per attività

Leggere AGENTS e il task corrente, poi le sezioni pertinenti. La tabella non è un secondo grafo di dipendenze; sicurezza, privacy, localizzazione e prove si applicano a ogni funzione interessata.

| Attività | Sezioni canoniche |
|---|---|
| Adozione/M0 | [Governo](../MASTER_PLAN.md#s00), [scope](../MASTER_PLAN.md#s02), [architettura](../MASTER_PLAN.md#s25), [stack](../MASTER_PLAN.md#s26), [gate](../MASTER_PLAN.md#s36), [superati](../MASTER_PLAN.md#s40) |
| Auth/account/negozi | [Auth](../MASTER_PLAN.md#s07), [negozi](../MASTER_PLAN.md#s08), [sicurezza](../MASTER_PLAN.md#s29), [privacy](../MASTER_PLAN.md#s30) |
| Ordini/sync | [Ordini](../MASTER_PLAN.md#s09), [suggerimenti](../MASTER_PLAN.md#s10), [sync](../MASTER_PLAN.md#s11), [dati](../MASTER_PLAN.md#s27), [servizi](../MASTER_PLAN.md#s28) |
| UI/brand/sito | [Navigazione](../MASTER_PLAN.md#s16)–[onboarding](../MASTER_PLAN.md#s20), [brand](../MASTER_PLAN.md#s21), [design](../MASTER_PLAN.md#s22), [SEO](../MASTER_PLAN.md#s23), [reference](../brand/REFERENCES.md) |
| Piani/Stripe | [Piani](../MASTER_PLAN.md#s04), [Free](../MASTER_PLAN.md#s05), [billing](../MASTER_PLAN.md#s06), [fonti Stripe](../SOURCES.md#s01) |
| Export/comunicazioni/admin | [Export](../MASTER_PLAN.md#s12), [Telegram](../MASTER_PLAN.md#s13), [email](../MASTER_PLAN.md#s14), [admin](../MASTER_PLAN.md#s15), [dominio](../MASTER_PLAN.md#s24) |
| Operations/test/release | [Sicurezza](../MASTER_PLAN.md#s29)–[recovery](../MASTER_PLAN.md#s32), [Git/release](../MASTER_PLAN.md#s34), [test](../MASTER_PLAN.md#s35), [milestone](../MASTER_PLAN.md#s37), [rischi](../MASTER_PLAN.md#s38), [DoD](../MASTER_PLAN.md#s41) |
| Documentazione | [Governo](../MASTER_PLAN.md#s00), [README](../../README.md#documenti), fonte interessata e relativo task; archivio solo per ricostruzioni storiche eccezionali |

<a id="input"></a>
## 4. Input esterni

Prima di chiedere un input controllare checkout, tool autorizzati e inventario privato. I seguenti sono prerequisiti da acquisire, non dati già forniti o risorse già esistenti. Richiedere solo l’input necessario attraverso un canale adatto, senza dump di credenziali o ritorno alla chat di progettazione.

| ID | Input / responsabilità | Quando e acquisizione | Se manca |
|---|---|---|---|
| IN-01 | Mandato di adozione/avvio e checkout corretto | Avvio owner, remote/branch/commit verificati in M0-01 | Sola lettura/preparazione; nessuna M0 dichiarata iniziata. |
| IN-02 | Istruzioni applicabili, stato locale e automazioni legacy | Lettura del checkout e scope autorizzato; configurazioni remote pertinenti in M0-01 | Isolare le modifiche; bloccare solo push/deploy rischiosi. |
| IN-03 | Accesso GitHub al repository e ambiente CI | Tool/CLI esistenti, autorizzazione repo-scoped già per M0-01/03; setup esteso M0-02 | Proseguire localmente; nessun check remoto fittizio. |
| IN-04 | Account Cloudflare, zona fiscalbay.it, quote condivise | Enumerazione autorizzata e selezione risorsa M0-03; no token globali superflui | Qualifica documentale/sintetica soltanto, scelta non conclusa. |
| IN-05 | Account/progetti Supabase da valutare, piani e limiti | Solo se candidati, lettura M0-03 e prove isolate approvate | Nessuna obbligatorietà Supabase introdotta per mancanza di accesso. |
| IN-06 | Keyset eBay, ambiente, RuName/callback, scope, account controllato | Canale sicuro M0-05; inventario delle condivisioni con altri progetti; consenso seller quando necessario | Mock/documentazione; blocco della qualifica live pertinente, nessuna credenziale presa da un altro progetto senza mandato. |
| IN-07 | Configurazione login Google e identità eBay | M0-04, console/account appropriati e redirect test; passkey origin/RP ID secondo host reale | Non eliminare un metodo richiesto: registrare il blocco del gate Auth. |
| IN-08 | Account Stripe, Managed Payments eligibility, contesti test/live | Scoperta account autorizzata M0-08; prodotti/config live soltanto M5 sotto checkpoint | Nessun fallback Payments standard o Paddle autonomo. |
| IN-09 | Identità bot Telegram esistente e bot di test separato | Metadati/token protetti M0/M2/M5; chat controllata, webhook/poller inventariati | Nessun invio a chat sconosciute; il bot operativo non viene riutilizzato come test. |
| IN-10 | Registrar Register.it e controllo DNS | M0-02 per callback minimo, completamento M1-08; registrar solo ciò che non può essere svolto altrove | Non inventare records/password; niente Dynu o host alternativi esclusi. |
| IN-11 | Abbonamento iCloud+ e dominio posta, account destinatario controllato | Owner/sessione sicura M1-08; info@ e supporto@, terzo indirizzo libero | Preparare record e procedura, non dichiarare ricezione/risposta verificate. |
| IN-12 | Trasporto email Auth/transazionale e relativo mittente | Prova controllata M0-02, scelta nei costi di M0; configurazione finale M1/M6 | Endpoint Auth email non qualificato; non usare iCloud come sistema di invio automatico massivo. |
| IN-13 | Canale amministrativo privato e fallback email | Owner o inventario privato M0/M7; destinatari confermati | Allarmi di test su destinatario controllato; readiness alert non chiusa. |
| IN-14 | Dati legali Temisfera e rapporto contabile con il MoR | Dati effettivi dell’operatore in M0-12/M7-07, fonti e condizioni applicabili | Non usare generalità/P.IVA inventate; blocco della sola pubblicazione legale/commerciale dipendente. |
| IN-15 | Budget/prove a pagamento e piani iniziali | Proposta con costi in M0; autorizzazione prima di sostenere la spesa, scelta finale M0-14 | Eseguire prove gratuite possibili; nessuna spesa retroattivamente autorizzata. |
| IN-16 | Asset originali e scelte visuali approvate | Già nello ZIP: manifest e quattro PNG; rifiniture M1-05/07 sottoposte all’owner | Verificare checksum, non sostituire con immagini omonime rigenerate. |
| IN-17 | Merchant di fiducia, consenso al test e dati/ambiente | Acquisizione nel checkpoint M8, non requisito per partire con M0 | Test automatici proseguibili; test reale non inventato. |
| IN-18 | Date promozione globale e configurazione finale | Owner nella milestone finale, inizio/fine e cicli già avviati coerenti | Nessuna data fittizia o countdown pubblico; go-live commerciale in attesa. |
| IN-19 | Custodia delle chiavi e percorso di recupero nativo | Assetto selezionato M0-09/M7-06, accesso privato realmente disponibile | Gate recovery aperto; non introdurre automaticamente backup esterni o test periodici. |

Nel contesto privato segnare disponibilità, owner, fonte e blocco; nel backlog pubblico soltanto il nome logico e l’attività dipendente. IN-17/18 non bloccano M0. Un token valido non sostituisce la qualifica del contratto. Dove non si può completare una prova, continuare le attività indipendenti e riportare il limite.

### Ambienti

Locale per fixture e prove isolate; `test.fiscalbay.it` per collaudo separato, bot test e Stripe test; `fiscalbay.it` per Production qualificata. Callback, cookie, sessioni, database e credenziali non si confondono. Una lettura eBay Production controllata, necessaria quando Sandbox è insufficiente, resta una prova su dati reali con finalità/retention autorizzate: non autorizza una copia generale di Production. Regione, costi e continuità del test sono scelti in M0, non presumendo un secondo ambiente sempre acceso a pagamento.

<a id="custodia"></a>
## 5. Custodia privata

Predisporre un riferimento locale non versionato a una custodia **fuori da checkout e directory distribuibili**, accessibile alle sessioni autorizzate. Nessun obbligo di comprare un secret manager; scegliere quanto è già adatto e disponibile. L’inventario contiene nomi logici, owner, ID/ambiente, scope e riferimenti alla custodia, **non segreti in chiaro**.

Tenere privati capacità residue e costi reali degli account condivisi, euristiche anti-abuso, identità dei tester/chat e prove contenenti dati reali. Conservare il minimo necessario a riconoscere target, autorizzazioni, rotazione e recovery. Le normali evidenze nel repository usano dati sintetici/sanificati e riferimenti logici; verificare anche screenshot, allegati, log CI e ZIP. Un hash pseudonimo non è automaticamente anonimo.

Per sostenibilità misurare ordini, negozi multipli, storico, retry, export, log, email e ambienti, distinguendo entrate ricorrenti/lifetime/omaggi e commissioni effettive. Non attribuire a FB l’intera quota di account usati da altri progetti. Non introdurre backup esterni o consultazioni periodiche obbligatorie contrarie alle scelte approvate.

<a id="deliverable"></a>
## 6. Informazioni da mantenere durante lo sviluppo

Questa è una mappa di **contenuti e responsabilità**, non un elenco di file obbligatori. Prima usare codice, schema, configurazione e test come contratti eseguibili. Creare un documento separato quando spiega un comportamento sostanziale condiviso, una scelta costosa da invertire o una procedura operativa reale. Accorpare elementi brevi; nessuno scaffolding documentale vuoto.

| Quando / responsabile | Informazione che deve risultare verificabile | Collocazione più semplice |
|---|---|---|
| M0-01/11/02 | Mandato, istruzioni applicabili, trigger legacy; toolchain e accessi minimi verificati | Stato backlog, manifest/lockfile/config; nota operativa solo se necessaria |
| M0-03..M0-14 | Confronto progressivo, prove, capacità/costi e decisione del candidato; 4 login, copertura eBay, Stripe, export, recuperabilità | Memo unico M0, prove sintetiche e ADR solo per scelte durevoli; dettagli privati fuori repo |
| M1 e frontend | Asset rifiniti, token, origine/licenza/modifiche dei componenti, approvazione grafica | Brand foundation + asset e registro delle sole risorse integrate |
| M2/M3 | Identità, isolamento, unità dello sblocco, quota, versioni fiscali, permessi, fonti/cursori e budget eBay | Schema/migrazioni/test e contratto breve eBay/Auth soltanto dove serve spiegazione oltre il codice |
| M5 | Incasso/periodi/grant, lifetime, callback e riconciliazione; Telegram/opt-out/arretrati | Contratto billing utile per i casi incrociati, adapter e test; Telegram vicino al codice salvo complessità reale |
| M6 | CSV/XLSX/ZIP, accesso/scadenza file; email, consenso, supporto e KPI | Tipi/schema/test, template e definizioni riusate; nessun catalogo API manuale duplicato |
| M7/M8 | Cancellazione e restore, escalation, rilascio interrotto, rollback/forward-fix, evidenze RC | Runbook reali di release, incidenti e recovery, eventualmente accorpati; prove brevi collegate |
| M9 | Date/prezzi/promo, readiness, unico restore riuscito, mandato Pubblica, readback e dismissione 1.x | Checklist unica e ricevuta conclusiva proporzionata; backlog con rimandi |

Se un’informazione richiesta manca, il task competente la produce prima di chiudersi; l’assenza di un file con un nome ipotetico non è da sola un blocco. Una lettura approvata non inventa un’API o una condizione legale: i vincoli esterni rimangono da qualificare. Gli audit storici non sono contratti da mantenere in parallelo.
