# Codex Senza Deploy Via GitHub Actions

Questa guida descrive il flusso operativo quando si usa Codex da web/mobile o da
locale mantenendo deploy e release fuori da GitHub Actions.

## Stato attuale

GitHub Actions è attivo solo per controlli GitHub conservativi e Dependabot.
L'automazione operativa vive negli script locali e negli script/timer della VPS.

I workflow versionati ammessi sono solo quelli dichiarati in
`scripts/check_github_workflows.sh`. Non aggiungere o riattivare altri workflow
senza richiesta esplicita del maintainer.

Motivo operativo:

- la disponibilità di GitHub Actions può essere limitata o temporaneamente
  non disponibile
- i run falliti non sono sempre risolvibili rilanciando job; in quei casi
  applicare le verifiche locali di fallback e riprogrammare
- deploy, verifica, release e manutenzione devono restare riproducibili anche solo
  da Mac locale e VPS FiscalBay

## Flusso Da Codex Web O Mobile

1. prepara codice e documentazione nel repository
2. esegui o chiedi di eseguire verifiche locali quando il lavoro torna sul Mac
3. porta le modifiche su `main` solo dopo self-review
4. usa Actions solo per controlli GitHub conservativi, non per
   operazioni VPS
5. quando il lavoro torna sul Mac locale, usa `scripts/deploy_now.sh` o
   `scripts/release_now.sh`

## Verifiche Manuali

Gate locale preferito:

```bash
bash scripts/ci_verify.sh
```

Deploy operativo:

```bash
scripts/deploy_now.sh
```

Quando il cambio tocca packaging o release:

```bash
python -m build
```

Per controllare workflow residui devono esserci solo i workflow allowlist:

```bash
scripts/check_github_workflows.sh
```

Il risultato atteso è exit code `0`.

## Deploy Manuale

La VPS FiscalBay corretta è:

```bash
ssh opc@79.72.45.89
```

Da Codex locale, per comandi one-shot usare:

```bash
ssh -tt -o BatchMode=yes -o ConnectTimeout=10 opc@79.72.45.89 'hostname'
```

Output atteso:

```text
fiscalbay-bot
```

Deploy automatizzato da Mac locale:

```bash
scripts/deploy_now.sh
```

Release versionata:

```bash
scripts/release_now.sh
```

Dopo questa verifica, seguire `docs/RUNBOOK.md` e `docs/OPERATIONS.md` per
diagnostica o rollback.

## Release Fuori Da Actions

`scripts/release_now.sh` resta il riferimento per changelog/versione. La release
viene lanciata esplicitamente dal Mac locale: calcola SemVer, aggiorna
changelog/versione, crea tag/GitHub Release e ridistribuisce `main`.

Non creare tag, GitHub Release, bump di versione o modifiche manuali a
`CHANGELOG.md` root fuori da `scripts/release_now.sh` o da una riparazione
esplicita del flusso.
