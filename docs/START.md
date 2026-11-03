# FiscalBay 2.0 · Avvio, ripresa e documenti

FiscalBay 2.0 usa Workers/D1/Better Auth. I requisiti stanno nei [documenti di prodotto](product/PRODUCT.md) e di [engineering](engineering/ARCHITECTURE.md), il lavoro futuro nella [roadmap](ROADMAP.md). Codice/test/configurazioni attestano l'implementazione, PR/CI le verifiche e ricevute/readback lo stato remoto. Segreti e inventari privati restano fuori dal repository.

<a id="avvio"></a>

## 1. Avvio e ambiente di lavoro

Il checkout è già adottato: lo stato dei lavori è soltanto nella [roadmap](ROADMAP.md#stato), mentre la procedura di adozione iniziale dello ZIP 2.0 è archiviata in [docs/archive](archive/2026-09-adozione-2.0.md) per eventuali ricostruzioni storiche. Ogni nuova sessione segue la [ripresa](#ripresa).

Si lavora con Claude Code: sul Mac nel checkout locale, eventualmente in worktree sotto `.claude/worktrees/`, nelle sessioni cloud e nei thread del progetto Claude. Le regole operative sono in [AGENTS.md](../AGENTS.md), che `CLAUDE.md` importa; la base di lavoro è `develop`. Preparazione e limiti delle sessioni cloud sono nel [ciclo operativo](operations/RELEASE.md#ciclo-operativo).

### Eseguire il candidato locale

Usare Node 26.13.0 e pnpm 12.16.1 indicati in `mise.toml` e `package.json`. L’installazione e i gate locali non creano risorse remote:

```sh
pnpm install --frozen-lockfile
pnpm verify
node -e "import('./scripts/local-d1.mjs').then((d1) => d1.applyLocalMigrations())"
pnpm dev
```

Per provare gli endpoint Auth con account controllati, copiare `.dev.vars.example` in `.dev.vars` e sostituire i soli valori test. `EBAY_RUNAME` è il RuName eBay dell’ambiente test, distinto dall’autorizzazione seller. Il file `.dev.vars` resta ignorato da Git. Nessun comando applicativo esegue deploy.

<a id="ripresa"></a>

## 2. Riprendere nelle sessioni successive

Leggere `AGENTS.md`, [roadmap e questioni aperte](ROADMAP.md#stato), poi le sole sezioni della [matrice di lettura](operations/AGENT_SETUP.md#lettura) necessarie. Verificare Git, PR/CI e ricevute degli ultimi effetti remoti prima di ripetere operazioni; una sessione interrotta non prova che una scrittura sia fallita.

Quando una PR aggiorna i documenti lo dicono `AGENTS.md` e il [contenuto delle PR](operations/RELEASE.md#contenuto-delle-pr). Non mantenere un secondo stato, diario o tracker; la cronologia è in Git. Chat e audit vecchi non sono prerequisiti per lavorare.

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
| [AGENTS.md](../AGENTS.md)                         | Regole operative e confini del mandato                                   |
| [Roadmap](ROADMAP.md)                     | Versioni 2.x, riconoscimenti esterni, stato, questioni aperte e rischi   |
| [Glossario](../GLOSSARY.md)                       | Linguaggio vincolante del prodotto                                       |
| [Prodotto](product/PRODUCT.md), [piani](product/PLANS_AND_BILLING.md), [account](product/ACCOUNTS_AND_STORES.md), [ordini](product/ORDERS_AND_SYNC.md), [canali](product/CHANNELS_AND_ADMIN.md), [esperienza](product/EXPERIENCE.md) | Requisiti del prodotto per dominio |
| [Architettura](engineering/ARCHITECTURE.md), [sicurezza e privacy](engineering/SECURITY_AND_PRIVACY.md), [conservazione](engineering/DATA_RETENTION.md), [test](engineering/TESTING.md) | Requisiti tecnici |
| [Operazioni](operations/OPERATIONS.md), [pubblicazione](operations/RELEASE.md) | Runbook, stato dei servizi, Git, CI e rilascio |
| PR, CI e ricevute di pubblicazione            | Modifiche/verifiche dell'intervento e stato remoto osservato |
| [Decision Register](decisions/DECISION_REGISTER.md) | Scelte sintetiche, motivazioni e alternative superate                    |
| [Agent Setup](operations/AGENT_SETUP.md) | Strumenti, input, ambienti, custodia e responsabilità documentali        |
| [Fonti](reference/SOURCES.md)                       | Documentazione esterna da verificare quando pertinente                   |
| [Riferimenti brand](brand/REFERENCES.md)  | Concept e immagini originali, non asset finali già approvati             |
| [Design system](brand/DESIGN_SYSTEM.md)  | Token, componenti, catalogo dei riferimenti e provenienza                |
| [Audit UI/UX del test](audits/AUDIT_UI_UX.md) | Problemi rilevati sul test e correzioni verificate |


Questa guida è l’unico ingresso e indice generale. `CLAUDE.md` importa AGENTS senza una seconda policy. `docs/archive/` contiene la procedura di adozione e il Master Plan della 2.0, con milestone e gate: sono storici, non requisiti, e stanno fuori dai controlli ordinari di `verify-docs`.

Per il prodotto prevale l’ultima decisione esplicita dell’owner, da riportare nel piano. Contratti esterni e condizioni applicabili vanno verificati sulle fonti ufficiali correnti; codice/test/configurazioni attestano ciò che esiste, readback del provider ciò che è attivo. Una discordanza richiede una correzione o una decisione dell’owner, non un cambio tacito dello scope. `AGENTS.md` governa l’esecuzione, non modifica i requisiti.
Controllo ordinario dopo modifiche documentali:

```sh
node scripts/verify-docs.mjs
```

Il controllo rileva link e ancore interni rotti, tabelle incoerenti e decisioni duplicate/inesistenti. Gli stati aperti sono ammessi nella roadmap; autorizzazioni e prerequisiti applicabili si verificano secondo `AGENTS.md` e il ciclo di pubblicazione, senza rileggere i gate storici del go-live a ogni promozione. Rifiuta le sigle delle milestone fuori da archivio e registro. Non impone un tracker separato, un grafo dei task verificato dallo script o ID consecutivi. `--assets` aggiunge la verifica degli originali secondo il manifest. Comandi e gate attuali sono in `package.json` e [Agent Setup](operations/AGENT_SETUP.md); il percorso di pubblicazione è in [RELEASE](operations/RELEASE.md).
