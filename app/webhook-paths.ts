/**
 * Percorsi dell'ingresso dei webhook. Il Worker li prende in carico prima della build dell'app;
 * la zona non vi applica controlli pensati per i browser (`scripts/zone-protection.mjs`).
 */
export const webhookPaths = [
  "/webhooks/ebay",
  "/webhooks/ebay/sandbox",
  "/webhooks/stripe",
  "/webhooks/telegram",
];
