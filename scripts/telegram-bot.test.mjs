import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { applyBot, botRequest, checkBot, ownerMenu, report, targetOf } from "./telegram-bot.mjs";

const target = { webhookUrl: "https://test.fiscalbay.it/webhooks/telegram", ownerId: "573159993" };

/** Bot API simulata con lo stato del bot; registra le chiamate senza il token. */
function bot(state) {
  const calls = [];
  const fetcher = async (url, init) => {
    const method = String(url).split("/").at(-1);
    const params = JSON.parse(init.body);
    calls.push({ method, params });
    if (method === "setWebhook")
      state.webhook = { url: params.url, allowed_updates: params.allowed_updates };
    if (method === "setMyCommands") state.owner = params.commands;
    const result =
      method === "getWebhookInfo"
        ? { pending_update_count: 0, ...state.webhook }
        : method === "getMyCommands"
          ? params.scope.type === "chat"
            ? state.owner
            : params.language_code === "it"
              ? state.it
              : state.en
          : true;
    return Response.json({ ok: true, result });
  };
  return { request: botRequest("123:token", fetcher), calls, state };
}

const sellers = {
  it: [
    { command: "stato", description: "Piano, notifiche e negozi" },
    { command: "ultimi", description: "Ultimi ordini" },
    { command: "preferenze", description: "Notifiche e negozi" },
    { command: "aiuto", description: "Come funziona il bot" },
  ],
  en: [
    { command: "status", description: "Plan, notifications and stores" },
    { command: "latest", description: "Latest orders" },
    { command: "preferences", description: "Notifications and stores" },
    { command: "help", description: "How the bot works" },
  ],
};

describe("bot Telegram dell'ambiente", () => {
  it("legge indirizzo del webhook e owner da cloudflare.config.ts", () => {
    assert.deepEqual(targetOf("test"), target);
    assert.deepEqual(targetOf("live"), {
      webhookUrl: "https://fiscalbay.it/webhooks/telegram",
      ownerId: "573159993",
    });
  });

  it("segnala webhook e menu diversi dal codice, poi li allinea", async () => {
    const api = bot({ webhook: { url: "" }, owner: [], ...sellers });
    const before = await checkBot(api.request, target);
    assert.deepEqual(
      before.filter(({ ok }) => !ok).map(({ item }) => item),
      ["webhook: indirizzo", "webhook: messaggi e pulsanti", "menu dell'owner"],
    );
    await applyBot(api.request, target, "s".repeat(32));
    assert.deepEqual(api.calls.slice(4), [
      {
        method: "setWebhook",
        params: {
          url: target.webhookUrl,
          secret_token: "s".repeat(32),
          allowed_updates: ["message", "callback_query"],
          drop_pending_updates: false,
        },
      },
      {
        method: "setMyCommands",
        params: { commands: ownerMenu(), scope: { type: "chat", chat_id: "573159993" } },
      },
    ]);
    const after = await checkBot(api.request, target);
    assert.ok(after.every(({ ok }) => ok));
    assert.equal(report(after).split("\n")[0], "✓ webhook: indirizzo");
    // Lo stesso menu che il Worker imposta (test/owner-control.spec.ts).
    assert.deepEqual(
      ownerMenu().map(({ command }) => command),
      [
        "console",
        "incidenti",
        "lavori",
        "quote",
        "commerciale",
        "metriche",
        "negozi",
        "prestazioni",
        "versione",
        "stato",
        "ultimi",
        "preferenze",
        "aiuto",
      ],
    );
    assert.deepEqual(ownerMenu().slice(-4), sellers.it);
  });

  it("un errore della Bot API non riporta il token", async () => {
    const request = botRequest("123:segreto", async () => Response.json({ ok: false }));
    await assert.rejects(request("getWebhookInfo"), (error) => {
      assert.equal(error.message, "getWebhookInfo: rifiutata");
      return true;
    });
  });
});
