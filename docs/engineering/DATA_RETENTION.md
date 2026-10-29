# Conservazione degli ordini

`orders.retention_until` è il termine esclusivo di consultazione e aggiornamento;
`purge_after` è il termine di cancellazione fisica. Le date sono UTC canoniche con
millisecondi. Il termine parte dalla creazione dell'ordine, mai dalla lettura o
dall'ultimo aggiornamento, e segue la finestra dello spazio
(`app/domain/history-window.server.ts`): trenta giorni nel Free, un anno calendariale
con una copertura in corso (Premium, prova, lifetime o concessa), fino a ventiquattro
mesi con un'estensione concessa. La stessa finestra fissa l'inizio dello storico da
importare. Una pausa o uno scollegamento non fermano il tempo. Il modello non deduce
un piano attivo dalla presenza di un vecchio grant Premium, trial o lifetime: vale la
copertura in corso.

Un'estensione oltre l'anno è una riga `history_extensions` con mesi, motivo e autore,
registrata dopo la verifica del periodo recuperabile e il consenso. Vale soltanto con
una copertura in corso; la revoca riporta la finestra a un anno e gli ordini che la
superano seguono la regola del downgrade.

<a id="downgrade"></a>
## Downgrade al Free

Senza una copertura in corso lo spazio ha un solo negozio eBay attivo, registrato in
`free_store_changes`; gli altri ricevono la pausa `plan`, che ferma le letture e
nasconde i dati. Nella stessa operazione gli ordini tornano alla finestra Free: il
termine di accesso diventa trenta giorni dalla data dell'ordine e, per gli ordini che
la perdono, `purge_after` conserva trenta giorni dal downgrade. Gli ordini dei negozi
esclusi restano non consultabili e vengono eliminati trenta giorni dopo la pausa. La
grace non rinvia eliminazioni già dovute o richieste, e un termine si allunga soltanto
con il ritorno a una copertura.

Una copertura revocata dopo un rimborso totale o una disputa persa conta come finita
all'istante della revoca: il downgrade parte allora e gli ordini sbloccati soltanto da
quella copertura tornano bloccati, mentre gli sblocchi del ciclo Free e quelli di
un'altra copertura restano.

Il riallineamento parte dal cron ogni dieci minuti, prima dello smistamento delle
letture, a ogni pagina dell'area riservata e al collegamento di un negozio, quindi le
letture dell'utente lo trovano già applicato anche prima della pulizia. Il cron rivede
i termini degli ordini per gli spazi la cui copertura è finita o la cui estensione è
cambiata nell'ultima settimana, e per quelli che perderebbero entro un giorno un
ordine ancora dentro la finestra della copertura; le visite coprono gli altri. Il
ritorno a Premium toglie le pause e riporta all'intera finestra della copertura il
termine degli ordini ancora conservati, anche durante i trenta giorni transitori;
quelli già eliminati non tornano, perché i marker ne impediscono il reimport anche
dallo storico più ampio importato dopo l'attivazione. La Sandbox eBay, disponibile
soltanto sul test, resta fuori dal limite.

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

<a id="copie-derivate"></a>
## Copie derivate e lavori pendenti

| Superficie attuale | Contenuto e cancellazione |
|---|---|
| Risposte eBay e body webhook | Solo memoria della richiesta, nessun raw persistito: nessuna copia può superare le 24 ore o sopravvivere a un retry. |
| Ricevute webhook | Riferimenti tecnici minimizzati, negozio, consenso, oggetto e date; scadenza propria di sette giorni, verificata anche prima della pulizia. Nessun body o dato fiscale. |
| Ricevute del bot Telegram | Soltanto aggiornamenti di una chat privata: identificativi di aggiornamento, chat e messaggio, nome del comando o dati del pulsante e, per `/start`, impronta del token di collegamento, con la scadenza di sette giorni delle altre ricevute. Mai il testo del messaggio, il token o i dati del profilo Telegram. |
| Stato e consegne Telegram | Per ogni ordine valutato, il collegamento e l'impronta SHA-256 dei valori fiscali notificati, mai i valori: si eliminano con l'ordine. Le consegne portano soltanto identificativi e stato, perché il testo si compone all'invio; si eliminano sette giorni dopo l'invio o il fallimento, comunque dopo 30 giorni. |
| Collegamento Telegram | Richiesta con l'impronta del token, legata a spazio, utente e sessione: la chiusura della sessione o dello spazio la elimina, la pulizia giornaliera un giorno dopo la scadenza di 15 minuti. Una sola chat per spazio con il nome mostrato da Telegram, sostituita dal cambio di chat; preferenze e scelte per negozio seguono lo spazio e il negozio. |
| Sessione di acquisto aperta | Per spazio, il riferimento alla sessione Checkout di mensile o annuale e la sua scadenza di un'ora: si elimina due giorni dopo la scadenza o con lo spazio. |
| Queue e recupero ingressi | ID della ricevuta, ID del negozio, nome e turno del compito oppure ID del lavoro di esportazione. Ogni consegna rilegge lo stato corrente; non trasporta snapshot buyer o CF. |
| Checkpoint e letture sync | Cursori, date, contatori ed esiti minimizzati; nessun ordine o identificativo fiscale serializzato. |
| Buyer e storico fiscale | Legati all'ordine tramite FK, senza anagrafica globale o snapshot indipendente. |
| Elenco, dettaglio e conteggi | Filtro server sulla scadenza, applicato prima di limite e risposta; i valori revocati non entrano nella risposta. |
| Suggerimenti | Calcolati a ogni lettura dai valori correnti di ordini autorizzati e non scaduti, senza cache o copie persistenti; il piano Premium deve essere attivo. Identità stabile conservata soltanto sull'ordine. |
| Ricerca | Stesso filtro dell'elenco sul termine della fonte e sul grant corrente all'istante della richiesta; il testo cercabile vive sull'ordine e si elimina con esso. |
| Richieste di assistenza | Testo, argomento e riepilogo diagnostico allowlistato (versione, riferimento interno del negozio, fase ed esito della lettura, codice errore, diritti, correlation ID) vanno soltanto alla casella `supporto@` con Reply-To sull'utente; nessun CF, token, payload, nome eBay o dato di un altro spazio. D1 conserva l'istante di invio per il limite di cinque richieste per account, eliminato dopo 24 ore. Nella casella iCloud le conversazioni restano 24 mesi dall'ultima risposta, poi l'owner le elimina (D230). |
| Verifica Turnstile | Il token del modulo va a Siteverify con l'IP della richiesta e non si conserva: D1 non registra né token né esito, il modulo che torna dopo un errore lo esclude dai valori da ricompilare. Un guasto di Siteverify lascia nei log soltanto codice, operazione `turnstile`, tipo di guasto e stato HTTP. Widget e segnali del browser restano presso Cloudflare secondo le sue condizioni (D231). |
| Export | Il CSV e l'XLSX degli ordini si creano a ogni richiesta autenticata, o dal lavoro in coda oltre 2.000 ordini, con lo stesso filtro dell'elenco su negozi, scadenza e grant all'istante della generazione. Il file sta nel bucket R2 UE con chiave casuale e vale al più 24 ore, non oltre la copertura Premium che lo permette né oltre il primo termine di conservazione o di sblocco degli ordini inclusi; una revoca dello spazio lo nega subito, la pulizia oraria elimina byte e righe, la regola a un giorno del bucket resta la rete di sicurezza. Il lavoro conserva ambito e opzioni cifrati soltanto finché non si conclude e si elimina 24 ore dopo la richiesta. Lo ZIP dei dati dell'account segue le stesse regole e non contiene ordini, segreti o documenti di pagamento. Le configurazioni salvate contengono soltanto nome, formato, granularità e colonne, nessun ordine o valore fiscale, e si eliminano con l'account. |
| Accesso tecnico alla console | Soltanto l'impronta SHA-256 del token, con etichetta, creazione, revoca e ultimo uso; il token resta nella custodia dell'owner. Le letture con il token entrano nel registro della console e ne seguono la conservazione. |
| Metriche della console | Per spazio, il nome e l'istante del primo di ciascun passaggio del funnel, senza ordini, buyer, valori fiscali o identificativi eBay: escono con lo spazio. Le letture sono conteggi giornalieri di tutti i negozi, eliminati dopo novanta giorni. I report del browser lasciano soltanto il nonce del biglietto, eliminato dopo la scadenza di quindici minuti. |
| Cancellazione dell'account | La richiesta conserva utente e spazio come identificativi, gli istanti dei passi e, cifrati fino all'invio dell'email finale, indirizzo e lingua. Conclusa, resta come marker per un restore e si elimina dopo 30 giorni, la finestra di Time Travel. Lo spazio con abbonamenti e sessioni di acquisto resta soltanto finché Stripe non conferma lo stop dei rinnovi. |
| Segno dei negozi | Dopo la cancellazione dello spazio, per ogni negozio l'impronta SHA-256 dell'identità eBay, la prova già usata e il ciclo Free in corso con quota e sblocchi. Il segno della prova dura due anni (D220), quello del ciclo fino alla sua fine; nessun nome, ordine o dato fiscale. La cancellazione dell'account eBay richiesta da eBay lo elimina subito: quell'identità non può più collegarsi. |
| Cancellazione richiesta da eBay | La notifica `MARKETPLACE_ACCOUNT_DELETION`, firmata, lascia una richiesta soltanto se FiscalBay conserva dati dell'utente nell'ambiente: negozio, segno, accesso con eBay o ordini da acquirente. La richiesta porta identificativo, token eIAS e username comunicati da eBay, con gli istanti dei passi; conclusa, resta come marker per un restore e si elimina dopo 30 giorni. Le notifiche di utenti sconosciuti non lasciano righe, ricevute o log con l'identità. |
| Console amministrativa | Il registro delle operazioni porta autore, operazione, oggetto, motivo ed esito, mai dati dei buyer o valori fiscali, non si modifica e si elimina un anno dopo l'operazione. Comunicazioni di servizio e anomalie chiuse si eliminano un anno dopo la fine; una preparazione di trasferimento mai confermata con la pulizia dopo la scadenza, una eseguita dopo un anno. Le revisioni antiabuso conservano un'impronta della chiave del segnale, non il valore condiviso. |
| Log del Worker | Workers Logs conserva sette giorni ogni invocazione con indirizzo completo, IP, browser e posizione approssimativa della richiesta, senza il cookie di sessione; i codici monouso nell'indirizzo sono già consumati (D230); l'[archivio](RELEASE.md#archivio-log) a 90 giorni è un bucket R2 UE per ambiente, senza binding o accesso pubblico, con istante, tipo ed esito dell'invocazione, versione, CPU, durata ed eventi applicativi da elenchi chiusi (codice errore, operazione, correlation ID, fase, conteggi). Mai URL, header, testo delle eccezioni, email, dati dei buyer o valori fiscali. La regola del bucket elimina gli oggetti dopo 90 giorni. |
| Incidenti comunicati all'owner | Una riga per anomalia P1 o P2 con tipo, gravità, istanti, conteggio e al più cinque etichette di negozi, lavori, provider o interruttori, l'ultimo stato comunicato su Telegram e l'ultimo copiato per email a `info@`; mai dati dei buyer, email o valori fiscali. Si elimina un anno dopo il rientro comunicato, come le anomalie chiuse. |
| Avvisi commerciali all'owner | Una riga per fatto commerciale (registrazione, ammissione, primo negozio, prova, acquisto, disdetta, rinnovo non pagato, chiusura, rimborso, disputa, cancellazione finanziaria, posti lifetime, cancellazione dell'account) con la chiave del fatto, lo spazio, piano, importi, istanti e stato dell'invio; mai email, nomi, dati dei buyer o valori fiscali. Gli avvisi di uno spazio escono con lo spazio e quelli con l'identificativo dell'utente con l'utente; resta l'avviso della cancellazione dell'account, senza spazio. La pulizia giornaliera li elimina 30 giorni dopo il fatto. |
| Registro delle scadenze | Nomi logici delle credenziali dell'ambiente e date di scadenza, copiati dall'inventario privato con `scripts/credential-expiries.mjs`; mai valori o riferimenti di custodia. Ogni copia sostituisce la precedente. |

Un restore deve riapplicare marker, limite di cancellazione e revoche successivi
allo snapshot prima di riaprire accessi e job, secondo il contratto recovery del
Master Plan. Le righe di `account_deletions` successive allo snapshot sono i marker
delle cancellazioni dell'account: riapplicate, bloccano l'accesso e il compito
periodico riapre quelle concluse il cui utente o spazio è ricomparso, ripetendo la
cancellazione senza una seconda email. Allo stesso modo le righe di
`ebay_account_deletions` riaprono la cancellazione richiesta da eBay quando negozio,
accesso con eBay o ordini dell'utente ricompaiono. I test locali non provano
l'erasure nelle copie native del provider.

<a id="cancellazione-ebay"></a>
## Cancellazione richiesta da eBay

eBay invia la notifica di cancellazione per ogni suo utente eliminato, venditore o
acquirente, all'endpoint del keyset: FiscalBay la riceve dall'ingresso dei webhook
(`/webhooks/ebay` e `/webhooks/ebay/sandbox`), con la stessa verifica dell'endpoint,
firma, limite di dimensione e budget delle chiavi pubbliche delle altre notifiche
eBay; la firma usa il digest che eBay dichiara per la chiave, SHA-1 per queste
notifiche e SHA-256 per quelle della Notification API. Prima di leggere il corpo un limite di 600 consegne al minuto per origine, con
al più mille origini seguite per isolate, risponde 429 e lascia la consegna ai
tentativi di eBay. La risposta positiva arriva soltanto dopo che la richiesta è
registrata e accettata dalla coda; altrimenti 503 e il compito periodico riprende la
richiesta. Non si applica l'esenzione per chi non conserva dati eBay.

Per il venditore il lavoro elimina, nell'ambiente della notifica, consenso, ricevute,
ordini con le copie dipendenti, letture, pause, marker degli ordini, preferenze e
consegne Telegram, trasferimenti non eseguiti, segno del negozio e accesso con eBay;
la riga del negozio resta senza identità eBay né profilo, con i dati eliminati, per
le righe commerciali che la citano (scelta del negozio Free, trasferimenti eseguiti).
Per l'acquirente elimina in ogni negozio dell'ambiente gli ordini con il suo token
eIAS e, per quelli che non lo riportano, con il suo username: è l'unico uso dello
username per trovare ordini. I marker di `deleted_order_keys` impediscono il reimport
da letture, conferme o ricevute già in coda. Restano i diritti commerciali minimi
dello spazio: quota del ciclo già usata, prova usata, coperture e posti lifetime,
nessuno dei quali porta l'identità eBay. L'utente FiscalBay e i suoi altri metodi di
accesso restano.

L'eliminazione è fisica nel database: nessuna `deleted=true` e nessuna chiave che
ricollega le righe all'utente eBay. Le copie native del provider (Time Travel per
30 giorni) restano fino alla loro scadenza; un restore riapplica le richieste come
descritto sopra. eBay ritenta finché la consegna non riceve 200, 201, 202 o 204
([S23](../SOURCES.md#s23)). Il keyset `botCF`, usato soltanto da FiscalBay, ha un solo
endpoint per queste notifiche: fino al collaudo era quello della 1.x; il test lo riceve
ora su `https://test.fiscalbay.it/webhooks/ebay` e Production lo riceverà su
`https://fiscalbay.it/webhooks/ebay` al passaggio a Production.

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
