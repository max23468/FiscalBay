# Versioni delle funzioni 2.x

## Decisioni

| ID | Ambito | Sintesi della scelta / motivazione | Provenienza | Stato / requisito completo |
|---|---|---|---|---|
| D333 | **Funzioni 2.x senza versione e 2.6** | Le aggiunte di D293 ricevono una versione: pagine pubbliche con meno JavaScript nella 2.1, come task proprio; comandi Telegram di ricerca, riepilogo della giornata ed export nella 2.2, perché riusano ricerca indicizzata e periodi dell'export della stessa versione; chat Tawk.to con la pagina Supporto nella 2.4, come aiuto a chi valuta FiscalBay. La dismissione di Trading `GetOrders` esce dalle correzioni 2.0.x e diventa la 2.6, insieme ai dati economici dell'ordine letti da Fulfillment, perché la migrazione sposta già le letture su Fulfillment e chiede scope e consenso nuovi in un solo passaggio. La 2.6 va in Production entro giugno 2027, prima dello spegnimento del 2027-06-30, lasciando ai negozi il tempo del nuovo consenso. Scartati: la sostituzione come 2.2 o dentro la 2.2 Ordini, i dati economici nella 2.2 o nella 2.3, la chat nella 2.1 e la riduzione del JavaScript come correzione. | Scelta owner del 2026-11-10 | Confermato · [§39](../docs/ROADMAP.md#s39) |
