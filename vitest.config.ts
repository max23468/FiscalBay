import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest(async () => ({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        bindings: {
          APP_ORIGIN: "http://localhost:5173",
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
          TEST_MIGRATIONS: await readD1Migrations("./migrations"),
        },
      },
    })),
  ],
  test: { setupFiles: ["./test/apply-migrations.ts"] },
});
