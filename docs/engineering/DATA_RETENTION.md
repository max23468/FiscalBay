# Conservazione degli ordini

`orders.retention_until` è il termine esclusivo di consultazione e aggiornamento;
`purge_after` è il termine di cancellazione fisica. Le date sono UTC canoniche con
millisecondi. Il default è trenta giorni dalla creazione dell'ordine, mai dalla
lettura o dall'ultimo aggiornamento. Una pausa o uno scollegamento non fermano il tempo.

Il percorso commerciale dovrà impostare le scadenze esplicite previste dal piano:
un anno calendariale per Premium ed estensioni concesse. Il modello non deduce un
piano attivo dalla presenza di un vecchio grant Premium, trial o lifetime: vale la
copertura in corso.

<a id="downgrade"></a>
## Downgrade al Free

Senza una copertura in corso lo spazio ha un solo negozio eBay attivo, registrato in
`free_store_changes`; gli altri ricevono la pausa `plan`, che ferma le letture e
nasconde i dati. Nella stessa operazione gli ordini tornano alla finestra Free: il
termine di accesso diventa trenta giorni dalla data dell'ordine e, per gli ordini che
la perdono, `purge_after` conserva trenta giorni dal downgrade. Gli ordini dei negozi
esclusi restano non consultabili e vengono eliminati trenta giorni dopo la pausa. Un
termine non si allunga mai: la grace non rinvia eliminazioni già dovute o richieste.

Una copertura revocata dopo un rimborso totale o una disputa persa conta come finita
all'istante della revoca: il downgrade parte allora e gli ordini sbloccati soltanto da
quella copertura tornano bloccati, mentre gli sblocchi del ciclo Free e quelli di
un'altra copertura restano.

Il riallineamento parte dal cron ogni dieci minuti, prima dello smistamento delle
letture, a ogni pagina dell'area riservata e al collegamento di un negozio, quindi le
letture dell'utente lo trovano già applicato anche prima della pulizia. Il cron rivede
i termini degli ordini soltanto per gli spazi la cui copertura è finita nell'ultima
settimana; le visite coprono gli altri. Il ritorno a Premium toglie le pause e rende
di nuovo consultabili gli ordini ancora presenti entro il loro termine; quelli già
eliminati non tornano, perché i marker ne impediscono il reimport. La Sandbox eBay,
disponibile soltanto sul test, resta fuori dal limite.

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
| Suggerimenti | Calcolati a ogni lettura dai valori correnti di ordini autorizzati e non scaduti, senza cache o copie persistenti; il piano Premium deve essere attivo. Identità stabile conservata soltanto sull'ordine. |
| Ricerca dedicata | Ancora da integrare: dovrà riusare il termine della fonte e il grant corrente, senza copie che ne prolunghino la vita. |
| Export | Generatori puri già presenti, senza file server o download autenticati: il percorso futuro deve rileggere autorizzazione e scadenza prima di generazione e download. |

Un restore deve riapplicare marker, limite di cancellazione e revoche successivi
allo snapshot prima di riaprire accessi e job, secondo il contratto recovery del
Master Plan. I test locali non provano l'erasure nelle copie native del provider.

<a id="identita-e-suggerimenti"></a>
## Identità e suggerimenti

`orders.buyer_eias_token` conserva il solo `Order.EIASToken` delle letture Trading
già previste. eBay lo documenta come stabile anche dopo il cambio dello username
([GetOrders](https://developer.ebay.com/Devzone/xml/docs/reference/ebay/GetOrders.html)).
Non è un token di accesso. Non vengono interrogati altri endpoint del buyer,
creati buyer globali o usati nome, username, email e indirizzo per collegare ordini.
Il campo non viene restituito al browser e viene eliminato con l'ordine. La sua
assenza nelle letture Fulfillment non cancella un'identità già acquisita; una
nuova identità autorevole invalida immediatamente il collegamento precedente.

Il suggerimento è riservato a Premium attivo, fra ordini dello stesso spazio e
ambiente eBay. Ogni fonte deve essere consultabile, non assorbita, ancora entro
retention e con diritto fiscale valido. Le fonti in pausa per piano sono escluse.
Si usa soltanto il valore fiscale corrente; la modifica, rimozione o cancellazione
della fonte cambia il risultato alla lettura successiva, anche senza pulizia fisica.
Il confronto riguarda identificativi dello stesso tipo e Paese, appartenenti al
buyer; per CF e P.IVA italiani si normalizzano gli alias e il Paese implicito.
Si sceglie il precedente per data dell'ordine, mai per importazione o sync.
Parità fra ordini e valori discordanti nell'ultima fonte non producono una scelta
arbitraria: quel gruppo resta senza valore e mostra l'ambiguità. Altri precedenti
discordanti dello stesso gruppo producono un avviso accanto al valore più recente.

Il suggerimento riporta ordine, data, negozio e fonte eBay e non cambia lo stato
fiscale dell'ordine corrente. Il modello IT/EN si può modificare e copiare nel
dettaglio dei dati mancanti, anche in Free. La modifica resta nel pannello aperto;
non salva dati fiscali e non invia messaggi. Le preferenze persistenti dei template
restano nel percorso Impostazioni previsto dal piano.
