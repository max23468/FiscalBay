# Roadmap

Aggiornata al 2026-05-02.

## Stato corrente

FiscalBay è oggi alla versione `1.11.2`.

La roadmap necessaria per la prima release stabile è completata. Il perimetro attuale resta `approved_public_small`: servizio pubblico con accesso approvato, pochi utenti selezionati, onboarding OAuth eBay su VPS, token tenant cifrati, bot Telegram operativo, strumenti admin, audit/retention/recovery minimi, metriche operative, security check e scale readiness.

Non ci sono rilasci aperti bloccanti per il ramo `1.x`.

## Direzione prodotto 2.0

La direzione strategica per `v2.0.0` è trasformare FiscalBay in una web app SaaS-first per venditori eBay finali.

Principi `v2.0.0` già fissati:

- la web app diventerà il modello primario del prodotto
- il target resta composto da venditori eBay finali
- il prodotto dovrà essere pubblico e vendibile, ma orientato a pochi utenti selezionati
- Telegram diventerà un canale complementare per operatività e notifiche
- feature core, autenticazione, stack frontend/backend e flusso MVP restano da decidere in una pianificazione dedicata futura

Questa direzione non apre ancora lo sviluppo di `v2.0.0`: serve come bussola per evitare scelte `1.x` che rendano più costosa la futura web app.

## Roadmap aperta

### Serie 1.x

La serie `1.x` resta centrata su stabilità operativa, servizio curato e miglioramenti piccoli ma completi.

Prossimi rilasci pianificati:

- nessun rilascio `1.x` successivo è pianificato al momento; eventuali patch `v1.11.x` devono restare correzioni o piccoli affinamenti operativi.

Possibili nuove minor `1.x` vanno aperte solo se emergono attriti reali nei venditori selezionati o blocchi operativi misurabili.

Altre aree possibili, senza ordine vincolante:

- migliorare ulteriormente il comfort operativo admin se emergono attriti reali
- rafforzare onboarding, reconnect o assistenza utente se i venditori selezionati incontrano blocchi ricorrenti
- intervenire su performance, storage o polling solo se metriche e healthcheck lo giustificano
- preparare contratti e superfici interne riusabili dalla futura web app, senza anticipare una migrazione 2.0 prematura
- migliorare documentazione, runbook e procedure quando cambiano flussi operativi reali

### Non-obiettivi 1.x

Per evitare bloatware, questi lavori non vanno anticipati nella serie `1.x` salvo blocco reale o decisione esplicita:

- dashboard web completa
- login e gestione account web
- billing o piani commerciali
- ruoli avanzati o team
- automazioni marketing
- notifiche complesse multicanale
- migrazione infrastrutturale non giustificata da soglie reali

### Backlog condizionato

I lavori condizionati non ancora promossi stanno in [BACKLOG.md](./BACKLOG.md).
Vanno ripresi solo se crescita, soglie, rischi operativi o decisioni prodotto li
rendono necessari.

## Regole operative

- Ogni rilascio `1.x` deve avere un obiettivo operativo chiaro.
- Ogni decisione di prodotto, tecnica o operativa condivisa in chat deve essere
  riportata qui quando cambia direzione, priorità, perimetro o backlog del
  progetto.
- I lavori completati vanno spostati nello storico e rimossi dalla roadmap aperta.
- Non aggiungere checkbox completate come backlog residuo.
- SQLite resta il default finché healthcheck e scale readiness restano sani.
- Postgres e componenti SaaS più pesanti entrano solo quando sono giustificati.
- Ogni rilascio osservabile deve chiudersi con test locali rilevanti, release versionata, deploy VPS e smoke check remoto.

## Storico completato

### Serie 1.x

- `v1.11.2` - Fix conteggio backlog retry dopo migrazione legacy
- `v1.11.1` - Correzioni review bot e manutenzione automazioni GitHub
- `v1.11.0` - Ricerca fiscale ordini e alert su spike dati fiscali mancanti
- `v1.10.0` - CI GitHub Actions leggera reintrodotta
- `v1.9.0` - Onboarding selettivo più curato
- `v1.8.0` - Support snapshot utente
- `v1.7.0` - Export fiscale venditore
- `v1.6.0` - Scale readiness senza migrazione automatica
- `v1.5.0` - Security operations
- `v1.4.0` - Admin comfort e osservabilità leggera
- `v1.3.0` - Self-service assistito utente
- `v1.2.0` - Disconnect e reconnect più robusti
- `v1.1.1` - Fix esposizione release tag nel package installato
- `v1.1.0` - Stabilizzazione operativa post-1.0 e metadata release in admin healthcheck
- `v1.0.1` - Fix formattazione notifiche Telegram e struttura iniziale roadmap
- `v1.0.0` - Readiness prima release stabile

### Costruzione della prima release stabile

- `v0.20.0` - Metriche prodotto admin
- `v0.19.0` - Rate limiting minimo
- `v0.18.x` - Consolidamento del servizio pubblico
- `v0.17.x` - Robustezza VPS e recovery
- `v0.16.x` - Ottimizzazione applicativa e storage
- `v0.15.x` - Lifecycle dati e retention
- `v0.14.x` - Guardrail e strumenti admin
- `v0.13.x` e precedenti - Servizio pubblico con accesso approvato, onboarding OAuth e perimetro multiutente iniziale
