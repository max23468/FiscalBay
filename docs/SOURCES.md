# Fonti tecniche e normative

Consultare le fonti ufficiali pertinenti al momento della qualifica. I collegamenti orientano la verifica: non sono prove di compatibilità dell’account, test live o pareri sul singolo caso. Le decisioni di prodotto sono nel Master Plan; cronologia delle letture comparative e degli audit è negli snapshot storici della consegna.

I piani di Routally, CF Ready, Hub Fatture e Sequent sono stati riferimenti di struttura, non fonti di requisiti propri di FiscalBay. Non serve rileggerli per implementare l’app.

<a id="s01"></a>
### S01 · Stripe · Managed Payments: aggiornare Checkout

- [Documentazione ufficiale 1](https://docs.stripe.com/payments/managed-payments/update-checkout)
- [Documentazione ufficiale 2](https://docs.stripe.com/payments/managed-payments/changelog)

**Verifica pertinente:** G-STRIPE; prezzi in EUR con eventuale conversione provider, acquisto durante trial, checkout compatibile e ambiti non supportati.

<a id="s02"></a>
### S02 · Supabase · Database backups

- [Documentazione ufficiale 1](https://supabase.com/docs/guides/platform/backups)

**Verifica pertinente:** G-RECOVERY; compatibilità con sole protezioni native e unico restore drill prima del go-live.

<a id="s03"></a>
### S03 · Stripe · Managed Payments: tax compliance

- [Documentazione ufficiale 1](https://docs.stripe.com/payments/managed-payments/tax-compliance)
- [Documentazione ufficiale 2](https://docs.stripe.com/payments/managed-payments/eligibility)

**Verifica pertinente:** G-STRIPE/G-LEGAL; Paesi, categorie e acquirenti coperti, esclusione di operazioni che lascino a Temisfera la fiscalità della singola vendita.

<a id="s04"></a>
### S04 · Supabase · Passkeys

- [Documentazione ufficiale 1](https://supabase.com/docs/guides/auth/passkeys)

**Verifica pertinente:** G-AUTH; tutti e quattro gli accessi, enrollment, recupero, revoche e distinzione login/MFA.

<a id="s05"></a>
### S05 · Supabase · Provider OAuth personalizzati

- [Documentazione ufficiale 1](https://supabase.com/docs/guides/auth/custom-oauth-providers)

**Verifica pertinente:** G-AUTH/G-EBAY; qualifica eBay login separato da consenso seller.

<a id="s06"></a>
### S06 · eBay · Fulfillment, Trading e contratti ufficiali delle fonti

- [Documentazione ufficiale 1](https://developer.ebay.com/develop/api/sell/fulfillment_api)
- [Documentazione ufficiale 2](https://developer.ebay.com/api-docs/sell/fulfillment/resources/order/methods/getOrders)
- [Documentazione ufficiale 3](https://developer.ebay.com/api-docs/sell/fulfillment/resources/order/methods/getOrder)
- [Trading API `GetOrders`](https://developer.ebay.com/DevZone/XML/Docs/Reference/ebay/GetOrders.html)
- [Trading `TaxIdentifierType`](https://developer.ebay.com/devzone/xml/docs/Reference/eBay/types/TaxIdentifierType.html)
- [Notification API](https://developer.ebay.com/develop/api/buy/notification_api)
- [Notification API release notes](https://developer.ebay.com/api-docs/commerce/notification/static/release-notes.html)
- [Authorization code grant e RuName](https://developer.ebay.com/develop/guides/sell/authorization)
- [Modern APIs Migration Guide](https://developer.ebay.com/develop/guides/sell/modern-apis-migration-guide) ([Markdown](https://developer.ebay.com/develop/guides/modern-apis-migration-guide.md))
- [API Deprecation Status](https://developer.ebay.com/develop/get-started/api-deprecation-status)
- [API Call Limits](https://developer.ebay.com/develop/api/sell/api_call_limits)
- [Notification Topics](https://developer.ebay.com/develop/api/sell/notification_events), con le specifiche AsyncAPI per topic (`/develop/api/spec/events/<TOPIC>.yaml`)
- [App Insights API](https://developer.ebay.com/develop/api/sell/app_insights_api) e [schema GraphQL unificato](https://developer.ebay.com/develop/api/spec/listing.graphqls)
- [D.M. 23 dicembre 1976: sistemi di codificazione per l'anagrafe tributaria](https://def.giustiziatributaria.gov.it/DocTribFrontend/getAttoNormativoDetail.do?ACTION=getSommario&id=%7B8D93A450-E5FE-47FC-A6F0-F938769051BF%7D)

**Verifica pertinente:** G-EBAY; matrice campo/fonte/età/stato, scope e identità stabili, dati pagati/non pagati, mascheramenti, immagini ed eventi. La precedenza fiscale qualificata è definita in [§9 del piano](MASTER_PLAN.md#s09): Fulfillment per il CF italiano Production nelle condizioni provate, Trading `GetOrders` come fallback con `BuyerTaxIdentifier` condizionale e ripetibile. Gli eventi non sostituiscono il polling di riconciliazione e la consegna attribuita Production resta nel test merchant. Verifica del 2026-10-27: lo schema GraphQL non espone identificativi fiscali né indirizzo di fatturazione, nessuna data di dismissione riguarda le chiamate Trading usate, il supporto sviluppatori eBay conferma `getOrder` e `GetOrders` per gli identificativi fiscali e oltre le quote predefinite si passa dall'Application Growth Check. Per OAuth eBay usa il RuName al posto della URL nel parametro `redirect_uri`, raccomanda `state` contro CSRF e limita il codice monouso a 1.024 caratteri. Il decreto governa i controlli locali di struttura e carattere di controllo, compresi omocodia e CF numerico; un esito formale non verifica l'Anagrafe tributaria.

<a id="s07"></a>
### S07 · Cloudflare · D1 Time Travel

- [D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/)
- [Limiti D1](https://developers.cloudflare.com/d1/platform/limits/)
- [Consistenza Cloudflare KV](https://developers.cloudflare.com/kv/concepts/how-kv-works/)
- [Consistenza R2](https://developers.cloudflare.com/r2/reference/consistency/)
- [Lifecycle R2](https://developers.cloudflare.com/r2/buckets/object-lifecycles/)
- [Storage SQLite dei Durable Objects](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/)

**Verifica pertinente:** G-RECOVERY; selezione di un meccanismo nativo e prova effettiva del restore. Time Travel ripristina il database in uso e non offre ancora il clone da un punto precedente. Con la singola D1 scelta dall'owner, prima del restore occorre congelare il servizio ed estrarre i marker successivi allo snapshot dal database corrente; dopo il restore vanno riapplicati e riconciliati con i provider prima della riapertura. Se l'intervallo non è ricostruibile con certezza, il servizio resta chiuso.

<a id="s08"></a>
### S08 · Node.js · Release supportate

- [Documentazione ufficiale 1](https://nodejs.org/en/about/previous-releases)

**Verifica pertinente:** G-STACK; preferenza latest stable qualificata richiesta dall’owner, compatibilità e pin riproducibili.

<a id="s09"></a>
### S09 · Microsoft · Release TypeScript

- [Documentazione ufficiale 1](https://devblogs.microsoft.com/typescript/)

**Verifica pertinente:** G-STACK; latest stable, typecheck, editor/lint/build/generatori coerenti.

<a id="s10"></a>
### S10 · Cloudflare · Prezzi e conteggio Queues

- [Documentazione ufficiale 1](https://developers.cloudflare.com/queues/platform/pricing/)

**Verifica pertinente:** G-INFRA/G-DATA; modello 12.000 cicli/giorno e 1.080.000 operazioni/30 giorni puramente illustrativo, non benchmark.

<a id="s11"></a>
### S11 · Unione europea · Prezzi e pagamenti ai consumatori

- [Documentazione ufficiale 1](https://europa.eu/youreurope/citizens/consumers/shopping/pricing-payments/index_it.htm)

**Verifica pertinente:** G-LEGAL; listino canonico netto ma informazione chiara sul totale per i consumatori.

<a id="s12"></a>
### S12 · Email · iCloud+ dominio personalizzato e Supabase SMTP

- [Documentazione ufficiale 1](https://support.apple.com/it-it/guide/icloud/mme8ed800b5d/icloud)
- [Documentazione ufficiale 2](https://supabase.com/docs/guides/auth/auth-smtp)

**Verifica pertinente:** G-INFRA/G-AUTH; info/supporto su iCloud+, noreply transazionale separato, test di ricezione/risposta e consegna.

<a id="s13"></a>
### S13 · Stripe · MCP e strumenti agenti

- [Documentazione ufficiale 1](https://docs.stripe.com/mcp)

**Verifica pertinente:** G-STACK/G-STRIPE; tooling test/live, identità account, chiavi ristrette/OAuth, scritture nel perimetro approvato.

<a id="s14"></a>
### S14 · OpenAI · Codex: MCP e skill

- [Documentazione ufficiale 1](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)
- [Documentazione ufficiale 2](https://learn.chatgpt.com/docs/build-skills)
- [Documentazione ufficiale 3](https://developers.openai.com/codex/mcp)
- [Documentazione ufficiale 4](https://developers.openai.com/codex/skills)

**Verifica pertinente:** G-STACK; setup riproducibile, caricamento per fase, separazione dati/config privata e codice pubblico.

<a id="s15"></a>
### S15 · shadcn/ui · MCP

- [Documentazione ufficiale 1](https://ui.shadcn.com/docs/mcp)

**Verifica pertinente:** G-UX/G-STACK; registry, CLI, provenienza del codice e coerenza del sistema visivo.

<a id="s16"></a>
### S16 · Cloudflare e Supabase · MCP ufficiali

- [Documentazione ufficiale 1](https://developers.cloudflare.com/agents/model-context-protocol/cloudflare/servers-for-cloudflare/)
- [Documentazione ufficiale 2](https://supabase.com/docs/guides/ai-tools/mcp)

**Verifica pertinente:** G-INFRA/G-STACK; tool rilevanti per progetto, inventario dei permessi, smoke e revoca.

<a id="s17"></a>
### S17 · Expo · Web e componenti specifici di piattaforma

- [Documentazione ufficiale 1](https://docs.expo.dev/workflow/web/)

**Verifica pertinente:** G-UX; riuso token/dominio/contratti, niente UI universale forzata o WebView come sostituto della 3.x.

<a id="s18"></a>
### S18 · Stripe · Comportamento Managed Payments e cancellazioni Link

- [How Managed Payments works](https://docs.stripe.com/payments/managed-payments/how-it-works)
- [Aggiornamento Checkout Managed Payments](https://docs.stripe.com/payments/managed-payments/update-checkout)

**Osservato nella revisione:** vincoli di Checkout e dominio personalizzato; ruolo Link/Portal e contatti di supporto; cancellazione finanziaria tramite Link che può annullare abbonamenti e rimuovere oggetti nell’account del fornitore. Le prove di acquisti visibili in Link e invio ricevute non sono equivalenti tra sandbox e live.

**Uso:** §6.5–6.6, §36.2; M0-08, M5-03/06/08/12, M9-01. Verificare nell’account effettivo; nessuna capability live certificata dalla lettura.

<a id="s19"></a>
### S19 · Supabase · Auth server-side e helper SSR

- [Server-side rendering](https://supabase.com/docs/guides/auth/server-side)

**Uso:** §7.1, §26; M0-04/11. Qualificare versione/stabilità e integrazione con React Router prima di selezionare il percorso.

<a id="s20"></a>
### S20 · Supabase · Sessioni e revoca

- [User sessions](https://supabase.com/docs/guides/auth/sessions)

**Uso:** §7.1 e §29.1; test di riuso del token dopo logout/cancellazione su tutti i percorsi realmente esposti. La lettura non dimostra che FiscalBay abbia già implementato una revoca immediata.

<a id="s21"></a>
### S21 · Supabase · Policy, viste, funzioni e storage

- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Storage access control](https://supabase.com/docs/guides/storage/security/access-control)

**Uso:** §25/29; M1-03, M2-04, M7-01. RLS è una difesa da configurare e testare, non una garanzia automatica di isolamento o degli sblocchi.

<a id="s22"></a>
### S22 · Cloudflare R2 · URL firmati

- [Presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)

**Uso:** §12; M0-10 e M6-03. Definire un percorso di download che rispetti il requisito di accesso autenticato e revocabile.

<a id="s23"></a>
### S23 · eBay · Cancellazione utenti marketplace

- [Marketplace user account deletion](https://developer.ebay.com/develop/guides-v2/marketplace-user-account-deletion)

**Uso:** §30/32; M0-05/09/12, M7-02/07 e drill finale. Verificare compatibilità anche con snapshot, chiavi e copie native.

<a id="s24"></a>
### S24 · Microsoft e OWASP · CSV, conversioni e formula injection

- [Microsoft: zeri iniziali e numeri elevati](https://support.microsoft.com/it-IT/Excel/keeping-leading-zeros-and-large-numbers)
- [OWASP: CSV Injection](https://owasp.org/www-community/attacks/CSV_Injection)

**Uso:** §12; M0-10 e M6-01/02. Conservare i codici come dati, non introdurre formule per forzare il formato; documentare l’importazione testuale e verificare XLSX tipizzato. Nessuna promessa di compatibilità universale del CSV.


## Fonti da qualificare durante l’implementazione, senza presunzione di verifica attuale

G-EBAY deve recuperare le specifiche ufficiali correnti per OAuth/Identity, Selling/Fulfillment, Trading dove indispensabile, notifiche, cancellazione utenti, limiti del keyset e condizioni di utilizzo/marchi. G-STRIPE deve recuperare API/versioni SDK, prezzi applicabili al conto, metodi, portal, refunds e subscription schedule sulla configurazione effettiva. G-AUTH deve verificare anche Better Auth se selezionato e non assumere compatibilità dei provider da una generica voce “OAuth”.

G-LEGAL finalizza il trattamento italiano residuale Temisfera/MoR e l’informativa corretta per dati, fornitori e Codex sulla configurazione che verrà pubblicata. G-UX verifica le licenze dei singoli componenti dei nove riferimenti: un sito di ispirazione non è una concessione di riuso del suo intero codice, marchio o contenuto.

Non fissare listini dei provider come promesse del piano. Costi e quote residui reali appartengono alla relazione privata M0, con fonte, data e account, prima di qualsiasi acquisto.


## Perimetro della revisione documentale successiva

Il 13 settembre 2026 sono state rilette selettivamente S01/S02/S04–S09, S13/S14 e le nuove S18–S24 per i rilievi della revisione. Le altre voci conservano il perimetro della verifica documentale iniziale; non si dichiara una nuova qualifica integrale di ogni URL, account o condizione commerciale. Node/TypeScript sono stati ricontrollati come fonti di release/compatibilità, senza aggiornare automaticamente alcun pacchetto.

Il 20 settembre 2026 sono state rilette le fonti S29–S33 per il consolidamento legale preliminare M0. La lettura qualifica ruoli e gate del candidato corrente; informative, condizioni, accordi applicabili e configurazioni provider vengono riletti sul candidato finale prima della pubblicazione.

<a id="s25"></a>
### S25 · OpenAI/Codex · Discovery delle istruzioni

- [AGENTS.md](https://developers.openai.com/codex/guides/agents-md)

**Riletto per il handover:** istruzioni scoperte gerarchicamente, override e budget di caricamento. Il pacchetto usa AGENTS breve e rinvii espliciti; non presume caricamento integrale del piano. Controllare la sessione dopo la sostituzione delle istruzioni legacy. La prova nel client dell’owner resta M0-01.

<a id="s26"></a>
### S26 · OpenAI/Codex · MCP e configurazione

- [MCP](https://developers.openai.com/codex/mcp)
- [Configuration reference](https://developers.openai.com/codex/config-reference)

**Riletto per il handover:** modalità di configurazione e autenticazione, ambiti e dipendenze dal client/configurazione effettivi. Non si presume che una connessione ChatGPT sia trasferita automaticamente al client Codex. Endpoint e parametri vengono riletti durante M0 nella versione installata; la consegna non abilita tool o chiavi.

<a id="s27"></a>
### S27 · OpenAI/Codex · Skill

- [Skill](https://developers.openai.com/codex/skills)

**Riletto per il handover:** le skill sono contenuti/strumenti da scoprire e caricare per necessità, non un motivo per copiare tutte le istruzioni nel Master Plan. Origine, versione, licenza e capability vengono verificate prima dell’uso.

### Riscontro GitHub del conflitto iniziale

Il file `AGENTS.md` di `max23468/FiscalBay`, blob `d0c6b0e34d5493d7206df270d0d34d1eedeec94e`, è stato riletto per questa revisione del pacchetto. Descrive ancora Telegram-first/Python, regole di branch/CI e deploy VPS incompatibili con la baseline 2.0. Questo giustifica il percorso di adozione; non prova che quelle automazioni siano oggi attive sul server. Il loro stato va riletto in M0 prima di push/merge o dismissione.

Le pagine OpenAI possono essere reindirizzate alla documentazione ufficiale corrente. I riferimenti sono ingressi da verificare, non una promessa di permanenza della stessa interfaccia CLI. Nessun audit delle risorse live è stato eseguito in questa revisione documentale.

<a id="s28"></a>
### S28 · Codex desktop e file iCloud locali

- [Codex desktop · documentazione ufficiale](https://developers.openai.com/codex/app/)
- [Modello di sicurezza e approvazioni Codex](https://developers.openai.com/codex/security)
- [Apple · lavorare con i file iCloud Drive sul Mac](https://support.apple.com/en-euro/guide/mac-help/mchl1a02d711/mac)

**Verifica pertinente:** checkout locale corretto, disponibilità effettiva dello ZIP scaricato e permessi del client. Il percorso iCloud indicato nel README è un candidato standard, non una directory garantita su ogni Mac. Nessun collegamento in questa lista autorizza accesso o scritture.

<a id="s29"></a>
### S29 · Better Auth Infrastructure · dati, retention e condizioni

- [Introduzione a Infrastructure](https://better-auth.com/docs/infrastructure/introduction)
- [Dashboard plugin](https://better-auth.com/docs/infrastructure/plugins/dashboard)
- [Audit logs](https://better-auth.com/docs/infrastructure/plugins/audit-logs)
- [Prezzi e retention](https://better-auth.com/pricing)
- [Termini](https://better-auth.com/legal/terms)
- [Privacy](https://better-auth.com/legal/privacy)
- [Telemetria del core](https://better-auth.com/docs/reference/telemetry)

**Verifica del candidato:** la telemetria anonima e disattivata di default del core non descrive il plugin Infrastructure. Il codice installato di `@better-auth/infra` 0.4.9 mostra che `dash()` invia automaticamente eventi di autenticazione a `dash.better-auth.com`: tipo e descrizione evento, ID utente/account/sessione quando pertinenti, email, nome, provider o metodo di accesso, user agent, IP e localizzazione derivata. Non invia dal percorso osservato password, secret Better Auth o token OAuth. L'opzione `activityTracking`, disattivata di default, governa `lastActiveAt` ma non disabilita gli audit event. Sentinel, email, SMS e servizi enterprise non sono attivi. Il piano Starter è gratuito, dichiara 10.000 audit log al mese e un giorno di retention, ed è presentato per valutazione e side project; il piano Pro è presentato per team Production. I termini affidano al cliente informative, permessi e corretto uso degli end user data, non includono uno SLA senza accordo separato e prevedono la sottoscrizione di un DPA quando richiesta dal GDPR. La privacy policy qualifica Better Auth come responsabile per i dati degli utenti finali, contempla subprocessori e trasferimenti internazionali con garanzie come le SCC, ma non espone nel percorso pubblico verificato un DPA Starter già sottoscritto né un elenco nominativo dei subprocessori.

**Uso:** §29–30; M0-12, M0-14 e M7-07. La corsia cloud è qualificata per M0 e ambiente controllato. Prima di utenti pubblici occorrono DPA applicabile, inventario fornitore/subprocessori/trasferimenti, informativa coerente, procedura di cancellazione e conferma che il piano scelto sia ammesso e adeguato alla Production; in assenza di uno di questi elementi il secret Infrastructure viene rimosso e Better Auth core continua self-hosted.

<a id="s30"></a>
### S30 · Privacy e consumatori · fonti pubbliche primarie

- [Garante: principi fondamentali del trattamento](https://www.garanteprivacy.it/home/principi-fondamentali-del-trattamento)
- [Garante: misure di sicurezza](https://www.garanteprivacy.it/temi/cybersecurity/misure-di-sicurezza)
- [UE: restituzioni e diritto di recesso](https://europa.eu/youreurope/citizens/consumers/shopping/returns/index_it.htm)

**Uso:** §29–30; M0-12 e M7-07. Minimizzazione, ruoli, destinatari, trasferimenti, retention e diritti devono comparire nei deliverable effettivi. La policy rimborsi Managed Payments non sostituisce l'analisi del recesso e delle eccezioni applicabili a servizi e contenuti digitali. La qualifica M0 assegna la revisione finale e non costituisce un parere legale.

<a id="s31"></a>
### S31 · OpenAI · trattamento dei dati dello strumento interno

- [Privacy policy UE](https://openai.com/policies/eu-privacy-policy/)
- [Privacy, sicurezza e conformità dei dati Business](https://openai.com/business-data/)

**Uso:** §29–30; M0-12 e M7-07. Codex non è un componente runtime. Le garanzie Business/API senza training di default si applicano ai prodotti indicati dalla fonte e non vengono estese per presunzione all'account/sessione dell'operatore; piano e impostazioni effettivi vanno verificati prima di uso sistematico con dati reali.

<a id="s32"></a>
### S32 · eBay · licenza API, DPA, contenuti e marchi

- [API License Agreement](https://www.developer.ebay.com/join/api-license-agreement)
- [Policy del Developers Program](https://developer.ebay.com/join/policies)

**Uso:** §29–30; M0-12, M1 e M7-07. La licenza corrente incorpora il DPA, limita copie e uso dei dati, vieta l'uso dei contenuti eBay per addestrare modelli e governa marchi/pubblicità. Dal 2026 definisce le Restricted APIs, i cui dati non entrano in AI non fornite da eBay, e il DPA include gli obblighi 28 CFR Part 202. Rileggere la versione corrente al gate di pubblicazione e non interpretare l'accesso API come licenza generale sul brand.

<a id="s33"></a>
### S33 · Licenze runtime del candidato

- [Debian Sources: licenza di `buffers` 0.1.1](https://sources.debian.org/copyright/license/node-buffers/0.1.1-2/)

**Verifica locale:** `pnpm licenses list --prod --json` sul lockfile candidato ha censito licenze permissive, una scelta duale MIT/GPL per `jszip`, MIT+Zlib per `pako` e un solo metadata mancante per `buffers@0.1.1`, risolto dalla provenienza distribuita come MIT. Il risultato qualifica la dipendenza corrente, non sostituisce il notice distributivo né l'inventario di asset e componenti copiati.

**Uso:** §30; M0-10/12, M1 e M7-07.

<a id="s34"></a>
### S34 · Cloudflare · servizi della piattaforma

- [Prezzi e Workers Logs](https://developers.cloudflare.com/workers/platform/pricing/)
- [Limiti Workers e Cron Trigger](https://developers.cloudflare.com/workers/platform/limits/)
- [Workers Logpush](https://developers.cloudflare.com/workers/observability/logs/logpush/)
- [Campi Workers Trace Events](https://developers.cloudflare.com/logs/logpush/logpush-job/datasets/account/workers_trace_events/)
- [Giurisdizione R2 e limiti della destinazione Logpush diretta](https://developers.cloudflare.com/r2/reference/data-location/)
- [Logpush verso R2 UE tramite destinazione S3-compatible](https://developers.cloudflare.com/data-localization/how-to/r2/#send-logs-to-r2-via-s3-compatible-endpoint)
- [Lifecycle R2](https://developers.cloudflare.com/r2/buckets/object-lifecycles/)
- [Limiti D1](https://developers.cloudflare.com/d1/platform/limits/)
- [D1 read replication e Sessions API](https://developers.cloudflare.com/d1/best-practices/read-replication/)
- [Limiti e scadenza dei messaggi Queues](https://developers.cloudflare.com/queues/platform/limits/)
- [Giurisdizione delle Queues](https://developers.cloudflare.com/queues/configuration/data-location/)
- [Rate Limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
- [Turnstile, verifica lato server](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
- [Workers Analytics Engine](https://developers.cloudflare.com/analytics/analytics-engine/)
- [Quote e prezzi Analytics Engine](https://developers.cloudflare.com/analytics/analytics-engine/pricing/)
- [Limiti e retention Analytics Engine](https://developers.cloudflare.com/analytics/analytics-engine/limits/)
- [SQL API Analytics Engine e campionamento](https://developers.cloudflare.com/analytics/analytics-engine/sql-api/)
- [Database supportati da Hyperdrive](https://developers.cloudflare.com/hyperdrive/reference/supported-databases-and-features/)
- [Prezzi Email Service](https://developers.cloudflare.com/email-service/platform/pricing/)
- [Workers Logs e Traces nelle Custom Dashboards](https://developers.cloudflare.com/changelog/post/2026-10-02-workers-observability-in-custom-dashboards/)
- [Dataset e aggregazioni delle Custom Dashboards](https://developers.cloudflare.com/analytics/custom-dashboards/#workers-observability-data)
- [Marcatori release in Workers Metrics](https://developers.cloudflare.com/changelog/post/2026-09-25-release-flows-workers-metrics/)
- [Nuove API dei custom span Workers](https://developers.cloudflare.com/changelog/post/2026-09-25-custom-span-apis/)
- [Soppressioni per dominio mittente](https://developers.cloudflare.com/changelog/post/2026-09-25-sending-domain-suppressions/)
- [Validazione Rulesets con dry run](https://developers.cloudflare.com/changelog/post/2026-09-17-rulesets-dry-run-validation/)
- [Logpush generale e tariffazione separata Workers Trace Events](https://developers.cloudflare.com/changelog/post/2026-09-30-logpush-usage-based-pricing/)
- [Storico analytics della zona fino a 30 giorni](https://developers.cloudflare.com/changelog/post/2026-10-02-30-days-analytics-on-every-plan/)
- [Prezzi Observability dal 1° dicembre 2026](https://developers.cloudflare.com/observability/pricing/)

**Verifica del 2026-10-11:** Workers Logs conserva 3 giorni sul Free e 7 sul Paid e passa ai prezzi Observability dal 1° dicembre 2026; Logpush dei Workers richiede Paid. Cron Trigger: 5 per account sul Free, 250 sul Paid. Email Sending è in beta e l'invio a destinatari non verificati richiede Paid, con 3.000 email al mese incluse. Token Turnstile monouso, validi 300 secondi, da verificare con Siteverify.

**Verifica del 2026-10-12:** D1 ha un limite di 500 MB per database sul Free e 10 GB sul Paid, distinto da 5 GB/1 TB per account. Read replication usa Sessions API; `first-primary` avvia la sessione dai dati più recenti, un bookmark conserva soltanto una versione minima. Queue: retention Free fissa a 24 ore, Paid fino a 14 giorni; i messaggi scaduti sono eliminati. Per R2 con giurisdizione UE, Logpush richiede una destinazione S3-compatible sull'endpoint UE: la destinazione R2 diretta non supporta la giurisdizione. Workers Trace Events comprende `Event`, `Exceptions` e `Logs`, da filtrare secondo l'allowlist applicativa. Hyperdrive supporta PostgreSQL e MySQL esterni, non D1.

Analytics Engine conserva tre mesi e ammette fino a 250 datapoint per invocazione. Quote pubblicate: Free 100.000 datapoint e 10.000 query al giorno; Paid 10 milioni di datapoint e un milione di query al mese, poi 0,25 USD e 1 USD per milione rispettivamente. La pagina prezzi dichiara che gli addebiti non sono ancora attivi: riconfermare prima dell'adozione. Nella sua SQL API conteggi, medie e quantili devono rispettare `_sample_interval`. Queste verifiche documentali non attestano binding attivi, capacità residua dell'account o nuovi costi autorizzati.

**Uso:** §12, §14, §25, §29, §31; M3-12, M4-01, M6-03, M6-06, M6-10, M6-11, M7-03, M7-04, M7-09, M7-10, M7-11, M7-12; procedura in [RELEASE](engineering/RELEASE.md#dashboard-test). Limiti e prezzi cambiano: rileggerli prima di una decisione di piano o dell'apertura pubblica.

<a id="s35"></a>
### S35 · Trasporto email alternativo

- [Prezzi Resend](https://resend.com/pricing)
- [Prezzi Brevo](https://www.brevo.com/pricing/)
- [Piani Brevo](https://help.brevo.com/hc/en-us/articles/208589409-About-Brevo-s-pricing-plans)
- [Limiti Free e invii transazionali Brevo](https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan)

**Verifica del 2026-10-12:** la pagina ufficiale Resend conferma 3.000 email al mese, massimo 100 al giorno e tre domini sul Free. La pagina prezzi Brevo non restituisce contenuto leggibile nel canale di consultazione usato; il suo help ufficiale conferma 300 invii al giorno, senza riporto dei crediti inutilizzati, anche per email transazionali. Verificare nell'account selezionato limiti e gestione del superamento prima di qualificare l'invio Auth pubblico. Nessuna opzione selezionata o nuovo provider attivato.

**Uso:** §14; M6-06. Opzioni aperte accanto a Cloudflare Email Service ([S34](#s34)).

<a id="s36"></a>
### S36 · Cloudflare · protezioni della zona e della posta

- [HSTS e sottodomini](https://developers.cloudflare.com/ssl/edge-certificates/additional-options/http-strict-transport-security/)
- [Response Header Transform Rules](https://developers.cloudflare.com/rules/transform/response-header-modification/)
- [Header dei Managed Transforms](https://developers.cloudflare.com/rules/transform/managed-transforms/reference/)
- [WAF e Free Managed Ruleset](https://developers.cloudflare.com/waf/get-started/)
- [Regole WAF personalizzate](https://developers.cloudflare.com/waf/custom-rules/)
- [Rate limiting della zona](https://developers.cloudflare.com/waf/rate-limiting-rules/)
- [Limiti Bot Fight Mode](https://developers.cloudflare.com/bots/get-started/bot-fight-mode/)
- [DMARC Management e report aggregati](https://developers.cloudflare.com/dmarc-management/)
- [Attivazione DMARC Management](https://developers.cloudflare.com/dmarc-management/enable/)
- [Certificate Transparency Monitoring](https://developers.cloudflare.com/ssl/edge-certificates/additional-options/certificate-transparency-monitoring/)

**Verifica del 2026-10-12:** il Free Managed Ruleset è distribuito per default sul Free; il piano Free della zona ammette cinque regole WAF personalizzate e una di rate limiting. Bot Fight Mode non consente eccezioni con le regole WAF. HSTS richiede HTTPS qualificato, con sottodomini e preload da valutare separatamente. Cloudflare offre modifica degli header; l'effetto sulle risposte Workers/asset va provato sul sito effettivo. DMARC Management è disponibile con Cloudflare DNS su tutti i piani ed è indicato come beta nelle pagine operative: aggiunge `rua` al record esistente per ricevere report aggregati. CT Monitoring avvisa delle emissioni presenti nei log pubblici CT, filtrando quelle gestite da Cloudflare; non rileva domini imitativi. Nessuno di questi dati documentali attesta piano, toggle, regole o destinatari attivi su fiscalbay.it.

**Uso:** §24, §29–31; M6-06, M7-04, M7-07, M7-12, M8-03 e M9-03. Qualificare configurazione, regressioni e rientro nei task competenti prima dell'apertura pubblica; nessun upgrade della zona autorizzato dall'inclusione documentale.
