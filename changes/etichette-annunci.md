# Provenienza dagli annunci

## Changelog

### Altre modifiche

- **Provenienza dagli annunci.** La provenienza degli iscritti riconosce le etichette `via=google_ads` e `via=meta_ads` nei link degli annunci a pagamento, che valgono più del Referer di Google o di Meta: la console mostra «Annunci Google» e «Annunci Meta» con iscritti, attivazioni e paganti. La tabella della provenienza si ricrea con il nuovo vincolo sulle categorie.

## Decisioni

| ID | Ambito | Sintesi della scelta / motivazione | Provenienza | Stato / requisito completo |
|---|---|---|---|---|
| D345 | **Provenienza dagli annunci** | Gli annunci a pagamento di Google e di Meta sono due categorie della provenienza degli iscritti (D304), `google_ads` e `meta_ads`, date soltanto dall'etichetta `via` nell'indirizzo di destinazione degli annunci. L'etichetta vale più del Referer, perché Google e Meta mandano la stessa origine per un annuncio e per un risultato di ricerca o un post, e il browser interno delle app spesso non ne manda alcuna. Nessun tag di conversione, pixel, banner o identificativo del clic (`gclid`, `fbclid`) letto o inviato alle piattaforme. Il vincolo della tabella si cambia ricreandola, come per la 0080: una colonna aggiunta per gli annunci avrebbe evitato la migration non additiva ma diviso la categoria chiusa in due campi da ricomporre in ogni lettura. La Privacy `2026-11-05` copre già le etichette dei nostri link e le categorie per esempio, quindi resta invariata. | Il 2026-11-21 l'owner apre la valutazione di Google Ads e Meta Ads, misurata senza tag di conversione, pixel o banner dei cookie | Confermato · [Roadmap](../docs/ROADMAP.md#2-0-17) · [§15](../docs/product/CHANNELS_AND_ADMIN.md#s15) |
