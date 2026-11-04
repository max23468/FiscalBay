# Avvio e collaudo commerciale

Configurazione commerciale, checklist operativa, sorveglianza iniziale e test merchant. Fa parte delle [operazioni](OPERATIONS.md); il rilascio è in [Test e pubblicazione](RELEASE.md).

<a id="configurazione-commerciale"></a>
## Configurazione commerciale

Prima del go-live non si vende nulla per prova ([D240](../decisions/DECISION_REGISTER.md)): la configurazione live si rilegge senza incassi, le vendite si rileggono quando arrivano. `scripts/commercial.mjs` lo fa in sola lettura, con `--mode live` e il profilo della CLI di Stripe dell'ambiente: dalla versione 1.55 la CLI usa l'account attivo, quindi prima si passa a quello live con `stripe switch <account> --live` e alla fine si torna alla sandbox; il resoconto riporta esiti, conteggi e percentuali, mai importi, clienti o riferimenti, ed esce con errore a ogni scostamento. Senza il profilo live della CLI, l'account si rilegge con il connettore Stripe passando le stesse risorse a `checkAccount` di `stripe-account.mjs`; il connettore non legge il profilo pubblico. Sul test (`--project-name fiscalbay-sandbox`) i pagamenti dei Test Clock risultano senza offerta, perché Stripe non elenca le loro fatture.

1. **Al go-live.** Dopo il deploy Production e prima di aprire le iscrizioni si crea dalla console la promozione con la fine vuota ([D239](../decisions/DECISION_REGISTER.md)). `node scripts/commercial.mjs preflight --mode live` rilegge l'account Stripe come `stripe-account.mjs`, poi in D1 una sola promozione già iniziata con quota 10, senza fine o con quella decisa dall'owner, la quota base 5 dopo la promozione, acquisti aperti, lista d'attesa e posti lifetime occupati. La fine si programma soltanto su indicazione dell'owner, secondo [§5 del piano](../product/PLANS_AND_BILLING.md#s05).
2. **Prime vendite reali.** Nella sorveglianza iniziale, dopo il compito orario `billing` e dopo l'addebito della commissione giornaliera di Managed Payments, `node scripts/commercial.mjs verify --since <go-live> --mode live` richiede un diritto in D1 per ogni fattura e ogni lifetime pagati e ogni abbonamento FiscalBay uguale in D1 per stato, periodicità del periodo pagato e del rinnovo, fine del periodo, disdetta e generazione del listino. Per ogni offerta venduta confronta la commissione effettiva con la stima di [D193](../decisions/DECISION_REGISTER.md): commissione dell'addebito più le quote di Managed Payments e, per gli abbonamenti, di Billing, ripartite sul lordo, sul netto senza imposte trattenute. Oltre la stima di più di un decimo, o con un pagamento senza offerta, decide l'owner. Conta infine gli abbonamenti con il metodo cambiato e quelli già addebitati sul nuovo.

<a id="checklist-operativa"></a>
## Checklist operativa

`scripts/go-live.mjs` rilegge in sola lettura la checklist del [§41](../archive/2026-11-master-plan-2.0.md#s41) per un ambiente e ne dà un solo esito: esce con 1 se un controllo automatico non passa o non si esegue. `plan` elenca le voci per fase senza leggere nulla; `check --mode live --phase prima|dopo|tutte` le rilegge. Il resoconto riporta nomi ed esiti, mai valori di segreti o dati degli utenti; gli script di area aggiungono il proprio resoconto rientrato.

| Fase | Controlli automatici |
|---|---|
| `prima`, prima di `Promuovi` | Worker sul dominio dell'ambiente; segreti dichiarati in `cloudflare.config.ts` e facoltativi di `credential-expiries.mjs`; D1 in UE; coda e coda dei falliti in UE a 14 giorni e bucket dei file in UE senza accesso pubblico con la regola a un giorno, come nell'[ingresso webhook](WEBHOOKS.md#webhook); widget Turnstile gestito sul solo dominio; [registro delle scadenze](OBSERVABILITY.md#incidenti) senza voci scadute, entro 45 giorni o senza data; ambiente GitHub della pubblicazione soltanto per il suo branch, con account, token e, in Production, interruttore; `stripe-account.mjs` |
| `dopo`, dopo il deploy e prima di aprire le iscrizioni | Consumer della coda con retry e coda dei falliti; robots, sitemap e pagine della sitemap nelle due lingue, indicizzabili soltanto in Production; Termini, Privacy, accesso e area riservata `noindex`; anteprima assente in Production; beacon delle [statistiche](OBSERVABILITY.md#statistiche-sito) sulle sole pagine pubbliche; versione del Worker nelle risposte; `zone-protection.mjs readback`, `log-archive.mjs readback`, che richiede il Worker con Logpush, `ebay-notifications.mjs`, `telegram-bot.mjs` con `TELEGRAM_BOT_TOKEN` e `TELEGRAM_OWNER_ID` nelle variabili del comando, `commercial.mjs preflight` |

Le prove a vista dell'owner della checklist sono state attestate al go-live e lo script non le ripete. Senza il profilo live della CLI di Stripe, l'account si rilegge con il connettore come nella [configurazione commerciale](#configurazione-commerciale) e la voce Stripe della fase `prima` si attesta con quel resoconto.

Il gate `operativita` dei [gate Production](../archive/2026-11-master-plan-2.0.md#pubblicazione-production) diventa `COMPLETATO` quando i controlli automatici di `check --mode live` della fase `prima` passano, quello di Stripe anche con il resoconto del connettore, e le voci della stessa fase sono attestate nella checklist pubblica e operativa. La fase `dopo` si ripete dopo il deploy, prima della promozione e dell'apertura delle iscrizioni; sul test le due fasi si rileggono insieme. Lo script non crea risorse né imposta segreti: code, bucket, archivio dei log, segreti e webhook di Production nascono con le procedure delle rispettive sezioni, nel mandato Production.

<a id="sorveglianza"></a>
## Sorveglianza iniziale

```bash
node scripts/surveillance.mjs --mode live --hours 24
```

La rilettura è di sola lettura, riporta conteggi ed esiti ed esce con 1 se una voce va guardata o non si legge. Le soglie P1 e P2 restano quelle degli [incidenti](OBSERVABILITY.md#incidenti): lo script legge quelli già valutati e prova che il compito `owner_incidents` stia girando; aggiunge i dati che la console non vede. `--hours` va da 1 a 2.160; senza `--mode live` legge il test.

| Area | Letto dallo script | Altrove |
|---|---|---|
| Registrazioni | Account creati e verificati, ammissioni, negozi collegati, cancellazioni | Console, KPI |
| Letture | Tentativi e falliti al giorno, passaggi degli spazi | Console, Negozi; `metrics-query.mjs` per i tempi |
| Stripe | Prove, acquisti, disdette, rimborsi, dispute, ricevute in attesa | `commercial.mjs verify` alla prima vendita ([configurazione commerciale](#configurazione-commerciale)); richieste di Stripe e Link in dashboard |
| Code | Arretrato oltre un turno del cron, coda dei falliti | Consumer nella checklist |
| Quote | Quote dell'account a 30 giorni, 8 GB del database | [Punti di arresto](CAPACITY.md#capacita); quote eBay negli incidenti |
| Errori | Risposte 5xx, invocazioni fallite di coda e cron, messaggi rimessi in coda | [Archivio](OBSERVABILITY.md#archivio-log) `errors` e `failures` per la causa |
| Supporto | Richieste del modulo, conservate 24 ore | Casella `supporto@`, all'owner |

Si legge nei primi giorni dal go-live e dopo ogni intervento in Production, senza una durata fissa. Una voce da guardare segue la procedura degli [incidenti](OBSERVABILITY.md#incidenti); gli esiti e le anomalie reali si riportano, senza un diario delle letture. La sorveglianza finisce quando una lettura non ha P1 o P2 aperte, `go-live.mjs check --mode live --phase dopo` è verde e le statistiche sono attive. Poi vale il normale esercizio: avvisi del bot, console e soglie della [capacità](CAPACITY.md#capacita), con lo script disponibile per una diagnosi.

<a id="test-merchant"></a>
## Test merchant

Manifest dei percorsi reali del test merchant, approvato dall'owner. L'identità del merchant, gli indirizzi e gli ID degli account sono nell'inventario privato, in `~/.config/fiscalbay/merchant-test.json`; qui restano i nomi logici. Un cambio di riga richiede una nuova approvazione.

| Voce | Perimetro |
|---|---|
| Candidato | La testa di `develop` distribuita sul test all'avvio delle prove e a ogni nuova versione; ogni evidenza riporta versione e commit su cui è stata raccolta. |
| Ambiente | `test.fiscalbay.it`: Worker, D1 UE, coda, R2 e Analytics Engine `fiscalbay-test`, Stripe sandbox, keyset eBay `botCF` con il RuName del test e Sandbox spenta. Nessun deploy, segreto o dato sul Worker Production. |
| Merchant | L'owner con il proprio negozio eBay Production business, già collegato al suo account del test. |
| Account | Account dell'owner, Premium a vita, con password, Google, passkey, identità eBay e Telegram: accessi, negozio, sync, dati fiscali, copia, export, Telegram e impostazioni. Secondo account dell'owner, ammesso con un indirizzo suo nella lista `REGISTRATION_ALLOWED_EMAILS`: registrazione, prova volontaria e acquisto nel Checkout. Account del drill, registrato dall'owner con un altro indirizzo suo nella stessa lista e cancellato dopo il punto: soltanto il [drill di ripristino](RECOVERY.md#drill-di-ripristino). Account sintetico di collaudo: soltanto i controlli automatici dopo il deploy. |
| Dati | Ordini, acquirenti e identificativi fiscali reali del negozio, letti in sola lettura con la conservazione del piano dello spazio. Evidenze sanificate, senza nomi, indirizzi, identificativi fiscali, token o chat; file esportati aperti sul dispositivo dell'owner e non allegati. |
| Credenziali | Segreti del Worker test e Portachiavi. Passkey legate a `test.fiscalbay.it`, cookie e sessioni del test, token eBay cifrati con il segreto Auth del test: nessuno vale su `fiscalbay.it`. |
| Billing | Stripe sandbox con la carta di prova 4242 inserita dall'owner. Il Worker rifiuta oggetti con `livemode` diverso dall'ambiente: sessioni, abbonamenti, ricevute e diritti sandbox non attestano diritti live. Portale, cambi live e commissioni effettive non si provano prima del go-live ([D240](../decisions/DECISION_REGISTER.md)). |
| Bot | `@fiscalbay_test_bot` con la chat dell'owner. Il bot Production non riceve token, webhook o messaggi. |
| Accedi con eBay | Le [prove reali](../archive/2026-11-master-plan-2.0.md#prove-ebay) si svolgono sul test con identità eBay Production; il passaggio su `fiscalbay.it` si ripete nel readback dopo `Promuovi` ([D234](../decisions/DECISION_REGISTER.md)). Il passo 7 richiede un account eBay individuale e un'email business già registrata controllati dall'owner, altrimenti resta aperto. |
| Prove già svolte | Una prova reale sul test già registrata vale anche per il test merchant se il codice del percorso non è cambiato dopo la prova: collegamento e lettura del negozio Production, passkey Safari/iOS, acquisto lifetime sandbox, webhook Stripe e Telegram, cancellazione dell'account, protezioni della zona. Il test merchant ripete solo i percorsi cambiati e svolge quelli mai provati. |
| Effetti live | Letture eBay Production sulle quote condivise del keyset, entro i [punti di arresto](CAPACITY.md#capacita). Sottoscrizioni eBay del keyset `AUTHORIZATION_REVOCATION`, `BULK_DATA_TRANSFER_THRESHOLD` e `ORDER_CONFIRMATION` del negozio verso l'ingresso del test. Email reali agli indirizzi dell'owner e messaggi reali nella sua chat. Nessun ordine, inserzione o messaggio eBay modificato, nessun RuName o callback cambiato, nessun incasso. Il collegamento chiede anche lo scope delle notifiche (D235): il negozio dell'owner si ricollega per ricevere `ORDER_CONFIRMATION`. |

**Uscita.** Le prove si chiudono quando ogni percorso ha un esito registrato e non restano P1/P2. Un P1/P2 su dati, isolamento, sicurezza o billing sospende il percorso fino alla correzione nella RC successiva. Si sospendono anche le letture del negozio a un punto di arresto delle quote o alla revoca del consenso da eBay. La lista di ammissione torna `[]`. Gli account controllati e i dati reali del test restano per altre prove secondo [D246](../decisions/DECISION_REGISTER.md), con le stesse regole di accesso e conservazione: non si cancellano al termine del test merchant o al cutover. Al cutover le sottoscrizioni eBay passano a `fiscalbay.it`. In Production l'owner si registra e ricollega il negozio da capo: account, passkey, consensi, ordini, versioni fiscali e diritti del test non si copiano.
