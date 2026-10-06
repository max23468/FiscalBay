import { defineConfig } from "@playwright/test";
import { localPort, localSecret } from "./e2e/local-account";

export default defineConfig({
  testDir: "./e2e",
  outputDir: `./test-results/${process.env.E2E_RUN_ID || (process.env.E2E_BASE_URL ? "deployed" : "local")}`,
  // Sul dominio test l'account di collaudo è unico; in CI ogni macchina esegue una parte.
  workers: process.env.E2E_BASE_URL ? 1 : process.env.CI ? 4 : 2,
  fullyParallel: true,
  globalSetup: "./e2e/setup.ts",
  reporter: [["list"], ["./e2e/report.ts"]],
  forbidOnly: !!process.env.CI,
  use: {
    baseURL: process.env.E2E_BASE_URL || `http://127.0.0.1:${localPort}`,
    viewport: { width: 1280, height: 900 },
    trace: process.env.E2E_BASE_URL ? "off" : "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    { name: "webkit", testMatch: /pages\.spec\.ts/u, use: { browserName: "webkit" } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        // Le pagine pubbliche inizializzano Auth anche senza sessione: solo valori sintetici.
        env: {
          ...(process.env.E2E_PRODUCTION === "1" ? { CLOUDFLARE_ENV: "production" } : {}),
          APP_ORIGIN: `http://127.0.0.1:${localPort}`,
          BETTER_AUTH_SECRET: localSecret,
          GOOGLE_CLIENT_ID: "google-test-client",
          GOOGLE_CLIENT_SECRET: "google-test-secret",
          EBAY_CLIENT_ID: "ebay-test-client",
          EBAY_CLIENT_SECRET: "ebay-test-secret",
          EBAY_RUNAME: "ebay-test-runame",
        },
        // In CI `pnpm verify` ha già prodotto la build che viene poi distribuita.
        command: `${process.env.E2E_PREBUILT ? "" : "pnpm build && "}node scripts/local-preview.mjs && node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port ${localPort} --strictPort`,
        gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
        url: `http://127.0.0.1:${localPort}${process.env.E2E_PRODUCTION === "1" ? "/" : "/anteprima/ordini"}`,
        reuseExistingServer: false,
        timeout: 120_000,
      },
});
