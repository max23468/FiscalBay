# Provenienza degli iscritti

## Changelog

### Altre modifiche

- Alla creazione dell'account si salvano la categoria del canale da cui si è arrivati sul sito e la prima pagina vista, senza cookie né dati salvati nel browser; la console ne mostra gli aggregati e l'esportazione dei dati dell'account li include.

## Decisioni

| ID | Ambito | Sintesi della scelta / motivazione | Provenienza | Stato / requisito completo |
|---|---|---|---|---|
| D303 | **Provenienza degli iscritti lato server** | Il Worker ricava la categoria del canale di arrivo dal Referer delle pagine pubbliche, che con `strict-origin-when-cross-origin` porta la sola origine, o da un'etichetta di un elenco chiuso nel parametro `via` dei link che pubblichiamo, che vale di più. Categoria e percorso della prima pagina viaggiano nei link interni fino all'accesso e si salvano sull'account una volta sola alla creazione, con password, Google o eBay; i provider la portano nello state firmato di Better Auth. Senza segnale «unknown», mai una stima. Nessun cookie, archivio del browser o banner; canonical, sitemap e dati strutturati invariati. La console mostra soltanto aggregati per categoria; il dato entra nell'esportazione dell'account e si cancella con l'utente. Scartati: Google Analytics, per cookie e banner; la domanda «Come ci hai conosciuto?», per la risposta manuale; i soli aggregati di Web Analytics, non collegabili alle iscrizioni. | Scelta owner del 2026-11-04 | Confermato · [Roadmap](../docs/ROADMAP.md#2-0-04) · [§15](../docs/product/CHANNELS_AND_ADMIN.md#s15) |
