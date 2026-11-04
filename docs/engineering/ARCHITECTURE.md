# FiscalBay · Architettura

Confini dei servizi, toolchain, modello dati e contratti API.

<a id="s25"></a>
## 25. Architettura e confini dei servizi

Un repository pnpm e **una sola applicazione TypeScript modulare**. Partire da un package applicativo con cartelle per dominio, integrazioni, job, UI e contratti; estrarre package distinti solo con riuso effettivo o necessità di build/test separati. Il monorepo è una capacità organizzativa, non un numero minimo di package. Niente package Expo, team o multi-workspace vuoti.

React Router richiama i casi d’uso server direttamente. Job e servizi riusano la stessa logica; endpoint HTTP espliciti servono soltanto ai client reali e ai webhook/callback. Una futura app Expo può riusare modelli, regole, token e contratti senza imporre oggi un’API speculare completa della UI.

```text
React Router / job / endpoint necessari
                |
       casi d’uso FiscalBay
                |
   moduli dati e integrazioni scelte
                |
       Cloudflare: Workers / D1 / Queues
```

Dominio privo di accessi provider disseminati; modulo dedicato per eBay, Stripe, Telegram, email e persistenza. L'assetto è quello scelto nella qualifica iniziale; le alternative scartate stanno nel [registro](../decisions/DECISION_REGISTER.md). Un’interfaccia serve se rende un confine testabile, non come framework universale di portabilità. Non nascondere differenze reali tra D1 e PostgreSQL dietro un repository generico; transazioni e invarianti sono qualificati sul motore effettivo.

| Assetto | Ripartizione | Verifiche decisive |
|---|---|---|
| Cloudflare | Workers web/job, D1, R2, Queues/Cron, Better Auth | Quattro login, atomicità, limiti runtime, export e recovery nativa |

Valutare Free/Paid per servizio e ambiente sulla **capacità residua** degli account condivisi, non sulle sole quote nominali. VPS, Vercel, Netlify e Appwrite sono fuori dalla selezione attiva; pagamenti, iCloud, GitHub e trasporto email non estendono questo perimetro compute.

Una sola fonte autorevole per responsabilità: niente due database per gli stessi dati, due Auth o due code per lo stesso flusso. Valgono anche [§29](SECURITY_AND_PRIVACY.md#s29) e la revoca [§7](../product/ACCOUNTS_AND_STORES.md#s07).

Inventario read-only delle risorse condivise; nessuna migrazione di altri prodotti o modifica di keyset comuni senza mandato. Le alternative scartate restano motivazioni nel registro, non implementazioni di riserva da manutenere.

**Servizi Cloudflare previsti nell'assetto (D166).** La tabella descrive le responsabilità, non attesta che tutti i servizi siano già attivi. Workers/D1, asset statici e domini sono nelle configurazioni applicative; Queues e DLQ sono qualificate sul test. Le integrazioni successive sono qualificate. Risorse e binding applicativi restano separati per test e Production.

| Servizio | Uso in FiscalBay |
|---|---|
| Workers | Web app, ingresso webhook, consumer Queue e lavoro pianificato in un solo Worker per ambiente |
| Workers Static Assets | Asset della build serviti dalla piattaforma, quelli con l'hash nel nome in cache per un anno (`public/_headers`); download privati e risposte dipendenti dalla sessione restano nel Worker |
| DNS, TLS e Custom Domains | Zona esistente e domini canonici di [§24](../operations/OPERATIONS.md#s24); Register.it resta registrar, senza trasferimenti o nuovi domini richiesti |
| Protezioni e report della zona | HSTS/header, WAF/rate limit edge, rilevamento delle credenziali trapelate, DMARC Management e Certificate Transparency secondo [§24](../operations/OPERATIONS.md#s24), qualificati sul test |
| Monitor degli avvisi | Query della SQL API valutate da Cloudflare fuori dal Worker per la Production, da `scripts/alert-monitors.mjs`: cron fermo, coda dei falliti, eccezioni, spazio D1 ed email non consegnate ([incidenti](../operations/OBSERVABILITY.md#incidenti)) |
| D1 (UE) | Unica fonte autorevole di dati applicativi, sessioni, checkpoint, ricevute, contatori per indirizzo e audit |
| Queues e DLQ (UE) | Consegna, ritardi, retry e dead-letter di eventi e lavori ([§11](../product/ORDERS_AND_SYNC.md#s11)) |
| Cron Triggers | Un solo trigger per ambiente che smista il lavoro periodico per `scheduledTime` ([§31](../operations/OPERATIONS.md#s31)) |
| R2 (UE) | File export a 24 ore ([§12.1](../product/ORDERS_AND_SYNC.md#s12)) e archivio dei log a 90 giorni ([§31](../operations/OPERATIONS.md#s31)) |
| Rate Limiting | Primo filtro nel Worker per IP e percorso davanti ad Auth e operazioni costose ([§29](SECURITY_AND_PRIVACY.md#s29)) |
| Turnstile | Verifica anti-automazione su registrazione, richieste di link email e form di supporto ([§29](SECURITY_AND_PRIVACY.md#s29)) |
| Analytics Engine | Metriche tecniche aggregate e budget di prestazione, senza dati personali ([§31](../operations/OPERATIONS.md#s31)) |
| Web Analytics | Visite e tempi di caricamento delle sole pagine pubbliche, senza cookie ([§23](../product/EXPERIENCE.md#s23), D242) |
| Email Service | Trasporto di `noreply@` verso destinatari qualsiasi con Workers Paid e invio gratuito agli indirizzi verificati dell'owner ([§14](../product/CHANNELS_AND_ADMIN.md#s14), D169) |
| Workers Logs e Logpush | Diagnosi recente nella dashboard ed esportazione verso R2 ([§31](../operations/OPERATIONS.md#s31)) |

Non adottati: KV, perché le letture possono restare non aggiornate mentre revoche e sessioni valgono subito; Durable Objects, finché il blocco per negozio in D1 basta; Workflows, perché duplicherebbe Queue e checkpoint come secondo orchestratore; Hyperdrive, che accelera database PostgreSQL/MySQL esterni e non D1; Images, perché le immagini restano sugli host eBay ([§29](SECURITY_AND_PRIVACY.md#s29)); Email Routing sull'apex, perché i suoi MX confliggono con iCloud+ ([§24](../operations/OPERATIONS.md#s24)). Riaprirli richiede un rischio dimostrato che le primitive adottate non coprono. [S34](../reference/SOURCES.md#s34)

**D1 e letture distribuite.** Il percorso corrente usa il database primario. Read replication con Sessions API, attualmente in beta, si valuta soltanto se la misura di capacità mostra un collo di bottiglia nelle letture, qualificando disponibilità, localizzazione e compatibilità Auth. Una replica potenzialmente in ritardo o un bookmark del client non provano l'assenza di revoche successive: i controlli di sessione, ruolo, consenso e grant richiedono lo stato autorevole corrente; `first-primary` avvia una sessione dai dati più recenti. Nessuna replica o cache introdotta soltanto perché disponibile. [S34](../reference/SOURCES.md#s34)

**Ingresso leggero per webhook e callback.** Le route esatte dei webhook e delle callback server-to-server dei provider (Stripe, eBay `ORDER_CONFIRMATION` e cancellazione account, Telegram) sono gestite dall'entrypoint Worker prima di React Router: verificano metodo, dimensione e firma sul corpo grezzo, registrano un claim idempotente in D1 e pubblicano in coda un messaggio con soli identificativi, senza payload, sessioni o token. La risposta positiva al provider parte soltanto dopo che la coda ha accettato il messaggio; `waitUntil` da solo non basta perché non garantisce la riconsegna. Il consumer ricostruisce il contesto da D1 e usa retry e dead-letter nativi. La build React Router si carica al primo accesso applicativo insieme a React Router stesso e resta esclusa dal percorso di webhook, cron e coda; lo SDK Stripe e i testi dell'interfaccia si caricano solo dove servono (D167). La CPU si misura sul Worker entro i budget di [§31](../operations/OPERATIONS.md#s31), senza dedurla dalla build o dal caricamento dei moduli. Per eventi ad alta frequenza e già confermati è ammessa una memoria di breve durata nell'isolate per evitare letture D1 ripetute, mai come fonte autorevole. Le callback OAuth aperte dal browser restano nell'applicazione e nel sistema Auth.

<a id="s26"></a>
## 26. Toolchain, dipendenze e policy latest

**Latest stable qualificata** al momento dell'aggiornamento, non preferenza automatica per LTS vecchie. Node 26 e TypeScript 7 sono le direzioni esplicitamente richieste, salvo incompatibilità dimostrata; verificare catalogo ufficiale e pacchetti reali. Node locale/CI non è la versione del runtime Workers. Beta/RC/canary non baseline generica; passkey sperimentali sono un rischio specifico da qualificare/accettare, non un lasciapassare per tutto. [S08](../reference/SOURCES.md#s08) [S09](../reference/SOURCES.md#s09)

Pin esatti dei pacchetti diretti dove appropriato, lockfile unico e install riproducibile; versione pnpm nel manifest. Niente `latest` non risolto a ogni build. Aggiornamenti regolari: patch/minor accorpabili con test, major review dedicata; runtime/compiler qualification gate e rollback sicuro. Nessuna dipendenza nuova solo perché presente in uno starter.

Dal 2026-10-08, su indicazione dell'owner, nessuna attesa minima di 24 ore dalla pubblicazione dei pacchetti npm. Restano il controllo che rifiuta perdite di firme o provenance, i pin e i gate di qualifica.

| Funzione | Base approvata / default tecnico |
|---|---|
| Package manager | pnpm workspaces, unico lockfile; npm non incompatibile ma non la scelta corrente |
| Linguaggio | TypeScript strict, ESM; typecheck indipendente dalla build |
| Web | React + React Router Framework Mode + Vite |
| CSS | Tailwind; token semantici e CSS native |
| Componenti | shadcn/ui e primitive necessarie (Base UI), selezione dagli altri riferimenti |
| Icone | Lucide |
| Schemi runtime | Zod, usato ai confini dati/contratti |
| Localizzazione | Dizionari IT/EN tipizzati nel codice (`app/app-copy.ts`) e formatter `Intl` nativi, senza libreria di localizzazione (D149) |
| Stripe | SDK ufficiale server-side, Hosted Checkout; niente Elements per il solo redirect |
| HTTP, UUID, crittografia | fetch, crypto.randomUUID, Web Crypto del runtime ove qualificato |
| Test | Vitest (progetti Node e Cloudflare), Playwright, axe con Playwright |
| Qualità | Oxlint, Oxfmt, React Doctor bloccante dai warning, typecheck compiler, CI e sicurezza dipendenze |
| CLI di piattaforma | `cf` a versione esatta per Workers, D1 e risorse Cloudflare, configurazione in `cloudflare.config.ts`; Wrangler solo per `tail` e D1 locale temporaneo (D170) |

**Opzionali, non negati:** Drizzle/driver SQL; React Hook Form/resolver; date-fns/timezone; TanStack Table; MSW; grammY; client OAuth/Notification eBay; generatore client OAS; libreria XLSX/ZIP; query cache; Storybook; monitoring esterno. Si aggiungono se eliminano più complessità di quanta ne introducono. XLSX e ZIP restano requisiti: opzionale è la dipendenza che li realizza. i18n e Lucide restano confermati.

Non baseline: Axios, Redux/Zustand, Prisma, Next.js/Express/Hono, Redis, GraphQL/tRPC applicativo, Expo nel runtime 2.0, grafici prima della 2.x. Non divieti religiosi: un'incompatibilità concreta va documentata; un cambio strutturale richiede owner, non un'aggiunta di nascosto.

Form ordinari con React Router Form/actions/fetcher e validazione server; libreria per form solo se articolati. UTC per istanti; **mese/anno di abbonamento sono periodi calendariali**, non 30/365 giorni arbitrari. Riepiloghi giornalieri rispettano timezone/DST: se Intl/primitive non bastano usare una libreria qualificata invece di una routine temporale fragile. Importi decimal string dalla fonte→unità minime intere/exponent currency qualificato; niente float binario o arrotondamento silenzioso, preservare precisione non rappresentabile in campi derivati.

**Compatibilità del compilatore.** Qualificare plugin/generatori che importano la sua API, non soltanto `tsc`: la disponibilità e compatibilità dell’API devono essere verificate sulla release effettiva. Non introdurre automaticamente un secondo compilatore o una compatibility dependency. Un eventuale adattamento tecnico deve essere circoscritto, documentato e non far divergere il typecheck autorevole da CI/editor. Finché TypeScript 7 non espone un'API compatibile non si usano generatori OAS: i confini eBay e Stripe usano schemi Zod mirati per Identity e Fulfillment, un parser Trading dedicato e lo SDK Stripe ufficiale. [S09](../reference/SOURCES.md#s09)

<a id="s27"></a>
## 27. Modello dati logico e invarianti

La tabella descrive **responsabilità logiche**, non un elenco di tabelle obbligatorie: possono coincidere nello stesso record quando non indebolisce integrità, permessi o retention. Non duplicare entità già possedute da Auth o dalla coda del provider.

| Entità | Dati/responsabilità principali |
|---|---|
| users, auth identities, sessions | Identità/persona e metodi del provider scelto; non duplicare l'Auth |
| workspaces e appartenenza | Confine tenant e unico utente operativo 2.0; evolvibile senza implementare inviti, ruoli/team o servizi multi-workspace |
| ebay_accounts, connections | ID stabile, nomi, stato/ragione, versione connessione, credenziali cifrate in sede protetta |
| orders; versioni complete solo se necessarie | Identità esterne, date, stati originali/normalizzati, importi e dati legati all’ordine; niente copie integrali per ogni polling |
| order_items | ID riga, titolo, SKU, quantità, valori/valuta, URL immagine qualificato |
| Snapshot buyer dell’ordine; buyer canonico opzionale | I dati dell’ordine non vengono riscritti dall’anagrafica corrente; collegamento affidabile solo nello spazio |
| tax_identifiers, tax_versions | Valore, tipo/Paese/fonte, qualità, provenienza e variazioni |
| order_access_grants, unlock_events | Diritto per ordine, origine, prima disponibilità, ciclo e deduplica |
| free_cycles, promotions | Ancoraggio, quota congelata, utilizzo derivato e periodo della promo |
| commercial_catalog, price_generations | Listini base EUR e prezzi provider per ambiente |
| subscriptions, entitlement_grants | Stato locale riconciliato, validità/origine/oggetti provider |
| lifetime_allocations | Prenotazione, conferma, omaggio, vincolo capacità e diritto persistente |
| suggestions | Sorgente/destinazione/versione, criterio affidabile e invalidazione |
| Stato sync e checkpoint applicativi | Cursori, esiti e chiavi di deduplica utili; coda/tentativi nativi riusati, lease solo se necessari |
| Ricezione eventi; outbox solo se necessaria | Deduplica e recupero di azioni richieste dal commit senza duplicare il servizio di trasporto |
| telegram_links, preferences, deliveries | Chat verificata, destinatari, consensi, eventi e stato consegna |
| exports | Richiesta/ambito, revisione di accesso del workspace, formato, stato, validità e file; nessun grafo delle versioni per file |
| notices, audit_events, consents | Campanella, audit minimizzato, marketing e revoche |
| deletion_requests, deletion_markers | Stato erasure e barriera a reimport/restore illecito |

Default: UUID interni; univocità per namespace/tenant; FK o integrità equivalente; indici sulle query reali; schema migrazioni versionato. Nessun buyer globale tra merchant, nessun elenco fiscale generale ricercabile.

Invarianti bloccanti: un account eBay attivo in uno spazio; niente saldo Free negativo; un solo primo sblocco per ordine; nessun secondo addebito per tipo fiscale; lifetime allocati+prenotati non oltre disponibilità; nessun diritto dal redirect; grant rimborsato distinto da grant indipendente; job stale incapace di reinserire dato cancellato; dato non autorizzato non esposto da cache/export/search; ordine e importi non modificabili dal client.

Diritti Premium creati quando il dato è acquisito/disponibile nel periodo valido, non quando aperto (Q568). Concorrenza tra acquisizione e scadenza gestita con istante autorevole e transazione: non concedere retroattività arbitraria al completamento di un job iniziato prima.

Audit e raw separati dal modello operativo, con retention propria. Buyer senza ordini giustificanti viene eliminato quando non necessario; conservazioni commerciali minime distinte dai dati fiscali buyer. Persistono tutte le variazioni fiscali effettive fino alla cancellazione dell’ordine; non duplicare versioni identiche o l’intero ordine per un cambiamento irrilevante. Misurare il volume delle informazioni effettivamente conservate. La modifica del dato di un buyer canonico non riscrive gli snapshot storici.

Gli eventuali record di eventi, outbox e job, e le ricevute, non sono archivi integrali dei payload. Persistono ID tecnici, riferimenti e campi minimizzati necessari a deduplica/ripresa. Un body grezzo conservato temporaneamente per verifiche resta soggetto alla propria scadenza, anche se il job non è concluso. La notifica viene renderizzata dai dati correnti autorizzati; un payload in coda non deve trattenere per mesi un CF eliminato dal database operativo.

<a id="s28"></a>
## 28. Contratti API e gestione degli errori

Endpoint applicativi HTTP sotto `/api/v1` **quando hanno un consumatore attuale**; callback/webhook mantengono i propri percorsi dedicati. Nessuna API pubblica commerciale né seconda API che duplichi ogni action/loader di React Router per la futura 3.x. Schemi runtime, errori e casi d’uso restano condivisibili: l’interfaccia nativa potrà esporre/riusare i contratti necessari quando verrà sviluppata.

Famiglie funzionali, non elenco obbligatorio di endpoint: profilo/sicurezza; negozi/link/reconnect/pause; ordini/query/dettaglio/refresh; sblocco singolo/multiplo; quote/diritti; trial/checkout/portal; notifiche/preferences; export/status/download; cancellazioni; admin; callback/webhook. Operazioni sensibili con authz server, idempotency key e risultato riconciliabile.

Convenzioni: cursori opachi, timestamp UTC ISO, valuta+intero/exponent, enum estensibili con stato sconosciuto sicuro; errori con codice stabile e messaggio IT/EN separato, correlation ID non sensibile, retry-after se applicabile. Esempi di categorie: `AUTH_REQUIRED`, `REAUTH_REQUIRED`, `STORE_RECONNECT_REQUIRED`, `QUOTA_EXHAUSTED`, `TAX_CHECK_PENDING`, `UPSTREAM_UNAVAILABLE`, `OUT_OF_RETENTION`, `EXPORT_EXPIRED`, `CHECKOUT_PENDING`, `CAPACITY_WAITLIST`. Sono default tecnici, non dipendenze di SDK.

Risposte asincrone con job ID/stato, polling limitato o push qualificato; nessun successo finto prima del commit. Alla richiesta duplicata stesso risultato o stato coerente, mai consumo ripetuto. Non esporre dettagli dell'altro tenant per distinguere «inesistente» da «non tuo».

Per le integrazioni realmente usate definire timeout, permessi, mapping errori, idempotenza e fixture nei moduli/test o in un contratto breve se serve spiegazione. Non duplicare manualmente schemi generati e tipi eseguibili in cataloghi API paralleli. OpenAPI eBay protegge i tipi, non sostituisce validazione runtime o l'analisi della semantica fiscale. Nuovi campi ignoti non devono abbattere tutta l'importazione né essere pubblicati indiscriminatamente.

Condividere negli adapter un punto minimo per timeout dell'intera lettura, limite di byte anche su risposte in streaming, parsing e classificazione degli errori. Distinguere credenziali scadute, rate limit, indisponibilità e payload invalido; propagare Retry-After quando presente, evitando retry sovrapposti fra client e coda. Coprire anche body senza Content-Length e interruzioni durante la lettura. Non costruire un framework HTTP generale.
