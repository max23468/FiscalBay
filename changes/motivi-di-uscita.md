# Motivi di uscita

## Changelog

### Altre modifiche

- **Motivi di uscita.** La disdetta dal portale Stripe e la cancellazione dell'account raccolgono un motivo da un elenco chiuso e un commento, entrambi facoltativi; avvisi Telegram, pagina Commerciale della console e comando `/uscite` li mostrano. Privacy IT/EN `2026-11-07`.

## Decisioni

| ID | Ambito | Sintesi della scelta / motivazione | Provenienza | Stato / requisito completo |
|---|---|---|---|---|
| D314 | **Motivi di uscita** | La disdetta dal portale Stripe legge motivo e commento dai `cancellation_details` dell'abbonamento; la cancellazione dell'account chiede il motivo nella richiesta, che aspetta la conferma dal link email. Elenco chiuso con i codici del portale: costa troppo, non lo uso abbastanza, passo a un altro servizio, manca una funzione, non funziona come mi aspettavo, altro; soltanto la cancellazione aggiunge «Chiudo o sospendo l'attività su eBay». Commento facoltativo di al più 500 caratteri, nessun obbligo di risposta. Allo scollegamento dell'ultimo negozio non si chiede nulla: non è un'uscita. Il commento resta 30 giorni, con gli avvisi all'owner, e quello di una disdetta sparisce prima se lo spazio viene cancellato; poi resta un'istantanea anonima con tipo, motivo, piano, fascia di anzianità e mese, eliminata dopo 24 mesi. Avvisi Telegram di disdetta e cancellazione con motivo e commento, riquadro aggregato nella pagina Commerciale e comando `/uscite`. Il motivo non entra nell'esportazione dell'account. Privacy IT/EN `2026-11-07`, Termini invariati. Modello: diagnosi delle disinstallazioni di CF Ready. | Il 2026-11-07 l'owner approva elenco, opzioni del portale anche in live, nessuna domanda allo scollegamento, durate, visibilità con il comando e Privacy | Confermato · [Roadmap](../docs/ROADMAP.md#2-0-07) · [§15](../docs/product/CHANNELS_AND_ADMIN.md#s15) |
