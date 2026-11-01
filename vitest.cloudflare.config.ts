import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest(async () => ({
      experimental: { newConfig: { configPath: "./cloudflare.config.ts" } },
      miniflare: {
        bindings: {
          APP_ORIGIN: "http://localhost:5173",
          REGISTRATION_MODE: "open",
          REGISTRATION_ALLOWED_EMAILS: "[]",
          BETTER_AUTH_SECRET: "fiscalbay-test-secret-at-least-32-bytes",
          GOOGLE_CLIENT_ID: "google-test-client",
          GOOGLE_CLIENT_SECRET: "google-test-secret",
          EBAY_CLIENT_ID: "ebay-test-client",
          EBAY_CLIENT_SECRET: "ebay-test-secret",
          EBAY_RUNAME: "fiscalbay-test-runame",
          STRIPE_SECRET_KEY: "rk_test_fiscalbay",
          STRIPE_WEBHOOK_SECRET: "whsec_fiscalbay_test",
          STRIPE_PRICE_MONTHLY: "price_test_monthly",
          STRIPE_PRICE_ANNUAL: "price_test_annual",
          STRIPE_PRICE_LIFETIME: "price_test_lifetime",
          TELEGRAM_BOT_USERNAME: "FiscalBayTestBot",
          TELEGRAM_BOT_TOKEN: "123456:telegram-test-token",
          TELEGRAM_WEBHOOK_SECRET: "telegram-webhook-secret-for-the-test-suite",
          // Chiavi di prova di Cloudflare che accettano sempre; Siteverify è simulato nei test.
          TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
          TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
          TEST_MIGRATIONS: await readD1Migrations("./migrations"),
        },
      },
    })),
  ],
  resolve: {
    tsconfigPaths: true,
    alias: { "virtual:react-router/server-build": "./test/server-build.ts" },
  },
  // Il test dei token legge `app.css` come testo: Vitest altrimenti lo svuota.
  test: {
    name: "cloudflare",
    include: ["test/**/*.spec.ts"],
    // Le prove che importano decine di ordini impiegano meno di un secondo in locale, ma con la
    // copertura e più processi sul runner di GitHub superano i 5 secondi predefiniti. Il limite
    // resta sotto il timeout di Stryker (`stryker.config.json`), che vale anche per la mutation.
    testTimeout: 15_000,
    hookTimeout: 20_000,
    setupFiles: [
      "./test/apply-migrations.ts",
      "./test/fixtures/turnstile-fixtures.ts",
      "./test/fixtures/whats-new-fixtures.ts",
    ],
    diff: "./test/diff-options.ts",
    css: { include: [/app\.css/u] },
  },
});
