# Mutation del candidato e strumenti di pubblicazione

## Decisioni

| ID | Ambito | Sintesi della scelta / motivazione | Provenienza | Stato / requisito completo |
|---|---|---|---|---|
| D306 | **Mutation completa solo per i suoi strumenti** | Il candidato ripete la mutation di tutti i moduli critici soltanto quando cambiano gli strumenti della mutation: Stryker, Vitest, `pnpm-workspace.yaml`, `scripts/mutation*.mjs` e `mutation.yml`. Un cambio della pubblicazione, del classificatore, dei workflow o delle prove browser non cambia quali mutanti i test uccidono: la qualifica resta completa nelle altre prove, ma la mutation segue i soli moduli critici modificati e i loro consumatori. | Il 2026-11-06 la correzione di `scripts/release/release.mjs` (#666) ha portato la qualifica del candidato a 64 job di mutation su 30 moduli invariati, con una promozione stimata in oltre tre ore; l'owner chiede di correggere subito | Confermato · [Pubblicazione](../docs/operations/RELEASE.md#mutation-test) |
