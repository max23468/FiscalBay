import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { UpstreamError, upstreamJson, upstreamText } from "../app/integrations/http.server";

afterEach(() => vi.useRealTimers());

describe("confine HTTP dei provider", () => {
  const url = "https://api.ebay.invalid/risorsa";
  const failure = (promise: Promise<unknown>) =>
    promise.then(
      () => null,
      (error: unknown) =>
        error instanceof UpstreamError
          ? { failure: error.failure, code: error.code, ...error.details }
          : error,
    );

  it("classifica credenziali, rate limit, indisponibilità e rifiuti con Retry-After", async () => {
    const reply = (response: Response) => vi.fn<typeof fetch>(async () => response);
    expect(await failure(upstreamText(reply(new Response(null, { status: 401 })), url))).toEqual({
      failure: "credentials",
      code: "STORE_RECONNECT_REQUIRED",
      status: 401,
    });
    expect(
      await failure(
        upstreamText(
          reply(new Response(null, { status: 429, headers: { "retry-after": "120" } })),
          url,
        ),
      ),
    ).toEqual({
      failure: "rate_limited",
      code: "UPSTREAM_UNAVAILABLE",
      status: 429,
      retryAfter: 120,
    });
    expect(
      await failure(
        upstreamText(
          reply(
            new Response(null, {
              status: 503,
              headers: { "retry-after": "Thu, 01 Oct 2026 10:01:00 GMT" },
            }),
          ),
          url,
          {},
          { now: Date.parse("2026-10-01T10:00:00.000Z") },
        ),
      ),
    ).toEqual({
      failure: "unavailable",
      code: "UPSTREAM_UNAVAILABLE",
      status: 503,
      retryAfter: 60,
    });
    // Del body del provider resta solo un codice OAuth breve, mai il testo.
    expect(
      await failure(
        upstreamText(
          reply(Response.json({ error: "invalid_grant", detail: "NON-ESPORRE" }, { status: 400 })),
          url,
        ),
      ),
    ).toEqual({
      failure: "rejected",
      code: "INVALID_REQUEST",
      status: 400,
      providerCode: "invalid_grant",
    });
    expect(
      await failure(
        upstreamText(
          vi.fn<typeof fetch>(async () => {
            throw new TypeError("rete");
          }),
          url,
        ),
      ),
    ).toEqual({ failure: "unavailable", code: "UPSTREAM_UNAVAILABLE" });
  });

  it("rifiuta Retry-After illeggibile e codici provider inadatti senza esporre il body", async () => {
    const fetcher = (body: unknown) =>
      vi.fn<typeof fetch>(async () => Response.json(body, { status: 400 }));
    for (const body of [{ error: 123 }, { error: "NON-ESPORRE" }, { detail: "NON-ESPORRE" }]) {
      expect(await failure(upstreamText(fetcher(body), url))).toEqual({
        failure: "rejected",
        code: "INVALID_REQUEST",
        status: 400,
        providerCode: undefined,
      });
    }
    expect(
      await failure(
        upstreamText(
          vi.fn<typeof fetch>(
            async () =>
              new Response(null, {
                status: 429,
                headers: { "retry-after": "non-data" },
              }),
          ),
          url,
        ),
      ),
    ).toEqual({
      failure: "rate_limited",
      code: "UPSTREAM_UNAVAILABLE",
      status: 429,
      retryAfter: undefined,
    });
  });

  it("propaga l'annullamento del chiamante anche quando il timeout non è scaduto", async () => {
    const controller = new AbortController();
    const fetcher = vi.fn<typeof fetch>(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init!.signal!.addEventListener("abort", () => reject(init!.signal!.reason));
        }),
    );
    const pending = upstreamText(fetcher, url, { signal: controller.signal });
    controller.abort();
    expect(await failure(pending)).toEqual({
      failure: "unavailable",
      code: "UPSTREAM_UNAVAILABLE",
    });
    expect(fetcher.mock.calls[0]![1]!.signal!.aborted).toBe(true);
  });

  it("limita i byte anche senza Content-Length e interrompe una lettura troppo lunga", async () => {
    const declared = new Response("x".repeat(10), { headers: { "content-length": "2000" } });
    expect(
      await failure(
        upstreamText(
          vi.fn<typeof fetch>(async () => declared),
          url,
          {},
          { maxBytes: 1000 },
        ),
      ),
    ).toMatchObject({ failure: "invalid_response" });

    const streamed = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new Uint8Array(400));
      },
    });
    expect(
      await failure(
        upstreamText(
          vi.fn<typeof fetch>(async () => new Response(streamed)),
          url,
          {},
          { maxBytes: 1000 },
        ),
      ),
    ).toMatchObject({ failure: "invalid_response" });

    // Il timeout copre anche il body: un flusso che si ferma a metà non resta appeso.
    const stalled = vi.fn<typeof fetch>(async (_input, init) => {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("{"));
          init!.signal!.addEventListener("abort", () => controller.error(init!.signal!.reason));
        },
      });
      return new Response(body);
    });
    expect(await failure(upstreamText(stalled, url, {}, { timeoutMs: 20 }))).toEqual({
      failure: "unavailable",
      code: "UPSTREAM_UNAVAILABLE",
    });
  });

  it("distingue JSON illeggibile o diverso dallo schema", async () => {
    const schema = z.object({ ok: z.literal(true) });
    const reply = (body: string) => vi.fn<typeof fetch>(async () => new Response(body));
    expect(await failure(upstreamJson(reply("{"), url, schema))).toMatchObject({
      failure: "invalid_response",
    });
    expect(await failure(upstreamJson(reply('{"ok":false}'), url, schema))).toMatchObject({
      failure: "invalid_response",
    });
    expect(await upstreamJson(reply('{"ok":true,"extra":1}'), url, schema)).toEqual({ ok: true });
  });
});
