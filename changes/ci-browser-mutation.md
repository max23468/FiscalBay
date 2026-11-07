# Browser e mutation senza lavoro ripetuto

## Decisioni

| ID | Ambito | Sintesi della scelta / motivazione | Provenienza | Stato / requisito completo |
|---|---|---|---|---|
| D315 | **WebKit alla CI, mutation in un solo job** | `pnpm verify:browser` torna a provare in locale le prove scelte soltanto in Chromium; WebKit resta ai job della CI. Dopo ogni run della mutation su `develop` le parti riuscite di ogni modulo si riuniscono in un riferimento completo, e la PR prova in un solo job il modulo che lo ha e conta al più 40 mutanti sulle righe cambiate da allora, invece di ripetere in ogni parte la prova iniziale della suite. Job su un runner del Mac scartati: il repository è pubblico, il Mac regge un solo processo Stryker alla volta e le prove browser di CI girano nell'immagine Linux di Playwright. Supera D311 per WebKit in locale. | Richiesta owner del 2026-11-07 di spostare in locale i job lunghi senza lavoro duplicato. Misure dello stesso giorno: prove della PR in 12,8 minuti sul Mac contro 6-7 in CI; dal 25 ottobre 5 run fallite soltanto in WebKit su 400, nessuna per un difetto del prodotto; nelle PR la maggior parte delle parti riusava tutti i mutanti e durava soltanto la prova iniziale, da cinque a nove minuti | Confermato · [Pubblicazione](../docs/operations/RELEASE.md#mutation-test) |
