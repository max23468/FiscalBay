import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, scriptNonce } from "../app/content-security.server";

describe("CSP dei documenti", () => {
  it("genera un nonce diverso per ogni risposta, di 128 bit", () => {
    const nonces = new Set(Array.from({ length: 100 }, scriptNonce));
    expect(nonces.size).toBe(100);
    for (const nonce of nonces) expect(atob(nonce)).toHaveLength(16);
  });

  it("ammette solo script dell'origine, con il nonce, di Turnstile o del beacon Web Analytics e nessuna inclusione in frame", () => {
    const directives = new Map(
      contentSecurityPolicy("bm9uY2U=")
        .split("; ")
        .map((directive) => {
          const [name, ...sources] = directive.split(" ");
          return [name!, sources] as const;
        }),
    );
    expect(directives.get("script-src")).toEqual([
      "'self'",
      "'nonce-bm9uY2U='",
      "https://challenges.cloudflare.com",
      "https://static.cloudflareinsights.com/beacon.min.js",
    ]);
    // Il solo frame ammesso è il widget Turnstile.
    expect(directives.get("frame-src")).toEqual(["https://challenges.cloudflare.com"]);
    expect(directives.get("default-src")).toEqual(["'self'"]);
    expect(directives.get("connect-src")).toEqual(["'self'"]);
    for (const name of ["object-src", "base-uri", "frame-ancestors"])
      expect(directives.get(name), name).toEqual(["'none'"]);
    // Immagini: origine, segnaposto `data:` dell'anteprima e i soli host eBay qualificati.
    expect(directives.get("img-src")).toEqual([
      "'self'",
      "data:",
      "https://i.ebayimg.com",
      "https://i.ebayimg.sandbox.ebay.com",
    ]);
    expect([...directives.values()].flat()).not.toContain("'unsafe-eval'");
  });
});
