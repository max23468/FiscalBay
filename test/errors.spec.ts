import { describe, expect, it, vi } from "vitest";

import {
  ApplicationError,
  classifyFailure,
  correlateResponse,
  errorResponse,
  logFailure,
} from "../app/errors";
import {
  formatAmount,
  formatInstant,
  languageFromPath,
  localizedPath,
  translate,
} from "../app/i18n";
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
      signInNotice: "Could not complete the operation. Check your email and password.",
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

  it("formats the same UTC instant and amount for both locales", () => {
    expect(languageFromPath("/en/orders")).toBe("en");
    expect(localizedPath("en", "/accesso")).toBe("/en/accesso");
    expect(translate("it", "noOrders")).toBe("Nessun ordine");
    expect(translate("en", "noOrders")).toBe("No orders");
    expect(formatInstant("2026-09-26T12:30:00.000Z", "it")).not.toBe(
      formatInstant("2026-09-26T12:30:00.000Z", "en"),
    );
    expect(formatAmount(12345, "EUR", "it")).toContain("123,45");
    expect(formatAmount(12345, "EUR", "en")).toContain("123.45");
    expect(() => formatInstant("bad", "it")).toThrow();
  });
});
