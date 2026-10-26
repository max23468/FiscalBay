import { defineConfig } from "@playwright/test";
import { localOrigin, localPort } from "./e2e/local-account";

export default defineConfig({
  testDir: "./e2e",
  outputDir: `./test-results/${process.env.E2E_RUN_ID || (process.env.E2E_BASE_URL ? "deployed" : "local")}`,
  // Sul dominio test l'account di collaudo è unico; in CI ogni macchina esegue una parte.
  workers: process.env.E2E_BASE_URL ? 1 : process.env.CI ? 4 : 2,
  fullyParallel: true,
  // Sul dominio remoto una sola ripetizione separa l'instabilità della rete da un difetto:
  // una prova che fallisce due volte fa ancora tornare indietro il deploy. La CI delle PR
  // chiede la stessa ripetizione con `E2E_RETRIES`; il report segnala le prove instabili.
  retries: process.env.E2E_BASE_URL ? 1 : Number(process.env.E2E_RETRIES ?? 0),
  globalSetup: "./e2e/setup.ts",
  reporter: [["list"], ["./e2e/report.ts"]],
  forbidOnly: !!process.env.CI,
  use: {
    baseURL: process.env.E2E_BASE_URL || localOrigin,
    viewport: { width: 1280, height: 900 },
    // Il fuso del dispositivo arriva al server: lo stesso in locale e sui runner in UTC.
    timezoneId: "Europe/Rome",
    trace: process.env.E2E_BASE_URL ? "off" : "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    { name: "webkit", use: { browserName: "webkit" } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        // Origine e segreti sintetici arrivano dalla copia locale scritta da `local-preview.mjs`.
        // In CI `pnpm verify` ha già prodotto la build che viene poi distribuita.
        command: `${process.env.E2E_PREBUILT ? "" : process.env.E2E_PRODUCTION === "1" ? "pnpm build:live && " : "pnpm build && "}node scripts/local-preview.mjs && node node_modules/vite/bin/vite.js preview .cloudflare/preview --config vite.config.ts --host localhost --port ${localPort} --strictPort`,
        gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
        url: `${localOrigin}${process.env.E2E_PRODUCTION === "1" ? "/" : "/anteprima/ordini"}`,
        reuseExistingServer: false,
        timeout: 120_000,
      },
});
