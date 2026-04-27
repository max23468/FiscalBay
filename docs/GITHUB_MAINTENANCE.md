# GitHub Maintenance

Questa guida raccoglie le impostazioni GitHub che completano gli asset versionati
nel repository.

## Stato Actions

GitHub Actions e' disattivato come canale operativo.

- non sono versionati workflow in `.github/workflows/`
- non usare Actions per CI, deploy, release, PR check, diagnostica VPS o update
  dipendenze
- non aggiungere workflow senza richiesta esplicita del maintainer
- se GitHub mostra run falliti per billing, spending limit o budget esaurito,
  non rilanciare job: usare i percorsi locali/manuali

## Cosa E' Versionato Nel Repo

- PR template: `.github/PULL_REQUEST_TEMPLATE.md`
- Issue forms: `.github/ISSUE_TEMPLATE/*`
- Ownership: `.github/CODEOWNERS`
- Security policy: `SECURITY.md`

Non e' versionato:

- `.github/workflows/*`
- `.github/dependabot.yml`

## UI GitHub Consigliata

### Ruleset O Branch Protection Per `main`

Configurazione consigliata:

- abilita `Require linear history`
- disabilita force push e branch deletion su `main`
- valuta `Require pull request` anche in contesto solo-maintainer, se vuoi audit
  trail piu' pulito
- non rendere obbligatorie status check GitHub Actions

Fallback operativo:

- lavorare comunque con commit Conventional Commit corretti
- trattare ogni commit su `main` come se fosse il titolo di una PR squash
- eseguire localmente `bash scripts/ci_verify.sh` prima dei cambi runtime,
  storage, deploy o packaging
- non fare bump manuali, tag manuali o release manuali fuori da una richiesta
  esplicita di release

### Merge Options

Configurazione consigliata in `Settings > General`:

- abilita `Allow squash merging`
- usa titolo PR come base del messaggio di squash
- valuta di disabilitare `Allow merge commits`
- valuta di disabilitare `Allow rebase merging`

Se non usi PR e lavori direttamente su `main`, applica la stessa regola al commit
message: deve gia' essere nel formato Conventional Commit.

### Security Tab

Abilitare almeno:

- Dependabot alerts
- Dependabot security updates, se non attivano workflow non desiderati
- Secret scanning
- Push protection per secret scanning, se disponibile sul piano corrente

Non abilitare Dependabot version updates schedulati finche' il budget Actions resta
limitato.

## Release Manuali

Il percorso standard senza GitHub Actions e':

1. commit Conventional Commit corretto su `main`
2. verifiche locali, almeno `bash scripts/ci_verify.sh`
3. per packaging, anche `python -m build`
4. se serve una release, concordare esplicitamente procedura, changelog/versione,
   tag e GitHub Release
5. usare `release-please` solo da ambiente locale o sostituirlo con passaggi
   manuali esplicitamente richiesti

Non modificare manualmente `pyproject.toml`, `.release-please-manifest.json`,
`CHANGELOG.md` root, tag o release senza una richiesta esplicita di release o di
riparazione del flusso.

## Revisione Periodica Consigliata

Frequenza minima mensile:

1. verificare che `.github/workflows/` resti assente o vuota
2. verificare dipendenze manualmente quando serve
3. verificare alert Security e Dependabot
4. verificare che i ruleset di `main` siano ancora coerenti con il flusso manuale
