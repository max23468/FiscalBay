// Moduli critici della mutation, condivisi da `mutation.mjs` e `mutation-reuse.mjs` senza un
// ciclo di import: con un ciclo la matrice della PR restava in attesa del proprio modulo.

/**
 * Regole condivise dei moduli critici: dati fiscali, orari, lista ordini, coda,
 * sospensione del servizio e periodicità degli abbonamenti.
 */
const criticalShared = new Set([
  "app/service-activity.server.ts",
  "app/markup.ts",
  "app/tax-quality.ts",
  "app/time.ts",
  "app/orders/order-list.ts",
  "app/domain/work-timing.ts",
  "app/domain/subscription-offers.ts",
  "app/domain/auth-attempts.server.ts",
  "app/domain/deletion-steps.server.ts",
  "app/domain/webhook-receipts.server.ts",
]);

/**
 * Moduli server di Auth, filtro delle richieste, sessioni, chiavi derivate, isolamento, ordini, export e file XLSX, negozi
 * e loro segni, integrazioni, diritti e destinatari Telegram.
 */
export function criticalModule(file) {
  return (
    criticalShared.has(file) ||
    /^app\/(?:auth(?:-route)?|request-limits|sealed|domain\/(?:billing|refunds|orders|order-import|order-observation|order-acquisition|order-sync|order-export|quota|grants|cycles|sessions|sign-in-methods|registration|stores|store-marks|export|xlsx|telegram)|integrations\/(?:webhooks|stripe|telegram|ebay\/(?:environment|notifications|seller-credentials|store-link|tax-identifiers|fulfillment))).*\.server\.ts$/u.test(
      file,
    )
  );
}
