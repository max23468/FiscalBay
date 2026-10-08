/** Segreti sintetici per il solo preview locale. Rimossi prima di salvare l'artefatto. */
import { writeFileSync } from "node:fs";
import { localOrigin, localSecret } from "../e2e/local-account.ts";

if (process.env.E2E_BASE_URL)
  throw new Error("Configurazione locale richiesta sul dominio remoto.");
writeFileSync(
  "build/server/.dev.vars",
  [
    `BETTER_AUTH_SECRET=${localSecret}`,
    `APP_ORIGIN=${localOrigin}`,
    "GOOGLE_CLIENT_ID=google-test-client",
    "GOOGLE_CLIENT_SECRET=google-test-secret",
    "EBAY_CLIENT_ID=ebay-test-client",
    "EBAY_CLIENT_SECRET=ebay-test-secret",
    "EBAY_RUNAME=ebay-test-runame",
    "",
  ].join("\n"),
  { mode: 0o600 },
);
