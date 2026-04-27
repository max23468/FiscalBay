# AGENTS.md

## Scopo

Questo file definisce le linee guida operative per agenti, Codex e collaboratori che
lavorano su questo repository.

Obiettivo: mantenere modifiche coerenti, sicure, testate e facilmente revisionabili,
senza introdurre lavoro collaterale non richiesto.

## Priorita delle istruzioni

1. Istruzioni di sistema/developer ricevute nella sessione corrente.
2. Questo file `AGENTS.md`.
3. Documentazione progetto (`README.md`, `docs/*`).
4. Assunzioni dell'agente.

In caso di conflitto, seguire sempre il livello piu alto.

## Contesto del progetto

- FiscalBay e' un tool operativo con CLI, bot Telegram, callback OAuth e worker di
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
- I refactor sono utili quando rendono la modifica piu chiara, sicura o
  mantenibile. Evita solo refactor scollegati dal task o troppo ampi per essere
  verificati nello stesso intervento.
- Preferisci chiarezza, leggibilita e coerenza con il codice esistente a soluzioni
  "furbe".
- Segui lo stile gia presente nel file toccato.
- Evita rinominazioni massive non necessarie.
- Non inserire segreti, token, credenziali o dati personali nei sorgenti, nei test,
  nei log o nella documentazione.
- Non sovrascrivere cambi non tuoi: se il working tree contiene modifiche estranee
  al task, ignorale o lavora attorno a esse.

## Workflow operativo

1. Verifica rapidamente stato del repo e contesto rilevante (`git status`, file
   interessati, test vicini, documentazione collegata).
2. Implementa un cambiamento proporzionato: contenuto se basta, piu esteso se la
   richiesta o la qualita del risultato lo richiedono.
3. Aggiorna README o `docs/*` quando cambiano comportamento, comandi, env var,
   deploy, policy operative o flussi utente.
4. Esegui i test/controlli rilevanti prima di finalizzare.
5. Riporta in modo esplicito cosa e' stato verificato e cosa no solo quando
   aggiunge valore al riepilogo: test eseguiti o falliti, controlli non eseguiti,
   rischi residui o modifiche a codice/configurazione. Evita footer rituali sulle
   verifiche per risposte semplici o cambi puramente minori.

I file `.DS_Store` non fanno parte del repository: ignorali sempre e rimuovi quelli
creati localmente quando li incontri.

## Deploy

- La VPS operativa corretta per FiscalBay e' solo `opc@79.72.45.89`
  (`fiscalbay-bot`). Non usare host o VPS di altri progetti, in particolare
  DocMolder, per deploy, diagnostica, sync file, restart o lettura log di
  FiscalBay. Se host, hostname o contesto SSH non coincidono, fermati e chiedi
  conferma prima di qualunque comando remoto.
- Accesso locale corretto alla VPS: login interattivo con
  `ssh opc@79.72.45.89`; per comandi one-shot da Codex locale usare una TTY
  esplicita, ad esempio
  `ssh -tt -o BatchMode=yes -o ConnectTimeout=10 opc@79.72.45.89 'hostname'`,
  e verificare che risponda `fiscalbay-bot`.
- Il deploy operativo di default e' manuale sulla VPS con accesso SSH e script
  versionati (`deploy/update.sh`, `deploy/smoke-check.sh` e runbook collegati).
- Non avviare deploy tramite GitHub Actions come conseguenza implicita di commit,
  push, merge o release.
- Usa il workflow GitHub Actions `Deploy VPS` solo quando l'utente chiede
  esplicitamente di fare il deploy con GitHub Actions.
- Se la richiesta parla genericamente di "deploy" senza nominare GitHub Actions,
  applica il percorso manuale o chiedi conferma quando l'azione remota sarebbe
  rischiosa o ambigua.

## GitHub Actions e budget

- Le attivita' GitHub Actions devono restare manuali: niente workflow automatici
  su `push`, `pull_request`, `pull_request_target`, `workflow_run` o schedule finche'
  il maintainer non decide esplicitamente di riattivarli.
- Se i workflow GitHub risultano falliti per billing, spending limit o budget
  esaurito, non tentare di "riparare" rilanciando Actions: esegui verifiche,
  release, merge e manutenzione in locale o via VPS FiscalBay.
- `release-please` resta il riferimento per versioning e changelog, ma va lanciato
  manualmente o sostituito da un passaggio manuale esplicitamente richiesto quando
  GitHub Actions non e' disponibile.

## Testing e verifica

- Per modifiche runtime o condivise, usa come gate locale preferito
  `bash scripts/ci_verify.sh`; il comando verifica anche la formattazione con
  `ruff format --check`, quindi se fallisce per stile esegui prima
  `ruff format src tests`.
- Per modifiche a packaging, release o configurazione di build, aggiungi anche
  `python -m build` quando rilevante.
- Per cambi molto piccoli, esegui almeno i test mirati piu vicini alla modifica.
- Per modifiche solo documentali, non serve inventare test applicativi: dichiara che
  la verifica e' stata una review del documento.
- Non inventare risultati di test o comandi non eseguiti.
- Se un controllo non puo essere eseguito per limiti di ambiente, tempo o permessi,
  dichiaralo esplicitamente.

## Commit e PR

- Quando crei commit, mantienili atomici e usa messaggi chiari.
- Usa Conventional Commit in modo coerente con l'impatto reale:
  - `feat: ...` per nuove funzionalita osservabili
  - `fix: ...` per correzioni osservabili
  - `perf: ...` per miglioramenti prestazionali osservabili
  - `docs: ...` per sola documentazione
  - `test: ...` per soli test
  - `chore: ...` per manutenzione interna senza impatto runtime
  - `refactor: ...` solo per ristrutturazioni senza cambi funzionali
- Se una PR contiene sia refactor sia bugfix o feature, il titolo/commit deve
  riflettere l'impatto piu alto, ad esempio `fix:` o `feat:`.
- Se lavori direttamente su `main`, tratta il commit message come l'equivalente del
  titolo di squash merge della PR.
- Nella PR includi sintesi cambi, impatto, test eseguiti, note operative e
  limitazioni note.
- Questo repository e' privato e gestito da un solo maintainer: review/commenti
  esterni non sono un passaggio atteso per chiudere il lavoro.
- Quando la PR e' pronta, i test rilevanti sono verdi e la self-review e' stata
  completata, commit, push e merge possono essere il modo migliore per chiudere
  davvero il lavoro. Procedi quando sono il passo naturale del flusso richiesto o
  del contesto operativo; chiedi conferma solo se l'operazione e' ambigua,
  rischiosa, distruttiva o fuori scala rispetto alla richiesta.

## Release e versioning

- Questo repository usa `release-please` come meccanismo ufficiale di versionamento,
  changelog, tag e release.
- Prima di creare un commit, valuta sempre l'impatto release.
- Per cambi funzionali o osservabili nel runtime, scegli sempre `feat:`, `fix:` o
  `perf:` coerente con l'impatto reale. Non usare `refactor:`, `chore:` o `docs:`
  se il comportamento utente/operatore cambia davvero.
- Per breaking change, usa `!` nel tipo commit o un footer `BREAKING CHANGE:`.
- Non eseguire bump manuali di versione in `pyproject.toml`.
- Nel flusso normale non aggiornare manualmente `CHANGELOG.md` root,
  `.release-please-manifest.json`, tag Git o release GitHub: sono artefatti
  controllati da `release-please` e modificarli a mano puo disallineare versione,
  changelog, tag e release. Fallo solo su richiesta esplicita per riparare il
  flusso automatico.
- Se l'utente chiede una release, il percorso standard e' verificare lo stato di
  `release-please`, pushare commit corretti su `main` e usare la Release PR /
  workflow ufficiale solo quando GitHub Actions e' disponibile e viene richiesto.
  Con budget Actions esaurito, fermati e concorda il percorso manuale prima di
  aggiornare changelog, tag o release.
- Se in un turno sono stati fatti cambi funzionali ma manca un Conventional Commit
  adeguato, non considerare il lavoro chiuso finche il commit non e' coerente con
  il flusso `release-please`.
- Se il flusso release sembra rotto, fermati e spiega il motivo prima di
  introdurre workaround manuali che bypassano `release-please`.

Per dettagli e casi limite, seguire `docs/RELEASE_POLICY.md`.

## Documentazione e roadmap

- Aggiorna documentazione e commenti quando il comportamento cambia.
- Se aggiungi o cambi configurazioni/env var, documentale in `README.md` o `docs/`.
- Quando aggiorni `docs/ROADMAP.md`, gli item completati vanno rimossi dalla
  roadmap: non vanno lasciati come checkbox spuntate.
- `docs/CHANGELOG.md` e' storico; il changelog di release corrente e' `CHANGELOG.md`
  root ed e' gestito da `release-please`.

## Policy per agenti

- Se un'informazione e' incerta, dichiara assunzioni e limiti.
- Se una richiesta e' ambigua su scope, comportamento atteso, rischio o tradeoff,
  chiedi chiarimento prima di procedere. Procedi con un'assunzione dichiarata solo
  per dettagli marginali che non cambiano il risultato sostanziale.
- Non trattare l'assenza di review esterne come blocco, ma non saltare self-review,
  test rilevanti e controllo dell'impatto release.
- Mantieni output e riepiloghi finali concreti: cosa e' cambiato, dove, eventuali
  rischi residui e, quando utile, come e' stato verificato.

## Sotto-moduli

Per regole specifiche di sotto-moduli, aggiungere `AGENTS.md` nelle relative
sottocartelle.

Le istruzioni piu profonde prevalgono sui livelli superiori.
