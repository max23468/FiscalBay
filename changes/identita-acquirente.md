# Identità dell'acquirente e lacune delle API eBay

## Changelog

### Altre modifiche

- **Cancellazioni eBay degli acquirenti più affidabili.** Gli ordini che eBay non collega a un identificativo stabile dell'acquirente rileggono ogni settimana il suo nome utente, così una richiesta di cancellazione trova anche gli ordini più vecchi. Il dossier sulle lacune delle API eBay raccoglie le richieste da inviare a eBay.

## Decisioni

| ID | Ambito | Sintesi della scelta / motivazione | Provenienza | Stato / requisito completo |
|---|---|---|---|---|
| D319 | **Username degli acquirenti senza token eIAS** | Ogni ordine registra l'ultima lettura dello username dell'acquirente, all'import e a ogni variazione applicata. Gli ordini definitivi senza token eIAS, con marketplace e creati da meno di due anni, si rileggono da Fulfillment con `getOrders` per ID, fino a 50 per chiamata, quando l'ultima lettura ha più di una settimana, dopo il dettaglio e con una chiamata del budget della lettura periodica. Un'indisponibilità lascia il gruppo alla prossima lettura, un rifiuto o una risposta illeggibile lo segnano letto, la quota esaurita registra l'attesa di Fulfillment; nessuno di questi casi rende non riuscita la lettura del negozio. La rilettura riduce, non elimina, il caso di un acquirente che cambia username prima di cancellare l'account: lo chiude soltanto un identificativo immutabile negli ordini, chiesto a eBay nel dossier. | Il 2026-11-07 la misura in Production trova senza token eIAS 978 dei 1.100 ordini definitivi, tutti quelli oltre i novanta giorni e 87 fra trenta e novanta; l'owner chiede di registrare la lettura dello username e di rileggerlo periodicamente | Confermato · [Conservazione](../docs/engineering/DATA_RETENTION.md#cancellazione-ebay) · [Lacune delle API eBay](../docs/audits/2026-11-07-lacune-api-ebay/README.md#3-identità-immutabile-dellacquirente-negli-ordini) |
