# GitHub Maintenance

Questa guida raccoglie le impostazioni GitHub che completano gli asset versionati nel repository.

## Cosa e' versionato nel repo

- CI: `.github/workflows/ci.yml`
- CodeQL: `.github/workflows/codeql.yml`
- Release automation: `.github/workflows/release.yml`
- Dependabot: `.github/dependabot.yml`
- PR template: `.github/PULL_REQUEST_TEMPLATE.md`
- Issue forms: `.github/ISSUE_TEMPLATE/*`
- Ownership: `.github/CODEOWNERS`

## Cosa va configurato nella UI di GitHub

Alcune feature GitHub non sono affidabili se lasciate solo come convenzione, ma non sono versionabili direttamente nel repository.

### Ruleset o branch protection per `main`

Configurazione consigliata:

- richiedi le status check della CI prima del merge
- richiedi branch aggiornato prima del merge, se il rumore operativo resta accettabile
- abilita `Require linear history`
- disabilita force push e branch deletion su `main`
- valuta `Require pull request` anche in contesto solo-maintainer, se vuoi audit trail piu' pulito

Check da marcare come obbligatori:

- job `lint-and-test`
- job `package-build`
- workflow `CodeQL / Analyze Python`

### Security tab

Abilitare almeno:

- Dependabot alerts
- Dependabot security updates
- Secret scanning
- Push protection per secret scanning, se disponibile sul piano corrente

### Releases

Il workflow `Release` pubblica una GitHub Release quando fai push di un tag `v*`, ad esempio:

```bash
git tag v0.2.0
git push origin v0.2.0
```

Supporta anche `workflow_dispatch` per pubblicare un tag gia' esistente.

## Revisione periodica consigliata

Frequenza minima mensile:

1. verificare workflow failed o flakey
2. verificare PR Dependabot aperte da troppo tempo
3. verificare alert Security/Code scanning
4. verificare che i ruleset di `main` siano ancora coerenti con il flusso di lavoro reale
