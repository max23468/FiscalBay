# Mutation incrementale nelle PR

## Decisioni

| ID | Ambito | Sintesi della scelta / motivazione | Provenienza | Stato / requisito completo |
|---|---|---|---|---|
| D301 | **Mutation incrementale nelle PR** | Una PR prova per intero, in modo incrementale, i moduli critici che cambia e quelli importati direttamente da un test che cambia, a partire dal riferimento che qualifiche e campagne riuscite su `develop` salvano nella cache di GitHub Actions. Supera D270 e la parte di D297 sulle righe cambiate e sui blocchi spostati: le righe invariate di un modulo restavano fuori anche quando un test cambiato smetteva di coprirle. Candidato e campagna settimanale restano invariati e coprono consumatori e moduli importati. Come in CF Ready, con zero superstiti invece di una soglia. | Richiesta owner del 2026-11-04: dopo #647 il candidato ha trovato un mutante vivo su una riga invariata di `order-acquisition`, corretto con #651 | Confermato · [Mutation](../docs/operations/RELEASE.md#mutation-test) |
