# Pratiche moderne del web e accessibilità

## Changelog

### Novità

#### Miglioramenti

- **Passkey più semplici.** La pagina di accesso propone le passkey salvate direttamente nel campo email, il gestore delle password mostra l'email dell'account e una passkey rimossa smette di comparire tra quelle proposte.
- **Password più chiare.** Un pulsante mostra la password mentre la scrivi e la regola degli 8 caratteri è visibile prima dell'invio.
- **Errori che restano.** Se lo sblocco, l'esportazione o una richiesta sui dati non riesce, il messaggio resta accanto al comando invece di sparire dopo pochi secondi.
- **Tastiera e lettori di schermo.** Il focus segue la sezione scelta nelle Impostazioni e nell'app, il focus da tastiera resta visibile anche con il contrasto elevato di Windows e i pulsanti di conferma spiegano cosa manca invece di restare spenti.
- **Movimento ridotto.** Con «Riduci movimento» attivo, pannelli e scorrimenti compaiono senza spostamenti, conservando le dissolvenze.

#### Correzioni

- **Bozze e ricerca mobile.** Aprire un ordine dalla ricerca chiede conferma prima di lasciare modifiche non salvate; Indietro chiude prima la ricerca. La tabulazione dei filtri segue la loro disposizione anche su mobile e i nuovi ordini aspettano la fine dello scorrimento.
- **Periodi di 6 e 12 mesi.** A fine mese i periodi «Ultimi 6 mesi» e «Ultimi 12 mesi» partono dall'ultimo giorno del mese giusto e non escludono più gli ordini dei primi giorni.

### What's new

#### Improvements

- **Simpler passkeys.** The sign-in page offers your saved passkeys right in the email field, your password manager shows your account email and a removed passkey stops being offered.
- **Clearer passwords.** A button shows the password while you type it and the 8-character rule is visible before you submit.
- **Errors that stay.** If unlocking, exporting or a data request fails, the message stays next to the action instead of disappearing after a few seconds.
- **Keyboard and screen readers.** Focus follows the section you choose in Settings and in the app, the keyboard focus stays visible with Windows high contrast and confirmation buttons explain what is missing instead of staying disabled.
- **Reduced motion.** With «Reduce motion» on, panels and scrolling appear without movement, keeping the fades.

#### Fixes

- **Drafts and mobile search.** Opening an order from search asks for confirmation before leaving unsaved changes; Back closes search first. Filter tab order follows the layout on mobile too, and new orders wait for scrolling to stop.
- **6 and 12 month periods.** At the end of a month, «Last 6 months» and «Last 12 months» start on the last day of the right month and no longer leave out the orders of the first days.

### Altre modifiche

- **Dettaglio dell'ordine alla prima apertura.** Il pannello del dettaglio si carica quando si apre il primo ordine, con la stessa animazione di chiusura e lo stesso ritorno del focus, così la pagina Ordini resta entro il limite del JavaScript iniziale.
- **Pagine pubbliche più rapide.** Tornando indietro tra le pagine pubbliche il browser le ripristina all'istante, e passando su un link del sito precarica la pagina successiva; area dell'account, accesso e console restano escluse.
- **Lettura più comoda.** Pagine legali, Guide, FAQ e Supporto hanno righe più brevi, e intestazione e piè di pagina restano nello schermo anche con un testo più grande.
- **Protezioni del browser.** Gli script eseguono soltanto se firmati dalla pagina o caricati da script firmati, Trusted Types e le violazioni della CSP sono osservati attraverso un endpoint dedicato, e le intestazioni limitano fotocamera, microfono, posizione e l'uso delle risorse da altri siti. Uscendo dall'account il browser svuota i dati salvati dal sito.
- **Misure delle pagine.** Le misure di caricamento si aggiornano per tutta la visita, escludono le schede aperte in background e scompongono l'INP nelle sue parti nella console.
- **HTTPS anche alla prima visita.** L'intestazione HSTS copre anche i sottodomini e chiede l'inserimento di fiscalbay.it nella lista dei browser che aprono il sito soltanto in HTTPS già alla prima visita.

## Decisioni

| ID | Ambito | Sintesi della scelta / motivazione | Provenienza | Stato / requisito completo |
|---|---|---|---|---|
| D336 | **Cache Indietro/Avanti delle pagine pubbliche** | Le pagine pubbliche rispondono `private, no-cache` invece di `no-store`: nessuna copia condivisa, una nuova richiesta a ogni visita e il ripristino immediato con Indietro. Restano `no-store` la home, che con la sessione porta agli Ordini, Prezzi con la sessione, l'area dell'account, accesso, console e API. Accettato che, dopo l'uscita, Indietro mostri per un attimo l'intestazione con «Apri l'app». Scartato: `no-store` ovunque, che rinuncia al ripristino. | Scelta owner del 2026-11-15 | Confermato · [Requisito](../docs/product/EXPERIENCE.md#s23) |
| D337 | **Dati del browser all'uscita** | Uscita, nuova autenticazione e chiusura della sessione corrente inviano `Clear-Site-Data: "storage"`: il browser svuota la memoria del sito, come la selezione di ordini della scheda. I cookie restano ad Auth, così le preferenze del dispositivo (fuso orario, ultimo metodo di accesso, scelta di visita) sopravvivono. Scartato: aggiungere `"cookies"`. | Scelta owner del 2026-11-15 | Confermato · [Requisito](../docs/engineering/SECURITY_AND_PRIVACY.md#s29) |
| D338 | **User handle stabile delle passkey** | Ogni utente ha un identificativo WebAuthn casuale e stabile, in una tabella aggiunta, usato per tutte le passkey nuove con l'email come nome utente; le passkey già registrate conservano il proprio. Abilita i segnali del browser che tolgono le passkey rimosse e aggiornano email e nome. Scartato: il solo segnale della credenziale sconosciuta, senza modifiche al database. | Scelta owner del 2026-11-15 | Confermato · [Requisito](../docs/product/ACCOUNTS_AND_STORES.md#s07) |
| D339 | **Speed Brain spento** | Speed Brain di Cloudflare, comune ai due ambienti, si spegne: rifiuta con 503 i precaricamenti delle pagine che non stanno nella cache di Cloudflare, cioè tutte quelle del Worker. Le regole di speculazione delle pagine pubbliche sono dell'app e precaricano soltanto il sito pubblico. Scartato: tenere Speed Brain senza precaricamenti effettivi. | Scelta owner del 2026-11-15 | Confermato · [Requisito](../docs/operations/PROTECTION.md#protezioni-zona) |
| D340 | **Movimento ridotto con dissolvenze** | Con «Riduci movimento» niente si sposta, scala o ridimensiona; restano le dissolvenze brevi e i cambi di colore, che non disturbano chi soffre di disturbi vestibolari e rendono leggibili i cambi di stato. Ogni animazione lo dichiara dove è definita, senza la regola globale con `!important`. Supera l'azzeramento di ogni animazione e transizione del design system. Scartato: azzerare tutto, dissolvenze comprese. | Scelta owner del 2026-11-15 | Confermato · [Requisito](../docs/brand/DESIGN_SYSTEM.md) |
| D341 | **Lista HSTS dei browser** | `fiscalbay.it` entra nella lista di precaricamento HSTS dei browser: l'header passa a un anno con `includeSubDomains` e `preload` sui due ambienti e, dopo il readback di Production, il dominio si iscrive su hstspreload.org. L'inventario del 2026-11-15 trova come soli nomi web l'apice, `www` e `test`, tutti in HTTPS; gli altri record servono alla posta. Ogni nuovo sottodominio deve nascere in HTTPS e l'uscita dalla lista richiede mesi. Supera la regola che teneva fuori `includeSubDomains` e `preload`. Scartato: restare fuori dalla lista, con la sola protezione dalla seconda visita. | Scelta owner del 2026-11-15 | Confermato · [Requisito](../docs/operations/PROTECTION.md#protezioni-zona) |
