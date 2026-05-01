# GitHub Maintenance

Questa guida raccoglie le impostazioni GitHub che completano gli asset versionati
nel repository.

## Stato Actions

GitHub Actions è riattivato solo come CI leggera a basso consumo.

- il solo workflow versionato ammesso è `.github/workflows/ci.yml`
- il workflow parte su PR verso `main` e con `workflow_dispatch`
- non usare Actions per deploy, release, diagnostica VPS, merge o update
  dipendenze
- non aggiungere altri workflow senza richiesta esplicita del maintainer
- se GitHub mostra run falliti per billing, spending limit o budget esaurito,
  non rilanciare job: usare automazioni locali/VPS

## Cosa È Versionato Nel Repo

- PR template: `.github/PULL_REQUEST_TEMPLATE.md`
- Lightweight CI: `.github/workflows/ci.yml`
- Issue forms: `.github/ISSUE_TEMPLATE/*`
- Ownership: `.github/CODEOWNERS`
- Security policy: `SECURITY.md`

Non è versionato:

- altri workflow in `.github/workflows/*`
- `.github/dependabot.yml`

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

Non abilitare Dependabot version updates schedulati finché il budget Actions resta
limitato.

## CI A Basso Consumo

Il workflow `.github/workflows/ci.yml` replica il gate locale minimo:

- una sola versione Python: `3.10`
- `bash scripts/ci_verify.sh` come comando unico di verifica
- nessun trigger `push`
- nessun trigger schedulato
- niente build package automatica
- concurrency con cancellazione dei run precedenti sulla stessa PR/ref

## Release Fuori Da Actions

Il percorso standard operativo resta fuori da GitHub Actions:

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

1. verificare che `.github/workflows/` contenga solo `ci.yml`
2. verificare dipendenze manualmente quando serve
3. verificare alert Security e Dependabot
4. verificare consumi Actions e falsi negativi prima di rendere il check required
