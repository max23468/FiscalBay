import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  outputDir: process.env.E2E_BASE_URL ? "./test-results/deployed" : "./test-results/local",
  workers: 1,
  forbidOnly: !!process.env.CI,
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://127.0.0.1:5186",
    browserName: "chromium",
    viewport: { width: 1280, height: 900 },
    trace: "retain-on-failure",
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        // Le pagine pubbliche inizializzano Auth anche senza sessione: solo valori sintetici.
        env: {
          BETTER_AUTH_SECRET: "fiscalbay-e2e-secret-at-least-32-bytes",
          GOOGLE_CLIENT_ID: "google-test-client",
          GOOGLE_CLIENT_SECRET: "google-test-secret",
          EBAY_CLIENT_ID: "ebay-test-client",
          EBAY_CLIENT_SECRET: "ebay-test-secret",
          EBAY_RUNAME: "ebay-test-runame",
        },
        // In CI `pnpm verify` ha già prodotto la build che viene poi distribuita.
        command: `${process.env.E2E_PREBUILT ? "" : "pnpm build && "}node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 5186 --strictPort`,
        gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
        url: "http://127.0.0.1:5186/anteprima/ordini",
        reuseExistingServer: false,
        timeout: 120_000,
      },
});
