# AGENTS.md

## Scopo e priorità

Queste sono le istruzioni operative condivise per chi lavora su FiscalBay.
Prevalgono, nell’ordine:

1. istruzioni della sessione;
2. eventuali `AGENTS.md` più vicini ai file toccati;
3. questo file;
4. documentazione canonica, codice, test e configurazione vicini.

Le azioni distruttive o difficili da annullare e i deploy/release non già
autorizzati richiedono consenso esplicito.

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

Evita di creare un numero eccessivo di file di test. Crea un nuovo file di test
solo se richiesto dalle convenzioni della repository o se nessun file esistente
è una collocazione adatta. Evita pulizie non pertinenti e complessità non
necessaria. Riusa le utility esistenti adatte allo scopo. Leggi le istruzioni
pertinenti della repository ed esamina codice, test, documentazione e CI vicini
all'area interessata. Segui le convenzioni consolidate. L'obiettivo è ottenere
codice pulito e pronto per essere integrato.

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

Calibra la verifica sul rischio del diff e completa i gate applicabili. Riusa
i test esistenti; aggiungine solo per un comportamento o rischio concreto, non
per replicare modifiche banali. Dopo un esito verde ripeti o amplia i controlli
solo per nuove modifiche, errori o dubbi irrisolti. Verifica il diff effettivo,
senza trattare il messaggio di successo di uno strumento come prova sufficiente.

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

## Significato di `Pubblica`

Quando il proprietario, riferendosi alla repository o alla modifica corrente,
dice `Pubblica` o chiede in modo affermativo e inequivocabile di pubblicare,
autorizza l'intero ciclo tecnico applicabile. Domande, ipotesi, pianificazioni e
negazioni non costituiscono autorizzazione. L'agente non si ferma a stati
intermedi e completa tutti i passaggi applicabili: preparazione e verifiche,
branch e commit, versione e changelog quando richiesti, push, PR, soli gate
bloccanti, merge, tag e GitHub Release quando previsti, deploy o promozione
tecnica e verifica live. La sequenza concreta, in particolare tra versionamento,
merge, deploy e release, è quella definita dalla policy della repository.

La pulizia finale rimuove soltanto branch e worktree temporanei creati nel ciclo
corrente e già assorbiti; controlla stash e altri residui senza alterare elementi
preesistenti o estranei alla pubblicazione. Se un passaggio non è applicabile, lo
dichiara e prosegue con gli altri. La richiesta affermativa di pubblicazione
vale come autorizzazione a PR, merge, deploy tecnico e release previsti dal
ciclo, senza una seconda conferma. Non autorizza pubblicazione di temi Shopify
live, submission Shopify App Store, billing o nuove attivazioni produttive,
TestFlight o App Store, invii Aruba, email o scansioni reali, né aggiornamenti
Notion: queste azioni richiedono una richiesta esplicita separata. Una richiesta
riferita soltanto a una di queste azioni non avvia la pubblicazione della
repository. Non dichiarare `pubblicato` finché il ciclo applicabile e la
rilettura finale di PR, check, deploy, release e stato Git non sono completi.

## GitHub e pubblicazione

- Usa commit atomici e Conventional Commit: `feat`, `fix` o `perf` per
  cambiamenti osservabili; `docs`, `test`, `chore`, `ci` o `refactor` solo
  quando non cambia il runtime. Usa `!` o `BREAKING CHANGE:` per cambi incompatibili.
- Il titolo PR deve essere Conventional Commit e descrivere l’impatto reale, non
  il nome della branch. Preferisci squash merge.
- Il repository ha un solo maintainer: review esterne non sono un prerequisito,
  ma self-review e verifiche pertinenti sì.

Sono ammessi solo questi workflow:

- `.github/workflows/actionlint.yml`
- `.github/workflows/ci.yml`
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
- Una riparazione esplicitamente autorizzata di una release errata segue
  l'eccezione documentata in `docs/RELEASE_POLICY.md`, senza riscrivere `main`.
- Usa `!` o `BREAKING CHANGE:` solo quando cambia un contratto osservabile da
  utenti od operatori. La rimozione di API interne senza consumatori esterni è
  un `refactor:` e non deve causare un major.
- `v2.0.0` è riservata al milestone SaaS-first descritto in `docs/ROADMAP.md`:
  una release major richiede una decisione di prodotto esplicita e il comando
  `scripts/release_now.sh --version X.Y.Z --bump major`.
- Un cambio runtime `feat`, `fix` o `perf` richiesto in produzione richiede anche
  la release versionata prevista da `docs/RELEASE_POLICY.md`.

Fuori da una richiesta di pubblicazione, deploy e release richiedono conferma
esplicita. Per una pubblicazione docs-only sono entrambi non applicabili.

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

Scrivi in italiano semplice, con esito per primo e paragrafi brevi. Usa elenchi
solo quando aiutano; evita formule ricorrenti, gergo superfluo e aggiornamenti
che ripetono lo stesso stato. Riporta prove, limiti e prossima azione reale.

Completa l'esito richiesto: analisi, modifica locale o pubblicazione. Distingui
passaggi completati, non richiesti, non applicabili e bloccati; non dichiarare
completo ciò che resta bloccato o non verificato. Applica i requisiti di commit
previsti per l'implementazione e pulisci soltanto risorse proprie e assorbite,
preservando modifiche e worktree altrui.

Aggiorna soltanto le fonti canoniche necessarie, senza espandere lo scope.
Riporta publish, deploy, release e cleanup quando pertinenti.

## Autonomia

Interpreta le richieste operative come incarichi da completare, usando intento
e contesto della sessione. Risolvi autonomamente naming, formattazione, default
e dettagli ordinari con assunzioni ragionevoli. Prima di chiedere un chiarimento,
verifica le fonti disponibili; chiedi solo se resta una decisione che cambia
materialmente il risultato.

Prima di una conferma necessaria, completa il lavoro indipendente già autorizzato
e prepara un risultato concreto da valutare. Sospendi soltanto il passaggio che
dipende dalla decisione mancante. Non richiedere consensi già concessi per la
stessa azione e lo stesso perimetro, salvo un checkpoint esplicito del progetto.
Conserva i confini di pubblicazione, dati e operazioni esterne definiti qui;
un ordine esplicito di attesa o arresto interrompe il lavoro interessato.
Il tempo trascorso non costituisce una risposta o un'autorizzazione.

Integra correzioni e nuovi vincoli durante il lavoro; rispondi alle domande
laterali senza perdere l'obiettivo, salvo annullamento o cambio di scope esplicito.

## Skill e delega

Le istruzioni esplicite dell'utente prevalgono sulle linee guida delle Skill,
nel rispetto delle istruzioni di sistema e sviluppatore. Verifica pertinenza,
gerarchia e conflitti di AGENTS, override e Skill prima di dedurne un blocco;
non trasformare raccomandazioni generiche in nuovi gate.

Se una Skill causa una pausa, una richiesta di permesso o lavoro incompleto,
cita e collega il preciso `SKILL.md`, riporta l'istruzione rilevante e distingui
il requisito esplicito dalla tua interpretazione.

Quando la sessione e le regole del progetto consentono subagent, delega solo
filoni consistenti e indipendenti, con ownership disgiunta, risultato atteso e
verifiche espliciti. Il coordinatore integra; niente delega per microtask o
semplice ricontrollo. Scrivi messaggi leggibili anche tra agenti.

Esempio e fonti: [preparare un incarico](docs/TOOLCHAIN.md#preparare-un-incarico).
