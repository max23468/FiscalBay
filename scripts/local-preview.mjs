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
// Token sintetico per il beacon delle pagine pubbliche, che i fixture delle prove sostituiscono.
config.env.WEB_ANALYTICS_TOKEN = { type: "text", value: "local-web-analytics-token" };
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
    // Chiavi di prova di Cloudflare: il loro esito vale soltanto sull'origine locale.
    "TURNSTILE_SITE_KEY=1x00000000000000000000AA",
    "TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA",
    "",
  ].join("\n"),
  { mode: 0o600 },
);
