/**
 * Copia locale della Build Output per `vite preview`, servita da `.cloudflare/preview`:
 * origine locale e segreti sintetici restano fuori dall'artefatto verificato, che non cambia.
 * Il plugin Cloudflare non sostituisce le variabili testuali in locale, quindi `APP_ORIGIN`
 * viene riscritta nella copia test; il collaudo Production conserva l'origine che esclude l'anteprima.
 */
import { cpSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { localOrigin, localSecret } from "../e2e/local-account.ts";

if (process.env.E2E_BASE_URL)
  throw new Error("Configurazione locale richiesta sul dominio remoto.");
const previewRoot = ".cloudflare/preview";
rmSync(previewRoot, { recursive: true, force: true });
cpSync(".cloudflare/output", `${previewRoot}/.cloudflare/output`, { recursive: true });
const workerConfig = `${previewRoot}/.cloudflare/output/v0/workers/default/worker.config.json`;
const config = JSON.parse(readFileSync(workerConfig, "utf8"));
if (process.env.E2E_PRODUCTION !== "1")
  config.env.APP_ORIGIN = { type: "text", value: localOrigin };
writeFileSync(workerConfig, JSON.stringify(config));
writeFileSync(
  `${previewRoot}/.dev.vars`,
  [
    `BETTER_AUTH_SECRET=${localSecret}`,
    "GOOGLE_CLIENT_ID=google-test-client",
    "GOOGLE_CLIENT_SECRET=google-test-secret",
    "EBAY_CLIENT_ID=ebay-test-client",
    "EBAY_CLIENT_SECRET=ebay-test-secret",
    "EBAY_RUNAME=ebay-test-runame",
    "",
  ].join("\n"),
  { mode: 0o600 },
);
