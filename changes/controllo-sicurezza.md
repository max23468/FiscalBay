# Controllo di sicurezza pianificato

## Changelog

### Altre modifiche

- **Controllo di sicurezza settimanale.** Un workflow pianificato ricontrolla ogni settimana avvisi delle dipendenze distribuite, firme dei pacchetti, protezione di `develop` e `main` e alert aperti del repository, anche senza nuove PR.

## Decisioni

| ID | Ambito | Sintesi della scelta / motivazione | Provenienza | Stato / requisito completo |
|---|---|---|---|---|
| D312 | **Controllo di sicurezza pianificato** | `security.yml` gira ogni giovedì e a mano su `develop`: `pnpm audit --prod`, `pnpm audit signatures`, regole effettive di `develop` e protezione di `main` con il solo `Node 26` richiesto, alert aperti di Dependabot, code scanning e secret scanning. L'avviso all'owner è il fallimento del workflow, notificato da GitHub; nessun canale, costo o provider nuovo. Gli alert si leggono con un token con grana fine in sola lettura, con scadenza nel registro delle credenziali; ruleset e protezione con il token del run, perché il repository è pubblico. Le scadenze delle credenziali restano al registro della console. | Richiesta owner del 2026-11-05, dopo il confronto con un altro progetto: audit, Dependabot e dependency review agivano soltanto sulle PR | Confermato · [§29](../docs/engineering/SECURITY_AND_PRIVACY.md#s29) |
