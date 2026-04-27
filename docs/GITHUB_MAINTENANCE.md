# GitHub Maintenance

Questa guida raccoglie le impostazioni GitHub che completano gli asset versionati nel repository.

## Cosa e' versionato nel repo

- CI: `.github/workflows/ci.yml`
- Release PR manuale: `.github/workflows/release-please.yml`
- Manual release assets rebuild: `.github/workflows/release.yml`
- Dependabot version updates: non configurato finche' il budget Actions resta limitato
- PR template: `.github/PULL_REQUEST_TEMPLATE.md`
- Issue forms: `.github/ISSUE_TEMPLATE/*`
- Ownership: `.github/CODEOWNERS`

## Cosa va configurato nella UI di GitHub

Alcune feature GitHub non sono affidabili se lasciate solo come convenzione, ma non sono versionabili direttamente nel repository.

### Ruleset o branch protection per `main`

Configurazione consigliata quando vuoi privilegiare sicurezza di merge rispetto al consumo Actions:

- richiedi le status check della CI prima del merge
- richiedi branch aggiornato prima del merge, se il rumore operativo resta accettabile
- abilita `Require linear history`
- disabilita force push e branch deletion su `main`
- valuta `Require pull request` anche in contesto solo-maintainer, se vuoi audit trail piu' pulito

Configurazione consigliata quando l'obiettivo primario e' ridurre i minuti Actions:

- non rendere `CI` una check obbligatoria automatica
- esegui manualmente il workflow `CI` prima dei merge/release che toccano runtime, storage, deploy o packaging
- mantieni `Require linear history`
- usa commit Conventional Commit corretti anche quando lavori direttamente su `main`

Check da marcare come obbligatori solo se riattivi un gate automatico:

- job `lint-and-test`
- job `package-build`
- job `conventional-pr-title`
- valuta anche il workflow `Release Please` come richiesto, se vuoi bloccare modifiche che rompano il processo di release

Se il piano GitHub o il tipo di repository non permette di usare ruleset o branch protection, il fallback operativo ufficiale per questo repository e':

- lavorare comunque su `main`, ma solo con commit Conventional Commit corretti
- trattare ogni commit su `main` come se fosse il titolo di una PR squash
- non fare bump manuali, tag manuali o release manuali nel flusso normale
- lanciare manualmente `release-please` quando vuoi aprire o aggiornare la Release PR attesa
- considerare un commit non conforme su `main` come incidente di processo da correggere subito nel commit successivo

In pratica, quando manca la branch protection, la disciplina del commit message diventa il controllo principale che tiene affidabile il versioning automatico.

### Merge options

Configurazione consigliata in `Settings > General`:

- abilita `Allow squash merging`
- usa titolo PR come base del messaggio di squash
- valuta di disabilitare `Allow merge commits`
- valuta di disabilitare `Allow rebase merging`

Questo repository usa `release-please`, quindi una cronologia `main` composta da commit squashed e semanticamente chiari rende versioni e changelog piu' affidabili.

Se non usi PR e lavori direttamente su `main`, applica la stessa regola al commit message:

- il messaggio del commit deve essere gia' nel formato che avresti usato come titolo di squash merge

### Security tab

Abilitare almeno:

- Dependabot alerts
- Dependabot security updates
- Secret scanning
- Push protection per secret scanning, se disponibile sul piano corrente

### Releases

Il flusso consigliato non parte piu' dal tag manuale come primo passo.

Il percorso standard, con budget GitHub Actions limitato, e':

1. mergi una PR su `main` con titolo Conventional Commit
2. lancia manualmente `Release Please` quando vuoi aprire o aggiornare una Release PR
3. valida manualmente titolo PR e test locali; usa `CI` GitHub solo se il budget lo consente e lo richiedi esplicitamente
4. mergia manualmente la Release PR quando hai completato le verifiche
6. il merge della Release PR aggiorna versione e `CHANGELOG.md`
7. `Release Please` crea il tag `vX.Y.Z` e la relativa release GitHub quando il workflow manuale viene usato

Nota operativa:

- per pubblicare tag e GitHub Release in modo affidabile, configura il secret repository `RELEASE_PLEASE_TOKEN`; con il solo `GITHUB_TOKEN` GitHub puo' rispondere con `Resource not accessible by integration`
- non riattivare trigger automatici senza una decisione esplicita sul budget Actions

Fallback ufficiale senza branch protection / senza PR obbligatorie:

1. pushi un commit Conventional Commit corretto su `main`
2. lanci manualmente `Release Please` quando vuoi materializzare changelog/versione
3. esegui in locale `bash scripts/ci_verify.sh`
4. mergi manualmente la Release PR se la usi
6. non tocchi manualmente `pyproject.toml`, `CHANGELOG.md` root, tag o release

Il workflow `Release Assets` supporta ancora `workflow_dispatch` se serve rigenerare gli artefatti per un tag gia' esistente.

### Actions settings

Verifica in `Settings > Actions > General`:

- `Allow GitHub Actions to create and approve pull requests`
- `Allow auto-merge`, se vuoi in futuro sostituire il merge diretto con `gh pr merge --auto`

Se in futuro vuoi che altri workflow si attivino anche sulle Release PR create automaticamente, valuta l'uso di un PAT dedicato invece del solo `GITHUB_TOKEN`.

## Revisione periodica consigliata

Frequenza minima mensile:

1. verificare workflow failed o flakey
2. verificare dipendenze manualmente quando serve
3. verificare alert Security e Dependabot
4. verificare che i ruleset di `main` siano ancora coerenti con il flusso di lavoro reale
