# Promuovi porta tutto develop

## Decisioni

| ID | Ambito | Sintesi della scelta / motivazione | Provenienza | Stato / requisito completo |
|---|---|---|---|---|
| D326 | **Promuovi porta tutto `develop`** | `Promuovi` senza versione certifica l'ultimo commit di `develop` presente alla richiesta, ne attende la qualifica se manca e soltanto dopo lo pubblica. Una qualifica fallita ferma il ciclo prima di `main`: si corregge in una PR e si ripete il comando, senza promuovere una parte del lotto. Sparisce `--testa`, ora comportamento predefinito. `--version` e «Pubblica in Production» restano sul commit certificato più recente. Supera D296 per la scelta del commit di `Promuovi`. | Il 2026-11-08 `Promuovi` ha distribuito `3f0e4167` lasciando fuori due PR già integrate. Richiesta owner dello stesso giorno: «prima dev'essere certificato il lavoro rimanente fino all'ultimo commit, poi va promosso tutto» | Confermato · [Pubblicazione](../docs/operations/RELEASE.md#promuovi-e-ripresa) |
