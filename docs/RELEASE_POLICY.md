# Release e Versioning

Questa guida definisce il flusso ufficiale di versionamento, changelog e release del repository.

## Obiettivi

- changelog leggibile e allineato a GitHub
- versioni prevedibili e facili da spiegare
- release ripetibili senza aggiornamenti manuali sparsi
- regole semplici da seguire anche in contesto single-maintainer

## Convenzioni ufficiali

- versione pacchetto: `X.Y.Z`
- tag GitHub: `vX.Y.Z`
- changelog ufficiale: `CHANGELOG.md` in root
- archivio storico precedente: `docs/CHANGELOG.md`
- meccanismo ufficiale di release: `release-please`

La versione del pacchetto resta senza prefisso `v` in `pyproject.toml`.

## Regola operativa del repository

Per questo repository il flusso da considerare ufficiale e' uno solo:

- si puo' lavorare anche direttamente su `main`
- i commit su `main` devono essere Conventional Commit corretti
- `release-please` decide bump versione, changelog, tag e release
- bump manuali, tag manuali e release manuali sono eccezioni e non il percorso standard

Regola pratica per agenti e maintainer:

- se il cambiamento e' user-facing o operativo, il commit deve essere `feat:`, `fix:` o `perf:`
- se il cambiamento e' breaking, usare `!` oppure footer `BREAKING CHANGE:`
- non usare `refactor:` o `chore:` per cambi che in realta' meritano una release
- non modificare manualmente `pyproject.toml`, `.release-please-manifest.json` o `CHANGELOG.md` root solo per forzare una release, salvo riparazioni straordinarie richieste esplicitamente
- quando serve una release, il comportamento standard e' lasciare che `release-please` apra o aggiorni la Release PR e poi usare quel flusso

## Checklist agente prima del commit

Prima di creare un commit su `main`, l'agente deve verificare queste domande:

1. Il cambiamento e' osservabile per utente o operatore?
2. Se si', il commit message e' `feat:`, `fix:` o `perf:` invece di `refactor:` o `chore:`?
3. C'e' qualche breaking change che richiede `!` o `BREAKING CHANGE:`?
4. Sto per fare un bump/tag/release manuale non richiesto? Se si', fermarmi: non e' il flusso standard.

Se una di queste risposte non e' coerente, il commit va corretto prima del push.

## Regola di bump

Il repository usa Semantic Versioning.

### Patch

Incrementa `PATCH` per cambi compatibili che correggono un comportamento gia' esistente.

Esempi:

- bugfix CLI
- fix OAuth
- fix retry Telegram
- fix query/storage che cambia il comportamento runtime senza introdurre nuova feature

Commit consigliato:

```text
fix: corregge il retry Telegram sulle risposte 429
```

### Minor

Incrementa `MINOR` per nuove funzionalita' compatibili.

Esempi:

- nuovo comando Telegram
- nuovo flag CLI
- nuovo endpoint/flow compatibile
- nuova automazione operativa esposta come feature del prodotto

Commit consigliato:

```text
feat: aggiunge il comando /settings
```

### Major

Incrementa `MAJOR` per breaking change.

Si considera breaking change quando chi usa il progetto deve cambiare qualcosa per continuare a usarlo correttamente.

Esempi:

- rimozione o rinomina incompatibile di un comando CLI
- cambi incompatibili a env var richieste o formato config
- cambi incompatibili al comportamento documentato del bot
- cambi incompatibili a schema o interfacce operative senza migrazione trasparente

Commit consigliato:

```text
feat!: rinomina il comando di export CSV
```

Oppure:

```text
fix: cambia il formato del payload esportato

BREAKING CHANGE: il CSV usa intestazioni nuove non compatibili con la versione precedente
```

## Tipi commit e impatto release

I tipi da usare come default sono questi:

- `feat:` nuova funzionalita' compatibile -> `MINOR`
- `fix:` correzione compatibile -> `PATCH`
- `perf:` miglioramento prestazionale osservabile -> `PATCH`
- `feat!:` `fix!:` `refactor!:` oppure footer `BREAKING CHANGE:` -> `MAJOR`
- `docs:` sola documentazione -> nessun bump release automatico
- `test:` soli test -> nessun bump release automatico
- `chore:` manutenzione interna -> nessun bump release automatico
- `ci:` solo workflow/pipeline -> nessun bump release automatico
- `refactor:` refactor interno senza impatto funzionale -> nessun bump release automatico

Regola pratica: se il cambiamento modifica cio' che un utente o un operatore osserva nel runtime, usa `fix:` o `feat:`. Se il cambiamento e' solo interno, non deve forzare una release.

## Policy per PR e merge

Per restare allineati a GitHub e a `release-please`:

- usare PR anche da branch personali
- preferire squash merge
- impostare il titolo di squash merge in formato Conventional Commit
- se una PR contiene piu' modifiche, il titolo deve riflettere l'impatto piu' alto
- il controllo CI `PR Title` verifica automaticamente che il titolo PR sia compatibile con il formato richiesto
- questo repository e' privato e oggi ha un solo maintainer operativo
- quindi review/commenti esterni non sono un prerequisito normale per il merge
- il flusso standard e': self-review, test rilevanti verdi, PR pronta, merge

Esempi:

- `fix: corregge il salvataggio tenant durante l'oauth callback`
- `feat: aggiunge comando admin per audit utenti`
- `feat!: riorganizza le env var del server OAuth`

Se una PR contiene sia refactor sia bugfix, il titolo deve essere `fix: ...`, non `refactor: ...`.

Nota pratica:

- se si lavora solo su `main`, l'equivalente del titolo PR diventa il commit message stesso
- quindi i commit su `main` devono essere trattati con la stessa disciplina dei titoli PR

## Impostazioni GitHub consigliate

Per rendere effettivo il flusso anche lato UI GitHub:

- abilitare `Squash merge`
- usare come default il titolo PR come messaggio di squash
- valutare di disabilitare `Merge commit`
- valutare di disabilitare `Rebase merge`

Con questa configurazione il commit che arriva su `main` resta uno solo, leggibile e direttamente usabile da `release-please`.

## Changelog

`CHANGELOG.md` in root e' il changelog ufficiale e viene aggiornato automaticamente dalla Release PR.

Principi:

- mostra solo cambi rilevanti per una release
- evita note manuali sparse in piu' file
- tiene allineati changelog, tag GitHub e versione pacchetto

Lo storico preesistente resta consultabile in `docs/CHANGELOG.md`, ma non e' piu' il file canonico per le nuove release.

## Flusso GitHub

Il flusso standard e' questo:

1. un commit Conventional Commit arriva su `main`
2. `release-please` aggiorna o apre una Release PR
3. i workflow `CI` e `PR Title` validano la Release PR
4. il workflow `Auto Merge Release PR` la mergia automaticamente solo quando quei check risultano verdi
5. la Release PR aggiorna:
   - `CHANGELOG.md`
   - `pyproject.toml`
   - `.release-please-manifest.json`
6. quando la Release PR viene mergiata, GitHub crea tag e release
7. lo stesso workflow builda il progetto e allega i file alla GitHub Release
8. se serve ricostruire gli artefatti senza creare una nuova release, si usa `Release Assets` in modalita' manuale

Nota operativa:

- per creare la GitHub Release in modo affidabile, configura il secret repository `RELEASE_PLEASE_TOKEN`
- il workflow fa fallback su `GITHUB_TOKEN`, ma GitHub puo' rifiutare la pubblicazione con `Resource not accessible by integration`

In modalita' main-only:

- il commit su `main` sostituisce il merge della feature PR
- la Release PR di `release-please` resta comunque il punto ufficiale in cui si materializzano versione e changelog
- nel setup attuale il merge della Release PR e' automatizzato, ma solo dopo check verdi, quindi il rilascio resta a due fasi logiche con un gate minimo di sicurezza

## Baseline iniziale

La baseline attuale parte dalla versione `0.1.0`.

Per evitare di riversare automaticamente tutto lo storico precedente nel nuovo changelog machine-managed, `release-please` e' stato configurato con una bootstrap baseline sul commit gia' presente al momento dell'adozione.

In pratica:

- `docs/CHANGELOG.md` conserva lo storico precedente
- `CHANGELOG.md` in root parte come changelog ufficiale del nuovo flusso
- le prossime release automatiche includeranno solo i cambi successivi all'adozione

## Quando passare a 1.0.0

Regola proposta per questo repository:

Passiamo a `1.0.0` quando sono vere tutte queste condizioni:

- onboarding OAuth e flusso bot sono considerati stabili sul percorso principale
- configurazione e env var principali sono documentate e non in forte movimento
- il formato di output CLI e i comandi Telegram core sono abbastanza stabili da non richiedere cambi frequenti incompatibili
- esiste un percorso operativo minimo di release e rollback gia' usato con successo

Fino a quel momento, restiamo serenamente su `0.x.y`.
