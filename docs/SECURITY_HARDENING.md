# Hardening tecnico-operativo (2026-05-27)

## Rischio iniziale

- Livello: **medio-alto**.
- Stato in questa ondata: **P0 priorità**, poi P1/P2.
- Rotazione segreti: **non inclusa** in questa fase (espressamente esclusa).

## Contesto operativo rilevante

- Integrazioni operative: VPS, API eBay, Telegram, DB Postgres, email.
- Il servizio è in pratica con segreti runtime e non in repository.

## Piano tecnico (P0/P1/P2)

### P0

- Inventario completo dei segreti operativi (VPS, API, email, DB): verificare che nessun valore esplicito sia in repo.
- Confermare separazione account/service-key per ambiente e permessi minimi.
- Mappare i punti dove flussi token possono riusare credenziali non più necessarie e classificarli per criticità.
- Preparare runbook esplicito di incidente con stop integrazione, rollback e verifica stato bot.

### P1

- Segmentare ambiente staging/prod:
  - separazione configurazioni;
  - chiavi e token separati per scopo;
  - policy di deploy distinte.
- Audit webhook/API/cron per integrità input:
  - validazione payload minimi;
  - firma/verifica callback dove prevista;
  - log delle anomalie con output sanitizzato.
- Logging senza payload sensibili e retention coerente.

### P2

- Rivedere dipendenze e patch di sicurezza con cadenza pianificata.
- Audit endpoint con modello least privilege su dati utente/tenant.
- Controllo trimestrale su policy di escalation incident e rollback.

## Piano operativo e di governo

### P0/P1

- Separare chiaramente logica runtime da repo: file di stato/config non committati.
- Aggiornare `docs/SERVICE_GOVERNANCE.md` con runbook di rollback/incidente e check predeploy.
- Monitoraggio settimanale runtime sugli alert di anomalia e retry incoerenti.

### P2

- Mantenere una matrice `segreti/ambiente/integrity` in roadmap o runbook, aggiornata dopo ogni modifica ad API o credenziali.
- Introdurre revisione mensile con owner tecnico e outcome scritto nel documento operativo.
