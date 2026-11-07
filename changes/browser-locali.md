# Browser locali come in CI

## Decisioni

| ID | Ambito | Sintesi della scelta / motivazione | Provenienza | Stato / requisito completo |
|---|---|---|---|---|
| D311 | **WebKit nelle prove locali** | `pnpm verify:browser` esegue le prove scelte negli stessi browser della CI: Chromium e WebKit quando la modifica cambia ciò che il browser disegna o esegue, nessuno con soli moduli server. In locale Playwright usa un worker ogni 6 GiB di memoria, al più quattro come in CI. Copertura, build, suite completa e mutation restano alla CI, che già prova la mutation dei moduli toccati in ogni PR. Precisa D268 e D298. | Richiesta owner del 2026-11-07, con il passaggio a un Mac con 15 core e 24 GB: un difetto di Safari emergeva soltanto in CI e costava un altro giro | Confermato · [Pubblicazione](../docs/operations/RELEASE.md#controlli-proporzionati) |
