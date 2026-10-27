import { env } from "cloudflare:workers";
import { describe, expect, it, vi } from "vitest";

import { ApplicationError, classifyFailure, correlateResponse, logFailure } from "../app/errors";
import { errorResponse } from "../app/error-response";
import { appCopy } from "../app/app-copy";
import { formatAmount, languageFromPath, localizedPath } from "../app/i18n";
import { minorToDecimal, parseMinor } from "../app/money";
import { formatDate } from "../app/format";
import { loader as loadAccess } from "../app/routes/sign-in";

import { issueTimingTicket } from "../app/page-timing.server";
import { action as pageTiming } from "../app/routes/page-timing";
import { invocationPoint, writePoints } from "../app/metrics.server";
import {
  describeRequest,
  measure,
  withInvocationMetrics,
  withPhaseTimings,
} from "../app/observability.server";
import { routeData, routeResponse } from "./fixtures/route-fixtures";

describe("errors, locale and redacted logs", () => {
  it("adds correlation to redirects with immutable headers", () => {
    const response = correlateResponse(
      Response.redirect("https://test.fiscalbay.it/en", 303),
      "d19c4e5a-5547-4c91-aeaf-b2e7e83e7bd1",
    );
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://test.fiscalbay.it/en");
    expect(response.headers.get("x-correlation-id")).toBe("d19c4e5a-5547-4c91-aeaf-b2e7e83e7bd1");
    const cookieHeaders = new Headers();
    cookieHeaders.append("set-cookie", "a=one; HttpOnly");
    cookieHeaders.append("set-cookie", "b=two; HttpOnly");
    const signedIn = correlateResponse(
      new Response(null, { status: 303, headers: cookieHeaders }),
      "d19c4e5a-5547-4c91-aeaf-b2e7e83e7bd1",
    );
    expect(signedIn.headers.getSetCookie()).toEqual(cookieHeaders.getSetCookie());
  });

  it("localizes notices from the actual access loader", async () => {
    const result = await routeData(loadAccess, "/en/accesso?accesso=errore");
    expect(result).toMatchObject({
      language: "en",
      notice: {
        text: "Could not complete the operation. Check your email and password.",
        tone: "danger",
      },
    });
  });

  it("returns stable bilingual errors with correlation and consistent retry headers", async () => {
    const english = new Request("https://test.fiscalbay.it/en/checkout", {
      headers: { "x-correlation-id": "d19c4e5a-5547-4c91-aeaf-b2e7e83e7bd1" },
    });
    const retry = errorResponse(english, "UPSTREAM_UNAVAILABLE");
    expect(retry.status).toBe(503);
    expect(retry.headers.get("retry-after")).toBe("60");
    expect(await retry.json()).toEqual({
      code: "UPSTREAM_UNAVAILABLE",
      message: "Service temporarily unavailable. Try again later.",
      correlationId: "d19c4e5a-5547-4c91-aeaf-b2e7e83e7bd1",
      retryable: true,
    });

    const italian = errorResponse(
      new Request("https://test.fiscalbay.it/accesso"),
      "AUTH_REQUIRED",
    );
    expect(italian.status).toBe(401);
    expect(italian.headers.has("retry-after")).toBe(false);
    expect(((await italian.json()) as { message: string }).message).toBe("Accedi per continuare.");
    expect(classifyFailure(new ApplicationError("STORE_RECONNECT_REQUIRED"))).toBe(
      "STORE_RECONNECT_REQUIRED",
    );
    expect(classifyFailure(new Error("bearer-sensitive"))).toBe("INTERNAL_ERROR");
  });

  it("logs only allowed metadata even when the request contains tax data and tokens", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const request = new Request("https://test.fiscalbay.it/?cf=ABCDEF12G34H567I", {
        headers: { authorization: "Bearer secret-token", "x-correlation-id": "not-a-uuid" },
      });
      logFailure({ request, code: "INTERNAL_ERROR", operation: "route" });
      const line = spy.mock.calls[0]?.[0] as string;
      expect(JSON.parse(line)).toMatchObject({
        event: "application_error",
        code: "INTERNAL_ERROR",
        operation: "route",
      });
      expect(line).not.toMatch(/ABCDEF12G34H567I|secret-token|not-a-uuid/u);
    } finally {
      spy.mockRestore();
    }
  });

  it("formats the same instant and amount for both locales", () => {
    expect(languageFromPath("/en/orders")).toBe("en");
    expect(languageFromPath("/en.data")).toBe("en");
    expect(languageFromPath("/_root.data")).toBe("it");
    expect(languageFromPath("/english")).toBe("it");
    expect(localizedPath("en", "/accesso")).toBe("/en/accesso");
    expect(appCopy.it.orders.title).toBe("Ordini");
    expect(appCopy.en.orders.title).toBe("Orders");
    expect(formatDate("2026-09-26T12:30:00.000Z", "it")).not.toBe(
      formatDate("2026-09-26T12:30:00.000Z", "en"),
    );
    expect(formatAmount(12345, "EUR", "it")).toContain("123,45");
    expect(formatAmount(12345, "EUR", "en")).toContain("123.45");
    expect(formatAmount(124900, "EUR", "it")).toContain("1.249,00");
    expect(formatAmount(1234560, "EUR", "it")).toContain("12.345,60");
    expect(formatAmount(124900, "EUR", "en")).toContain("1,249.00");
    // L'esponente segue la valuta: lo yen non ha decimali, il dinaro kuwaitiano tre.
    expect(formatAmount(1000, "JPY", "en")).toContain("1,000");
    expect(formatAmount(1000, "JPY", "en")).not.toContain(".");
    for (const currency of ["USD", "CAD", "AUD"]) {
      expect(formatAmount(123456, currency, "it")).toContain(currency);
      expect(formatAmount(123456, currency, "en")).toContain(currency);
    }
    expect(formatAmount(1234, "KWD", "it")).toContain("1,234");
    expect(parseMinor("12.5", "EUR")).toBe(1250);
    expect(parseMinor("1.234", "KWD")).toBe(1234);
    expect(parseMinor("12.500", "EUR")).toBe(1250);
    expect(() => parseMinor("1.5", "JPY")).toThrow("inexact_amount");
    expect(() => parseMinor("-1", "EUR")).toThrow("invalid_amount");
    expect([minorToDecimal(5, "EUR"), minorToDecimal(1000, "JPY")]).toEqual(["0.05", "1000"]);
    expect(() => formatDate("bad", "it")).toThrow();
  });

  it("keeps the date-time separator stable when browser ICU uses a different combined pattern", () => {
    const original = Intl.DateTimeFormat;
    const spy = vi.spyOn(Intl, "DateTimeFormat").mockImplementation(function (locales, options) {
      const formatter = new original(locales, options);
      if (options?.dateStyle && options.timeStyle) {
        return { ...formatter, format: () => "Sep 26, 2026 at 2:30 PM" } as Intl.DateTimeFormat;
      }
      return formatter;
    });
    try {
      expect(formatDate("2026-09-26T12:30:00.000Z", "en")).toBe("26 Sep 2026, 14:30");
      expect(formatDate("2026-09-26T12:30:00.000Z", "it")).toBe("26 set 2026, 14:30");
    } finally {
      spy.mockRestore();
    }
  });

  it("writes British dates with the same month abbreviation whatever the ICU version", () => {
    const original = Intl.DateTimeFormat;
    const spy = vi.spyOn(Intl, "DateTimeFormat").mockImplementation(function (locales, options) {
      const formatter = new original(locales, options);
      if (options?.dateStyle) {
        return { ...formatter, format: () => "26 Sept 2026" } as Intl.DateTimeFormat;
      }
      return formatter;
    });
    try {
      expect(formatDate("2026-09-26T12:30:00.000Z", "en", "date")).toBe("26 Sep 2026");
    } finally {
      spy.mockRestore();
    }
  });
});

describe("misure delle fasi e del browser", () => {
  const page = new Request("https://test.fiscalbay.it/app/ordini");

  it("espone in Server-Timing la durata delle sole fasi misurate", async () => {
    const response = await withPhaseTimings(page, async () => {
      await measure("auth", "session", async () => undefined);
      await measure("d1", "orders", async () => undefined);
      await measure("d1", "stores", async () => undefined);
      await expect(
        measure("ebay", "request", async () => {
          throw new ApplicationError("UPSTREAM_UNAVAILABLE");
        }),
      ).rejects.toThrow("UPSTREAM_UNAVAILABLE");
      return new Response("ok", { status: 201, headers: { "x-esistente": "1" } });
    });
    expect(response.status).toBe(201);
    expect(response.headers.get("x-esistente")).toBe("1");
    expect(response.headers.get("server-timing")).toMatch(
      /^auth;dur=\d+\.\d, d1;dur=\d+\.\d, ebay;dur=\d+\.\d$/u,
    );
    // Senza fasi misurate la risposta resta com'è.
    const plain = new Response("ok");
    expect(await withPhaseTimings(page, async () => plain)).toBe(plain);
    // La risposta a un provider non porta le durate, anche con fasi misurate.
    const provider = await withPhaseTimings(
      page,
      async () => measure("d1", "orders", async () => new Response(null)),
      { serverTiming: false },
    );
    expect(provider.headers.has("server-timing")).toBe(false);
    // Fuori da una richiesta la misura non registra nulla e restituisce il risultato.
    expect(await measure("render", "document", async () => 1)).toBe(1);
  });

  it("apre uno span per fase con i soli attributi ammessi e il codice dell'errore", async () => {
    const spans: Array<{
      name: string;
      attributes: Record<string, unknown>;
      status?: string;
      ended: boolean;
    }> = [];
    const active = { attributes: {} as Record<string, unknown> };
    const span = (name: string) => {
      const entry = {
        name,
        attributes: {} as Record<string, unknown>,
        status: undefined as string | undefined,
        ended: false,
      };
      spans.push(entry);
      return {
        setAttributes: (values: Record<string, unknown>) => Object.assign(entry.attributes, values),
        setAttribute: (key: string, value: unknown) => (entry.attributes[key] = value),
        setStatus: ({ code }: { code: string }) => (entry.status = code),
        end: () => (entry.ended = true),
      };
    };
    const tracing = {
      startSpan: span,
      getActiveSpan: () => ({
        setAttributes: (values: Record<string, unknown>) =>
          Object.assign(active.attributes, values),
      }),
    } as unknown as Tracing;
    await withPhaseTimings(
      page,
      async () => {
        await measure("d1", "orders", async () => undefined);
        await measure("ebay", "request", async () => {
          throw new ApplicationError("UPSTREAM_UNAVAILABLE");
        }).catch(() => undefined);
        describeRequest({ page: "orders", orders: 2 });
        return new Response(null);
      },
      { tracing },
    );
    expect(spans).toEqual([
      {
        name: "fiscalbay.d1",
        attributes: { "fiscalbay.phase": "d1", "fiscalbay.operation": "orders" },
        status: "ok",
        ended: true,
      },
      {
        name: "fiscalbay.ebay",
        attributes: {
          "fiscalbay.phase": "ebay",
          "fiscalbay.operation": "request",
          "fiscalbay.error": "UPSTREAM_UNAVAILABLE",
        },
        status: "error",
        ended: true,
      },
    ]);
    expect(active.attributes).toEqual({ "fiscalbay.page": "orders", "fiscalbay.orders": 2 });
  });

  const timing = (body: string, headers: Record<string, string> = {}) =>
    routeResponse(pageTiming, "/api/v1/page-timing", {
      body,
      headers: { "content-type": "application/json", ...headers },
    });

  it("scrive le misure del browser su Analytics Engine soltanto con i campi ammessi", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const written = vi.spyOn(env.METRICS, "writeDataPoint").mockImplementation(() => {});
    const measures = {
      page: "orders",
      ttfb: 120,
      fcp: 300,
      ready: 650,
      server: { auth: 12, d1: 8 },
    };
    const valid = {
      ...measures,
      ticket: await issueTimingTicket(env.BETTER_AUTH_SECRET, "orders"),
    };
    expect((await timing(JSON.stringify(valid))).status).toBe(204);
    // Il biglietto non entra nel punto; le misure assenti (LCP, eBay, rendering) valgono -1.
    expect(written).toHaveBeenCalledExactlyOnceWith({
      indexes: ["page:browser"],
      blobs: ["page", "browser", "orders", "", "ok", env.VERSION_METADATA.id],
      doubles: [120, 300, -1, 650, 12, 8, -1, -1],
    });
    written.mockClear();
    for (const body of [
      JSON.stringify({ ...valid, url: "/app/ordini?q=RSSMRA80A01H501U" }),
      JSON.stringify({ ...valid, page: "profilo" }),
      JSON.stringify({ ...valid, ttfb: -1 }),
      JSON.stringify({ ...valid, ready: 120_001 }),
      JSON.stringify({ ...valid, fcp: 1.5 }),
      JSON.stringify({ ...valid, server: { stripe: 4 } }),
      JSON.stringify(measures),
      "non è JSON",
    ])
      expect((await timing(body)).status).toBe(400);
    expect(
      (await timing(JSON.stringify(valid), { origin: "https://estraneo.invalid" })).status,
    ).toBe(403);
    expect((await timing(JSON.stringify({ ...valid, padding: "x".repeat(2_000) }))).status).toBe(
      413,
    );
    // Anche un invio a blocchi, senza lunghezza dichiarata, si ferma al limite.
    const chunked = new ReadableStream({
      start(controller) {
        for (let index = 0; index < 4; index++) controller.enqueue(new Uint8Array(400));
        controller.close();
      },
    });
    const streamed = new Request("http://localhost:5173/api/v1/page-timing", {
      method: "POST",
      headers: { origin: "http://localhost:5173" },
      body: chunked,
      duplex: "half",
    } as RequestInit);
    expect(streamed.headers.get("content-length")).toBeNull();
    expect(
      (await pageTiming({ request: streamed } as Parameters<typeof pageTiming>[0])).status,
    ).toBe(413);
    expect((await timing("")).status).toBe(204);
    expect(written).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
    written.mockRestore();
  });
});

describe("metriche tecniche su Analytics Engine", () => {
  const version = "c66e8cc5-c242-464f-9c0f-90bb4dbf8f44";
  const recorder = () => {
    const points: AnalyticsEngineDataPoint[] = [];
    return {
      points,
      dataset: { writeDataPoint: (point) => points.push(point!) } as AnalyticsEngineDataset,
    };
  };

  it("scrive esito, latenza e fasi della richiesta senza dati dell'utente, dell'ordine o dell'URL", async () => {
    const { points, dataset } = recorder();
    const personal = new Request(
      "https://test.fiscalbay.it/app/ordini/12-00000-00001.data?q=RSSMRA80A01H501U&email=mario.rossi%40example.invalid",
      {
        method: "POST",
        headers: {
          cookie: "better-auth.session_token=sessione-segreta",
          "cf-connecting-ip": "203.0.113.7",
        },
      },
    );
    await withPhaseTimings(
      personal,
      async () => {
        await measure("d1", "orders", async () => undefined);
        await measure("d1", "orders", async () => undefined);
        await measure("ebay", "request", async () => {
          throw new ApplicationError("UPSTREAM_UNAVAILABLE");
        }).catch(() => undefined);
        return new Response(null, { status: 404 });
      },
      { dataset, version },
    );
    const duration = expect.any(Number);
    expect(points).toEqual([
      {
        indexes: ["invocation:http"],
        blobs: ["invocation", "http", "data", "POST", "4xx", version],
        doubles: [1, duration, duration],
      },
      {
        indexes: ["phase:http"],
        blobs: ["phase", "http", "d1", "orders", "ok", version],
        doubles: [2, duration, duration],
      },
      {
        indexes: ["phase:http"],
        blobs: ["phase", "http", "ebay", "request", "UPSTREAM_UNAVAILABLE", version],
        doubles: [1, duration, duration],
      },
    ]);
    // Le due letture D1 si sommano: il totale non è inferiore alla più lunga.
    const [, d1] = points;
    expect(d1!.doubles![1]).toBeGreaterThanOrEqual(d1!.doubles![2]!);
    const written = JSON.stringify(points);
    for (const forbidden of [
      "RSSMRA",
      "mario",
      "example.invalid",
      "12-00000",
      "/app",
      "?",
      "sessione-segreta",
      "203.0.113",
      "@",
    ])
      expect(written).not.toContain(forbidden);

    // Una richiesta che fallisce conta come errore del server, con le fasi raggiunte.
    points.length = 0;
    await expect(
      withPhaseTimings(
        new Request("https://test.fiscalbay.it/api/v1/page-timing"),
        async () => {
          await measure("auth", "session", async () => undefined);
          throw new Error("NON-ESPORRE");
        },
        { dataset },
      ),
    ).rejects.toThrow("NON-ESPORRE");
    expect(points.map((point) => point.blobs)).toEqual([
      ["invocation", "http", "api", "GET", "5xx", ""],
      ["phase", "http", "auth", "session", "ok", ""],
    ]);
    expect(JSON.stringify(points)).not.toContain("NON-ESPORRE");
  });

  it("misura coda e cron con esito, numero di messaggi e fasi attraversate", async () => {
    const { points, dataset } = recorder();
    await withInvocationMetrics(
      "queue",
      "sync",
      () => measure("ebay", "request", async () => undefined),
      { dataset, count: 3, outcome: () => "retry" },
    );
    await expect(
      withInvocationMetrics(
        "cron",
        "dispatch",
        async () => {
          throw new Error("NON-ESPORRE");
        },
        { dataset, outcome: () => "ok" },
      ),
    ).rejects.toThrow("NON-ESPORRE");
    expect(points.map(({ blobs, doubles }) => [blobs, doubles![0]])).toEqual([
      [["invocation", "queue", "sync", "", "retry", ""], 3],
      [["phase", "queue", "ebay", "request", "ok", ""], 1],
      [["invocation", "cron", "dispatch", "", "error", ""], 1],
    ]);
  });

  it("non scrive campi fuori elenco né valori non finiti e non interrompe l'invocazione", () => {
    const { points, dataset } = recorder();
    const valid = invocationPoint({
      invocation: "http",
      detail: "document",
      method: "PROPFIND",
      outcome: "2xx",
      durationMs: 12.345,
      version: "non-uuid",
    });
    // Un metodo fuori elenco diventa OTHER, una versione che non è un UUID resta vuota.
    expect(valid).toEqual({
      index: "invocation:http",
      blobs: ["invocation", "http", "document", "OTHER", "2xx", ""],
      doubles: [1, 12.3, 12.3],
    });
    writePoints(dataset, [
      valid,
      { ...valid, blobs: ["invocation", "http", "mario.rossi@example.invalid", "", "2xx", ""] },
      { ...valid, blobs: ["invocation", "http", "/app/ordini?q=1", "", "2xx", ""] },
      { ...valid, doubles: [1, Number.NaN, 1] },
    ]);
    expect(points).toEqual([
      { indexes: ["invocation:http"], blobs: valid.blobs, doubles: valid.doubles },
    ]);
    // Oltre il limite per scrittura i punti in più restano fuori.
    points.length = 0;
    writePoints(
      dataset,
      Array.from({ length: 300 }, () => valid),
    );
    expect(points).toHaveLength(100);
    const refusing = {
      writeDataPoint: () => {
        throw new Error("limite");
      },
    };
    expect(() => writePoints(refusing, [valid])).not.toThrow();
    expect(() => writePoints(undefined, [valid])).not.toThrow();
  });
});
