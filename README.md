# FiscalBay 2.0 · Avvio, ripresa e documenti

FiscalBay 2.0 usa Workers/D1/Better Auth. Il [Master Plan](docs/MASTER_PLAN.md) contiene requisiti e roadmap, [avanzamento e questioni aperte](docs/MASTER_PLAN.md#stato); i via effettivi sono nel suo [governo](docs/MASTER_PLAN.md#s00). Codice/test/configurazioni attestano l'implementazione, PR/CI le verifiche e ricevute/readback lo stato remoto. Segreti e inventari privati restano fuori dal repository.

<a id="avvio"></a>

## 1. Avvio e ambiente di lavoro

Il checkout è già adottato e M0/M1 sono concluse; la procedura di adozione iniziale dello ZIP 2.0 è archiviata in [docs/archive](docs/archive/2026-09-adozione-2.0.md) per eventuali ricostruzioni storiche. Ogni nuova sessione segue la [ripresa](#ripresa).

Si lavora con Claude Code: sul Mac nel checkout locale, eventualmente in worktree sotto `.claude/worktrees/`, nelle sessioni cloud e nei thread del progetto Claude. Le regole operative sono in [AGENTS.md](AGENTS.md), che `CLAUDE.md` importa; la base di lavoro è `develop`. Preparazione e limiti delle sessioni cloud sono nel [ciclo operativo](docs/engineering/RELEASE.md#ciclo-operativo).

### Eseguire il candidato locale

Usare Node 26.12.1 e pnpm 12.15.0 indicati in `mise.toml` e `package.json`. L’installazione e i gate locali non creano risorse remote:

```sh
pnpm install --frozen-lockfile
pnpm verify
node -e "import('./scripts/local-d1.mjs').then((d1) => d1.applyLocalMigrations())"
pnpm dev
```

Per provare gli endpoint Auth con account controllati, copiare `.dev.vars.example` in `.dev.vars` e sostituire i soli valori test. `EBAY_RUNAME` è il RuName eBay dell’ambiente test, distinto dall’autorizzazione seller. Il file `.dev.vars` resta ignorato da Git. Nessun comando applicativo esegue deploy.

### Negozi eBay Production e Sandbox sul sito test

Il collegamento dei negozi mantiene eBay Production come scelta predefinita. Sul dominio
`test.fiscalbay.it` e in locale, `EBAY_SANDBOX_ENABLED=true` abilita la scelta Sandbox soltanto
quando sono presenti i tre segreti `EBAY_SANDBOX_CLIENT_ID`, `EBAY_SANDBOX_CLIENT_SECRET` e
`EBAY_SANDBOX_RUNAME`. Le credenziali `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET` e `EBAY_RUNAME`
continuano a servire i negozi Production e il login eBay, distinto dal consenso seller.
Il dominio pubblico `fiscalbay.it` non permette collegamenti Sandbox.

Applicare la migration `0014_ebay_environments.sql` prima del codice. I negozi esistenti restano
Production con ID, token e ordini invariati. La sessione OAuth conserva l'ambiente scelto sul
server; lettura iniziale e rinnovi usano chiavi ed endpoint dello stesso ambiente. Account e
ordini con ID uguali nei due ambienti rimangono distinti. I nomi dei negozi sugli ordini Sandbox
riportano `(Sandbox)` e gli inviti a ricollegare conservano l'ambiente originale. L'elenco ordini
mostra Production per impostazione predefinita; sul test il selettore permette di consultare
separatamente Sandbox, senza mescolare le due fonti nello stesso elenco.

Nel keyset Sandbox configurare il RuName con callback accettato e rifiutato
`https://test.fiscalbay.it/api/auth/callback/ebay`, mantenendo i soli scope base,
`commerce.identity.readonly` e `sell.fulfillment.readonly`. Custodire i valori dei segreti nel
Worker test, mai nel repository. Il flag è disabilitato in Production e, dal 24 ottobre 2026,
anche nella configurazione test, finché l'owner non chiede di riattivarlo; la scelta resta
nascosta anche finché mancano i segreti. Verificare il callback prima
di configurare i segreti. Nessuna configurazione
Sandbox richiede di cambiare il keyset Production.

<a id="ripresa"></a>

## 2. Riprendere nelle sessioni successive

Leggere `AGENTS.md`, [avanzamento e questioni aperte](docs/MASTER_PLAN.md#stato), checkpoint e milestone pertinente, poi le sole sezioni della [matrice di lettura](docs/engineering/AGENT_SETUP.md#lettura) necessarie. Verificare Git, PR/CI e ricevute degli ultimi effetti remoti prima di ripetere operazioni; una sessione interrotta non prova che una scrittura sia fallita.

Aggiornare il piano nella stessa PR quando cambiano requisiti, checkpoint, stato dei task, avanzamento significativo o questioni aperte. Nel template dichiarare «Impatto sul piano: aggiornato / non necessario, con motivo»; fix ordinari e miglioramenti dei test restano nella PR con le loro prove. Non mantenere un secondo stato, diario o tracker; la cronologia è in Git. Chat e audit vecchi non sono prerequisiti per lavorare.

<a id="documenti"></a>

## 3. Mappa dei documenti e manutenzione

L'applicazione è in `app/`: `orders/` raccoglie i moduli di elenco e ricerca,
`account/` quelli per passkey e dispositivi, `domain/` le operazioni server e
`integrations/` i client esterni. Le route restano in `routes/` e l'interfaccia
in `components/`. I test applicativi sono in `test/`, con dati e helper di
preparazione in `test/fixtures/`; le prove browser sono in `e2e/`. Gli script
di pubblicazione sono in `scripts/release/`. Screenshot, audit storici e la procedura di adozione iniziale
restano in `docs/archive/`.

| Documento                                      | Consultarlo per                                                          |
| ---------------------------------------------- | ------------------------------------------------------------------------ |
| [AGENTS.md](AGENTS.md)                         | Regole operative e confini del mandato                                   |
| [Master Plan](docs/MASTER_PLAN.md)             | Requisiti, gate, roadmap, avanzamento sintetico, checkpoint e questioni aperte |
| PR, CI e ricevute di pubblicazione            | Modifiche/verifiche dell'intervento e stato remoto osservato |
| [Decision Register](docs/DECISION_REGISTER.md) | Scelte sintetiche, motivazioni e alternative superate                    |
| [Agent Setup](docs/engineering/AGENT_SETUP.md) | Strumenti, input, ambienti, custodia e responsabilità documentali        |
| [Fonti](docs/SOURCES.md)                       | Documentazione esterna da verificare quando pertinente                   |
| [Riferimenti brand](docs/brand/REFERENCES.md)  | Concept e immagini originali, non asset finali già approvati             |
| [Design system](docs/brand/DESIGN_SYSTEM.md)  | Token, componenti, catalogo dei riferimenti e provenienza                |

Questo README è l’unico ingresso/indice generale. `CLAUDE.md` importa AGENTS senza una seconda policy. Audit della consegna e copertura Q1–Q569 sono snapshot storici in `docs/archive/`, **non fonti correnti da aggiornare o letture ordinarie**. Non serve consegnare la trascrizione del grill: le regole utili sono nel piano e nel registro.

Controllo ordinario dopo modifiche documentali:

```sh
node scripts/verify-docs.mjs
```

Il controllo rileva link e ancore interni rotti, tabelle incoerenti, decisioni duplicate/inesistenti e gate Production mancanti o non validi. Gli stati aperti sono ammessi nel piano, ma bloccano la pubblicazione. Non impone un tracker separato, un grafo dei task verificato dallo script o ID consecutivi. `--assets` aggiunge la verifica degli originali secondo il manifest; `SHA256SUMS.txt` serve solo a confrontare la consegna iniziale. Comandi e gate attuali sono in `package.json` e [Agent Setup](docs/engineering/AGENT_SETUP.md); il percorso di pubblicazione è in [RELEASE](docs/engineering/RELEASE.md).
