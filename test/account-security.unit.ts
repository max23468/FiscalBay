import { expect, it } from "vitest";
import { passkeyFailure } from "../app/account/passkey-error";
import { securityReturnPath } from "../app/app-links";

it("distingue le cause passkey riconoscibili e non indovina quelle ambigue", () => {
  for (const [name, expected] of [
    ["AbortError", "cancelled"],
    ["TimeoutError", "timeout"],
    ["NotSupportedError", "unsupported"],
    ["NotAllowedError", "incomplete"],
    ["Error", "technical"],
  ]) {
    expect(passkeyFailure(new DOMException("synthetic", name))).toBe(expected);
  }
  expect(passkeyFailure({ code: "AUTH_CANCELLED" })).toBe("incomplete");
  expect(passkeyFailure({ code: "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED" })).toBe("duplicate");
  expect(passkeyFailure(null)).toBe("technical");
  for (const value of [
    "//example.invalid",
    "https://example.invalid",
    "/app/impostazioni/account?delete=1",
    "/app/impostazioni/account#unknown",
    "/en/app/impostazioni/account",
  ]) {
    expect(securityReturnPath("it", value)).toBeNull();
  }
  expect(securityReturnPath("en", "/en/app/impostazioni/account#security-methods")).toBe(
    "/en/app/impostazioni/account#security-methods",
  );
});
