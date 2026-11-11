# Revisione della repository

## Changelog

### Altre modifiche

- **Letture più regolari.** Un ordine che eBay restituisce in forma non valida non ferma più la lettura del negozio, e un ordine in attesa della quota di eBay risulta in verifica invece che non riuscito.
- **Eliminazione dei dati del negozio.** «Elimina negozio» rimuove gli ordini a lotti, anche per i negozi più grandi, insieme alle preferenze e alle consegne Telegram del negozio.
- **Notifiche Telegram.** Con il riepilogo giornaliero il messaggio di importazione completata parte subito, senza attendere il riepilogo successivo.
- **Lingua delle email.** Il preavviso di inattività e l'avviso di sicurezza arrivano nella lingua scelta nelle Impostazioni.
- **Accesso.** I tentativi ripetuti di accesso con password sono limitati allo stesso modo anche fuori dal modulo.

## Decisioni

| ID | Ambito | Sintesi della scelta / motivazione | Provenienza | Stato / requisito completo |
|---|---|---|---|---|
| D335 | **PayPal soltanto attraverso Stripe** | PayPal entra tra i metodi di pagamento soltanto se è disponibile attraverso Stripe, senza aprire un account PayPal dedicato. Precisa D039, che lo lasciava condizionale al supporto del provider e non necessario per la 2.0, ormai pubblicata. Scartato: un account PayPal dedicato accanto a Stripe. | Scelta owner del 2026-11-11 | Confermato · [Requisito](../docs/product/PLANS_AND_BILLING.md#s06) |
