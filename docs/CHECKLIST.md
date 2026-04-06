# Checklist Operativa

## Indice rapido

- `Fase 3`
  - progettazione multiutente
- `Fase 4`
  - governance del prodotto

Documenti collegati:

- `docs/INDEX.md`
- `docs/MILESTONE_BOARD.md`
- `docs/DECISIONS_PENDING.md`

## Fase 3 - Progettazione Multiutente [Priorita' media]

### Target di prodotto

- [ ] le credenziali eBay non devono stare in env globali condivise
- [ ] rendere espliciti gli stati del workflow utente e account invece di usare flag impliciti sparsi
- [ ] introdurre gating per capability oltre che per ruolo admin o utente
- [ ] rendere idempotenti i comandi e i processi sensibili di onboarding e collegamento account
- [ ] separare meglio richiesta, approvazione e applicazione effettiva dei permessi nel workflow accessi
- [ ] introdurre una piccola reconciliation periodica per riallineare utenti, chat, token e subscription incoerenti
- [ ] valutare una coda operativa per azioni sensibili come OAuth, revoca e operazioni admin critiche

## Fase 4 - Governance del Prodotto [Priorita' media]

- [ ] definire governance e limiti del servizio in modo compatibile con isolamento dati tra utenti
- [ ] definire quali dati personali vengono trattati
- [ ] scrivere informativa minima d'uso e retention
- [ ] definire retention dei log
- [ ] definire retention dei token e dati ordini
- [ ] chiarire policy di cancellazione utente
- [ ] definire limiti del servizio e carichi supportati
