# Toolchain FiscalBay

Questa pagina descrive runtime, comandi e guardrail effettivi di FiscalBay. Le
procedure operative restano in [OPERATIONS.md](./OPERATIONS.md),
[RUNBOOK.md](./RUNBOOK.md), [DEPLOY_LINUX.md](./DEPLOY_LINUX.md) e
[RELEASE_POLICY.md](./RELEASE_POLICY.md).

## Runtime

| Area | Versione/canale | Fonte |
| --- | --- | --- |
| Python manifest | `>=3.13` | `pyproject.toml` |
| Python typecheck/lint target | `3.13` | `pyproject.toml` |
| Python CI GitHub | `3.13` | `.github/workflows/ci.yml` |
| Python VPS operativo | `3.13` | `docs/DEPLOY_LINUX.md`, `docs/CONTEXT.md` |
| Node.js | non applicabile al runtime | nessun `package.json` |
| Database | SQLite locale/VPS | `docs/DATA_MODEL.md`, `docs/OPERATIONS.md` |
| Runtime servizio | bot Telegram, OAuth callback e worker su VPS Linux con `systemd` | `docs/RUNBOOK.md` |

## Package manager e lockfile

- Python: `pip` dentro virtualenv.
- Lockfile Python: `requirements.lock` (dipendenze runtime pinnate + hash),
  generato da `pyproject.toml` con `uv` (`make lock`). Il deploy VPS installa da
  qui con `pip install --require-hashes -r requirements.lock` più
  `pip install -e . --no-deps`, quindi la produzione è riproducibile. Dopo ogni
  modifica alle dipendenze runtime rigenera il lock con `make lock` e ricommittalo;
  `scripts/ci_verify.sh` verifica la sincronia con `pyproject.toml` quando `uv` è
  disponibile.
- JavaScript/TypeScript: non applicabile.
- Lockfile JS: non applicabile.

## Dipendenze applicative principali

- `cryptography`: cifratura token tenant e supporto operativo sicurezza.
- Librerie standard Python per CLI, bot polling, OAuth callback, SQLite e worker.
- API esterne ufficiali: eBay Sell Fulfillment, Trading API e Telegram Bot API.

## Tool di sviluppo

| Tool | Versione/canale | Uso |
| --- | --- | --- |
| `ruff` | `0.15.22` | format e lint |
| `mypy` | `>=2.3.0` | typecheck graduale |
| `coverage` | `>=7.15.2` | copertura test |
| `build` | `>=1.5.0` | package build |
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

- La richiesta generica "pubblica" significa pubblicare il codice tramite il flusso
  della repo: commit, push, PR/merge verso `main` quando previsto, verifica e cleanup
  esplicito di branch/worktree locali e branch remoti assorbiti.
- Deploy VPS e release versionata non sono impliciti per cambi documentali o per
  publish di codice che non richiede aggiornamento runtime immediato.
- GitHub Actions resta solo per controlli leggeri allowlist; non è canale
  operativo attivo per deploy o release.
- Non aggiornare manualmente `CHANGELOG.md`, tag GitHub o versione in
  `pyproject.toml` fuori da `scripts/release_now.sh`, salvo riparazioni
  esplicite del flusso.

## Eccezioni e guardrail

- Python `3.13` è la baseline unica per manifest, typecheck, lint, CI e VPS.
  Non abbassare il supporto o introdurre fallback a minor version precedenti
  senza decisione esplicita.
- Non dedurre dati fiscali assenti: mostrare solo campi realmente restituiti da
  eBay, in particolare `buyer.taxIdentifier`, `taxpayerId` e
  `taxIdentifierType`.
- Non aggiungere workflow GitHub Actions fuori allowlist senza richiesta
  esplicita.
- Non committare segreti, token, dump SQLite, backup, export personali o dati
  fiscali reali.
