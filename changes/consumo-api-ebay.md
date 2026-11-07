# Consumo delle API eBay

## Changelog

### Altre modifiche

- **Meno chiamate a eBay.** I negozi senza fatture combinate dal venditore rileggono Trading ogni sei ore anziché ogni due, i dati fiscali Trading si chiedono a gruppi e non si ripetono per un ordine già pagato, e i negozi di uno spazio che nessuno segue si leggono ogni due ore. Gli ordini nuovi continuano ad arrivare subito con l'avviso di eBay.

## Decisioni

| ID | Ambito | Sintesi della scelta / motivazione | Provenienza | Stato / requisito completo |
|---|---|---|---|---|
| D319 | **Application Growth Check solo quando serve** | Il keyset Production `botCF` è usato soltanto da FiscalBay, ma test e Production ne condividono le quote: l'Application Growth Check si completa soltanto quando il 70% di una quota nasce dalle letture dei negozi Production. Per arrivarci il più tardi possibile: passata Trading ogni due ore per un negozio con una fattura combinata senza checkout eBay creata negli ultimi trenta giorni, ogni sei ore per gli altri, ogni dodici per uno spazio senza sessioni aperte né Telegram collegato, che legge Fulfillment ogni due ore con qualunque piano; fallback fiscale Trading in lotti fino a 100 ordini, non ripetuto dopo una risposta riuscita e autorevole successiva alla versione o su un ordine pagato; letture fiscali e immagini degli ordini creati da più di sette giorni ferme a metà della quota fino all'azzeramento; chiamate contate per Worker e giorno e mostrate in console accanto al consumo del keyset; il test ne usa al massimo il 10%. Supera D177 per la cadenza Trading e RE-01 nella parte che chiedeva il Growth Check senza attendere la soglia. | Il 2026-11-07 l'owner chiede di arrivare al Growth Check soltanto quando è davvero necessario e approva tutte le proposte. Lettura del codice dello stesso giorno: la passata Trading ogni due ore valeva 12 delle circa 15 `GetOrders` giornaliere per negozio del caso di riferimento, il dettaglio rileggeva con una chiamata per ordine dati fiscali già arrivati con la passata, e un'importazione Pro poteva consumare in un giorno migliaia di `GetItem` | Confermato · [Requisito](../docs/product/ORDERS_AND_SYNC.md#s11) · [Capacità](../docs/operations/CAPACITY.md#capacita) |
