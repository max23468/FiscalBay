import { bindings, defineConfig } from "cf/config";

/** Nome del Worker del bot per ambiente: il binding del Worker principale usa gli stessi. */
export const telegramWorkers = { test: "fiscalbay-test-telegram", live: "fiscalbay-telegram" };

/**
 * Worker del bot Telegram, distribuito con `scripts/telegram-worker.mjs`: `--mode live` per
 * Production, ogni altra modalità per il test. Il token `TELEGRAM_BOT_TOKEN` è il suo unico
 * segreto. Le tracce restano spente, perché la chiamata in uscita porta il token nel percorso.
 */
export default defineConfig((ctx) => ({
  worker: {
    name: ctx.mode === "live" ? telegramWorkers.live : telegramWorkers.test,
    compatibilityDate: "2026-11-10",
    entrypoint: "./index.ts",
    workersDev: false,
    previewUrls: false,
    limits: { cpuMs: 1_000 },
    observability: {
      enabled: true,
      logs: { enabled: true, headSamplingRate: 1 },
      traces: { enabled: false },
    },
    env: { TELEGRAM_BOT_TOKEN: bindings.secret() },
  },
}));
