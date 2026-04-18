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

La versione del pacchetto resta senza prefisso `v` in `pyproject.toml`.

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

Esempi:

- `fix: corregge il salvataggio tenant durante l'oauth callback`
- `feat: aggiunge comando admin per audit utenti`
- `feat!: riorganizza le env var del server OAuth`

Se una PR contiene sia refactor sia bugfix, il titolo deve essere `fix: ...`, non `refactor: ...`.

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

1. una PR viene mergiata su `main`
2. `release-please` aggiorna o apre una Release PR
3. la Release PR aggiorna:
   - `CHANGELOG.md`
   - `pyproject.toml`
   - `.release-please-manifest.json`
4. quando la Release PR viene mergiata, GitHub crea tag e release
5. lo stesso workflow builda il progetto e allega i file alla GitHub Release
6. se serve ricostruire gli artefatti senza creare una nuova release, si usa `Release Assets` in modalita' manuale

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
