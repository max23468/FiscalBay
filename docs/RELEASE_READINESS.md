# Readiness 1.0.0

Questo documento fissa il perimetro stabile di FiscalBay `1.0.0`.

La `1.0.0` non dichiara un'apertura pubblica indiscriminata o un servizio
multiutente a larga scala. Dichiara stabile il modello operativo corrente:

- bot Telegram pubblico con accesso approvato
- singolo admin globale
- onboarding eBay OAuth su VPS FiscalBay
- servizio `Telegram first`
- storage SQLite locale entro soglie dichiarate
- token tenant cifrati a riposo
- audit, retention, alert e recovery minimi già operativi
- release e deploy gestiti da script locali/VPS, fuori da GitHub Actions

## Criteri soddisfatti

Per promuovere FiscalBay a `1.0.0` devono essere vere queste condizioni.

### Percorso utente principale

- `/start`, `/help`, `/request_access`, approvazione admin e gating accessi sono
  il percorso di ingresso supportato.
- `/account collega`, callback OAuth, salvataggio token tenant e reconnect sono il
  percorso di collegamento supportato.
- `/account`, `/settings`, `/settings notifiche`, consultazione ordini e notifiche
  automatiche sono il percorso operativo core.
- Gli errori OAuth vengono esposti con messaggi guidati e audit minimo; lo stato
  `error` resta un failure mode tecnico, non un nuovo stato UX primario.

### Percorso admin principale

- `/admin` e `/admin manutenzione` sono il pannello operativo Telegram stabile.
- `/admin_users all|pending|unlinked|reconnect|inactive`, `/tenant_health`,
  `/admin dormant [ore]`, `/admin export`, `/admin delete_tenant ... confirm` e
  `/service_mode normal|maintenance|degraded` sono il set admin minimo stabile.
- I tenant inattivi sono solo segnalati per review: nessun cleanup automatico
  distruttivo parte senza comando admin esplicito.
- Gli alert prodotto restano non persistenti come dashboard/sintesi admin e
  healthcheck, mentre audit e metriche runtime restano persistiti dove già
  previsto.

### Operatività

- `scripts/ci_verify.sh` è il gate locale preferito.
- `scripts/release_now.sh` è il percorso ufficiale per versione, changelog, tag,
  GitHub Release e deploy VPS.
- `scripts/deploy_now.sh` resta il percorso per deploy operativo senza nuova
  versione.
- La VPS corretta resta solo `opc@79.72.45.89` con hostname atteso
  `fiscalbay-bot`.
- Deploy, rollback, backup, restore drill, alert check e reconciliation sono
  documentati in `docs/RUNBOOK.md` e `docs/OPERATIONS.md`.

### Sicurezza e dati

- I dati fiscali non vengono dedotti o ricostruiti: FiscalBay mostra solo quanto
  eBay espone tramite API ufficiali.
- I refresh token tenant sono cifrati a riposo con `EBAY_TENANT_TOKEN_KEY` nel
  percorso operativo normale.
- Il fallback plaintext è solo opt-in per sviluppo o recovery controllato.
- Audit log, sessioni OAuth, operation queue e retention sono gestiti dalla
  reconciliation periodica.
- SQLite è accettato per `1.0.0` solo dentro il profilo
  `approved_public_small`.

## Limiti dichiarati della 1.0.0

Questi punti non bloccano `1.0.0`, ma restano vincoli espliciti del servizio:

- nessuno SLA formale
- un solo admin globale
- un solo account eBay attivo per utente e per environment
- accesso approvato manualmente, non apertura libera
- cancellazione utente amministrativa assistita, avviabile dall'utente con
  `/settings dati cancellazione`
- nessuna dashboard web operativa oltre onboarding/callback/supporto
- SQLite ammesso solo a bassa scala e con backup/restore mantenuti

## Fuori perimetro 1.0.0

Questi cambi richiedono una fase successiva e non fanno parte del contratto
stabile iniziale:

- apertura pubblica multiutente senza approvazione
- ruoli admin multipli o team
- Postgres o database gestito come requisito immediato
- secret manager dedicato obbligatorio
- cancellazione self-service completa da Telegram senza conferma admin
- revoca remota eBay garantita come parte del disconnect locale
- SLA, alta disponibilità o multiworker distribuiti

## Soglie di revisione

Il servizio deve uscire dal profilo `approved_public_small` e rivalutare storage,
segreti, osservabilità e processo operativo quando si verifica almeno uno di
questi eventi:

- superamento delle soglie `FISCALBAY_PUBLIC_*`
- `sqlite_migration_recommended` nell'healthcheck
- `migration_required` in `fiscalbay-scale-check` o `/admin scala`
- traffico bursty o uso giornaliero intenso
- richiesta di apertura pubblica libera
- necessità di SLA o affidabilità superiore al best effort
- bisogno di più admin, più processi bot o concorrenza database sostenuta

## Stato

La readiness `1.0.0` è considerata completata quando:

- questo documento è allineato con `docs/SERVICE_GOVERNANCE.md`,
  `docs/SECURITY.md`, `docs/OPERATIONS.md` e `docs/RELEASE_POLICY.md`
- `docs/DECISIONS_PENDING.md` non contiene decisioni bloccanti per `1.0.0`
- i controlli locali rilevanti passano
- `scripts/release_now.sh --version 1.0.0 --bump major` completa release e deploy
  senza bypassare il flusso standard
