# Avvio e collaudo commerciale

Verifica commerciale, checklist operativa e sorveglianza. Fa parte delle [operazioni](OPERATIONS.md); il rilascio è in [Test e pubblicazione](RELEASE.md). I passi del go-live, il gate operativo e il manifest del test merchant sono [archiviati](../archive/2026-11-lancio-2.0.md).

<a id="configurazione-commerciale"></a>
## Configurazione commerciale

`scripts/commercial.mjs` rilegge configurazione live e vendite reali ([D240](../decisions/DECISION_REGISTER.md)) in sola lettura, con `--mode live` e il profilo della CLI di Stripe dell'ambiente: dalla versione 1.55 la CLI usa l'account attivo, quindi prima si passa a quello live con `stripe switch <account> --live` e alla fine si torna alla sandbox; il resoconto riporta esiti, conteggi e percentuali, mai importi, clienti o riferimenti, ed esce con errore a ogni scostamento. Senza il profilo live della CLI, l'account si rilegge con il connettore Stripe passando le stesse risorse a `checkAccount` di `stripe-account.mjs`; il connettore non legge il profilo pubblico. Sul test (`--project-name fiscalbay-sandbox`) i pagamenti dei Test Clock risultano senza offerta, perché Stripe non elenca le loro fatture.

1. **Configurazione.** `node scripts/commercial.mjs preflight --mode live` rilegge l'account Stripe come `stripe-account.mjs`, poi in D1 una sola promozione già iniziata con quota 10, senza fine o con quella decisa dall'owner ([D239](../decisions/DECISION_REGISTER.md)), la quota base 5 dopo la promozione, acquisti aperti, lista d'attesa e posti lifetime occupati. La fine si programma soltanto su indicazione dell'owner, secondo [§5](../product/PLANS_AND_BILLING.md#s05).
2. **Vendite reali.** Dopo il compito orario `billing` e dopo l'addebito della commissione giornaliera di Managed Payments, `node scripts/commercial.mjs verify --since <go-live> --mode live` richiede un diritto in D1 per ogni fattura e ogni lifetime pagati e ogni abbonamento FiscalBay uguale in D1 per stato, periodicità del periodo pagato e del rinnovo, fine del periodo, disdetta e generazione del listino. Per ogni offerta venduta confronta la commissione effettiva con la stima di [D193](../decisions/DECISION_REGISTER.md): commissione dell'addebito più le quote di Managed Payments e, per gli abbonamenti, di Billing, ripartite sul lordo, sul netto senza imposte trattenute. Oltre la stima di più di un decimo, o con un pagamento senza offerta, decide l'owner. Conta infine gli abbonamenti con il metodo cambiato e quelli già addebitati sul nuovo.

<a id="checklist-operativa"></a>
## Checklist operativa

`scripts/go-live.mjs` rilegge in sola lettura la checklist del [§41](../archive/2026-11-master-plan-2.0.md#s41) per un ambiente e ne dà un solo esito: esce con 1 se un controllo automatico non passa o non si esegue. `plan` elenca le voci per fase senza leggere nulla; `check --mode live --phase prima|dopo|tutte` le rilegge. Il resoconto riporta nomi ed esiti, mai valori di segreti o dati degli utenti; gli script di area aggiungono il proprio resoconto rientrato.

| Fase | Controlli automatici |
|---|---|
| `prima`, prima di `Promuovi` | Worker sul dominio dell'ambiente; segreti dichiarati in `cloudflare.config.ts` e facoltativi di `credential-expiries.mjs`; D1 in UE; coda e coda dei falliti in UE a 14 giorni e bucket dei file in UE senza accesso pubblico con la regola a un giorno, come nell'[ingresso webhook](WEBHOOKS.md#webhook); widget Turnstile gestito sul solo dominio; [registro delle scadenze](OBSERVABILITY.md#incidenti) senza voci scadute, entro 45 giorni o senza data; ambiente GitHub della pubblicazione soltanto per il suo branch, con account, token e, in Production, interruttore; `stripe-account.mjs` |
| `dopo`, dopo il deploy | Consumer della coda con retry e coda dei falliti; robots, sitemap e pagine della sitemap nelle due lingue, indicizzabili soltanto in Production; Termini, Privacy, accesso e area riservata `noindex`; anteprima assente in Production; beacon delle [statistiche](OBSERVABILITY.md#statistiche-sito) sulle sole pagine pubbliche; versione del Worker nelle risposte; `zone-protection.mjs readback`, `log-archive.mjs readback`, che richiede il Worker con Logpush, `ebay-notifications.mjs`, `telegram-bot.mjs` con `TELEGRAM_BOT_TOKEN` e `TELEGRAM_OWNER_ID` nelle variabili del comando, `commercial.mjs preflight` |

Le prove a vista dell'owner della checklist sono state attestate al go-live e lo script non le ripete. Senza il profilo live della CLI di Stripe, l'account si rilegge con il connettore come nella [configurazione commerciale](#configurazione-commerciale) e la voce Stripe della fase `prima` si attesta con quel resoconto.

La fase `dopo` si ripete dopo un deploy in Production; sul test le due fasi si rileggono insieme. Lo script non crea risorse né imposta segreti: code, bucket, archivio dei log, segreti e webhook nascono con le procedure delle rispettive sezioni.

<a id="sorveglianza"></a>
## Sorveglianza

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

Si legge dopo ogni intervento in Production, senza una durata fissa. Una voce da guardare segue la procedura degli [incidenti](OBSERVABILITY.md#incidenti); gli esiti e le anomalie reali si riportano, senza un diario delle letture. La sorveglianza finisce quando una lettura non ha P1 o P2 aperte, `go-live.mjs check --mode live --phase dopo` è verde e le statistiche sono attive. Poi vale il normale esercizio: avvisi del bot, console e soglie della [capacità](CAPACITY.md#capacita), con lo script disponibile per una diagnosi.
