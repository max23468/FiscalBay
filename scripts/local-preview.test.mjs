import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

describe("copia locale dell'artefatto", () => {
  it("conserva l'origine Production e riscrive solo quella test, senza cambiare l'originale", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "local-preview-"));
    const relative = ".cloudflare/output/v0/workers/default/worker.config.json";
    const source = path.join(directory, relative);
    const script = path.resolve("scripts/local-preview.mjs");
    mkdirSync(path.dirname(source), { recursive: true });
    try {
      for (const production of [false, true]) {
        const origin = production ? "https://fiscalbay.it" : "https://test.fiscalbay.it";
        const original = JSON.stringify({ env: { APP_ORIGIN: { type: "text", value: origin } } });
        writeFileSync(source, original);
        const result = spawnSync(process.execPath, [script], {
          cwd: directory,
          encoding: "utf8",
          env: {
            ...process.env,
            E2E_BASE_URL: "",
            E2E_PRODUCTION: production ? "1" : "",
            E2E_PORT: "5193",
          },
        });
        assert.equal(result.status, 0, result.stderr);
        const copy = JSON.parse(
          readFileSync(path.join(directory, ".cloudflare/preview", relative), "utf8"),
        );
        assert.equal(copy.env.APP_ORIGIN.value, production ? origin : "http://localhost:5193");
        // Il bot sintetico serve soltanto alla copia test; Production conserva il proprio nome.
        assert.equal(
          copy.env.TELEGRAM_BOT_USERNAME?.value,
          production ? undefined : "FiscalBayCollaudoBot",
        );
        assert.equal(copy.env.TELEGRAM_BOT_TOKEN === undefined, production);
        const vars = readFileSync(path.join(directory, ".cloudflare/preview/.dev.vars"), "utf8");
        assert.match(vars, /^REGISTRATION_ALLOWED_EMAILS=\[\]$/mu);
        assert.match(vars, /^TURNSTILE_SECRET_KEY=1x0{31}AA$/mu);
        assert.equal(readFileSync(source, "utf8"), original);
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
