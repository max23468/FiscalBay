import { describe, expect, it, vi } from "vitest";

import {
  ApplicationError,
  classifyFailure,
  correlateResponse,
  errorResponse,
  logFailure,
} from "../app/errors";
import { appCopy } from "../app/app-copy";
import { formatAmount, languageFromPath, localizedPath } from "../app/i18n";
import { formatDate } from "../app/view-models";
import { loader as loadHome } from "../app/routes/home";

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

  it("localizes notices from the actual home loader", async () => {
    const result = await loadHome({
      request: new Request("http://localhost:5173/en?accesso=errore"),
    } as Parameters<typeof loadHome>[0]);
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
    expect((await italian.json()).message).toBe("Accedi per continuare.");
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
    expect(appCopy.it.access.noOrders).toBe("Nessun ordine");
    expect(appCopy.en.access.noOrders).toBe("No orders");
    expect(formatDate("2026-09-26T12:30:00.000Z", "it")).not.toBe(
      formatDate("2026-09-26T12:30:00.000Z", "en"),
    );
    expect(formatAmount(12345, "EUR", "it")).toContain("123,45");
    expect(formatAmount(12345, "EUR", "en")).toContain("123.45");
    expect(formatAmount(124900, "EUR", "it")).toContain("1249,00");
    expect(formatAmount(1234560, "EUR", "it")).toContain("12.345,60");
    expect(formatAmount(124900, "EUR", "en")).toContain("1,249.00");
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
