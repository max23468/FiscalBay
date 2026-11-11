# Risposta di eBay sulla dismissione di GetOrders

## Decisioni

| ID | Ambito | Sintesi della scelta / motivazione | Provenienza | Stato / requisito completo |
|---|---|---|---|---|
| D334 | **Dismissione di `GetOrders` con la sola Fulfillment** | La sostituzione di Trading `GetOrders` usa soltanto Fulfillment, con gli scope attuali e senza nuovo consenso dei negozi: il CF resta da `getOrder`, gli ordini definitivi entrano senza provvisori da consolidare, le fatture combinate pagate fuori dal checkout eBay non si leggono più dopo lo spegnimento, cancellazioni eBay e acquirenti ricorrenti si abbinano per username con la rilettura di D319. Cambia D333 sul consenso: la 2.6 non chiede scope nuovi. Scartati: `sell.order.read` per avere `buyer.userId` dalla Order API GraphQL, perché richiede il nuovo consenso di tutti i negozi per chiudere soltanto il caso residuo di D319 e il supporto lo indica da uno schema interno; `sell.purchase.quote.read`, perché `PurchaseQuote` non è documentata per le fatture combinate già pagate. | Risposta del supporto sviluppatori eBay del 2026-11-11 al ticket del 2026-11-07; scelta owner del 2026-11-11 | Confermato · [Dossier](../docs/audits/2026-11-07-lacune-api-ebay/README.md#risposta-di-ebay) · [Roadmap](../docs/ROADMAP.md#versione-2-6) |
