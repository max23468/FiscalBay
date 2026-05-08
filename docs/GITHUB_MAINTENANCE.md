# GitHub Maintenance

Questa guida raccoglie le impostazioni GitHub che completano gli asset versionati
nel repository.

## Stato Actions

GitHub Actions è riattivato solo per automazioni GitHub leggere e a basso consumo.

- i soli workflow versionati ammessi sono `.github/workflows/ci.yml`, più i
  controlli conservativi `.github/workflows/pr-title.yml`,
  `.github/workflows/dependency-review.yml`, `.github/workflows/actionlint.yml`,
  `.github/workflows/package-build.yml` e
  `.github/workflows/codex-pr-comments.yml`
- la CI parte su PR verso `main` e con `workflow_dispatch`
- il package build parte solo su PR che toccano packaging e con `workflow_dispatch`
- Dependency Review parte solo su PR che toccano file di dipendenze
- actionlint parte solo su PR che toccano workflow
- Codex PR comments aggiorna la issue `Codex feedback inbox` su eventi PR
  trusted, commenti issue, avvio manuale e riallineamento programmato ogni 6 ore;
  nei run parziali rilegge anche le PR già presenti nella inbox per non far
  sparire temporaneamente commenti storici o actionable non recenti
- non usare Actions per deploy, diagnostica VPS, merge o update
  dipendenze fuori da Dependabot
- non aggiungere altri workflow senza richiesta esplicita del maintainer
- se GitHub mostra run falliti per billing, spending limit o budget esaurito,
  non rilanciare job: usare automazioni locali/VPS

## Cosa È Versionato Nel Repo

- PR template: `.github/PULL_REQUEST_TEMPLATE.md`
- Lightweight CI: `.github/workflows/ci.yml`
- PR title check: `.github/workflows/pr-title.yml`
- Dependency Review: `.github/workflows/dependency-review.yml`
- Actionlint: `.github/workflows/actionlint.yml`
- Package build mirato: `.github/workflows/package-build.yml`
- Codex feedback inbox: `.github/workflows/codex-pr-comments.yml` e
  `.github/scripts/handle-codex-pr-comments.mjs`
- Dependabot version updates: `.github/dependabot.yml`
- Issue forms: `.github/ISSUE_TEMPLATE/*`
- Ownership: `.github/CODEOWNERS`
- Security policy: `SECURITY.md`

Non è versionato:

- altri workflow in `.github/workflows/*`
- `.github/dependabot.yaml`

## UI GitHub Consigliata

### Ruleset O Branch Protection Per `main`

Configurazione consigliata:

- abilita `Require linear history`
- disabilita force push e branch deletion su `main`
- valuta `Require pull request` anche in contesto solo-maintainer, se vuoi audit
  trail più pulito
- non rendere obbligatorio il check GitHub Actions finché non passa qualche PR
  senza falsi negativi

Fallback operativo:

- lavorare comunque con commit Conventional Commit corretti
- trattare ogni commit su `main` come se fosse il titolo di una PR squash
- usare `scripts/deploy_now.sh` come deploy operativo standard
- usare `scripts/release_now.sh` per release versionate esplicite
- eseguire localmente `bash scripts/ci_verify.sh` prima dei cambi runtime,
  storage, deploy o packaging quando serve un gate mirato
- non fare bump manuali, tag manuali o release manuali fuori da
  `scripts/release_now.sh` o da una riparazione esplicita

### Merge Options

Configurazione consigliata in `Settings > General`:

- abilita `Allow squash merging`
- usa titolo PR come base del messaggio di squash
- valuta di disabilitare `Allow merge commits`
- valuta di disabilitare `Allow rebase merging`

Se non usi PR e lavori direttamente su `main`, applica la stessa regola al commit
message: deve già essere nel formato Conventional Commit.

### Security Tab

Abilitare almeno:

- Dependabot alerts
- Dependabot security updates, se non attivano workflow non desiderati
- Secret scanning
- Push protection per secret scanning, se disponibile sul piano corrente

Dependabot version updates è abilitato con schedule settimanale, grouping e
limite basso di PR aperte per `pip` e `github-actions`.

## CI A Basso Consumo

I workflow a basso consumo sono:

- `.github/workflows/ci.yml`: una sola versione Python `3.10`, comando unico
  `bash scripts/ci_verify.sh`, nessun trigger `push`, nessun trigger schedulato
- `.github/workflows/pr-title.yml`: valida il titolo PR in formato Conventional
  Commit
- `.github/workflows/dependency-review.yml`: parte solo quando cambiano file di
  dipendenze e fallisce da severità `high`
- `.github/workflows/actionlint.yml`: parte solo quando cambiano workflow
- `.github/workflows/package-build.yml`: esegue `python -m build` su PR che
  toccano packaging e su avvio manuale
- `.github/workflows/codex-pr-comments.yml`: legge i review thread GitHub in
  contesto trusted, aggiorna la issue `Codex feedback inbox`, separa thread
  actionable e storico, e pubblica una richiesta Codex sulle PR con commenti
  ancora da gestire senza committare file di stato
- tutti i workflow usano concurrency con cancellazione dei run precedenti sulla
  stessa PR/ref quando applicabile

## Release

Release Please non è più un percorso attivo: il repository usa un solo flusso
versionato, locale e deploy-aware, tramite `scripts/release_now.sh`.

La scelta evita drift tra manifest GitHub-native, `pyproject.toml`, changelog e
tag. Se in futuro si vuole riattivare Release Please, va fatto come decisione
esplicita aggiornando workflow allowlist, documentazione, manifest e policy di
deploy.

## Release Locale Con Deploy

Il percorso operativo completo resta disponibile fuori da GitHub Actions:

1. commit Conventional Commit corretto su `main`
2. `scripts/deploy_now.sh` per deploy operativo senza nuova versione
3. `scripts/release_now.sh` quando serve una versione nuova
4. lo script calcola SemVer, aggiorna `CHANGELOG.md` e `pyproject.toml`
5. lo script crea commit `chore: release vX.Y.Z`, tag e GitHub Release
6. lo script ridistribuisce `main` sulla VPS e riesegue lo smoke check remoto

Non modificare manualmente `pyproject.toml`, `CHANGELOG.md` root, tag o release
fuori da `scripts/release_now.sh` o da una riparazione esplicita del flusso.

Per creare GitHub Release, usare `gh` locale oppure un token GitHub in
`GITHUB_TOKEN`, `GH_TOKEN` o `FISCALBAY_GITHUB_TOKEN`. Per il deploy remoto, la
VPS legge il token da `/etc/fiscalbay/deploy.env`. Non committare token o file env
reali.

## Revisione Periodica Consigliata

Frequenza minima mensile:

1. verificare che `.github/workflows/` contenga solo workflow allowlist
2. verificare che Dependabot non superi i limiti di PR aperte configurati
3. verificare alert Security e Dependabot
4. verificare consumi Actions e falsi negativi prima di rendere il check required
