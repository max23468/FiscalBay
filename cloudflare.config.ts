import { bindings, defineConfig, triggers } from "cf/config";

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

const secrets = {
  REGISTRATION_ALLOWED_EMAILS: bindings.secret(),
  BETTER_AUTH_SECRET: bindings.secret(),
  GOOGLE_CLIENT_ID: bindings.secret(),
  GOOGLE_CLIENT_SECRET: bindings.secret(),
  EBAY_CLIENT_ID: bindings.secret(),
  EBAY_CLIENT_SECRET: bindings.secret(),
  EBAY_RUNAME: bindings.secret(),
};

const worker = <Vars extends Record<string, ReturnType<typeof bindings.text>>>(target: {
  name: string;
  domain: string;
  queue: string;
  database: { name: string; id: string };
  vars: Vars;
}) => ({
  name: target.name,
  compatibilityDate: "2026-09-13",
  compatibilityFlags: ["nodejs_compat"],
  entrypoint: "./workers/app.ts",
  workersDev: false,
  observability: {
    enabled: true,
    logs: { enabled: true, headSamplingRate: 1 },
    traces: { enabled: true, headSamplingRate: 0.01 },
  },
  domains: [target.domain],
  triggers: [
    triggers.scheduled({ schedule: "*/10 * * * *" }),
    triggers.queue({
      name: target.queue,
      deadLetterQueue: `${target.queue}-failed`,
      maxBatchSize: 1,
      maxConcurrency: 5,
      maxRetries: 5,
    }),
  ],
  env: {
    ...target.vars,
    ...secrets,
    DB: bindings.d1(target.database),
    AUTH_EMAIL: bindings.sendEmail({ allowedSenderAddresses: ["noreply@fiscalbay.it"] }),
    // Una sola coda per webhook, letture dei negozi e compiti periodici; la risorsa conserva il
    // nome con cui è nata.
    WORK_QUEUE: bindings.queue({ name: target.queue }),
    VERSION_METADATA: bindings.versionMetadata(),
  },
});

export default defineConfig((ctx) => ({
  worker:
    ctx.mode === "live"
      ? worker({
          name: "fiscalbay",
          domain: "fiscalbay.it",
          queue: "fiscalbay-webhooks",
          database: databases.live,
          vars: {
            APP_ORIGIN: bindings.text("https://fiscalbay.it"),
            REGISTRATION_MODE: bindings.text("open"),
            EBAY_SANDBOX_ENABLED: bindings.text("false"),
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
          database: databases.test,
          vars: {
            APP_ORIGIN: bindings.text("https://test.fiscalbay.it"),
            REGISTRATION_MODE: bindings.text("approval"),
            // Spenta su richiesta dell'owner finché non la riattiva: segreti e dati restano.
            EBAY_SANDBOX_ENABLED: bindings.text("false"),
            STRIPE_PRICE_MONTHLY: bindings.text("price_1UUABwJqfZnQjIbKpQPYZhKu"),
            STRIPE_PRICE_ANNUAL: bindings.text("price_1UUABwJqfZnQjIbKjc1m9dc0"),
            STRIPE_PRICE_LIFETIME: bindings.text("price_1UUABxJqfZnQjIbK0m1dpfRa"),
            // Bot separato dal bot Production, con foto e profilo che lo dichiarano di prova.
            TELEGRAM_BOT_USERNAME: bindings.text("fiscalbay_test_bot"),
          },
        }),
}));
