# Roadmap

Aggiornata al 2026-05-31.

La roadmap descrive direzione, priorità e prossimi passi correnti di
FiscalBay. Lo storico delle release sta in `CHANGELOG.md` e
`docs/CHANGELOG_ARCHIVE.md`; le decisioni stabili stanno in `docs/DECISIONS.md`
e negli ADR.

## Ora

- Mantenere stabile la serie `1.x` nel perimetro `approved_public_small`:
  servizio pubblico con accesso approvato, pochi utenti selezionati, OAuth eBay
  su VPS, token tenant cifrati, bot Telegram, admin tools, audit/retention,
  recovery minimo, metriche operative e scale readiness.
- Non aprire nuovi rilasci `1.x` se non ci sono bug, attriti reali dei venditori
  selezionati o blocchi operativi misurabili.
- Usare la direzione `2.0` SaaS-first solo come guardrail per evitare scelte
  `1.x` che rendano più costosa la futura web app.

## Prossimo

- Gestire eventuali patch `v1.11.x` come correzioni o piccoli affinamenti
  operativi, con obiettivo chiaro e deploy VPS verificabile quando applicabile.
- Migliorare comfort admin, onboarding, reconnect, performance, storage,
  polling, documentazione o runbook solo se metriche e uso reale lo giustificano.
- Preparare contratti e superfici interne riusabili dalla futura web app senza
  anticipare autenticazione web, billing o migrazione infrastrutturale.

## Più avanti

- Pianificare `v2.0.0` come web app SaaS-first per venditori eBay finali, con
  Telegram canale complementare per operatività e notifiche.
- Decidere in una fase dedicata feature core, autenticazione, stack
  frontend/backend, billing, flusso MVP e modello di accesso commerciale.

## Bloccato

- Lo sviluppo `2.0` non è aperto: richiede pianificazione dedicata e decisioni
  su prodotto, stack, dati, privacy, billing e deploy.
- Dashboard web completa, login web, ruoli/team, billing, automazioni marketing,
  notifiche multicanale e migrazioni infrastrutturali restano fuori dalla serie
  `1.x` salvo blocco reale o decisione esplicita.

## Fatto recente

- La prima release stabile è completata.
- La versione corrente documentata è `1.11.2`.
- La linea `1.x` ha consolidato onboarding controllato, multiutenza Telegram,
  OAuth eBay, token tenant, audit, retention, recovery, osservabilità e scale
  readiness.

## Regole operative

- La roadmap non è un changelog.
- La roadmap non conserva lo storico release come contenuto primario.
- Le idee, i debiti e i lavori condizionati non ancora promossi stanno in
  [`BACKLOG.md`](./BACKLOG.md).
- Ogni decisione di prodotto, tecnica o operativa condivisa in chat confluisce
  qui solo quando cambia direzione, priorità, perimetro o backlog.
- Non aggiornare la roadmap per micro-decisioni esecutive già chiuse nello
  stesso intervento.
- Ogni rilascio osservabile deve chiudersi con test locali rilevanti, release
  versionata, deploy VPS e smoke check remoto quando previsto dalla policy.
