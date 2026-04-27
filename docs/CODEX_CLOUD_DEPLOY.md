# Codex Senza GitHub Actions

Questa guida descrive il flusso operativo quando si usa Codex da web/mobile o da
locale senza consumare GitHub Actions.

## Stato attuale

GitHub Actions non e' un canale operativo attivo per FiscalBay.

Non sono versionati workflow in `.github/workflows/` e non vanno aggiunti o
riattivati senza richiesta esplicita del maintainer.

Motivo operativo:

- il budget Actions puo' essere esaurito o non disponibile
- i run falliti per billing/spending limit non sono risolvibili rilanciando job
- deploy, verifica, release e manutenzione devono restare riproducibili anche solo
  da Mac locale e VPS FiscalBay

## Flusso Da Codex Web O Mobile

1. prepara codice e documentazione nel repository
2. esegui o chiedi di eseguire verifiche locali quando il lavoro torna sul Mac
3. porta le modifiche su `main` solo dopo self-review
4. non avviare GitHub Actions
5. per deploy, usa solo il percorso manuale sulla VPS FiscalBay

## Verifiche Manuali

Gate locale preferito:

```bash
bash scripts/ci_verify.sh
```

Quando il cambio tocca packaging o release:

```bash
python -m build
```

Per controllare workflow residui non devono esserci file versionati qui:

```bash
test ! -d .github/workflows || ! find .github/workflows -type f | grep .
```

Il risultato atteso e' vuoto o la directory assente.

## Deploy Manuale

La VPS FiscalBay corretta e':

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

Dopo questa verifica, seguire `docs/RUNBOOK.md` e `docs/OPERATIONS.md`.

## Release Manuale

`release-please` resta il riferimento per changelog/versione, ma senza GitHub
Actions deve essere usato solo da ambiente locale o sostituito da una procedura
manuale esplicitamente richiesta.

Non creare tag, GitHub Release, bump di versione o modifiche manuali a
`CHANGELOG.md` root senza una richiesta esplicita di release.
