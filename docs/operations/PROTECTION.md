# Protezioni

Regole della zona, limiti nativi delle richieste e Turnstile. Fa parte delle [operazioni](OPERATIONS.md); il rilascio è in [Test e pubblicazione](RELEASE.md).

<a id="protezioni-zona"></a>
## Protezioni della zona

La zona `fiscalbay.it` è comune ai due ambienti e resta sul piano Free ([D229](../decisions/DECISION_REGISTER.md)). `scripts/zone-protection.mjs` gestisce le protezioni del [§24](OPERATIONS.md#s24) per l'ambiente scelto, `--mode live` per la Production:

| Protezione | Configurazione |
|---|---|
| Header e HSTS | Response Header Transform Rule `fiscalbay-<ambiente>-headers` sugli host dell'ambiente: `Strict-Transport-Security` al gradino corrente, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` e `Referrer-Policy: strict-origin-when-cross-origin`. La CSP resta del Worker |
| Webhook | Regola WAF `fiscalbay-<ambiente>-webhooks`: i percorsi esatti di `app/webhook-paths.ts` saltano Browser Integrity Check e modalità sotto attacco; firma e limiti restano del Worker |
| Sonde | Regola WAF `fiscalbay-<ambiente>-probes`: blocco all'edge di file nascosti (tranne `/.well-known/`), PHP, WordPress, backup e configurazioni |
| Raffiche di accesso | Regola di rate limiting `fiscalbay-auth-burst`, per tutta la zona: oltre 30 richieste in 10 secondi per IP verso `/api/auth/` rispondono 429 per 10 secondi |
| Report della posta | DMARC Management aggiunge il proprio `rua` al record `_dmarc` esistente, senza cambiare policy e allineamento |
| Certificati | Certificate Transparency Monitoring con alert a `info@fiscalbay.it` |
| Credenziali trapelate | Rilevamento attivo sulla zona; il managed transform `add_waf_credential_check_status_header`, che la CLI non gestisce, porta l'esito al Worker ed è stato attivato una volta dall'API il 2026-11-03 ([§29](../engineering/SECURITY_AND_PRIVACY.md#s29)) |
| Crawler AI | Blocco dei bot AI, AI Labyrinth e robots.txt gestito da Cloudflare restano spenti: i Content Signals del robots.txt dell'app ammettono ricerca, risposte AI e addestramento |

HSTS sale di un gradino, 5 minuti, un giorno, una settimana e un anno, soltanto dopo il readback del precedente, cambiando `hstsStage` nello script; `includeSubDomains` e `preload` restano fuori finché tutti i sottodomini non sono inventariati e provati. L'impostazione HSTS della zona resta spenta: varrebbe per entrambi gli ambienti. Bot Fight Mode resta spento perché non ammette eccezioni.

1. `node scripts/zone-protection.mjs plan` stampa regole, impostazioni della posta e gradino HSTS senza leggere né scrivere.
2. `node scripts/zone-protection.mjs validate` legge le fasi della zona e fa convalidare al provider, con `dry_run=true`, ogni fase come la scriverebbe `apply`: sintassi, campi e funzioni ammessi dal piano, azioni e quote. Non simula il traffico.
3. `node scripts/zone-protection.mjs apply` ripete la convalida, poi scrive le tre fasi, attiva gli alert dei certificati, DMARC Management e il rilevamento delle credenziali trapelate e aggiunge il `rua` al record DMARC se manca. Le regole con il `ref` dell'altro ambiente e quelle create a mano restano dove sono.
4. Il readback, compreso in `apply` o con `readback`, controlla le regole previste, piano Free, DNSSEC, HTTPS sempre, TLS 1.2 minimo, HSTS della zona senza sottodomini, Bot Fight Mode spento, crawler AI ammessi, rilevamento delle credenziali trapelate, alert e report della posta, policy DMARC, un solo SPF per nome e MX iCloud. Sulle risposte reali dell'ambiente controlla header di pagina, asset e pagina assente, cache di un anno dell'asset con hash, una password nota segnalata da `/api/v1/password-check`, CSP e `no-store` della pagina, sonda bloccata con 403, webhook invalido rifiutato dal Worker senza challenge e reindirizzamento da HTTP, più quello di `www` per la Production. `--burst` invia richieste al percorso di accesso finché arriva il 429: l'IP che prova resta bloccato su `/api/auth/` per 10 secondi. Esce con 1 se un controllo non passa.
5. Dopo il readback, i percorsi reali con le protezioni attive: `pnpm test:e2e:smoke` sul test, un accesso con passkey e con Google, un download di esportazione e un webhook valido di ciascun provider.

Il primo report DMARC arriva entro 24 ore dall'attivazione e si legge in **Email** > **DMARC Management** della dashboard; finché non ne arriva uno, la lettura resta una prova aperta. Gli alert dei certificati arrivano per email soltanto alle emissioni non gestite da Cloudflare. La risposta a un certificato inatteso, a un mittente sconosciuto o a un falso positivo WAF è negli [avvisi dei provider](OBSERVABILITY.md#incidenti).

Rientro: `node scripts/zone-protection.mjs remove` toglie le regole dell'ambiente e lascia quella di zona finché l'altro ambiente ha le sue; ogni scrittura crea anche una versione del ruleset, rileggibile con `cf rulesets entrypoint versions list <fase>`. DMARC Management e gli alert si spengono con `cf email-auth dmarc-reports edit --enabled false` e `cf ssl ct-alerting update --enabled false`; il `rua` di Cloudflare si toglie dal record `_dmarc` senza toccare gli altri tag.

<a id="rate-limiting"></a>
## Rate Limiting nativo

Il Worker filtra per IP, rete IPv6 /64 e operazione con tre binding Rate Limiting ([§29](../engineering/SECURITY_AND_PRIVACY.md#s29)), dichiarati in `cloudflare.config.ts` con namespace separati per ambiente e soglie in `app/request-limits.json`:

| Binding | Soglia | Operazioni |
|---|---|---|
| `REQUEST_LIMIT_ATTEMPTS` | 3 in 10 secondi | accesso e registrazione con password, cambio di password ed email, verifiche passkey |
| `REQUEST_LIMIT_EMAILS` | 3 in 60 secondi | nuovo link di conferma, recupero della password, cancellazione dell'account, assistenza |
| `REQUEST_LIMIT_WORK` | 10 in 60 secondi | file degli ordini, archivio dell'account, letture eBay a richiesta da Negozi e Ordini |

Il filtro precede sessione, Turnstile e database e risponde 429 con `Retry-After` pari alla finestra e `no-store`; recupero della password, nuovo link ed esportazione senza JavaScript tornano invece alla pagina con il redirect all'avviso, senza `Retry-After`; i moduli di accesso lo applicano prima di Turnstile e inoltrano ad Auth la richiesta già ammessa. D1 conserva soltanto i contatori per impronta dell'indirizzo email e il limite giornaliero dell'assistenza, coerenti fra data center. Il filtro è attivo sui domini HTTPS, dove Cloudflare fornisce l'IP: in locale e nell'anteprima non limita. Il deploy crea i binding con la versione, senza risorse da preparare; gli identificativi dei namespace sono liberi nell'account, dove nessun altro Worker usa Rate Limiting.

Readback dopo il deploy, sul test:

1. `pnpm exec cf workers versions get <versione> --worker-id fiscalbay-test` mostra i tre binding `ratelimit` con i namespace `2910`, `2911` e `2912`.
2. Quattro `POST https://test.fiscalbay.it/api/auth/sign-in/email` dallo stesso IP entro 10 secondi, con un indirizzo sintetico e una password sbagliata: il quarto risponde 429 con `Retry-After: 10`, `Cache-Control: no-store` e `TOO_MANY_REQUESTS`, uguale per un indirizzo esistente. La regola di zona `fiscalbay-auth-burst` scatta soltanto oltre 30 richieste.
3. `pnpm exec cf d1 query <id del test in cloudflare.config.ts> --sql 'SELECT "key", "lastRequest" FROM "rateLimit"'`: le prove del punto 2 non aggiungono chiavi per IP, soltanto l'impronta `email:` dell'indirizzo; quelle scritte prima del deploy scompaiono con la pulizia oraria.

<a id="turnstile"></a>
## Turnstile

Registrazione con password, recupero della password, nuovo link di conferma e assistenza passano dalla verifica Turnstile ([§29](../engineering/SECURITY_AND_PRIVACY.md#s29), [D231](../decisions/DECISION_REGISTER.md)). Ogni ambiente ha un widget proprio, in modalità gestita e limitato al suo dominio, con le chiavi nei segreti `TURNSTILE_SITE_KEY` e `TURNSTILE_SECRET_KEY` del Worker: la chiave del sito arriva al browser, ma nasce con il widget e si imposta insieme alla segreta. Entrambe sono obbligatorie nella configurazione, quindi il deploy si ferma finché mancano.

1. `pnpm exec cf turnstile widgets list` per ritrovare un widget già creato; altrimenti `pnpm exec cf turnstile widgets create --name fiscalbay-test --domains test.fiscalbay.it --widget-mode managed --clearance-level no_clearance`, oppure `--name fiscalbay --domains fiscalbay.it` per la Production. La risposta contiene la chiave segreta: va subito nel Portachiavi, senza stamparla, come voce «FiscalBay Turnstile test» o «FiscalBay Turnstile» con la chiave del sito come account. I due widget esistono dal 29 ottobre 2026.
2. `pnpm exec cf workers secrets update` imposta le due chiavi sul Worker dell'ambiente, prima del deploy che le richiede, e crea una versione con il codice già attivo: prima va riletto che l'ultima versione sia quella distribuita. Sul test sono impostate; sul Worker Production si impostano con gli altri segreti della pubblicazione.
3. Readback dopo il deploy: un nuovo link di conferma o una richiesta di assistenza sul test riesce; con il campo del token vuoto lo stesso invio risponde con l'avviso «Verifica di sicurezza non riuscita» senza email, e `POST /api/auth/sign-up/email` risponde 404. La CSP del documento ammette `https://challenges.cloudflare.com` soltanto in `script-src` e `frame-src`.

In locale, nei test e nell'anteprima della build valgono le chiavi di prova di Cloudflare, che accettano sempre: Siteverify ne marca l'esito, che l'app accetta soltanto fuori dai domini HTTPS. Sui domini dell'ambiente quell'esito vale come indisponibilità e rifiuta l'invio.
