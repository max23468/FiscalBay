# Codex Senza GitHub Actions

Questa guida descrive il flusso operativo quando si usa Codex da web/mobile o da
locale senza consumare GitHub Actions.

## Stato attuale

GitHub Actions non è un canale operativo attivo per FiscalBay. L'automazione
vive negli script locali e negli script/timer della VPS.

Non sono versionati workflow in `.github/workflows/` e non vanno aggiunti o
riattivati senza richiesta esplicita del maintainer.

Motivo operativo:

- il budget Actions può essere esaurito o non disponibile
- i run falliti per billing/spending limit non sono risolvibili rilanciando job
- deploy, verifica, release e manutenzione devono restare riproducibili anche solo
  da Mac locale e VPS FiscalBay

## Flusso Da Codex Web O Mobile

1. prepara codice e documentazione nel repository
2. esegui o chiedi di eseguire verifiche locali quando il lavoro torna sul Mac
3. porta le modifiche su `main` solo dopo self-review
4. non avviare GitHub Actions
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

Per controllare workflow residui non devono esserci file versionati qui:

```bash
test ! -d .github/workflows || ! find .github/workflows -type f | grep .
```

Il risultato atteso è vuoto o la directory assente.

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

## Release Senza Actions

`scripts/release_now.sh` resta il riferimento per changelog/versione. Senza GitHub
Actions, la release viene lanciata esplicitamente dal Mac locale: calcola SemVer,
aggiorna changelog/versione, crea tag/GitHub Release e ridistribuisce `main`.

Non creare tag, GitHub Release, bump di versione o modifiche manuali a
`CHANGELOG.md` root fuori da `scripts/release_now.sh` o da una riparazione
esplicita del flusso.
