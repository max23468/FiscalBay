# Coordinatori sul Mac e coda delle Actions più corta

## Changelog

### Altre modifiche

- **Pubblicazione meno in coda.** I coordinatori di `Pubblica` e `Promuovi` girano sul Mac dell'owner quando è acceso, una qualifica automatica superata lascia il posto a quella della testa più recente, i job paralleli di PR e qualifiche hanno un tetto e `Promuovi` su un commit certificato non attende altri controlli.

## Decisioni

| ID | Ambito | Sintesi della scelta / motivazione | Provenienza | Stato / requisito completo |
|---|---|---|---|---|
| D321 | **Coda delle Actions e coordinatori** | I coordinatori di `cycle.yml` girano su quattro runner `fiscalbay-coordinator` del Mac dell'owner quando uno è acceso e libero, altrimenti sulle Actions: la loro attesa non occupa i venti posti dell'account. Sul Mac eseguono soltanto codice di `develop` senza dipendenze, `verify:repo` riserva loro il runner e le PR da fork attendono sempre l'approvazione. Una qualifica automatica lascia il posto a quella di una testa più recente; le richieste e la campagna del lunedì finiscono. Nelle PR browser e mutation hanno al più quattro job ciascuno, la mutation del candidato sei con altro lavoro attivo. `promote` su un tree certificato richiede soltanto `Node 26` riuscito. Un coordinatore a eventi, senza job in attesa, richiederebbe di riscrivere il ciclo come macchina a stati ripresa da `workflow_run`: resta un'evoluzione se il Mac non bastasse. Precisa D274, D285 e D301. | Richiesta owner del 2026-11-08, dopo una promozione rimasta in coda dietro tre coordinatori in attesa e una qualifica superata con 45 job in coda | Confermato · [Pubblicazione](../docs/operations/RELEASE.md#qualifica-del-candidato) · [Runner del Mac](../docs/operations/AGENT_SETUP.md#runner-del-mac) |
