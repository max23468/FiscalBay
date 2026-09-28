import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  forbidOnly: !!process.env.CI,
  use: {
    baseURL: "http://127.0.0.1:5186",
    browserName: "chromium",
    viewport: { width: 1280, height: 900 },
    trace: "retain-on-failure",
  },
  webServer: {
    // In CI `pnpm verify` ha già prodotto la build che viene poi distribuita.
    command: `${process.env.E2E_PREBUILT ? "" : "pnpm build && "}node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 5186 --strictPort`,
    gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
    url: "http://127.0.0.1:5186/anteprima/ordini",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
