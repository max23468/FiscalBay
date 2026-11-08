import { readFileSync } from "node:fs";

import { bindings, defineConfig, triggers } from "cf/config";

/**
 * Soglie del Rate Limiting lette da disco: il plugin Cloudflare nega al dev server ogni modulo
 * importato da questo file, e l'app usa le stesse soglie a runtime.
 */
const requestLimitRules = JSON.parse(
  readFileSync(new URL("./app/request-limits.json", import.meta.url), "utf8"),
) as Record<"attempts" | "emails" | "work", RequestLimitRule>;

type RequestLimitRule = { limit: number; period: 10 | 60 };

/**
 * Due Worker dallo stesso codice. `--mode live` seleziona Production; ogni altra modalità
 * (`production` predefinita di Vite in build, `development` in dev) resta sul Worker test,
 * così una build senza modalità esplicita non punta mai a Production.
 * Le migration D1 restano nella cartella predefinita `migrations/`.
 */

/** D1 per ambiente: gli script locali e di collaudo li leggono da qui. */
export const databases = {
  test: { name: "fiscalbay-test", id: "d6e693f0-6156-44ea-a0fb-902aaccc72f1" },
  live: { name: "fiscalbay", id: "fa2a79ad-fe72-4882-9cbb-c4009ffd5d8f" },
};

/**
 * Archivio dei log a 90 giorni per ambiente (§31): bucket R2 UE senza binding, scritto soltanto
 * dal job Logpush di `scripts/log-archive.mjs` e letto dall'owner con la CLI.
 */
export const logArchives = { test: "fiscalbay-test-logs", live: "fiscalbay-logs" };

/**
 * Zona DNS comune ai due ambienti. Header, regole WAF, rate limit, DMARC Management e
 * Certificate Transparency Monitoring si applicano con `scripts/zone-protection.mjs` (§24).
 */
export const zone = "fiscalbay.it";

/** Account Cloudflare del progetto, comune ai due ambienti. */
const account = "98195e505f42abaaeb4827f71a924b1a";

const secrets = {
  REGISTRATION_ALLOWED_EMAILS: bindings.secret(),
  BETTER_AUTH_SECRET: bindings.secret(),
  // Chiave dei token dei negozi eBay, separata da quella di Auth (vedi seller-credentials).
  EBAY_TOKEN_SECRET: bindings.secret(),
  GOOGLE_CLIENT_ID: bindings.secret(),
  GOOGLE_CLIENT_SECRET: bindings.secret(),
  EBAY_CLIENT_ID: bindings.secret(),
  EBAY_CLIENT_SECRET: bindings.secret(),
  EBAY_RUNAME: bindings.secret(),
  // Widget Turnstile dell'ambiente: la chiave del sito è pubblica e arriva al browser, ma nasce
  // con il widget insieme alla chiave segreta per Siteverify e si imposta con lei.
  TURNSTILE_SITE_KEY: bindings.secret(),
  TURNSTILE_SECRET_KEY: bindings.secret(),
};

/**
 * Namespace del Rate Limiting nativo per ambiente (§29): l'identificativo è unico nell'account,
 * quindi test e Production non condividono i contatori. Limiti e finestre, comuni ai due
 * ambienti, stanno in `app/request-limits.json`.
 */
export const requestLimitNamespaces = {
  test: { attempts: "2910", emails: "2911", work: "2912" },
  live: { attempts: "2920", emails: "2921", work: "2922" },
};

const requestLimit = (namespace: string, rule: RequestLimitRule) =>
  bindings.rateLimit({ namespace, simple: { limit: rule.limit, period: rule.period } });

const worker = <Vars extends Record<string, ReturnType<typeof bindings.text>>>(target: {
  name: string;
  domain: string;
  queue: string;
  ingress: string;
  telegram: string;
  /** Build da distribuire: soltanto lì esiste il Worker del bot da collegare. */
  deployed: boolean;
  exports: string;
  metrics: string;
  database: { name: string; id: string };
  limits: { attempts: string; emails: string; work: string };
  /** Esecuzione del Worker vicino al database; assente: nel data center della richiesta. */
  placement?: { mode: "smart" };
  vars: Vars;
}) => ({
  name: target.name,
  compatibilityDate: "2026-09-13",
  compatibilityFlags: ["nodejs_compat"],
  ...(target.placement ? { placement: target.placement } : {}),
  entrypoint: "./workers/app.ts",
  workersDev: false,
  // Tetto della CPU per invocazione, uguale per pagine, coda e cron: un ciclo fuori controllo si
  // ferma prima di consumare la quota inclusa (D227). Il cron e la coda hanno 15 minuti di clock.
  limits: { cpuMs: 30_000 },
  // Eventi di invocazione verso il job Logpush dell'archivio, che ne esporta i soli campi ammessi.
  logpush: true,
  observability: {
    enabled: true,
    logs: { enabled: true, headSamplingRate: 1 },
    // Gli span delle chiamate in uscita registrano l'URL completo: il token del bot resta nel
    // Worker del bot, raggiunto con il binding `TELEGRAM` (D293).
    traces: { enabled: true },
  },
  domains: [target.domain],
  triggers: [
    triggers.scheduled({ schedule: "*/10 * * * *" }),
    ...[target.queue, target.ingress].map((name) =>
      triggers.queue({
        name,
        deadLetterQueue: `${name}-failed`,
        maxBatchSize: 1,
        maxConcurrency: 5,
        maxRetries: 5,
      }),
    ),
  ],
  env: {
    ...target.vars,
    ...secrets,
    DB: bindings.d1(target.database),
    AUTH_EMAIL: bindings.sendEmail({ allowedSenderAddresses: ["noreply@fiscalbay.it"] }),
    // Letture dei negozi, compiti periodici, esportazioni e cancellazioni; la risorsa conserva il
    // nome con cui è nata, quando portava anche i webhook.
    WORK_QUEUE: bindings.queue({ name: target.queue }),
    // Ricevute dei webhook di eBay, Stripe e Telegram: eventi e pagamenti non attendono
    // l'arretrato delle letture.
    INGRESS_QUEUE: bindings.queue({ name: target.ingress }),
    // File delle esportazioni: bucket UE raggiungibile soltanto da questo binding, senza dominio
    // pubblico, `r2.dev` o URL prefirmati; il download passa sempre dal Worker.
    EXPORT_FILES: bindings.r2({ name: target.exports, jurisdiction: "eu" }),
    // Metriche tecniche aggregate, un dataset per ambiente: nasce alla prima scrittura e
    // conserva i punti tre mesi.
    METRICS: bindings.analyticsEngineDataset({ name: target.metrics }),
    // Primo filtro per IP e operazione davanti ad Auth, invii di email e lavori costosi: il
    // contatore è del data center e non scrive su D1.
    REQUEST_LIMIT_ATTEMPTS: requestLimit(target.limits.attempts, requestLimitRules.attempts),
    REQUEST_LIMIT_EMAILS: requestLimit(target.limits.emails, requestLimitRules.emails),
    REQUEST_LIMIT_WORK: requestLimit(target.limits.work, requestLimitRules.work),
    // La console legge lo stesso dataset dalla SQL API dell'account, con il token facoltativo
    // `ANALYTICS_READ_TOKEN`.
    METRICS_DATASET: bindings.text(target.metrics),
    // Con lo stesso token legge dai Workers Logs di questo Worker il tempo CPU delle pagine.
    WORKER_NAME: bindings.text(target.name),
    CLOUDFLARE_ACCOUNT_ID: bindings.text(account),
    VERSION_METADATA: bindings.versionMetadata(),
    // Worker del bot Telegram (`telegram-worker/`), che aggiunge il token alle chiamate della Bot
    // API. Nelle prove e in locale manca, e le chiamate usano il token dell'ambiente.
    ...(target.deployed ? { TELEGRAM: bindings.worker({ worker: target.telegram }) } : {}),
  },
});

export default defineConfig((ctx) => ({
  worker:
    ctx.mode === "live"
      ? worker({
          name: "fiscalbay",
          domain: "fiscalbay.it",
          queue: "fiscalbay-webhooks",
          ingress: "fiscalbay-ingress",
          telegram: "fiscalbay-telegram",
          deployed: true,
          exports: "fiscalbay-exports",
          metrics: "fiscalbay_metrics",
          database: databases.live,
          limits: requestLimitNamespaces.live,
          vars: {
            APP_ORIGIN: bindings.text("https://fiscalbay.it"),
            REGISTRATION_MODE: bindings.text("open"),
            EBAY_SANDBOX_ENABLED: bindings.text("false"),
            EBAY_WORKER_SHARE: bindings.text("100"),
            STRIPE_PRICE_MONTHLY: bindings.text("price_1UHl21JP7SSN14ZpQyiVmdoP"),
            STRIPE_PRICE_ANNUAL: bindings.text("price_1UHl21JP7SSN14ZpqDoFn3Sb"),
            STRIPE_PRICE_LIFETIME: bindings.text("price_1UHl21JP7SSN14Zp0J41hMVs"),
            // Bot attuale, riusato come identità della 2.0; token e segreto restano in custodia.
            TELEGRAM_BOT_USERNAME: bindings.text("fiscalbay_bot"),
          },
        })
      : worker({
          name: "fiscalbay-test",
          domain: "test.fiscalbay.it",
          queue: "fiscalbay-test-webhooks",
          ingress: "fiscalbay-test-ingress",
          telegram: "fiscalbay-test-telegram",
          deployed: ctx.mode === "production",
          exports: "fiscalbay-test-exports",
          metrics: "fiscalbay_test_metrics",
          database: databases.test,
          limits: requestLimitNamespaces.test,
          // In prova sul solo test: ogni pagina fa più passaggi fino a D1 (runbook di capacità).
          placement: { mode: "smart" },
          vars: {
            APP_ORIGIN: bindings.text("https://test.fiscalbay.it"),
            REGISTRATION_MODE: bindings.text("approval"),
            // Spenta su richiesta dell'owner finché non la riattiva: segreti e dati restano.
            EBAY_SANDBOX_ENABLED: bindings.text("false"),
            // Il keyset è quello di Production: il test ne usa al massimo un decimo (D322).
            EBAY_WORKER_SHARE: bindings.text("10"),
            STRIPE_PRICE_MONTHLY: bindings.text("price_1UUABwJqfZnQjIbKpQPYZhKu"),
            STRIPE_PRICE_ANNUAL: bindings.text("price_1UUABwJqfZnQjIbKjc1m9dc0"),
            STRIPE_PRICE_LIFETIME: bindings.text("price_1UUABxJqfZnQjIbK0m1dpfRa"),
            // Bot separato dal bot Production, con foto e profilo che lo dichiarano di prova.
            TELEGRAM_BOT_USERNAME: bindings.text("fiscalbay_test_bot"),
          },
        }),
}));
