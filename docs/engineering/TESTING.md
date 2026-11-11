# FiscalBay · Test

Completezza, prove e strategia di test.

## Completezza e prove

Una funzione è completa quando comportamento, permessi, persistenza, errori, IT/EN, responsive, test e documentazione pertinenti coincidono. Una schermata o un HTTP 200 non bastano. Indicare ambito della prova (documentale, sintetico, sandbox, reale autorizzato) ed esito (non eseguito, passato, parziale, bloccato o non applicabile motivato). Non simulare come riuscito ciò che il sandbox non consente di osservare; assegnare la prova residua al gate competente.

Una prova breve, un test o il log CI pertinenti possono bastare: non serve una ricevuta documentale per ogni comando. Dati sensibili su account, quote residue, chiavi e anti-abuso restano nella custodia privata del setup; requisiti e prove sanificate possono essere pubblici. Le protezioni devono funzionare anche se il codice è visibile.

<a id="s35"></a>
## 35. Strategia di test e criteri osservabili

Vitest per dominio, integrazioni e risposte delle route; Playwright per componenti e flussi nel browser; axe come aiuto, non certificazione. Chromium e WebKit sui flussi principali e prima delle release; nessun collaudo Firefox dedicato (D156). Viewport desktop/mobile più prova reale su Safari/iOS e un browser mobile rappresentativo quando disponibile: emulazione non dimostra comportamento passkey/clipboard/download su dispositivo. Fixture sintetiche o sanitizzate, accesso live controllato quando necessario.

| Suite critica | Casi minimi bloccanti |
|---|---|
| Sblocco | Assente/errore/locked/unlocked; due richieste simultanee; ultimo credito; CF+P.IVA; dato incoerente; quota finita; perdita risposta |
| Cicli | 7×24h, timezone/DST, evento nella prima notte del ciclo con fuso a est e a ovest di UTC, promo finita nel ciclo, reconnect/sostituzione senza reset, storico+nuovo stesso contatore |
| Diritti | Trial volontario, acquisto mensile/annuale durante la prova con primo addebito alla sua fine, senza doppio incasso, scadenza, omaggi, lifetime, refund per grant, grandfathering e switch |
| Downgrade | Dati Pro mai aperti; primo ID arrivato dopo; 30 giorni/negozio; grace retention e riacquisto; first connected default |
| Auth | 4 login, linking attendibile, email non verificata, ultimo metodo, MFA admin, reauth, revoca sessioni, OAuth error/replay |
| Isolamento | IDOR su query/dettagli/export/file/admin, CF locked non deducibile da search/count/cache/URL |
| eBay | Paging, overlap, checkpoint, versioni tardive, mascheramento vs rimozione, pagato/non pagato, conflitti fonti, quote condivise, ordine combinato con ID nuovo senza doppia quota, `next` fuori origine, XML con DOCTYPE o oltre limite, omesso vs `null` senza nuova versione |
| Jobs | Deduplica, retry budget, lease scaduta, riavvio, starvation, backfill con nuovo ordine, manuale coalesced, cancellazione durante esecuzione |
| Telegram | Solo fiscali vs tutti, verifica pendente, digest/daylight saving, backlog tecnico vs opt-out, chat sostituita, bot bloccato, escaper |
| Export | Ordine/articolo, zeri iniziali, valute, CSV injection, file grandi, autorizzazione cambiata dopo creazione, scadenza 24h |
| Privacy | Raw 24h, logs 90d/audit1y, erasure buyer/account/negozio, consensi, restore senza resuscitare dati o token |
| Commerciale | Checkout duplicati, lifetime ultimo posto, webhook tardivo/duplicato/out-of-order, ricevute, Link disdetta, metodi/costi, Paesi coperti |
| UI | Due card/una, drawer URL/back/scroll, filtri/persistenza, form errori, light/dark/IT-EN, ridotta motion, tastiera/touch, safe public navigation |

Coverage come segnale, non obiettivo arbitrario 90%. Ogni bug rilevante riceve regression test. Non abbassare validazioni per far passare fixture. Dataset di qualifica da almeno 70.000 ordini più relazioni e scenari multi-negozio; test non inviato integralmente alle API reali. Rate budget calcolato e prove live contenute.

La copertura Vitest usa Istanbul nelle suite Node e Cloudflare e include anche i sorgenti applicativi e Worker mai eseguiti; test browser e script operativi Node restano fuori dal report. I benchmark, eseguiti a richiesta, misurano normalizzazione eBay, qualità formale degli identificativi, importi ed export sintetici di 100, 1.000 e 5.000 ordini. Questi campioni non sostituiscono le prove di capacità e carico previste. Le dipendenze sono solo di sviluppo. Adozione dei tre strumenti approvata dall'owner il 2026-10-16.

Mantenere scenari sintetici riusati da test di dominio e prove UI: CF assente, bloccato, formalmente invalido o con omocodia, quota esaurita, fonte in errore, dato modificato e suggerimenti discordanti. Le prove formali non certificano l'identità. Gli scenari vivono nei test o in superfici di sviluppo/test non disponibili in Production; nessuna demo mischiata agli ordini reali, nessun simulatore pubblico aggiunto allo scope.

L'anteprima resta disponibile sul test come riferimento visivo dell'area reale e per verificare graficamente stati rari, errori e superfici non raggiungibili con l'account corrente (D176, D179). Usa gli stessi componenti di prodotto, alimentati da scenari sintetici separati dai dati effettivi, con selezione degli stati e verifica IT/EN, temi e responsive. Ogni nuovo stato approvato entra negli scenari nello stesso task che lo realizza; il task non si chiude se area reale e anteprima divergono. L'anteprima rimane esclusa dalla Production: route, loader e azioni rispondono 404 anche con richieste dirette. Un elemento che il piano non prevede si elimina, senza trasformarlo in un nuovo requisito.

Ogni task aggiunge o trasferisce le prove funzionali sulle route reali, riusando componenti e fixture utili, e rimuove viste provvisorie, componenti duplicati e codice senza consumatori. Le azioni simulate e il cookie dell'anteprima restano confinati ai dati sintetici: non attestano persistenza, permessi, quota o funzionamento dei provider. Nessun salvataggio simulato viene presentato come riuscito nell'app reale.

Per le prove dei percorsi reali riusare fixture D1 e sessioni sintetiche locali, attraversando loader e azioni applicative senza bypass Auth. Ritardi, indisponibilità, risposta persa e clipboard negata si riproducono con gli strumenti di test esistenti; le prove della sola risposta UI restano distinte da quelle degli effetti server. Usare date coerenti nelle fixture e tempo controllato nei test di dominio. Conservare catalogo pagine, prove IT/EN, chiaro/scuro, smartphone/tablet/desktop, tastiera, focus, contrasto e movimento ridotto sui percorsi reali, oltre alle prove grafiche nell'anteprima. Le verifiche su dispositivi e provider reali restano ai gate competenti. Nessun secondo simulatore o nuova infrastruttura dedicata.

La baseline visiva e le prove trasferite si verificano con l'interfaccia; l'anteprima resta sul test, esclusa dalla Production. Restano i componenti di prodotto, le fixture riusabili, l'anteprima tabellare dell'export e il server locale della build.

Mutation test mirati verificano che i test intercettino errori su ultimo credito, isolamento degli spazi, scadenza dei grant e revoca del grant rimborsato. Qualificare e fissare il tool di sviluppo compatibile con la toolchain scelta quando viene introdotto; nessuna nuova dipendenza runtime. La campagna settimanale su `develop` prova tutti i domini critici e il candidato i moduli critici modificati, mentre i moduli che li importano restano alla campagna ([D330](../decisions/DECISION_REGISTER.md)); mutanti non equivalenti sopravvissuti sulle invarianti critiche richiedono correzione, timeout/errori non valgono come esito verde. Motivare eventuali equivalenze, senza percentuali arbitrarie o campagne sull'intera applicazione a ogni modifica.

P1/P2 aperti bloccano il rilascio. P3 richiede accettazione esplicita, scope circoscritto e prova che non comprometta dati, sicurezza, billing o core. DoD task = codice, test, documentazione necessaria e comportamento coerenti.

**Regressioni trasversali da coprire.** Sessione precedente al logout riusata direttamente su route dell'app, `/api/v1` e file esportati; lettura privilegiata di console, job o export che aggira l'isolamento degli spazi; cancellazione durante generazione/download export; CSV aperto/importato con diversi comportamenti di tipizzazione; ordine con più righe e più identificativi senza prodotto cartesiano; conflitti fiscali di tipo diverso; Link deletion e oggetto provider non più disponibile; incasso lifetime tardivo dopo scadenza apparente della prenotazione; ripristino di uno snapshot antecedente a una cancellazione; redirect autenticato servito erroneamente a un anonimo; ripresa di Promuovi dopo deploy riuscito e tag fallito.

Ogni prova Stripe distingue i casi simulabili da quelli osservabili soltanto sul percorso live. Un test sintetico del nostro handler può provare la sua logica, non che Stripe emetta realmente quel payload/canale nell’account scelto.
