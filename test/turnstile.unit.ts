import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { turnstileField } from "../app/turnstile";
import { turnstileFailure, verifyTurnstile } from "../app/turnstile.server";

let errors: MockInstance<typeof console.error>;
const logs = () => errors.mock.calls.map(([line]) => JSON.parse(String(line)));

beforeEach(() => {
  errors = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("verifica Turnstile", () => {
  const siteverify = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
  const keys = {
    APP_ORIGIN: "https://test.fiscalbay.it",
    TURNSTILE_SECRET_KEY: "0x4-segreta",
  } as Env;
  const passed = { success: true, hostname: "test.fiscalbay.it", action: "sign-up" };
  const client = () =>
    new Request("https://test.fiscalbay.it/accesso", {
      method: "POST",
      headers: { "cf-connecting-ip": "203.0.113.9" },
    });
  const answer = (body: unknown, init?: ResponseInit) =>
    vi.fn<typeof fetch>(async () => Response.json(body, init));

  it("accetta il token dell'hostname e dell'azione attesi, inviando chiave, token e IP", async () => {
    const fetcher = answer(passed);
    expect(await verifyTurnstile(keys, client(), "token", "sign-up", fetcher)).toBe("valid");
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe(siteverify);
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({
      secret: "0x4-segreta",
      response: "token",
      remoteip: "203.0.113.9",
    });
    expect(logs()).toEqual([]);
  });

  it("rifiuta senza chiamare Siteverify un token assente o oltre 2048 caratteri", async () => {
    const fetcher = answer(passed);
    expect(await verifyTurnstile(keys, client(), "", "sign-up", fetcher)).toBe("invalid");
    expect(await verifyTurnstile(keys, client(), "t".repeat(2049), "sign-up", fetcher)).toBe(
      "invalid",
    );
    expect(fetcher).not.toHaveBeenCalled();
    expect(await verifyTurnstile(keys, client(), "t".repeat(2048), "sign-up", fetcher)).toBe(
      "valid",
    );
  });

  it.each([
    ["di un altro hostname", { ...passed, hostname: "fiscalbay.it" }],
    ["di un'altra azione", { ...passed, action: "support" }],
    ["senza azione", { success: true, hostname: "test.fiscalbay.it" }],
    ["scaduto o già usato", { success: false, "error-codes": ["timeout-or-duplicate"] }],
    ["non valido", { success: false, "error-codes": ["invalid-input-response"] }],
  ])("rifiuta un token %s senza registrare errori", async (_, body) => {
    expect(await verifyTurnstile(keys, client(), "token", "sign-up", answer(body))).toBe("invalid");
    expect(logs()).toEqual([]);
  });

  it.each([
    ["Siteverify in errore", answer({}, { status: 503 }), "unavailable", 503],
    ["Siteverify che limita", answer({}, { status: 429 }), "rate_limited", 429],
    ["una risposta non JSON", vi.fn(async () => new Response("<html>")), "invalid_response"],
    ["una risposta diversa", answer({ ok: true }), "invalid_response"],
    ["la rete interrotta", vi.fn(() => Promise.reject(new TypeError("rete"))), "unavailable"],
    ["un errore interno", answer({ success: false, "error-codes": ["internal-error"] })],
    ["la chiave non valida", answer({ success: false, "error-codes": ["invalid-input-secret"] })],
    ["un rifiuto senza codici", answer({ success: false })],
  ])(
    "con %s non decide e registra il guasto",
    async (_, fetcher, failure = "credentials", status?: number) => {
      const input = client();
      expect(await verifyTurnstile(keys, input, "token", "sign-up", fetcher as typeof fetch)).toBe(
        "unavailable",
      );
      // Nel log soltanto codice, operazione, guasto e stato: mai token, chiave o risposta.
      expect(logs()).toEqual([
        {
          event: "application_error",
          code: failure === "credentials" ? "STORE_RECONNECT_REQUIRED" : "UPSTREAM_UNAVAILABLE",
          operation: "turnstile",
          correlationId: expect.any(String),
          failure,
          ...(status ? { status } : {}),
        },
      ]);
    },
  );

  it("accetta l'esito delle chiavi di prova soltanto fuori dai domini HTTPS", async () => {
    const testing = {
      success: true,
      hostname: "example.com",
      metadata: { result_with_testing_key: true },
    };
    const local = { ...keys, APP_ORIGIN: "http://localhost:5173" } as unknown as Env;
    expect(await verifyTurnstile(local, client(), "token", "support", answer(testing))).toBe(
      "valid",
    );
    expect(await verifyTurnstile(keys, client(), "token", "support", answer(testing))).toBe(
      "unavailable",
    );
    expect(logs()).toHaveLength(1);
  });

  it("legge il token dal modulo e ne traduce l'esito in avviso", async () => {
    const original = globalThis.fetch;
    const form = new FormData();
    try {
      globalThis.fetch = answer(passed);
      expect(await turnstileFailure(keys, client(), form, "sign-up")).toBe("verifica-non-riuscita");
      form.set(turnstileField, "token");
      expect(await turnstileFailure(keys, client(), form, "sign-up")).toBeNull();
      globalThis.fetch = answer({}, { status: 500 });
      expect(await turnstileFailure(keys, client(), form, "sign-up")).toBe(
        "verifica-non-disponibile",
      );
    } finally {
      globalThis.fetch = original;
    }
  });
});
