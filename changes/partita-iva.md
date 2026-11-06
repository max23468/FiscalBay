# Partita IVA con il suo nome

## Changelog

### Novità

#### Correzioni

- **Partita IVA con il suo nome.** Quando l'acquirente scrive la Partita IVA nel campo del Codice Fiscale, FiscalBay la chiama Partita IVA negli ordini, nell'export e su Telegram, dove si copia con un tocco e dà il titolo alla notifica.
- **Nomi più chiari.** Filtri, export, prova e bot nominano Codice Fiscale e Partita IVA quando valgono per entrambi, e le etichette di controllo dicono se riguardano il CF o la P. IVA.

### What's new

#### Fixes

- **VAT numbers named correctly.** When the buyer enters a VAT number (Partita IVA) in the tax code (Codice Fiscale) field, FiscalBay calls it a VAT number in orders, exports and Telegram, where you can copy it with one tap and it titles the notification.
- **Clearer names.** Filters, exports, the trial and the bot mention both the tax code and the VAT number when they apply to both, and check labels say which one they refer to. In English, app, site and guides use “tax code” and “VAT number”.

## Decisioni

| ID | Ambito | Sintesi della scelta / motivazione | Provenienza | Stato / requisito completo |
|---|---|---|---|---|
| D307 | **Nomi del Codice Fiscale e della Partita IVA** | Il nome segue il valore: undici cifre che non iniziano per 8 o 9 sono una Partita IVA anche con tipo `CODICE_FISCALE`, e così etichette di controllo, conflitti e titoli delle notifiche. «Codice Fiscale» resta il termine principale; i testi che valgono per entrambi dicono «Codice Fiscale o Partita IVA»; iniziali sempre maiuscole, salvo «Codici fiscali esteri»; abbreviazioni «CF» e «P. IVA» negli spazi stretti e nelle ripetizioni; nessun «dato fiscale», «identificativo fiscale» o aggettivo «fiscale» in altre espressioni. In inglese si traduce, «tax code» e «VAT number», con «tax code (Codice Fiscale)» alla prima menzione nei testi non tecnici, titoli delle pagine pubbliche compresi, e «Italian tax code (Codice Fiscale)» per l'acquirente. Termini, Privacy e console esclusi. Supera la regola inglese del 2026-11-03 e le etichette di D178. | Il 2026-11-03 l'owner segnala Partite IVA mostrate come Codice Fiscale (19 su circa 950 identificativi in Production); regola definita con l'owner caso per caso il 2026-11-03 e il 2026-11-06 | Confermato · [Design system](../docs/brand/DESIGN_SYSTEM.md) · [Ordini](../docs/product/ORDERS_AND_SYNC.md#s09) |
