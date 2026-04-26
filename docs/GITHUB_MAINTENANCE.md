# GitHub Maintenance

Questa guida raccoglie le impostazioni GitHub che completano gli asset versionati nel repository.

## Cosa e' versionato nel repo

- CI: `.github/workflows/ci.yml`
- Release PR automation: `.github/workflows/release-please.yml`
- Release PR auto-merge: `.github/workflows/auto-merge-release-pr.yml`
- Manual release assets rebuild: `.github/workflows/release.yml`
- Dependabot: `.github/dependabot.yml`
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
- controllare dopo ogni push su `main` che `release-please` abbia aperto o aggiornato la Release PR attesa
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

Il percorso standard e':

1. mergi una PR su `main` con titolo Conventional Commit
2. `Release Please` apre o aggiorna una Release PR se il push tocca file rilevanti per runtime/package, oppure quando viene lanciato manualmente
3. `PR Title` gira automaticamente sulla Release PR
4. esegui manualmente `CI` sulla branch `release-please--*` quando vuoi autorizzare il merge automatico della Release PR
5. il workflow `Auto Merge Release PR` la mergia automaticamente solo dopo una `CI` riuscita e con `PR Title` verde
6. il merge della Release PR aggiorna versione e `CHANGELOG.md`
7. `Release Please` crea il tag `vX.Y.Z`, la relativa release GitHub e allega gli artefatti buildati

Nota operativa:

- l'auto-merge riguarda solo PR con branch `release-please--*` e titolo `chore(main): release ...`
- il gate richiede oggi `CI` manuale e `PR Title` verdi sulla Release PR
- per pubblicare tag e GitHub Release in modo affidabile, configura il secret repository `RELEASE_PLEASE_TOKEN`; con il solo `GITHUB_TOKEN` GitHub puo' rispondere con `Resource not accessible by integration`
- se in futuro vuoi reintrodurre un checkpoint manuale prima della pubblicazione, disabilita il workflow `Auto Merge Release PR`

Fallback ufficiale senza branch protection / senza PR obbligatorie:

1. pushi un commit Conventional Commit corretto su `main`
2. controlli che `Release Please` apra o aggiorni la Release PR quando il cambio e' rilevante; altrimenti lancialo manualmente
3. lanci manualmente `CI` sulla Release PR quando vuoi chiuderla
4. controlli che `CI` e `PR Title` sulla Release PR siano verdi
5. controlli che il workflow `Auto Merge Release PR` l'abbia chiusa correttamente
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
2. verificare PR Dependabot aperte da troppo tempo
3. verificare alert Security e Dependabot
4. verificare che i ruleset di `main` siano ancora coerenti con il flusso di lavoro reale
