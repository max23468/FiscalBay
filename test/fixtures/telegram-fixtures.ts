import { env } from "cloudflare:workers";
import { expect, vi } from "vitest";

export type BotCall = { method: string; params: Record<string, unknown> };

/**
 * Bot API simulata: registra le chiamate e risponde come Telegram, o con `reply` per le risposte
 * particolari. Le richieste agli altri provider (Stripe, eBay) non hanno risposta: le viste
 * mostrano la lettura non riuscita.
 */
export function fakeBot(reply?: (call: BotCall) => Response | undefined) {
  const calls: BotCall[] = [];
  const fetcher = vi.fn<typeof fetch>(async (input, init) => {
    const url = String(input instanceof Request ? input.url : input);
    if (!url.startsWith(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/`))
      return new Response("", { status: 503 });
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("content-type")).toBe("application/json");
    const call = {
      method: url.split("/").at(-1)!,
      params: JSON.parse(String(init?.body)) as Record<string, unknown>,
    };
    calls.push(call);
    const custom = reply?.(call);
    if (custom) return custom;
    if (call.method === "getChat")
      return Response.json({ ok: true, result: { id: 1, type: "private", username: "venditore" } });
    if (call.method === "getWebhookInfo")
      return Response.json({
        ok: true,
        result: {
          url: "http://localhost:5173/webhooks/telegram",
          pending_update_count: 0,
          allowed_updates: ["message", "callback_query"],
        },
      });
    const profileField = {
      getMyName: "name",
      getMyShortDescription: "short_description",
      getMyDescription: "description",
    }[call.method];
    if (profileField) return Response.json({ ok: true, result: { [profileField]: "" } });
    if (
      ["answerCallbackQuery", "setMyCommands", "deleteMyCommands"].includes(call.method) ||
      /^setMy(Name|ShortDescription|Description)$/u.test(call.method)
    )
      return Response.json({ ok: true, result: true });
    return Response.json({ ok: true, result: { message_id: calls.length } });
  });
  return {
    fetcher,
    calls,
    methods: () => calls.map((call) => call.method),
    texts: () => calls.filter((call) => call.method === "sendMessage"),
  };
}
