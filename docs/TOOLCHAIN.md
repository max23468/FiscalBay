# Toolchain FiscalBay

Questa pagina descrive runtime, comandi e guardrail effettivi di FiscalBay. Le
procedure operative restano in [OPERATIONS.md](./OPERATIONS.md),
[RUNBOOK.md](./RUNBOOK.md), [DEPLOY_LINUX.md](./DEPLOY_LINUX.md) e
[RELEASE_POLICY.md](./RELEASE_POLICY.md).

## Runtime

| Area | Versione/canale | Fonte |
| --- | --- | --- |
| Python manifest | `>=3.10` | `pyproject.toml` |
| Python typecheck/lint target | `3.10` | `pyproject.toml` |
| Python CI GitHub | `3.10` | `.github/workflows/ci.yml` |
| Python VPS operativo | `3.13` preferito, con compatibilità controllata | `docs/DEPLOY_LINUX.md`, `docs/CONTEXT.md` |
| Node.js | non applicabile al runtime | nessun `package.json` |
| Database | SQLite locale/VPS | `docs/DATA_MODEL.md`, `docs/OPERATIONS.md` |
| Runtime servizio | bot Telegram, OAuth callback e worker su VPS Linux con `systemd` | `docs/RUNBOOK.md` |

## Package manager e lockfile

- Python: `pip` dentro virtualenv.
- Lockfile Python: non presente; dipendenze e vincoli sono in `pyproject.toml`.
- JavaScript/TypeScript: non applicabile.
- Lockfile JS: non applicabile.

## Dipendenze applicative principali

- `cryptography`: cifratura token tenant e supporto operativo sicurezza.
- Librerie standard Python per CLI, bot polling, OAuth callback, SQLite e worker.
- API esterne ufficiali: eBay Sell Fulfillment, Trading API e Telegram Bot API.

## Tool di sviluppo

| Tool | Versione/canale | Uso |
| --- | --- | --- |
| `ruff` | `0.15.9` | format e lint |
| `mypy` | `>=1.18.2` | typecheck graduale |
| `coverage` | `>=7.10.7` | copertura test |
| `build` | `>=1.2.2` | package build |
| `gh` | CLI autenticata locale | PR, issue, release e controlli GitHub |
| `ssh` | client locale | deploy e diagnostica VPS FiscalBay |

## Tool runtime/VPS

| Tool | Uso |
| --- | --- |
| `systemd` | servizi bot, OAuth, backup, reconcile, alert, restore drill, healthcheck esterno e Duck DNS |
| Nginx | reverse proxy per OAuth callback e sito pubblico minimale |
| Duck DNS | dominio pubblico operativo quando configurato |
| SQLite | stato bot, tenant, audit, retry queue e dati operativi locali |

## Comandi

- install locale: `python3 -m pip install -e .[dev]`
- test completo: `python3 -m unittest discover -s tests -v`
- gate locale preferito: `bash scripts/ci_verify.sh`
- format: `ruff format src tests`
- build package: `python -m build`
- workflow allowlist: `scripts/check_github_workflows.sh`
- deploy operativo: `scripts/deploy_now.sh`
- deploy fallback locale/VPS: `scripts/local_deploy_vps.sh`
- release versionata: `scripts/release_now.sh`

## Release, deploy e GitHub

- La richiesta generica "pubblica" significa pubblicare il codice: commit,
  push, PR/merge naturale e cleanup branch.
- Deploy VPS e release versionata non sono impliciti per cambi documentali o per
  publish di codice che non richiede aggiornamento runtime immediato.
- GitHub Actions resta solo per controlli leggeri allowlist; non è canale
  operativo attivo per deploy o release.
- Non aggiornare manualmente `CHANGELOG.md`, tag GitHub o versione in
  `pyproject.toml` fuori da `scripts/release_now.sh`, salvo riparazioni
  esplicite del flusso.

## Eccezioni e guardrail

- Non usare sintassi o dipendenze incompatibili con Python `3.10` finché
  manifest, mypy, ruff e CI non vengono aggiornati insieme.
- La VPS può usare Python `3.13`, ma questa è compatibilità runtime operativa,
  non autorizzazione a rompere il supporto dichiarato `>=3.10`.
- Non dedurre dati fiscali assenti: mostrare solo campi realmente restituiti da
  eBay, in particolare `buyer.taxIdentifier`, `taxpayerId` e
  `taxIdentifierType`.
- Non aggiungere workflow GitHub Actions fuori allowlist senza richiesta
  esplicita.
- Non committare segreti, token, dump SQLite, backup, export personali o dati
  fiscali reali.
