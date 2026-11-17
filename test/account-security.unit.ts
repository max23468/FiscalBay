import { afterEach, expect, it, vi } from "vitest";

import {
  passkeyAutofillAvailable,
  signalPasskeyState,
  signInWithPasskey,
  verifiedByServer,
} from "../app/account/passkey";
import { passkeyFailure } from "../app/account/passkey-error";
import { securityReturnPath } from "../app/app-links";

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Browser con la Signal API e la richiesta condizionale, sull'hostname del test. */
function stubBrowser(capabilities: Record<string, boolean> = { conditionalGet: true }) {
  const credential = {
    signalUnknownCredential: vi.fn(async () => {}),
    signalAllAcceptedCredentials: vi.fn(async () => {}),
    signalCurrentUserDetails: vi.fn(async () => {}),
    getClientCapabilities: vi.fn(async () => capabilities),
  };
  vi.stubGlobal("window", {
    PublicKeyCredential: credential,
    location: { hostname: "test.fiscalbay.it" },
  });
  return credential;
}

it("segnala al browser la passkey che il server non conosce, e soltanto quella", async () => {
  const credential = stubBrowser();
  const webauthn = { response: { id: "credenziale-orfana" }, clientExtensionResults: {} };
  const client = (result: unknown) =>
    ({ signIn: { passkey: vi.fn(async () => result) } }) as unknown as Parameters<
      typeof signInWithPasskey
    >[0];
  const unknown = client({
    data: null,
    error: { code: "PASSKEY_NOT_FOUND", status: 401, statusText: "UNAUTHORIZED" },
    webauthn,
  });
  const result = await signInWithPasskey(unknown, true);
  expect(unknown.signIn.passkey).toHaveBeenCalledWith({
    autoFill: true,
    returnWebAuthnResponse: true,
  });
  expect(verifiedByServer(result)).toBe(true);
  expect(credential.signalUnknownCredential).toHaveBeenCalledWith({
    rpId: "test.fiscalbay.it",
    credentialId: "credenziale-orfana",
  });
  credential.signalUnknownCredential.mockClear();
  // Una firma non valida o una cerimonia annullata non dicono che la passkey non esiste.
  await signInWithPasskey(
    client({ data: null, error: { code: "AUTHENTICATION_FAILED", status: 401 }, webauthn }),
  );
  const cancelled = await signInWithPasskey(
    client({ data: null, error: { code: "ERROR_CEREMONY_ABORTED", status: 400 } }),
  );
  expect(verifiedByServer(cancelled)).toBe(false);
  expect(credential.signalUnknownCredential).not.toHaveBeenCalled();
});

it("aggiorna il gestore delle passkey solo dove il browser lo permette", async () => {
  const credential = stubBrowser();
  const signals = {
    userId: "handle-stabile",
    credentialIds: ["prima", "seconda"],
    name: "utente@example.invalid",
    displayName: "Utente Prova",
  };
  signalPasskeyState(signals);
  expect(credential.signalAllAcceptedCredentials).toHaveBeenCalledWith({
    rpId: "test.fiscalbay.it",
    userId: "handle-stabile",
    allAcceptedCredentialIds: ["prima", "seconda"],
  });
  expect(credential.signalCurrentUserDetails).toHaveBeenCalledWith({
    rpId: "test.fiscalbay.it",
    userId: "handle-stabile",
    name: "utente@example.invalid",
    displayName: "Utente Prova",
  });
  expect(await passkeyAutofillAvailable()).toBe(true);
  stubBrowser({ conditionalGet: false });
  expect(await passkeyAutofillAvailable()).toBe(false);
  // Senza Signal API né WebAuthn nessuna chiamata e nessun errore.
  vi.stubGlobal("window", { PublicKeyCredential: {}, location: { hostname: "localhost" } });
  expect(() => signalPasskeyState(signals)).not.toThrow();
  expect(await passkeyAutofillAvailable()).toBe(false);
  vi.stubGlobal("window", { location: { hostname: "localhost" } });
  expect(() => signalPasskeyState(signals)).not.toThrow();
  expect(await passkeyAutofillAvailable()).toBe(false);
});

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
    "/en/app/settings/account",
  ]) {
    expect(securityReturnPath("it", value)).toBeNull();
  }
  expect(securityReturnPath("en", "/en/app/settings/account#security-methods")).toBe(
    "/en/app/settings/account#security-methods",
  );
});
