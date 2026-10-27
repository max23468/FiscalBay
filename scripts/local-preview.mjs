/**
 * Copia locale della Build Output per `vite preview`, servita da `.cloudflare/preview`:
 * origine locale e segreti sintetici restano fuori dall'artefatto verificato, che non cambia.
 * Il plugin Cloudflare non sostituisce le variabili testuali in locale, quindi `APP_ORIGIN`
 * viene riscritta nella copia test; il collaudo Production conserva l'origine che esclude l'anteprima.
 * La copia test riceve anche un bot Telegram sintetico, senza alcun bot reale dietro: token e
 * segreto sono facoltativi e il plugin passa al Worker soltanto i binding dichiarati, quindi stanno
 * nella copia della configurazione insieme al nome.
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
const production = process.env.E2E_PRODUCTION === "1";
if (!production) {
  config.env.APP_ORIGIN = { type: "text", value: localOrigin };
  config.env.TELEGRAM_BOT_USERNAME = { type: "text", value: "FiscalBayCollaudoBot" };
  config.env.TELEGRAM_BOT_TOKEN = { type: "text", value: "000000:telegram-local-synthetic" };
  config.env.TELEGRAM_WEBHOOK_SECRET = {
    type: "text",
    value: "telegram-local-synthetic-webhook-secret",
  };
}
writeFileSync(workerConfig, JSON.stringify(config));
writeFileSync(
  `${previewRoot}/.dev.vars`,
  [
    "REGISTRATION_ALLOWED_EMAILS=[]",
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
