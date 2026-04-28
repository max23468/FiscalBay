# Decisioni Aperte

Decisioni ancora aperte o differite che influenzano le fasi successive alla
prima release stabile.

## Stato 1.0.0

Non ci sono decisioni aperte bloccanti per `1.0.0` dentro il perimetro
`approved_public_small`.

La `1.0.0` stabilizza il servizio pubblico piccolo con accesso approvato, non
un'apertura pubblica libera o multiutente a larga scala.

## Decisioni deliberate per 1.0.0

- lo stato `error` resta un failure mode tecnico e diagnostico; la UX principale
  espone stati guidati come collegato, scollegato, revocato, scaduto o
  `reconnect_required`
- la memoria dell'ultimo failure OAuth/reconnect può essere visibile quando aiuta
  l'utente o l'admin a capire il prossimo passo, ma non diventa uno storico
  prodotto completo
- il pruning automatico di `audit_log`, sessioni OAuth vecchie e operation queue
  terminale è parte della reconciliation periodica
- la cancellazione utente resta amministrativa assistita tramite export e delete
  tenant; l'utente può avviare la richiesta con `/settings dati`, mentre la
  conferma finale resta admin
- il set admin permanente per `1.0.0` è composto da `/admin`,
  `/admin manutenzione`, `/admin_users all|pending|unlinked|reconnect|inactive`,
  `/tenant_health`, `/admin dormant [ore]`, `/admin export`,
  `/admin delete_tenant ... confirm` e `/service_mode normal|maintenance|degraded`
- i tenant inattivi o dormienti vengono solo evidenziati per review admin; non
  vengono sospesi, scollegati o cancellati automaticamente
- gli alert prodotto restano dashboard/sintesi/healthcheck non persistenti; audit,
  runtime state e metriche minime restano persistiti dove già previsto

## Decisioni future non bloccanti

- Postgres o database gestito prima di un'apertura pubblica multiutente più ampia
- eventuale secret manager dedicato quando il perimetro operativo cresce
- cancellazione self-service completa da Telegram senza conferma admin
- ruoli admin multipli o delega operativa
- alert prodotto persistenti con storico dedicato
- revoca remota eBay garantita come parte del flusso di disconnect
