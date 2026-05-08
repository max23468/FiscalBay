# AGENTS.md

## Scopo

Questo file definisce le linee guida operative per agenti, Codex e collaboratori che
lavorano su questo repository.

Obiettivo: mantenere modifiche coerenti, sicure, testate e facilmente revisionabili,
senza introdurre lavoro collaterale non richiesto.

## Priorità delle istruzioni

1. Istruzioni di sistema/developer ricevute nella sessione corrente.
2. Questo file `AGENTS.md`.
3. Documentazione progetto (`README.md`, `docs/*`).
4. Assunzioni dell'agente.

In caso di conflitto, seguire sempre il livello più alto.

## Contesto del progetto

- FiscalBay è un tool operativo con CLI, bot Telegram, callback OAuth e worker di
  reconciliation per leggere ordini eBay tramite API ufficiali.
- Il dato fiscale supportato arriva da `buyer.taxIdentifier` e dai relativi campi,
  come `taxpayerId` e `taxIdentifierType`. Non dedurre, ricostruire o inventare dati
  fiscali assenti dalla risposta eBay.
- Il prodotto resta `Telegram first`: la parte web serve soprattutto onboarding,
  callback e supporto operativo, non deve diventare il punto di ingresso principale
  senza una decisione esplicita.

## Principi generali

- Mantieni lo scope intenzionale e proporzionato alla richiesta: piccolo quando
  basta, ampio quando il task lo richiede.
- Prima di proporre architetture o refactor, leggi il codice, i test e i documenti
  pertinenti.
- I refactor sono utili quando rendono la modifica più chiara, sicura o
  mantenibile. Evita solo refactor scollegati dal task o troppo ampi per essere
  verificati nello stesso intervento.
- Preferisci chiarezza, leggibilita e coerenza con il codice esistente a soluzioni
  "furbe".
- Segui lo stile già presente nel file toccato.
- Evita rinominazioni massive non necessarie.
- Non inserire segreti, token, credenziali o dati personali nei sorgenti, nei test,
  nei log o nella documentazione.
- Non sovrascrivere cambi non tuoi: se il working tree contiene modifiche estranee
  al task, ignorale o lavora attorno a esse.

## Workflow operativo

1. Verifica rapidamente stato del repo e contesto rilevante (`git status`, file
   interessati, test vicini, documentazione collegata).
2. Implementa un cambiamento proporzionato: contenuto se basta, più esteso se la
   richiesta o la qualità del risultato lo richiedono.
3. Aggiorna README o `docs/*` quando cambiano comportamento, comandi, env var,
   deploy, policy operative o flussi utente.
4. Esegui i test/controlli rilevanti prima di finalizzare.
5. Riporta in modo esplicito cosa è stato verificato e cosa no solo quando
   aggiunge valore al riepilogo: test eseguiti o falliti, controlli non eseguiti,
   rischi residui o modifiche a codice/configurazione. Evita footer rituali sulle
   verifiche per risposte semplici o cambi puramente minori.

I file `.DS_Store` non fanno parte del repository: ignorali sempre e rimuovi quelli
creati localmente quando li incontri.

## Deploy

- La VPS operativa corretta per FiscalBay è solo `opc@79.72.45.89`
  (`fiscalbay-bot`). Non usare host o VPS di altri progetti per deploy,
  diagnostica, sync file, restart o lettura log di FiscalBay. Se host,
  hostname o contesto SSH non coincidono, fermati e chiedi conferma prima di
  qualunque comando remoto.
- Accesso locale corretto alla VPS: login interattivo con
  `ssh opc@79.72.45.89`; per comandi one-shot da Codex locale usare una TTY
  esplicita, ad esempio
  `ssh -tt -o BatchMode=yes -o ConnectTimeout=10 opc@79.72.45.89 'hostname'`,
  e verificare che risponda `fiscalbay-bot`.
- Il deploy operativo di default è automatizzato fuori da GitHub Actions tramite
  script locali/VPS e accesso SSH alla VPS FiscalBay.
- GitHub Actions non è un canale operativo attivo per deploy FiscalBay. Se una
  richiesta parla genericamente di "deploy", usa `scripts/deploy_now.sh`
  o chiedi conferma quando l'azione remota sarebbe rischiosa o ambigua.

## GitHub Actions e budget

- Il repository può contenere solo i workflow GitHub Actions allowlist
  `.github/workflows/actionlint.yml`, `.github/workflows/ci.yml`,
  `.github/workflows/codex-pr-comments.yml`,
  `.github/workflows/dependency-review.yml`, `.github/workflows/package-build.yml`,
  e `.github/workflows/pr-title.yml`.
  Non aggiungere altri workflow senza richiesta esplicita del maintainer.
- `.github/dependabot.yml` è ammesso solo con schedule conservativa e limite basso
  di PR aperte.
- Se GitHub segnala fallimenti Actions per billing, spending limit o budget
  esaurito, non rilanciare run e non tentare fix tramite Actions: esegui verifiche,
  release, merge, manutenzione e deploy in locale o via VPS FiscalBay.
- Configurazione public access, diagnostica VPS e deploy restano automatizzati da
  script locali/VPS fuori da GitHub Actions.
- Il check Actions non è obbligatorio su `main` nella fase iniziale: consideralo
  un segnale aggiuntivo, non un blocco operativo.
- Deploy operativo standard: `scripts/deploy_now.sh`; release versionata esplicita:
  `scripts/release_now.sh`.

## Testing e verifica

- Per modifiche runtime o condivise, usa come gate locale preferito
  `bash scripts/ci_verify.sh`; il comando verifica anche la formattazione con
  `ruff format --check`, quindi se fallisce per stile esegui prima
  `ruff format src tests`.
- Per modifiche a packaging, release o configurazione di build, aggiungi anche
  `python -m build` quando rilevante.
- Per cambi molto piccoli, esegui almeno i test mirati più vicini alla modifica.
- Per modifiche solo documentali, non serve inventare test applicativi: dichiara che
  la verifica è stata una review del documento.
- Non inventare risultati di test o comandi non eseguiti.
- Se un controllo non può essere eseguito per limiti di ambiente, tempo o permessi,
  dichiaralo esplicitamente.

## Commit e PR

- Quando crei commit, mantienili atomici e usa messaggi chiari.
- Usa Conventional Commit in modo coerente con l'impatto reale:
  - `feat: ...` per nuove funzionalità osservabili
  - `fix: ...` per correzioni osservabili
  - `perf: ...` per miglioramenti prestazionali osservabili
  - `docs: ...` per sola documentazione
  - `test: ...` per soli test
  - `chore: ...` per manutenzione interna senza impatto runtime
  - `refactor: ...` solo per ristrutturazioni senza cambi funzionali
- Se una PR contiene sia refactor sia bugfix o feature, il titolo/commit deve
  riflettere l'impatto più alto, ad esempio `fix:` o `feat:`.
- Se lavori direttamente su `main`, tratta il commit message come l'equivalente del
  titolo di squash merge della PR.
- Nella PR includi sintesi cambi, impatto, test eseguiti, note operative e
  limitazioni note.
- Quando il maintainer chiede di "pubblicare", "pubblica le modifiche", "manda su"
  o usa formule equivalenti senza nominare deploy o release, interpreta la richiesta
  come pubblicazione del codice: verifiche locali rilevanti, commit Conventional
  coerente, push del branch, PR pronta o merge quando naturale. Se la PR è pronta,
  i controlli rilevanti sono verdi e non ci sono blocchi o ambiguità, non lasciare
  il lavoro a metà: fai merge, chiudi la PR e cancella il branch remoto/locale
  quando non serve più. Non eseguire deploy
  su VPS o release versionata solo per effetto della parola "pubblica" se ritieni
  che non siano necessari; in quel caso dichiara esplicitamente che li hai saltati.
- Esegui deploy su VPS solo quando il maintainer lo chiede esplicitamente, quando
  usa formule come "pubblica e deploy", "deploya" o "rilascia", oppure quando il
  deploy è davvero necessario per rendere effettiva la modifica richiesta nel
  runtime operativo. Anche per richieste ampie come "chiudi la fase", non fare
  passaggi aggiuntivi come deploy o release se ritieni che non siano necessari.
  In caso di dubbio tra solo push e deploy, fermati e chiedi conferma prima di
  toccare la VPS.
- Se nello stesso turno sono stati introdotti cambi funzionali, osservabili o
  operativi che richiedono un commit `feat:`, `fix:` o `perf:`, e il maintainer
  chiede anche deploy, release, "pubblica e deploy", "rilascia" o formule
  equivalenti che richiedono davvero la messa in produzione, la chiusura operativa
  deve includere anche la release versionata con `scripts/release_now.sh`, non
  solo `scripts/deploy_now.sh`.
  La sola richiesta "pubblica" non basta a forzare release o deploy quando non
  servono. Usa solo il deploy operativo senza release quando l'utente lo chiede
  esplicitamente, quando il cambio non produce bump release, o quando esiste un
  blocco tecnico/rischio da dichiarare prima di procedere.
- Questo repository è privato e gestito da un solo maintainer: review/commenti
  esterni non sono un passaggio atteso per chiudere il lavoro.
- Quando nel giro operativo ordinario ti occupi di controllare i commenti del bot,
  verifica in generale tutti i commenti rimasti in sospeso su tutte le PR,
  incluse PR aperte, chiuse o già mergiate, precedenti o diverse da quella su cui
  stai lavorando in quel momento, e poi gestiscili o riportali in modo esplicito.
  Lo storico operativo dei commenti Codex va controllato dalla issue GitHub
  `Codex feedback inbox`, aggiornata dal workflow `Codex PR comments`, non da
  file di stato committati nel repository.
- Quando la PR è pronta, i test rilevanti sono verdi e la self-review è stata
  completata, commit, push e merge possono essere il modo migliore per chiudere
  davvero il lavoro. Procedi quando sono il passo naturale del flusso richiesto o
  del contesto operativo; chiedi conferma solo se l'operazione è ambigua,
  rischiosa, distruttiva o fuori scala rispetto alla richiesta.

## Release e versioning

- Questo repository usa `scripts/release_now.sh` come riferimento preferito di
  versionamento, changelog, tag e release, fuori da GitHub Actions.
- Prima di creare un commit, valuta sempre l'impatto release.
- Per cambi funzionali o osservabili nel runtime, scegli sempre `feat:`, `fix:` o
  `perf:` coerente con l'impatto reale. Non usare `refactor:`, `chore:` o `docs:`
  se il comportamento utente/operatore cambia davvero.
- Per breaking change, usa `!` nel tipo commit o un footer `BREAKING CHANGE:`.
- Non eseguire bump manuali di versione in `pyproject.toml`.
- Nel flusso normale non aggiornare manualmente `CHANGELOG.md` root, tag Git o
  release GitHub fuori da `scripts/release_now.sh`, salvo riparazioni esplicite.
- Se l'utente chiede una release, il percorso standard è eseguire
  `scripts/release_now.sh` dopo le verifiche locali rilevanti.
- Se un agente ha già eseguito `scripts/deploy_now.sh` per un cambio `feat:`,
  `fix:` o `perf:` dentro un flusso richiesto come "pubblica e deploy" o
  "chiudi la fase", deve verificare subito se manca la release versionata; se
  manca e non ci sono blocchi, deve eseguire `scripts/release_now.sh` prima di
  considerare il lavoro concluso.
- Se in un turno sono stati fatti cambi funzionali ma manca un Conventional Commit
  adeguato, non considerare il lavoro chiuso finché il commit non è coerente con
  il flusso di release esplicita.
- Se il flusso release sembra rotto, fermati e spiega il motivo prima di
  introdurre workaround che bypassano `scripts/release_now.sh`.

Per dettagli e casi limite, seguire `docs/RELEASE_POLICY.md`.

## Documentazione e roadmap

- Aggiorna documentazione e commenti quando il comportamento cambia.
- Se aggiungi o cambi configurazioni/env var, documentale in `README.md` o `docs/`.
- Quando aggiorni `docs/ROADMAP.md`, gli item completati vanno rimossi dalla
  roadmap: non vanno lasciati come checkbox spuntate.
- `docs/CHANGELOG.md` è storico; il changelog di release corrente è `CHANGELOG.md`
  root ed è gestito da `scripts/release_now.sh`.

## Policy per agenti

- Se un'informazione è incerta, dichiara assunzioni e limiti.
- Se una richiesta è ambigua su scope, comportamento atteso, rischio o tradeoff,
  chiedi chiarimento prima di procedere. Procedi con un'assunzione dichiarata solo
  per dettagli marginali che non cambiano il risultato sostanziale.
- Mantieni `AGENTS.md` come fonte unica per le regole operative degli agenti:
  non introdurre file o sezioni separate di "agent coordination" salvo lavori
  paralleli reali con ownership distinte da coordinare esplicitamente.
- Non trattare l'assenza di review esterne come blocco, ma non saltare self-review,
  test rilevanti e controllo dell'impatto release.
- Mantieni output e riepiloghi finali concreti: cosa è cambiato, dove, eventuali
  rischi residui e, quando utile, come è stato verificato.

## Sotto-moduli

Per regole specifiche di sotto-moduli, aggiungere `AGENTS.md` nelle relative
sottocartelle.

Le istruzioni più profonde prevalgono sui livelli superiori.
