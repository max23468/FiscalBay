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
    command:
      "node node_modules/@react-router/dev/bin.cjs dev --host 127.0.0.1 --port 5186 --strictPort",
    gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
    url: "http://127.0.0.1:5186/design",
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
