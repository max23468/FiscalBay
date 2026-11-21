# Demo pubblica

## Changelog

### Altre modifiche

- **Demo pubblica.** `/demo`, in inglese `/en/demo`, mostra Ordini e Negozi di FiscalBay con dati di esempio, senza registrarsi: ricerca, filtri e dettaglio funzionano, le azioni dicono che nella demo non si salva nulla e la barra «Demo con dati di esempio» porta a «Inizia gratis» con la provenienza della visita.
- **Inviti alla demo.** In home «Guarda la demo» prende il posto di «Come funziona»; ogni Guida, dopo «Come ti aiuta FiscalBay», ha un riquadro con la schermata degli Ordini, la prova Pro di 14 giorni senza carta, «Inizia gratis» e «Guarda la demo».

## Decisioni

| ID | Ambito | Sintesi della scelta / motivazione | Provenienza | Stato / requisito completo |
|---|---|---|---|---|
| D343 | **Demo pubblica** | Chi arriva sul sito, soprattutto dalle Guide, vede FiscalBay funzionare senza registrarsi. La demo riusa route e componenti dell'anteprima con uno scenario fisso (Pro, tre negozi, dati fiscali visibili), anche in Production, in italiano e inglese: Ordini e Negozi in sola consultazione, senza dati dei merchant, sessione, cookie o scritture, senza Impostazioni, esportazione e link a eBay; le azioni rispondono che nella demo non si salva nulla. È `noindex` e fuori dalla sitemap ma raggiungibile dai crawler, conta le visite come le pagine pubbliche e porta la provenienza ([D304](../docs/decisions/DECISION_REGISTER.md)) fino a «Inizia gratis». Precisa [D179](../docs/decisions/DECISION_REGISTER.md): l'anteprima con gli scenari a scelta resta esclusa da Production, perché mostrerebbe stati di errore e salvataggi simulati come riusciti. Home con «Guarda la demo» al posto di «Come funziona»; Guide con un riquadro dopo «Come ti aiuta FiscalBay», con «Accedi» lasciato alla barra. Scartati il nome `anteprima` per il pubblico e la demo con scenari a scelta. | Scelta owner del 2026-11-21 | Confermato · [Requisito](../docs/product/EXPERIENCE.md#s23) |
