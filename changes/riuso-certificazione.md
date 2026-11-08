# Certificazione ereditata

## Changelog

### Altre modifiche

- **Promozioni più rapide per i soli testi.** Un commit che cambia soltanto documenti, voci del changelog o test riusa la certificazione dell'antenato qualificato.

## Decisioni

| ID | Ambito | Sintesi della scelta / motivazione | Provenienza | Stato / requisito completo |
|---|---|---|---|---|
| D329 | **Certificazione ereditata** | `Promuovi` accetta un commit che rispetto a un antenato certificato cambia soltanto documenti, changelog e frammenti, test o spec browser: non cambia ciò che si distribuisce, e una voce di Novità non vale una qualifica completa. Il riuso vale per il solo controllo della promozione, entro trenta commit; `Node 26` resta richiesto e la build Production si rifà. | Owner, 2026-11-08 | Confermato · [Pubblicazione](../docs/operations/RELEASE.md) |
