# Conservazione degli ordini

`orders.retention_until` è il termine esclusivo di consultazione e aggiornamento;
`purge_after` è il termine di cancellazione fisica. Le date sono UTC canoniche con
millisecondi. Il default è trenta giorni dalla creazione dell'ordine, mai dalla
lettura o dall'ultimo aggiornamento. Una pausa o uno scollegamento non fermano il tempo.

Il percorso commerciale dovrà impostare le scadenze esplicite previste dal piano:
un anno calendariale per Premium, estensioni concesse e trenta giorni di grace
dall'effettivo downgrade per l'eccedenza. Nella grace il termine di accesso è già
scaduto, mentre `purge_after` conserva la finestra di ripensamento. Il billing
completo resta nella milestone competente: il modello attuale non deduce un piano
attivo dalla presenza di un vecchio grant Premium, trial o lifetime.

Elenco, dettaglio e conteggi leggono soltanto ordini non scaduti. I dati fiscali
richiedono anche un grant non revocato e non scaduto; `expires_at` nullo eredita il
termine dell'ordine. Un grant revocato non torna valido tramite un nuovo tentativo
di sblocco e non restituisce quota. Per gli acquisti assorbiti da un combinato,
il termine dell'ordine corrente governa anche la cancellazione delle copie originali,
così storico e grant seguono il definitivo.

La manutenzione giornaliera esistente elimina gli ordini scaduti, normalmente entro
24 ore dal termine fisico. Le FK cancellano articoli, snapshot buyer, identificativi,
versioni, verifiche fiscali, riferimenti, anomalie e grant. La quota del ciclo resta
consumata. Un errore lascia il compito da riprovare; non estende l'accesso.

Prima della cancellazione un trigger conserva in `deleted_order_keys` soltanto
negozio, chiavi esterne degli ordini e delle righe, tipo e istante. Non conserva
buyer, titoli, importi o dati fiscali. Queste chiavi restano associate all'identità
del negozio, anche dopo il ricollegamento, per impedirne il reimport con vecchi job,
alias o nuovi ID dello stesso acquisto. La cancellazione dell'intera identità
elimina anche i marker. La loro conservazione residua rientra nella qualifica privacy,
separata dallo storico buyer.

`Scollega ed elimina negozio` prevale sulla grace e registra inoltre
`orders_deleted_through`: nessun acquisto creato prima o all'istante di eliminazione
può essere reimportato, compresi gli ordini non ancora osservati. Il ricollegamento
non azzera questo limite. Ogni scrittura dell'import rilegge consenso, marker e
scadenza nello stesso batch; il tempo finale impedisce a una risposta iniziata
prima della scadenza di aggiornare i dati dopo. L'eliminazione delle fonti rimuove
anche i dettagli e i retry pendenti.

## Copie derivate e lavori pendenti

| Superficie attuale | Contenuto e cancellazione |
|---|---|
| Risposte eBay e body webhook | Solo memoria della richiesta, nessun raw persistito: nessuna copia può superare le 24 ore o sopravvivere a un retry. |
| Ricevute webhook | Riferimenti tecnici minimizzati, negozio, consenso, oggetto e date; scadenza propria di sette giorni, verificata anche prima della pulizia. Nessun body o dato fiscale. |
| Queue e recupero ingressi | ID della ricevuta, ID del negozio oppure nome e turno del compito. Ogni consegna rilegge lo stato corrente; non trasporta snapshot buyer o CF. |
| Checkpoint e letture sync | Cursori, date, contatori ed esiti minimizzati; nessun ordine o identificativo fiscale serializzato. |
| Buyer e storico fiscale | Legati all'ordine tramite FK, senza anagrafica globale o snapshot indipendente. |
| Elenco, dettaglio e conteggi | Filtro server sulla scadenza, applicato prima di limite e risposta; i valori revocati non entrano nella risposta. |
| Suggerimenti e ricerca dedicata | Ancora da integrare nei task competenti: dovranno riusare il termine della fonte e il grant corrente, senza copie che ne prolunghino la vita. |
| Export | Generatori puri già presenti, senza file server o download autenticati: il percorso futuro deve rileggere autorizzazione e scadenza prima di generazione e download. |

Un restore deve riapplicare marker, limite di cancellazione e revoche successivi
allo snapshot prima di riaprire accessi e job, secondo il contratto recovery del
Master Plan. I test locali non provano l'erasure nelle copie native del provider.
