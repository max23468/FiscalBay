import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { notifyOwner } from "./notify.mjs";

describe("avviso all'owner", () => {
  const env = { TELEGRAM_BOT_TOKEN: "t", TELEGRAM_OWNER_ID: "1" };

  it("non invia nulla senza token o destinatario", async () => {
    const send = () => assert.fail("nessun invio atteso");
    assert.equal(await notifyOwner("x", {}, send), false);
    assert.equal(await notifyOwner("x", { TELEGRAM_BOT_TOKEN: "t" }, send), false);
  });

  it("invia il testo al destinatario e non fallisce per un errore del bot", async () => {
    const calls = [];
    const send = async (url, options) => {
      calls.push([url, JSON.parse(options.body)]);
      return { ok: calls.length === 1, status: 429 };
    };
    assert.equal(await notifyOwner("fatto", env, send), true);
    assert.equal(await notifyOwner("fatto", env, send), false);
    assert.deepEqual(calls[0], [
      "https://api.telegram.org/bott/sendMessage",
      { chat_id: "1", text: "fatto" },
    ]);
  });
});
