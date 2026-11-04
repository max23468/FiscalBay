import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { checkWorker, targetOf } from "./telegram-worker.mjs";

describe("Worker del bot Telegram", () => {
  it("collega il Worker principale distribuito al Worker del bot dello stesso ambiente", () => {
    assert.deepEqual(targetOf("live"), {
      live: true,
      worker: "fiscalbay-telegram",
      main: "fiscalbay",
      binding: "fiscalbay-telegram",
    });
    assert.deepEqual(targetOf("test"), {
      live: false,
      worker: "fiscalbay-test-telegram",
      main: "fiscalbay-test",
      binding: "fiscalbay-test-telegram",
    });
  });

  it("richiede il Worker senza domini e con il token", () => {
    const target = targetOf("test");
    const state = {
      workers: [{ name: target.worker, references: { domains: [] } }],
      secrets: ["TELEGRAM_BOT_TOKEN"],
    };
    assert.ok(checkWorker(target, state).every(({ ok }) => ok));
    const exposed = {
      ...state,
      workers: [{ name: target.worker, references: { domains: [{ hostname: "x" }] } }],
    };
    assert.deepEqual(
      checkWorker(target, { ...exposed, secrets: [] })
        .filter(({ ok }) => !ok)
        .map(({ item }) => item),
      ["Worker fiscalbay-test-telegram senza domini", "segreto TELEGRAM_BOT_TOKEN"],
    );
    assert.equal(checkWorker(target, {}).filter(({ ok }) => !ok).length, 2);
  });
});
