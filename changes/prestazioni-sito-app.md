# Prestazioni del sito e dell'area riservata

## Changelog

### Novità

#### Miglioramenti

- **Pagine più rapide.** Ordini, Negozi e Impostazioni si aprono più velocemente e il sito si carica prima quando ci torni.

### What's new

#### Improvements

- **Faster pages.** Orders, Stores and Settings open more quickly, and the site loads sooner when you come back.

### Altre modifiche

- **Caricamento e letture più leggeri.** Font e testi partono con il documento, le schermate del sito restano nella cache del browser, le Impostazioni portano subito soltanto la categoria aperta e il codice di una pagina si prepara al passaggio sul suo link. L'apertura di una pagina dell'area riservata fa meno letture e scritture sul database.
- **Core Web Vitals reali.** I report del browser di Ordini e Negozi aggiungono INP e CLS, che la console mostra accanto a LCP. La build rifiuta la perdita della cache permanente degli asset e le prove limitano il peso dei documenti.

## Decisioni

| ID | Ambito | Sintesi della scelta / motivazione | Provenienza | Stato / requisito completo |
|---|---|---|---|---|
| D327 | **Riallineamento del piano su cambiamento** | Una pagina dell'area riallinea il piano soltanto se trigger D1 hanno segnato un cambiamento da cui dipende (coperture, estensioni, scelta o stato dei negozi); il cron raccoglie la fine di una copertura per il solo passare del tempo e i cambiamenti di chi non visita. Costa una lettura al posto di dodici istruzioni in scrittura a ogni pagina, senza dover ricordare il riallineamento in ogni punto che cambia una copertura. | Owner, 2026-11-08 | Confermato · [Conservazione](../docs/engineering/DATA_RETENTION.md) |
