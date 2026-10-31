# FiscalBay 2.0 · Avvio, ripresa e documenti

FiscalBay 2.0 usa Workers/D1/Better Auth. Il [Master Plan](docs/MASTER_PLAN.md) contiene requisiti e roadmap, [avanzamento e questioni aperte](docs/MASTER_PLAN.md#stato); i via effettivi sono nel suo [governo](docs/MASTER_PLAN.md#s00). Codice/test/configurazioni attestano l'implementazione, PR/CI le verifiche e ricevute/readback lo stato remoto. Segreti e inventari privati restano fuori dal repository.

<a id="avvio"></a>

## 1. Avvio e ambiente di lavoro

Il checkout è già adottato: lo stato dei lavori è soltanto nell'[avanzamento](docs/MASTER_PLAN.md#stato), mentre la procedura di adozione iniziale dello ZIP 2.0 è archiviata in [docs/archive](docs/archive/2026-09-adozione-2.0.md) per eventuali ricostruzioni storiche. Ogni nuova sessione segue la [ripresa](#ripresa).

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

<a id="ripresa"></a>

## 2. Riprendere nelle sessioni successive

Leggere `AGENTS.md`, [avanzamento e questioni aperte](docs/MASTER_PLAN.md#stato), checkpoint e milestone pertinente, poi le sole sezioni della [matrice di lettura](docs/engineering/AGENT_SETUP.md#lettura) necessarie. Verificare Git, PR/CI e ricevute degli ultimi effetti remoti prima di ripetere operazioni; una sessione interrotta non prova che una scrittura sia fallita.

Quando una PR aggiorna il piano lo dicono `AGENTS.md` e il [contenuto delle PR](docs/engineering/RELEASE.md#contenuto-delle-pr). Non mantenere un secondo stato, diario o tracker; la cronologia è in Git. Chat e audit vecchi non sono prerequisiti per lavorare.

<a id="documenti"></a>

## 3. Mappa dei documenti e manutenzione

L'applicazione è in `app/`: `orders/` raccoglie i moduli di elenco e ricerca,
`account/` quelli per passkey e dispositivi, `domain/` le operazioni server e
`integrations/` i client esterni. Le route restano in `routes/` e l'interfaccia
in `components/`. I test applicativi sono in `test/`, con dati e helper di
preparazione in `test/fixtures/`; le prove browser sono in `e2e/`. Gli script
di pubblicazione sono in `scripts/release/`, i moduli condivisi dagli script in `scripts/lib/`.

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
| [Audit UI/UX del test](docs/archive/2026-10-03-audit-ui-ux-test-2.0.md) | Problemi rilevati sul test e correzioni verificate |

Questo README è l’unico ingresso/indice generale. `CLAUDE.md` importa AGENTS senza una seconda policy. `docs/archive/` contiene due documenti fuori dai controlli ordinari di `verify-docs`: la procedura di adozione, storica e non più da aggiornare, e l'audit UI/UX del test, che invece si mantiene e registra in §15 ogni correzione verificata; resta nell'archivio perché i suoi identificativi D1-D5 coincidono con i codici delle decisioni. Non serve consegnare la trascrizione del grill: le regole utili sono nel piano e nel registro.

Controllo ordinario dopo modifiche documentali:

```sh
node scripts/verify-docs.mjs
```

Il controllo rileva link e ancore interni rotti, tabelle incoerenti, decisioni duplicate/inesistenti e gate Production mancanti o non validi. Gli stati aperti sono ammessi nel piano, ma bloccano la pubblicazione. Non impone un tracker separato, un grafo dei task verificato dallo script o ID consecutivi. `--assets` aggiunge la verifica degli originali secondo il manifest. Comandi e gate attuali sono in `package.json` e [Agent Setup](docs/engineering/AGENT_SETUP.md); il percorso di pubblicazione è in [RELEASE](docs/engineering/RELEASE.md).
