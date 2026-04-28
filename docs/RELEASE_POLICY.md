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
- meccanismo preferito di release: `scripts/release_now.sh`, esplicito e senza
  GitHub Actions

La versione del pacchetto resta senza prefisso `v` in `pyproject.toml`.

## Regola operativa del repository

Per questo repository il flusso da considerare ufficiale e' uno solo:

- si puo' lavorare anche direttamente su `main`
- i commit su `main` devono essere Conventional Commit corretti
- `scripts/release_now.sh` decide bump versione, changelog, tag e GitHub Release
  quando il maintainer lancia una release esplicita
- il deploy quotidiano usa `scripts/deploy_now.sh` e non crea versione, changelog
  o tag
- `release-please` automatico e Release PR automatiche sono deprecati

Regola pratica per agenti e maintainer:

- se il cambiamento e' user-facing o operativo, il commit deve essere `feat:`, `fix:` o `perf:`
- se il cambiamento e' breaking, usare `!` oppure footer `BREAKING CHANGE:`
- non usare `refactor:` o `chore:` per cambi che in realta' meritano una release
- non modificare manualmente `pyproject.toml` o `CHANGELOG.md` root solo per
  forzare una release: usare `scripts/release_now.sh`
- `.release-please-manifest.json` resta legacy e non governa piu' il flusso
  normale

## Checklist agente prima del commit

Prima di creare un commit su `main`, l'agente deve verificare queste domande:

1. Il cambiamento e' osservabile per utente o operatore?
2. Se si', il commit message e' `feat:`, `fix:` o `perf:` invece di `refactor:` o `chore:`?
3. C'e' qualche breaking change che richiede `!` o `BREAKING CHANGE:`?
4. Sto modificando versione/changelog/tag fuori da `scripts/release_now.sh`? Se
   si', fermarmi: non e' il flusso standard.

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

Per restare allineati a GitHub e al calcolo SemVer locale:

- usare PR anche da branch personali
- preferire squash merge
- impostare il titolo di squash merge in formato Conventional Commit
- se una PR contiene piu' modifiche, il titolo deve riflettere l'impatto piu' alto
- il titolo PR o il commit su `main` va verificato manualmente rispetto al formato
  Conventional Commit richiesto
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

Con questa configurazione il commit che arriva su `main` resta uno solo, leggibile
e direttamente usabile da `scripts/release_now.sh`.

## Changelog

`CHANGELOG.md` in root e' il changelog ufficiale e viene aggiornato da
`scripts/release_now.sh`.

Principi:

- mostra solo cambi rilevanti per una release
- evita note manuali sparse in piu' file
- tiene allineati changelog, tag GitHub e versione pacchetto

Lo storico preesistente resta consultabile in `docs/CHANGELOG.md`, ma non e' piu' il file canonico per le nuove release.

## Flusso GitHub

Il flusso standard e' questo:

1. un commit Conventional Commit arriva su `main`
2. il deploy operativo puo' uscire subito con `scripts/deploy_now.sh`
3. quando serve una release versionata, il maintainer lancia
   `scripts/release_now.sh`
4. lo script aggiorna `CHANGELOG.md` e `pyproject.toml`, crea commit
   `chore: release vX.Y.Z`, tag `vX.Y.Z` e GitHub Release
5. lo script deploya `main` sulla VPS FiscalBay e attende lo smoke check
6. non ci sono workflow GitHub Actions versionati finche' il maintainer non decide
   di riattivarli

La creazione della GitHub Release usa `gh` se disponibile, altrimenti un token
GitHub esposto solo nell'ambiente locale come `GITHUB_TOKEN`, `GH_TOKEN` o
`FISCALBAY_GITHUB_TOKEN`.

I file `deploy/fiscalbay-release-please.service`,
`deploy/fiscalbay-release-please.timer`, `deploy/release-please-pr.sh` e
`deploy/github-release-pr.py` restano legacy/fallback. Il timer non va abilitato
nel flusso normale; `deploy/linux-setup.sh` lo disabilita a meno che
`INSTALL_RELEASE_PLEASE_LEGACY=true`.

In modalita' main-only:

- il commit su `main` sostituisce il merge della feature PR
- `scripts/release_now.sh` e' il punto in cui si materializzano versione e
  changelog
- `scripts/deploy_now.sh` chiude il ciclo operativo quando lo smoke check passa

## Baseline iniziale

La baseline attuale parte dalla versione `0.1.0`.

Per evitare di riversare automaticamente tutto lo storico precedente nel nuovo
changelog machine-managed, la baseline resta il commit gia' presente al momento
dell'adozione del changelog root.

In pratica:

- `docs/CHANGELOG.md` conserva lo storico precedente
- `CHANGELOG.md` in root parte come changelog ufficiale del nuovo flusso
- le prossime release gestite da `scripts/release_now.sh` includeranno solo i
  cambi successivi all'ultimo tag `v*`

## Quando passare a 1.0.0

Regola proposta per questo repository:

Passiamo a `1.0.0` quando sono vere tutte queste condizioni:

- onboarding OAuth e flusso bot sono considerati stabili sul percorso principale
- configurazione e env var principali sono documentate e non in forte movimento
- il formato di output CLI e i comandi Telegram core sono abbastanza stabili da non richiedere cambi frequenti incompatibili
- esiste un percorso operativo minimo di release e rollback gia' usato con successo

Fino a quel momento, restiamo serenamente su `0.x.y`.
