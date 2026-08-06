# AGENTS.md

## Scopo e priorità

Queste sono le istruzioni operative condivise per chi lavora su FiscalBay.
Prevalgono, nell’ordine:

1. istruzioni della sessione;
2. eventuali `AGENTS.md` più vicini ai file toccati;
3. questo file;
4. documentazione canonica, codice, test e configurazione vicini.

Decidi autonomamente i dettagli di routine. Chiedi conferma solo per azioni
distruttive o difficili da annullare, deploy e release, oppure quando due letture
della richiesta produrrebbero lavori materialmente diversi.

## Contesto del prodotto

- FiscalBay è un tool Telegram-first con CLI, callback OAuth e worker di
  reconciliation che legge ordini eBay tramite API ufficiali.
- La parte web serve onboarding, callback e supporto operativo: non trasformarla
  in una dashboard o nel punto d’ingresso principale senza una decisione esplicita.
- Il dato fiscale supportato proviene da `buyer.taxIdentifier` e campi correlati,
  inclusi `taxpayerId` e `taxIdentifierType`. Non dedurre o inventare dati assenti
  dalla risposta eBay.
- FiscalBay non è un gestionale fiscale completo né un help desk umano.
- Brand, naming pubblico, tono e microcopy sono governati da
  `docs/BRAND_GUIDELINES.md`.

## Lavoro nel repository

- Prima di modificare, controlla `git status --short` e leggi codice, test e
  documenti pertinenti. Non sovrascrivere cambi non tuoi.
- Mantieni lo scope richiesto. Preferisci il codice più semplice coerente con i
  pattern esistenti; evita astrazioni, rinominazioni o refactor non necessari.
- Non inserire segreti, credenziali, dati personali o export fiscali reali in
  sorgenti, test, log o documentazione.
- Non committare `.DS_Store`, output runtime, file temporanei, build artifact,
  database, lock operativi, backup o export personali.
- Aggiorna README o `docs/*` quando cambiano comportamento, comandi, env var,
  flussi utente o procedure operative.
- Per API, limiti e policy variabili di eBay, Telegram o provider, verifica le
  fonti ufficiali correnti prima di fissare una decisione.

Per lavori non banali usa una branch `codex/<tema>` e una PR verso `main`. Usa un
worktree separato quando devi preservare un checkout con modifiche estranee.

## Verifica

Scegli la corsia proporzionata al rischio:

- docs o governance: review mirata e `git diff --check`;
- test-only o runtime piccolo: test mirati vicini;
- runtime condiviso, dati, OAuth/eBay, bot, deploy/config o release:
  `bash scripts/ci_verify.sh`, più build o smoke pertinenti;
- web/OAuth callback: aggiungi test server mirati e controllo browser o HTTP;
  esegui `deploy/smoke-check.sh` solo se il diff arriva alla VPS o cambia routing
  esposto.

`scripts/ci_verify.sh` include `ruff format --check`; se fallisce solo per stile,
esegui `ruff format src tests`. Per packaging o build aggiungi `python -m build`
quando pertinente. Non inventare risultati e dichiara i controlli non eseguiti
quando costituiscono un limite reale.

## GitHub e pubblicazione

- Usa commit atomici e Conventional Commit: `feat`, `fix` o `perf` per
  cambiamenti osservabili; `docs`, `test`, `chore`, `ci` o `refactor` solo
  quando non cambia il runtime. Usa `!` o `BREAKING CHANGE:` per cambi incompatibili.
- Il titolo PR deve essere Conventional Commit e descrivere l’impatto reale, non
  il nome della branch. Preferisci squash merge.
- “Pubblica” significa verifica, commit, push, PR/merge e pulizia di branch e
  worktree assorbiti. Deploy e release si aggiungono solo quando il diff o la
  richiesta li rendono applicabili.
- Il repository ha un solo maintainer: review esterne non sono un prerequisito,
  ma self-review e verifiche pertinenti sì.

Sono ammessi solo questi workflow:

- `.github/workflows/actionlint.yml`
- `.github/workflows/ci.yml`
- `.github/workflows/codex-review-gate.yml`
- `.github/workflows/dependabot-auto-merge.yml`
- `.github/workflows/dependency-review.yml`
- `.github/workflows/package-build.yml`
- `.github/workflows/pr-title.yml`

Non aggiungerne altri senza richiesta esplicita. L’allowlist eseguibile vive in
`scripts/check_github_workflows.sh`.

## Deploy e release

La sola VPS FiscalBay autorizzata è `opc@79.72.45.89`, hostname
`fiscalbay-bot`. Prima di qualsiasi comando remoto verifica entrambi:

```sh
ssh -tt -o BatchMode=yes -o ConnectTimeout=10 opc@79.72.45.89 'hostname'
```

Se host o hostname non coincidono, fermati. Non usare VPS di altri progetti.

- Deploy operativo manuale: `scripts/deploy_now.sh`.
- Auto-deploy: `fiscalbay-autodeploy.timer` rileva i nuovi SHA di `main` e usa
  `deploy/vps-deploy-ref.sh`, con smoke check e rollback.
- GitHub Actions non è un canale di deploy.
- Release versionata: `scripts/release_now.sh`; gestisce versione, changelog,
  tag, GitHub Release e deploy.
- Non modificare manualmente versione, `CHANGELOG.md`, tag o release nel flusso
  normale.
- Un cambio runtime `feat`, `fix` o `perf` richiesto in produzione richiede anche
  la release versionata prevista da `docs/RELEASE_POLICY.md`.

Deploy e release richiedono conferma esplicita. Per una pubblicazione docs-only
sono entrambi non applicabili.

## Documentazione canonica

- `docs/INDEX.md`: catalogo e destinazione corretta dei documenti.
- `docs/CONTEXT.md`: ingresso rapido al contesto operativo.
- `docs/ROADMAP.md` e `docs/BACKLOG.md`: direzione e lavoro futuro.
- `docs/RELEASE_POLICY.md`: versioning, merge, release e casi limite.
- `docs/OPERATIONS.md`, `docs/RUNBOOK.md` e `docs/DEPLOY_LINUX.md`: procedure VPS.
- `docs/TOOLCHAIN.md`: strumenti e gate.

Registra in roadmap solo decisioni che cambiano davvero direzione, priorità o
perimetro. Non duplicare documenti e non trasformare roadmap o `AGENTS.md` in
uno storico.

## Definizione di completamento

Il lavoro è chiuso quando risolve la richiesta senza espandere lo scope, preserva
i cambi estranei, supera verifiche proporzionate, aggiorna le fonti canoniche
necessarie e non lascia file temporanei. Riporta esito, rischi residui e prossimo
passo solo quando esiste; indica publish, deploy, release e cleanup quando
pertinenti.
