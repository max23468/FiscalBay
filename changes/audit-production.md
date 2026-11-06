# Rilievi dell'audit Production

## Changelog

### Novità

#### Miglioramenti

- **Sincronizzazione dei negozi.** Dopo «Sincronizza ordini recenti» la pagina Negozi eBay mostra la lettura in corso e si aggiorna da sola con l'esito.
- **Ricerca con i filtri.** Dalla pagina Ordini la ricerca in alto tiene i filtri attivi, anche nei suggerimenti e nel numero dei risultati.
- **Esportazione più chiara.** Quando esporti dagli Ordini vedi quali filtri e quale ricerca compongono il file.

#### Correzioni

- **Suggerimenti dagli ordini precedenti.** Quando FiscalBay non può proporre un Codice Fiscale da un ordine precedente, il dettaglio dell'ordine spiega il motivo in parole semplici.
- **Numeri più leggibili.** Il numero degli ordini usa il separatore delle migliaia, per esempio 1.094.

### What's new

#### Improvements

- **Store sync.** After “Sync recent orders” the eBay stores page shows the read in progress and updates by itself with the result.
- **Search with filters.** From the Orders page the search at the top keeps the active filters, in suggestions and in the result count too.
- **Clearer export.** When you export from Orders you see which filters and search make up the file.

#### Fixes

- **Suggestions from previous orders.** When FiscalBay cannot suggest a tax code from a previous order, the order details explain why in plain words.
- **Easier-to-read numbers.** Order counts use a thousands separator, for example 1,094.

### Altre modifiche

- **Prezzi.** Chi ha già Premium a vita vede il piano attivo al posto delle offerte, e i pulsanti dei tre piani stanno alla stessa altezza.

## Decisioni

| ID | Ambito | Sintesi della scelta / motivazione | Provenienza | Stato / requisito completo |
|---|---|---|---|---|
| D308 | **Scelte dell'audit Production** | La ricerca della barra avviata dagli Ordini conserva i loro filtri, anche nei suggerimenti e nel conteggio; da altre pagine parte senza filtri. Prezzi mostra a chi ha già Premium a vita il piano attivo al posto delle offerte. La notifica dei nuovi Termini resta eliminabile come le altre: il richiamo da accettare resta in Dati e privacy. Web Analytics usa un sito per host senza inserimento automatico, perché il sito legato alla zona inserirebbe lo snippet di Cloudflare anche in accesso e area. | Il 2026-11-06 l'owner sceglie le proposte sui rilievi AP3, AP4, AP7 e AP8 dell'audit Production | Confermato · [Ordini](../docs/product/ORDERS_AND_SYNC.md) · [Audit Production](../docs/audits/2026-11-06-audit-ui-ux-production.md) |
