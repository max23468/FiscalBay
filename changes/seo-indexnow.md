# FAQ, dati strutturati e IndexNow

## Decisioni

| ID | Ambito | Sintesi della scelta / motivazione | Provenienza | Stato / requisito completo |
|---|---|---|---|---|
| D312 | **Ricerche reali, Bing e IndexNow** | La FAQ risponde anche alle ricerche dei venditori su dove trovare il Codice Fiscale dell'acquirente, sull'export in Excel e sui nuovi ordini su Telegram. L'organizzazione nei dati strutturati porta descrizione e bot Telegram. Bing importa il sito da Search Console e, dopo una promozione che cambia pagine pubbliche, `scripts/indexnow.mjs` invia a IndexNow le pagine della sitemap: Crawler Hints non serve, perché le pagine escono dal Worker senza passare dalla cache. La pagina di stato della 2.1 resta fuori dall'indice e dalla sitemap. Nessun dato dei visitatori a nuovi fornitori, come in D242. | Revisione delle proposte SEO con l'owner del 2026-11-03 | Confermato · [Requisito](../docs/product/EXPERIENCE.md#s23) · [Statistiche del sito](../docs/operations/OBSERVABILITY.md#statistiche-sito) |
